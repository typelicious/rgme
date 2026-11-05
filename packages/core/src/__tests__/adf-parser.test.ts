import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { AdfParser, AdfError, hashName, amigaDate, ADF_SIZE, ROOT_BLOCK } from "../adf/index.js";

const B = 512;

// ---- synthetic ADF builder ----
function build(ffs: boolean) {
  const buf = new Uint8Array(ADF_SIZE);
  const v = new DataView(buf.buffer);
  const setL = (blk: number, i: number, val: number) => v.setUint32(blk * B + i * 4, val >>> 0, false);
  const str = (blk: number, li: number, s: string) => {
    buf[blk * B + li * 4] = s.length;
    for (let i = 0; i < s.length; i++) buf[blk * B + li * 4 + 1 + i] = s.charCodeAt(i);
  };
  const seal = (blk: number) => {
    setL(blk, 5, 0);
    let sum = 0;
    for (let i = 0; i < 128; i++) sum = (sum + v.getUint32(blk * B + i * 4, false)) >>> 0;
    setL(blk, 5, (0 - sum) >>> 0);
  };
  // bootblock
  buf.set([0x44, 0x4f, 0x53, ffs ? 1 : 0]);
  let sum = 0;
  for (let i = 0; i < 256; i++) { sum += v.getUint32(i * 4, false); if (sum > 0xffffffff) sum = (sum & 0xffffffff) + 1; }
  v.setUint32(4, (~sum) >>> 0, false);

  const hashInsert = (dirBlk: number, name: string, blk: number) => {
    const slot = 6 + hashName(name);
    const cur = v.getUint32(dirBlk * B + slot * 4, false);
    if (cur === 0) setL(dirBlk, slot, blk);
    else setL(blk, 124, cur), setL(dirBlk, slot, blk); // chain
  };
  // root
  setL(ROOT_BLOCK, 0, 2); setL(ROOT_BLOCK, 3, 72); setL(ROOT_BLOCK, 127, 1);
  str(ROOT_BLOCK, 108, "TestDisk");
  setL(ROOT_BLOCK, 121, 365); // created: 1979-01-01
  const header = (blk: number, name: string, parent: number, sec: number) => {
    setL(blk, 0, 2); setL(blk, 1, blk); str(blk, 108, name); setL(blk, 125, parent); setL(blk, 127, sec);
  };
  // dir "s" (block 900) in root, file "startup" (901) inside it
  header(900, "s", ROOT_BLOCK, 2); hashInsert(ROOT_BLOCK, "s", 900);
  // small file in root, block 902, data block 903
  const small = new TextEncoder().encode("hello amiga");
  header(902, "hello.txt", ROOT_BLOCK, 0xfffffffd); setL(902, 81, small.length); setL(902, 2, 1); setL(902, 77, 903);
  hashInsert(ROOT_BLOCK, "hello.txt", 902);
  const writeData = (blk: number, bytes: Uint8Array, seq: number, next: number) => {
    if (ffs) buf.set(bytes, blk * B);
    else { setL(blk, 0, 8); setL(blk, 1, 902); setL(blk, 2, seq); setL(blk, 3, bytes.length); setL(blk, 4, next); buf.set(bytes, blk * B + 24); seal(blk); }
  };
  writeData(903, small, 1, 0);
  // large file nested in dir s: 80 data blocks => 72 in header + 8 via extension block
  const cap = ffs ? 512 : 488;
  const nblocks = 80;
  const big = new Uint8Array(nblocks * cap - 100).map((_, i) => (i * 7 + 3) & 0xff);
  header(901, "big.bin", 900, 0xfffffffd); hashInsert(900, "big.bin", 901);
  setL(901, 81, big.length); setL(901, 2, 72);
  const EXT = 1000, DATA0 = 1001;
  setL(901, 126, EXT);
  setL(EXT, 0, 16); setL(EXT, 1, 901); setL(EXT, 2, 8); setL(EXT, 127, 0xfffffffd);
  for (let i = 0; i < nblocks; i++) {
    const blk = DATA0 + i;
    const chunk = big.subarray(i * cap, Math.min((i + 1) * cap, big.length));
    writeData(blk, chunk, i + 1, i + 1 < nblocks ? blk + 1 : 0);
    if (i < 72) setL(901, 77 - i, blk); else setL(EXT, 77 - (i - 72), blk);
    if (!ffs) setL(blk, 1, 901);
  }
  seal(901); seal(EXT); seal(900); seal(902); seal(ROOT_BLOCK);
  return { buf, small, big };
}

describe("AdfParser — rgme-scene-intro.adf fixture", () => {
  const data = new Uint8Array(readFileSync(new URL("../../../../concept/fixtures/rgme-scene-intro.adf", import.meta.url)));
  const p = new AdfParser(data);
  it("decodes bootblock and root", () => {
    const info = p.parse();
    expect(info.label).toBe("RGME-Intro");
    expect(info.variant).toBe("OFS");
    expect(info.bootChecksumValid).toBe(true);
    expect(info.bootable).toBe(true);
    expect(info.hashTable).toHaveLength(72);
    expect(info.created).toBeInstanceOf(Date);
    expect(p.listFiles().length).toBe(info.root.children!.filter((c) => c.type === "file").length);
  });
  it("does not mutate the input", () => {
    const copy = new Uint8Array(data);
    new AdfParser(data).parse();
    expect(Buffer.compare(data, copy)).toBe(0);
  });
});

describe.each([[false, "OFS"], [true, "FFS"]] as const)("AdfParser — synthetic %s", (ffs, variant) => {
  const { buf, small, big } = build(ffs);
  const p = new AdfParser(buf);
  it("reads label, variant, valid checksums, dates", () => {
    const i = p.parse();
    expect(i.label).toBe("TestDisk");
    expect(i.variant).toBe(variant);
    expect(i.bootChecksumValid && i.rootChecksumValid).toBe(true);
    expect(i.created.toISOString().slice(0, 10)).toBe("1979-01-01");
  });
  it("traverses nested directories", () => {
    expect(p.listFiles().map((f) => f.path)).toEqual(["hello.txt", "s/big.bin"]);
    expect(p.parse().root.children!.find((c) => c.type === "dir")!.name).toBe("s");
    expect(p.find("S/BIG.BIN")?.size).toBe(big.length); // case-insensitive
  });
  it("extracts a small file", () => {
    expect(new TextDecoder().decode(p.readFile("hello.txt"))).toBe("hello amiga");
    expect(p.readFile("hello.txt")).toEqual(small);
  });
  it("extracts a multi-block file through an extension block", () => {
    expect(p.readFile("s/big.bin")).toEqual(big);
  });
  it("errors on missing files and bad sizes", () => {
    expect(() => p.readFile("nope")).toThrow(AdfError);
    expect(() => p.readFile("s")).toThrow(AdfError);
    expect(() => new AdfParser(new Uint8Array(10))).toThrow(AdfError);
  });
});

describe("AdfParser — robustness & helpers", () => {
  it("detects a corrupted bootblock checksum", () => {
    const { buf } = build(false);
    buf[100] ^= 0xff;
    expect(new AdfParser(buf).parse().bootChecksumValid).toBe(false);
  });
  it("rejects non-DOS disks", () => {
    expect(() => new AdfParser(new Uint8Array(ADF_SIZE)).parse()).toThrow(/DOS/);
  });
  it("survives a hash-chain cycle", () => {
    const { buf } = build(false);
    const v = new DataView(buf.buffer);
    v.setUint32(902 * B + 124 * 4, 902, false); // header chains to itself
    expect(() => new AdfParser(buf).parse()).not.toThrow();
  });
  it("hashes names case-insensitively and converts dates", () => {
    expect(hashName("Startup-Sequence")).toBe(hashName("STARTUP-SEQUENCE"));
    expect(hashName("a")).toBeLessThan(72);
    expect(amigaDate(0, 0, 0).toISOString()).toBe("1978-01-01T00:00:00.000Z");
    expect(amigaDate(1, 1, 50).toISOString()).toBe("1978-01-02T00:01:01.000Z");
  });
});
