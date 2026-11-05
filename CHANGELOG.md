# Changelog

All notable changes to the Retro Game Modernization Engine (RGME) are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.9.0] - 2026-11-05

### Added
- **Production WebAssembly Amiga 68000 Hardware Core (`WasmAmigaHardwareCore`):**
  - Full conformance with the RGME WASM Core Contract (`WasmCoreExports`).
  - Memory map: 512 KB Chip RAM, 512 KB Kickstart ROM, 320x256 RGBA32 Framebuffer, and 4-channel Paula PCM audio buffer.
  - PAL 50.00 Hz cycle budget accounting (141,875 cycles per frame).
  - OCS/ECS raster synchronization with dynamic Copper gradient effects and interactive player sprite.
  - Floppy disk sector reader loading ADF track data into Chip RAM.
  - Save state serialization and restoration of CPU, frame counter, and Chip RAM.
- **Kickstart ROM Store & Open AROS Compatibility (`KickstartRomStore`):**
  - Out-of-the-box legally clean open AROS 68k compatibility ROM allowing immediate zero-friction play.
  - Bring Your Own ROM (BYOR) support for authentic Commodore ROMs (1.2, 1.3, 2.04, 3.1) with SHA-256 fingerprinting and IndexedDB persistence.
- **Paula 4-Channel DMA Audio Streamer (`WasmAudioStreamer`):**
  - Web Audio API streaming of 16-bit interleaved PCM samples at 44.1 kHz stereo.
  - Anti-click ramping, DC-offset suppression, and instant muting on pause/reset.
- **Core Telemetry HUD & ROM Settings Dialog (`CoreTelemetryHUD`, `KickstartModal`):**
  - Live hardware telemetry below the monitor (Core Mode, State, Frame count, Active ROM badge).
  - ROM settings modal with drag-and-drop `.rom` / `.bin` importing and active ROM selector.
  - Command palette integration (`Cmd+K` → "Kickstart ROM Settings").

---

## [0.8.0] - 2026-11-05

### Added
- **Steam/YouTube-Inspired Retro Game Discovery Hub (`LibraryShelf`):**
  - Tabbed interface: *My Library*, *Recently Played*, and *Discover & Sources*.
  - Steam-style `GameCard` components with rich badges (Genre, Platform, Year, Studio, Disks, Cloud Link).
  - Multi-version selector for titles with multiple disks or regional releases.
  - Archive.org collection management (`ArchiveSourceStore`) supporting `Amiga-Arquivista`, `Amiga_WHD_Games`, and custom collections.
  - Multi-faceted filter engine (Genre, Year range, Studio, Search query).
- **Playable Amiga Breakout Arcade Mode ("Boing Brick Buster"):**
  - Interactive paddle controlled via keyboard (`◄`/`►`, `A`/`D`) or gamepad.
  - 21 destructible retro bricks in 3 tiers, bounce physics with spin deflection, score, lives, and highscore tracking.
- **Floating Master Reset Layover Button:**
  - One-click panic recovery pill button fixed in the bottom-right corner (`↺ Reset`).
  - Instantly ejects disks, halts motors, clears canvas, silences audio, and returns engine to clean initial state.
- **Audio Desync & Frequency Noise Fixes:**
  - Resync guard in `ChiptunePlayer` preventing audio underrun bursts during CPU-intensive ZIP unpacking.
  - Automatic timeout in `FloppySoundSynth` to prevent endless 48Hz motor sawtooth drone.

---

## [0.7.0] - 2026-11-05

### Added
- **Ephemeral In-Memory Archive.org Cloud Streaming:**
  - Zero-local-storage streaming of retro games directly from Archive.org preservation collections.
  - Streaming proxy middleware and CORS relay for reliable disk image loading.
  - Dynamic responsive 1084S monitor scaling and height clamping.

---

## [0.6.0] - 2026-11-05

### Added
- **Motorola 68000 Interpreter & Amiga Bootblock Runner:**
  - Partial 68000 CPU core with cycle accounting and condition-code semantics.
  - Bootblock runner verifying 32-bit checksums and executing initialization code.
  - Guru Meditation simulation and recovery.

---

## [0.5.0] - 2026-11-05

### Added
- **IPF KryoFlux Preservation Stream Decoder & M3U Multi-Disk Swapper:**
  - Bitstream MFM encoder/decoder with CRC32 verification.
  - In-memory multi-disk swapper supporting hot-swapping across DF0:–DF3:.
- **ProTracker MOD Audio Synthesizer:**
  - 4-channel Paula DMA audio emulation with live oscilloscope and VU meters.

---

## [0.1.0] - [0.4.0] - 2026-11-05

### Added
- Initial project architecture with `@rgme/core`, `@rgme/cli`, and `@rgme/web`.
- Pure TypeScript Amiga Floppy (ADF) filesystem parser and rights intelligence policy matrix.
- High-fidelity WebGL CRT shader pipeline with authentic Commodore 1084S bezel.
- HTML5 Gamepad API integration and IndexedDB save state management.
