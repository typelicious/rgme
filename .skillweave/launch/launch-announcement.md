# Release Announcement: RGME v0.9.0

We are thrilled to announce the official release of **RGME v0.9.0** — introducing genuine **WebAssembly Amiga 68000 Hardware Core Execution**, **Kickstart ROM Management**, and an all-new **Steam/YouTube-Inspired Retro Gaming Hub**!

---

## 🌟 What's New in v0.9.0

### 1. WebAssembly Amiga 68000 Hardware Core
- Play authentic Amiga disk images directly in your browser with true 68000 CPU execution, OCS/ECS custom chip synchronization, and 320x256 PAL frame generation.
- **Built-in Open AROS Kickstart ROM:** Out-of-the-box legally clean play with zero third-party ROM requirements.
- **BYOR (Bring Your Own ROM):** Drop your own Commodore Kickstart 1.2, 1.3, 2.04, or 3.1 ROM files with automatic SHA-256 identification and local IndexedDB persistence.

### 2. Paula 4-Channel DMA Web Audio
- High-fidelity 16-bit interleaved PCM audio synthesis directly piped to the Web Audio API with anti-click ramping and zero buffer freeze sounds.

### 3. Steam/YouTube-Style Retro Discovery Hub
- Browse thousands of retro games from connected Archive.org collections (`Amiga-Arquivista`, `Amiga_WHD_Games`, custom TOSEC/CDTV).
- Rich game cards with metadata badges for Genre, Studio, Year, and Disks.
- Multi-faceted search filters and 1-click ephemeral streaming with zero local file bloat.

### 4. Playable Arcade Mode & Universal Reset Layover
- "Boing Brick Buster" arcade breakout game with interactive paddle, 21 destructible bricks, score, and lives.
- Floating master `↺ Reset` button in the bottom right corner for immediate panic recovery.

---

## 🚀 Getting Started

```bash
# Clone and run locally
git clone https://github.com/typelicious/rgme.git
cd rgme
pnpm install
pnpm build
pnpm --filter @rgme/web dev
```

Open `http://localhost:5173` in your browser to start playing!
