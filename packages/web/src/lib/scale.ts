export const NATIVE_WIDTH = 320;
/** Lowres PAL 320x256 shown on a 4:3 display: height of the 4:3 box for 320 px width is 240. */
export const DISPLAY_HEIGHT_AT_1X = 240;

export interface ScaleResult {
  scale: number;
  width: number;
  height: number;
}

/** Largest integer multiplier (min 1) that fits the container while keeping 4:3. */
export function computeIntegerScale(containerWidth: number, containerHeight: number): ScaleResult {
  const w = Number.isFinite(containerWidth) ? containerWidth : 0;
  const h = Number.isFinite(containerHeight) ? containerHeight : 0;
  const scale = Math.max(1, Math.floor(Math.min(w / NATIVE_WIDTH, h / DISPLAY_HEIGHT_AT_1X)));
  return { scale, width: NATIVE_WIDTH * scale, height: DISPLAY_HEIGHT_AT_1X * scale };
}
