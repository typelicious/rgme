import { useCallback, useEffect, useRef, useState } from "react";
import { ModPlayer, createBrowserAudioContext } from "@rgme/core";
import { AudioVisualizer } from "./AudioVisualizer";

/** The subset of ModPlayer the panel needs (lets tests inject a fake). */
export interface ModPlayerLike {
  load(bytes: Uint8Array): void;
  start(): void;
  pause(): void;
  stop(): void;
  setVolume(v: number): void;
  readonly title: string;
  positionInfo(): { order: number; pattern: number; row: number; tick: number } | null;
  getChannelLevels?(): [number, number, number, number];
  getWaveformData?(): Float32Array;
}

export interface ModPlayerPanelProps {
  /** Module bytes to load (e.g. from the library or the demo fixture). */
  bytes?: Uint8Array;
  /** Fallback title shown when the module has none. */
  title?: string;
  createPlayer?: () => ModPlayerLike;
}

const defaultCreate = (): ModPlayerLike => new ModPlayer(createBrowserAudioContext);
const pad = (n: number) => String(n).padStart(2, "0");

export function ModPlayerPanel({ bytes, title, createPlayer = defaultCreate }: ModPlayerPanelProps) {
  const player = useRef<ModPlayerLike | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState(title ?? "");
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [pos, setPos] = useState<{ order: number; pattern: number; row: number } | null>(null);
  const [levels, setLevels] = useState<[number, number, number, number]>([0, 0, 0, 0]);
  const [error, setError] = useState("");

  const get = useCallback(() => (player.current ??= createPlayer()), [createPlayer]);

  const load = useCallback(
    (data: Uint8Array, fallback?: string) => {
      try {
        const p = get();
        p.stop();
        p.load(data);
        p.setVolume(volume);
        setName(p.title || fallback || "Untitled module");
        setLoaded(true);
        setPlaying(false);
        setPos(null);
        setLevels([0, 0, 0, 0]);
        setError("");
      } catch (e) {
        setLoaded(false);
        setPlaying(false);
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [get, volume]
  );

  useEffect(() => {
    if (bytes) load(bytes, title);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bytes]);

  useEffect(() => {
    if (!playing) {
      setLevels([0, 0, 0, 0]);
      return;
    }
    const id = setInterval(() => {
      const p = player.current;
      if (!p) return;
      const i = p.positionInfo();
      if (i) setPos({ order: i.order, pattern: i.pattern, row: i.row });
      if (p.getChannelLevels) setLevels(p.getChannelLevels());
    }, 50);
    return () => clearInterval(id);
  }, [playing]);

  useEffect(() => () => player.current?.stop(), []);

  const play = () => {
    try {
      get().start();
      setPlaying(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  const pause = () => {
    player.current?.pause();
    setPlaying(false);
  };
  const stop = () => {
    player.current?.stop();
    setPlaying(false);
    setPos(null);
  };
  const onFile = async (file: File | undefined) => {
    if (!file) return;
    load(new Uint8Array(await file.arrayBuffer()), file.name.replace(/\.mod$/i, ""));
  };

  return (
    <section className="rgme-panel" aria-label="Module player" data-testid="mod-panel">
      <h2 className="text-lg mb-2" style={{ fontSize: "1.125rem" }}>ProTracker Player</h2>
      <p className="text-sm" data-testid="mod-title" style={{ fontFamily: "var(--rgme-font-mono, monospace)", color: "var(--rgme-accent-phosphor-green)" }}>
        {loaded ? name || "Untitled module" : "No module loaded"}
      </p>
      <p className="text-xs mt-1" data-testid="mod-position" style={{ color: "var(--rgme-fg-secondary)" }}>
        {pos ? `Order ${pad(pos.order)} · Pattern ${pad(pos.pattern)} · Row ${pad(pos.row)}` : "Order -- · Pattern -- · Row --"}
      </p>
      <div className="flex flex-wrap items-center gap-2 mt-2">
        <button className="rgme-btn" data-testid="mod-play" disabled={!loaded || playing} onClick={play}>Play</button>
        <button className="rgme-btn" data-testid="mod-pause" disabled={!playing} onClick={pause}>Pause</button>
        <button className="rgme-btn" data-testid="mod-stop" disabled={!loaded} onClick={stop}>Stop</button>
        <label className="flex items-center gap-2 text-sm">
          Volume
          <input
            type="range" min={0} max={1} step={0.05} value={volume} data-testid="mod-volume" aria-label="Module volume"
            onChange={(e) => { const v = Number(e.target.value); setVolume(v); player.current?.setVolume(v); }}
          />
        </label>
        <label className="rgme-btn" style={{ cursor: "pointer" }}>
          Open .mod…
          <input type="file" accept=".mod,audio/x-mod" data-testid="mod-file" hidden onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
      </div>
      <div className="mt-3">
        <AudioVisualizer
          levels={levels}
          getWaveformData={() => player.current?.getWaveformData?.() ?? new Float32Array(512)}
        />
      </div>
      {error && <p role="alert" className="text-sm mt-2" data-testid="mod-error" style={{ color: "var(--rgme-status-restricted-fg)" }}>{error}</p>}
    </section>
  );
}
