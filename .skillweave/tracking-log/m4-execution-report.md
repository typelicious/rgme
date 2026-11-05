# RGME Milestone 4 — Execution Report

Gate: `pnpm test && pnpm build` — pass (core 241, cli 19, web 104 = 364 tests; typecheck clean). Chromium smoke test (bezel, 68000 runtime, tracker panel): no console errors.

| Task | Result |
|---|---|
| IPF-001 | `IpfParser` (record CRC32, INFO/IMGE/DATA), Amiga MFM encoder/decoder (round-trip of the fixture ADF is byte-identical), `mountDiskImage`; wired into the drop flow |
| M68K-001 | `M68kCpu` (84 tests), `AmigaBootMachine`, `M68kBootAdapter`; selectable as runtime "68000 (partial)" |
| MOD-001 | `ModParser`/`ModReplayer`/`ModPlayer` (Paula panning, effects 0,1,2,A,B,C,D,F), fixture `rgme-demo.mod` (CC0), player panel |
| M3U-001 | `parseM3u`, `groupDiskSets`, `createDiskSwapper`, hotkeys 1-9 / [ ] , `DiskSwapper` panel (shown for multi-disk profiles) |
| BEZEL-001 | `Commodore1084sBezel` (generic original housing, no Commodore marks): power, degauss, fullscreen; wraps the viewport |

## Honest limitations
- **IPF:** the DATA-area layout is a documented subset checked only against synthetic containers (no real SPS files available); an unprotected real IPF using other features would be reported as protected. Copy protection (fuzzy bits, variable density, flux) is not emulated, and nothing is faked: `toAdf()` returns undefined, mounting throws.
- **68000:** partial interpreter. Not implemented: TRAP, CHK, STOP, MOVEP, BCD, ADDX/SUBX/NEGX/CMPM, ROXL/ROXR, exceptions, interrupts; cycle counts are approximations for MOVEM/DIV. No Kickstart: library calls raise `UnimplementedLibraryCall`. The scene-intro bootblock is banner text, so the CPU halts at `$4D45` (CHK); the intro itself remains a mock scene.
- **MOD:** effects 3,4,5,6,7,9 and all E-effects are ignored; F00 is a no-op. The Hz formula is `PAL_CLOCK / period` (the task's `/(period*2)` is wrong for the period table).
- **m3u:** parser/swapper/hotkeys are wired to the profile's media list; there is no `.m3u` drop zone in the app yet, and swapped disks only change the drive state/`insertMedia`, not game memory.
- Sound (MOD, chiptune, drive) and bezel animations were verified structurally, not by ear/eye in motion.
