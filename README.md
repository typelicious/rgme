# RGME — Retro Game Modernization Engine

> **Preserve the original. Modernize reproducibly. Prove what we know. Respect what we may distribute.**

RGME is a local-first, browser-first platform for playing, understanding, preserving, and selectively modernizing classic computer games, starting with the Commodore Amiga.

## Architecture Baseline

1. **Original Content Immutable:** Original floppy images (ADF) and ROM files are never modified. Modern controls, display treatments, saves, metadata, and enhancements are external, declarative, versioned layers.
2. **Rights Intelligence:** Every action (local play, export, patching, redistribution) is evaluated by a Rights Policy Engine against cryptographic content hashes and provenance evidence.
3. **Runtime Isolation:** All emulator runtimes (PUAE, libretro, EmulatorJS) are isolated behind a universal `RuntimeAdapter` interface.

---

## Repository Structure

```text
├── concept/                   # Strategic concept, rights matrices, and specifications
│   ├── RGME-Overall-Concept-v0.2.md
│   ├── RGME-MVP-Technical-Specification-PRD-v0.2.md
│   └── RGME-Amiga-Master-Rights-Matrix-v0.2.json
├── .skillweave/               # SkillWeave orchestration framework
│   ├── design/                # UX principles & design tokens (rgme-design-system.md)
│   ├── prds/                  # Machine prd.json and PRD specification
│   └── sequences/             # Execution sequence, dependency plan, validation report
├── SKILLWEAVE_EXECUTE.md      # Standalone Ralph Loop execution harness
└── packages/                  # Monorepo packages (built in Milestone 1)
    ├── core/                  # @rgme/core (schemas, policy engine, adapter contract)
    ├── cli/                   # @rgme/cli (scanner, hash resolver, profile generator)
    └── web/                   # @rgme/web (Vite/React retro UI shell & player)
```

---

## Milestone 1: Foundation & Demonstrator Slice

Milestone 1 establishes the monorepo, strict domain types, rights policy engine, runtime adapter contract with mock implementation, CLI scanner, and the web player shell.

### Execution with Claude Code / AI Agent
See [SKILLWEAVE_EXECUTE.md](file:///Users/andrelange/workspaces/rgme-temp/SKILLWEAVE_EXECUTE.md) for step-by-step Ralph Loop instructions.
