import type { Canvas2DLike } from "./mock-runtime.js";

export interface BoingBrick {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  points: number;
  alive: boolean;
}

export interface BoingState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  radius: number;
  paddleX: number;
  paddleW: number;
  paddleH: number;
  score: number;
  highScore: number;
  lives: number;
  gameOver: boolean;
  gameWon: boolean;
  bricks: BoingBrick[];
}

export function createBricks(): BoingBrick[] {
  const bricks: BoingBrick[] = [];
  const rows = [
    { color: "#ef4444", points: 50 }, // Amiga Ruby Red
    { color: "#f59e0b", points: 30 }, // Amiga Amber Gold
    { color: "#06b6d4", points: 20 }  // Amiga Electric Cyan
  ];
  const cols = 7;
  const brickW = 38;
  const brickH = 9;
  const startX = 17;
  const startY = 40;
  const gapX = 4;
  const gapY = 4;

  let id = 0;
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < cols; c++) {
      bricks.push({
        id: id++,
        x: startX + c * (brickW + gapX),
        y: startY + r * (brickH + gapY),
        w: brickW,
        h: brickH,
        color: rows[r]!.color,
        points: rows[r]!.points,
        alive: true
      });
    }
  }
  return bricks;
}

export function createInitialBoingState(): BoingState {
  return {
    x: 160,
    y: 110,
    vx: 2.2,
    vy: 1.5,
    rotation: 0,
    radius: 14,
    paddleX: 160,
    paddleW: 56,
    paddleH: 7,
    score: 0,
    highScore: 1250,
    lives: 3,
    gameOver: false,
    gameWon: false,
    bricks: createBricks()
  };
}

export function updateBoingPhysics(
  state: BoingState,
  inputs: ReadonlySet<string>,
  width = 320,
  height = 256,
  onBounce?: () => void
): BoingState {
  // If game over or won, space / fire restarts
  const wantsRestart = inputs.has("fire") || inputs.has("Space") || inputs.has("ArrowUp") || inputs.has("up");
  if ((state.gameOver || state.gameWon) && wantsRestart) {
    return createInitialBoingState();
  }

  if (state.gameOver || state.gameWon) {
    return state;
  }

  let {
    x, y, vx, vy, rotation, radius,
    paddleX, paddleW, paddleH,
    score, highScore, lives, bricks
  } = state;
  let gameOver: boolean = state.gameOver;
  let gameWon: boolean = state.gameWon;

  const paddleSpeed = 4.4;
  const paddleY = height - 38;

  // Paddle steering and ball English
  if (inputs.has("left") || inputs.has("ArrowLeft") || inputs.has("KeyA")) {
    paddleX = Math.max(paddleW / 2 + 10, paddleX - paddleSpeed);
    vx = Math.max(vx - 0.4, -4.5);
  }
  if (inputs.has("right") || inputs.has("ArrowRight") || inputs.has("KeyD")) {
    paddleX = Math.min(width - paddleW / 2 - 10, paddleX + paddleSpeed);
    vx = Math.min(vx + 0.4, 4.5);
  }

  // Ball integration
  const gravity = 0.28;
  vy += gravity;
  x += vx;
  y += vy;
  rotation = (rotation + vx * 0.05 + 0.03) % (Math.PI * 2);

  // Ceiling and side walls
  const ceiling = 26 + radius;
  const leftWall = 10 + radius;
  const rightWall = width - 10 - radius;

  if (x <= leftWall) {
    x = leftWall;
    vx = Math.abs(vx);
    onBounce?.();
  } else if (x >= rightWall) {
    x = rightWall;
    vx = -Math.abs(vx);
    onBounce?.();
  }

  if (y <= ceiling) {
    y = ceiling;
    vy = Math.abs(vy);
    onBounce?.();
  }

  // Paddle collision
  if (
    vy > 0 &&
    y + radius >= paddleY &&
    y - radius <= paddleY + paddleH &&
    x >= paddleX - paddleW / 2 - 4 &&
    x <= paddleX + paddleW / 2 + 4
  ) {
    y = paddleY - radius;
    const offset = (x - paddleX) / (paddleW / 2);
    vx = Math.max(-4.5, Math.min(4.5, offset * 3.8));
    vy = -Math.max(2.4, Math.abs(vy));
    onBounce?.();
  }

  // Brick collision
  for (const b of bricks) {
    if (!b.alive) continue;
    if (
      x + radius >= b.x &&
      x - radius <= b.x + b.w &&
      y + radius >= b.y &&
      y - radius <= b.y + b.h
    ) {
      b.alive = false;
      score += b.points;
      if (score > highScore) highScore = score;
      vy = -vy;
      onBounce?.();
      break; // one brick per tick
    }
  }

  // Check victory
  if (bricks.every((b) => !b.alive)) {
    gameWon = true;
    score += 1000;
    if (score > highScore) highScore = score;
  }

  // Bottom pit / life lost
  if (y >= height - 16) {
    lives -= 1;
    if (lives <= 0) {
      gameOver = true;
    } else {
      // Respawn above paddle
      x = paddleX;
      y = paddleY - radius - 15;
      vx = (Math.random() > 0.5 ? 1 : -1) * 2.2;
      vy = -2.6;
    }
  }

  return {
    x, y, vx, vy, rotation, radius,
    paddleX, paddleW, paddleH,
    score, highScore, lives,
    gameOver, gameWon, bricks
  };
}

export function drawBoingScene(
  ctx: Canvas2DLike,
  width: number,
  height: number,
  state: BoingState,
  title?: string,
  inputs?: ReadonlySet<string>
) {
  // Deep Amiga Slate / Night background
  ctx.fillStyle = "#0c101c";
  ctx.fillRect(0, 0, width, height);

  // Perspective floor grid (iconic Amiga grid in purple / cyan)
  const horizon = height - 42;
  ctx.fillStyle = "#161b2d";
  ctx.fillRect(0, horizon, width, height - horizon);

  // Floor grid lines
  ctx.fillStyle = "#4c3b7a";
  for (let x = 0; x <= width; x += 24) {
    ctx.fillRect(x, horizon, 1, height - horizon);
  }
  for (let y = horizon; y <= height; y += 10) {
    ctx.fillRect(0, y, width, 1);
  }

  // Draw destructible bricks
  if (state.bricks) {
    for (const b of state.bricks) {
      if (!b.alive) continue;
      // Main brick face
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      // 3D Bevel highlight (top/left)
      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      ctx.fillRect(b.x, b.y, b.w, 1);
      ctx.fillRect(b.x, b.y, 1, b.h);
      // 3D Bevel shadow (bottom/right)
      ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
      ctx.fillRect(b.x, b.y + b.h - 1, b.w, 1);
      ctx.fillRect(b.x + b.w - 1, b.y, 1, b.h);
    }
  }

  // Draw drop shadow under the ball
  const shadowY = horizon + 4;
  const shadowScale = Math.max(0.3, 1 - (horizon - state.y) / 160);
  const shadowW = state.radius * 1.6 * shadowScale;
  const shadowH = 10 * shadowScale;
  ctx.fillStyle = "rgba(10, 8, 20, 0.65)";
  ctx.fillRect(state.x - shadowW / 2, shadowY - shadowH / 2, shadowW, shadowH);

  // Draw Amiga Paddle
  const paddleY = height - 38;
  const px = state.paddleX - state.paddleW / 2;
  // Paddle body metallic gradient effect
  ctx.fillStyle = "#94a3b8";
  ctx.fillRect(px, paddleY, state.paddleW, state.paddleH);
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(px, paddleY, state.paddleW, 1);
  ctx.fillStyle = "#475569";
  ctx.fillRect(px, paddleY + state.paddleH - 1, state.paddleW, 1);
  // Red/Cyan center stripes
  ctx.fillStyle = "#ef4444";
  ctx.fillRect(state.paddleX - 6, paddleY + 1, 4, state.paddleH - 2);
  ctx.fillStyle = "#06b6d4";
  ctx.fillRect(state.paddleX + 2, paddleY + 1, 4, state.paddleH - 2);

  // Draw 3D Checkered Boing Ball
  drawCheckeredSphere(ctx, state.x, state.y, state.radius, state.rotation);

  // Top header banner & HUD
  if (ctx.fillText) {
    // Header background
    ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
    ctx.fillRect(0, 0, width, 22);

    // Title banner
    ctx.fillStyle = "#38bdf8";
    ctx.font = "bold 9px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const headerTitle = title ? `${title.toUpperCase()}` : "AMIGA RETRO ENGINE • BOING ARCADE";
    ctx.fillText(headerTitle.slice(0, 42), width / 2, 8);

    // HUD: Score / High Score / Lives
    ctx.font = "bold 8px monospace";
    ctx.textAlign = "left";
    ctx.fillStyle = "#a3e635";
    ctx.fillText(`SCORE: ${String(state.score).padStart(5, "0")}`, 10, 16);

    ctx.textAlign = "center";
    ctx.fillStyle = "#f59e0b";
    ctx.fillText(`HI: ${String(state.highScore).padStart(5, "0")}`, width / 2, 16);

    ctx.textAlign = "right";
    ctx.fillStyle = "#ef4444";
    const hearts = "♥ ".repeat(Math.max(0, state.lives)).trim();
    ctx.fillText(`LIVES: ${hearts || "0"}`, width - 10, 16);

    // Interactive controls reminder at bottom
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.font = "8px monospace";
    ctx.textAlign = "center";
    const statusHint = inputs && inputs.size > 0
      ? `ACTIVE INPUT: ${[...inputs].join(", ")}`
      : "CONTROLS: ◄ ► MOVE PADDLE  ▲ / SPACE LAUNCH";
    ctx.fillText(statusHint, width / 2, height - 8);

    // Game Over Overlay Box
    if (state.gameOver) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
      ctx.fillRect(40, 90, width - 80, 60);
      ctx.fillStyle = "#ef4444";
      ctx.fillRect(40, 90, width - 80, 2);
      ctx.fillRect(40, 148, width - 80, 2);

      ctx.font = "bold 13px monospace";
      ctx.textAlign = "center";
      ctx.fillText("GAME OVER", width / 2, 108);

      ctx.fillStyle = "#f8fafc";
      ctx.font = "8px monospace";
      ctx.fillText(`FINAL SCORE: ${state.score}`, width / 2, 124);

      ctx.fillStyle = "#38bdf8";
      ctx.fillText("PRESS SPACE / FIRE TO RESTART", width / 2, 138);
    }

    // Game Won Overlay Box
    if (state.gameWon) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
      ctx.fillRect(40, 90, width - 80, 60);
      ctx.fillStyle = "#10b981";
      ctx.fillRect(40, 90, width - 80, 2);
      ctx.fillRect(40, 148, width - 80, 2);

      ctx.font = "bold 12px monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = "#10b981";
      ctx.fillText("STAGE CLEARED!", width / 2, 108);

      ctx.fillStyle = "#f8fafc";
      ctx.font = "8px monospace";
      ctx.fillText(`BONUS +1000  •  SCORE: ${state.score}`, width / 2, 124);

      ctx.fillStyle = "#38bdf8";
      ctx.fillText("PRESS SPACE / FIRE FOR NEXT STAGE", width / 2, 138);
    }
  }
}

/** Draws the 3D-checkered red and white ball using latitude/longitude projected polygons */
function drawCheckeredSphere(
  ctx: Canvas2DLike,
  cx: number,
  cy: number,
  r: number,
  rot: number
) {
  const bands = 8;
  const slices = 16;
  const lightX = 0.5;
  const lightY = -0.6;
  const lightZ = 0.62;

  for (let b = 0; b < bands; b++) {
    const lat1 = ((b / bands) - 0.5) * Math.PI;
    const lat2 = (((b + 1) / bands) - 0.5) * Math.PI;
    const y1 = Math.sin(lat1);
    const y2 = Math.sin(lat2);
    const cosLat1 = Math.cos(lat1);
    const cosLat2 = Math.cos(lat2);

    for (let s = 0; s < slices; s++) {
      const lon1 = (s / slices) * Math.PI * 2 + rot;
      const lon2 = ((s + 1) / slices) * Math.PI * 2 + rot;

      const zAvg = (Math.cos(lon1) + Math.cos(lon2)) * 0.5;
      if (zAvg < -0.15) continue; // back-face culling

      const x1 = Math.sin(lon1) * cosLat1;
      const z1 = Math.cos(lon1) * cosLat1;
      const x2 = Math.sin(lon2) * cosLat1;
      const x3 = Math.sin(lon2) * cosLat2;
      const x4 = Math.sin(lon1) * cosLat2;

      // Calculate simple Lambertian diffuse lighting
      const normX = (x1 + x2 + x3 + x4) * 0.25;
      const normY = (y1 + y2) * 0.5;
      const normZ = zAvg;
      const dot = Math.max(0.15, normX * lightX + normY * lightY + normZ * lightZ);

      // Alternating red and white checker
      const isRed = (b + s) % 2 === 0;
      if (isRed) {
        const redVal = Math.min(255, Math.round(240 * dot + 25));
        ctx.fillStyle = `rgb(${redVal}, 15, 30)`;
      } else {
        const whiteVal = Math.min(255, Math.round(230 * dot + 35));
        ctx.fillStyle = `rgb(${whiteVal}, ${whiteVal}, ${whiteVal})`;
      }

      // Draw bounding rect on screen coordinates
      const px1 = cx + x1 * r;
      const py1 = cy - y1 * r;
      const px2 = cx + x2 * r;
      const px3 = cx + x3 * r;
      const py2 = cy - y2 * r;
      const px4 = cx + x4 * r;

      const minX = Math.min(px1, px2, px3, px4);
      const maxX = Math.max(px1, px2, px3, px4);
      const minY = Math.min(py1, py2);
      const maxY = Math.max(py1, py2);

      const w = Math.max(1, maxX - minX);
      const h = Math.max(1, maxY - minY);
      ctx.fillRect(minX, minY, w, h);
    }
  }

  // Outer rim outline for crisp retro feel
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(cx - r, cy, 1, 1);
  ctx.fillRect(cx + r, cy, 1, 1);
}
