# Product Requirements Document (PRD) v0.8.0
## Retro Game Modernization Engine (RGME) — Milestone 8: Rich Library Overhaul, Source Management & Steam/YouTube-Style Retro Discovery Hub

- **Version:** 0.8.0
- **Status:** In Progress
- **Framework:** SkillWeave Blueprint + SkillWeave Design
- **Author:** `typelicious <typelicious@gmail.com>`

---

## 1. Executive Summary & Problem Statements

Milestone 8 addresses the library usability and discovery experience of RGME:
1. **Explanation of Freeware Classics Display:**
   - The user asked why the freeware showcase titles (*Flight of the Amazon Queen*, *Beneath a Steel Sky*, *Lure of the Temptress*) display the interactive 3D Amiga Boing Ball simulation instead of the full commercial Amiga game binary.
   - The ~30 MB commercial floppy disk images are not stored in Git to keep the repo clean. The `MockRuntimeAdapter` runs an authentic interactive Amiga Boing Ball physics simulation.
   - To make full games accessible, RGME now enables users to stream real disks directly from preservation sources (Archive.org) on demand.
2. **Library Expansion & Multi-Source Management:**
   - Users need the ability to connect, manage, and discover multiple Archive.org collections (e.g., `Amiga-Arquivista`, `Amiga_WHD_Games`, custom TOSEC or CDTV collections).
3. **Steam & YouTube-Inspired Game Discovery:**
   - Games should be presented in clean, informative card items with rich metadata (Genre, Year, Developer/Studio, Disk Count, Platform, Format).
   - Multi-faceted filtering by genre, release year, studio, and free-text search.
   - When a game exists in multiple versions or sources (e.g., EU vs DE, WHDLoad vs multi-disk ADF), users can view and select the exact link/version.
   - Curated and personalized discovery shelves: "My Library" (Bookmarked cloud titles + local games), "Recently Played" (History), and "Discover & Sources" (Full catalog).

---

## 2. Milestone 8 Task Breakdown

### Task 1: `M8-SOURCES-001` — Archive.org Source Management System
- **Goal:** Model, persist, and manage connected Archive.org retro game collections.
- **Acceptance Criteria:**
  - `ArchiveSourceStore` in `@rgme/core` persisting connected collections in IndexedDB (with in-memory fallback).
  - Default preset sources: `Amiga-Arquivista`, `Amiga_WHD_Games`.
  - Add, remove, and refresh custom collections/identifiers with live item count and status.
  - Source Manager modal (`SourceManagerModal.tsx`) with clean management controls.

### Task 2: `M8-DISCOVERY-001` — Rich Metadata Extraction & Multi-Faceted Filter Engine
- **Goal:** Transform raw Archive.org filenames and metadata into structured, searchable retro game records.
- **Acceptance Criteria:**
  - Metadata parser extracting Genre, Release Year, Studio/Developer, Multi-Disk count, and Region/Language from title strings.
  - Multi-faceted filter engine supporting Genre filtering (Adventure, Action, RPG, Simulation, Strategy, etc.), Year range, Studio, and keyword search.
  - Multi-version grouping: Groups related disks/variants into a single unified game card with multiple link options.

### Task 3: `M8-CARDS-001` — Steam-Inspired Game Cards & Multi-Link Resolver
- **Goal:** Rich, aesthetic card component for retro games with seamless 1-click launch and bookmarking.
- **Acceptance Criteria:**
  - `GameCard.tsx` rendering title, genre badge, year, studio pill, disk count, and cloud link source.
  - "Versions / Links" dropdown/selector when multiple versions or disks are detected.
  - "Stream & Mount DF0:" primary action with simulated floppy seek audio.
  - "★ Bookmark / Add to Library" toggle action.

### Task 4: `M8-LIBRARY-001` — Overhauled Library Hub (My Library, Recently Played, Discover)
- **Goal:** Replace static bottom shelf with a modern Steam/YouTube-style tabbed retro hub.
- **Acceptance Criteria:**
  - 3 primary tabs:
    - **"My Library"**: User's bookmarked cloud games + local dropped games + freeware showcase.
    - **"Recently Played"**: Chronological history of streamed/launched games with fast re-mount.
    - **"Discover & Sources"**: Browsable multi-source catalog with filters and source selector.
  - Responsive layout matching the dark cyber-retro RGME design system.

---

## 3. Verification & Quality Gates
- 100% green tests across `@rgme/core`, `@rgme/cli`, and `@rgme/web`.
- Monorepo production build clean (`pnpm build`).
- Author strictly `typelicious <typelicious@gmail.com>`.
