export interface CrtParams {
  scanlineIntensity: number; // 0..1
  bloom: number; // 0..1
  curvature: number; // 0..1 (0 = flat)
  maskStrength: number; // 0..1 aperture grille / shadow mask
  vignette: number; // 0..1
}

export interface CrtPreset { id: string; label: string; params: CrtParams }

export const CRT_PRESETS: readonly CrtPreset[] = [
  { id: "clean", label: "Authentic PAL (Clean)", params: { scanlineIntensity: 0, bloom: 0, curvature: 0, maskStrength: 0, vignette: 0 } },
  { id: "trinitron", label: "Trinitron CRT", params: { scanlineIntensity: 0.35, bloom: 0.25, curvature: 0.1, maskStrength: 0.45, vignette: 0.25 } },
  { id: "c1084s", label: "Commodore 1084S (Curved)", params: { scanlineIntensity: 0.55, bloom: 0.35, curvature: 0.55, maskStrength: 0.3, vignette: 0.5 } },
  { id: "arcade", label: "Retro Arcade Grille", params: { scanlineIntensity: 0.7, bloom: 0.5, curvature: 0.3, maskStrength: 0.75, vignette: 0.35 } }
];

export const DEFAULT_CRT_PRESET_ID = "c1084s";
export const getCrtPreset = (id: string): CrtPreset => CRT_PRESETS.find((p) => p.id === id) ?? CRT_PRESETS[0]!;
