# RGME Impeccable Design & UX Specification (v0.5.0)
Formulated with `/skillweave-design` using principles from **Impeccable** and **UI-UX-Pro-Max**.

## 1. Ergonomic & Aesthetic Tenets

### 1.1 Anti-AI-Slop Laws
1. **No Generic Purples or Overused Inter Gradients:** The palette is deeply anchored in Commodore Amiga heritage:
   - Deep Onyx CRT Canvas: `#080a11` with subtle scanline / phosphorus depth.
   - Workbench 1.3 / 2.0 / 3.1 Accents: Topaz Blue (`#0055aa`), Amiga Orange (`#ff8800`), Commodore Crimson (`#e60026`).
   - Tactile Control Surfaces: Matte slate `#131826` with 1px `#232d42` mechanical borders and 0px-4px retro-sharp radii.
2. **Typographic Hierarchy & Character:**
   - Primary UI: High-legibility system sans (`-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`) with tight, intentional tracking.
   - Retro Headings & Telemetry: Monospace (`"Topaz", "Courier New", "JetBrains Mono"`) for registers, track counters, chip addresses, and rights codes.
3. **Zero Layout Shifts (CLS = 0):** All viewports, floppy drive bays, tracker oscilloscopes, and drawer panels maintain strict fixed aspect ratios and reserved dimensions.
4. **Immediate Tactile Feedback (< 50ms):**
   - Audio feedback toggles for floppy clicks and button clicks.
   - Live 4-channel Paula VU meters and oscilloscope visualizing audio waveforms in real time.
   - Command palette accessible anywhere via `Cmd+K` or `/`.
   - Global keyboard shortcuts dialog on `?`.

---

## 2. Design Tokens & Component Styling

```css
:root {
  /* Surfaces */
  --rgme-surface-ground: #07090e;
  --rgme-surface-base: #0f131d;
  --rgme-surface-raised: #161c2b;
  --rgme-surface-overlay: rgba(22, 28, 43, 0.92);

  /* Borders & Accents */
  --rgme-border-hairline: rgba(255, 255, 255, 0.08);
  --rgme-border-subtle: #242e46;
  --rgme-border-focus: #3b82f6;

  /* Amiga Status Colors */
  --rgme-led-drive-active: #22c55e;
  --rgme-led-power: #ef4444;
  --rgme-led-turbo: #f59e0b;

  /* Audio Meter Levels */
  --rgme-vu-ch0: #38bdf8;
  --rgme-vu-ch1: #a855f7;
  --rgme-vu-ch2: #f43f5e;
  --rgme-vu-ch3: #10b981;
}
```

---

## 3. High-Usability Component Layout

1. **Global Header:**
   - Hero Boing Ball logo with active runtime indicator (Mock / WASM / M68K).
   - Quick-Search bar (focus via `/` or `Cmd+K`).
   - Floppy activity indicator with audible drive click mute toggle.
   - Keyboard shortcut help pill `[?]`.
2. **Main Stage:**
   - 4:3 PAL Viewport framed by the Commodore 1084S monitor bezel.
   - Instant CRT preset switcher (Clean, 1084S, Trinitron, Arcade).
3. **Tactile Deck (Below Monitor):**
   - **Floppy Bay:** Virtual drives `DF0:`–`DF3:` with animated LEDs, current cylinder (0–79), disk eject/swap buttons, and `.m3u` multi-disk selector.
   - **Tracker Audio Station:** 4-channel Paula oscilloscope and VU-meters, song info, tempo/speed display, and MOD player controls.
   - **M68K CPU Diagnostics:** Live register inspector (D0–D7, A0–A7, PC, SR flags) when running in M68K execution mode.
4. **Universal Dropzone:**
   - Accepts `.adf`, `.ipf`, `.d64`, `.md`, `.mod`, `.m3u`, and `.zip` archives with automatic unpacking and instant detection.
