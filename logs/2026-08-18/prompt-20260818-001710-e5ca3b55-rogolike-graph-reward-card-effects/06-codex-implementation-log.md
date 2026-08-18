# Codex 구현 로그

## 범위와 사전 게이트

- 구현 주체: Hermes/Codex (`task_382053d83cbd`, `ctx_36e1c750283e`)
- 동결 입력: `02-claude-requirements-analysis.md`부터 `05-codex-implementation-brief.md`까지 읽고 수정하지 않았다.
- 구현 전 `plan-frozen`, `pre-implement` 게이트가 모두 exit 0이었다.
- 구현 시작 snapshot의 source tree hash는 `bc2da5dc9aba316a344740d0f116299846f75646`이었다.
- 기존 dirty tree와 사용자 변경을 보존했으며 commit, push, reset, rebase, stash, clean을 실행하지 않았다.

## 수직 TDD 기록

모든 명령은 `evidence.py capture-command --role implementer`로 실행해 `codex/exec-receipts.jsonl`과 `codex/self-check/*.log`에 실제 출력과 exit code를 보존했다. Windows에서 동결 명령의 `npx` 실행 파일은 동등한 launcher인 `npx.cmd`로 기록했다.

| Task | 먼저 작성한 focused test와 RED | 최소 구현 뒤 GREEN | 회귀/보조 증거 |
|---|---|---|---|
| T1 | `tests/map.graph.test.ts`, `t1-red` exit 1 | `t1-green`, `t1-file-green` exit 0 | `t1-regression` exit 0 |
| T2 | `tests/ui.map.graph.test.tsx`, `t2-red` exit 1 | `t2-green`, `t2-files-green` exit 0 | `t2-regression` exit 0 |
| T3 | `tests/deck.test.ts`, `tests/stones.presentation.test.ts`, `t3-red` exit 1 | `t3-green`, `t3-files-green` exit 0 | `t3-regression` exit 0 |
| T4 | `tests/rewards.detail.test.ts`, `tests/ui.reward.detail.test.tsx`, `t4-red`/`t4-ui-red` exit 1 | `t4-green`, `t4-ui-green`, `t4-files-green` exit 0 | `t4-regression` exit 0 |
| T5 | `tests/stones.test.ts` 정찰병 원자적 3장 교환, `t5-red` exit 1 | `t5-green`, `t5-files-green` exit 0 | `t5-regression` exit 0 |
| T6 | `tests/battle.product-effects.test.ts` 장군/기병, `t6-red`/`t6-cavalry-red` exit 1 | `t6-green`, `t6-cavalry-green`, `t6-cavalry-trigger-green`, `t6-files-green` exit 0 | `t6-regression` exit 0 |
| T7 | `tests/battle.protection.test.ts`, `t7-red` exit 1 | `t7-green`, `t7-files-green` exit 0 | `t7-regression` exit 0 |
| T8 | `tests/battle.product-effects.test.ts` 희생석 만료, `t8-red` exit 1 | `t8-green`, `t8-files-green` exit 0 | `t8-regression` exit 0 |
| T9 | `tests/ai.effects.test.ts`, `t9-red` exit 1 | `t9-green`, `t9-files-green` exit 0 | `t9-regression` exit 0 |
| T10 | 실제 모바일 브라우저 검사 `t10-mobile-red` exit 1 (첫 tap 뒤 상세 미노출) | focus/click 경합 수정 1차 `t10-mobile-green` exit 1, hover-capable 입력만 hover 처리한 2차 `t10-mobile-green-r2` exit 0 | 최종 `mobile_check` exit 0 |

T10은 동일 결함의 두 차례 실패 뒤 두 번째 수정에서 통과했으며 3회 반복 실패 에스컬레이션 조건에는 도달하지 않았다.

## 구현 내용

- 실제 SVG next-edge 그래프, 현재 층/노드 강조, 도달 가능한 다음 노드만 선택하는 레이아웃·진행 UI를 추가했다.
- 기본 돌 5장과 특수 돌 5종의 10장 시작 덱, 부적/유물 섹션, 효과·시너지 설명을 추가했다.
- 보상 카드의 hover/focus 및 모바일 첫 tap 상세 펼침, 여섯 상세 필드와 개수, 별도 선택 동작을 구현했다.
- 정찰병은 최대 3장 원자 교환 UI, 장군은 리필 뒤 주입된 `maxHandSize`까지 추가 드로우, 기병은 최대 2장 교환과 사용 카드 맨 아래 순환을 구현했다.
- 수호자는 전체 수의 포획을 무효화하고 표시·토큰·만료를 유지하며, 희생석 한도는 임시 턴 종료/패스 때 만료되도록 했다.
- 특수 돌 종류별 `aiEffectWeights` 주입과 수호자 보호 인식 평가를 추가하고 draft/mobile config, 문서, changelog를 갱신했다.
- 기존 go 규칙 공개 시그니처와 런타임 의존성은 변경하지 않았다.

## 변경 파일

프로덕션/스크립트/문서:

- `src/App.tsx`
- `src/components/BoardSvg.tsx`
- `src/components/MapGraph.tsx`
- `src/game/battle.ts`
- `src/game/content/charms.ts`
- `src/game/content/relics.ts`
- `src/game/content/stones.ts`
- `src/game/deck.ts`
- `src/game/GameProvider.tsx`
- `src/game/mapLayout.ts`
- `src/game/rewards.ts`
- `src/styles.css`
- `scripts/playwright-mobile-check.mjs`
- `docs/03_content/01_특수돌.md`
- `docs/CHANGELOG.md`

테스트/fixture:

- `tests/ai.effects.test.ts`
- `tests/battle.effects.test.ts`
- `tests/battle.flow.test.ts`
- `tests/battle.majority.test.ts`
- `tests/battle.premove.test.ts`
- `tests/battle.product-effects.test.ts`
- `tests/battle.protection.test.ts`
- `tests/battle.revival.test.ts`
- `tests/deck.test.ts`
- `tests/fixtures/draft-game-config.ts`
- `tests/map.graph.test.ts`
- `tests/rewards.detail.test.ts`
- `tests/stones.presentation.test.ts`
- `tests/stones.test.ts`
- `tests/ui.battle.test.tsx`
- `tests/ui.map.graph.test.tsx`
- `tests/ui.map.progression.test.tsx`
- `tests/ui.reward.detail.test.tsx`

## 최종 자체 점검

| receipt | 결과 |
|---|---|
| `full_tests` | exit 0, 42 files / 213 tests passed |
| `typecheck` | exit 0 |
| `build` | exit 0 |
| `benchmark_ai` | exit 0, 7x7 p95 1.4ms / 9x9 p95 2.4ms (4x throttle) |
| `runtime_audit` | exit 0, 0 vulnerabilities |
| `mobile_check` | exit 0, `passed: true` |
| `python_tests` | exit 0, 23 tests passed |
| `negative_contracts` | 예상된 exit 1, 금지된 구 심볼 검색 결과 0건 |
| `ac_mapping` | exit 0, 27/27 Vitest AC mappings에 통과 테스트 존재 |

## 알려진 제한과 인간 판단

- 장군의 추가 드로우가 일시 손패 한도를 초과할 수 있다는 해석은 동결된 AI 제안대로 구현했으며 사람의 최종 확인 대상이다.
- 특수 돌의 가중치/밸런스, 문구 톤, 시각적 재미와 모바일 체감은 자동 검증만으로 확정하지 않았다.
- AI는 선택형 교환을 기본적으로 거절하는 결정적 정책을 유지한다.
- 전체 테스트는 통과했지만 기존 React `act(...)` 경고가 stderr에 남는다. 실패는 아니며 이번 범위의 동작 결함은 관찰되지 않았다.
- fresh Claude verifier 검증, 검증 전후 tree 불변성, post-verify/finalize/checksum은 아직 수행 대상이다.
