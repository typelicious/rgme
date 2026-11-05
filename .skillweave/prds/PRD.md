# Product Requirements Document (PRD)
## Retro Game Modernization Engine (RGME) — Milestone 1 Specification

**Version:** 0.2.0  
**Status:** Ready for Execution (Milestone 1 Foundation Slice)  
**Parent Strategy:** `concept/RGME-Overall-Concept-v0.2.md` & `concept/RGME-MVP-Technical-Specification-PRD-v0.2.md`  
**Execution Budget Target:** $15 Claude Cloud run (estimated ~3–4 hours of agentic generation)  

---

## 1. Executive Summary & Vision

The Retro Game Modernization Engine (RGME) is a local-first, browser-first platform for playing, preserving, and modernizing classic computer games.

The **Golden Architectural Law** of RGME:
> **Original content is immutable.** Identity, runtime configuration, rights evidence, controls, presentation, saves, and future enhancements exist purely as external, declarative, versioned layers.

The **Golden Policy Law** of RGME:
> **Unknown rights never become permission by inference.**

Milestone 1 builds the structural foundation and an end-to-end verifiable demonstrator slice: monorepo architecture, strict domain schemas, the rights policy engine, the `RuntimeAdapter` abstraction with a verifiable mock runtime, a local CLI scanner, and a web UX shell designed with the RGME design system.

---

## 2. Target Users & Problem Statement

### 2.1 Problem
Classic Amiga game preservation and modern emulation are plagued by fragmented configurations, manual input mapping, messy ROM folders, zero rights provenance, and tight coupling to specific emulator binaries.

### 2.2 Personas
1. **The Collection Owner:** Possesses local retro files (e.g., ADF dumps). Wants to index, inspect rights status, and play seamlessly in a modern browser.
2. **The RGME Developer/Researcher:** Authors declarative Game Profiles, implements runtime adapters, and maintains the Rights Matrix evidence store.

---

## 3. Scope & Phasing

### 3.1 In Scope for Milestone 1 ($15 Budget Run)
- **Monorepo Setup:** `@rgme/core`, `@rgme/cli`, and `@rgme/web` configured with TypeScript and Vitest.
- **Domain Schemas (`@rgme/core`):** Zod models for `GameProfile` (schema `rgme.game/v0.2`), `MachineConfig`, `RightsRecord`, and `RightsPolicyEngine`.
- **Runtime Abstraction (`@rgme/core`):** Universal `RuntimeAdapter` interface + `MockRuntimeAdapter` implementing video frames (Canvas), audio tones, input handling, and save-state slots.
- **CLI Ingestion (`@rgme/cli`):** `rgme scan <dir>` to recursively read ADFs, compute SHA-256 hashes, match rights, and emit GameProfiles.
- **Web UI Shell (`@rgme/web`):** Built with Vite and React, implementing the design tokens from `.skillweave/design/rgme-design-system.md` (Amiga Workbench/Boing Ball accents, drag-and-drop zone, canvas viewport with 4:3 lock and CRT scanline toggle, controller HUD).
- **End-to-End Verification:** Automated tests proving the entire pipeline from file ingestion to mock playback.

### 3.2 Out of Scope for Milestone 1 (Planned for Subsequent Milestones)
- Full WASM compilation / bundler embedding of EmulatorJS and libretro PUAE binaries (Milestone 2).
- Dynamic WHDLoad/LHA disk extraction and filesystem patching (Milestone 2).
- Ghidra static analysis automation and REA agentic reverse-engineering workbench (Milestone 3).

---

## 4. Technical Architecture

```text
[ Local Amiga ADF Files ]
           │
           ▼
   [@rgme/cli Scanner] ──(SHA-256)──► [Rights Matrix Registry]
           │                                   │
           ▼                                   ▼
    [GameProfile v0.2] ────────────► [Rights Policy Engine]
           │                                   │
           ▼                                   ▼
   [@rgme/web UI Shell] ◄────────────── [Policy Decision]
           │
           ▼
   [RuntimeAdapter (Interface)]
           │
           ├──► [MockRuntimeAdapter] (Milestone 1 Demonstrator)
           └──► [PUAE / EmulatorJS]  (Milestone 2 Integration)
```

### 4.1 Data Contracts & Boundaries

| Boundary | Producer | Consumer | Artifact / Contract | Rule |
| :--- | :--- | :--- | :--- | :--- |
| **Storage / Profile** | `@rgme/cli` / User | `@rgme/web` | `GameProfile` YAML/JSON (`rgme.game/v0.2`) | Strict Zod validation; original ADF untouched. |
| **Rights Evaluation** | Master Rights JSON | Policy Engine | `RightsRecord` + `RightsDecision` | Never infer permission from missing data. |
| **Runtime Boundary** | `@rgme/web` | `RuntimeAdapter` | `RuntimeCapabilities`, `DisplayProfile`, `InputMapping` | UI never accesses emulator memory/internals directly. |

---

## 5. Success Metrics & Binary Gates

1. **Gate 1 (Build):** `pnpm build` (or `npm run build`) builds all 3 packages (`@rgme/core`, `@rgme/cli`, `@rgme/web`) with zero errors.
2. **Gate 2 (Unit Tests):** `pnpm test` executes Vitest across the monorepo with 100% test pass rate.
3. **Gate 3 (Rights Policy):** Policy engine tests verify that unknown rights evaluate to `local_only` or `deny`, never `allow_distribution`.
4. **Gate 4 (UI & Adapter):** Web UI renders viewport, mounts `MockRuntimeAdapter`, outputs test canvas frames at 50fps (PAL timing), and provides CRT shader toggle.
