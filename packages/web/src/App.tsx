import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChiptunePlayer,
  FloppyController,
  FloppySoundSynth,
  MockRuntimeAdapter,
  createBrowserAudioContext,
  createPlatformAdapter,
  createPlatformAudio,
  findFreewareByHash,
  freewareEntryToProfile,
  freewareEntryToRights,
  type FreewareEntry,
  RightsPolicyEngine,
  unknownRightsRecord,
  type CanvasLike,
  type GameProfile,
  type PolicyDecision,
  type RightsRecord,
  type RuntimeAdapter,
  type RuntimeStatus
} from "@rgme/core";
import { Header } from "./components/Header";
import { Dropzone, type DroppedInfo } from "./components/Dropzone";
import { GameProfileInspector } from "./components/GameProfileInspector";
import { Viewport } from "./components/Viewport";
import { ControllerHUD } from "./components/ControllerHUD";
import { CrtControls } from "./components/CrtControls";
import { RemapModal } from "./components/RemapModal";
import { SaveDrawer } from "./components/SaveDrawer";
import { ChainOfTitle } from "./components/ChainOfTitle";
import { ExportPanel } from "./components/ExportPanel";
import { RuntimeSwitch } from "./components/RuntimeSwitch";
import { MediaRegistry, createRuntime, disposeRuntime, type RuntimeKind } from "./lib/runtime-factory";
import multiplatformData from "../../../concept/fixtures/multiplatform-games.json";
import c64DemoUrl from "../../../concept/fixtures/rgme-c64-demo.d64?url";
import mdDemoUrl from "../../../concept/fixtures/rgme-md-demo.md?url";
import { FloppyDrives } from "./components/FloppyDrives";
import { LibraryShelf } from "./components/LibraryShelf";
import { useGamepad } from "./hooks/useGamepad";
import { DEFAULT_CRT_PRESET_ID, getCrtPreset, type CrtParams } from "./lib/crt/presets";
import { GameLibraryStore, type LibraryRecord } from "./lib/library";
import { IndexedDbSaveStore, MemorySaveStore, SaveStateManager } from "./lib/save";
import { useKeyboardInput } from "./hooks/useKeyboardInput";
import { hashFile } from "./lib/hash";
import { buildProfileFromFile } from "./lib/profile";
import { DEMO_PROFILE, DEMO_RIGHTS } from "./samples/demo";
import freewareData from "../../../concept/fixtures/freeware-games.json";
import sceneIntroUrl from "../../../concept/fixtures/rgme-scene-intro.adf?url";

const FREEWARE = [...(freewareData as unknown as FreewareEntry[]), ...(multiplatformData as unknown as FreewareEntry[])];

export type AdapterFactory = (canvas: CanvasLike | null) => RuntimeAdapter;
const defaultFactory: AdapterFactory = (canvas) =>
  new MockRuntimeAdapter(canvas ?? undefined, undefined, new ChiptunePlayer(createBrowserAudioContext));
const engine = new RightsPolicyEngine();
const INITIAL: RuntimeStatus = { state: "UNLOADED", frame: 0, diskActivity: false };

export function App({ createAdapter = defaultFactory }: { createAdapter?: AdapterFactory }) {
  const [adapter, setAdapter] = useState<RuntimeAdapter>();
  const adapterRef = useRef<RuntimeAdapter | undefined>(undefined);
  const unsub = useRef<(() => void) | undefined>(undefined);
  const [status, setStatus] = useState<RuntimeStatus>(INITIAL);
  const [info, setInfo] = useState<DroppedInfo>();
  const [profile, setProfile] = useState<GameProfile>();
  const [decisions, setDecisions] = useState<{ private_execution: PolicyDecision; binary_redistribution: PolicyDecision }>();
  const [crt, setCrt] = useState(false);
  const [inputs, setInputs] = useState<ReadonlySet<string>>(new Set());
  const [hasSave, setHasSave] = useState(false);
  const [muted, setMuted] = useState(false);
  const [canvasEl, setCanvasEl] = useState<HTMLCanvasElement | null>(null);
  const [crtId, setCrtId] = useState(DEFAULT_CRT_PRESET_ID);
  const [crtParams, setCrtParams] = useState<CrtParams>(() => getCrtPreset(DEFAULT_CRT_PRESET_ID).params);
  const [savesOpen, setSavesOpen] = useState(false);
  const [remapOpen, setRemapOpen] = useState(false);
  const [libraryKey, setLibraryKey] = useState(0);
  const floppy = useMemo(() => new FloppyController(), []);
  const floppySynth = useMemo(() => new FloppySoundSynth(createBrowserAudioContext), []);
  useEffect(() => {
    const off = floppySynth.attach(floppy);
    return () => { off(); floppySynth.dispose(); floppy.dispose(); };
  }, [floppy, floppySynth]);
  const mediaRegistry = useMemo(() => new MediaRegistry(), []);
  const bytesBySha = useRef(new Map<string, Uint8Array>());
  const adapterKey = useRef("amiga:mock");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const runtimeKindRef = useRef<RuntimeKind>("mock");
  const [runtimeKind, setRuntimeKindState] = useState<RuntimeKind>("mock");
  const [rightsRecord, setRightsRecord] = useState<RightsRecord>();
  const [runtimeError, setRuntimeError] = useState<string>();
  const library = useMemo(() => new GameLibraryStore(), []);
  const saves = useMemo(() => new SaveStateManager(IndexedDbSaveStore.available() ? new IndexedDbSaveStore() : new MemorySaveStore()), []);

  const onCanvas = useCallback(
    (canvas: HTMLCanvasElement) => {
      if (adapterRef.current) return;
      const a = createAdapter(canvas as unknown as CanvasLike);
      adapterRef.current = a;
      canvasRef.current = canvas;
      setCanvasEl(canvas);
      unsub.current = a.onStatus(setStatus);
      setAdapter(a);
    },
    [createAdapter]
  );

  // Stop the runtime (timers, audio) when the app unmounts.
  useEffect(
    () => () => {
      // Not unsubscribing here: StrictMode simulates an unmount/remount and the listener must survive it.
      disposeRuntime(adapterRef.current);
    },
    []
  );

  const press = useCallback((action: string, down: boolean) => {
    adapterRef.current?.pressInput(action, down);
    setInputs((prev) => {
      const next = new Set(prev);
      if (down) next.add(action);
      else next.delete(action);
      return next;
    });
  }, []);

  useKeyboardInput(press, profile?.input, status.state === "RUNNING");
  const gp = useGamepad((action, down) => press(action, down), true);

  /** Creates (or reuses) the runtime for a profile's platform + the selected Amiga runtime kind, on the same canvas. */
  const ensureAdapter = useCallback(
    (p: GameProfile, kind: RuntimeKind) => {
      const key = p.platform === "amiga" ? `amiga:${kind}` : `${p.platform}:reference`;
      if (key === adapterKey.current) return;
      const canvas = canvasRef.current;
      let a: RuntimeAdapter;
      if (p.platform === "amiga") {
        a = kind === "wasm" ? createRuntime("wasm", canvas, { media: mediaRegistry }) : createAdapter(canvas as unknown as CanvasLike);
      } else {
        a = createPlatformAdapter(p.platform, (canvas ?? undefined) as unknown as CanvasLike | undefined, createPlatformAudio(p.platform, createBrowserAudioContext));
      }
      unsub.current?.();
      disposeRuntime(adapterRef.current);
      adapterRef.current = a;
      adapterKey.current = key;
      unsub.current = a.onStatus(setStatus);
      setAdapter(a);
      setStatus(INITIAL);
    },
    [createAdapter, mediaRegistry]
  );

  const activate = useCallback(async (p: GameProfile, rights: RightsRecord | undefined) => {
    const record = rights ?? unknownRightsRecord(p.id);
    setProfile(p);
    setRightsRecord(record);
    setRuntimeError(undefined);
    setDecisions({
      private_execution: engine.evaluateAction(record, { action: "private_execution" }),
      binary_redistribution: engine.evaluateAction(record, { action: "binary_redistribution" })
    });
    setHasSave(false);
    // Mount the boot disk in DF0: and spin up the drive (head recalibration + first read).
    const boot = p.media.find((m) => m.id === p.launch.bootMediaId) ?? p.media[0]!;
    if (p.platform === "amiga") {
    floppy.insertDisk(0, { id: boot.id, label: boot.label ?? p.title, sha256: boot.sha256 });
    floppy.setMotor(0, true);
    floppy.recalibrate(0);
    floppy.seek(0, 40);
    floppy.pulseActivity(0, "read", 400);
    }
    ensureAdapter(p, runtimeKindRef.current);
    const bytes = bytesBySha.current.get(boot.sha256.toLowerCase());
    const withMedia = adapterRef.current as unknown as { setMediaData?: (id: string, b: Uint8Array) => void };
    if (bytes) withMedia.setMediaData?.(boot.id, bytes);
    try {
      await adapterRef.current?.loadGame(p);
    } catch (err) {
      setRuntimeError(err instanceof Error ? err.message : String(err));
    }
  }, [floppy, ensureAdapter]);

  const loadDemo = useCallback(async () => {
    setInfo({ name: DEMO_PROFILE.media[0]!.filename, size: 0, sha256: DEMO_PROFILE.media[0]!.sha256, status: "Identified" });
    await activate(DEMO_PROFILE, DEMO_RIGHTS);
    adapterRef.current?.start();
  }, [activate]);

  const remember = useCallback(
    (sha256: string, bytes: Uint8Array) => {
      bytesBySha.current.set(sha256.toLowerCase(), bytes);
      mediaRegistry.register(sha256, bytes);
    },
    [mediaRegistry]
  );

  const addToLibrary = useCallback(
    async (file: File, sha256: string, resolved: Parameters<GameLibraryStore["add"]>[3]) => {
      try {
        await library.add(file, file.name, sha256, resolved);
        setLibraryKey((k) => k + 1);
      } catch {
        /* library persistence is best-effort; playing must not depend on it */
      }
    },
    [library]
  );

  const mountFromLibrary = useCallback(
    async (rec: LibraryRecord) => {
      const m = rec.profile.media[0]!;
      remember(rec.sha256, new Uint8Array(rec.data));
      setInfo({ name: m.filename, size: rec.size, sha256: rec.sha256, status: rec.rightsStatus === "unknown" ? "Unknown" : "Identified" });
      await activate(rec.profile, rec.rights);
      adapterRef.current?.start();
    },
    [activate, remember]
  );

  const onFile = useCallback(
    async (file: File): Promise<string | undefined> => {
      setInfo({ name: file.name, size: file.size, status: "Analyzing" });
      const sha256 = await hashFile(file);
      remember(sha256, new Uint8Array(await file.arrayBuffer()));
      // Identity comes from the exact SHA-256 only; anything unrecognized stays Unknown (local play only).
      const known = findFreewareByHash(FREEWARE, sha256);
      if (known) {
        setInfo({ name: file.name, size: file.size, sha256, status: "Identified" });
        const profile = freewareEntryToProfile(known);
        const rights = freewareEntryToRights(known).record;
        await activate(profile, rights);
        await addToLibrary(file, sha256, { profile, rights, title: known.canonical_title });
        return known.id;
      }
      setInfo({ name: file.name, size: file.size, sha256, status: "Unknown" });
      const profile = buildProfileFromFile(file.name, sha256);
      await activate(profile, undefined);
      await addToLibrary(file, sha256, { profile, rights: unknownRightsRecord(profile.id), title: profile.title });
      return undefined;
    },
    [activate, addToLibrary, remember]
  );

  const loadScene = useCallback(async () => {
    const res = await fetch(sceneIntroUrl);
    const file = new File([await res.arrayBuffer()], "rgme-scene-intro.adf");
    const id = await onFile(file);
    if (id) adapterRef.current?.start();
  }, [onFile]);

  const loadFixture = useCallback(
    async (url: string, filename: string) => {
      const res = await fetch(url);
      const id = await onFile(new File([await res.arrayBuffer()], filename));
      if (id) adapterRef.current?.start();
    },
    [onFile]
  );

  const switchRuntime = useCallback(
    async (kind: RuntimeKind) => {
      const wasRunning = adapterRef.current?.state === "RUNNING";
      runtimeKindRef.current = kind;
      setRuntimeKindState(kind);
      if (profile && profile.platform === "amiga") {
        await activate(profile, rightsRecord);
        if (wasRunning && adapterRef.current?.state === "LOADED") adapterRef.current.start();
      }
    },
    [profile, rightsRecord, activate]
  );

  const state = status.state;
  const canExport = decisions?.binary_redistribution.decision === "allow";
  const exportReason = useMemo(
    () =>
      !decisions
        ? "Load a game first."
        : canExport
          ? ""
          : "Export/share disabled: rights are not verified for redistribution. Unknown rights never become permission; local play only.",
    [decisions, canExport]
  );

  return (
    <div className="min-h-full flex flex-col">
      <Header status={status} runtimeName={adapter?.identifyCapabilities().name ?? "No runtime"} />
      <main className="grid gap-4 p-4 flex-1 md:grid-cols-[320px_1fr]">
        <div className="flex flex-col gap-4">
          <Dropzone info={info} onFile={onFile} />
          <button className="rgme-btn" onClick={() => void loadDemo()} data-testid="load-demo">Load demo profile</button>
          <button className="rgme-btn" onClick={() => void loadScene()} data-testid="load-scene">Load Scene Demo</button>
          <FloppyDrives controller={floppy} discs={profile ? profile.media.map((m) => ({ id: m.id, label: m.label ?? m.filename, sha256: m.sha256 })) : []} onSwap={(drive, discId) => { const m = profile?.media.find((x) => x.id === discId); if (m) adapter?.insertMedia(m); void drive; }} />
          <button className="rgme-btn" onClick={() => void loadFixture(c64DemoUrl, "rgme-c64-demo.d64")} data-testid="load-c64">Load C64 Demo</button>
          <button className="rgme-btn" onClick={() => void loadFixture(mdDemoUrl, "rgme-md-demo.md")} data-testid="load-md">Load Mega Drive Demo</button>
          <GameProfileInspector profile={profile} decisions={decisions} />
          <section className="rgme-panel">
            <div className="flex gap-2">
              <button className="rgme-btn" disabled={!canExport} data-testid="export-btn" aria-describedby="export-reason">Export</button>
              <button className="rgme-btn" disabled={!canExport} data-testid="share-btn" aria-describedby="export-reason">Share</button>
            </div>
            {profile && rightsRecord && (
              <div className="mt-3">
                <ExportPanel profile={profile} rights={rightsRecord} getMedia={async () => bytesBySha.current.get(profile.media[0]!.sha256.toLowerCase())} />
              </div>
            )}
            {exportReason && <p id="export-reason" className="text-sm mt-2" style={{ color: "var(--rgme-fg-secondary)" }} data-testid="export-reason">{exportReason}</p>}
          </section>
        </div>
        <div>
          <Viewport crt={crt} crtParams={crtParams} onToggleCrt={() => setCrt((c) => !c)} onCanvas={onCanvas} />
          {crt && (
            <div className="mt-2">
              <CrtControls presetId={crtId} params={crtParams} onPreset={(id) => { setCrtId(id); setCrtParams(getCrtPreset(id).params); }} onParams={setCrtParams} />
            </div>
          )}
          <div className="mt-2">
            <RuntimeSwitch kind={runtimeKind} onChange={(k) => void switchRuntime(k)} disabledWasmReason={profile && profile.platform !== "amiga" ? "The WASM core runtime is Amiga-only." : undefined} />
          </div>
          {runtimeError && <p role="alert" className="text-sm mt-2" style={{ color: "var(--rgme-status-restricted-fg)" }} data-testid="runtime-error">{runtimeError}</p>}
          <div className="flex flex-wrap gap-2 mt-3">
            <button className="rgme-btn" disabled={state !== "LOADED" && state !== "PAUSED"} onClick={() => adapter?.start()}>Start</button>
            <button className="rgme-btn" disabled={state !== "RUNNING"} onClick={() => adapter?.pause()}>Pause</button>
            <button className="rgme-btn" disabled={state === "UNLOADED" || state === "STOPPED"} onClick={() => adapter?.reset()}>Reset</button>
            <button className="rgme-btn" disabled={state === "UNLOADED" || state === "STOPPED"} onClick={() => { adapter?.saveState(0); setHasSave(true); }}>Save</button>
            <button className="rgme-btn" disabled={!profile} data-testid="saves-btn" onClick={() => setSavesOpen(true)}>Saves…</button>
            <button className="rgme-btn" aria-pressed={muted} data-testid="mute-btn" onClick={() => { adapter?.setMuted?.(!muted); floppySynth.setMuted(!muted); setMuted(!muted); }}>{muted ? "Unmute" : "Mute"}</button>
            <button className="rgme-btn" disabled={!hasSave || state === "UNLOADED" || state === "STOPPED"} onClick={() => adapter?.loadState(0)}>Load</button>
          </div>
          <ControllerHUD active={inputs} press={press} physical={gp.physical} gamepadName={gp.connected ? gp.name : undefined} />
          <button className="rgme-btn mt-2" data-testid="remap-btn" onClick={() => setRemapOpen(true)}>Gamepad mapping…</button>
        </div>
      </main>
      <section className="p-4" aria-label="Chain of title">
        <h2 className="text-lg mb-2">Chain of Title</h2>
        <ChainOfTitle title={profile?.title} rights={rightsRecord} />
      </section>
      <section className="p-4" aria-label="Game library">
        <h2 className="text-lg mb-2">Library</h2>
        <LibraryShelf store={library} refreshKey={libraryKey} onMount={(r) => void mountFromLibrary(r)} />
      </section>
      {profile && adapter && (
        <SaveDrawer manager={saves} adapter={adapter} getCanvas={() => canvasEl} title={profile.title} sha256={profile.media[0]!.sha256} open={savesOpen} onClose={() => setSavesOpen(false)} />
      )}
      <RemapModal open={remapOpen} mapping={gp.mapping} onChange={gp.setMapping} onClose={() => setRemapOpen(false)} />
    </div>
  );
}
