import { normalizeTitle } from "@rgme/core";

export interface M3uEntry {
  path: string;
  filename: string;
  title: string;
  /** 1-based disk number; letters (A=1) are converted. */
  discNumber?: number;
  discTotal?: number;
}

export interface DiskSet {
  key: string;
  title: string;
  entries: M3uEntry[];
  /** Disk numbers missing between 1 and the highest number / declared total. */
  missing: number[];
  /** Disk numbers that appear more than once. */
  duplicates: number[];
  total?: number;
}

const WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };

/** Detects "Disk 1 of 11", "Disk1", "Disc 2", "(Disk A)" in a file name. */
export function detectDisc(name: string): { number?: number; total?: number } {
  const base = name.replace(/\.[a-z0-9]{2,4}$/i, "");
  const m = /\b(?:disk|disc)[\s_.-]*(\d{1,3}|[a-z])(?:[\s_.-]*(?:of|von|\/)[\s_.-]*(\d{1,3}))?\b/i.exec(base);
  if (!m) return {};
  const raw = m[1]!.toLowerCase();
  const number = /^\d+$/.test(raw) ? Number(raw) : (WORDS[raw] ?? raw.charCodeAt(0) - 96);
  return { number: number >= 1 ? number : undefined, total: m[2] ? Number(m[2]) : undefined };
}

const stripDisc = (name: string) =>
  name
    .replace(/\.[a-z0-9]{2,4}$/i, "")
    .replace(/[\[(]?\b(?:disk|disc)[\s_.-]*(?:\d{1,3}|[a-z])(?:[\s_.-]*(?:of|von|\/)[\s_.-]*\d{1,3})?\b[\])]?/gi, " ");

export function parseM3u(text: string, opts: { baseName?: string } = {}): M3uEntry[] {
  const lines = text.replace(/^﻿/, "").split(/\r\n|\r|\n/);
  const out: M3uEntry[] = [];
  let pendingTitle: string | undefined;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.toUpperCase() === "#EXTM3U") continue;
    if (line.startsWith("#EXTINF:")) {
      const comma = line.indexOf(",");
      pendingTitle = comma >= 0 ? line.slice(comma + 1).trim() || undefined : undefined;
      continue;
    }
    if (line.startsWith("#")) continue;
    const path = line.replace(/\\/g, "/");
    const filename = decodeSafe(path.split(/[?#]/)[0]!.split("/").pop() ?? path);
    const d = detectDisc(pendingTitle ?? filename);
    const d2 = d.number === undefined ? detectDisc(filename) : d;
    out.push({
      path,
      filename,
      title: pendingTitle ?? filename.replace(/\.[a-z0-9]{2,4}$/i, ""),
      discNumber: d2.number,
      discTotal: d2.total ?? d.total
    });
    pendingTitle = undefined;
  }
  if (opts.baseName && out.length > 0 && out.every((e) => e.discNumber === undefined)) {
    // Plain list without disk numbers: keep playlist order as disk order.
    out.forEach((e, i) => { e.discNumber = i + 1; e.discTotal = out.length; });
  }
  return out;
}

function decodeSafe(s: string) {
  try { return decodeURIComponent(s); } catch { return s; }
}

export function groupDiskSets(entries: readonly M3uEntry[]): DiskSet[] {
  const groups = new Map<string, M3uEntry[]>();
  for (const e of entries) {
    const key = normalizeTitle(stripDisc(e.filename)) || normalizeTitle(e.filename);
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(e);
  }
  return [...groups].map(([key, list]) => {
    const sorted = [...list].sort((a, b) => (a.discNumber ?? 1e9) - (b.discNumber ?? 1e9));
    const nums = sorted.map((e) => e.discNumber).filter((n): n is number => n !== undefined);
    const total = Math.max(0, ...sorted.map((e) => e.discTotal ?? 0)) || undefined;
    const top = Math.max(total ?? 0, ...nums, 0);
    const seen = new Set<number>();
    const duplicates = new Set<number>();
    for (const n of nums) (seen.has(n) ? duplicates : seen).add(n);
    const missing: number[] = [];
    if (nums.length > 0) for (let i = 1; i <= top; i++) if (!seen.has(i)) missing.push(i);
    const title = stripDisc(sorted[0]!.filename).replace(/[_]+/g, " ").replace(/\s+/g, " ").replace(/[\s([-]+$/, "").trim() || sorted[0]!.title;
    return { key, title, entries: sorted, missing, duplicates: [...duplicates].sort((a, b) => a - b), total };
  });
}

export function serializeM3u(entries: readonly M3uEntry[]): string {
  return ["#EXTM3U", ...entries.flatMap((e) => [`#EXTINF:-1,${e.title}`, e.path])].join("\n") + "\n";
}

/** Helper for the App: parse text and return grouped disk sets. */
export function loadM3uText(text: string, baseName?: string): DiskSet[] {
  return groupDiskSets(parseM3u(text, { baseName }));
}
