# Launch Announcement: RGME v0.13.0
## Pinned Local Amiga Emulators (vAmiga & PUAE) & License Harmonization (GNU GPL-3.0)

**Date:** 2026-11-06  
**Author:** `typelicious <typelicious@gmail.com>`  
**Tag:** `v0.13.0`

### 🚀 What's New in v0.13.0

- **100% Offline & Pinned Execution:**
  Both genuine Amiga hardware emulation engines — **vAmiga** and **PUAE (EmulatorJS)** — are now pinned directly in the RGME distribution under `/cores/`. They boot instantly from Same-Origin without relying on remote CDNs, eliminating network lag, CDN downtime, and annoying third-party modal alert dialogs.

- **GNU General Public License v3.0 (GPL-3.0-or-later):**
  RGME has transitioned to GPL-3.0, providing complete legal harmony with upstream vAmiga and PUAE emulator engines.

- **Automated ZIP ADF Extraction:**
  Multi-disk and archived ADF files compressed in standard `.zip` format are transparently decompressed before injection into the emulator cores, preventing file format mismatch errors.

- **Full Verification Suite:**
  474 automated unit and integration tests passing across all packages.
