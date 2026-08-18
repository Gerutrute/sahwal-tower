# Codex corrective implementation log — Task 8 UI integration

## Scope

- Dispatch: `task_ed1071d056a9` / `ctx_9e254e3f9d4f`
- Corrected: BLK-1, BLK-2 UI files, BLK-6, MAJ-2, MAJ-3.
- Preserved: frozen plan/acceptance artifacts, docs, music, Git refs/history/index. No commit or push was performed.

## Implementation

- Added required-injection `GameConfig` and a React `GameProvider`/pure `gameReducer` in `src/game/GameProvider.tsx`.
- Replaced the parallel mock UI with state driven by `battleReducer`, `runReducer`, deck cycling, `tryPlay`, `resolveMove`, `scoreArea`, `chooseBattleAiMove`, reward generation, shop purchases/removal, event currency effects, and dojo remove/exchange/duplicate operations.
- Added actual 10-card run deck / 4-card hand rendering, card consumption and draw/discard values, capture tracking, occupied/suicide/simple-ko reasons, consecutive pass scoring, AI choice, Act 1 first-loss revival special move, resignation/loss, Act 1 boss-to-Act 2 9×9 progression, and Act 2 final result.
- Added injected score analysis with actual stones/territory/komi/margin/captures/effects plus deterministic 1–3 replay candidates.
- Removed UI-local economy/komi/balance literals. Production `src/main.tsx` renders a configuration-required state unless the host injects `window.__ROGOLIKE_GAME_CONFIG__`; draft values exist only under tests/mobile verification.
- Corrected stone labels to `STONE-003=장군석`, `STONE-004=기병석`, `STONE-005=수호석`, `STONE-006=희생석` through the canonical content definitions.
- Prevented repeat shop purchases/removal and applied dojo operations to the real deck exactly once per visit.

## TDD and integration evidence

- Created the exact AC files:
  - `tests/ui.shell.test.tsx`
  - `tests/ui.board.test.tsx`
  - `tests/ui.battle.test.tsx`
  - `tests/result.analysis.test.ts`
  - `tests/ui.progression.test.tsx`
  - `tests/ui.dojo.test.tsx`
- `task8-red`: final RED receipt for `9×9가 81개 좌표를 비중첩 렌더한다` exited 1 because the old mock lacked the integrated provider marker. An earlier narrow coordinate-only probe unexpectedly passed and remains in the receipt history; it was not deleted or rewritten.
- `task8-green`: six exact AC files, 12 tests, exit 0.
- `task8-regression`: 24 Vitest files, 156 tests, exit 0.
- `task8-typecheck`: `tsc --noEmit`, exit 0.
- `task8-build`: production Vite build, exit 0.
- `task8-mobile`: 380×844 real browser path title → map → normal battle → scoring → reward → shop → Act 1 boss → Act 2 9×9 → final result, exit 0. Report: `playwright-results/report.json`; 81 non-overlapping 42×42 targets, document/body width 380, no console/page/request/bad-response errors.
- Python evidence regression: 23 tests, exit 0.
- Implementation snapshot tree: `46646c550c3f68d14c50955317c4d913ad6f97b8`.

## Remaining gates

- Product numeric configuration remains intentionally absent pending human decisions HDD-008 through HDD-012; only tests inject draft values.
- Audio corrective findings (MAJ-1 / Task 9 file contracts), telemetry/unlocks, legacy-engine removal, prior unauthorized commit/push disposition, and fresh Claude verification were outside this dispatch and remain for their assigned owners/gates.
- Human mobile-device listening, visual-fun, UX, and balance approval remain open human judgments.

---

# Corrective implementation — DEF-1, DEF-2, DEF-3

## Dispatch and scope

- Implementer: fresh Hermes/Codex corrective dispatch `task_891ae5bd563c` / `ctx_615bfc357ad6`.
- Changed only DEF-1, DEF-2, DEF-3 implementation/tests/mobile path plus this implementer-owned log and command receipts. Frozen artifacts `01`–`05`, product docs, music assets, and Claude reports `08`/`09` were not edited.
- No commit, push, reset, rebase, or history rewrite was performed. Evidence finalize/post-verify was intentionally not run; a fresh Claude verifier remains the next owner.

## DEF-1 — revival direction

- `src/game/battle.ts`: corrected `resolveBattleOutcome` so player loss (`winner === 'W'`) always produces `run-loss`; the first player win in Act 1 with unused revival enters stage 2 on the same board/decks; later player wins produce `stage-win`.
- `tests/battle.revival.test.ts`: changed the revival helper and preservation assertions to use player victory and added an explicit first-stage player-loss immediate-run-end test.
- `tests/ui.game.test.tsx`: replaced the prior inverted "first defeat revives" product scenario with first victory → revival special move → later resignation loss.
- `scripts/playwright-mobile-check.mjs`: changed the boss path to first victory → visible stage 2 with bosstheme retained → second victory → Act 2; pre-move is explicitly advanced on every player turn.

## DEF-2 — product special effects and deck inspection

- `src/game/GameProvider.tsx`: the product placement path now sends actual `{ battle, run, effectLog }` state through the deterministic injected `resolveMove` limits instead of `{ log: [] }`, rejects limit overflow atomically, and persists committed effect logs.
- `src/game/GameProvider.tsx`: scout opens an actual top-two draw-pile panel and confirmation applies `resolveScoutEffect` order to the real `drawPile`; cancellation preserves the original order. Guardian and cavalry expose actual conditional inspections, general capture applies `resolveGeneralCaptureEffect` and updates run currency/cap state, and sacrifice capture applies `resolveSacrificeEffects` plus `addTemporaryHandLimit` to the captured side's real next-turn deck for both player and AI captures.
- `src/game/GameProvider.tsx`, `tests/fixtures/draft-game-config.ts`, `scripts/playwright-mobile-check.mjs`: added the composition-injected `generalCaptureMoneyCap`; no product balance fallback was introduced.
- `src/App.tsx`: added the visible `덱 확인 및 재정렬` panel with actual card names, deterministic reverse ordering, cancel, and confirm controls.
- `tests/battle.product-effects.test.ts`: added product-reducer assertions for scout order commit, general currency/cap, cavalry/guardian inspection, sacrifice hand-limit changes on both sides, and atomic injected effect-limit rejection.
- `tests/ui.battle.test.tsx`: added real panel cancel/confirm UI coverage.

## DEF-3 — reachable pre-move and distinct resources

- `src/game/GameProvider.tsx`: player `BEGIN_TURN` now remains in `pre-move`; only AI turns auto-continue. Added explicit `CONTINUE_TO_MOVE`, `USE_CHARM`, inspection, and resource state actions.
- `src/game/battle.ts`: added battle charm state and consuming `USE_CHARM`; retained relic ownership separately and corrected relic log wording. Relic use updates `usedRelicsThisTurn`, while charm use removes exactly one consumable from battle state.
- `src/game/run.ts`: added `CONSUME_CHARM` so product charm use removes exactly one item from persistent run inventory.
- `src/App.tsx`: split `부적` (`ITEM-*`) and `유물` (`RELIC-*`) counts, labels, aria regions, and controls; buttons dispatch real actions, used relics disable, consumed charms disappear, and `착수로 진행` is the explicit skip/continue action.
- `tests/ui.battle.test.tsx`, `tests/ui.board.test.tsx`, `tests/ui.game.test.tsx`: added/updated product UI paths so card/board interaction first crosses the explicit pre-move gate.

## TDD and verification receipts

- `corrective-def1-def3-red`: exit 1 before source changes; 16 semantic failures across revival direction, special effects/panel, and pre-move resources.
- `corrective-def2-ai-sacrifice-red`: exit 1 before the AI-side sacrifice wiring.
- `corrective-def1-def3-green`: exit 0; 3 files / 21 tests passed.
- `corrective-full-tests`: exit 0; 27 files / 150 tests passed.
- `corrective-typecheck`, `corrective-build`, `corrective-runtime-audit`: all exit 0.
- `corrective-benchmark-ai`: exit 0; 7×7 p95 1.4 ms and 9×9 p95 2.6 ms with expected/actual candidate counts equal.
- `corrective-mobile-green`: exit 0 and `playwright-results/report.json` reports `passed: true`, 380 px overflow 0, 81 non-overlapping targets, and no console/page/request/response failures. The first mobile run is preserved as exit 1 because its stage-2 probe selected the occupied revival coordinate; the corrected deterministic empty coordinate then passed.
- `corrective-python-tests`, `corrective-python-compile-expanded`, `corrective-hook-self-test`: all exit 0. The literal-wildcard `corrective-python-compile` attempt is preserved as exit 1 because the evidence argv runner does not expand PowerShell globs; the exact expanded Python file list passed immediately afterward.
- `corrective-ac-mapping`: exit 0; 33/33 mapped Vitest commands executed with at least one passing test.

## Files changed by this corrective dispatch

- Product: `src/game/battle.ts`, `src/game/GameProvider.tsx`, `src/game/run.ts`, `src/App.tsx`.
- Verification/runtime path: `scripts/playwright-mobile-check.mjs`, `tests/fixtures/draft-game-config.ts`, `tests/battle.revival.test.ts`, `tests/battle.product-effects.test.ts`, `tests/ui.battle.test.tsx`, `tests/ui.board.test.tsx`, `tests/ui.game.test.tsx`.
- Evidence: this `10-codex-fix-log.md`, `codex/exec-receipts.jsonl`, `codex/self-check/corrective-*.log`, and evidence-tool-maintained manifest/implementation patch files.
