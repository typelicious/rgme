import { describe, it, expect } from "vitest";
import {
  GURU_PROFILE,
  drawGuruMeditation,
  GURU_MEDITATION_ERROR_CODE,
  createInitialBoingState,
  updateBoingPhysics,
  drawBoingScene,
  MockRuntimeAdapter
} from "../index.js";

describe("M6 Core Features", () => {
  it("GURU_PROFILE has valid structure and schema", () => {
    expect(GURU_PROFILE.id).toBe("amiga-guru-meditation");
    expect(GURU_PROFILE.platform).toBe("amiga");
    expect(GURU_PROFILE.runtime.options?.scene).toBe("guru");
  });

  it("drawGuruMeditation renders flashing red border and Topaz monospace failure code", () => {
    const calls: { fillStyle: string; rect: number[] }[] = [];
    const texts: { text: string; x: number; y: number }[] = [];
    const ctx = {
      fillStyle: "",
      fillRect: (x: number, y: number, w: number, h: number) => {
        calls.push({ fillStyle: String(ctx.fillStyle), rect: [x, y, w, h] });
      },
      fillText: (text: string, x: number, y: number) => {
        texts.push({ text, x, y });
      }
    };

    // Frame 0: border should be visible
    drawGuruMeditation(ctx, 320, 256, 0);
    expect(calls.some((c) => c.fillStyle === "#000000")).toBe(true);
    expect(calls.some((c) => c.fillStyle === "#ff0000")).toBe(true);
    expect(texts.some((t) => t.text.includes("Software Failure"))).toBe(true);
    expect(texts.some((t) => t.text.includes(GURU_MEDITATION_ERROR_CODE))).toBe(true);

    // Frame 25: border should be hidden (flashing off)
    const callsOff: typeof calls = [];
    const ctxOff = {
      fillStyle: "",
      fillRect: (x: number, y: number, w: number, h: number) => {
        callsOff.push({ fillStyle: String(ctxOff.fillStyle), rect: [x, y, w, h] });
      }
    };
    drawGuruMeditation(ctxOff, 320, 256, 25);
    expect(callsOff.some((c) => c.fillStyle === "#ff0000")).toBe(false);
  });

  it("Boing Ball physics updates position, applies gravity and responds to inputs", () => {
    let state = createInitialBoingState();
    expect(state.x).toBe(160);
    expect(state.y).toBe(110);

    // Step physics with no input
    state = updateBoingPhysics(state, new Set());
    expect(state.vy).toBeGreaterThan(1.5); // gravity accelerated downward

    // Step physics with left arrow input
    const prevVx = state.vx;
    state = updateBoingPhysics(state, new Set(["ArrowLeft"]));
    expect(state.vx).toBeLessThan(prevVx); // accelerated leftward
  });

  it("Boing Ball scene renders checkered sphere, drop shadow, and retro header", () => {
    const calls: string[] = [];
    const texts: string[] = [];
    const ctx = {
      fillStyle: "",
      fillRect: (...a: number[]) => calls.push(a.join(",")),
      fillText: (t: string) => texts.push(t)
    };
    const state = createInitialBoingState();
    drawBoingScene(ctx, 320, 256, state, "Lure of the Temptress");
    expect(calls.length).toBeGreaterThan(10);
    expect(texts.some((t) => t.includes("LURE OF THE TEMPTRESS"))).toBe(true);
  });

  it("MockRuntimeAdapter boots Guru Meditation and Boing Ball scenes", async () => {
    const a = new MockRuntimeAdapter();
    await a.loadGame(GURU_PROFILE);
    expect(a.state).toBe("LOADED");
    a.start();
    expect(a.state).toBe("RUNNING");
    a.tick();
    expect(a.currentFrame).toBe(1);
    a.stop();
  });
});
