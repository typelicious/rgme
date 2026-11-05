import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  IpfParser,
  ZipParser,
  type StreamedRetroMedia,
  FREEWARE_CLASSICS,
  createClassicMultiDiskProfile,
  type FreewareClassic,
  DEFAULT_INPUT_MAPPING,
  DEFAULT_DISPLAY_PROFILE,
  GURU_PROFILE,
  identifyImage,
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
import { CommandPalette, type PaletteAction } from "./components/CommandPalette";
import { KeyboardShortcutsModal } from "./components/KeyboardShortcutsModal";
import { CloudStreamModal } from "./components/CloudStreamModal";
import { parseM3u } from "./lib/m3u";
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
import { DiskSwapper } from "./components/DiskSwapper";
import { ModPlayerPanel } from "./components/ModPlayerPanel";
import { useDiskHotkeys } from "./hooks/useDiskHotkeys";
import { createDiskSwapper } from "./lib/m3u";
import demoModUrl from "../../../concept/fixtures/rgme-demo.mod?url";
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
  const profileRef = useRef<GameProfile | undefined>(undefined);
  profileRef.current = profile;
  const [activeDemo, setActiveDemo] = useState<"demo" | "scene" | "c64" | "md" | "guru" | "classic" | null>(null);
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
  const [diskIdx, setDiskIdx] = useState(0);
  const [modBytes, setModBytes] = useState<Uint8Array>();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [cloudOpen, setCloudOpen] = useState(false);
  const [driveSoundEnabled, setDriveSoundEnabled] = useState(true);
  const library = useMemo(() => new GameLibraryStore(), []);
  const saves = useMemo(() => new SaveStateManager(IndexedDbSaveStore.available() ? new IndexedDbSaveStore() : new MemorySaveStore()), []);

  const unloadGame = useCallback(() => {
    if (adapterRef.current) {
      try {
        adapterRef.current.pause();
        adapterRef.current.reset();
      } catch {
        /* ignore */
      }
      disposeRuntime(adapterRef.current);
      const canvas = canvasRef.current;
      const a = createAdapter(canvas as unknown as CanvasLike);
      adapterRef.current = a;
      adapterKey.current = "amiga:mock";
      unsub.current?.();
      unsub.current = a.onStatus(setStatus);
      setAdapter(a);
    }
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
    floppy.eject(0);
    floppy.eject(1);
    floppy.eject(2);
    floppy.eject(3);
    floppy.setMotor(0, false);
    floppy.setMotor(1, false);
    floppy.setMotor(2, false);
    floppy.setMotor(3, false);
    setModBytes(undefined);
    setStatus(INITIAL);
    setProfile(undefined);
    setRightsRecord(undefined);
    setInfo(undefined);
    setDecisions(undefined);
    setRuntimeError(undefined);
    setHasSave(false);
    setActiveDemo(null);
  }, [createAdapter, floppy]);

  const onCanvas = useCallback(
    (canvas: HTMLCanvasElement) => {
      if (adapterRef.current) return;
      const a = createAdapter(canvas as unknown as CanvasLike);
      adapterRef.current = a;
      canvasRef.current = canvas;
      setCanvasEl(canvas);
      unsub.current = a.onStatus(setStatus);
      setAdapter(a);

      canvas.addEventListener("click", () => {
        if (profileRef.current?.id === "amiga-guru-meditation") {
          floppy.recalibrate(0);
          floppy.pulseActivity(0, "read", 300);
          unloadGame();
        }
      });
    },
    [createAdapter, floppy, unloadGame]
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
        a = kind === "mock" ? createAdapter(canvas as unknown as CanvasLike) : createRuntime(kind, canvas, { media: mediaRegistry });
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
    setActiveDemo("demo");
    setInfo({ name: DEMO_PROFILE.media[0]!.filename, size: 0, sha256: DEMO_PROFILE.media[0]!.sha256, status: "Identified" });
    await activate(DEMO_PROFILE, DEMO_RIGHTS);
    adapterRef.current?.start();
  }, [activate]);

  const loadGuru = useCallback(async () => {
    setActiveDemo("guru");
    setInfo({ name: GURU_PROFILE.media[0]!.filename, size: 512, sha256: GURU_PROFILE.media[0]!.sha256, status: "Identified" });
    await activate(GURU_PROFILE, undefined);
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
      let bytes: Uint8Array = new Uint8Array(await file.arrayBuffer());

      if (file.name.toLowerCase().endsWith(".m3u")) {
        const text = await file.text();
        const entries = parseM3u(text, { baseName: file.name });
        const multiDiscs = entries.map((e, idx) => ({
          id: `disk-${idx + 1}`,
          label: e.title || `Disk ${idx + 1}`,
          filename: e.path || `Disk ${idx + 1}.adf`,
          sha256: `m3u${idx + 1}`.padStart(64, "0")
        }));
        const m3uProfile: GameProfile = {
          schema: "rgme.game/v0.2",
          id: `m3u-${file.name.replace(/\.[^/.]+$/, "")}`,
          title: file.name.replace(/\.[^/.]+$/, ""),
          platform: "amiga",
          machine: { model: "A500", chipset: "OCS", video: "PAL", ram: { chipKb: 512, fastKb: 0 } },
          media: multiDiscs.map((d) => ({
            id: d.id,
            kind: "adf",
            filename: d.filename,
            label: d.label,
            sha256: d.sha256
          })),
          runtime: { preferredAdapter: "mock" },
          launch: { bootMediaId: "disk-1", autoStart: false },
          input: DEFAULT_INPUT_MAPPING,
          display: DEFAULT_DISPLAY_PROFILE,
          rights: { recordId: `rights:m3u-${file.name.replace(/\.[^/.]+$/, "")}` }
        };
        setInfo({ name: file.name, size: file.size, sha256, status: "Identified" });
        await activate(m3uProfile, undefined);
        return m3uProfile.id;
      }

      if (ZipParser.isZip(bytes)) {
        const zip = new ZipParser(bytes);
        const mediaEntries = zip.getMediaEntries();
        if (mediaEntries.length > 0) {
          const first = mediaEntries[0]!;
          const extracted = await zip.extractEntry(first);
          bytes = extracted;
        }
      }

      if (identifyImage(bytes) === "ipf") {
        // IPF: decode standard Amiga MFM tracks to an ADF. Copy-protected tracks are NOT emulated and never faked.
        const { adf, reasons } = IpfParser.parse(bytes).toAdfResult();
        if (!adf) {
          setInfo({ name: file.name, size: file.size, sha256, status: "Unknown" });
          setRuntimeError(`IPF cannot be mounted: ${reasons.slice(0, 2).join("; ") || "undecodable or copy-protected tracks"}.`);
          return undefined;
        }
        bytes = adf;
      }
      remember(sha256, bytes);
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

  const discs = useMemo(
    () => (profile ? profile.media.map((m) => ({ id: m.id, label: m.label ?? m.filename, sha256: m.sha256 })) : []),
    [profile]
  );
  const swapper = useMemo(
    () =>
      createDiskSwapper({
        controller: floppy,
        discs,
        onSwap: (i, disc) => {
          setDiskIdx(i);
          const m = profile?.media[i];
          if (m) {
            floppy.swapDisk(0, { id: disc.id, label: disc.label, sha256: disc.sha256 });
            if (adapterRef.current && adapterRef.current.state !== "UNLOADED") {
              adapterRef.current.insertMedia(m);
            }
          }
        }
      }),
    [floppy, discs, profile]
  );
  useDiskHotkeys(swapper, discs.length > 1);

  const onLaunchClassic = useCallback(
    async (classic: FreewareClassic) => {
      setActiveDemo("classic");
      const p = createClassicMultiDiskProfile(classic);
      setInfo({
        name: classic.disks[0]!.filename,
        size: 901120,
        sha256: classic.disks[0]!.sha256,
        status: "Identified"
      });
      await activate(p, undefined);
      adapterRef.current?.start();
    },
    [activate]
  );

  const onStreamMedia = useCallback(
    async (media: StreamedRetroMedia) => {
      remember(media.sha256, media.bytes);
      const known = findFreewareByHash(FREEWARE, media.sha256);
      const p = known ? freewareEntryToProfile(known) : buildProfileFromFile(media.diskFilename, media.sha256);
      const rights = known ? freewareEntryToRights(known).record : unknownRightsRecord(p.id);
      setInfo({
        name: media.diskFilename,
        size: media.size,
        sha256: media.sha256,
        status: known ? "Identified" : "Unknown"
      });
      await activate(p, rights);
      if (media.format === "adf" || media.diskFilename.endsWith(".adf")) {
        floppy.insertDisk(0, {
          id: media.diskFilename,
          label: media.diskFilename,
          sha256: media.sha256,
          image: media.bytes
        });
        floppy.setMotor(0, true);
        floppy.recalibrate(0);
        floppy.pulseActivity(0, "read", 400);
      }
      adapterRef.current?.start();
    },
    [activate, floppy, remember]
  );

  const loadDemoMod = useCallback(async () => {
    const res = await fetch(demoModUrl);
    setModBytes(new Uint8Array(await res.arrayBuffer()));
  }, []);

  const loadScene = useCallback(async () => {
    setActiveDemo("scene");
    const res = await fetch(sceneIntroUrl);
    const file = new File([await res.arrayBuffer()], "rgme-scene-intro.adf");
    const id = await onFile(file);
    if (id) adapterRef.current?.start();
  }, [onFile]);

  const loadFixture = useCallback(
    async (url: string, filename: string, demoKind?: "c64" | "md") => {
      if (demoKind) setActiveDemo(demoKind);
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

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      } else if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setPaletteOpen(true);
      } else if (e.key === "?" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setShortcutsOpen((o) => !o);
      } else if (e.key === " " && profileRef.current?.id === "amiga-guru-meditation") {
        e.preventDefault();
        floppy.recalibrate(0);
        floppy.pulseActivity(0, "read", 300);
        unloadGame();
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [floppy, unloadGame]);

  const paletteActions = useMemo<PaletteAction[]>(() => {
    const actions: PaletteAction[] = [
      {
        id: "start-game",
        category: "Game",
        title: "Start Emulation",
        detail: "Run the currently loaded game or demo",
        shortcut: "↵",
        run: () => adapter?.start()
      },
      {
        id: "pause-game",
        category: "Game",
        title: "Pause Emulation",
        detail: "Halt emulation loop",
        shortcut: "P",
        run: () => adapter?.pause()
      },
      {
        id: "reset-game",
        category: "Game",
        title: "Reset Machine",
        detail: "Perform warm reset",
        shortcut: "R",
        run: () => adapter?.reset()
      },
      {
        id: "load-demo",
        category: "Game",
        title: "Load Demo Profile",
        detail: "Built-in Amiga demo game",
        run: () => void loadDemo()
      },
      {
        id: "load-scene",
        category: "Game",
        title: "Load Scene Demo ADF",
        detail: "rgme-scene-intro.adf bootable image",
        run: () => void loadScene()
      },
      {
        id: "load-c64",
        category: "Game",
        title: "Load C64 Demo",
        detail: "Commodore 64 reference runtime",
        run: () => void loadFixture(c64DemoUrl, "rgme-c64-demo.d64")
      },
      {
        id: "load-md",
        category: "Game",
        title: "Load Mega Drive Demo",
        detail: "Sega Genesis/Mega Drive reference runtime",
        run: () => void loadFixture(mdDemoUrl, "rgme-md-demo.md")
      },
      ...FREEWARE_CLASSICS.map((classic) => ({
        id: `classic-${classic.id}`,
        category: "Game" as const,
        title: `Launch ${classic.title}`,
        detail: `${classic.disks.length} disks • ${classic.developer} (${classic.year})`,
        run: () => void onLaunchClassic(classic)
      })),
      {
        id: "archive-stream",
        category: "Cloud",
        title: "Stream from Archive.org",
        detail: "Ephemeral in-memory retro games preservation streaming",
        run: () => setCloudOpen(true)
      },
      {
        id: "load-guru",
        category: "Game",
        title: "Load Guru Meditation",
        detail: "Authentic Amiga Software Failure #00000004.00004845#",
        run: () => void loadGuru()
      },
      {
        id: "unload-game",
        category: "Game",
        title: "Unload Game / Eject Media",
        detail: "Halt emulation loop, eject disks, and silence audio",
        shortcut: "⏏",
        run: () => unloadGame()
      },
      {
        id: "switch-runtime-mock",
        category: "Runtime",
        title: "Switch to Mock Runtime",
        detail: "Fast canvas mock adapter",
        run: () => void switchRuntime("mock")
      },
      {
        id: "switch-runtime-m68k",
        category: "Runtime",
        title: "Switch to 68000 Interpreter (Partial)",
        detail: "Decodes 68000 opcodes with ExecBase stubs",
        run: () => void switchRuntime("m68k")
      },
      {
        id: "switch-runtime-wasm",
        category: "Runtime",
        title: "Switch to WASM Core Runtime",
        detail: "WebAssembly host harness",
        run: () => void switchRuntime("wasm")
      },
      {
        id: "toggle-crt",
        category: "Display",
        title: crt ? "Disable CRT Shader" : "Enable CRT Shader",
        detail: "WebGL Commodore 1084S / Trinitron simulation",
        shortcut: "C",
        run: () => setCrt((c) => !c)
      },
      {
        id: "toggle-mute",
        category: "Audio",
        title: muted ? "Unmute Audio" : "Mute Audio",
        detail: "Toggle chiptune synthesizer and floppy sound effects",
        shortcut: "M",
        run: () => {
          const next = !muted;
          adapter?.setMuted?.(next);
          floppySynth.setMuted(next);
          setMuted(next);
        }
      },
      {
        id: "toggle-drive-sound",
        category: "Audio",
        title: driveSoundEnabled ? "Disable Floppy Drive Sounds" : "Enable Floppy Drive Sounds",
        detail: "Mechanical head seek, stepper motor, and track click FX",
        run: () => {
          setDriveSoundEnabled((prev) => {
            const next = !prev;
            floppySynth.setMuted(!next);
            return next;
          });
        }
      },
      {
        id: "open-saves",
        category: "Game",
        title: "Save States Manager",
        detail: "Inspect or restore IndexedDB / Memory save states",
        run: () => setSavesOpen(true)
      },
      {
        id: "open-remap",
        category: "Help",
        title: "Gamepad Button Mapping",
        detail: "Configure USB / Bluetooth controller inputs",
        run: () => setRemapOpen(true)
      },
      {
        id: "open-shortcuts",
        category: "Help",
        title: "Keyboard Shortcuts Guide",
        detail: "View all hotkeys and controller inputs",
        shortcut: "?",
        run: () => setShortcutsOpen(true)
      }
    ];
    return actions;
  }, [
    adapter,
    loadDemo,
    loadGuru,
    loadScene,
    loadFixture,
    onLaunchClassic,
    unloadGame,
    switchRuntime,
    crt,
    muted,
    floppySynth,
    driveSoundEnabled
  ]);

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
      <Header
        status={status}
        runtimeName={adapter?.identifyCapabilities().name ?? "No runtime"}
        onOpenPalette={() => setPaletteOpen(true)}
        onOpenShortcuts={() => setShortcutsOpen(true)}
        onOpenCloudStream={() => setCloudOpen(true)}
        driveSoundEnabled={driveSoundEnabled}
        onToggleDriveSound={() => {
          setDriveSoundEnabled((prev) => {
            const next = !prev;
            floppySynth.setMuted(!next);
            return next;
          });
        }}
      />
      <main className="grid gap-4 p-4 flex-1 md:grid-cols-[320px_1fr]">
        <div className="flex flex-col gap-4">
          <Dropzone info={info} onFile={onFile} />
          <div className="flex gap-2">
            <button className="rgme-btn flex-1" onClick={() => void loadDemo()} data-testid="load-demo">
              {activeDemo === "demo" ? "● Demo Profile" : "Load demo profile"}
            </button>
            <button className="rgme-btn" onClick={unloadGame} data-testid="unload-demo" disabled={activeDemo !== "demo"}>
              Unload
            </button>
          </div>
          <div className="flex gap-2">
            <button className="rgme-btn flex-1" onClick={() => void loadScene()} data-testid="load-scene">
              {activeDemo === "scene" ? "● Scene Demo" : "Load Scene Demo"}
            </button>
            <button className="rgme-btn" onClick={unloadGame} data-testid="unload-scene" disabled={activeDemo !== "scene"}>
              Unload
            </button>
          </div>
          <div className="flex gap-2">
            <button className="rgme-btn flex-1" onClick={() => void loadGuru()} data-testid="load-guru">
              {activeDemo === "guru" ? "● Guru Meditation" : "Load Guru Meditation"}
            </button>
            <button className="rgme-btn" onClick={unloadGame} data-testid="unload-guru" disabled={activeDemo !== "guru"}>
              Unload
            </button>
          </div>
          <FloppyDrives controller={floppy} discs={profile ? profile.media.map((m) => ({ id: m.id, label: m.label ?? m.filename, sha256: m.sha256 })) : []} onSwap={(drive, discId) => { const m = profile?.media.find((x) => x.id === discId); if (m) adapter?.insertMedia(m); void drive; }} />
          <div className="flex gap-2">
            <button className="rgme-btn flex-1" onClick={() => void loadFixture(c64DemoUrl, "rgme-c64-demo.d64", "c64")} data-testid="load-c64">
              {activeDemo === "c64" ? "● C64 Demo" : "Load C64 Demo"}
            </button>
            <button className="rgme-btn" onClick={unloadGame} data-testid="unload-c64" disabled={activeDemo !== "c64"}>
              Unload
            </button>
          </div>
          <div className="flex gap-2">
            <button className="rgme-btn flex-1" onClick={() => void loadFixture(mdDemoUrl, "rgme-md-demo.md", "md")} data-testid="load-md">
              {activeDemo === "md" ? "● Mega Drive Demo" : "Load Mega Drive Demo"}
            </button>
            <button className="rgme-btn" onClick={unloadGame} data-testid="unload-md" disabled={activeDemo !== "md"}>
              Unload
            </button>
          </div>
          {discs.length > 1 && <DiskSwapper swapper={swapper} discs={discs} currentIndex={diskIdx} label={profile?.title} onChange={setDiskIdx} />}
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
        <div className="flex flex-col items-center w-full">
          <Viewport bezel crt={crt} crtParams={crtParams} onToggleCrt={() => setCrt((c) => !c)} onCanvas={onCanvas} />
          {crt && (
            <div className="mt-2 w-full rgme-controls-container">
              <CrtControls presetId={crtId} params={crtParams} onPreset={(id) => { setCrtId(id); setCrtParams(getCrtPreset(id).params); }} onParams={setCrtParams} />
            </div>
          )}
          <div className="mt-2 w-full rgme-controls-container">
            <RuntimeSwitch kind={runtimeKind} onChange={(k) => void switchRuntime(k)} disabledWasmReason={profile && profile.platform !== "amiga" ? "The WASM core runtime is Amiga-only." : undefined} />
          </div>
          {runtimeError && <p role="alert" className="text-sm mt-2 w-full rgme-controls-container" style={{ color: "var(--rgme-status-restricted-fg)" }} data-testid="runtime-error">{runtimeError}</p>}
          <div className="flex flex-wrap gap-2 mt-3 w-full rgme-controls-container">
            <button className="rgme-btn" disabled={state !== "LOADED" && state !== "PAUSED"} data-testid="btn-start" onClick={() => adapter?.start()}>Start</button>
            <button className="rgme-btn" disabled={state !== "RUNNING"} data-testid="btn-pause" onClick={() => adapter?.pause()}>Pause</button>
            <button className="rgme-btn" disabled={state === "UNLOADED" || state === "STOPPED"} onClick={() => adapter?.reset()}>Reset</button>
            <button className="rgme-btn" disabled={state === "UNLOADED"} data-testid="btn-unload" onClick={unloadGame} title="Eject media and stop emulation">⏏ Unload</button>
            <button className="rgme-btn" disabled={state === "UNLOADED" || state === "STOPPED"} onClick={() => { adapter?.saveState(0); setHasSave(true); }}>Save</button>
            <button className="rgme-btn" disabled={!profile} data-testid="saves-btn" onClick={() => setSavesOpen(true)}>Saves…</button>
            <button className="rgme-btn" aria-pressed={muted} data-testid="mute-btn" onClick={() => { adapter?.setMuted?.(!muted); floppySynth.setMuted(!muted); setMuted(!muted); }}>{muted ? "Unmute" : "Mute"}</button>
            <button className="rgme-btn" disabled={!hasSave || state === "UNLOADED" || state === "STOPPED"} onClick={() => adapter?.loadState(0)}>Load</button>
          </div>
          <div className="w-full rgme-controls-container">
            <ControllerHUD active={inputs} press={press} physical={gp.physical} gamepadName={gp.connected ? gp.name : undefined} />
            <button className="rgme-btn mt-2" data-testid="remap-btn" onClick={() => setRemapOpen(true)}>Gamepad mapping…</button>
          </div>
        </div>
      </main>
      <section className="p-4" aria-label="Tracker player">
        <h2 className="text-lg mb-2">ProTracker Player</h2>
        <div className="flex gap-2 mb-2">
          <button className="rgme-btn" onClick={() => void loadDemoMod()} data-testid="load-mod">Load demo tune</button>
          <button className="rgme-btn" onClick={() => setModBytes(undefined)} data-testid="unload-mod" disabled={!modBytes}>Unload tune</button>
        </div>
        <ModPlayerPanel bytes={modBytes} title={modBytes ? "RGME demo tune" : undefined} />
      </section>
      <section className="p-4" aria-label="Chain of title">
        <h2 className="text-lg mb-2">Chain of Title</h2>
        <ChainOfTitle title={profile?.title} rights={rightsRecord} />
      </section>
      <section className="p-4" aria-label="Game library">
        <LibraryShelf store={library} refreshKey={libraryKey} onMount={(r) => void mountFromLibrary(r)} onLaunchClassic={onLaunchClassic} />
      </section>
      {profile && adapter && (
        <SaveDrawer manager={saves} adapter={adapter} getCanvas={() => canvasEl} title={profile.title} sha256={profile.media[0]!.sha256} open={savesOpen} onClose={() => setSavesOpen(false)} />
      )}
      <RemapModal open={remapOpen} mapping={gp.mapping} onChange={gp.setMapping} onClose={() => setRemapOpen(false)} />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} actions={paletteActions} />
      <KeyboardShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <CloudStreamModal open={cloudOpen} onClose={() => setCloudOpen(false)} onMountMedia={onStreamMedia} />
    </div>
  );
}
