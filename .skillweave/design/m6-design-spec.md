# Design-Spezifikation M6: Monitor-Framing, Guru Meditation, Demo-Lifecycle & Interactive Playability

- **Kontext:** RGME Milestone 6 UX/Engine Polish
- **Frameworks:** Impeccable Design + UI-UX-Pro-Max + Commodore 1084S Physical Bounds

---

## 1. Monitor Scaling & Viewport Height Containment
- **Problem:** Die 1084S-Bezel wuchs bei breiten Fenstern unkontrolliert proportional mit, wodurch die vertikale Ausdehnung 1200px überschritt und Controls unter den Seitenrand drängte.
- **Lösung:**
  - Container-Begrenzung: `.rgme-viewport-container` erhält `max-height: min(68vh, 640px)`.
  - Horizontale Deckelung: `max-width: min(100%, calc((68vh - 72px) * 1.33 + 48px), 840px)`.
  - Zentrierung: `margin: 0 auto; width: 100%;`.
  - Die Bedienelemente (Start, Pause, Reset, Unload, CRT, Runtime-Switch) sind auf Standard-Laptops (1366x768 bis 4K) immer direkt unter dem Monitor sichtbar, ohne vertikales Scrollen.

---

## 2. Guru Meditation Screen Spezifikation
- **Hintergrund:** Reines Amiga-Schwarz (`#000000`).
- **Rahmen:** Roter Kasten (`#ff0000`), 3px Stärke, pulsierend/blinkend mit Frequenz 1.0 Hz (500ms an, 500ms aus).
- **Text:** Zentrierter Topáz-8 Monospace-Font in Leuchtrot (`#ff0000`):
  ```
  Software Failure.  Press left mouse button to continue.
               Guru Meditation #00000004.00004845
  ```
- **Interaktion:**
  - Klick auf den Canvas / Screen oder Druck auf linke Maustaste/Leertaste triggert Reboot:
  - Floppy Head Recalibration Sound (`floppySynth.step()` / seek track 0).
  - Kurzer Bildschirm-Blitz (Degauss / Flash) und Rückkehr in den Bereit-Status.

---

## 3. Demo- und Runtime-Lifecycle: Load / Unload
- **Zustandsübergänge:**
  - `UNLOADED` → `LOADED` → `RUNNING` ↔ `PAUSED` → `UNLOADED`.
- **UI-Muster (Load / Unload Toggle):**
  - Jedes Demo-Element (Scene Demo, C64 Demo, Mega Drive Demo, Guru Meditation, ProTracker Tune) zeigt seinen aktiven Status an.
  - Wenn geladen: Button schaltet um auf `⏏ Unload Demo` (oder separates Load / Unload Button-Paar).
  - Zentraler `Unload / Eject`-Button in der Aktionsleiste: Stoppt Audio, leert DF0:-DF3:, setzt Adapter-Status auf `UNLOADED`, leert Canvas auf Amiga-Schwarz und setzt Speicherbereinigungsroutinen ab.

---

## 4. Spielbare Interaktive Amiga-Engine statt reiner Test-Farbbalken
- **Problem:** Nutzer klicken auf ein Spiel und sehen nur statische SMPTE-Farbbalken.
- **Lösung:**
  - Die Referenz-/Mock-Runtime wird erweitert: Wenn kein M68K-Bootcode ausgeführt werden kann oder ein Showcase-Profil aktiv ist, rendert sie eine **echte interaktive Amiga-Klassiker-Simulation** (z. B. rot-weiß karierter Boing Ball mit authentischer Schattenprojektion, Sinus-Reflexionen, Stereo-Abprallgeräuschen und Pfeiltasten-/Joystick-Steuerung) ODER lädt synthetisch generierte bootbare Mini-Spieldisks.
  - Showcase-Karten zeigen verständlich an: `▶ Interactive Simulation` sowie `📂 Mount Custom ADFs`.
