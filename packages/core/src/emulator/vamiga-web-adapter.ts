import {
  EmbeddedEmulatorAdapter,
  type BootDisk,
  type EmbeddedAdapterOptions,
  type FrameInit
} from "./embedded.js";
import type { RuntimeCapabilities } from "../runtime.js";

/**
 * vAmiga (cycle-exact Amiga emulator, C++ → WebAssembly) via the official vAmigaWeb host page.
 *
 * REAL EMULATION: vAmigaWeb runs the vAmiga core in its own iframe (video + Paula audio included).
 * RGME talks to it over the documented `postMessage` protocol (see vAmigaWeb `js/vAmiga_ui.js`):
 *   parent → frame : { cmd:"load", file_name, file:Uint8Array, kickstart_rom? }  (disk/ROM injection)
 *                    { cmd:"script", script }  ("wasm_reset()", "emit_joystick_cmd('2PULL_LEFT')")
 *                    "poll_state" | "button_run()" | "toggle_audio()"
 *   frame → parent : { msg:"render_run_state", value:boolean, is_warping }
 *                    { msg:"render_current_audio_state", value:"running"|"suspended" }
 *
 * No vAmiga binary is bundled; `baseUrl` can point at a self-hosted copy. Licence of the core: GPL-3.0.
 */
export const VAMIGAWEB_URL = "https://vamigaweb.github.io/";

export interface VAmigaWebAdapterOptions extends EmbeddedAdapterOptions {
  /** vAmigaWeb host page. Default: the official GitHub-Pages instance. */
  baseUrl?: string;
}

const VAMIGA_PORT = "2"; // Amiga games use the joystick in port 2 (mouse in port 1)
const JOY: Record<string, { down: string; up: string }> = {
  up: { down: "PULL_UP", up: "RELEASE_Y" },
  down: { down: "PULL_DOWN", up: "RELEASE_Y" },
  left: { down: "PULL_LEFT", up: "RELEASE_X" },
  right: { down: "PULL_RIGHT", up: "RELEASE_X" },
  fire: { down: "PRESS_FIRE", up: "RELEASE_FIRE" },
  fire2: { down: "PRESS_FIRE2", up: "RELEASE_FIRE2" }
};
/** Minimum gap between corrective `button_run()` toggles (core ignores them until ROMs are loaded). */
const TOGGLE_GAP_MS = 1200;

export class VAmigaWebAdapter extends EmbeddedEmulatorAdapter {
  protected readonly coreLabel = "vAmiga";
  protected readonly adapterId = "vamiga";
  protected readonly readyTimeoutDefaultMs = 25_000;
  private coreRunning = false;
  private audioState: "running" | "suspended" | "unknown" = "unknown";
  private lastToggle = 0;
  private readonly baseUrl: string;

  constructor(opts: VAmigaWebAdapterOptions) {
    super(opts);
    this.baseUrl = opts.baseUrl ?? VAMIGAWEB_URL;
  }

  identifyCapabilities(): RuntimeCapabilities {
    return this.capabilities("vAmiga (real emulator, via vAmigaWeb)");
  }

  /** The URL-fragment config understood by vAmigaWeb (`vAmiga_ui.js`). */
  static buildConfig(hasBringYourOwnRom: boolean): Record<string, unknown> {
    return {
      navbar: false,
      wide: false,
      border: false,
      port2: true,
      dialog_on_missing_roms: false,
      dialog_on_disk: false,
      // With a user Kickstart we inject it ourselves; otherwise use vAmigaWeb's open-source AROS ROMs.
      ...(hasBringYourOwnRom ? { wait_for_kickstart_injection: true } : { AROS: true })
    };
  }

  protected frameInit(): FrameInit {
    const config = encodeURIComponent(JSON.stringify(VAmigaWebAdapter.buildConfig(Boolean(this.opts.kickstartRom))));
    const base = this.baseUrl.endsWith("/") ? this.baseUrl : `${this.baseUrl}/`;
    this.coreRunning = false;
    this.audioState = "unknown";
    return { src: `${base}#${config}`, title: "vAmiga — Amiga emulator", allow: "autoplay; fullscreen; gamepad; clipboard-write" };
  }

  protected handleMessage(data: unknown): void {
    if (!data || typeof data !== "object") return;
    const msg = (data as { msg?: unknown }).msg;
    if (msg === "render_run_state") {
      this.coreRunning = Boolean((data as { value?: unknown }).value);
      if (!this.ready) {
        // First sign of life from the core: hand over the disk (and the user's Kickstart, if any).
        this.sendLoad(this.boot);
        this.markReady();
      }
      this.reconcileRun();
    } else if (msg === "render_current_audio_state") {
      const v = (data as { value?: unknown }).value;
      this.audioState = v === "running" ? "running" : "suspended";
      this.reconcileAudio();
    }
  }

  private sendLoad(boot: BootDisk | undefined): void {
    if (!boot) return;
    const message: Record<string, unknown> = { cmd: "load", file_name: boot.fileName, file: boot.bytes };
    if (this.opts.kickstartRom) message.kickstart_rom = this.opts.kickstartRom;
    this.postToFrame(message);
  }

  protected applyDisk(boot: BootDisk): void {
    // Disk swap: load message without ROM (the core is already running with its Kickstart).
    this.postToFrame({ cmd: "load", file_name: boot.fileName, file: boot.bytes });
  }

  protected applyRun(): void {
    this.reconcileRun(true);
  }

  private reconcileRun(force = false): void {
    if (!this.ready) return;
    if (this.coreRunning === this.wantRun) return;
    const now = Date.now();
    if (!force && now - this.lastToggle < TOGGLE_GAP_MS) return;
    this.lastToggle = now;
    this.postToFrame("button_run()");
  }

  protected applyReset(): void {
    this.postToFrame({ cmd: "script", script: "wasm_reset()" });
  }

  protected applyMute(): void {
    this.reconcileAudio();
  }

  private reconcileAudio(): void {
    if (!this.ready || this.audioState === "unknown") return;
    const wantRunning = !this.muted;
    if ((this.audioState === "running") !== wantRunning) this.postToFrame("toggle_audio()");
  }

  protected applyInput(action: string, down: boolean): void {
    const cmd = JOY[action];
    if (!cmd) return;
    this.postToFrame({ cmd: "script", script: `emit_joystick_cmd('${VAMIGA_PORT}${down ? cmd.down : cmd.up}');` });
  }

  protected override poll(): void {
    if (this.ready) this.postToFrame("poll_state");
  }
}
