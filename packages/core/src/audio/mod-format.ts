/** ProTracker / SoundTracker 4-channel module parsing. Pure data, no audio dependency. */

/** Paula colour-clock based constant: Paula plays a sample at PAL_CLOCK / period Hz (== 7,093,790 / (2 * period)). */
export const PAL_CLOCK = 3546895;

export const MIN_PERIOD = 113;
export const MAX_PERIOD = 856;

const T = (s: string) => s.split(/[\s,]+/).filter(Boolean).map(Number);

/** Standard ProTracker period table: index 0..7 = finetune 0..+7, index 8..15 = finetune -8..-1. 36 notes (C-1..B-3) each. */
export const PERIOD_TABLE: readonly (readonly number[])[] = [
  T("856,808,762,720,678,640,604,570,538,508,480,453, 428,404,381,360,339,320,302,285,269,254,240,226, 214,202,190,180,170,160,151,143,135,127,120,113"),
  T("850,802,757,715,674,637,601,567,535,505,477,450, 425,401,379,357,337,318,300,284,268,253,239,225, 213,201,189,179,169,159,150,142,134,126,119,113"),
  T("844,796,752,709,670,632,597,563,532,502,474,447, 422,398,376,355,335,316,298,282,266,251,237,224, 211,199,188,177,167,158,149,141,133,125,118,112"),
  T("838,791,746,704,665,628,592,559,528,498,470,444, 419,395,373,352,332,314,296,280,264,249,235,222, 209,198,187,176,166,157,148,140,132,125,118,111"),
  T("832,785,741,699,660,623,588,555,524,495,467,441, 416,392,370,350,330,312,294,278,262,247,233,220, 208,196,185,175,165,156,147,139,131,124,117,110"),
  T("826,779,736,694,655,619,584,551,520,491,463,437, 413,390,368,347,328,309,292,276,260,245,232,219, 206,195,184,174,164,155,146,138,130,123,116,109"),
  T("820,774,730,689,651,614,580,547,516,487,460,434, 410,387,365,345,325,307,290,274,258,244,230,217, 205,193,183,172,163,154,145,137,129,122,115,109"),
  T("814,768,725,684,646,610,575,543,513,484,457,431, 407,384,363,342,323,305,288,272,256,242,228,216, 204,192,181,171,161,152,144,136,128,121,114,108"),
  T("907,856,808,762,720,678,640,604,570,538,508,480, 453,428,404,381,360,339,320,302,285,269,254,240, 226,214,202,190,180,170,160,151,143,135,127,120"),
  T("900,850,802,757,715,675,636,601,567,535,505,477, 450,425,401,379,357,337,318,300,284,268,253,239, 225,213,201,189,179,169,159,150,142,134,126,119"),
  T("894,844,796,752,709,670,632,597,563,532,502,474, 447,422,398,376,355,335,316,298,282,266,251,237, 224,211,199,188,177,167,158,149,141,133,125,118"),
  T("887,838,791,746,704,665,628,592,559,528,498,470, 444,419,395,373,352,332,314,296,280,264,249,235, 222,209,198,187,176,166,157,148,140,132,125,118"),
  T("881,832,785,741,699,660,623,588,555,524,495,467, 441,416,392,370,350,330,312,294,278,262,247,233, 220,208,196,185,175,165,156,147,139,131,123,117"),
  T("875,826,779,736,694,655,619,584,551,520,491,463, 437,413,390,368,347,328,309,292,276,260,245,232, 219,206,195,184,174,164,155,146,138,130,123,116"),
  T("868,820,774,730,689,651,614,580,547,516,487,460, 434,410,387,365,345,325,307,290,274,258,244,230, 217,205,193,183,172,163,154,145,137,129,122,115"),
  T("862,814,768,725,684,646,610,575,543,513,484,457, 431,407,384,363,342,323,305,288,272,256,242,228, 216,204,192,181,171,161,152,144,136,128,121,114")
];

/** Sample playback rate in Hz for a Paula period. C-2 (period 428) plays at 8287 Hz. */
export function periodToHz(period: number): number {
  return period > 0 ? PAL_CLOCK / period : 0;
}

/** Finetune nibble (0..15, two's complement) -> table row index (0..7 = 0..+7, 8..15 = -8..-1). The nibble IS the row index. */
export function finetuneRow(finetuneNibble: number): number {
  return finetuneNibble & 15;
}

/** Index in the finetune-0 table closest to a period, or -1 for period 0. */
export function noteIndex(period: number): number {
  if (period <= 0) return -1;
  let best = 0;
  let bestD = Infinity;
  PERIOD_TABLE[0]!.forEach((p, i) => {
    const d = Math.abs(p - period);
    if (d < bestD) { bestD = d; best = i; }
  });
  return best;
}

const NAMES = ["C-", "C#", "D-", "D#", "E-", "F-", "F#", "G-", "G#", "A-", "A#", "B-"];
/** ProTracker note name (C-1..B-3); 0 => "---". Uses the nearest finetune-0 period. */
export function noteName(period: number): string {
  const i = noteIndex(period);
  if (i < 0) return "---";
  return `${NAMES[i % 12]}${1 + Math.floor(i / 12)}`;
}

export class ModError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModError";
  }
}

export interface ModSample {
  name: string;
  /** bytes */
  length: number;
  /** signed nibble -8..7 */
  finetune: number;
  /** 0..64 */
  volume: number;
  /** bytes */
  repeatStart: number;
  /** bytes; loops only when > 2 */
  repeatLength: number;
  data: Int8Array;
}

export interface ModNote {
  sample: number;
  period: number;
  effect: number;
  param: number;
}

export interface ModModule {
  title: string;
  signature: string;
  samples: ModSample[];
  songLength: number;
  restart: number;
  orders: number[];
  /** patterns[p][row][channel] */
  patterns: ModNote[][][];
  /** true when sample data was shorter than the headers promise (padded with silence). */
  truncated: boolean;
}

const OK_SIGNATURES = new Set(["M.K.", "4CHN", "M!K!"]);

const text = (b: Uint8Array, off: number, len: number) => {
  let s = "";
  for (let i = 0; i < len; i++) {
    const c = b[off + i]!;
    if (c === 0) break;
    s += c >= 32 && c < 127 ? String.fromCharCode(c) : " ";
  }
  return s.trimEnd();
};

export function parseMod(bytes: Uint8Array): ModModule {
  if (bytes.length < 1084) {
    throw new ModError(
      bytes.length >= 600 ? "Legacy 15-sample SoundTracker modules are not supported (no 31-sample header)." : "File too small to be a ProTracker module."
    );
  }
  const signature = String.fromCharCode(bytes[1080]!, bytes[1081]!, bytes[1082]!, bytes[1083]!);
  if (!OK_SIGNATURES.has(signature)) {
    if (signature === "FLT4" || signature === "FLT8") throw new ModError(`Unsupported module signature '${signature}' (Startrekker is not supported).`);
    if (/^\d(CHN|CH)$|^\d\dCH$|^(OCTA|CD81|TDZ\d|FA0\d)/.test(signature)) throw new ModError(`Unsupported module signature '${signature}': only 4-channel modules (M.K., 4CHN, M!K!) are supported.`);
    throw new ModError(`Unknown module signature '${JSON.stringify(signature)}': not a 31-sample ProTracker module (legacy 15-sample modules are unsupported).`);
  }

  const title = text(bytes, 0, 20);
  const samples: ModSample[] = [];
  for (let i = 0; i < 31; i++) {
    const o = 20 + i * 30;
    const word = (k: number) => (bytes[o + k]! << 8) | bytes[o + k + 1]!;
    const ft = bytes[o + 24]! & 15;
    samples.push({
      name: text(bytes, o, 22),
      length: word(22) * 2,
      finetune: ft > 7 ? ft - 16 : ft,
      volume: Math.min(64, bytes[o + 25]!),
      repeatStart: word(26) * 2,
      repeatLength: word(28) * 2,
      data: new Int8Array(0)
    });
  }

  const songLength = bytes[950]!;
  if (songLength < 1 || songLength > 128) throw new ModError(`Invalid song length ${songLength} (expected 1..128).`);
  const restart = bytes[951]!;
  const orders = Array.from(bytes.subarray(952, 952 + 128));
  const patternCount = Math.max(...orders) + 1;
  const patternBytes = patternCount * 64 * 4 * 4;
  if (1084 + patternBytes > bytes.length) throw new ModError(`File truncated: ${patternCount} patterns need ${patternBytes} bytes of pattern data.`);

  const patterns: ModNote[][][] = [];
  let off = 1084;
  for (let p = 0; p < patternCount; p++) {
    const rows: ModNote[][] = [];
    for (let r = 0; r < 64; r++) {
      const row: ModNote[] = [];
      for (let c = 0; c < 4; c++) {
        const b0 = bytes[off]!, b1 = bytes[off + 1]!, b2 = bytes[off + 2]!, b3 = bytes[off + 3]!;
        off += 4;
        row.push({ sample: (b0 & 0xf0) | (b2 >> 4), period: ((b0 & 0x0f) << 8) | b1, effect: b2 & 15, param: b3 });
      }
      rows.push(row);
    }
    patterns.push(rows);
  }

  let truncated = false;
  for (const s of samples) {
    const avail = Math.max(0, Math.min(s.length, bytes.length - off));
    if (avail < s.length) truncated = true;
    const data = new Int8Array(s.length);
    for (let i = 0; i < avail; i++) data[i] = (bytes[off + i]! << 24) >> 24;
    s.data = data;
    off += s.length;
  }

  return { title, signature, samples, songLength, restart, orders, patterns, truncated };
}
