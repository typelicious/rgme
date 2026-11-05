import type { Canvas2DLike, CanvasLike } from "../mock-runtime.js";
import type { AudioSink } from "../chiptune.js";
import { c64DirectoryListing, D64Parser, type D64Disk } from "./d64.js";
import { drawText } from "./font.js";
import { ReferenceAdapter } from "./reference-adapter.js";

/** The 16-colour Pepto palette of the VIC-II. */
export const C64_PALETTE = [
  "#000000", "#ffffff", "#68372b", "#70a4b2", "#6f3d86", "#588d43", "#352879", "#b8c76f",
  "#6f4f25", "#433900", "#9a6759", "#444444", "#6c6c6c", "#9ad284", "#6c5eb5", "#959595"
] as const;

export const C64_PAL_HZ = 50.125;
export const C64_VISIBLE = { width: 384, height: 272 } as const;
const BORDER = 14; // light blue
const BACKGROUND = 6; // blue
const SCREEN_X = 32;
const SCREEN_Y = 36;
const LOADING_FRAMES = 60;

/**
 * Commodore 64 REFERENCE runtime. It provides the PAL video mode (50.125 Hz, 384x272 visible, 320x200 text screen with
 * the real VIC-II palette), parses the mounted D64 and shows its directory as a `LOAD"$",8` listing, and can play a
 * SID-style tune. It does NOT emulate the 6510 CPU, VIC-II or SID registers, so it cannot run C64 programs.
 */
export class C64RuntimeAdapter extends ReferenceAdapter {
  disk?: D64Disk;
  mediaError?: string;

  constructor(canvas?: CanvasLike, now?: () => number, audio?: AudioSink) {
    super({ adapterId: "c64-reference", platform: "c64", name: "RGME C64 Reference Runtime", size: C64_VISIBLE, hz: C64_PAL_HZ, video: "PAL" }, canvas, now, audio);
  }

  protected onMediaChanged() {
    this.disk = undefined;
    this.mediaError = undefined;
    const bytes = this.bootMediaId ? this.mediaData.get(this.bootMediaId) : undefined;
    if (!bytes) return;
    try {
      this.disk = new D64Parser(bytes).parse();
    } catch (e) {
      this.mediaError = e instanceof Error ? e.message : String(e);
    }
  }

  /** Text lines of the 40x25 screen. Exported via the instance for tests and UI previews. */
  screenLines(): string[] {
    const lines = ["**** RGME C64 REFERENCE RUNTIME ****", "NO CPU EMULATION: MEDIA+VIDEO+SOUND", "", "READY."];
    if (this.disk) lines.push('LOAD"$",8', "", "SEARCHING FOR $", "LOADING", "READY.", "LIST", "", ...c64DirectoryListing(this.disk), "READY.");
    else if (this.mediaError) lines.push('LOAD"$",8', "", `?FILE DATA ERROR`, ` ${this.mediaError.slice(0, 38).toUpperCase()}`, "READY.");
    else lines.push('LOAD"$",8', "", "?DEVICE NOT PRESENT  ERROR", "READY.");
    return lines.slice(-25).map((l) => l.slice(0, 40));
  }

  protected drawStatic(ctx: Canvas2DLike) {
    const { width, height } = C64_VISIBLE;
    ctx.fillStyle = C64_PALETTE[BORDER]!;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = C64_PALETTE[BACKGROUND]!;
    ctx.fillRect(SCREEN_X, SCREEN_Y, 320, 200);
    const lines = this.screenLines();
    lines.forEach((line, row) => {
      const y = SCREEN_Y + row * 8;
      if (this.disk && line.startsWith("0 \"")) {
        ctx.fillStyle = C64_PALETTE[BORDER]!; // reverse video disk header
        ctx.fillRect(SCREEN_X, y, line.length * 6, 8);
        drawText(ctx, line, SCREEN_X, y, C64_PALETTE[BACKGROUND]!);
      } else drawText(ctx, line, SCREEN_X, y, C64_PALETTE[BORDER]!);
    });
  }

  protected drawFrame(ctx: Canvas2DLike, frame: number) {
    const { width, height } = C64_VISIBLE;
    // Loading stripes in the border for the first frames, like a real tape/disk load.
    if (frame > 0 && frame <= LOADING_FRAMES) {
      const bands = 12;
      for (let i = 0; i < bands; i++) {
        ctx.fillStyle = C64_PALETTE[(i + frame) % 16]!;
        ctx.fillRect(0, i * 3, width, 3);
        ctx.fillRect(0, height - (i + 1) * 3, width, 3);
      }
    } else if (frame === LOADING_FRAMES + 1 || frame === 0) {
      ctx.fillStyle = C64_PALETTE[BORDER]!;
      ctx.fillRect(0, 0, width, SCREEN_Y);
      ctx.fillRect(0, SCREEN_Y + 200, width, height - SCREEN_Y - 200);
    }
    // Blinking cursor on the line after the last text line.
    const row = Math.min(24, this.screenLines().length);
    const on = Math.floor(frame / 16) % 2 === 0;
    ctx.fillStyle = on ? C64_PALETTE[BORDER]! : C64_PALETTE[BACKGROUND]!;
    ctx.fillRect(SCREEN_X, SCREEN_Y + row * 8, 6, 8);
  }
}
