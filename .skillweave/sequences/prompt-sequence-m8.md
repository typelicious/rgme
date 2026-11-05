# SkillWeave Prompt Sequence: Milestone 8 (M8)

- **Target:** Mixed (Core Architecture, Storage, UI Componentry & Hub Overhaul)
- **Methodology:** Assay
- **Autonomy Policy:** Unicorn
- **Gate:** `pnpm test && pnpm build` 100% Green
- **Author:** `typelicious <typelicious@gmail.com>`

---

## Batch 1: Core Architecture & Data Engine
- **Tasks:**
  - `M8-SOURCES-001`: Archive.org Connected Source Management System
  - `M8-DISCOVERY-001`: Multi-Faceted Metadata Extraction & Filter Engine
- **Scope:**
  - `packages/core/src/archive/archive-source-store.ts`:
    - Manage and persist connected Archive.org collections (ID, Title, Description, Item Count, Last Sync, Custom Flag) in IndexedDB / Memory store.
    - Default built-in sources: `Amiga-Arquivista` and `Amiga_WHD_Games`.
  - `packages/core/src/archive/archive-metadata-parser.ts`:
    - Intelligent title & metadata heuristic extraction:
      - Genre classification (Adventure, Action, RPG, Simulation, Strategy, Platformer, Puzzle, Shooter, Demo/Scene).
      - Release year detection (e.g. `1989`, `1992`, `1995`).
      - Studio/Publisher extraction (LucasArts, Cinemaware, Team17, Psygnosis, Ocean, MicroProse, Delphine Software, Revolution Software, etc.).
      - Disk count & multi-disk parsing (`Disk 1 of 4`, `Disk 1 of 11`, `1 Disk`).
      - Region / Edition tag detection (`(EU)`, `(DE)`, `(US)`, `(Fr)`, `(AGA)`, `(ECS)`, `(OCS)`).
    - Multi-version grouping: Groups identical/related titles with multiple disks or regional editions into a unified game entity with selectable links.
    - Faceted search & filter function (by genre, year range, studio, source, and search query).
  - `packages/core/src/library/library-store.ts`:
    - Extend `GameLibraryStore` to support Bookmarked Cloud Games (with title, metadata, source URL/identifier, and primary disk/archive) and History ("Recently Played" with timestamps).
  - `packages/core/src/__tests__/m8-core.test.ts`: Unit tests verifying source store persistence, metadata heuristic parsing, multi-version grouping, and faceted filtering.

---

## Batch 2: UI Componentry & Steam/YouTube-Style Hub
- **Tasks:**
  - `M8-CARDS-001`: Steam-Inspired Game Cards & Multiple-Version Resolver
  - `M8-LIBRARY-001`: Overhauled Library Hub (My Library, Recently Played, Browse Sources)
- **Scope:**
  - `packages/web/src/components/GameCard.tsx`:
    - Render Steam-inspired card with title, genre badge, year, studio pill, disk count, and cloud link indicator.
    - Multi-version dropdown / selector for games with multiple disks or regional editions.
    - 1-click "Stream & Mount DF0:" action with simulated floppy seek sound and progress indicator.
    - "★ Bookmark / Add to My Library" toggle action with instant persistence.
  - `packages/web/src/components/SourceManagerModal.tsx`:
    - Modal for adding, inspecting, refreshing, and removing connected Archive.org sources with status and item counts.
  - `packages/web/src/components/LibraryShelf.tsx`:
    - Full redesign into a tabbed retro gaming hub:
      - Tab 1: **"My Library"** (Bookmarked cloud titles + locally dropped games + built-in freeware classics).
      - Tab 2: **"Recently Played"** (History with timestamps and quick re-mount).
      - Tab 3: **"Discover & Sources"** (Full searchable catalog across sources with facet filters for Genre, Year, Studio, and Source switcher).
  - `packages/web/src/App.tsx`:
    - Connect LibraryShelf, SourceManager, and GameCard actions into runtime, floppy controller, and bookmark/history stores.
  - `packages/web/src/__tests__/m8-integration.test.tsx`:
    - End-to-end integration tests verifying source addition, metadata filtering, card version selection, bookmarking into My Library, and Recently Played tracking.

---

## Batch 3: Verification, Documentation & Release Gate
- Full monorepo verification: `pnpm test && pnpm build`.
- Update `.skillweave/prds/prd.json` to mark M8 tasks `passes: true`.
- Update execution report `.skillweave/tracking-log/m8-execution-report.md`.
- Git commit authored strictly by `typelicious <typelicious@gmail.com>` (zero Claude lines) and push to remote.
