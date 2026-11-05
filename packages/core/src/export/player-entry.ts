/* Standalone player entry. Bundled by scripts/build-player.mjs into player-bundle.generated.ts and inlined into exported HTML. Runs in the browser only. */
import { MockRuntimeAdapter } from "../mock-runtime.js";
import { ChiptunePlayer, createBrowserAudioContext } from "../chiptune.js";
import type { GameProfile } from "../profile.js";

interface Manifest {
  mode: "player" | "byog";
  title: string;
  media: { filename: string; sha256: string; size: number };
  profile: GameProfile;
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

async function sha256Hex(bytes: Uint8Array): Promise<string | undefined> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return undefined;
  const d = new Uint8Array(await subtle.digest("SHA-256", bytes as unknown as ArrayBuffer));
  return Array.from(d, (b) => b.toString(16).padStart(2, "0")).join("");
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64.replace(/\s+/g, ""));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function main() {
  const manifest = JSON.parse($("rgme-manifest").textContent ?? "{}") as Manifest;
  const canvas = $<HTMLCanvasElement>("screen");
  const status = $("status");
  const startBtn = $<HTMLButtonElement>("start");
  const pressed = new Set<string>();
  const audio = new ChiptunePlayer(createBrowserAudioContext);
  const adapter = new MockRuntimeAdapter(canvas, undefined, audio);
  let loaded = false;

  const scale = () => {
    const s = Math.max(1, Math.floor(Math.min((window.innerWidth * 0.92) / 320, (window.innerHeight * 0.6) / 240)));
    canvas.style.width = `${320 * s}px`;
    canvas.style.height = `${240 * s}px`;
  };
  scale();
  window.addEventListener("resize", scale);

  const hud = () => {
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("[data-act]"))) {
      el.dataset.on = String(pressed.has(el.dataset.act!));
    }
  };
  const press = (act: string, down: boolean) => {
    if (down) pressed.add(act);
    else pressed.delete(act);
    adapter.pressInput(act, down);
    hud();
  };
  const keymap = manifest.profile.input.keyboard as Record<string, string>;
  const key = (down: boolean) => (e: KeyboardEvent) => {
    const act = keymap[e.code];
    if (!act) return;
    e.preventDefault();
    if (down && e.repeat) return;
    press(act, down);
  };
  window.addEventListener("keydown", key(true));
  window.addEventListener("keyup", key(false));

  async function mount(bytes: Uint8Array, verifiedAtExport: boolean): Promise<boolean> {
    const h = await sha256Hex(bytes);
    if (h === undefined) {
      if (!verifiedAtExport) {
        status.textContent = "Cannot verify this disk here (Web Crypto unavailable). Refusing to run.";
        return false;
      }
      status.textContent = "Hash check unavailable in this context; media was verified when exported.";
    } else if (h !== manifest.media.sha256.toLowerCase()) {
      status.textContent = `Hash MISMATCH — expected ${manifest.media.sha256.slice(0, 16)}…, got ${h.slice(0, 16)}…. Refusing to run.`;
      return false;
    } else {
      status.textContent = `Disk verified: sha256 ${h.slice(0, 16)}… matches.`;
    }
    await adapter.loadGame(manifest.profile);
    loaded = true;
    startBtn.disabled = false;
    return true;
  }

  startBtn.addEventListener("click", () => {
    if (!loaded) return;
    if (adapter.state === "RUNNING") {
      adapter.pause();
      startBtn.textContent = "Resume";
    } else {
      adapter.start();
      startBtn.textContent = "Pause";
    }
  });

  if (manifest.mode === "player") {
    const b64 = $("rgme-media").textContent ?? "";
    void mount(b64ToBytes(b64), true);
  } else {
    const zone = $("drop");
    const input = $<HTMLInputElement>("file");
    const take = async (f: File | undefined) => {
      if (!f) return;
      await mount(new Uint8Array(await f.arrayBuffer()), false);
    };
    zone.addEventListener("dragover", (e) => e.preventDefault());
    zone.addEventListener("drop", (e) => {
      e.preventDefault();
      void take(e.dataTransfer?.files?.[0]);
    });
    input.addEventListener("change", () => void take(input.files?.[0]));
  }
}

main();
