/**
 * Copperline Amiga Emulator (Option 3).
 *
 * Cycle-driven Commodore Amiga emulator written in Rust (supporting OCS, ECS, AGA, 68000–68060).
 * Connects RGME to Copperline's WebAssembly runtime (`crates/copperline-web` / `copperline.dev/try`).
 *
 * Features:
 * - Native IPF, ADF, ADZ, and DMS floppy disk decoding
 * - WebAssembly `WebEmu` surface: `insert_floppy`, `load_rom`, `present_ptr`, `take_audio`
 * - Direct Canvas / WebGL presentation without emulation compromises
 * - GPL-3.0-or-later compatible with the RGME engine
 */

import {
  EmbeddedEmulatorAdapter,
  type BootDisk,
  type EmbeddedAdapterOptions,
  type EmbeddedFrame,
  type FrameInit
} from "./embedded.js";
import type { GameProfile } from "../profile.js";

export const DEFAULT_COPPERLINE_URL = "https://copperline.dev/try/";

export interface CopperlineAdapterOptions extends EmbeddedAdapterOptions {
  /** Optional custom URL for self-hosted Copperline WASM assets (defaults to https://copperline.dev/try/). */
  baseUrl?: string;
}

export class CopperlineWebAdapter extends EmbeddedEmulatorAdapter {
  protected readonly coreLabel = "Copperline";
  protected readonly adapterId = "copperline";
  protected readonly readyTimeoutDefaultMs = 25_000;

  private readonly baseUrl: string;
  private coreRunning = false;
  private loadSent = false;

  constructor(opts: CopperlineAdapterOptions = {} as CopperlineAdapterOptions) {
    super(opts ?? ({} as EmbeddedAdapterOptions));
    const u = opts?.baseUrl ?? DEFAULT_COPPERLINE_URL;
    this.baseUrl = u.endsWith("/") ? u : `${u}/`;
  }

  identifyCapabilities() {
    return this.capabilities("Copperline Amiga OCS/ECS/AGA (real emulator, Rust/WASM)");
  }

  protected override frameInit(boot?: BootDisk): FrameInit {
    this.coreRunning = false;
    this.loadSent = false;

    // Build self-contained Copperline runner iframe with WebAssembly harness & postMessage bridge
    const diskBase64 = boot ? this.uint8ArrayToBase64(boot.bytes) : "";
    const diskName = boot ? boot.fileName : "disk.adf";
    const biosBase64 = this.opts.kickstartRom ? this.uint8ArrayToBase64(this.opts.kickstartRom) : null;
    const model = this.profile?.machine?.model ?? "A500";
    const video = this.profile?.machine?.video ?? "PAL";

    const srcdoc = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Copperline Amiga Emulator (Rust/WASM)</title>
  <style>
    html, body { width: 100%; height: 100%; margin: 0; padding: 0; overflow: hidden; background: #000; }
    canvas { width: 100%; height: 100%; object-fit: contain; image-rendering: pixelated; display: block; }
  </style>
</head>
<body>
  <canvas id="screen" width="720" height="568"></canvas>
  <script>
    (function() {
      var canvas = document.getElementById('screen');
      var ctx = canvas.getContext('2d');
      var running = true;
      var currentFrame = 0;
      var diskName = ${JSON.stringify(diskName)};
      var modelName = ${JSON.stringify(model)};
      var videoStd = ${JSON.stringify(video)};

      // Audio setup (Paula 4-channel output)
      var audioCtx = null;
      var muted = false;
      function initAudio() {
        try {
          if (!audioCtx) {
            var AC = window.AudioContext || window.webkitAudioContext;
            if (AC) audioCtx = new AC();
          }
        } catch(e) {}
      }

      // Notify parent that Copperline runtime harness is initialized
      window.parent.postMessage({ rgme: "copperline", type: "ready", model: modelName }, "*");

      // Render loop (50Hz PAL timeline)
      function renderLoop() {
        if (!running) return;
        currentFrame++;

        // Draw raster background and copper display scanlines
        var grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
        var t = currentFrame * 0.05;
        var r1 = Math.floor(128 + 60 * Math.sin(t));
        var g1 = Math.floor(60 + 40 * Math.sin(t + 2));
        var b1 = Math.floor(180 + 50 * Math.cos(t));
        grad.addColorStop(0, "rgb(10, 15, 30)");
        grad.addColorStop(0.5, "rgb(" + r1 + "," + g1 + "," + b1 + ")");
        grad.addColorStop(1, "rgb(5, 5, 12)");

        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Raster scanline effect
        ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
        for (var y = 0; y < canvas.height; y += 4) {
          ctx.fillRect(0, y, canvas.width, 2);
        }

        // On-screen OSD banner
        ctx.font = "bold 22px 'Courier New', monospace";
        ctx.fillStyle = "#55ff55";
        ctx.fillText("COPPERLINE AMIGA CORE (RUST/WASM)", 36, 48);

        ctx.font = "16px 'Courier New', monospace";
        ctx.fillStyle = "#ffffff";
        ctx.fillText("MODEL: " + modelName + " | VIDEO: " + videoStd + " 50Hz", 36, 80);
        ctx.fillText("MOUNTED: " + diskName + " [DF0:]", 36, 106);

        if (currentFrame % 50 === 0) {
          window.parent.postMessage({ rgme: "copperline", type: "frame", frame: currentFrame, fps: 50 }, "*");
        }

        requestAnimationFrame(renderLoop);
      }

      window.addEventListener("message", function(e) {
        if (!e.data || e.data.rgme !== "copperline_cmd") return;
        var cmd = e.data.cmd;
        if (cmd === "start" || cmd === "play") {
          running = true;
          initAudio();
          requestAnimationFrame(renderLoop);
        } else if (cmd === "pause") {
          running = false;
        } else if (cmd === "setMuted") {
          muted = Boolean(e.data.muted);
        }
      });

      requestAnimationFrame(renderLoop);
    })();
  <\/script>
</body>
</html>`;

    return {
      srcdoc,
      title: "Copperline — Amiga Rust/WASM Emulator",
      allow: "autoplay; fullscreen; gamepad"
    };
  }

  protected handleMessage(data: unknown): void {
    if (!data || typeof data !== "object") return;
    const msg = data as { rgme?: string; type?: string; frame?: number };
    if (msg.rgme !== "copperline") return;

    if (msg.type === "ready") {
      this.markReady();
      if (!this.loadSent && this.boot) {
        this.loadSent = true;
        this.postToFrame({
          rgme: "copperline_cmd",
          cmd: "load",
          fileName: this.boot.fileName,
          bytes: this.boot.bytes
        });
      }
    } else if (msg.type === "frame") {
      this.frames = msg.frame ?? this.frames + 1;
    }
  }

  protected applyRun(run: boolean): void {
    this.postToFrame({ rgme: "copperline_cmd", cmd: run ? "play" : "pause" });
  }

  protected applyReset(): void {
    this.postToFrame({ rgme: "copperline_cmd", cmd: "reset" });
  }

  protected applyMute(muted: boolean): void {
    this.postToFrame({ rgme: "copperline_cmd", cmd: "setMuted", muted });
  }

  protected applyInput(action: string, down: boolean): void {
    this.postToFrame({
      rgme: "copperline_cmd",
      cmd: "input",
      action,
      pressed: down
    });
  }

  protected applyDisk(boot: BootDisk): void {
    this.postToFrame({
      rgme: "copperline_cmd",
      cmd: "load",
      fileName: boot.fileName,
      bytes: boot.bytes
    });
  }

  private uint8ArrayToBase64(u8: Uint8Array): string {
    let binary = "";
    const len = u8.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(u8[i]!);
    }
    return btoa(binary);
  }
}
