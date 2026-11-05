import { useEffect, useRef, useState } from "react";
import { computeIntegerScale } from "../lib/scale";
import { Commodore1084sBezel } from "./Commodore1084sBezel";
import { CrtShaderCanvas } from "./CrtShaderCanvas";
import { isWebGLAvailable } from "../lib/crt/shader";
import type { CrtParams } from "../lib/crt/presets";

export function Viewport({
  crt,
  crtParams,
  bezel = false,
  onToggleCrt,
  onCanvas,
  crtMenuContent
}: {
  crt: boolean;
  crtParams?: CrtParams;
  /** Frame the screen in the generic 1084-style monitor bezel. */
  bezel?: boolean;
  onToggleCrt: () => void;
  onCanvas: (canvas: HTMLCanvasElement) => void;
  crtMenuContent?: React.ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const crtMenuRef = useRef<HTMLDivElement>(null);
  const [el, setEl] = useState<HTMLCanvasElement | null>(null);
  const [fallback, setFallback] = useState(() => !isWebGLAvailable());
  const [size, setSize] = useState(() => computeIntegerScale(640, 480));
  const [crtMenuOpen, setCrtMenuOpen] = useState(false);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (crtMenuRef.current && !crtMenuRef.current.contains(e.target as Node)) {
        setCrtMenuOpen(false);
      }
    };
    if (crtMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [crtMenuOpen]);

  useEffect(() => {
    if (canvas.current) {
      setEl(canvas.current);
      onCanvas(canvas.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setSize(computeIntegerScale(entry.contentRect.width, entry.contentRect.height));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="rgme-viewport-container w-full flex flex-col items-center relative">
      {/* CRT Scanline Top-Right Corner Layover Trigger */}
      <div className="absolute top-2 right-2 z-30 flex items-center gap-1.5" ref={crtMenuRef}>
        <button
          onClick={onToggleCrt}
          data-testid="crt-corner-trigger"
          aria-pressed={crt}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-mono backdrop-blur-md shadow-lg transition-all cursor-pointer ${
            crt
              ? "bg-emerald-950/80 border-emerald-500 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.3)]"
              : "bg-black/70 border-slate-700/80 text-slate-300 hover:text-white hover:border-slate-500"
          }`}
          title="Toggle CRT scanline simulation"
        >
          <span className="text-sm">📺</span>
          <span className="text-[11px] font-bold">CRT scanlines</span>
        </button>
        <button
          onClick={() => setCrtMenuOpen((o) => !o)}
          data-testid="crt-menu-toggle-btn"
          className="px-2 py-1.5 rounded-lg border bg-black/70 border-slate-700/80 text-slate-300 hover:text-white hover:border-slate-500 text-xs font-mono backdrop-blur-md cursor-pointer"
          title="Open CRT shader settings layover"
        >
          ⚙️
        </button>

        {crtMenuOpen && crtMenuContent && (
          <div
            data-testid="crt-layover-panel"
            className="absolute top-10 right-0 z-40 bg-[#12141f]/95 border border-[#2b2f45] shadow-[0_12px_36px_rgba(0,0,0,0.85)] backdrop-blur-xl p-4 rounded-xl text-xs text-slate-200 w-80 animate-in fade-in duration-150"
          >
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800">
              <span className="font-bold text-white uppercase tracking-wider text-[11px]">📺 CRT Display Settings</span>
              <button
                onClick={() => setCrtMenuOpen(false)}
                data-testid="crt-layover-close-btn"
                className="text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                ✕ Close
              </button>
            </div>
            {crtMenuContent}
          </div>
        )}
      </div>

      {bezel ? <Commodore1084sBezel>      <div
        ref={box}
        data-testid="viewport"
        style={{ width: "100%", aspectRatio: "4 / 3", background: "#000", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 2, overflow: "hidden", border: "1px solid var(--rgme-border-subtle)" }}
      >
        <div style={{ position: "relative", width: size.width, height: size.height, maxWidth: "100%", maxHeight: "100%" }}>
          <canvas
            ref={canvas}
            data-testid="canvas"
            data-scale={size.scale}
            aria-label="Amiga display, PAL 4:3"
            style={{ width: "100%", height: "100%", imageRendering: "pixelated", display: "block" }}
          />
          {crt && crtParams && !fallback && <CrtShaderCanvas source={el} params={crtParams} enabled onFallback={() => setFallback(true)} />}
          {crt && (fallback || !crtParams) && <div className="rgme-crt" data-testid="crt-overlay" />}
        </div>
      </div>
</Commodore1084sBezel> : (
        <>
      <div
        ref={box}
        data-testid="viewport"
        style={{ width: "100%", aspectRatio: "4 / 3", background: "#000", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 2, overflow: "hidden", border: "1px solid var(--rgme-border-subtle)" }}
      >
        <div style={{ position: "relative", width: size.width, height: size.height, maxWidth: "100%", maxHeight: "100%" }}>
          <canvas
            ref={canvas}
            data-testid="canvas"
            data-scale={size.scale}
            aria-label="Amiga display, PAL 4:3"
            style={{ width: "100%", height: "100%", imageRendering: "pixelated", display: "block" }}
          />
          {crt && crtParams && !fallback && <CrtShaderCanvas source={el} params={crtParams} enabled onFallback={() => setFallback(true)} />}
          {crt && (fallback || !crtParams) && <div className="rgme-crt" data-testid="crt-overlay" />}
        </div>
      </div>
        </>
      )}
      <div className="flex items-center gap-2 mt-2 text-sm" style={{ color: "var(--rgme-fg-secondary)" }}>
        <span>Authentic PAL 4:3 · {size.scale}× integer scale</span>
      </div>
    </div>
  );
}
