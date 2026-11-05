# SkillWeave Execution Sequence: RGME Milestone 5
## Amiga Engine Completeness, Real IPF/MOD, M3U In-Memory Swapper & Impeccable UX

**Project:** Retro Game Modernization Engine (RGME)  
**Milestone:** M5 — 68000 CPU Extended Opcodes & ExecBase Stubs, ProTracker Effects & Live VU-Meters, Universal M3U/ZIP In-Memory Swapper, Freeware Multi-Disk Classics, Impeccable & UI-UX-Pro-Max Usability  
**Methodology:** `assay` (empirical test-driven validation)  
**Autonomy Policy:** `unicorn` (maximum autonomy, aggressive forward momentum)  
**Session Schedule:** `batch`  
**Parallelism:** `maximal`  

---

## Parallel Execution Lanes

### Lane 1: Extended Motorola 68000 CPU Core & ExecBase Traps (`CPU-EXT-001`)
* **Package:** `packages/core`
* **Implement in:** `packages/core/src/cpu/m68k.ts` & `packages/core/src/cpu/amiga-boot.ts`
  - Implement missing opcodes in `M68kCpu`:
    - `CHK` (Check register against bounds, trigger vector 0x18 or continue)
    - `TRAP #n` (Vectors 0x80 + n*4)
    - `MOVEP` (Move peripheral data)
    - `ABCD`, `SBCD`, `NBCD` (BCD decimal arithmetic)
    - `ADDX`, `SUBX`, `NEGX`, `CMPM` (Extended arithmetic with X flag)
    - `ROXL`, `ROXR` (Rotate with extend)
  - Amiga Exec library stubs in `AmigaBootMachine`:
    - Set up ExecBase pointer at address `0x000004` pointing to a virtual jump table.
    - Intercept LVO calls:
      - `_LVOOpenLibrary` (-408) -> returns mock library base (e.g., `graphics.library`, `dos.library`)
      - `_LVOCloseLibrary` (-414) -> no-op / success
      - `_LVOAllocMem` (-198) -> returns memory block pointer
      - `_LVOFreeMem` (-210) -> success
      - `_LVODoIO` (-456) -> completes IO request with success
      - `_LVOPermit` (-138) / `_LVOForbid` (-132) -> state toggles
      - `_LVOFindTask` (-294) -> returns task pointer
  - Verification: Boot block banner code with `$4D45` (`CHK`) executes gracefully past banner text without halting.
* **Unit Tests:** `packages/core/src/__tests__/m68k-ext.test.ts`
  - Opcode execution tests, flag verifications, ExecBase trap execution tests.

---

### Lane 2: Extended ProTracker Audio Engine & VU-Meter Telemetry (`MOD-EXT-001`)
* **Package:** `packages/core`
* **Implement in:** `packages/core/src/audio/mod-replayer.ts` & `packages/core/src/audio/mod-player.ts`
  - ProTracker Effects:
    - 3: Tone Portamento (slides pitch period toward target note at designated speed)
    - 4: Vibrato (oscillates pitch period around note using sine table)
    - 5: Tone Portamento + Volume Slide
    - 6: Vibrato + Volume Slide
    - 7: Tremolo (modulates volume using sine table)
    - 9: Sample Offset (sets sample playback start pointer to `offset * 256`)
    - E-commands:
      - E1 / E2: Fine Portamento Up / Down
      - E6: Pattern Loop
      - E9: Retrigger Note
      - EA / EB: Fine Volume Slide Up / Down
      - EC: Note Cut (silence note after X ticks)
      - ED: Note Delay (delay note attack by X ticks)
  - Timing & Audio Frequency:
    - Ensure period-to-Hz is strictly `PAL_CLOCK / period` (`PAL_CLOCK = 3546895 Hz`).
  - Telemetry:
    - `ModPlayer.getChannelLevels(): [number, number, number, number]` returns normalized [0..1] volume for each of Paula's 4 hardware channels.
    - `ModPlayer.getWaveformData(): Float32Array` returns time-domain PCM chunk for the oscilloscope visualizer.
* **Unit Tests:** `packages/core/src/__tests__/mod-ext.test.ts`
  - Unit tests for all extended effects, period modulation, sample offset, and level telemetry.

---

### Lane 3: Universal Dropzone for M3U/ZIP & Live In-Memory Disk Swap (`M3U-SWAP-001`)
* **Package:** `packages/core` & `packages/web`
* **Implement in:**
  - `packages/web/src/components/Dropzone.tsx`:
    - Support `.m3u` playlist drops: parse files, build disk entries, mount Disk 1 in `DF0:`, and populate `DiskSwapper`.
    - Support `.zip` multi-disk drops: inspect entries, extract `.adf` / `.ipf` images, auto-create playlist if multi-disk.
  - `packages/core/src/drive/floppy-controller.ts`:
    - `swap(driveIndex: number, newBuffer: Uint8Array, name: string)`:
      - Atomically updates drive buffer and active media.
      - Sets track position to cylinder 0.
      - Triggers step sound event.
      - Emits drive status change event.
  - Synchronize with active `RuntimeAdapter`:
    - Call `adapter.mountMedia({ kind: 'floppy', drive: 0, ... })` on disk swap so runtime memory reflects the new disk.
* **Unit Tests:** `packages/core/src/__tests__/floppy-swap.test.ts` & `packages/web/src/__tests__/m3u-dropzone.test.tsx`

---

### Lane 4: Freeware Classics Multi-Disk Showcase & Launchers (`FREEWARE-CLASSICS-001`)
* **Package:** `packages/core` & `packages/web`
* **Implement in:**
  - `packages/core/src/freeware.ts`:
    - Define multi-disk manifests for:
      - *Flight of the Amazon Queen* (11 disks)
      - *Beneath a Steel Sky* (15 disks)
      - *Lure of the Temptress* (4 disks)
    - Include full title, release year, developer, Class C Rights record, disk labels, and synthetic mock buffers for testing.
  - `packages/web/src/components/LibraryShelf.tsx`:
    - Dedicated "Freeware Classics Showcase" section.
    - Multi-disk pill indicators (`11 Disks`, `15 Disks`, `4 Disks`).
    - 1-Click "Mount & Launch" button:
      - Loads Disk 1 into `DF0:`.
      - Automatically sets up `DiskSwapper` with the complete disk playlist.
      - Shows authentic Class C license badge.
* **Unit Tests:** `packages/web/src/__tests__/freeware-shelf.test.tsx`

---

### Lane 5: Impeccable & UI-UX-Pro-Max Usability and Polish Overhaul (`UX-PRO-MAX-001`)
* **Package:** `packages/web`
* **Implement in:**
  - `packages/web/src/components/CommandPalette.tsx`:
    - Fuzzy modal triggered by `Cmd+K` or `/`.
    - Quick actions: launch games, switch runtimes (Mock / WASM / M68K), switch CRT shader presets, swap disks, toggle audio mute, open shortcuts.
  - `packages/web/src/components/KeyboardShortcutsModal.tsx`:
    - Modal triggered by `?` key or header help pill.
    - Shows all keyboard controls (`1-9` disks, `Arrows/Space` D-Pad/Fire, `C` CRT mode, `F` Fullscreen, `M` Mute, `Cmd+K` Command palette).
  - `packages/web/src/components/AudioVisualizer.tsx`:
    - 4-Channel Paula VU meters with Amiga channel coloring (Left: Ch0, Ch3; Right: Ch1, Ch2).
    - Real-time oscilloscope visualizer canvas.
    - Integrates into `ModPlayerPanel.tsx`.
  - Design & Usability Polish:
    - Zero layout shifts (CLS = 0) with reserved dimension grids.
    - Audible floppy drive sound toggle switch.
    - Commodore/Amiga design token refinement per `impeccable-design-spec.md`.
* **Unit Tests:** `packages/web/src/__tests__/ux-pro-max.test.tsx`

---

## Workspace Verification Gate
Run:
```bash
pnpm test && pnpm build
```
- Total test count must increase from 364 to >400.
- All gates green.
- Author: `typelicious <typelicious@gmail.com>`.
- Push to remote branches.
