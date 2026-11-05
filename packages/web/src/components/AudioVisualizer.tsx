import { useEffect, useRef } from "react";

export function AudioVisualizer({
  levels = [0, 0, 0, 0],
  getWaveformData
}: {
  levels?: [number, number, number, number];
  getWaveformData?: () => Float32Array;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const render = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.fillStyle = "#07090e";
      ctx.fillRect(0, 0, w, h);

      // Grid lines
      ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();

      // Oscilloscope wave
      const wave = getWaveformData?.() ?? new Float32Array(512);
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const step = w / wave.length;
      for (let i = 0; i < wave.length; i++) {
        const x = i * step;
        const val = wave[i] ?? 0;
        const y = (h / 2) + val * (h * 0.45);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [getWaveformData]);

  const chColors = ["#38bdf8", "#a855f7", "#f43f5e", "#10b981"];
  const chLabels = ["Ch0 (L)", "Ch1 (R)", "Ch2 (R)", "Ch3 (L)"];

  return (
    <div className="rgme-audio-visualizer grid gap-2" data-testid="audio-visualizer" style={{ background: "#0a0d14", border: "1px solid var(--rgme-border-subtle)", borderRadius: 6, padding: "8px" }}>
      <div className="flex justify-between items-center text-xs text-muted" style={{ color: "var(--rgme-fg-muted)" }}>
        <span className="rgme-mono font-bold tracking-wider">PAULA 4-CHANNEL VU</span>
        <span className="rgme-mono">OSCILLOSCOPE</span>
      </div>

      <div className="grid grid-cols-4 gap-2" data-testid="vu-meter">
        {levels.map((lvl, idx) => {
          const pct = Math.min(100, Math.max(0, Math.round(lvl * 100)));
          return (
            <div key={idx} className="flex flex-col gap-1" data-testid={`vu-ch-${idx}`}>
              <div className="flex justify-between text-xs" style={{ fontSize: "10px", color: "var(--rgme-fg-muted)" }}>
                <span>{chLabels[idx]}</span>
                <span className="rgme-mono">{pct}%</span>
              </div>
              <div style={{ background: "#131826", height: "8px", borderRadius: "2px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div
                  style={{
                    width: `${pct}%`,
                    height: "100%",
                    background: chColors[idx],
                    transition: "width 60ms ease-out"
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ height: "48px", overflow: "hidden", borderRadius: "4px", border: "1px solid rgba(255,255,255,0.08)" }}>
        <canvas
          ref={canvasRef}
          data-testid="oscilloscope"
          width={320}
          height={48}
          style={{ width: "100%", height: "100%", display: "block" }}
        />
      </div>
    </div>
  );
}
