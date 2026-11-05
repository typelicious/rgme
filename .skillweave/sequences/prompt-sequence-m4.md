# SkillWeave Execution Sequence: RGME Milestone 4
## IPF Floppy Decoder, Real 68000 CPU Core, ProTracker Engine & Monitor Bezel

**Project:** Retro Game Modernization Engine (RGME)  
**Milestone:** M4 — IPF Parser, Motorola 68000 CPU Execution Core, ProTracker MOD Player, .m3u Playlist Runner, Commodore 1084S Bezel  
**Methodology:** `assay` (empirical test-driven validation)  
**Autonomy Policy:** `unicorn` (maximum autonomy, aggressive forward momentum)  
**Parallelism:** `maximal`  
**Remaining Budget Target:** ~$6+ (Claude Cloud)  

---

## Parallel Execution Lanes (Maximal Parallelism)

### Lane 1: Pure TypeScript IPF / CAPS Floppy Decoder (`IPF-001`)
* **Package:** `packages/core`
* **Implement:** `IpfParser` in `packages/core/src/ipf/`
  - Parse SPS / CAPS Interchangeable Preservation Format containers:
    - `CAPS` (main container header)
    - `FDI ` (floppy disk image descriptor: tracks, sides, densities)
    - `TRCK` (track descriptors: cylinder, head, stream length)
    - `DATA` (raw track MFM bitstream bytes)
  - Decode standard Amiga MFM encoding to reconstruct 512-byte sectors.
  - Seamlessly mount `.ipf` files into virtual floppy drives (`DF0:`–`DF3:`).
* **Unit Tests:** `packages/core/src/__tests__/ipf.test.ts`
  - Tests parsing sample and synthetic IPF chunk buffers.

---

### Lane 2: In-Browser Motorola 68000 CPU Core (`M68K-001`)
* **Package:** `packages/core`
* **Implement:** `M68kCpu` in `packages/core/src/cpu/`
  - Register file: 8 32-bit Data Registers (D0–D7), 8 32-bit Address Registers (A0–A7 / SP), Program Counter (PC), Status Register (SR) with Condition Codes (X, N, Z, V, C).
  - Memory Bus interface with byte/word/longword read/write.
  - Implement core 68000 instruction set:
    - Data movement: `MOVE`, `MOVEQ`, `LEA`, `PEA`
    - Arithmetic / Logic: `ADD`, `ADDI`, `ADDQ`, `SUB`, `SUBI`, `SUBQ`, `AND`, `OR`, `EOR`, `NOT`, `TST`, `CMP`, `CMPI`
    - Branches / Jumps: `BRA`, `BSR`, `Bcc` (BEQ, BNE, BPL, BMI, BGE, BLT, BGT, BLE), `JMP`, `JSR`, `RTS`
    - Control: `NOP`, `RESET`
  - Real Execution: Execute bootblock code from disk sector 0, setting up Amiga Custom Chip base register `0xdff000`.
  - Connect to `WasmAmigaAdapter` / `RuntimeAdapter`.
* **Unit Tests:** `packages/core/src/__tests__/m68k.test.ts`
  - Run opcode test vectors, arithmetic flags, branch calculations, and bootblock disassembly/execution.

---

### Lane 3: Amiga ProTracker / SoundTracker (`.mod`) Audio Engine (`MOD-001`)
* **Package:** `packages/core` & `packages/web`
* **Implement:** `ModPlayer` in `packages/core/src/audio/`
  - Parse standard 4-channel ProTracker format (`M.K.` / `4CHN` signature).
  - 31 sample headers: name, length, finetune, volume, repeat offset, repeat length, 8-bit signed PCM sample data.
  - Song sequence table and pattern data (64 rows per pattern, 4 note/effect channels).
  - Accurate Amiga Paula hardware period-to-frequency table (`PAL_CLOCK = 3546895 Hz`).
  - True stereo panning: Channel 0 & 3 to Left, Channel 1 & 2 to Right.
  - Effect processor: 0 (Arpeggio), 1 (Porta Up), 2 (Porta Down), C (Set Volume), D (Pattern Break), F (Set Speed).
  - Web Audio player in `@rgme/web` with volume, play, pause, and track title display.
* **Unit Tests:** `packages/core/src/__tests__/mod-player.test.ts`
  - Verify MOD parsing, note frequency calculation, and pattern sequencing.

---

### Lane 4: Multi-Disk `.m3u` Playlist Engine & In-Game Floppy Swapper (`M3U-001`)
* **Package:** `packages/web` & `packages/core`
* **Implement:**
  - `M3uParser`: reads `.m3u` text files and extracts disk paths (e.g. *Disk 1* to *Disk 11* for *Flight of the Amazon Queen*).
  - Hot-swap controller in `@rgme/web`:
    - Floppy HUD dropdown showing all disks in the active `.m3u` set.
    - Quick-swap shortcut keys (Number keys 1–9 or Next/Prev disk).
    - Triggers `floppyController.eject(0)` and `floppyController.insert(0, nextDisk)` with authentic drive click audio.
* **Unit Tests:** `packages/web/src/__tests__/m3u.test.tsx`.

---

### Lane 5: Commodore 1084S Retro Monitor Bezel Experience (`BEZEL-001`)
* **Package:** `packages/web`
* **Implement:**
  - `Commodore1084sBezel` component framing the WebGL CRT canvas:
    - Realistic retro beige/gray plastic bezel with authentic ventilation slats and Commodore badge.
    - Green/Amber power LED.
    - Clickable Power Switch: turns off monitor with authentic CRT phosphor dot collapse animation!
    - Clickable Degauss Button: triggers slight screen shudder and color demagnetization flash.
    - Fullscreen toggle preserving 4:3 PAL aspect ratio.
* **Unit Tests:** `packages/web/src/__tests__/bezel.test.tsx`.

---

## Gate & Verification Policy
Run the workspace-wide verification gate:
```bash
pnpm test && pnpm build
```
- All tests must pass (including IPF parser, 68000 CPU tests, MOD player, and UI components).
- Commit with author `typelicious <typelicious@gmail.com>`.
- Push to GitHub: `git push origin claude/admiring-gauss-f991hx`.
