#!/usr/bin/env python3
"""Generates concept/fixtures/rgme-demo.mod: an ORIGINAL 4-channel ProTracker (M.K.) tune.

Deterministic, CC0. All samples are synthesised here (square / saw / sine-bass cycles, a sine-sweep kick and an LCG
noise hat) - no third-party samples or music. Also writes concept/fixtures/audio-fixtures.json with the SHA-256.
"""
import hashlib, json, math, os, struct

HERE = os.path.dirname(os.path.abspath(__file__))
FIX = os.path.join(HERE, "..", "fixtures")

FT0 = [856,808,762,720,678,640,604,570,538,508,480,453, 428,404,381,360,339,320,302,285,269,254,240,226,
       214,202,190,180,170,160,151,143,135,127,120,113]
NAMES = ["C-","C#","D-","D#","E-","F-","F#","G-","G#","A-","A#","B-"]

def period(name):  # e.g. "A-2"
    i = (int(name[2]) - 1) * 12 + NAMES.index(name[:2])
    return FT0[i]

def s8(v):
    return max(-128, min(127, int(round(v)))) & 0xFF

def cycle(fn, n):
    return bytes(s8(fn(i / n)) for i in range(n))

square = cycle(lambda t: 100 if t < 0.5 else -100, 32)
saw = cycle(lambda t: 110 * (2 * t - 1), 32)
bass = cycle(lambda t: 120 * math.sin(2 * math.pi * t) + 25 * math.sin(4 * math.pi * t), 64)

kick = bytearray()
ph = 0.0
for i in range(1000):
    f = 0.16 * math.exp(-i / 180.0) + 0.012
    ph += f
    kick.append(s8(125 * math.exp(-i / 420.0) * math.sin(2 * math.pi * ph)))
kick = bytes(kick)

seed = 0x1234ABCD
hat = bytearray()
for i in range(600):
    seed = (seed * 1664525 + 1013904223) & 0xFFFFFFFF
    n = ((seed >> 16) & 0xFF) - 128
    hat.append(s8(n * math.exp(-i / 90.0)))
hat = bytes(hat)

# name, data, volume, loop(start_words, len_words) or None
SAMPLES = [
    ("rgme square", square, 40, (0, len(square) // 2)),
    ("rgme saw lead", saw, 48, (0, len(saw) // 2)),
    ("rgme sine bass", bass, 64, (0, len(bass) // 2)),
    ("rgme kick", kick, 64, None),
    ("rgme hat", hat, 30, None),
]

def header(name, data, vol, loop):
    nm = name.encode("ascii")[:22].ljust(22, b"\0")
    ls, ll = loop if loop else (0, 1)
    return nm + struct.pack(">HBBHH", len(data) // 2, 0, vol, ls, ll)

# --- patterns ---------------------------------------------------------------------------------------
def empty():
    return [[(0, 0, 0, 0) for _ in range(4)] for _ in range(64)]

def put(p, row, ch, note=None, sample=0, fx=0, param=0):
    p[row][ch] = (period(note) if note else 0, sample, fx, param)

CHORDS = [("A-2", 0x37, "A-1"), ("F-2", 0x47, "F-1"), ("C-3", 0x47, "C-2"), ("G-2", 0x47, "G-1")]
LEAD_A = {0: "E-3", 6: "C-3", 10: "A-2"}
LEAD_B = {0: "E-3", 2: "G-3", 4: "A-3", 6: "G-3", 8: "E-3", 10: "D-3", 12: "C-3", 14: "D-3"}

def build(kind):
    p = empty()
    for bar, (root, arp, bassn) in enumerate(CHORDS):
        base = bar * 16
        for r in range(16):
            row = base + r
            # ch0 (left): arpeggiated chord, retriggered every 4 rows
            put(p, row, 0, root if r % 4 == 0 else None, 1 if r % 4 == 0 else 0, 0x0, arp)
            # ch1 (right): bass on the beat and the off-beat octave
            if r % 4 == 0:
                put(p, row, 1, bassn, 3)
            elif r % 4 == 2:
                put(p, row, 1, bassn[:2] + str(int(bassn[2]) + 1), 3)
            # ch3 (left): kick on the beat, hat on the off-beat
            if r % 4 == 0:
                put(p, row, 3, "C-2", 4)
            elif r % 4 == 2:
                put(p, row, 3, "C-3", 5, 0xC, 0x20)
            # ch2 (right): lead
            lead = LEAD_A if kind == "A" else LEAD_B
            if r in lead:
                put(p, row, 2, lead[r], 2)
    # show off C (volume), F (speed) and D (pattern break)
    put(p, 0, 3, "C-2", 4, 0xF, 0x06)         # speed 6
    if kind == "B":
        put(p, 48, 2, "A-3", 2, 0xF, 0x05)    # speed up for the last bar
        put(p, 62, 0, None, 0, 0xD, 0x00)     # pattern break to row 0 of the next order
    return p

def pattern_bytes(p):
    out = bytearray()
    for row in p:
        for per, smp, fx, prm in row:
            out += bytes([(smp & 0xF0) | (per >> 8), per & 0xFF, ((smp & 0x0F) << 4) | fx, prm])
    return bytes(out)

patterns = [build("A"), build("B")]
orders = [0, 0, 1, 0, 1, 1]

blob = bytearray()
blob += b"RGME DEMO TUNE".ljust(20, b"\0")
for i in range(31):
    if i < len(SAMPLES):
        blob += header(*SAMPLES[i])
    else:
        blob += b"\0" * 22 + struct.pack(">HBBHH", 0, 0, 0, 0, 1)
blob += bytes([len(orders), 127]) + bytes(orders) + bytes(128 - len(orders)) + b"M.K."
for p in patterns:
    blob += pattern_bytes(p)
for _, data, _, _ in SAMPLES:
    blob += data

os.makedirs(FIX, exist_ok=True)
path = os.path.join(FIX, "rgme-demo.mod")
open(path, "wb").write(blob)
sha = hashlib.sha256(blob).hexdigest()

entry = [{
    "id": "rgme-demo-mod",
    "canonical_title": "RGME Demo Tune",
    "filename": "rgme-demo.mod",
    "sha256": sha,
    "platform": "amiga",
    "kind": "mod",
    "rights": {
        "rights_class": "A",
        "status": "verified_public_domain",
        "opportunity": "GREEN",
        "rightsholder": "RGME Project",
        "license": "CC0-1.0",
        "actions": {"private_execution": "allow", "binary_redistribution": "allow", "browser_hosting": "allow",
                    "reverse_engineering": "allow", "modification": "allow"},
        "provenance_note": "Original 4-channel ProTracker tune generated by concept/generators/generate_demo_mod.py; all samples synthesised, no third-party material."
    }
}]
json.dump(entry, open(os.path.join(FIX, "audio-fixtures.json"), "w"), indent=2)
open(os.path.join(FIX, "audio-fixtures.json"), "a").write("\n")
print(path, len(blob), sha)
