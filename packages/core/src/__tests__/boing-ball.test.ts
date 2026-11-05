import { describe, it, expect } from "vitest";
import {
  createInitialBoingState,
  createBricks,
  updateBoingPhysics,
  drawBoingScene
} from "../boing-ball.js";

describe("Boing Ball Retro Arcade Engine", () => {
  it("initializes playable arcade state with bricks, lives, paddle, and zero score", () => {
    const state = createInitialBoingState();
    expect(state.lives).toBe(3);
    expect(state.score).toBe(0);
    expect(state.gameOver).toBe(false);
    expect(state.gameWon).toBe(false);
    expect(state.paddleW).toBeGreaterThan(30);
    expect(state.bricks.length).toBe(21); // 3 rows of 7
    expect(state.bricks.every((b) => b.alive)).toBe(true);
  });

  it("steers the paddle left and right via inputs", () => {
    let state = createInitialBoingState();
    const initialPaddleX = state.paddleX;

    // Move left
    state = updateBoingPhysics(state, new Set(["ArrowLeft"]));
    expect(state.paddleX).toBeLessThan(initialPaddleX);

    // Move right
    state = updateBoingPhysics(state, new Set(["ArrowRight"]));
    state = updateBoingPhysics(state, new Set(["ArrowRight"]));
    expect(state.paddleX).toBeGreaterThan(initialPaddleX - 4);
  });

  it("reflects ball and increments score when colliding with a brick", () => {
    let state = createInitialBoingState();
    // Position ball directly below the first brick moving upward
    const targetBrick = state.bricks[0]!;
    state.x = targetBrick.x + targetBrick.w / 2;
    state.y = targetBrick.y + targetBrick.h + state.radius - 1;
    state.vy = -3;

    state = updateBoingPhysics(state, new Set());

    // Brick should be destroyed
    expect(targetBrick.alive).toBe(false);
    // Score should increase by brick points
    expect(state.score).toBe(targetBrick.points);
    // Ball vertical velocity should invert
    expect(state.vy).toBeGreaterThan(0);
  });

  it("reflects ball off paddle with steer offset", () => {
    let state = createInitialBoingState();
    const paddleY = 256 - 38;
    state.x = state.paddleX + 15; // Hit right side of paddle
    state.y = paddleY - state.radius;
    state.vy = 3; // Moving downward

    state = updateBoingPhysics(state, new Set());

    // Ball should reflect upward
    expect(state.vy).toBeLessThan(0);
    // Ball should steer rightwards due to right-side offset
    expect(state.vx).toBeGreaterThan(0);
  });

  it("decrements lives when ball drops below floor pit", () => {
    let state = createInitialBoingState();
    state.y = 250; // In pit
    state.vy = 4;

    state = updateBoingPhysics(state, new Set());

    // Lives should be 2, ball respawned above paddle
    expect(state.lives).toBe(2);
    expect(state.gameOver).toBe(false);
    expect(state.y).toBeLessThan(230);
  });

  it("triggers game over on 0 lives and restarts on Space / Fire", () => {
    let state = createInitialBoingState();
    state.lives = 1;
    state.y = 250;

    state = updateBoingPhysics(state, new Set());
    expect(state.lives).toBe(0);
    expect(state.gameOver).toBe(true);

    // Restart with Space
    state = updateBoingPhysics(state, new Set(["Space"]));
    expect(state.gameOver).toBe(false);
    expect(state.lives).toBe(3);
    expect(state.score).toBe(0);
    expect(state.bricks.every((b) => b.alive)).toBe(true);
  });

  it("renders boing scene safely without throwing", () => {
    const state = createInitialBoingState();
    const fills: string[] = [];
    const mockCtx = {
      fillStyle: "",
      fillRect(x: number, y: number, w: number, h: number) {
        fills.push(this.fillStyle);
      },
      fillText(text: string, x: number, y: number) {},
      font: "",
      textAlign: "",
      textBaseline: ""
    };

    drawBoingScene(mockCtx as any, 320, 256, state, "Civilization");
    expect(fills.length).toBeGreaterThan(20);
  });
});
