import type { Canvas2DLike } from "./mock-runtime.js";

export const SCROLLER_TEXT =
  "     RGME PRESENTS  *  A TURRICAN TRIBUTE  *  PRESERVE THE ORIGINAL - MODERNIZE REPRODUCIBLY - PROVE WHAT WE KNOW - RESPECT WHAT WE MAY DISTRIBUTE  *  " +
  "THIS DISK IS PUBLIC DOMAIN (CC0) - GREETINGS TO ALL AMIGA SCENERS EVERYWHERE  *  KEEP THE COPPER BURNING!     ";

const W = 320;
const H = 256;
const BAR_COLORS: ReadonlyArray<readonly [number, number, number]> = [
  [255, 40, 60], [255, 150, 20], [255, 240, 60], [60, 255, 120], [40, 180, 255], [170, 80, 255]
];
const BAR_HALF = 14;

/** Per-scanline copper colour for a frame (additive sine-moving bars). Exported for tests. */
export function copperLine(y: number, frame: number): string {
  let r = 8, g = 6, b = 24;
  BAR_COLORS.forEach((c, i) => {
    const centre = H / 2 + Math.sin(frame * 0.045 + i * 0.9) * 92 + Math.sin(frame * 0.021 + i * 2.1) * 24;
    const d = Math.abs(y - centre);
    if (d < BAR_HALF) {
      const k = Math.cos((d / BAR_HALF) * (Math.PI / 2)) ** 1.5;
      r += c[0] * k; g += c[1] * k; b += c[2] * k;
    }
  });
  return `rgb(${Math.min(255, r | 0)},${Math.min(255, g | 0)},${Math.min(255, b | 0)})`;
}

/** Position of one scroller glyph. Exported for tests. */
export function scrollerGlyph(i: number, frame: number, textLen: number, charW = 14) {
  const total = (textLen + 24) * charW;
  const x = ((W + i * charW - frame * 2.2) % total + total) % total - 40;
  return { x, y: 222 + Math.sin(x / 34 + frame * 0.09) * 14 };
}

/** Deterministic Amiga-style demo scene: copper rasterbars, chrome RGME graffiti logo with shine, sine scroller. */
export function drawSceneIntro(ctx: Canvas2DLike, frame: number) {
  for (let y = 0; y < H; y++) {
    ctx.fillStyle = copperLine(y, frame);
    ctx.fillRect(0, y, W, 1);
  }
  if (!ctx.fillText || !ctx.createLinearGradient) return;

  // --- logo ---
  const bob = Math.sin(frame * 0.05) * 6;
  const lx = W / 2;
  const ly = 112 + bob;
  ctx.font = "italic 900 78px Impact, 'Arial Black', 'Helvetica Neue', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // drop shadow + graffiti outline
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillText("RGME", lx + 5, ly + 6);
  if (ctx.strokeText) {
    ctx.lineWidth = 6;
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0a0a14";
    ctx.strokeText("RGME", lx, ly);
  }
  // chrome body
  const chrome = ctx.createLinearGradient(0, ly - 40, 0, ly + 40);
  chrome.addColorStop(0, "#ffffff");
  chrome.addColorStop(0.45, "#9fb4d6");
  chrome.addColorStop(0.5, "#1b2540");
  chrome.addColorStop(0.62, "#6a7fa8");
  chrome.addColorStop(1, "#e8f0ff");
  ctx.fillStyle = chrome;
  ctx.fillText("RGME", lx, ly);
  // moving diagonal shine, restricted to the glyphs because it is the fill of the text
  const sx = -120 + ((frame * 3) % 560);
  const shine = ctx.createLinearGradient(sx, ly - 40, sx + 70, ly + 40);
  shine.addColorStop(0, "rgba(255,255,255,0)");
  shine.addColorStop(0.5, "rgba(255,255,255,0.95)");
  shine.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = shine;
  ctx.fillText("RGME", lx, ly);

  // --- sine scroller ---
  ctx.font = "bold 18px Topaz, 'Topaz a500', 'Courier New', monospace";
  ctx.textAlign = "left";
  for (let i = 0; i < SCROLLER_TEXT.length; i++) {
    const { x, y } = scrollerGlyph(i, frame, SCROLLER_TEXT.length);
    if (x < -16 || x > W) continue;
    ctx.fillStyle = "#000000";
    ctx.fillText(SCROLLER_TEXT[i]!, x + 1, y + 1);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(SCROLLER_TEXT[i]!, x, y);
  }
}
