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
  onCanvas
}: {
  crt: boolean;
  crtParams?: CrtParams;
  /** Frame the screen in the generic 1084-style monitor bezel. */
  bezel?: boolean;
  onToggleCrt: () => void;
  onCanvas: (canvas: HTMLCanvasElement) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [el, setEl] = useState<HTMLCanvasElement | null>(null);
  const [fallback, setFallback] = useState(() => !isWebGLAvailable());
  const [size, setSize] = useState(() => computeIntegerScale(640, 480));

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
    <div className="rgme-viewport-container w-full flex flex-col items-center">
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
        <button className="rgme-btn" aria-pressed={crt} onClick={onToggleCrt}>CRT scanlines</button>
        <span>Authentic PAL 4:3 · {size.scale}× integer scale</span>
      </div>
    </div>
  );
}
