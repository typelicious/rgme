import { useEffect, useRef, useState } from "react";
import { createCrtRenderer, isWebGLAvailable } from "../lib/crt/shader";
import type { CrtParams } from "../lib/crt/presets";

/**
 * WebGL CRT post-processing overlay for the emulator canvas. Never throws: when WebGL is
 * unavailable or initialisation fails it renders nothing and calls `onFallback`, so the
 * parent keeps its 2D CSS CRT overlay.
 */
export function CrtShaderCanvas({
  source,
  params,
  enabled,
  onFallback,
  className
}: {
  source: HTMLCanvasElement | null;
  params: CrtParams;
  enabled: boolean;
  onFallback?: (reason: string) => void;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const fallbackRef = useRef(onFallback);
  fallbackRef.current = onFallback;

  useEffect(() => {
    if (!enabled || !source || !ref.current) return;
    const canvas = ref.current;
    if (!isWebGLAvailable()) {
      setFailed(true);
      fallbackRef.current?.("WebGL unavailable");
      return;
    }
    canvas.width = source.width * 2;
    canvas.height = source.height * 2;
    let renderer: ReturnType<typeof createCrtRenderer>;
    try {
      renderer = createCrtRenderer(canvas, source);
    } catch (e) {
      setFailed(true);
      fallbackRef.current?.(e instanceof Error ? e.message : String(e));
      return;
    }
    let raf = 0;
    const loop = () => {
      renderer.setParams(paramsRef.current);
      renderer.render();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); renderer.dispose(); };
  }, [enabled, source]);

  if (!enabled || failed || !source) return null;
  return (
    <canvas
      ref={ref}
      data-testid="crt-canvas"
      aria-hidden="true"
      className={className}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", imageRendering: "pixelated" }}
    />
  );
}
