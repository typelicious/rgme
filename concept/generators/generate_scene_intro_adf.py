#!/usr/bin/env python3
"""
Generate a valid 880 KB Amiga Floppy Disk (ADF) image for RGME Scene Intro.
Geometry: 80 cylinders, 2 heads, 11 sectors/track, 512 bytes/sector = 901,120 bytes.
Bootblock: M68000 executable that runs directly on OCS Amiga 500 (AROS / Kickstart 1.3+),
setting up a rich Copper sky/golden sunset gradient and 2-channel Paula stereo arpeggio synth.
"""

import struct
import os

DISK_SIZE = 901120  # 80 * 2 * 11 * 512

def create_amiga_bootblock():
    bb = bytearray(1024)
    # AmigaDOS OFS signature
    bb[0:4] = b"DOS\x00"
    
    # Root block pointer (sector 880)
    struct.pack_into(">I", bb, 8, 880)

    # 68000 executable machine code at offset 12
    pc = 12
    def emit16(w):
        nonlocal pc
        struct.pack_into(">H", bb, pc, w)
        pc += 2

    def emit32(l):
        nonlocal pc
        struct.pack_into(">I", bb, pc, l)
        pc += 4

    # lea $dff000, a6
    emit16(0x4DF9); emit32(0x00DFF000)

    # lea copper_list(pc), a0 (copper_list at offset 180)
    cl_disp = 180 - (pc + 2)
    emit16(0x41FA); emit16(cl_disp)

    # move.l a0, $80(a6) (COP1LCH)
    emit16(0x2D48); emit16(0x0080)
    # move.w #0, $88(a6) (COPJMP1)
    emit16(0x3D7C); emit16(0x0000); emit16(0x0088)

    # lea audio_sample(pc), a1 (audio_sample at offset 400)
    as_disp = 400 - (pc + 2)
    emit16(0x43FA); emit16(as_disp)

    # Channel 0 (Melody/Arpeggio)
    # move.l a1, $a0(a6) (AUD0LCH)
    emit16(0x2D49); emit16(0x00A0)
    # move.w #8, $a4(a6) (AUD0LEN = 8 words = 16 bytes)
    emit16(0x3D7C); emit16(0x0008); emit16(0x00A4)
    # move.w #424, $a6(a6) (AUD0PER = 424 = C-4)
    emit16(0x3D7C); emit16(424); emit16(0x00A6)
    # move.w #64, $a8(a6) (AUD0VOL = 64)
    emit16(0x3D7C); emit16(64); emit16(0x00A8)

    # Channel 1 (Bass)
    # move.l a1, $b0(a6) (AUD1LCH)
    emit16(0x2D49); emit16(0x00B0)
    # move.w #8, $b4(a6) (AUD1LEN = 8 words)
    emit16(0x3D7C); emit16(0x0008); emit16(0x00B4)
    # move.w #848, $b6(a6) (AUD1PER = 848 = C-3)
    emit16(0x3D7C); emit16(848); emit16(0x00B6)
    # move.w #48, $b8(a6) (AUD1VOL = 48)
    emit16(0x3D7C); emit16(48); emit16(0x00B8)

    # Enable DMA: $8283 (DMAEN | COPEN | AUD0EN | AUD1EN)
    emit16(0x3D7C); emit16(0x8283); emit16(0x0096)

    # moveq #0, d2 (frame counter)
    emit16(0x7400)
    # moveq #0, d3 (note counter)
    emit16(0x7600)

    loop_label = pc
    wait_vbl_label = pc
    # move.l 4(a6), d0
    emit16(0x202E); emit16(0x0004)
    # and.l #$0001ff00, d0
    emit16(0x0280); emit32(0x0001FF00)
    # cmp.l #$00013000, d0
    emit16(0x0C80); emit32(0x00013000)
    # bne.s wait_vbl
    bne_vbl_disp = wait_vbl_label - (pc + 2)
    emit16(0x6600 | (bne_vbl_disp & 0xFF))

    # addq.l #1, d2
    emit16(0x5282)

    # move.l d2, d0
    emit16(0x2002)
    # andi.l #7, d0
    emit16(0x0280); emit32(0x00000007)
    # bne.s skip_note
    bne_note_pc = pc
    emit16(0x6600)  # placeholder

    # addq.w #1, d3
    emit16(0x5243)
    # andi.w #7, d3
    emit16(0x0243); emit16(0x0007)
    # move.w d3, d1
    emit16(0x3203)
    # add.w d1, d1
    emit16(0xD241)
    # lea note_table(pc), a2 (note_table at 450)
    nt_disp = 450 - (pc + 2)
    emit16(0x45FA); emit16(nt_disp)
    # move.w 0(a2, d1.w), $a6(a6) (AUD0PER)
    emit16(0x3D72); emit16(0x1000); emit16(0x00A6)

    # skip_note label
    skip_note_label = pc
    struct.pack_into("b", bb, bne_note_pc + 1, (skip_note_label - (bne_note_pc + 2)) & 0xFF)

    # btst #6, $bfe001 (left mouse button)
    emit16(0x0839); emit16(0x0006); emit32(0x00BFE001)
    # bne.s loop
    bne_loop_disp = loop_label - (pc + 2)
    emit16(0x6600 | (bne_loop_disp & 0xFF))

    # Exit on mouse click: disable DMA, moveq #0, d0, rts
    emit16(0x3D7C); emit16(0x7FFF); emit16(0x0096)
    emit16(0x7000)
    emit16(0x4E75)

    # Copper list at offset 180
    pc = 180
    cl_data = [
        0x2807, 0xFFFE, 0x0180, 0x0001,
        0x3807, 0xFFFE, 0x0180, 0x0002,
        0x4807, 0xFFFE, 0x0180, 0x0004,
        0x5807, 0xFFFE, 0x0180, 0x0016,
        0x6807, 0xFFFE, 0x0180, 0x0029,
        0x7807, 0xFFFE, 0x0180, 0x003C,
        0x8807, 0xFFFE, 0x0180, 0x004E,
        # Golden amber sunset horizon band
        0x9807, 0xFFFE, 0x0180, 0x0620,
        0x9A07, 0xFFFE, 0x0180, 0x0A40,
        0x9C07, 0xFFFE, 0x0180, 0x0F80,
        0x9E07, 0xFFFE, 0x0180, 0x0FC0,
        0xA007, 0xFFFE, 0x0180, 0x0FF2,
        0xA207, 0xFFFE, 0x0180, 0x0FC0,
        0xA407, 0xFFFE, 0x0180, 0x0F80,
        0xA607, 0xFFFE, 0x0180, 0x0A40,
        0xA807, 0xFFFE, 0x0180, 0x0620,
        # Sky blue fade down to deep night
        0xB807, 0xFFFE, 0x0180, 0x004E,
        0xC807, 0xFFFE, 0x0180, 0x0029,
        0xD807, 0xFFFE, 0x0180, 0x0016,
        0xE807, 0xFFFE, 0x0180, 0x0004,
        0xF807, 0xFFFE, 0x0180, 0x0001,
        0xFFFF, 0xFFFE
    ]
    for w in cl_data:
        emit16(w)

    # Audio Sample at offset 400 (16-byte single cycle wave)
    pc = 400
    sample = [120, 100, 70, 30, 0, -30, -70, -100, -120, -100, -70, -30, 0, 30, 70, 100]
    for i in range(16):
        bb[pc + i] = (sample[i] + 256) & 0xFF

    # Note table at offset 450 (C-4, Eb-4, G-4, Bb-4, C-5, Bb-4, G-4, Eb-4)
    pc = 450
    notes = [424, 356, 282, 238, 212, 238, 282, 356]
    for n in notes:
        emit16(n)

    # Banner text at offset 500
    banner = b"RGME SCENE INTRO v1.0 - CHRIS HUELSBECK & TURRICAN TRIBUTE (AMIGA 500 OCS 50Hz)"
    bb[500:500+len(banner)] = banner

    # Compute valid Amiga Kickstart bootblock checksum
    struct.pack_into(">I", bb, 4, 0)
    chk = 0
    for i in range(256):
        val, = struct.unpack_from(">I", bb, i * 4)
        chk += val
        if chk > 0xFFFFFFFF:
            chk = (chk + 1) & 0xFFFFFFFF
    target = 0xFFFFFFFF - chk
    struct.pack_into(">I", bb, 4, target)

    # Convergence check
    v = 0
    for i in range(256):
        val, = struct.unpack_from(">I", bb, i * 4)
        v += val
        if v > 0xFFFFFFFF:
            v = (v + 1) & 0xFFFFFFFF
    if v != 0xFFFFFFFF:
        diff = 0xFFFFFFFF - v
        target = (target + diff) & 0xFFFFFFFF
        struct.pack_into(">I", bb, 4, target)

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
        if i == 5:
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
    
    # Ensure directory exists and write disk image
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    with open(output_path, "wb") as f:
        f.write(disk)
    print(f"Generated authentic Amiga ADF demo at: {output_path} ({len(disk)} bytes)")

if __name__ == "__main__":
    generate_adf("concept/fixtures/rgme-scene-intro.adf")
