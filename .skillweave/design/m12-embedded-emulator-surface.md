# SkillWeave Design Brief — M12 Embedded Emulator Surface

- **Skill:** skillweave-design (`brief` + `lens` + `tokens` + `evaluate` condensed)
- **Scope:** monitor screen host, runtime selector, honest status

## Brief analysis
| | |
|---|---|
| Strengths | Existing 1084S bezel, runtime switch, status HUD |
| Gaps | Screen is a `<canvas>` only; real cores live in iframes; selector labels misrepresent the fake adapter |
| Risks | Cross-origin iframe swallows keys; network failure → silent black screen (the exact bug users hit) |

## Lens (6 rules + 5 principles)
- **Value ≥ Noise:** one status chip: `vAmiga · loading core… / running / error`.
- **Feedback > Silence:** a visible "Loading emulator core…" layer inside the screen within 100 ms; failure shows reason + retry hint, never black.
- **Clarity > Creativity:** labels say what runs: `vAmiga (real emulator)`, `PUAE / EmulatorJS (real emulator)`, `Placeholder preview (not an emulator)`.
- **Error tolerance:** offline/blocked core → message with `baseUrl`/self-host hint; falls back to nothing silently.
- **Recognition over recall:** same controls (Start/Pause/Reset/Mute) drive both cores.

## Tokens (reuse existing `--rgme-*`)
| Token | Use |
|---|---|
| `--rgme-border-focus` | active runtime radio |
| `--rgme-fg-secondary` | runtime note text |
| `#000` host bg | iframe letterbox |
| status colors: info (loading), ok (running), danger (error) | status chip |

## Layout spec
- `<div data-testid="emulator-host">` absolutely fills the 4:3 screen box above the canvas; hidden (`display:none`) unless an embedded adapter is mounted.
- iframe: `width:100%;height:100%;border:0;allow="autoplay; fullscreen; gamepad"`.
- Loading/error layer: centered monospace text, `role="status"` (`aria-live=polite`).
- CRT: CSS `.rgme-crt` overlay (pointer-events none); WebGL shader disabled while embedded.

## Evaluate (target scorecard, 0–10)
Clarity 9 · Consistency 9 · Feedback 9 · Proximity 8 · Less-is-more 8 → pass if every state (loading/running/error/idle) has visible UI.
