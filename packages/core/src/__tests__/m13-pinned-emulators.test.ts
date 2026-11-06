import { describe, expect, it } from "vitest";
import {
  VAmigaWebAdapter,
  EmulatorJsCoreAdapter,
  PINNED_VAMIGA_URL,
  REMOTE_VAMIGA_URL,
  PINNED_EJS_DATA_URL,
  REMOTE_EJS_DATA_URL,
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

describe("Milestone 13: Local Pinned Emulators (vAmiga & PUAE)", () => {
  describe("vAmiga Pinned Adapter", () => {
    it("defaults to local pinned URL (/cores/vamiga/index.html)", () => {
      const adapter = new VAmigaWebAdapter({
        mediaProvider: () => new Uint8Array(901120)
      });
      const caps = adapter.identifyCapabilities();
      expect(caps.name).toBe("vAmiga (real emulator, pinned local)");
      expect(PINNED_VAMIGA_URL).toBe("/cores/vamiga/index.html");
      expect(REMOTE_VAMIGA_URL).toBe("https://vamigaweb.github.io/");
    });

    it("identifies as remote when explicitly configured with remote baseUrl", () => {
      const adapter = new VAmigaWebAdapter({
        baseUrl: REMOTE_VAMIGA_URL,
        mediaProvider: () => new Uint8Array(901120)
      });
      const caps = adapter.identifyCapabilities();
      expect(caps.name).toBe("vAmiga (real emulator, via vAmigaWeb)");
    });

    it("generates frameInit with local pinned src URL", async () => {
      let capturedInit: FrameInit | undefined;
      const fakeWindow = new FakeFrameWindow();
      const adapter = new VAmigaWebAdapter({
        mediaProvider: () => new Uint8Array(901120),
        frameFactory: (init) => {
          capturedInit = init;
          return {
            element: {} as HTMLElement,
            contentWindow: fakeWindow,
            destroy: () => {}
          };
        }
      });

      await adapter.loadGame(makeProfile("Turrican II"));
      expect(capturedInit?.src).toContain("/cores/vamiga/index.html#");
    });
  });

  describe("PUAE (EmulatorJS) Pinned Adapter", () => {
    it("defaults to local pinned dataUrl (/cores/emulatorjs/data/)", () => {
      const adapter = new EmulatorJsCoreAdapter({
        mediaProvider: () => new Uint8Array(901120)
      });
      const caps = adapter.identifyCapabilities();
      expect(caps.name).toBe("PUAE Amiga OCS/ECS (real emulator, pinned local)");
      expect(PINNED_EJS_DATA_URL).toBe("/cores/emulatorjs/data/");
      expect(REMOTE_EJS_DATA_URL).toBe("https://cdn.emulatorjs.org/stable/data/");
    });

    it("identifies as remote when explicitly configured with remote dataUrl", () => {
      const adapter = new EmulatorJsCoreAdapter({
        dataUrl: REMOTE_EJS_DATA_URL,
        mediaProvider: () => new Uint8Array(901120)
      });
      const caps = adapter.identifyCapabilities();
      expect(caps.name).toBe("PUAE Amiga OCS/ECS (real emulator, via EmulatorJS)");
    });

    it("generates frameInit with local pinned dataUrl in srcdoc", async () => {
      let capturedInit: FrameInit | undefined;
      const fakeWindow = new FakeFrameWindow();
      const adapter = new EmulatorJsCoreAdapter({
        mediaProvider: () => new Uint8Array(901120),
        frameFactory: (init) => {
          capturedInit = init;
          return {
            element: {} as HTMLElement,
            contentWindow: fakeWindow,
            destroy: () => {}
          };
        }
      });

      await adapter.loadGame(makeProfile("Monkey Island"));
      expect(capturedInit?.srcdoc).toContain('window.EJS_pathtodata = "/cores/emulatorjs/data/";');
      expect(capturedInit?.srcdoc).toContain('<script src="/cores/emulatorjs/data/loader.js"></script>');
    });
  });

  describe("Integration & Media Resolution", () => {
    it("transparently resolves and unzips ADF files for both pinned adapters", async () => {
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
  });
});
