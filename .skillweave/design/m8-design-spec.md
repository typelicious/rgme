# Milestone 8 Design Specification: Rich Library, Source Management & Steam/YouTube-Style Discovery

## 1. Executive Summary & Design Goals
Milestone 8 transforms the RGME Library from a static local showcase into a dynamic, Steam/YouTube-inspired retro gaming hub. Users can manage Archive.org collection sources, browse thousands of retro titles with rich card metadata, filter by genre, year, and studio, resolve multiple source links/versions, bookmark items into "My Library", and track their "Recently Played" history.

## 2. Design-Thinking Lens (SkillWeave Design Principles)
1. **Value ≥ Noise**: Cards emphasize title, studio, year, genre, and disk count; secondary technical details (exact cluster mirrors, internal URLs) are progressive disclosures.
2. **Scan Before Read**: High-contrast badges for Genre (`[Adventure]`, `[Action]`), Platform (`[OCS]`, `[AGA]`), and Format (`[11 Disks]`, `[WHDLoad]`).
3. **Hierarchy of Needs**:
   - Level 1: Launch / Stream immediately in 1 click.
   - Level 2: Bookmark / Add to "My Library".
   - Level 3: Select source versions (EU vs DE, Disk vs WHDLoad).
   - Level 4: Manage & add custom Archive.org sources.
4. **Progressive Disclosure**: Cards display essential info upfront; clicking "Versions / Links" opens a neat pill drawer showing available formats and mirrors.
5. **Recognition Over Recall**: Familiar Steam shelf layout (Tabs: *My Library*, *Recently Played*, *Discover & Sources*), with YouTube-like horizontal scrollable quick shelves and robust facet filters.
6. **Error Tolerance**: Graceful fallback when an Archive.org mirror is unreachable; automatic retry with CORS relay; non-destructive unbookmarking.

## 3. Design Tokens & UI Specs
- **Shelves & Tabs**:
  - `tab-active`: Background `var(--rgme-bg-panel, #15161e)`, border `var(--rgme-accent, #38bdf8)`, text `#f8fafc`.
  - `tab-inactive`: Text `var(--rgme-fg-muted, #94a3b8)`, hover text `#e2e8f0`.
- **Game Cards**:
  - Card background: `#13141c`, border: `1px solid #232734`, hover border: `rgba(56, 189, 248, 0.5)`.
  - Aspect ratio: Compact horizontal card / banner format fitting the dark cyber-retro aesthetic.
  - Badges:
    - Genre: `#1e293b` with `#38bdf8` text.
    - Year / Studio: `#181b24` with `#94a3b8` text.
    - Disks: `#1f2937` with `#f59e0b` text.
    - Cloud Link: `#0f273b` with `#38bdf8` icon.
- **Controls & Search Bar**:
  - Filter Bar: Sticky top bar with Search input, Genre dropdown, Year slider/select, Studio filter, and "Manage Sources ⚙️" button.
