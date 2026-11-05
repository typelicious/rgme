import type { Canvas2DLike } from "./mock-runtime.js";
import type { GameProfile } from "./profile.js";

export const GURU_MEDITATION_ERROR_CODE = "#00000004.00004845#";

export const GURU_PROFILE: GameProfile = {
  schema: "rgme.game/v0.2",
  id: "amiga-guru-meditation",
  title: "Guru Meditation (Software Failure)",
  platform: "amiga",
  machine: { model: "A500", chipset: "OCS", video: "PAL", ram: { chipKb: 512, fastKb: 0 } },
  media: [{
    id: "guru-rom",
    kind: "rom",
    filename: "kickstart-fault.rom",
    label: "Guru Meditation Trigger",
    sha256: "0000000400004845".repeat(4)
  }],
  runtime: {
    preferredAdapter: "mock",
    options: { scene: "guru" }
  },
  launch: { bootMediaId: "guru-rom", autoStart: true },
  input: {
    id: "default-keyboard",
    keyboard: { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", Space: "fire" },
    gamepad: { "12": "up", "13": "down", "14": "left", "15": "right", "0": "fire" }
  },
  display: {
    id: "default-4-3",
    aspect: "4:3",
    scaling: "integer",
    crt: false,
    aspectAltered: false
  },
  rights: { recordId: "rights:amiga-guru:system" }
};

export function drawGuruMeditation(
  ctx: Canvas2DLike,
  width: number,
  height: number,
  frame: number,
  errorCode = GURU_MEDITATION_ERROR_CODE
) {
  // Pure black background
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, width, height);

  // Red border flashing at 1 Hz (50 FPS PAL: 25 frames on, 25 frames off)
  const isBorderVisible = Math.floor(frame / 25) % 2 === 0;

  const boxW = Math.min(width - 24, 290);
  const boxH = 46;
  const boxX = (width - boxW) / 2;
  const boxY = 36;

  if (isBorderVisible) {
    ctx.fillStyle = "#ff0000";
    // 3px flashing red border
    ctx.fillRect(boxX, boxY, boxW, 3);
    ctx.fillRect(boxX, boxY + boxH - 3, boxW, 3);
    ctx.fillRect(boxX, boxY, 3, boxH);
    ctx.fillRect(boxX + boxW - 3, boxY, 3, boxH);
  }

  // Centered red text in monospace
  if (ctx.fillText) {
    ctx.fillStyle = "#ff0000";
    ctx.font = "bold 9px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Software Failure.  Press left mouse button to continue.", width / 2, boxY + 16);
    ctx.fillText(`Guru Meditation ${errorCode}`, width / 2, boxY + 31);

    // Subtle helper text at bottom
    ctx.fillStyle = "rgba(255, 0, 0, 0.4)";
    ctx.font = "8px monospace";
    ctx.fillText("Click canvas or press Space to reboot", width / 2, height - 16);
  }
}
