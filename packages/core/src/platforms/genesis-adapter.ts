import type { Canvas2DLike, CanvasLike } from "../mock-runtime.js";
import type { AudioSink } from "../chiptune.js";
import { drawText } from "./font.js";
import { parseGenesisRom, type GenesisRomInfo } from "./genesis-rom.js";
import { ReferenceAdapter } from "./reference-adapter.js";

export const GENESIS_NTSC_HZ = 59.92;
export const GENESIS_VISIBLE = { width: 320, height: 224 } as const;
const BAND_TOP = 64;
const BAND_BOTTOM_Y = 184;

/**
 * Sega Mega Drive / Genesis REFERENCE runtime: NTSC 320x224 @ 59.92 Hz scene with the ROM header facts
 * (title, region, checksum validity), animated raster bands and FM/PSG-style synthesised sound.
 * It does NOT emulate the 68000, Z80, VDP or YM2612, so it cannot run Mega Drive software.
 */
export class GenesisRuntimeAdapter extends ReferenceAdapter {
  rom?: GenesisRomInfo;
  mediaError?: string;

  constructor(canvas?: CanvasLike, now?: () => number, audio?: AudioSink) {
    super({ adapterId: "megadrive-reference", platform: "megadrive", name: "RGME Mega Drive Reference Runtime", size: GENESIS_VISIBLE, hz: GENESIS_NTSC_HZ, video: "NTSC" }, canvas, now, audio);
  }

  protected onMediaChanged() {
    this.rom = undefined;
    this.mediaError = undefined;
    const bytes = this.bootMediaId ? this.mediaData.get(this.bootMediaId) : undefined;
    if (!bytes) return;
    try {
      this.rom = parseGenesisRom(bytes);
      if (!this.rom.supported) this.mediaError = "SMD-interleaved ROM not supported";
    } catch (e) {
      this.mediaError = e instanceof Error ? e.message : String(e);
    }
  }

  /** Text lines of the info panel (also used by tests). */
  infoLines(): string[] {
    const title = this.rom?.supported ? this.rom.overseasTitle || this.rom.domesticTitle : this.profile?.title ?? "NO GAME";
    const lines = [title.slice(0, 40)];
    if (this.rom?.supported) {
      const r = this.rom;
      lines.push(
        `${r.consoleName}  ${r.copyright}`.slice(0, 40),
        `SERIAL ${r.serial}  REGION ${r.regions.join("/") || "?"}`.slice(0, 40),
        `ROM ${Math.round(r.actualSize / 1024)} KB  PC ${r.initialPc.toString(16).toUpperCase().padStart(8, "0")}`,
        `CHECKSUM ${r.checksumField.toString(16).toUpperCase().padStart(4, "0")} ${r.checksumValid ? "OK" : "BAD"}`
      );
    } else lines.push(this.mediaError ? `ROM ERROR: ${this.mediaError}`.slice(0, 40) : "NO ROM DATA MOUNTED");
    lines.push("", "REFERENCE RUNTIME - NO 68000/Z80", "EMULATION: HEADER, VIDEO, SOUND ONLY");
    return lines;
  }

  protected drawStatic(ctx: Canvas2DLike) {
    const { width, height } = GENESIS_VISIBLE;
    ctx.fillStyle = "#0a0a1a";
    ctx.fillRect(0, 0, width, height);
    const lines = this.infoLines();
    lines.forEach((l, i) => drawText(ctx, l, 12, BAND_TOP + 12 + i * 12, i === 0 ? "#ffd400" : this.rom?.supported && l.startsWith("CHECKSUM") && !this.rom.checksumValid ? "#ff4040" : "#e8e8ff", i === 0 ? 1 : 1));
  }

  protected drawFrame(ctx: Canvas2DLike, frame: number) {
    const { width, height } = GENESIS_VISIBLE;
    // Animated raster bands (top + bottom), repainted each frame.
    for (let y = 0; y < BAND_TOP; y += 2) {
      const k = (Math.sin(y * 0.12 + frame * 0.08) + 1) / 2;
      ctx.fillStyle = `rgb(${(20 + k * 40) | 0},${(40 + k * 120) | 0},${(120 + k * 120) | 0})`;
      ctx.fillRect(0, y, width, 2);
    }
    for (let y = BAND_BOTTOM_Y; y < height; y += 2) {
      const k = (Math.sin(y * 0.15 - frame * 0.1) + 1) / 2;
      ctx.fillStyle = `rgb(${(120 + k * 120) | 0},${(30 + k * 60) | 0},${(60 + k * 40) | 0})`;
      ctx.fillRect(0, y, width, 2);
    }
    // Bouncing "sprite" in the top band.
    const x = 140 + Math.sin(frame * 0.07) * 120;
    const y = 24 + Math.abs(Math.sin(frame * 0.11)) * 18;
    ctx.fillStyle = "#ffd400";
    ctx.fillRect(x | 0, y | 0, 16, 16);
    ctx.fillStyle = "#ff3030";
    ctx.fillRect((x | 0) + 4, (y | 0) + 4, 8, 8);
    // Held-input indicator in the bottom band.
    if (this.pressed.size > 0) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(8, BAND_BOTTOM_Y + 8, 12 * this.pressed.size, 6);
    }
  }
}
