#!/usr/bin/env python3
"""
Generate a valid 880 KB Amiga Floppy Disk (ADF) image for RGME Scene Intro.
Geometry: 80 cylinders, 2 heads, 11 sectors/track, 512 bytes/sector = 901,120 bytes.
"""

import struct
import hashlib
import os

DISK_SIZE = 901120  # 80 * 2 * 11 * 512

def create_amiga_bootblock():
    bb = bytearray(1024)
    # AmigaDOS OFS signature
    bb[0:4] = b"DOS\x00"
    
    # Root block pointer (sector 880)
    struct.pack_into(">I", bb, 8, 880)
    
    # Header banner
    banner = (
        b"RGME SCENE INTRO v1.0 - CHRIS HUELSBECK & TURRICAN TRIBUTE\r\n"
        b"COMMODORE AMIGA 500 / OCS 50Hz - TYPELICIOUS 2026\r\n"
        b"GREETINGS TO ALL AMIGA CODERS, GRAPHICIANS & MUSICIANS!\x00"
    )
    bb[12:12+len(banner)] = banner

    # Compute valid Amiga Kickstart bootblock checksum
    chk = 0
    for i in range(256):
        if i == 1:
            continue
        val, = struct.unpack_from(">I", bb, i * 4)
        chk += val
        if chk > 0xFFFFFFFF:
            chk = (chk + 1) & 0xFFFFFFFF
    chk = (~chk) & 0xFFFFFFFF
    struct.pack_into(">I", bb, 4, chk)
    return bb

def create_root_block():
    rb = bytearray(512)
    # Primary type: T_HEADER (2)
    struct.pack_into(">I", rb, 0, 2)
    # Own block number: 880
    struct.pack_into(">I", rb, 4, 880)
    # Hash table size: 72
    struct.pack_into(">I", rb, 12, 72)
    # Bitmap flag: -1 (valid)
    struct.pack_into(">i", rb, 312, -1)
    # First bitmap block: 881
    struct.pack_into(">I", rb, 316, 881)
    
    # Disk name: "RGME-Intro"
    disk_name = b"RGME-Intro"
    rb[432] = len(disk_name)
    rb[433:433+len(disk_name)] = disk_name
    
    # Secondary type: ST_ROOT (1)
    struct.pack_into(">I", rb, 508, 1)
    
    # Checksum for Amiga block
    chk = 0
    for i in range(128):
        if i == 5:  # Checksum field itself at offset 20
            continue
        val, = struct.unpack_from(">I", rb, i * 4)
        chk = (chk + val) & 0xFFFFFFFF
    chk = (-chk) & 0xFFFFFFFF
    struct.pack_into(">I", rb, 20, chk)
    return rb

def generate_adf(output_path):
    disk = bytearray(DISK_SIZE)
    
    # Write bootblock (sectors 0 & 1)
    bb = create_amiga_bootblock()
    disk[0:1024] = bb
    
    # Write root block (sector 880 = 880 * 512 = 450560)
    rb = create_root_block()
    disk[880 * 512 : 881 * 512] = rb
    
    # Write intro metadata file payload into data sector
    intro_nfo = (
        b"====================================================\r\n"
        b"  ____   ____ __  __ _____    ___ _   _ _____ ____   ___  \r\n"
        b" |  _ \\ / ___|  \\/  | ____|  |_ _| \\ | |_   _|  _ \\ / _ \\ \r\n"
        b" | |_) | |  _| |\\/| |  _|     | ||  \\| | | | | |_) | | | |\r\n"
        b" |  _ <| |_| | |  | | |___    | || |\\  | | | |  _ <| |_| |\r\n"
        b" |_| \\_\\\\____|_|  |_|_____|  |___|_| \\_| |_| |_| \\_\\\\___/ \r\n"
        b"====================================================\r\n"
        b"Title:      RGME Scene Intro: Turrican Tribute\r\n"
        b"Platform:   Commodore Amiga (OCS/ECS/AGA)\r\n"
        b"Target:     PAL 50Hz, A500 512KB Chip + 512KB Fast\r\n"
        b"Audio:      Paula 4-Channel Stereo (Huelsbeck Style Synth)\r\n"
        b"Graphics:   Copper Rainbows, Graffiti Raster, Sine Scroller\r\n"
        b"License:    CC0 1.0 Universal / Public Domain (RGME Project)\r\n"
        b"Provenance: Synthetic test asset for RGME verification\r\n"
        b"====================================================\r\n"
    )
    # Store at sector 10
    disk[10 * 512 : 10 * 512 + len(intro_nfo)] = intro_nfo
    
    with open(output_path, "wb") as f:
        f.write(disk)
        
    sha256 = hashlib.sha256(disk).hexdigest()
    print(f"Generated {output_path}")
    print(f"Size: {len(disk)} bytes (exact 880 KB)")
    print(f"SHA-256: {sha256}")
    return sha256

if __name__ == "__main__":
    out = os.path.join(os.path.dirname(__file__), "..", "fixtures", "rgme-scene-intro.adf")
    generate_adf(out)
