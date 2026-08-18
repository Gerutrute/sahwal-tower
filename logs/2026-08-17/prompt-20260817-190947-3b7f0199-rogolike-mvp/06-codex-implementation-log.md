# Codex implementation log

## Scope and role

- Implementer: Hermes/Codex corrective dispatch `task_ef8ddf4bda01` / `ctx_c251721db7e9`.
- Frozen inputs read without modification: `03-claude-implementation-plan.md`, `04-claude-acceptance-criteria.md`, `05-codex-implementation-brief.md`, and the fresh verifier's `06-claude-verification-report.md`.
- Corrected findings: BLK-2 non-UI, BLK-3, BLK-5 artifact gap, MAJ-1, MAJ-4, MIN-1, MIN-2, MIN-4. The immediately preceding corrective dispatch handled BLK-1/BLK-2 UI/BLK-6/MAJ-2/MAJ-3 and its Task 8 receipts remain in the same run.

## History integrity disclosure

- Before this corrective dispatch began, commit `8df1159983b0642cf5d144761f518188a64bcc15` had already been created without user authorization and pushed to `origin/dev`; the Claude verifier recorded that process violation.
- This dispatch did not commit, push, reset, rebase, amend, revert, stash, clean, or rewrite history. At the end of implementation, both `HEAD` and `origin/dev` still resolve to `8df1159983b0642cf5d144761f518188a64bcc15`, while all corrective work is intentionally uncommitted in the working tree.
- No attempt was made to conceal or retroactively relabel the earlier unauthorized history operation.

## Strict TDD sequence

1. Created the frozen file contracts first: `tests/audio.manager.test.ts`, `tests/audio.routing.test.tsx`, `tests/telemetry.test.ts`, `tests/balance.harness.test.ts`, and `tests/unlocks.test.ts`; migrated `tests/sim.random.test.ts` to the current engine contract.
2. Captured the exact frozen first slices before implementation:
   - `task9-red`: `첫 gesture 전 context를 만들지 않는다`, exit 1 because `src/audio/AudioManager.ts` did not exist.
   - `task10-red`: `동일 run은 동일 익명 지표를 낸다`, exit 1 because `src/game/telemetry.ts` did not exist.
   - `task10-1-red`: `잠긴 ID는 후보에서 제외된다`, exit 1 because `src/game/unlocks.ts` did not exist.
3. Implemented the minimum production paths, then captured:
   - `task9-green`: initial 2 files / 8 tests passed; `task9-nonfatal-regression` then expanded this to 9 tests with explicit missing-asset and decode failures.
   - `task10-green`: telemetry, balance harness, and migrated simulation passed.
   - `task10-1-green`: unlock reducer/filter tests passed.
4. Only after those replacements were GREEN, removed `src/engine.ts`, `tests/engine.ai.test.ts`, `tests/engine.purity.test.ts`, and the obsolete `tests/audio.test.ts`; remaining mixed tests were migrated from `../src/engine` to the matching `src/game/*` modules.
5. Captured independent full-suite regression receipts `task9-regression` and `task10-regression`, both exit 0.

## Implementation detail

### Task 9 — injected audio

- Split the audio contract into `src/audio/tracks.ts`, `src/audio/AudioManager.ts`, and `src/audio/useGameMusic.ts`, with `src/audio.ts` retained only as a compatibility barrel.
- `AudioManagerOptions.tuning` is required at type and runtime. There is no `DEFAULT_AUDIO_TUNING` symbol, implicit numeric tuning, or parameterless product manager construction under `src/`.
- `GameConfig.audioTuning` is required. Production `src/main.tsx` still renders a configuration-required state when no complete injected config exists; it does not synthesize tuning.
- Draft tuning values exist only in `tests/fixtures/draft-game-config.ts`, the Task 9 test fixture, and the mobile composition boundary, each tagged HDD-013 pending.
- Covered gesture unlock, route table, same-track no-restart, lazy load, two-buffer LRU, generation cancellation, injected equal-power fade, interruption/visibility resume, independent storage, BASE_URL, HTMLAudio loop/mute/pause fallback, and nonfatal asset/decode/storage/autoplay failure.
- `package.json` preview now binds `127.0.0.1` to match the mobile check default.

### Task 10 — telemetry and simulation

- Added deterministic local-only anonymous aggregation in `src/game/telemetry.ts`; it contains no network transport and emits an irreversible seed fingerprint plus move/thinking/stone/effect/pass/capture/win/deck/board/dead-candidate metrics.
- Added required-input komi simulation on the current `createBoard` / `tryPlay` / `scoreArea` APIs. Every pair swaps agent colors and reports seed, pair/sample counts, signed mean black margin, black/white/draw rates, Wilson 95% interval, injected target, and target membership.
- Replaced both `scripts/balance.ts` and `scripts/simulate.ts`. All numeric balance inputs, including komi, sample count, move cap, and target interval, are required CLI arguments; neither script contains a product komi default.
- Real script receipts `task10-balance-7` and `task10-balance-9` used explicitly supplied draft candidates. Both emitted the full requested schema; their tiny 8-game samples were outside the supplied target and are measurement evidence only, not a tuning or release conclusion.

### Task 10-1 — unlock skeleton

- Added `UnlockState` as the single `unlockedIds` set, a deterministic reducer, predicate, and candidate filter. There are no score, komi, currency, or stat-boost fields.
- Reward and shop generators accept unlock predicates before candidate selection; the reducer remains independent of UI wording.

### Legacy and AC checker

- Exact command `git grep -E "FLOORS|START_POUCH|sweepDead|pouchB|pouchW|kingB|kingW|superko" -- src tests scripts` returns exit 1 with no matches.
- `scripts/check-ac-mapping.mjs` now generically ignores non-files such as ellipsis examples and requires every extracted `tests/*` path to exist. It reports `33/33` executable AC mappings, eliminating the prior false failure without hard-coding one placeholder.

## Verification receipts

All listed receipts are under `codex/self-check/` and have matching entries in `codex/exec-receipts.jsonl`:

- `final-full-tests-latest`: 26 files / 140 tests passed.
- `final-typecheck`: exit 0.
- `final-build`: exit 0.
- `final-runtime-audit`: 0 vulnerabilities, exit 0.
- `final-benchmark-ai`: 7×7 and 9×9 candidate counts exact; p95 1.4 ms and 2.4 ms respectively under the harness.
- `final-mobile`: 380×844, 81 non-overlapping hit targets, no horizontal overflow, no console/page/request/HTTP errors, four music assets 200, and zero audio contexts/play attempts before gesture; report `passed:true`.
- `final-python-tests`: 23 tests passed.
- `final-python-compile` and `final-hook-self-test`: exit 0.
- `final-ac-mapping`: 33/33 mappings passed.

## Remaining gates

- HDD-013 device listening approval and the other frozen human balance/content decisions remain open; draft numbers are not product approvals.
- A fresh Claude verifier must still run exact verifier receipts against this uncommitted tree and perform verify-before/verify-after source-tree invariance. This implementer did not finalize or claim independent verification.
