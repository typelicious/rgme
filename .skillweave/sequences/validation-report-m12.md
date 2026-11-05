# SkillWeave Validation Report: Milestone 12 (M12)

- **Target:** `.skillweave/sequences/prompt-sequence-m12.md` · **Format detected:** build (machine dispatch contract) — validated against the build-format keys, not the 12-section topic checklist.
- **Methodology / autonomy / schedule:** assay / unicorn / batch — three separate fields, Assay not substituted. `execution_mode` legacy adapter: not used.

## Build-format checks
| Key | Result |
|---|---|
| `sequence_id`, `sequence_type` | PASS |
| `methodology`, `autonomy_policy`, `session_schedule` separate | PASS |
| `execution_envelope` (v1, source declared) | PASS |
| `phases` with `session: separate`, `depends_on_phase`, `dispatches_total` | PASS |
| `parallel_lanes` disjoint write surfaces (Lane A/B) | PASS (distinct new files only) |
| `mutual_exclusion` for multi-writer surfaces | PASS (`emulator/index.ts`, `core/src/index.ts` single-owner integrator) |
| `gate_pass_requires` binary | PASS (SHA named, red proof, separate reviewer, full gate) |
| `session_boundary: batch` | PASS with deviation below |
| Data-boundary contracts in `prd.json` (adapter ×2) | PASS: all five fields present, no bare-string contracts |

## Findings & improvements applied
1. **Weak assumption:** real-browser behaviour of third-party cores cannot be proven in CI. → Added success metric 6 as *manual* checklist (M12-DOC-001) and require honest "not verified in browser" wording in the final report if no browser run is possible.
2. **Session boundary deviation:** user requested direct end-to-end execution. → Phases run sequentially in one session; carry-forward note required in the tracking log after every batch (autonomy `unicorn`, user-authorized).
3. **Parallel lanes:** no separate worktrees available in this session → Lanes A/B executed serially; disjoint scope still enforced.
4. **Too broad:** Phase 3 touches many web files → constrained to listed files; tests named.
5. **Honesty rule** added as sequence-level invariant (no fake frames labelled as emulator).

## Verdict
**APPROVED FOR EXECUTION** (build, assay/unicorn, 5 batches, 4 phases).
