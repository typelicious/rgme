# RGME v0.11.0 — Milestone 11 Release Notes

**Release Date:** 2026-11-05  
**Author:** `typelicious <typelicious@gmail.com>`  
**Verification:** 457 / 457 tests passing (100% green across `@rgme/core`, `@rgme/web`, `@rgme/cli`)

---

## 🚀 Key Highlights & New Capabilities

### 1. ADR-004 Real Amiga Emulation Bridge (`M11-EMU-001`)
- Implemented `EmulatorJsPuaeAdapter` (aliased as `WasmEmulatorAdapter`) adhering to the strict `RuntimeAdapter` boundary per ADR-004 and ADR-007.
- Connects full Amiga OCS/ECS PUAE / WebAssembly emulation engines for executing genuine commercial game disks (such as *Rick Dangerous*, *Wayne Gretzky Hockey*, *Turrican*, etc.).
- Added Full Amiga Emulator mode (`puae`) to the Header Runtime Selector and Runtime Switcher alongside the Lightweight WebAssembly Hardware Reference Core.
- Integrated canvas lifecycle, WebAudio Paula routing, semantic joystick mapping, save-state slot management, and dynamic snapshot serialization.

### 2. Persistent Kickstart ROM & Dynamic Runtime Synchronization (`M11-KICKSTART-001`)
- `KickstartRomStore` now persists the active Kickstart ROM selection in `localStorage` (`rgme_active_kickstart_rom_id`).
- Switching to a user-uploaded custom Kickstart ROM (e.g. `kick40063.A600`, Kickstart 1.3, 2.04, 3.1) immediately disposes and recreates the running Amiga runtime with the custom ROM bytes, never silently resetting to AROS on reload or game mount.

### 3. Universal In-Memory Archive & Disk Extraction (`M11-DISK-001`)
- Library and file drop pipelines transparently decompress `.zip` archives in-memory, extracting inner `.adf` disk files and registering both the archive hash and the extracted disk hash into `MediaRegistry`.

### 4. Interactive Arcade Boost & Clean Alphanumeric Titles (`M11-PHYSICS-001`)
- Fixed ball rebound physics in the reference core so Space / Up keys reliably boost the ball upwards even from the floor in all monitor viewports.
- Strengthened disk title parsing to strictly require alphanumeric tokens and reject binary header garbage.

---

## 🛡️ Binary Gates & Verification
- Unit & Integration Tests: **457 passed, 0 failed**
- TypeScript build & Vite bundling: **clean zero-error production build**
- Author identity: **typelicious <typelicious@gmail.com>**
