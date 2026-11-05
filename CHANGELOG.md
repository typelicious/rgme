# Changelog

All notable changes to the Retro Game Modernization Engine (RGME) are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.10.0] - 2026-11-05

### Added
- **Default WebAssembly Hardware Core & Universal Media Resilience:**
  - WebAssembly Amiga 68000 Core is now the default runtime on page load (`runtimeKind = "wasm"`).
  - Added synthetic fallback floppy disk generator (`generateBootableAdfFallback`) in `MediaRegistry` producing valid 901,120-byte Amiga bootable floppies with authentic DOS header and checksum for multi-disk showcase titles (*Beneath a Steel Sky*, *Flight of the Amazon Queen*), demos, and unmounted media without byte-lookup errors.
- **Slide-Over Control Center Drawer (`SidebarDrawer`):**
  - Removed fixed 320px left column from the document flow; page monitor is centered and occupies full workspace width.
  - Sidebar opens as an overlay drawer pane via header icon button (`🎛️ Drives & Tools`) and floating pill trigger.
  - Organized internally into a responsive two-column layout (`col1`: Dropzone & Demos, `col2`: Floppy drives, Swapper, Inspector, Export).
- **Contextual Monitor Corner CRT Controls:**
  - Scanline controls moved from under the monitor to an icon button in the top-right corner of the monitor bezel.
  - Triggers a downward-left popover layover with CRT toggle, preset selector, and parameter sliders (scanlines, glow, curvature).
- **Authentic Amiga Guru Meditation Error Layover (`GuruMeditationOverlay`):**
  - Runtime errors displayed as authentic centered Amiga Guru Meditation modals with blinking red border and error details.
  - Dismissing minimizes the error into an unobtrusive blinking pill in the bottom-left corner (`fixed bottom-6 left-6`); clicking restores full modal details.
- **Draggable Compact Remote Control (`FloatingRemoteControl`):**
  - Directional D-Pad (Up, Down, Left, Right) and action buttons (1, 2) packaged into a draggable, compact glass floating remote.
  - Minimizes into a quick-access controller icon in the bottom-right corner (`fixed bottom-6 right-28`, to the left of the Reset button).
- **Lower Content Section Reordering:**
  - Content sections sequenced as:
    1. **Retro Game Library** (`LibraryShelf`)
    2. **ProTracker Player** (`ModPlayerPanel`)
    3. **Chain of Title** (`ChainOfTitle`)

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
