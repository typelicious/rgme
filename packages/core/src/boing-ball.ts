import type { Canvas2DLike } from "./mock-runtime.js";

export interface BoingState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  radius: number;
}

export function createInitialBoingState(): BoingState {
  return {
    x: 160,
    y: 110,
    vx: 2.2,
    vy: 1.5,
    rotation: 0,
    radius: 36
  };
}

export function updateBoingPhysics(
  state: BoingState,
  inputs: ReadonlySet<string>,
  width = 320,
  height = 256,
  onBounce?: () => void
): BoingState {
  let { x, y, vx, vy, rotation, radius } = state;
  const gravity = 0.28;
  const floor = height - 42;
  const ceiling = 32;
  const leftWall = radius + 12;
  const rightWall = width - radius - 12;

  // Input handling
  if (inputs.has("left") || inputs.has("ArrowLeft")) vx = Math.max(vx - 0.4, -4.5);
  if (inputs.has("right") || inputs.has("ArrowRight")) vx = Math.min(vx + 0.4, 4.5);
  if ((inputs.has("up") || inputs.has("ArrowUp") || inputs.has("fire") || inputs.has("Space")) && y >= floor - 10) {
    vy = -7.5;
    onBounce?.();
  }

  // Apply gravity
  vy += gravity;
  x += vx;
  y += vy;
  rotation = (rotation + vx * 0.04 + 0.05) % (Math.PI * 2);

  let bounced = false;

  // Floor collision
  if (y >= floor) {
    y = floor;
    vy = -Math.abs(vy) * 0.88;
    if (Math.abs(vy) < 1.2) vy = -6.5; // continuous bounce
    bounced = true;
  }
  // Ceiling collision
  if (y <= ceiling) {
    y = ceiling;
    vy = Math.abs(vy);
    bounced = true;
  }
  // Walls collision
  if (x <= leftWall) {
    x = leftWall;
    vx = Math.abs(vx);
    bounced = true;
  } else if (x >= rightWall) {
    x = rightWall;
    vx = -Math.abs(vx);
    bounced = true;
  }

  if (bounced) onBounce?.();

  return { x, y, vx, vy, rotation, radius };
}

export function drawBoingScene(
  ctx: Canvas2DLike,
  width: number,
  height: number,
  state: BoingState,
  title?: string,
  inputs?: ReadonlySet<string>
) {
  // Amiga Slate Blue / Deep Night background
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

  // Draw drop shadow under the ball
  const shadowY = horizon + 4;
  const shadowScale = Math.max(0.3, 1 - (horizon - state.y) / 160);
  const shadowW = state.radius * 1.6 * shadowScale;
  const shadowH = 10 * shadowScale;
  ctx.fillStyle = "rgba(10, 8, 20, 0.65)";
  ctx.fillRect(state.x - shadowW / 2, shadowY - shadowH / 2, shadowW, shadowH);

  // Draw 3D Checkered Boing Ball
  drawCheckeredSphere(ctx, state.x, state.y, state.radius, state.rotation);

  // Top header banner
  if (ctx.fillText) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
    ctx.fillRect(0, 0, width, 22);
    ctx.fillStyle = "#38bdf8";
    ctx.font = "bold 10px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(title ? `${title.toUpperCase()} • AMIGA RETRO ENGINE` : "COMMODORE AMIGA 500 • BOING BALL DEMO", width / 2, 11);

    // Interactive controls reminder at bottom
    ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
    ctx.font = "8px monospace";
    const statusHint = inputs && inputs.size > 0
      ? `ACTIVE INPUT: ${[...inputs].join(", ")}`
      : "CONTROLS: ◄ ► STEER BALL   ▲ / SPACE BOUNCE BOOST";
    ctx.fillText(statusHint, width / 2, height - 10);
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
