# SkillWeave Prompt Sequence: Milestone 12 (M12) — Real Amiga cores

- **sequence_id:** rgme-m12 · **sequence_type:** build
- **methodology:** assay · **autonomy_policy:** unicorn · **session_schedule:** batch
- **execution_envelope:** `execution-envelope-v1` (source: declared; no legacy fields)
- **Gate (every batch):** `npm --prefix packages/core test && npm --prefix packages/core run build && npm --prefix packages/web test && npm --prefix packages/web run build && npm --prefix packages/cli test`
- **Git:** work on `claude/admiring-gauss-f991hx` (existing flow); author `typelicious <typelicious@gmail.com>`; no AI trailers.
- **Rule:** no scripted fake frames may be labelled as an emulator.

## phases

### Phase 1 (level 1) — `session: separate`, dispatches_total: 1
**Batch 1 — M12-HOST-001**
- write_scope (creates): `packages/core/src/emulator/embedded.ts`, `packages/core/src/__tests__/m12-embedded.test.ts`
- write_scope (modifies): `packages/core/src/emulator/emulatorjs-adapter.ts` (→ placeholder preview; id `preview`), `packages/core/src/emulator/index.ts`, `packages/core/src/__tests__/m11-emulator-adapter.test.ts`
- verification: core tests; capabilities name contains "not an emulator".

### Phase 2 (level 2) — `session: separate`, depends_on_phase: 1, dispatches_total: 2
`parallel_lanes` (disjoint scope, separate branch/worktree if parallelized):
- **Lane A — M12-VAMIGA-001:** creates `packages/core/src/emulator/vamiga-web-adapter.ts`, `packages/core/src/__tests__/m12-vamiga.test.ts`
- **Lane B — M12-EJS-001:** creates `packages/core/src/emulator/emulatorjs-core-adapter.ts`, `packages/core/src/__tests__/m12-ejs.test.ts`
`mutual_exclusion` (single owner, at_most_one_in_flight): `packages/core/src/emulator/index.ts`, `packages/core/src/index.ts` — updated by the integrator after both lanes.
- gate_pass_requires: core tests green; each adapter test red-proofed (assert fails against stub).

### Phase 3 (level 3) — `session: separate`, depends_on_phase: 2, dispatches_total: 1
**Batch 4 — M12-UI-001** (serialized lane; shared surface)
- modifies: `packages/web/src/lib/runtime-factory.ts`, `packages/web/src/App.tsx`, `packages/web/src/components/{Viewport,RuntimeSwitch,CoreTelemetryHUD,Header}.tsx`, affected web tests.
- creates: `packages/web/src/__tests__/m12-runtime-ui.test.tsx`.
- verification: default kind `vamiga`; host element exists; labels honest.

### Phase 4 (level 4) — depends_on_phase: 3
**Batch 5 — M12-DOC-001:** creates `docs/emulators.md`; modifies `NOTICE`/README; update `.skillweave` tracking log; mark prd.json passes.

## gate_pass_requires (binary)
1. Branch tip refetched and SHA named before each phase advance.
2. New tests fail against a stub (red proof exit 1) and pass against the implementation.
3. Reviewer role (cold review of diff vs PRD acceptance criteria) separate from ops role.
4. Full gate command exit 0.

## session_boundary
`batch` — one batch per session; second batch in the same session requires explicit carry-forward note in `.skillweave/tracking-log/m12-execution-report.md`.

## Failure handling
Gate red → classify (implementation / verification / environment / sequence-definition), retry budget 2, narrow fixes; never advance on red.
