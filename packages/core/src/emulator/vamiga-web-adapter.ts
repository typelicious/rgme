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
 * Pinned local core is preferred for zero-network offline execution and elimination of third-party modal alerts.
 * Licence of the core: GPL-3.0.
 */
export const PINNED_VAMIGA_URL = "/cores/vamiga/index.html";
export const REMOTE_VAMIGA_URL = "https://vamigaweb.github.io/";
export const VAMIGAWEB_URL = PINNED_VAMIGA_URL;

export interface VAmigaWebAdapterOptions extends EmbeddedAdapterOptions {
  /** vAmiga host page. Default: pinned local core (/cores/vamiga/index.html). */
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
    const isPinned = !this.baseUrl.startsWith("http://") && !this.baseUrl.startsWith("https://");
    return this.capabilities(
      isPinned ? "vAmiga (real emulator, pinned local)" : "vAmiga (real emulator, via vAmigaWeb)"
    );
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
      AROS: !hasBringYourOwnRom,
      openROMS: !hasBringYourOwnRom,
      ...(hasBringYourOwnRom ? { wait_for_kickstart_injection: true } : {})
    };
  }

  protected frameInit(): FrameInit {
    const config = encodeURIComponent(JSON.stringify(VAmigaWebAdapter.buildConfig(Boolean(this.opts.kickstartRom))));
    const base = this.baseUrl.endsWith(".html") || this.baseUrl.endsWith(".htm") || this.baseUrl.endsWith("/")
      ? this.baseUrl
      : `${this.baseUrl}/`;
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
        this.markReady();
        this.sendLoad(this.boot);
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
    // Prepare frame environment: bypass drive select modal and mount DF0 directly
    this.postToFrame({
      cmd: "script",
      script: `
        try {
          parameter_link_mount_in_df0 = true;
          df_mount_list = [${JSON.stringify(boot.fileName)}];
        } catch(e) {}
      `
    });

    const message: Record<string, unknown> = { cmd: "load", file_name: boot.fileName, file: boot.bytes };
    if (this.opts.kickstartRom) message.kickstart_rom = this.opts.kickstartRom;
    this.postToFrame(message);

    // Ensure DF0 insertion, dismiss any open config/rom modals, and start running
    this.postToFrame({
      cmd: "script",
      script: `
        try {
          if (typeof insert_file === 'function') insert_file(0);
          if (typeof show_drive_select === 'function') show_drive_select(false);
          $('#modal_roms').modal('hide');
          $('#modal_settings').modal('hide');
          $('#modal_file_slot').modal('hide');
          if (!is_running() && typeof app !== 'undefined' && app.button_run_click) {
            app.button_run_click();
          }
        } catch(e) {}
      `
    });
  }

  protected applyDisk(boot: BootDisk): void {
    // Disk swap: load message into DF0 and dismiss dialogs
    this.postToFrame({
      cmd: "script",
      script: `
        try {
          parameter_link_mount_in_df0 = true;
          df_mount_list = [${JSON.stringify(boot.fileName)}];
        } catch(e) {}
      `
    });
    this.postToFrame({ cmd: "load", file_name: boot.fileName, file: boot.bytes });
    this.postToFrame({
      cmd: "script",
      script: `
        try {
          if (typeof insert_file === 'function') insert_file(0);
          if (typeof show_drive_select === 'function') show_drive_select(false);
          $('#modal_roms').modal('hide');
          $('#modal_file_slot').modal('hide');
        } catch(e) {}
      `
    });
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
    // ALWAYS poll: before ready to establish connection, and after ready to track running state
    this.postToFrame("poll_state");
  }
}
