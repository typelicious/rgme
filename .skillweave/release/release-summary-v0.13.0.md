# Release Summary: RGME v0.13.0
## Pinned Local Amiga Emulators & GNU GPL-3.0 License Harmonization

- **Version:** `0.13.0`
- **Release Date:** 2026-11-06
- **Author:** `typelicious <typelicious@gmail.com>`
- **Pipeline:** `skillweave-releasechain` (Assay · Unicorn)
- **Status:** APPROVED & PACKAGED

---

### Highlights & Key Improvements

1. **Pinned Local Core Hosting (Zero-Network Offline Execution):**
   - Both primary real Amiga emulators are now hosted Same-Origin directly inside the RGME package:
     - `vAmiga` via `/cores/vamiga/index.html`
     - `PUAE (EmulatorJS)` via `/cores/emulatorjs/data/loader.js`
   - Complete elimination of cross-origin browser alert modals (`Hinweis einer in vamigaweb.github.io eingebetteten Seite`).
   - Air-gapped and offline execution now functions out of the box with zero external CDN dependency.
   - Transparent fallback to upstream CDN/remote instances supported via configurable `baseUrl` and `dataUrl`.

2. **GNU General Public License v3.0 Harmonization:**
   - Full relicensing of RGME engine and packages under **GNU General Public License v3.0 (GPL-3.0-or-later)**.
   - Resolves all potential Copyleft friction with vAmiga (GPL-3.0) and PUAE (GPL-2.0+/GPL-3.0).
   - Firm legal protection maintained for BYOR (Bring Your Own ROM) user Kickstart files and third-party game disks, with CC0 1.0 Universal dedication for synthetic demo assets.

3. **Transparent ZIP Ingestion & Mount Pipeline:**
   - Pre-mount ZIP inspection (`resolveDiskBytesAndName`) unpacks compressed `.adf` floppy disk images on the fly.
   - Eliminates `PK\x03\x04` file mismatch errors in vAmiga and Kickstart "Insert Disk" stalls / Guru Meditations in PUAE.

4. **UI Telemetry & Runtime Selection:**
   - Header dropdown and Core Telemetry HUD reflect `(PINNED)` status chips.
   - Instant switching between vAmiga, PUAE, and fallback runtimes.

---

### Verification Metrics
- **Automated Tests:** 474 / 474 tests passed (100% pass rate across 55 test files).
- **Workspace Build:** Zero errors, all assets packaged into `dist/`.
- **License Compliance:** Verified via `git grep` and standard license headers.
