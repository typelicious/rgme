# SkillWeave Execution Sequence: Milestone 13
## Pinned Local Amiga Emulators & License Harmonization (vAmiga & PUAE)

- **Target:** Mixed (Build + Test + Doc)
- **Mode:** Standard (Ralph Loop)
- **Methodology:** Assay
- **Risk Mode:** Medium
- **PRD:** `.skillweave/prds/PRD-m13.md`

```yaml
sequence_id: m13-pinned-emulators
version: 0.13.0
steps:
  - id: M13-LIC-001
    title: License Transition to GPL-3.0-or-later
    type: build
    description: Update LICENSE, package.json, and docs/emulators.md (ADR-004) to GNU General Public License v3.0 with BYOR and CC0 demonstration asset clarifications.
    inputs: [LICENSE, package.json, docs/emulators.md]
    outputs: [LICENSE, package.json, docs/emulators.md]
    gate: binary
    verification: grep -q "GNU General Public License" LICENSE && grep -q "GPL-3.0-or-later" package.json

  - id: M13-PIN-001
    title: Local Pinned Core Asset Hosting Structure
    type: build
    description: Create packages/web/public/cores/ with subdirectories for vamiga and emulatorjs, providing standalone Same-Origin host runners and asset endpoints.
    inputs: [packages/web/public/]
    outputs:
      - packages/web/public/cores/vamiga/index.html
      - packages/web/public/cores/emulatorjs/data/loader.js
    gate: binary
    verification: test -f packages/web/public/cores/vamiga/index.html && test -f packages/web/public/cores/emulatorjs/data/loader.js

  - id: M13-ADAPT-001
    title: Update VAmigaWebAdapter and EmulatorJsCoreAdapter to Default to Local Pinned Cores
    type: build
    description: Refactor both adapters in packages/core/src/emulator/ to default to local Same-Origin endpoints with configurable remote fallback and mode detection.
    inputs:
      - packages/core/src/emulator/vamiga-web-adapter.ts
      - packages/core/src/emulator/emulatorjs-core-adapter.ts
      - packages/core/src/emulator/embedded.ts
    outputs:
      - packages/core/src/emulator/vamiga-web-adapter.ts
      - packages/core/src/emulator/emulatorjs-core-adapter.ts
    gate: binary
    verification: grep -q "PINNED_VAMIGA_URL" packages/core/src/emulator/vamiga-web-adapter.ts && grep -q "PINNED_EJS_DATA_URL" packages/core/src/emulator/emulatorjs-core-adapter.ts

  - id: M13-UI-001
    title: UI Integration & Mode Telemetry
    type: build
    description: Surface Pinned (Local) vs Remote (CDN) mode indicators in the runtime selector and CoreTelemetryHUD.
    inputs: [packages/web/src/components/Header.tsx, packages/web/src/components/CoreTelemetryHUD.tsx]
    outputs: [packages/web/src/components/Header.tsx, packages/web/src/components/CoreTelemetryHUD.tsx]
    gate: binary
    verification: grep -q "pinned" packages/web/src/components/Header.tsx || grep -q "Local" packages/web/src/components/Header.tsx

  - id: M13-TEST-001
    title: Unit & Integration Verification Suite
    type: test
    description: Add comprehensive tests in packages/core/src/__tests__/m13-pinned-emulators.test.ts verifying pinned URLs, fallback handling, license alignment, and regression-free operation.
    inputs: [packages/core/src/__tests__/m13-pinned-emulators.test.ts]
    outputs: [packages/core/src/__tests__/m13-pinned-emulators.test.ts]
    gate: binary
    verification: pnpm test

  - id: M13-BUILD-001
    title: Workspace Build & Packaging Verification
    type: build
    description: Execute workspace build to ensure complete artifact packaging into dist/ with all local core assets bundled.
    inputs: [packages/]
    outputs: [packages/web/dist/]
    gate: binary
    verification: pnpm build
```
