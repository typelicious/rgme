#!/usr/bin/env python3
"""Generate ORIGINAL synthetic multi-platform fixtures (CC0, RGME Project).

Outputs (next to concept/fixtures/):
  rgme-c64-demo.d64   35-track Commodore 1541 image with 2 original PRG files
  rgme-md-demo.md     128 KB Mega Drive homebrew ROM stub with a valid SEGA header + checksum
  multiplatform-games.json  hash registry in the freeware-games.json shape (+ platform)
Deterministic: same output on every run.
"""
import hashlib
import json
import math
import pathlib

OUT = pathlib.Path(__file__).resolve().parent.parent / "fixtures"

# ---------------------------------------------------------------- D64
SECTORS = [21] * 17 + [19] * 7 + [18] * 6 + [17] * 5  # tracks 1..35


def sectors_in(track):
    return SECTORS[track - 1]


def offset(track, sector):
    return (sum(SECTORS[: track - 1]) + sector) * 256


def petscii(name, n=16):
    return name.encode("ascii").ljust(n, b"\xa0")[:n]


def build_d64():
    img = bytearray(174848)
    used = {(18, 0), (18, 1)}

    def alloc_chain(data):
        """Allocate sectors sequentially (skip track 18), return first (t,s)."""
        chunks = [data[i : i + 254] for i in range(0, len(data), 254)] or [b""]
        locs = []
        t, s = 1, 0
        for _ in chunks:
            while t == 18 or (t, s) in used:
                s += 1
                if s >= sectors_in(t):
                    t, s = t + 1, 0
            locs.append((t, s))
            used.add((t, s))
        for i, (chunk, (lt, ls)) in enumerate(zip(chunks, locs)):
            o = offset(lt, ls)
            if i + 1 < len(locs):
                img[o], img[o + 1] = locs[i + 1]
            else:
                img[o], img[o + 1] = 0, len(chunk) + 1  # last sector: index of last used byte
            img[o + 2 : o + 2 + len(chunk)] = chunk
        return locs

    # File 1: BASIC stub  10 PRINT "RGME"   (load address $0801)
    line = bytes([0x99, 0x20, 0x22]) + b"RGME" + bytes([0x22, 0x00])  # PRINT "RGME"
    nxt = 0x0801 + 2 + 2 + len(line) + 0
    basic = bytes([0x01, 0x08]) + nxt.to_bytes(2, "little") + (10).to_bytes(2, "little") + line + b"\x00\x00"
    # File 2: raster border cycler at $C000 (INC $D020 / JMP $C000) + original sine table payload
    code = bytes([0xEE, 0x20, 0xD0, 0x4C, 0x00, 0xC0])
    table = bytes(int(127.5 + 127.5 * math.sin(i * 2 * math.pi / 256)) for i in range(256))
    border = bytes([0x00, 0xC0]) + code + table + b"RGME-C64-DEMO CC0"
    files = [("HELLO", basic), ("BORDER", border)]

    entries = []
    for name, data in files:
        locs = alloc_chain(data)
        entries.append((name, locs[0], len(locs)))

    # Directory sector 18/1 (single sector, last link = 0,255)
    d = offset(18, 1)
    img[d], img[d + 1] = 0, 255
    for i, (name, (ft, fs), blocks) in enumerate(entries):
        e = d + i * 32
        img[e + 2] = 0x82  # PRG, closed
        img[e + 3], img[e + 4] = ft, fs
        img[e + 5 : e + 21] = petscii(name)
        img[e + 28], img[e + 29] = blocks & 0xFF, blocks >> 8

    # BAM sector 18/0
    b = offset(18, 0)
    img[b], img[b + 1], img[b + 2], img[b + 3] = 18, 1, 0x41, 0
    for t in range(1, 36):
        n = sectors_in(t)
        bits = [0, 0, 0]
        free = 0
        for s in range(n):
            if (t, s) not in used:
                bits[s // 8] |= 1 << (s % 8)
                free += 1
        p = b + 4 * t
        img[p] = free
        img[p + 1 : p + 4] = bytes(bits)
    img[b + 144 : b + 160] = petscii("RGME C64 DEMO")
    img[b + 160 : b + 162] = b"\xa0\xa0"
    img[b + 162 : b + 164] = b"RG"
    img[b + 164] = 0xA0
    img[b + 165 : b + 167] = b"2A"
    img[b + 167 : b + 171] = b"\xa0" * 4
    return bytes(img)


# ---------------------------------------------------------------- Mega Drive
def build_md(size=0x20000):
    rom = bytearray(size)

    def put32(o, v):
        rom[o : o + 4] = v.to_bytes(4, "big")

    put32(0, 0x00FF0000)  # initial SSP
    put32(4, 0x00000200)  # initial PC
    for v in range(2, 64):
        put32(v * 4, 0x00000210)  # all other vectors -> RTE stub
    h = lambda s, n: s.encode("ascii").ljust(n, b" ")[:n]
    rom[0x100:0x110] = h("SEGA MEGA DRIVE", 16)
    rom[0x110:0x120] = h("(C)RGME 2026.NOV", 16)
    rom[0x120:0x150] = h("RGME HOMEBREW DEMO", 48)
    rom[0x150:0x180] = h("RGME HOMEBREW DEMO", 48)
    rom[0x180:0x18E] = h("GM 00000000-00", 14)
    rom[0x190:0x1A0] = h("J6", 16)
    put32(0x1A0, 0)
    put32(0x1A4, size - 1)
    put32(0x1A8, 0x00FF0000)
    put32(0x1AC, 0x00FFFFFF)
    rom[0x1B0:0x1BC] = b" " * 12
    rom[0x1BC:0x1C8] = b" " * 12
    rom[0x1C8:0x1F0] = b" " * 40
    rom[0x1F0:0x200] = h("JUE", 16)
    rom[0x200:0x202] = bytes([0x60, 0xFE])  # BRA.S *  (idle loop)
    rom[0x210:0x212] = bytes([0x4E, 0x73])  # RTE
    rom[0x220:0x220 + 24] = b"RGME HOMEBREW - CC0 DEMO"
    total = 0
    for i in range(0x200, size, 2):
        total = (total + (rom[i] << 8 | rom[i + 1])) & 0xFFFF
    rom[0x18E:0x190] = total.to_bytes(2, "big")
    return bytes(rom)


def entry(id_, title, filename, data, platform, machine, note):
    return {
        "id": id_,
        "canonical_title": title,
        "filename": filename,
        "sha256": hashlib.sha256(data).hexdigest(),
        "platform": platform,
        "machine": machine,
        "rights": {
            "rights_class": "A",
            "status": "verified_public_domain",
            "opportunity": "GREEN",
            "rightsholder": "RGME Project",
            "license": "CC0-1.0",
            "actions": {
                "private_execution": "allow",
                "binary_redistribution": "allow",
                "browser_hosting": "allow",
                "reverse_engineering": "allow",
                "modification": "allow",
            },
            "provenance_note": note,
        },
    }


def main():
    d64, md = build_d64(), build_md()
    (OUT / "rgme-c64-demo.d64").write_bytes(d64)
    (OUT / "rgme-md-demo.md").write_bytes(md)
    games = [
        entry("rgme-c64-demo", "RGME C64 Demo", "rgme-c64-demo.d64", d64, "c64",
              {"model": "C64C", "chipset": "VIC-II/SID", "video": "PAL", "cpu": "6510", "ram_chip_kb": 64, "ram_fast_kb": 0},
              "Original synthetic 1541 disk image with two original PRG files; no third-party code."),
        entry("rgme-md-demo", "RGME Mega Drive Demo", "rgme-md-demo.md", md, "megadrive",
              {"model": "Mega Drive", "chipset": "VDP/YM2612", "video": "NTSC", "cpu": "68000+Z80", "ram_chip_kb": 64, "ram_fast_kb": 0},
              "Original synthetic homebrew ROM stub with a valid SEGA header and checksum; no third-party code."),
    ]
    (OUT / "multiplatform-games.json").write_text(json.dumps(games, indent=2) + "\n")
    for g in games:
        print(g["id"], g["sha256"])


if __name__ == "__main__":
    main()
