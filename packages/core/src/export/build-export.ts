import { RightsPolicyEngine, type PolicyDecision, type RightsRecord } from "../rights.js";
import type { GameProfile } from "../profile.js";
import { PLAYER_JS } from "./player-bundle.generated.js";

export type ExportMode = "player" | "byog";

export interface ExportFile {
  path: string;
  data: Uint8Array | string;
  mime: string;
}

export interface ExportGate {
  mode: ExportMode;
  /** Most restrictive of the two gating decisions. */
  decision: PolicyDecision;
  redistribution: PolicyDecision;
  hosting: PolicyDecision;
  reason: string;
}

export interface ExportResult extends ExportGate {
  slug: string;
  files: ExportFile[];
}

export interface BuildExportInput {
  profile: GameProfile;
  rights: RightsRecord;
  /** Original media bytes. Only ever embedded in player mode; never modified. */
  media?: Uint8Array;
}

const engine = new RightsPolicyEngine();
const RANK = { allow: 0, local_only: 1, review: 2, deny: 3 } as const;

export function slugOf(profile: GameProfile): string {
  return profile.id.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "game";
}

/** The hard rights gate: a self-contained player requires explicit, evidenced permission for BOTH redistribution and browser hosting. */
export function evaluateExportGate(rights: RightsRecord): ExportGate {
  const redistribution = engine.evaluateAction(rights, { action: "binary_redistribution" });
  const hosting = engine.evaluateAction(rights, { action: "browser_hosting" });
  const decision = RANK[hosting.decision] > RANK[redistribution.decision] ? hosting : redistribution;
  const ok = redistribution.decision === "allow" && hosting.decision === "allow";
  return {
    mode: ok ? "player" : "byog",
    decision,
    redistribution,
    hosting,
    reason: ok
      ? "Redistribution and browser hosting are explicitly permitted with evidence: a portable player with the disk embedded is allowed."
      : `Not cleared for redistribution (redistribution: ${redistribution.decision}, hosting: ${hosting.decision}; ${decision.reasonCodes.join(", ")}). Exporting a BYOG package without any game data.`
  };
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const d = new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", bytes as unknown as ArrayBuffer));
  return Array.from(d, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode(...bytes.subarray(i, i + CH));
  return btoa(bin);
}

/** Minimal YAML emitter for JSON-compatible data (JSON strings are valid YAML double-quoted scalars). */
export function toYaml(value: unknown, indent = 0): string {
  const pad = "  ".repeat(indent);
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return value
      .map((v) => {
        const isObj = v !== null && typeof v === "object";
        return isObj && !(Array.isArray(v) && v.length === 0) && Object.keys(v as object).length > 0
          ? `${pad}-\n${toYaml(v, indent + 1)}`
          : `${pad}- ${scalar(v)}`;
      })
      .join("\n");
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return "{}";
    return entries
      .map(([k, v]) => {
        const nested = v !== null && typeof v === "object" && (Array.isArray(v) ? v.length > 0 : Object.keys(v).length > 0);
        return nested ? `${pad}${k}:\n${toYaml(v, indent + 1)}` : `${pad}${k}: ${scalar(v)}`;
      })
      .join("\n");
  }
  return `${pad}${scalar(value)}`;
}
function scalar(v: unknown): string {
  if (Array.isArray(v)) return "[]";
  if (v !== null && typeof v === "object") return "{}";
  return v === null ? "null" : typeof v === "string" ? JSON.stringify(v) : String(v);
}

const jsonForScript = (o: unknown) => JSON.stringify(o).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const scriptSafe = (js: string) => js.replace(/<\/script/gi, "<\\/script").replace(/<!--/g, "<\\!--");

interface HtmlOpts {
  profile: GameProfile;
  rights: RightsRecord;
  gate: ExportGate;
  mode: ExportMode;
  mediaBase64?: string;
  mediaSize?: number;
}

function renderHtml(o: HtmlOpts): string {
  const m = o.profile.media.find((x) => x.id === o.profile.launch.bootMediaId) ?? o.profile.media[0]!;
  const manifest = {
    mode: o.mode,
    title: o.profile.title,
    media: { filename: m.filename, sha256: m.sha256.toLowerCase(), size: o.mediaSize ?? 0 },
    profile: o.profile
  };
  const license = o.rights.notes?.[0] ?? "No license text recorded";
  const holder = o.rights.copyright?.currentHolder ?? "unknown";
  const byog = o.mode === "byog";
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(o.profile.title)} — RGME ${byog ? "BYOG player" : "portable player"}</title>
<style>
:root{--bg:#090a0f;--fg:#f0f3fc;--mut:#9da8c3;--ok:#10b981;--warn:#f59e0b;--blue:#3d5afe}
body{margin:0;background:var(--bg);color:var(--fg);font:16px system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;gap:12px;padding:16px}
canvas{background:#000;image-rendering:pixelated;border:1px solid #242a3d;max-width:100%}
button{background:#1a1e2c;color:var(--fg);border:1px solid #242a3d;border-radius:4px;padding:8px 14px;cursor:pointer}button:disabled{opacity:.5;cursor:default}
.hud{display:grid;grid-template-columns:repeat(3,36px);gap:4px}.hud span,.fire span{display:flex;align-items:center;justify-content:center;height:36px;border:1px solid #242a3d;border-radius:4px;color:var(--mut)}
[data-on=true]{background:#ff8800;color:#000!important}
#drop{border:2px dashed #3d5afe;padding:24px;border-radius:6px;color:var(--mut);text-align:center}
footer{max-width:640px;color:var(--mut);font-size:13px;border-top:1px solid #242a3d;padding-top:10px}
code{font-family:"Courier New",monospace}.badge{color:${byog ? "var(--warn)" : "var(--ok)"}}
</style></head><body>
<h1 style="font-size:20px;margin:0">${esc(o.profile.title)}</h1>
<canvas id="screen" width="320" height="256"></canvas>
${byog ? `<div id="drop">Bring your own disk: drop <code>${esc(m.filename)}</code> here or <input type="file" id="file" accept=".adf,.d64,.rom,.bin,.md"><br>It is verified against the expected SHA-256 and runs locally only; nothing is uploaded.</div>` : ""}
<div style="display:flex;gap:16px;align-items:center"><button id="start" disabled>Start</button>
<div class="hud"><span></span><span data-act="up">▲</span><span></span><span data-act="left">◀</span><span data-act="down">▼</span><span data-act="right">▶</span></div>
<div class="fire"><span data-act="fire" style="width:64px">FIRE</span></div></div>
<div id="status" aria-live="polite" style="color:var(--mut)">${byog ? "Waiting for your disk…" : "Verifying embedded disk…"}</div>
<footer><div class="badge"><strong>${byog ? "BYOG package — no game data included" : "Cleared for redistribution"}</strong></div>
<div>Rights holder: ${esc(holder)} · Class ${esc(o.rights.classification)} · Status: ${esc(o.rights.status)}</div>
<div>License / provenance: ${esc(license)}</div>
<div>${esc(o.gate.reason)}</div>
<div>Media sha256: <code>${esc(m.sha256.toLowerCase())}</code></div>
<div>Rendered by RGME (Retro Game Modernization Engine) — original content is never modified.</div></footer>
<script type="application/json" id="rgme-manifest">${jsonForScript(manifest)}</script>
${byog ? "" : `<script type="text/plain" id="rgme-media">${o.mediaBase64}</script>`}
<script>${scriptSafe(PLAYER_JS)}</script>
</body></html>
`;
}

/** Builds either a single-file portable player (cleared titles) or a BYOG package (everything else). */
export async function buildExport(input: BuildExportInput): Promise<ExportResult> {
  const { profile, rights } = input;
  const gate = evaluateExportGate(rights);
  const slug = slugOf(profile);
  const boot = profile.media.find((x) => x.id === profile.launch.bootMediaId) ?? profile.media[0]!;

  if (gate.mode === "player") {
    if (!input.media) throw new Error("Cleared export needs the original media bytes");
    const actual = await sha256Hex(input.media);
    if (actual !== boot.sha256.toLowerCase()) {
      throw new Error(`Media hash mismatch: profile expects ${boot.sha256}, got ${actual}`);
    }
    const html = renderHtml({ profile, rights, gate, mode: "player", mediaBase64: bytesToBase64(input.media), mediaSize: input.media.length });
    return { ...gate, slug, files: [{ path: `${slug}.html`, data: html, mime: "text/html" }] };
  }

  // BYOG: the media argument is deliberately ignored.
  const dir = `${slug}.byog`;
  const manifest = { schema: "rgme.byog/v0.1", slug, title: profile.title, media: { filename: boot.filename, sha256: boot.sha256.toLowerCase() } };
  const readme = [
    `${profile.title} — RGME BYOG package`,
    "",
    "This package contains NO game data. Rights are not verified for redistribution,",
    "so you must bring your own legally obtained copy of the disk.",
    "",
    `Expected file : ${boot.filename}`,
    `Expected sha256: ${boot.sha256.toLowerCase()}`,
    "",
    `1. Open ${slug}-byog-player.html in a modern browser.`,
    "2. Drop your disk image onto the page. It is hashed locally and refused if it does not match.",
    "3. Playback is local only; nothing is uploaded.",
    "",
    `Why: ${gate.reason}`,
    ""
  ].join("\n");
  const files: ExportFile[] = [
    { path: `${dir}/README.txt`, data: readme, mime: "text/plain" },
    { path: `${dir}/game-profile.yaml`, data: toYaml(profile) + "\n", mime: "text/yaml" },
    { path: `${dir}/rights.json`, data: JSON.stringify({ record: rights, decision: gate.decision, redistribution: gate.redistribution, hosting: gate.hosting, reason: gate.reason }, null, 2) + "\n", mime: "application/json" },
    { path: `${dir}/manifest.json`, data: JSON.stringify(manifest, null, 2) + "\n", mime: "application/json" },
    { path: `${dir}/${slug}-byog-player.html`, data: renderHtml({ profile, rights, gate, mode: "byog" }), mime: "text/html" }
  ];
  return { ...gate, slug, files };
}
