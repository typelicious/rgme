# SkillWeave Discovery Report — M12: Real Amiga Emulation (vAmiga + PUAE)

- **Skill:** skillweave-discovery (quick mode) · **Date:** 2026-11-05
- **Trigger:** User escalation — "sind das alles fake screens?" → Yes. M11 `EmulatorJsPuaeAdapter` renders hand-drawn per-title scenes (keyword match on title), executes no ADF, loads no emulator core.

## 1. Problem Statement
RGME claims "Full Amiga (PUAE)" but no emulator runs. Library games, ZIPs and freeware classics show scripted animations, not the real software. Users want to **play real games**. Two real WASM cores are wanted, user-selectable:
1. **vAmiga / vAmigaWeb** (cycle-exact, own C++ core, GPL-3.0)
2. **PUAE via EmulatorJS** (libretro PUAE → WASM, EmulatorJS 4.2.3, GPL-3.0 / GPL-2.0+)

## 2. Evidence (verified 2026-11-05, not assumed)
| Fact | Evidence |
|---|---|
| vAmigaWeb reachable, embeddable | `https://vamigaweb.github.io/` 200; `js/vAmigaWeb_player.js` 200 |
| vAmigaWeb host protocol | Parent→iframe `postMessage`: `{cmd:"load", file_name, file:Uint8Array, kickstart_rom?:Uint8Array}`, `{cmd:"script", script}`, `"poll_state"`, `"button_run()"`, `"toggle_audio()"`. iframe→parent: `{msg:"render_run_state", value, is_warping}`, `{msg:"render_current_audio_state", value}`. Source: `vAmiga_ui.js` L2426–2532, player L73–111 |
| vAmigaWeb URL config | JSON in URL fragment: `navbar, wide, border, port2, AROS, dialog_on_missing_roms, dialog_on_disk, wait_for_kickstart_injection, kickstart_rom_url` (`vAmiga_ui.js` L212–226) |
| vAmigaWeb joystick | script `emit_joystick_cmd("2PULL_LEFT")` (port digit + `PULL_*/RELEASE_*/PRESS_FIRE*`) (`vAmiga_ui.js` L1883) |
| EmulatorJS CDN reachable | `cdn.emulatorjs.org/stable/data/{loader.js,emulator.min.js,cores/puae-wasm.data}` 200, CORS `*` |
| EmulatorJS API (4.2.3) | globals `EJS_player, EJS_core, EJS_gameUrl, EJS_gameName, EJS_pathtodata, EJS_biosUrl, EJS_startOnLoaded, EJS_threads, EJS_volume, EJS_onGameStart`; instance `EJS_emulator.play()/pause()/gameManager.restart()/setVolume()`; blob game URLs use `EJS_gameName` (incl. extension) as FS filename |

## 3. Personas & Stakeholders
- **Player (primary):** drops/mounts ADF/ZIP/IPF, expects the real game, sound, joystick.
- **Preservationist:** brings own Kickstart (BYOR); needs honest rights/ROM handling.
- **Maintainer:** needs both cores behind `RuntimeAdapter` (ADR-004), testable without a browser/network.

## 4. Assumption Map
| # | Assumption | Risk | Mitigation |
|---|---|---|---|
| A1 | Cores are loaded **at runtime from upstream hosts** (not bundled) | GPL scope: no GPL code vendored in RGME; network required | Config `baseUrl`/`dataUrl` overridable → self-host; explicit offline error |
| A2 | Cross-origin iframe canvas cannot feed RGME's WebGL CRT shader | CRT shader unavailable for real cores | CSS scanline overlay only; documented |
| A3 | Kickstart: vAmiga accepts user ROM via `load` message; AROS via `AROS:true` | ROM compat | AROS default when no BYOR |
| A4 | EmulatorJS Kickstart injection via `EJS_biosUrl` is best-effort | PUAE filename expectations | Default AROS; flag BYOR as best-effort in UI/docs |
| A5 | Real-browser behaviour can't be proven by jsdom | Regression undetected | Protocol contract tests + explicit "needs manual browser check" in report |
| A6 | Fake renderer must never be presented as emulation | Trust | Rename to **Placeholder preview**, remove as default |

## 5. Opportunity Assessment
High value / bounded cost: two thin adapters (~400 LOC each) over documented protocols; the rest (library, ROM store, rights) already exists.

## 6. Decision Record
- Default runtime → **vAmiga (real)**. PUAE (EmulatorJS) selectable. Old fake adapter → `preview`, labeled "Placeholder preview — not an emulator".
- Adapters render in an **iframe host** layered on the monitor screen, not on the RGME canvas.
- No GPL binaries vendored; both cores fetched from their official hosts at runtime.
