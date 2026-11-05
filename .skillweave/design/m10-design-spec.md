# Milestone 10 Design Specification: Spatial Modernization, Centered Viewport, Layover Drawer & Ambient Controls

## 1. Executive Summary & Design Vision
Milestone 10 radically elevates RGME's spatial ergonomics and immersion. By transforming the fixed left sidebar into an on-demand, two-column slide-over drawer and moving secondary controls into contextual layovers (CRT top-right corner dropdown, Header runtime menu, Guru Meditation error overlay, and a draggable floating gamepad remote), the central 1084S monitor takes pride of place: perfectly centered, maximally scaled, and distraction-free. Furthermore, all media loading paths in WASM mode are hardened with guaranteed bootable ADF generation and pre-registered bytes, eliminating "No bytes registered" errors.

## 2. Design-Thinking Lens (SkillWeave Cognitive Ergonomics)
1. **Focus on the Screen (Value ≥ Noise)**:
   - The retro CRT monitor is the focal hero element. Removing the 320px static left sidebar allows the monitor to be centered in the viewport and scale up to 100% of comfortable width without horizontal cramming.
2. **Ambient & Progressive Disclosure**:
   - Secondary tools (drives, dropzone, exporters) live in a high-density, 2-column layover drawer (`grid grid-cols-2`) accessible via a clean `🎛️ System / Drives` icon in the navigation or floating trigger.
3. **Contextual Proximity**:
   - **CRT Shader Settings**: Anchored to the top-right corner of the monitor bezel itself (`📺`), popping down-left directly where the user is looking at the screen.
   - **Runtime Core Switcher**: Relocated to the global header (`⚡ WASM Core ▾`), providing instant status and a sleek downward layover menu.
4. **Authentic Nostalgic Feedback (Guru Meditation Error Modal)**:
   - Runtime failures and missing disk notifications transform from ugly inline red text into an authentic, centered Commodore Amiga **Guru Meditation** error box (black card, pulsing red border, hex error codes, dismissible).
   - On dismissal, it minimizes into a discreet alert pill in the bottom-left corner (`fixed bottom-6 left-6`) for later inspection.
5. **Spatial Remote Control**:
   - The virtual D-Pad and fire buttons become a compact, glassmorphic floating controller overlay that users can drag anywhere on their screen or minimize to an icon button right next to the master Reset button (`fixed bottom-6 right-24`).
6. **Information Architecture**:
   - Bottom shelf order prioritizes the primary user activity:
     1. **Retro Game Library** (Browse, Bookmarks, Sources, Stream)
     2. **ProTracker Player** (MOD tunes, audio channels)
     3. **Chain of Title** (Legal & rights provenance matrix)

## 3. Design Tokens & Layover Specifications
- **Left Layover Pane**:
  - Width: `w-full max-w-2xl` (672px), backdrop blur: `backdrop-blur-xl bg-[#0f1017]/95 border-r border-[#232734] shadow-[24px_0_48px_rgba(0,0,0,0.8)]`.
  - Layout: `grid grid-cols-1 md:grid-cols-2 gap-4 p-6`.
- **Guru Meditation Layover**:
  - Box: `bg-black border-4 border-red-600 p-6 rounded-none text-red-500 font-mono animate-pulse shadow-[0_0_30px_rgba(220,38,38,0.5)]`.
  - Header: `Software Failure.  Press left mouse button to continue.`
- **Draggable Compact Remote Control**:
  - Glass: `bg-[#13141c]/90 border border-[#2e3346] backdrop-blur-md rounded-2xl p-2.5 shadow-2xl`.
  - Minimized Pill: `fixed bottom-6 right-24 z-50 bg-[#161822]/95 border border-[#38bdf8]/60 text-sky-300 rounded-full p-2.5`.
- **Top-Right CRT Corner Trigger**:
  - Position: `absolute top-3 right-4 z-30`.
  - Menu: `absolute right-0 top-10 w-72 bg-[#13141c]/95 border border-[#232734] shadow-2xl rounded-xl p-4`.
