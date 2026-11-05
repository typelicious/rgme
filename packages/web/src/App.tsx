import { useCallback, useMemo, useRef, useState } from "react";
import {
  MockRuntimeAdapter,
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
import { useKeyboardInput } from "./hooks/useKeyboardInput";
import { hashFile } from "./lib/hash";
import { buildProfileFromFile } from "./lib/profile";
import { DEMO_PROFILE, DEMO_RIGHTS } from "./samples/demo";

export type AdapterFactory = (canvas: CanvasLike | null) => RuntimeAdapter;
const defaultFactory: AdapterFactory = (canvas) => new MockRuntimeAdapter(canvas ?? undefined);
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

  const onCanvas = useCallback(
    (canvas: HTMLCanvasElement) => {
      if (adapterRef.current) return;
      const a = createAdapter(canvas as unknown as CanvasLike);
      adapterRef.current = a;
      unsub.current = a.onStatus(setStatus);
      setAdapter(a);
    },
    [createAdapter]
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

  const activate = useCallback(async (p: GameProfile, rights: RightsRecord | undefined) => {
    const record = rights ?? unknownRightsRecord(p.id);
    setProfile(p);
    setDecisions({
      private_execution: engine.evaluateAction(record, { action: "private_execution" }),
      binary_redistribution: engine.evaluateAction(record, { action: "binary_redistribution" })
    });
    setHasSave(false);
    await adapterRef.current?.loadGame(p);
  }, []);

  const loadDemo = useCallback(async () => {
    setInfo({ name: DEMO_PROFILE.media[0]!.filename, size: 0, sha256: DEMO_PROFILE.media[0]!.sha256, status: "Identified" });
    await activate(DEMO_PROFILE, DEMO_RIGHTS);
    adapterRef.current?.start();
  }, [activate]);

  const onFile = useCallback(
    async (file: File) => {
      setInfo({ name: file.name, size: file.size, status: "Analyzing" });
      const sha256 = await hashFile(file);
      // No bundled hash registry in the browser yet: unrecognized => Unknown (local play only).
      setInfo({ name: file.name, size: file.size, sha256, status: "Unknown" });
      await activate(buildProfileFromFile(file.name, sha256), undefined);
    },
    [activate]
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
          <GameProfileInspector profile={profile} decisions={decisions} />
          <section className="rgme-panel">
            <div className="flex gap-2">
              <button className="rgme-btn" disabled={!canExport} data-testid="export-btn" aria-describedby="export-reason">Export</button>
              <button className="rgme-btn" disabled={!canExport} data-testid="share-btn" aria-describedby="export-reason">Share</button>
            </div>
            {exportReason && <p id="export-reason" className="text-sm mt-2" style={{ color: "var(--rgme-fg-secondary)" }} data-testid="export-reason">{exportReason}</p>}
          </section>
        </div>
        <div>
          <Viewport crt={crt} onToggleCrt={() => setCrt((c) => !c)} onCanvas={onCanvas} />
          <div className="flex gap-2 mt-3">
            <button className="rgme-btn" disabled={state !== "LOADED" && state !== "PAUSED"} onClick={() => adapter?.start()}>Start</button>
            <button className="rgme-btn" disabled={state !== "RUNNING"} onClick={() => adapter?.pause()}>Pause</button>
            <button className="rgme-btn" disabled={state === "UNLOADED" || state === "STOPPED"} onClick={() => adapter?.reset()}>Reset</button>
            <button className="rgme-btn" disabled={state === "UNLOADED" || state === "STOPPED"} onClick={() => { adapter?.saveState(0); setHasSave(true); }}>Save</button>
            <button className="rgme-btn" disabled={!hasSave || state === "UNLOADED" || state === "STOPPED"} onClick={() => adapter?.loadState(0)}>Load</button>
          </div>
          <ControllerHUD active={inputs} press={press} />
        </div>
      </main>
    </div>
  );
}
