import { CRT_PRESETS, type CrtParams } from "../lib/crt/presets";

export function CrtControls({
  presetId,
  params,
  onPreset,
  onParams
}: {
  presetId: string;
  params: CrtParams;
  onPreset: (id: string) => void;
  onParams: (p: CrtParams) => void;
}) {
  const slider = (key: "scanlineIntensity" | "bloom", label: string) => (
    <label className="flex items-center gap-2 text-sm">
      {label}
      <input type="range" min={0} max={1} step={0.05} value={params[key]} data-testid={`crt-${key}`} onChange={(e) => onParams({ ...params, [key]: Number(e.target.value) })} />
    </label>
  );
  return (
    <div className="flex flex-wrap items-center gap-3" data-testid="crt-controls">
      <select aria-label="CRT preset" data-testid="crt-preset" value={presetId} onChange={(e) => onPreset(e.target.value)}>
        {CRT_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
      </select>
      {slider("scanlineIntensity", "Scanlines")}
      {slider("bloom", "Glow")}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" data-testid="crt-curvature" checked={params.curvature > 0} onChange={(e) => onParams({ ...params, curvature: e.target.checked ? Math.max(params.curvature, 0.4) : 0 })} />
        Curvature
      </label>
    </div>
  );
}
