import { describe, expect, it } from "vitest";
import {
  VAmigaWebAdapter,
  EmulatorJsCoreAdapter,
  createStoredZip,
  ZipParser,
  toDiskFileName,
  type FrameInit,
  type MessageEventLike,
  type FrameWindow
} from "../index.js";
import type { GameProfile, Media } from "../profile.js";

const TEST_MEDIA: Media = {
  id: "df0",
  filename: "Turrican.adf",
  label: "Turrican Disk 1",
  kind: "floppy-adf",
  sha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  sizeBytes: 901120
};

const TEST_PROFILE: GameProfile = {
  id: "turrican",
  title: "Turrican (Europe)",
  platform: "amiga",
  media: [TEST_MEDIA],
  launch: { bootMediaId: "df0" },
  display: { standard: "PAL", integerScale: 1, crtPreset: "1084-clean" }
};

interface MockFrameEnv {
  sentToFrame: unknown[];
  frameInit?: FrameInit;
  removed: boolean;
  messageListener?: (e: MessageEventLike) => void;
  mockWindow: FrameWindow;
  simulateMessageFromFrame: (data: unknown) => void;
  advanceTimer: () => void;
  timers: {
    setTimeout: (fn: () => void, ms: number) => number;
    clearTimeout: (h: unknown) => void;
    setInterval: (fn: () => void, ms: number) => number;
    clearInterval: (h: unknown) => void;
  };
}

function createMockFrameEnv(): MockFrameEnv {
  const sentToFrame: unknown[] = [];
  let timeoutFn: (() => void) | undefined;

  const mockWindow: FrameWindow = {
    postMessage(msg: unknown) {
      sentToFrame.push(msg);
    }
  };

  const env: MockFrameEnv = {
    sentToFrame,
    removed: false,
    mockWindow,
    simulateMessageFromFrame(data: unknown) {
      env.messageListener?.({ data, source: mockWindow });
    },
    advanceTimer() {
      timeoutFn?.();
    },
    timers: {
      setTimeout(fn: () => void) {
        timeoutFn = fn;
        return 1;
      },
      clearTimeout() {
        timeoutFn = undefined;
      },
      setInterval() {
        return 2;
      },
      clearInterval() {}
    }
  };

  return env;
}

describe("Milestone 12: Real Amiga Emulation (vAmigaWeb & EmulatorJS)", () => {
  it("formats disk file names reliably with .adf extension", () => {
    expect(toDiskFileName({ id: "1", filename: "Rick Dangerous (Europe).zip", kind: "floppy-adf", sha256: "a" })).toBe("Rick_Dangerous__Europe_.adf");
    expect(toDiskFileName({ id: "2", label: "Wayne Gretzky Hockey", kind: "floppy-adf", sha256: "b" })).toBe("Wayne_Gretzky_Hockey.adf");
  });

  describe("vAmigaWebAdapter", () => {
    it("identifies vAmiga capabilities faithfully", () => {
      const adapter = new VAmigaWebAdapter({
        mediaProvider: () => new Uint8Array(901120)
      });
      const caps = adapter.identifyCapabilities();
      expect(caps.id).toBe("vamiga");
      expect(caps.name).toContain("vAmiga");
      expect(caps.name).toContain("real emulator");
    });

    it("mounts iframe with encoded vAmigaWeb URL config and injects disk on render_run_state", async () => {
      const env = createMockFrameEnv();
      const kickRom = new Uint8Array(524288);
      const rawDisk = new Uint8Array(901120);
      rawDisk.set([0x44, 0x4f, 0x53, 0]);

      const adapter = new VAmigaWebAdapter({
        mediaProvider: () => rawDisk,
        kickstartRom: kickRom,
        frameFactory: (init) => {
          env.frameInit = init;
          return {
            contentWindow: env.mockWindow,
            remove: () => { env.removed = true; }
          };
        },
        messageTarget: {
          addEventListener: (_type, l) => { env.messageListener = l; },
          removeEventListener: () => { env.messageListener = undefined; }
        },
        timers: env.timers
      });

      await adapter.loadGame(TEST_PROFILE);
      expect(env.frameInit?.src).toContain("https://vamigaweb.github.io/#");
      expect(env.frameInit?.src).toContain("wait_for_kickstart_injection");

      // Core responds with its running state:
      env.simulateMessageFromFrame({ msg: "render_run_state", value: false });

      // Adapter must have transmitted { cmd: "load", file_name, file, kickstart_rom }
      const loadMsg = env.sentToFrame.find((m: any) => m && m.cmd === "load") as any;
      expect(loadMsg).toBeDefined();
      expect(loadMsg.file_name).toBe("Turrican.adf");
      expect(loadMsg.file).toBe(rawDisk);
      expect(loadMsg.kickstart_rom).toBe(kickRom);

      // Starting and pausing toggles the run state
      adapter.start();
      expect(env.sentToFrame).toContain("button_run()");

      // Reset sends wasm_reset() script
      adapter.reset();
      expect(env.sentToFrame.some((m: any) => m?.cmd === "script" && m.script === "wasm_reset()")).toBe(true);

      // Joystick inputs map to emit_joystick_cmd
      adapter.pressInput("left", true);
      expect(env.sentToFrame.some((m: any) => m?.cmd === "script" && m.script.includes("2PULL_LEFT"))).toBe(true);
      adapter.pressInput("left", false);
      expect(env.sentToFrame.some((m: any) => m?.cmd === "script" && m.script.includes("2RELEASE_X"))).toBe(true);

      adapter.dispose();
      expect(env.removed).toBe(true);
    });

    it("surfaces a clean error status if the core does not start before the timeout", async () => {
      const env = createMockFrameEnv();
      let lastStatus: any;

      const adapter = new VAmigaWebAdapter({
        mediaProvider: () => new Uint8Array(901120),
        readyTimeoutMs: 5000,
        frameFactory: () => ({ contentWindow: env.mockWindow, remove: () => {} }),
        timers: env.timers
      });
      adapter.onStatus((s) => { lastStatus = s; });

      await adapter.loadGame(TEST_PROFILE);
      expect(lastStatus.phase).toBe("loading");

      // Advance past timeout without core response
      env.advanceTimer();
      expect(lastStatus.phase).toBe("error");
      expect(lastStatus.message).toContain("did not start");
    });
  });

  describe("EmulatorJsCoreAdapter", () => {
    it("identifies PUAE capabilities faithfully", () => {
      const adapter = new EmulatorJsCoreAdapter({
        mediaProvider: () => new Uint8Array(901120)
      });
      const caps = adapter.identifyCapabilities();
      expect(caps.id).toBe("puae");
      expect(caps.name).toContain("PUAE");
      expect(caps.name).toContain("real emulator");
    });

    it("mounts srcdoc iframe booting PUAE with blob URL and starts on message", async () => {
      const env = createMockFrameEnv();
      const rawDisk = new Uint8Array(901120);

      const adapter = new EmulatorJsCoreAdapter({
        mediaProvider: () => rawDisk,
        frameFactory: (init) => {
          env.frameInit = init;
          return {
            contentWindow: env.mockWindow,
            remove: () => { env.removed = true; }
          };
        },
        messageTarget: {
          addEventListener: (_type, l) => { env.messageListener = l; },
          removeEventListener: () => { env.messageListener = undefined; }
        },
        timers: env.timers
      });

      await adapter.loadGame(TEST_PROFILE);
      expect(env.frameInit?.srcdoc).toContain("EJS_core = 'amiga'");
      expect(env.frameInit?.srcdoc).toContain("EJS_gameName = \"Turrican.adf\"");

      // Simulate EmulatorJS booting and triggering EJS_onGameStart
      env.simulateMessageFromFrame({ rgme: "ejs", type: "started" });

      adapter.start();
      expect(env.sentToFrame).toContainEqual({ rgme: "ejs_cmd", cmd: "play" });

      adapter.pause();
      expect(env.sentToFrame).toContainEqual({ rgme: "ejs_cmd", cmd: "pause" });

      adapter.reset();
      expect(env.sentToFrame).toContainEqual({ rgme: "ejs_cmd", cmd: "restart" });

      adapter.dispose();
      expect(env.removed).toBe(true);
    });

    it("packages Kickstart ROM into multi-alias stored zip so PUAE finds all canonical filenames", async () => {
      const env = createMockFrameEnv();
      const fakeRom = new Uint8Array([0x11, 0x14, 0x4e, 0x75, 0x00, 0x20]);

      const adapter = new EmulatorJsCoreAdapter({
        mediaProvider: () => new Uint8Array(901120),
        kickstartRom: fakeRom,
        frameFactory: (init) => {
          env.frameInit = init;
          return { contentWindow: env.mockWindow, remove: () => {} };
        },
        timers: env.timers
      });

      await adapter.loadGame(TEST_PROFILE);
      expect(env.frameInit?.srcdoc).toContain("EJS_biosUrl");
      expect(env.frameInit?.srcdoc).toContain("kick34005.A500");
      expect(env.frameInit?.srcdoc).toContain("kick40063.A600");
      expect(env.frameInit?.srcdoc).toContain("kick.rom");
      expect(env.frameInit?.srcdoc).toContain("injectBios");
    });
  });

  describe("createStoredZip", () => {
    it("creates standard zip archives with stored files decodable by ZipParser", async () => {
      const dataA = new Uint8Array([10, 20, 30, 40]);
      const dataB = new Uint8Array([50, 60, 70]);
      const zipBytes = createStoredZip([
        { name: "kick34005.A500", data: dataA },
        { name: "kick40063.A600", data: dataB }
      ]);

      expect(ZipParser.isZip(zipBytes)).toBe(true);
      const parser = new ZipParser(zipBytes);
      expect(parser.entries.map((e) => e.filename)).toEqual(["kick34005.A500", "kick40063.A600"]);

      const extractedA = await parser.extract("kick34005.A500");
      expect(extractedA).toEqual(dataA);

      const extractedB = await parser.extract("kick40063.A600");
      expect(extractedB).toEqual(dataB);
    });
  });
});
