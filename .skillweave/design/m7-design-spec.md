# Milestone 7 Design & Architecture Specification: Proportional Bezel Scaling, Amiga OCS Core Engine & Archive.org Cloud Streamer

- **Document Version:** 1.0.0 (Milestone 7 / v0.7.0)
- **Author:** `typelicious <typelicious@gmail.com>`
- **Date:** 2026-11-05
- **Status:** APPROVED

---

## 1. Problem Space & Context

Milestone 7 addresses three architectural and user-experience frontiers:

1. **Bezel Scaling Ergonomics (`M7-SCALING-001`):**
   - *Problem:* Milestone 6 enforced a rigid `600px` max-height and `820px` max-width. On 1080p, 1440p, 4K, and ultrawide displays, the monitor shrank to an undersized box surrounded by vast dead space.
   - *Design Goal:* The monitor must expand proportionally with screen height while retaining its authentic 4:3 CRT aspect ratio, but strictly stay within the viewport height minus controls budget (`calc(100vh - 250px)`), so the user never needs to scroll vertically to access emulation controls, disk swappers, or HUD.

2. **Real Playable Amiga OCS/ECS Core Engine (`M7-CORE-001`):**
   - *Problem:* Currently, real Amiga bootblocks halt when calling AmigaOS `ExecBase` library vectors (e.g. `DoIO`, `AllocMem`, `OpenLibrary`), and display output was restricted to color register lines or simulated test patterns.
   - *Architecture Goal:* Provide an authentic planar Amiga display controller:
     - Bitplane renderer supporting 1–6 bitplanes (planar to 320x256 32-color chunky RGBA conversion).
     - Copper list runner (`COP1LCH`, `COPJMP1`) executing `MOVE` (register writes) and `WAIT` (beam synchronization) commands.
     - Synthetic ExecBase Kickstart vector dispatcher answering core system calls (`AllocMem`, `FreeMem`, `DoIO`, `SendIO`, `WaitIO`, `OpenLibrary`, `FindTask`, `CloseLibrary`) with valid OS structures, allowing real bootblock intros and demos to run past OS initialization.

3. **Archive.org Ephemeral Cloud Streamer (`M7-ARCHIVE-001`):**
   - *Problem:* Users want instant access to public-domain, freeware, and historical preservation titles from Archive.org (e.g. `Amiga-Arquivista`, `Amiga_WHD_Games`) without RGME hosting, indexing, or redistributing copyrighted binaries.
   - *Legal & Technical Goal:* Pure client-side ephemeral streaming:
     - Direct in-memory fetching into a `Uint8Array` (RAM only).
     - In-memory `.zip` extraction via `ZipParser` (`DecompressionStream`).
     - SHA-256 calculation and evaluation against RGME's `RightsPolicyEngine`.
     - Direct virtual floppy mounting into DF0:–DF3: with simulated seek sounds.
     - Instant memory purge on eject/unload (Zero local storage, zero server-side binary hosting).

---

## 2. Layout & Responsive Geometry Specification

### 2.1 Viewport Vertical Budget Formula
The vertical space in the right main column is divided as follows:
- Header & margins: ~70px
- Controls toolbar (`Start`, `Pause`, `Reset`, `Unload`, `Save`, `Load`, `Mute`): ~46px
- Controller HUD & mapping trigger: ~80px
- Padding & gap allowances: ~54px
- **Total non-monitor vertical overhead: ~250px**

### 2.2 Proportional 4:3 Scaling Rules
```css
/* Container sizing */
.rgme-viewport-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  width: 100%;
}

/* 1084S Bezel sizing: scales with available height, capped to aspect ratio */
.bezel-outer {
  /* Height scales with viewport, leaving 250px for toolbar and HUD */
  height: clamp(340px, calc(100vh - 250px), 88vh);
  /* Width follows 4:3 ratio + 44px bezel frame */
  width: min(100%, calc((clamp(340px, calc(100vh - 250px), 88vh) - 90px) * 1.3333 + 44px));
  max-width: none; /* No artificial 820px bottleneck */
  margin: 0 auto;
}

/* Controls container matches the bezel width dynamically */
.rgme-controls-container {
  width: min(100%, calc((clamp(340px, calc(100vh - 250px), 88vh) - 90px) * 1.3333 + 44px));
  margin: 0 auto;
}
```

---

## 3. Amiga OCS Core Architecture (`M7-CORE-001`)

```
+-------------------------------------------------------------+
|                     M68kCpu (Interpreter)                   |
|  - 68000 opcodes: Data, Address, Logic, Shifts, BCD, Control|
+------------------------------+------------------------------+
                               | Read / Write / Step
+------------------------------v------------------------------+
|                        AmigaBus                              |
|  - Chip RAM (512 KB / 1 MB / 2 MB)                          |
|  - Custom Registers ($DFF000 - $DFF1FE)                     |
|  - Fake ExecBase ($000400) + LVO Vector Table               |
+---------------+-----------------------------+---------------+
                |                             |
+---------------v---------------+ +-----------v---------------+
|        Copper Engine          | |      Bitplane Engine      |
| - COP1LCH / COP2LCH ptrs      | | - 1 to 6 bitplane pointers|
| - Instructions: MOVE, WAIT    | | - Planar to Chunky 320x256|
| - Synchronized with scanline  | | - COLOR00-COLOR31 palette |
+-------------------------------+ +---------------------------+
```

---

## 4. Archive.org Streaming Connector Architecture (`M7-ARCHIVE-001`)

```
+--------------------------------------------------------------+
|                   User / Cloud Catalog UI                    |
|   - Identifier: e.g. "Amiga-Arquivista", "Amiga_WHD_Games"   |
|   - Custom Archive.org URL or Direct File Item               |
+------------------------------+-------------------------------+
                               | 1. Query Metadata
+------------------------------v-------------------------------+
|      https://archive.org/metadata/{id}/files                 |
|   - Filters for .adf, .ipf, .d64, .zip                       |
+------------------------------+-------------------------------+
                               | 2. User selects title
+------------------------------v-------------------------------+
|                 ArchiveOrgConnector (Core)                   |
|   - Fetch binary stream directly into Uint8Array (RAM)       |
|   - If ZIP: unpack in-memory via DecompressionStream         |
|   - Calculate SHA-256 checksum                               |
+------------------------------+-------------------------------+
                               | 3. Rights Evaluation
+------------------------------v-------------------------------+
|                    RightsPolicyEngine                        |
|   - Evaluate against Matrix & Public Records                 |
|   - Private Execution vs Redistribution cleared / verified  |
+------------------------------+-------------------------------+
                               | 4. Mount & Execute
+------------------------------v-------------------------------+
|       FloppyController (DF0:) -> Amiga Runtime Adapter        |
|   - Mechanical seek sound, instant boot, 50Hz playback       |
|   - On EJECT/UNLOAD: Buffer set to null, memory freed        |
+--------------------------------------------------------------+
```

---

## 5. Security & Legal Boundaries
1. **Zero Piracy Mirroring:** RGME servers never touch, proxy, or mirror game files.
2. **Client-Side Ephemeral Use:** All bytes reside solely in user browser memory.
3. **Rights Classification:** If a downloaded file matches known commercial titles with restricted rights, `RightsPolicyEngine` marks redistribution as `restricted`, disabling Export/Share buttons.
