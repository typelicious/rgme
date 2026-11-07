import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { resolveDiskBytesAndName } from "../emulator/embedded.js";

describe("Copperline Headless WASM Execution", () => {
  it("boots genuine Amiga A500 in headless WASM, runs 600 frames, renders pixels and outputs Paula audio", async () => {
    const wasmPath = path.resolve(
      __dirname,
      "../../../web/public/emulators/copperline/pkg/copperline_web_bg.wasm"
    );
    const wasmModule = await WebAssembly.compile(fs.readFileSync(wasmPath));
    const copperline = await import(
      "../../../web/public/emulators/copperline/pkg/copperline_web.js"
    );
    const initResult = await copperline.default({ module_or_path: wasmModule });

    const romPath = path.resolve(
      __dirname,
      "../../../web/public/emulators/copperline/aros/aros-amiga-m68k-rom.bin"
    );
    const extPath = path.resolve(
      __dirname,
      "../../../web/public/emulators/copperline/aros/aros-amiga-m68k-ext.bin"
    );
    const adfPath = path.resolve(__dirname, "../../../../concept/fixtures/rgme-scene-intro.adf");

    expect(fs.existsSync(wasmPath)).toBe(true);
    expect(fs.existsSync(romPath)).toBe(true);
    expect(fs.existsSync(extPath)).toBe(true);
    expect(fs.existsSync(adfPath)).toBe(true);

    const rom = fs.readFileSync(romPath);
    const ext = fs.readFileSync(extPath);
    const rawAdf = fs.readFileSync(adfPath);

    const mockMedia = { id: "scene-intro", name: "rgme-scene-intro.adf", format: "adf" as const, uri: "uri" };
    const { bytes: adf } = await resolveDiskBytesAndName(mockMedia, new Uint8Array(rawAdf));

    const emu = new copperline.WebEmu("A500", "PAL", 2);
    expect(emu.machine_model()).toBe("A500");
    expect(emu.video_standard()).toBe("PAL");

    emu.load_rom(new Uint8Array(rom), new Uint8Array(ext));
    emu.insert_floppy(0, adf, "rgme-scene-intro.adf");

    let totalAudioSamples = 0;
    let maxUniqueColors = 0;
    let trackActivitySeen = false;

    // Run 750 frames (15 seconds of PAL 50Hz)
    for (let frame = 1; frame <= 750; frame++) {
      emu.run(frame * 20, 1);
      const audio = emu.take_audio();
      if (audio && audio.length > 0) {
        totalAudioSamples += audio.length;
      }

      const track = emu.fdd_track(0);
      if (typeof track === "number" && track >= 0) {
        trackActivitySeen = true;
      }

      if (frame % 50 === 0) {
        const ptr = emu.present_ptr();
        const w = emu.present_width();
        const h = emu.present_rows();
        if (ptr && w > 0 && h > 0) {
          const fb = new Uint8Array(initResult.memory.buffer, ptr, w * h * 4);
          const colors = new Set<number>();
          for (let i = 0; i < fb.length; i += 4) {
            if (fb[i] !== 0 || fb[i + 1] !== 0 || fb[i + 2] !== 0) {
              colors.add((fb[i] << 16) | (fb[i + 1] << 8) | fb[i + 2]);
            }
          }
          if (colors.size > maxUniqueColors) {
            maxUniqueColors = colors.size;
          }
        }
      }
    }

    // Assert: Real Amiga execution actually happened!
    expect(trackActivitySeen).toBe(true);
    expect(totalAudioSamples).toBeGreaterThan(50000);
    expect(maxUniqueColors).toBeGreaterThan(1);
    expect(emu.present_width()).toBeGreaterThan(600);
    expect(emu.present_rows()).toBeGreaterThan(400);

    emu.free();
  }, 20000);
});
