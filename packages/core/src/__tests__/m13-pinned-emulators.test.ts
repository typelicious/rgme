import { describe, expect, it } from "vitest";
import {
  VAmigaWebAdapter,
  EmulatorJsCoreAdapter,
  VAMIGAWEB_URL,
  DEFAULT_EJS_DATA_URL,
  toDiskFileName,
  resolveDiskBytesAndName,
  type FrameInit,
  type FrameWindow
} from "../emulator/index.js";
import { createStoredZip } from "../zip/zip-writer.js";
import type { GameProfile } from "../profile.js";

class FakeFrameWindow implements FrameWindow {
  readonly posted: unknown[] = [];
  postMessage(message: unknown, _targetOrigin: string): void {
    this.posted.push(message);
  }
}

function makeProfile(label: string, id = "m1"): GameProfile {
  return {
    id: "p1",
    title: label,
    platform: "amiga",
    display: { standard: "PAL", scaling: "pixel-perfect" },
    input: { scheme: "joystick" },
    media: [{ id, label, kind: "floppy-adf", sha256: "a".repeat(64) }],
    launch: { bootMediaId: id }
  };
}

describe("Milestone 13: Real Emulator Core Integration (vAmiga & PUAE)", () => {
  describe("vAmiga Real Adapter", () => {
    it("defaults to official vAmigaWeb instance (https://vamigaweb.github.io/)", () => {
      const adapter = new VAmigaWebAdapter({
        mediaProvider: () => new Uint8Array(901120)
      });
      const caps = adapter.identifyCapabilities();
      expect(caps.name).toBe("vAmiga (real emulator, via vAmigaWeb)");
      expect(VAMIGAWEB_URL).toBe("https://vamigaweb.github.io/");
    });

    it("generates frameInit with vAmigaWeb URL and encoded configuration", async () => {
      let capturedInit: FrameInit | undefined;
      const fakeWindow = new FakeFrameWindow();
      const adapter = new VAmigaWebAdapter({
        mediaProvider: () => new Uint8Array(901120),
        frameFactory: (init) => {
          capturedInit = init;
          return {
            contentWindow: fakeWindow,
            remove: () => {}
          };
        }
      });

      await adapter.loadGame(makeProfile("Turrican II"));
      expect(capturedInit?.src).toContain("https://vamigaweb.github.io/#");
    });
  });

  describe("PUAE (EmulatorJS) Real Adapter", () => {
    it("defaults to official EmulatorJS data CDN", () => {
      const adapter = new EmulatorJsCoreAdapter({
        mediaProvider: () => new Uint8Array(901120)
      });
      const caps = adapter.identifyCapabilities();
      expect(caps.name).toBe("PUAE Amiga OCS/ECS (real emulator, via EmulatorJS)");
      expect(DEFAULT_EJS_DATA_URL).toBe("https://cdn.emulatorjs.org/stable/data/");
    });

    it("generates frameInit with dataUrl in srcdoc", async () => {
      let capturedInit: FrameInit | undefined;
      const fakeWindow = new FakeFrameWindow();
      const adapter = new EmulatorJsCoreAdapter({
        mediaProvider: () => new Uint8Array(901120),
        timers: {
          setTimeout: () => 1 as unknown as ReturnType<typeof setTimeout>,
          clearTimeout: () => {},
          setInterval: () => 2 as unknown as ReturnType<typeof setInterval>,
          clearInterval: () => {}
        },
        frameFactory: (init) => {
          capturedInit = init;
          return {
            contentWindow: fakeWindow,
            remove: () => {}
          };
        }
      });

      await adapter.loadGame(makeProfile("Monkey Island"));
      expect(capturedInit?.srcdoc).toContain('window.EJS_pathtodata = "https://cdn.emulatorjs.org/stable/data/";');
      expect(capturedInit?.srcdoc).toContain('<script src="https://cdn.emulatorjs.org/stable/data/loader.js"></script>');
      adapter.stop();
    });
  });

  describe("Integration & Media Resolution", () => {
    it("transparently resolves and unzips ADF files for real emulators", async () => {
      const adfContent = new Uint8Array([0x44, 0x4f, 0x53, 0x00, 10, 20, 30]);
      const zipBytes = createStoredZip([
        { name: "Rick Dangerous (Disk 1).adf", data: adfContent }
      ]);

      const res = await resolveDiskBytesAndName(
        { id: "rick", filename: "Rick Dangerous.zip", kind: "floppy-adf", sha256: "b".repeat(64) },
        zipBytes
      );

      expect(res.fileName).toBe("Rick_Dangerous__Disk_1_.adf");
      expect(res.bytes).toEqual(adfContent);
    });

    it("patches ASCII-only bootblock headers with valid 68000 executable code to avoid Guru Meditation #00000004", async () => {
      const unbootableAdf = new Uint8Array(901120);
      unbootableAdf.set([0x44, 0x4f, 0x53, 0x00]);
      const banner = new TextEncoder().encode("RGME SCENE INTRO v1.0");
      unbootableAdf.set(banner, 12);

      const res = await resolveDiskBytesAndName(
        { id: "scene", filename: "rgme-scene-intro.adf", kind: "floppy-adf", sha256: "c".repeat(64) },
        unbootableAdf
      );

      // Must have valid 68000 lea $dff000, a6 instruction (0x4D, 0xF9, 0x00, 0xDF, 0xF0, 0x00)
      expect(res.bytes[12]).toBe(0x4d);
      expect(res.bytes[13]).toBe(0xf9);
      expect(res.bytes[14]).toBe(0x00);
      expect(res.bytes[15]).toBe(0xdf);
    });
  });
});
