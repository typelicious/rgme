import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  ADF_SIZE, FloppyController, IpfParser, IpfProtectedError, TRACKS, TRACK_BYTES, crc32, decodeAmigaTrack, encodeAmigaTrack,
  identifyImage, mfmEncodeBytes, mountDiskImage
} from "../index.js";

const adf = new Uint8Array(readFileSync(fileURLToPath(new URL("../../../../concept/fixtures/rgme-scene-intro.adf", import.meta.url))));
const trackSectors = (a: Uint8Array, t: number) => Array.from({ length: 11 }, (_, s) => a.slice((t * 11 + s) * 512, (t * 11 + s + 1) * 512));

// ---------- synthetic IPF writer (documents the supported subset; see ipf-parser.ts) ----------
const u32 = (...v: number[]) => { const b = new Uint8Array(v.length * 4); const d = new DataView(b.buffer); v.forEach((x, i) => d.setUint32(i * 4, x >>> 0)); return b; };
const cat = (...p: Uint8Array[]) => { const o = new Uint8Array(p.reduce((n, x) => n + x.length, 0)); let off = 0; for (const x of p) { o.set(x, off); off += x.length; } return o; };
const ascii = (s: string) => Uint8Array.from([...s].map((c) => c.charCodeAt(0)));
function record(type: string, payload: Uint8Array): Uint8Array {
  const rec = cat(ascii(type), u32(12 + payload.length, 0), payload);
  new DataView(rec.buffer).setUint32(8, crc32(rec));
  return rec;
}
const element = (type: number, payload?: Uint8Array, size = payload?.length ?? 0) => {
  const nb = size > 0xffffff ? 4 : size > 0xffff ? 3 : size > 0xff ? 2 : size > 0 ? 1 : 0;
  const sz = Array.from({ length: nb }, (_, i) => (size >>> (8 * (nb - 1 - i))) & 255);
  return cat(Uint8Array.of((nb << 5) | type, ...sz), payload ?? new Uint8Array());
};
const END = element(0);

/** One block per track: data stream = Raw(sector region), gap stream = Gap(trailing gap). */
function trackArea(mfm: Uint8Array) {
  const dataStream = cat(element(4, mfm.subarray(0, 11968)), END);
  const gapCells = (mfm.length - 11968) * 8;
  const gapStream = cat(element(3, undefined, gapCells), END);
  const desc = u32(11968 * 8, gapCells, 32 + dataStream.length, 1, 1, 0, 0, 32);
  return cat(desc, dataStream, gapStream);
}
function buildIpf(opts: { tracks?: number[]; mutateTrack?: (t: number, mfm: Uint8Array) => Uint8Array; areaFor?: (t: number, mfm: Uint8Array) => Uint8Array } = {}) {
  const list = opts.tracks ?? Array.from({ length: TRACKS }, (_, i) => i);
  const parts: Uint8Array[] = [record("CAPS", new Uint8Array()), record("INFO", u32(1, 1, 1, 7, 1, 0, 0, 79, 0, 1, 20241105, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0))];
  const datas: Uint8Array[] = [];
  for (const t of list) {
    let mfm = encodeAmigaTrack(trackSectors(adf, t), t);
    if (opts.mutateTrack) mfm = opts.mutateTrack(t, mfm);
    const area = opts.areaFor ? opts.areaFor(t, mfm) : trackArea(mfm);
    const key = t + 1;
    parts.push(record("IMGE", u32(t >> 1, t & 1, 2, 1, mfm.length, 0, 0, 11968 * 8, (mfm.length - 11968) * 8, mfm.length * 8, 1, 1, 0, key, 0, 0, 0)));
    datas.push(cat(record("DATA", u32(area.length, mfm.length * 8, crc32(area), key)), area));
  }
  return cat(...parts, ...datas);
}

describe("crc32 / MFM codec", () => {
  it("crc32 matches the standard check value", () => {
    expect(crc32(ascii("123456789"))).toBe(0xcbf43926);
  });
  it("round-trips a track and finds sectors after bit-level rotation", () => {
    const sectors = trackSectors(adf, 3).map((s, i) => s.map((v) => (v + i * 7) & 255));
    const mfm = encodeAmigaTrack(sectors, 3);
    expect(mfm.length).toBe(TRACK_BYTES);
    const dec = decodeAmigaTrack(mfm);
    expect(dec.errors).toEqual([]);
    expect(dec.trackNumber).toBe(3);
    sectors.forEach((s, i) => expect(dec.sectors.get(i)).toEqual(s));
    // rotate the circular bitstream by 3 bits + 1000 bytes
    const bits = mfm.length * 8, shift = 8000 + 3;
    const rot = new Uint8Array(mfm.length);
    for (let i = 0; i < bits; i++) {
      const src = (i + shift) % bits;
      if ((mfm[src >> 3]! >> (7 - (src & 7))) & 1) rot[i >> 3]! |= 0x80 >> (i & 7);
    }
    const dec2 = decodeAmigaTrack(rot);
    sectors.forEach((s, i) => expect(dec2.sectors.get(i)).toEqual(s));
  });
  it("detects data and header checksum errors", () => {
    const mfm = encodeAmigaTrack(trackSectors(adf, 0), 0);
    const bad = mfm.slice();
    bad[100] ^= 0x01; // data region of sector 0 (data bit)
    const d = decodeAmigaTrack(bad);
    expect(d.sectors.get(0)).toBeUndefined();
    expect(d.errors.join()).toMatch(/checksum/);
    expect(d.sectors.get(1)).toBeDefined();
    const bad2 = mfm.slice();
    bad2[14] ^= 0x01; // info longword of sector 0
    expect(decodeAmigaTrack(bad2).errors.join()).toMatch(/header checksum/);
  });
  it("the real ADF fixture survives encode -> decode on all 160 tracks byte-identically", () => {
    expect(adf.length).toBe(ADF_SIZE);
    const out = new Uint8Array(ADF_SIZE);
    for (let t = 0; t < TRACKS; t++) {
      const d = decodeAmigaTrack(encodeAmigaTrack(trackSectors(adf, t), t));
      expect(d.errors).toEqual([]);
      for (let s = 0; s < 11; s++) out.set(d.sectors.get(s)!, (t * 11 + s) * 512);
    }
    expect(out).toEqual(adf);
  });
});

describe("IpfParser", () => {
  it("parses a synthetic IPF, verifies CRCs and rebuilds the identical ADF", () => {
    const ipf = buildIpf();
    expect(identifyImage(ipf)).toBe("ipf");
    const img = IpfParser.parse(ipf);
    expect(img.errors).toEqual([]);
    expect(img.records.every((r) => r.crcOk)).toBe(true);
    expect(img.records.map((r) => r.type).slice(0, 3)).toEqual(["CAPS", "INFO", "IMGE"]);
    expect(img.info?.encoderType).toBe(1);
    expect(img.info?.maxTrack).toBe(79);
    expect(img.tracks).toHaveLength(160);
    expect(img.tracks.every((t) => !t.protected && t.sectors?.length === 11)).toBe(true);
    expect(img.toAdf()).toEqual(adf);
  });
  it("reports a CRC mismatch with the record offset and refuses to build an ADF", () => {
    const ipf = buildIpf({ tracks: [0] });
    const bad = ipf.slice();
    const imge = IpfParser.parse(ipf).records.find((r) => r.type === "IMGE")!;
    bad[imge.offset + 20] ^= 0xff;
    const img = IpfParser.parse(bad);
    expect(img.errors.join()).toContain(`'IMGE' record at offset ${imge.offset}`);
    expect(img.toAdf()).toBeUndefined();
  });
  it("handles truncated files and a missing CAPS record", () => {
    const ipf = buildIpf({ tracks: [0] });
    expect(IpfParser.parse(ipf.slice(0, ipf.length - 100)).errors.join()).toMatch(/truncated/);
    expect(IpfParser.parse(ipf.slice(0, 7)).errors.join()).toMatch(/truncated/);
    expect(IpfParser.parse(ipf.slice(12)).errors.join()).toMatch(/missing CAPS/);
  });
  it("marks tracks with a bad MFM checksum as protected and never fakes data", () => {
    const ipf = buildIpf({ mutateTrack: (t, mfm) => { if (t === 5) mfm[300] ^= 1; return mfm; } });
    const img = IpfParser.parse(ipf);
    expect(img.errors).toEqual([]); // container is intact
    const t5 = img.tracks.find((t) => t.track === 2 && t.side === 1)!;
    expect(t5.protected).toBe(true);
    expect(t5.reasons.join()).toMatch(/sector/);
    const r = img.toAdfResult();
    expect(r.adf).toBeUndefined();
    expect(r.reasons.join()).toMatch(/track 2\.1/);
  });
  it("returns undefined when tracks are missing", () => {
    const img = IpfParser.parse(buildIpf({ tracks: [0, 1, 2] }));
    expect(img.toAdf()).toBeUndefined();
    expect(img.toAdfResult().reasons.join()).toMatch(/157 track\(s\) missing/);
  });
  it("expands Sync/Data/Gap/Raw elements and flags Fuzzy as protected", () => {
    const payload = Uint8Array.of(0x12, 0x34);
    const expectData = mfmEncodeBytes(payload, 1).out;
    const stream = cat(element(1, Uint8Array.of(0x44, 0x89)), element(2, payload), element(3, undefined, 32), element(4, Uint8Array.of(0xaa)), END);
    const area = cat(u32(2 * 8 + 32 + 32 + 8 - 0, 0, 0, 1, 1, 0, 0, 32), stream);
    const key = 9;
    const file = cat(record("CAPS", new Uint8Array()), record("IMGE", u32(0, 0, 2, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0, key, 0, 0, 0)), cat(record("DATA", u32(area.length, 0, crc32(area), key)), area));
    const img = IpfParser.parse(file);
    const t = img.tracks[0]!;
    // stream expands to 2 + 4 + 4 + 1 = 11 MFM bytes; descriptor/IMGE counts deliberately differ so we also see the size checks
    expect(t.reasons.join()).toMatch(/cells/);
    const fuzzyArea = cat(u32(0, 0, 0, 1, 1, 0, 0, 32), cat(element(5, Uint8Array.of(1)), END));
    const f2 = cat(record("CAPS", new Uint8Array()), record("IMGE", u32(0, 0, 2, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0, key, 0, 0, 0)), cat(record("DATA", u32(fuzzyArea.length, 0, crc32(fuzzyArea), key)), fuzzyArea));
    expect(IpfParser.parse(f2).tracks[0]!.reasons.join()).toMatch(/fuzzy/);
    expect(expectData).toHaveLength(4);
  });
  it("sequential MFM encoding follows the clock rule", () => {
    // 0x00 after prev 0 => 1010...; 0xFF => 0101...
    expect(Array.from(mfmEncodeBytes(Uint8Array.of(0x00), 0).out)).toEqual([0xaa, 0xaa]);
    expect(Array.from(mfmEncodeBytes(Uint8Array.of(0xff), 0).out)).toEqual([0x55, 0x55]);
    expect(mfmEncodeBytes(Uint8Array.of(0x00), 1).out[0]).toBe(0x2a);
  });
  it("skips unsupported record types with a warning (FDI/TRCK are not real IPF records)", () => {
    const file = cat(record("CAPS", new Uint8Array()), record("TRCK", u32(1)), record("FDI ", u32(1)));
    const img = IpfParser.parse(file);
    expect(img.errors).toEqual([]);
    expect(img.warnings).toHaveLength(2);
    expect(img.warnings[0]).toMatch(/not a record of the real IPF format/);
  });
});

describe("mountDiskImage", () => {
  it("identifies images by magic/size", () => {
    expect(identifyImage(adf)).toBe("adf");
    expect(identifyImage(new Uint8Array(10))).toBe("unknown");
  });
  it("mounts an ADF and a decodable IPF in DF0:/DF1:", () => {
    const c = new FloppyController();
    const events: string[] = [];
    c.onEvent((e) => events.push(e.type));
    const a = mountDiskImage(c, 0, adf, "scene.adf", "a".repeat(64));
    expect(a.format).toBe("adf");
    const b = mountDiskImage(c, 1, buildIpf(), "scene.ipf", "b".repeat(64));
    expect(b.format).toBe("ipf");
    expect(b.adf).toEqual(adf);
    expect(c.getState(1).media).toMatchObject({ id: "scene.ipf", format: "ipf", sha256: "b".repeat(64) });
    expect(c.getState(1).media?.image).toEqual(adf);
    expect(events.filter((e) => e === "insert")).toHaveLength(2);
  });
  it("throws IpfProtectedError and inserts nothing for undecodable IPF", () => {
    const c = new FloppyController();
    const ipf = buildIpf({ mutateTrack: (t, m) => { if (t === 0) m[300] ^= 1; return m; } });
    expect(() => mountDiskImage(c, 0, ipf, "p.ipf", "c".repeat(64))).toThrow(IpfProtectedError);
    expect(c.getState(0).diskInserted).toBe(false);
    expect(() => mountDiskImage(c, 0, new Uint8Array(5), "x.bin", "d".repeat(64))).toThrow(/Unrecognized/);
  });
});
