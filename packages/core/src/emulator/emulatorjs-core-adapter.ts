import {
  EmbeddedEmulatorAdapter,
  type BootDisk,
  type EmbeddedAdapterOptions,
  type FrameInit
} from "./embedded.js";
import type { RuntimeCapabilities } from "../runtime.js";
import { createStoredZip } from "../zip/zip-writer.js";

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return typeof btoa === "function" ? btoa(binary) : Buffer.from(bytes).toString("base64");
}

/**
 * Real PUAE (P-UAE) Amiga emulation via the official EmulatorJS WebAssembly distribution (v4.2.3).
 *
 * Runs inside a same-origin `srcdoc` iframe. The iframe boots EmulatorJS with:
 *   - EJS_core = "amiga" (PUAE libretro core)
 *   - EJS_pathtodata = <dataUrl> (points to CDN with cores/puae-wasm.data, emulator.min.js)
 *   - EJS_gameUrl = blob URL to the ADF disk image
 *   - EJS_gameName = disk file name (must end with .adf so PUAE identifies it)
 *   - EJS_startOnLoaded = true
 *   - EJS_biosUrl = blob URL to the user Kickstart ROM (if supplied)
 *
 * No GPL binaries are vendored in RGME. The core and data files are fetched at runtime
 * from EmulatorJS's official CDN or a user-configured self-hosted server.
 */
export const DEFAULT_EJS_DATA_URL = "https://cdn.emulatorjs.org/stable/data/";

export interface EmulatorJsCoreAdapterOptions extends EmbeddedAdapterOptions {
  /** CDN or self-hosted directory containing loader.js, emulator.min.js, and cores/. */
  dataUrl?: string;
}

export class EmulatorJsCoreAdapter extends EmbeddedEmulatorAdapter {
  protected readonly coreLabel = "PUAE (EmulatorJS)";
  protected readonly adapterId = "puae";
  protected readonly readyTimeoutDefaultMs = 30_000;
  private readonly dataUrl: string;
  private blobUrls: string[] = [];

  constructor(opts: EmulatorJsCoreAdapterOptions) {
    super(opts);
    const u = opts.dataUrl ?? DEFAULT_EJS_DATA_URL;
    this.dataUrl = u.endsWith("/") ? u : `${u}/`;
  }

  identifyCapabilities(): RuntimeCapabilities {
    return this.capabilities("PUAE Amiga OCS/ECS (real emulator, via EmulatorJS)");
  }

  protected frameInit(boot: BootDisk): FrameInit {
    this.revokeBlobs();

    // Create blobs for the game ADF and optional Kickstart ROM
    let gameBlobUrl = "";
    try {
      const gameBlob = new Blob([boot.bytes as unknown as BlobPart], { type: "application/octet-stream" });
      gameBlobUrl = URL.createObjectURL(gameBlob);
      this.blobUrls.push(gameBlobUrl);
    } catch {
      gameBlobUrl = "";
    }

    let biosBlobUrl = "";
    let biosBase64: string | null = null;
    if (this.opts.kickstartRom) {
      try {
        const romData = this.opts.kickstartRom;
        biosBase64 = uint8ArrayToBase64(romData);
        // PUAE searches for specific Kickstart names depending on model (A500, A600, A1200, etc.)
        // By archiving under all canonical names, EmulatorJS extracts all of them into the system folder.
        const biosZip = createStoredZip([
          { name: "kick34005.A500", data: romData },
          { name: "kick40063.A600", data: romData },
          { name: "kick37175.A500", data: romData },
          { name: "kick40068.A1200", data: romData },
          { name: "kick39106.A4000", data: romData },
          { name: "kick.rom", data: romData }
        ]);
        const biosBlob = new Blob([biosZip as unknown as BlobPart], { type: "application/zip" });
        biosBlobUrl = URL.createObjectURL(biosBlob);
        this.blobUrls.push(biosBlobUrl);
      } catch {
        biosBlobUrl = "";
      }
    }

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    html, body, #game { width: 100%; height: 100%; margin: 0; padding: 0; overflow: hidden; background: #000; }
    /* Hide EmulatorJS outer chrome so it fits seamlessly inside the 1084S screen */
    .ejs_menu, .ejs_top_bar, .ejs_control_bar { opacity: 0.1; transition: opacity 0.2s; }
    .ejs_menu:hover, .ejs_top_bar:hover, .ejs_control_bar:hover { opacity: 1; }
  </style>
</head>
<body>
  <div id="game"></div>
  <script>
    window.EJS_player = '#game';
    window.EJS_core = 'amiga';
    window.EJS_pathtodata = ${JSON.stringify(this.dataUrl)};
    window.EJS_gameUrl = ${JSON.stringify(gameBlobUrl)};
    window.EJS_gameName = ${JSON.stringify(boot.fileName)};
    window.EJS_startOnLoaded = true;
    ${biosBlobUrl ? `window.EJS_biosUrl = ${JSON.stringify(biosBlobUrl)};` : ""}
    window.EJS_onGameStart = function() {
      window.parent.postMessage({ rgme: "ejs", type: "started" }, "*");
    };

    // Direct FS injection of Kickstart ROM into Emscripten filesystem
    var kickstartBase64 = ${JSON.stringify(biosBase64)};
    if (kickstartBase64) {
      var injectBios = function() {
        var fs = (window.Module && window.Module.FS) || (window.EJS_emulator && window.EJS_emulator.gameManager && window.EJS_emulator.gameManager.FS);
        if (!fs) return false;
        try {
          var raw = atob(kickstartBase64);
          var u8 = new Uint8Array(raw.length);
          for (var i = 0; i < raw.length; i++) u8[i] = raw.charCodeAt(i);
          var names = ['kick34005.A500', 'kick40063.A600', 'kick37175.A500', 'kick40068.A1200', 'kick39106.A4000', 'kick.rom'];
          for (var j = 0; j < names.length; j++) {
            var n = names[j];
            try { fs.writeFile('/' + n, u8); } catch(e) {}
            try { fs.writeFile('/system/' + n, u8); } catch(e) {}
            try { fs.writeFile('/home/web_user/retroarch/userdata/system/' + n, u8); } catch(e) {}
          }
          return true;
        } catch(e) {
          return false;
        }
      };
      var biosInterval = setInterval(function() {
        if (injectBios()) clearInterval(biosInterval);
      }, 100);
      setTimeout(function() { clearInterval(biosInterval); }, 15000);
    }

    window.addEventListener("message", function(e) {
      if (!e.data || e.data.rgme !== "ejs_cmd") return;
      var emu = window.EJS_emulator;
      if (!emu) return;
      if (e.data.cmd === "pause") {
        if (typeof emu.pause === "function") emu.pause();
      } else if (e.data.cmd === "play") {
        if (typeof emu.play === "function") emu.play();
      } else if (e.data.cmd === "restart") {
        if (typeof emu.restart === "function") emu.restart();
      } else if (e.data.cmd === "setVolume") {
        if (typeof emu.setVolume === "function") emu.setVolume(e.data.volume);
      }
    });
  <\/script>
  <script src="${this.dataUrl}loader.js"><\/script>
</body>
</html>`;

    return {
      srcdoc: html,
      title: "PUAE — Amiga emulator (EmulatorJS)",
      allow: "autoplay; fullscreen; gamepad"
    };
  }

  protected handleMessage(data: unknown): void {
    if (!data || typeof data !== "object") return;
    const msg = data as { rgme?: string; type?: string };
    if (msg.rgme === "ejs" && msg.type === "started") {
      this.markReady();
    }
  }

  protected applyRun(run: boolean): void {
    this.postToFrame({ rgme: "ejs_cmd", cmd: run ? "play" : "pause" });
  }

  protected applyReset(): void {
    this.postToFrame({ rgme: "ejs_cmd", cmd: "restart" });
  }

  protected applyMute(muted: boolean): void {
    this.postToFrame({ rgme: "ejs_cmd", cmd: "setVolume", volume: muted ? 0 : 1.0 });
  }

  protected applyInput(_action: string, _down: boolean): void {
    // EmulatorJS captures standard keyboard events directly via the browser canvas inside the iframe
  }

  protected applyDisk(_boot: BootDisk): void {
    // Disk changes in PUAE under EmulatorJS require restarting with the new disk
    this.loadGame(this.profile!);
  }

  protected override cleanupCore(): void {
    this.revokeBlobs();
  }

  private revokeBlobs(): void {
    for (const url of this.blobUrls) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        /* ignore */
      }
    }
    this.blobUrls = [];
  }
}
