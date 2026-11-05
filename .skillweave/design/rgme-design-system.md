# RGME Design System & UX Specification
Derived via `/skillweave-design` lens for Retro Game Modernization Engine.

## 1. UX Principles & Ergonomics

1. **Immersion First (Zero Distraction):**
   - When a game is running, the chrome retreats. Controls, stats, and badges fade unless focused or hovering.
   - Contrast is engineered around the game canvas: dark, matte charcoal background (`#0d0f17`) to prevent eye fatigue and backlight bleed.

2. **Immediate Feedback (< 100ms):**
   - File drag-and-drop triggers immediate visual pulse, rapid SHA-256 computation, and instant status display (Identified / Analyzing / Unknown).
   - Game state save/load provides instant visual and audio cue (subtle disk-read chirp or status pill).

3. **Honest Presentation (No Fake Widescreen):**
   - Original PAL 4:3 pixel aspect ratios are preserved by default.
   - Any modern stretching or AI-scaling must be explicitly opted into by the user and labeled "Aspect Altered".

4. **Progressive Disclosure:**
   - Quick launch requires 1 click (drag ADF -> Launch).
   - Technical details (chipset: OCS/ECS/AGA, kickstart version, RAM allocation, rights matrix provenance) are tucked into an expandable drawer.

5. **Clarity & Provenance Over Obscurity:**
   - Rights status is visually unmistakable:
     - 🟢 **Authorized / Public Domain / Freeware**: Full features unlocked.
     - 🟡 **Local Execution Only (Unknown Rights)**: Permitted locally, redistribution disabled.
     - 🔴 **Restricted / Unverified**: Explicit explanation why an action is blocked.

---

## 2. Design Tokens

### 2.1 Color Palette
```css
:root {
  /* Surface & Backgrounds */
  --rgme-bg-canvas: #090a0f;
  --rgme-bg-surface-base: #11141d;
  --rgme-bg-surface-elevated: #1a1e2c;
  --rgme-bg-surface-overlay: rgba(26, 30, 44, 0.85);
  
  /* Borders & Dividers */
  --rgme-border-subtle: #242a3d;
  --rgme-border-focus: #3d5afe;
  --rgme-border-glow: rgba(61, 90, 254, 0.35);

  /* Typography & Foreground */
  --rgme-fg-primary: #f0f3fc;
  --rgme-fg-secondary: #9da8c3;
  --rgme-fg-muted: #5e6882;
  --rgme-fg-inverse: #090a0f;

  /* Amiga & Retro Heritage Accents */
  --rgme-accent-boing-red: #ff334b;
  --rgme-accent-boing-white: #ffffff;
  --rgme-accent-workbench-blue: #0055aa;
  --rgme-accent-workbench-orange: #ff8800;
  --rgme-accent-phosphor-green: #39ff14;
  --rgme-accent-phosphor-amber: #ffb000;

  /* Rights Intelligence Status Tokens */
  --rgme-status-cleared-bg: rgba(16, 185, 129, 0.15);
  --rgme-status-cleared-fg: #10b981;
  --rgme-status-cleared-border: #059669;

  --rgme-status-localonly-bg: rgba(245, 158, 11, 0.15);
  --rgme-status-localonly-fg: #f59e0b;
  --rgme-status-localonly-border: #d97706;

  --rgme-status-restricted-bg: rgba(239, 68, 68, 0.15);
  --rgme-status-restricted-fg: #ef4444;
  --rgme-status-restricted-border: #dc2626;
}
```

### 2.2 Typography
- **Monospace / Retro Headers:** `"Courier New"`, `"Topaz"`, `"JetBrains Mono"`, monospace (for hashes, memory addresses, rights IDs, and retro badges).
- **Body & Controls:** `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` for clean readability and accessibility.
- **Font Scale:**
  - `text-xs`: 0.75rem (12px) - Hashes, metadata badges
  - `text-sm`: 0.875rem (14px) - Secondary descriptions, table rows
  - `text-base`: 1.0rem (16px) - Primary body, inputs, buttons
  - `text-lg`: 1.125rem (18px) - Section headers, card titles
  - `text-xl`: 1.25rem (20px) - Page titles, modal headings

### 2.3 Spacing & Radius
- Base spacing unit: 4px (`4px, 8px, 12px, 16px, 24px, 32px`).
- Border radii:
  - Buttons / Badges: `4px` (tactile retro feel, avoiding ultra-rounded bubbles)
  - Cards / Panels: `6px`
  - Viewport Container: `0px` or `2px` with sharp CRT bevel option

### 2.4 Display & Viewport Presets
1. **Authentic PAL:**
   - Native 320x256 (lowres PAL) or 640x512 (interlaced) scaled with integer multiplier (`image-rendering: pixelated`).
2. **CRT Simulation:**
   - Scanline overlay (CSS linear-gradient + subtle radial bloom mask).
3. **Enhanced Retro:**
   - High-fidelity integer scaling with aspect ratio lock (4:3) and custom bezel.
