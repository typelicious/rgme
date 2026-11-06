import { describe, it, expect } from "vitest";
import {
  CopperlineWebAdapter,
  DEFAULT_COPPERLINE_URL,
  type FrameInit,
  type FrameWindow,
  type MessageEventLike
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
  mockWindow: FrameWindow;
  messageTarget: {
    addEventListener: (type: string, fn: (e: MessageEventLike) => void) => void;
    removeEventListener: () => void;
  };
  simulateMessageFromFrame: (data: unknown) => void;
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
  let messageHandler: ((e: MessageEventLike) => void) | undefined;

  const mockWindow: FrameWindow = {
    postMessage(msg: unknown) {
      sentToFrame.push(msg);
    }
  };

  const messageTarget = {
    addEventListener(type: string, fn: (e: MessageEventLike) => void) {
      if (type === "message") messageHandler = fn;
    },
    removeEventListener() {}
  };

  const env: MockFrameEnv = {
    sentToFrame,
    mockWindow,
    messageTarget,
    simulateMessageFromFrame(data: unknown) {
      messageHandler?.({ data, source: mockWindow });
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

describe("Milestone 14: Copperline (Rust/WASM) Adapter & Bootblock Integrity", () => {
  it("initializes CopperlineWebAdapter with default URL and lifecycle", () => {
    const adapter = new CopperlineWebAdapter({ mediaProvider: () => new Uint8Array() });
    expect(adapter).toBeDefined();
    expect(adapter.state).toBe("UNLOADED");
    expect(DEFAULT_COPPERLINE_URL).toBe("https://copperline.dev/try/");
  });

  it("mounts Copperline iframe with srcdoc, WebAssembly harness and postMessage bridge", async () => {
    const env = createMockFrameEnv();
    const rawDisk = new Uint8Array(901120);
    rawDisk.set([0x44, 0x4f, 0x53, 0]); // DOS\0

    const adapter = new CopperlineWebAdapter({
      mediaProvider: () => rawDisk,
      timers: env.timers,
      messageTarget: env.messageTarget,
      frameFactory: (init) => {
        env.frameInit = init;
        return {
          contentWindow: env.mockWindow,
          remove: () => {}
        };
      }
    });

    await adapter.loadGame(TEST_PROFILE);

    expect(adapter.state).toBe("LOADED");
    expect(env.frameInit?.srcdoc).toContain("COPPERLINE AMIGA CORE (RUST/WASM)");
    expect(env.frameInit?.srcdoc).toContain("Copperline Amiga Emulator (Rust/WASM)");
    expect(env.frameInit?.allow).toContain("autoplay; fullscreen; gamepad");

    env.simulateMessageFromFrame({ rgme: "copperline", type: "ready" });
    adapter.start();
    expect(adapter.state).toBe("RUNNING");

    adapter.pause();
    expect(adapter.state).toBe("PAUSED");

    adapter.stop();
    expect(adapter.state).toBe("STOPPED");
  });

  it("dispatches input actions to Copperline iframe via postMessage", async () => {
    const env = createMockFrameEnv();
    const adapter = new CopperlineWebAdapter({
      mediaProvider: () => new Uint8Array(901120),
      timers: env.timers,
      messageTarget: env.messageTarget,
      frameFactory: (init) => {
        env.frameInit = init;
        return {
          contentWindow: env.mockWindow,
          remove: () => {}
        };
      }
    });

    await adapter.loadGame(TEST_PROFILE);
    env.simulateMessageFromFrame({ rgme: "copperline", type: "ready" });
    adapter.start();
    adapter.pressInput("up", true);

    expect(env.sentToFrame).toContainEqual(
      expect.objectContaining({
        rgme: "copperline_cmd",
        cmd: "input",
        action: "up",
        pressed: true
      })
    );
    adapter.stop();
  });
});
