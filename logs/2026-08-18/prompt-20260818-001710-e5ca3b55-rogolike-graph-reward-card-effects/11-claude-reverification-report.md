# 11 — Claude 독립 재검증 보고서 (그래프 지도 · 보상 상세 · 특수돌 효과 개편, 수정 후)

- 재검증자: 두 번째 fresh Claude Code verifier (Orca task `task_9ff13bd64048` / dispatch `ctx_ef66c8949d39`) — planner 세션(`task_de51fe0392c4`)·첫 verifier 세션(`task_5b9eb74ae6e1`)과 모두 다른 독립 세션, 소스 읽기 전용
- 재검증 일시: 2026-08-18T01:50~02:05+09:00
- 대상: dev 브랜치, HEAD `8df1159983b0642cf5d144761f518188a64bcc15`, 수정 후 tree `7f3f17fed42a8a8ff758a11bfaf43629bdcebb62` (= manifest `snapshots.verify-before` = `snapshots.after-fix`)
- 판정 기준: hash 동결된 `04-claude-acceptance-criteria.md` + `09-claude-defect-report.md`의 DEF-1~4 + `10-codex-fix-log.md`의 수정 범위. 06/07/10의 주장에는 의존하지 않고 **살아있는 소스·diff·직접 실행 결과만** 사용했다.

## 종합 판정: **PASS** — Blocking 0건 · Major 0건 · Minor 0건

- 09의 Major DEF-1(대기 상호작용 창 미갱신)은 검증자 자체 재현 스크립트 23개 assert 전부 통과로 **해소 확인**. DEF-2 지정 회귀 테스트 존재 확인, DEF-3 세 경로 만료 확인, DEF-4 실브라우저 비겹침·무가로스크롤 확인.
- 필수 명령 8종 전부 verifier 명의·exact argv로 재실행해 exit 0. 전체 테스트 42파일 / **221개** 전부 통과(수정 전 213 → 회귀 테스트 8개 증가). AC vitest 매핑 27/27.
- 검증 전 과정에서 소스 tree 불변(`7f3f17f...` 유지). 열린 결함이 없으므로 `12-claude-reverification-defects.md`는 작성하지 않는다.

## 1. 검증 환경 무결성 (사전·사후 게이트)

| 항목 | 결과 |
|---|---|
| 소스 tree (검증 시작 시) | `7f3f17fed42a8a8ff758a11bfaf43629bdcebb62` — manifest `verify-before`·`after-fix`·10 fix log의 최종 hash와 모두 일치 ✓ |
| 소스 tree (모든 명령·브라우저 검증 후 재계산) | `7f3f17fed42a8a8ff758a11bfaf43629bdcebb62` — **검증 전후 동일** ✓ (`snapshot_tree`와 동일한 임시 index 방식, 사용자 index 불변) |
| HEAD | `8df1159` = manifest `git_head_before` = `origin/dev` ✓ (커밋/푸시/리셋 없음) |
| 계획 hash | manifest `plan_hashes` 4건(02~05) 전부 `sha256_file` 재계산과 일치 — plan-frozen 유지 ✓ |
| 재검증자 소스 수정 | 없음 — 본 보고서(11)와 evidence 도구가 생성한 `verification/` 로그·receipt만 작성. 02~10 문서는 읽기만 했다. 재현 스크립트는 저장소 밖(세션 scratchpad)에서 실행 |

## 2. 필수 명령 직접 재실행 (`capture-command --role verifier`, exact argv)

8건 모두 receipt가 `verification/commands.jsonl`에 append되고 `verification/<name>.log`가 갱신됨. manifest의 해당 8개 항목은 전부 `executed_by: verifier`, `status: passed`, argv가 `evidence.config.json`과 정확히 일치(ac_mapping·python_tests는 04 §7·§8이 지정한 argv).

| name | argv | exit | 핵심 결과 |
|---|---|---|---|
| full_tests | `npm.cmd test` | 0 | **42 files / 221 tests 전부 통과**, 실패 0 (AC-CMD-001) |
| typecheck | `npm.cmd run typecheck` | 0 | `tsc --noEmit` 오류 0 (AC-CMD-002) |
| build | `npm.cmd run build` | 0 | production build 성공 (AC-CMD-003) |
| benchmark_ai | `npm.cmd run benchmark:ai` | 0 | 7×7 p95 **1.6ms** ≤ 100ms · 9×9 p95 **2.4ms** ≤ 200ms, candidate 82000/82000·138000/138000 일치 (AC-CMD-004) |
| runtime_audit | `npm.cmd audit --omit=dev --audit-level=high` | 0 | 취약점 0, `dependencies`는 react/react-dom 그대로 (AC-CMD-005) |
| mobile_check | `npm.cmd run check:mobile` | 0 | 검증자가 직접 빌드→preview 기동 후 실행. report.json `passed: true`, 하단 §4 참조 (AC-CMD-006) |
| ac_mapping | `node scripts/check-ac-mapping.mjs logs/.../04-claude-acceptance-criteria.md` | 0 | **"AC vitest mappings: 27/27 executed with at least one passing test"** |
| python_tests | `python -m unittest discover -s tests -v` | 0 | 23 tests OK (AC-EVID-001) |

부정 계약(성공=exit 1이라 capture-command 미사용, 검증자 셸 직접 실행):

- AC-NEG-001: `git grep -nE "aiEffectWeight[^s]|resolveGuardianEffect|DeckInspectionEffectResult|PendingDeckInspection" -- src tests scripts` → **출력 0건, exit 1** ✓
- AC-NEG-002: `git grep -nE "STONE-00[1-6]" -- src/App.tsx src/components` → 1건(`src/App.tsx:310`의 도장 액션 `replacement: 'STONE-006'` **payload 값**, 사용자 노출 텍스트는 '희생석 교환'). 맥락 판단 조항에 따라 **통과** ✓

## 3. 09 결함 재검증 (핵심 — 전부 살아있는 실행으로 확인)

### DEF-1 (Major) — **해소 확인**

검증자 자체 재현 스크립트(저장소 외부 `reverify-def1-live.ts`, `npx vite-node` 실행, 공개 `gameReducer` 액션만 사용 — 본 보고서 부록 A에 전문 수록)로 4개 시나리오 **23/23 assert 통과**:

| 시나리오 | 09 재현과의 관계 | 확인한 내용 |
|---|---|---|
| A. 기병×2 FIFO | 09 재현 1의 다음 단계 | 첫 교환 확정 후 승격된 두 번째 기병 창이 **현재 drawPile 상단(`["draw-4"]`)으로 재계산**됨(수정 전: stale `["draw-3","draw-4"]`로 영구 확정 실패). 두 번째 확정 성공, taken이 손패에·discarded가 버림 더미에 원자 반영, `invalidReason` 공백, 연쇄 소진 시 턴 정확히 1회 종료(`turn W · turn-start`) |
| B. 척후→기병 | 09 재현 2 (시작 덱 도달 가능) | 척후 확정 후 승격된 기병 창이 교환 후 실제 drawPile 상단 `["draw-3","draw-4"]`와 일치, 두 번째 확정 성공 |
| C. 빈 창 스킵 | 수정 명세 2항 | 첫 교환으로 drawPile이 비면 대기 기병을 **승격 없이 건너뛰고** 턴을 정확히 1회 종료(END_TURN 2회면 turn이 B로 되돌아가므로 `turn W` assert가 1회성을 증명) |
| D. 취소 승격 | 수정 명세 1항(확정·취소 공통 경로) | 취소 시 덱 참조 불변, 승격된 head의 `takenCardId`/`discardedCardId` 초기화 + 창 재계산, 취소 후 이어지는 확정도 성공 |

소스 확인: `src/game/GameProvider.tsx`의 `refreshInspection()`(703행)이 scout/cavalry 창을 그 시점 `battle.decks.B`로 재생성하고, `promoteQueuedInspection()`(730행)이 FIFO 순회로 0장 창을 건너뛰며 `endsTurnOnResolve`를 누적, `finishInspection()`(755행)이 확정·취소 공통으로 이 경로를 사용. 회귀 테스트도 `tests/battle.product-effects.test.ts`에 4건 추가되어 기존 FIFO 테스트가 두 번째 확정까지 연장됨(158·190·228·254행) — full_tests에서 GREEN.

### DEF-2 (Minor) — 지정 고가치 assert 추가 확인

09가 지정한 미커버 조건들의 전용 테스트 존재와 GREEN을 확인:

- 보호+비보호 혼재 전체 무효화·미선택 토큰 보존: `tests/battle.protection.test.ts:76` ✓
- W(적) 장군석 대칭 드로우: `tests/battle.product-effects.test.ts:89`, 초과분 자연 수렴: 같은 파일 120행 ✓
- 척후 잘못된 returnedId·불완전 순열 RangeError: `tests/stones.test.ts:84-89`, 기병 잘못된 take/discard RangeError: 147-152행 ✓
- 완료 다수 시 이전 노드 done: `tests/map.graph.test.ts:48`·`tests/ui.map.graph.test.tsx:43` ✓
- 행 간 96px 확보: `tests/map.graph.test.ts:24` ✓

### DEF-3 (Minor) — 해소 확인

`src/game/battle.ts:437-440`에서 `performRevivalSpecialMove`가 진입 시 `expireTemporaryHandLimits(state.decks.W)`를 공통 적용하고, **정상 착수(503행)·수호 무효화(463행)·후보 없음 자동 패스(445행)** 세 반환 경로 전부가 이 덱을 사용함을 코드로 확인. 회귀 테스트 `tests/battle.revival.test.ts:227`("부활 전용 턴 완료는 정상·보호 무효화·자동 패스 모두 W 임시 패 한도를 만료한다")가 세 경로를 각각 assert — 검증자 단독 실행(`npx vitest run tests/battle.revival.test.ts -t "..."`)으로 1 passed 재확인.

### DEF-4 (Minor) — 해소 확인 (실브라우저 2중 검증)

소스: `src/game/mapLayout.ts:35` `MAP_NODE_MIN_VERTICAL_SPACING = 96` 문서화 주석 포함, 6행 지도 viewBox 356×576, `src/components/MapGraph.tsx:22` `--map-aspect: 356 / 576`(width/height — 10에서 보고한 역전 수정 반영), `src/styles.css:66` `aspect-ratio: var(--map-aspect)`.

1. **제품 mobile_check**(exit 0): `assertMapLayout`이 막 시작·첫 완료 뒤 두 시점에 모든 `.map-node` 실제 `getBoundingClientRect` 쌍별 비겹침과 html/body scrollWidth ≤ 380을 검증. report.json의 raw 좌표를 검증자가 **독자 코드로 재계산**해도 겹침 0건, 행 top이 정확히 96px 간격(225→321→417→513→609→705).
2. **검증자 독자 스크립트**(부록 B, 제품 스크립트와 별개 구현): 380×844 실제 Chromium에서 막 시작·1노드 완료 후 두 시점 모두 겹침 0건·html/body scrollWidth 380·`.map-edge` 18개, 진행 후 `data-state="current"` 정확히 1개(완료한 그 노드). 스크린샷 육안: 부제(적 이름·이벤트명) 전부 판독 가능, 행간 여백 뚜렷, 아래→위 진행·보스 최상단·current '현재' 배지 정상.

## 4. 실브라우저(모바일) 재검증 요약

| 항목 | 결과 |
|---|---|
| 380px 무가로스크롤 (초기·지도·7×7·9×9 380/430) | ✓ (mobile_check + 독자 스크립트) |
| 지도 노드 상자 실제 DOM 비겹침 — 막 시작·진행 후 | ✓ 겹침 0건 (두 검증 모두) |
| `.map-edge` 18개 · 첫 완료 후 current 정확히 1개 | ✓ |
| 보상 face 첫 tap: `aria-expanded=true` · reward 화면 유지 · 상세 노출 | ✓ (독자 스크립트에서도 재확인) |
| `이 보상을 선택` tap → 지도 복귀 | ✓ |
| console/page/request/bad-response 오류 | 0 · 0 · 0 · 0 |
| 첫 gesture 전 오디오 미시작 · 이후 실제 재생 신호 | ✓ |

보상 상호작용 소스 확인(`src/App.tsx:224-245`): face `onPointerDown preventDefault`(tap-focus 경합 방지), `onFocus` 펼침(키보드 경로), `onMouseEnter`는 `window.matchMedia?.('(hover: hover)').matches` 게이트(optional chaining이 체인 전체를 단락하므로 `matchMedia` 부재 환경에서 안전), 확정은 상세 안 `이 보상을 선택` 버튼만 — HDD-002 hover-only 금지 충족.

## 5. AC 1:1 매핑 (재검증 판정)

실행 근거: full_tests(42/221) + ac_mapping(27/27) + 위 §2~§4의 직접 실행. ⚠️ 없이 전 항목 ✅ — 09에서 ⚠️였던 항목들은 DEF-2 지정 테스트 추가로 전용 assert가 생겼다.

| 그룹 | 판정 | 비고 |
|---|---|---|
| AC-MAP-001~006 | ✅ 6/6 | 96px 간격·576 viewBox 갱신 반영, edge 18개·상태 4종·회귀 GREEN, 실브라우저 확인 |
| AC-RWD-001~007 | ✅ 7/7 | 시작 덱 10장(001×5+002~006), 상세 6요소 한국어·무ID, 첫 tap 펼침만·명시 선택, hover/focus/tap 3경로 |
| AC-SCT-001~004 | ✅ 4/4 | 원자 교환·RangeError 계열 전용 테스트 확충, 제품 reducer 경로·취소 불변 |
| AC-GEN-001~003 | ✅ 3/3 | AC-GEN-001은 AI-제안 게이트 — **인간 확인 권장** 유지(§6). 무효화 시 추가 드로우 미발생을 코드로 확인(`battle.ts:592-613` 조기 반환이 615행 드로우보다 앞) |
| AC-CAV-001~005 | ✅ 5/5 | **AC-CAV-005의 09 Major가 본 재검증의 핵심 — §3 DEF-1 참조, 해소 확인** |
| AC-GRD-001~006 | ✅ 6/6 | 혼재 포획 전체 무효화·토큰 보존 전용 테스트 추가 확인, board 동일 참조·만료 규칙 GREEN |
| AC-SAC-001~002, AC-AI-001~003 | ✅ 5/5 | 부활 경로 만료 보강(§3 DEF-3), aiEffectWeights 6키 주입·보호 인지 평가 GREEN |
| AC-CMD-001~006 | ✅ 6/6 | §2 표 |
| AC-NEG-001~002, AC-EVID-001 | ✅ 3/3 | §2 하단 |
| AC-DOC-001 | ✅ | `docs/03_content/01_특수돌.md` STONE-002~006이 HDD-005~009 승인 효과와 문장 단위로 일치(척후 3장 교환/장군 5냥+1장·자연 수렴/기병 2장·덱 아래·추가 착수 금지/수호 착수 전체 무효·만료 규칙/희생 즉시 드로우+한도·비발동 조건). `docs/CHANGELOG.md` 0.3.0에 확정·인간 확인 권장 구분 기록 |

## 6. 남은 인간 판단 항목 (결함 아님, 은폐 없음)

- **AC-GEN-001 (AI-제안 게이트):** 장군석 추가 드로우의 "보충 후 1장, handLimit 일시 초과, maxHandSize 절대 상한" 해석 — 구현·테스트·문서 일치 확인 완료, 인간의 대안 선택 여지는 그대로 남아 있음.
- 보상·카드 상세 문구와 `aiEffectWeights` 초안 수치의 톤·밸런스(CHANGELOG 명시), 지도 문구·간격의 체감 품질.
- 비차단 관찰: 기존 React 테스트의 `act(...)` 경고가 stderr에 남음(10 §알려진 항목과 동일, 테스트는 전부 GREEN). 전체 worktree `git diff --check`는 2026-08-17 과거 증적 patch의 trailing whitespace로 exit 2 — 이번 범위 밖 기존 상태.

## 7. 결론과 다음 단계

09의 Blocking 0 · Major 1 · Minor 3 중 Major DEF-1과 Minor DEF-2(지정분)·DEF-3·DEF-4가 모두 수정되어 살아있는 실행으로 재확인되었다. 신규 결함은 발견하지 못했다. **Blocking 0 · Major 0 → PASS.** `12-claude-reverification-defects.md`는 열린 결함이 없어 작성하지 않는다.

Coordinator 다음 단계: `snapshot --stage verify-after`(본 재검증 종료 시점 재계산 값 `7f3f17fed42a8a8ff758a11bfaf43629bdcebb62`) → `gate --name post-verify` → `11-final-summary.md` 기록 → `finalize`.

---

## 부록 A — DEF-1 살아있는 재현 스크립트 (재현 가능성 보존용 전문)

세션 scratchpad에서 `npx vite-node <path>`로 실행(작업 디렉터리 = 저장소 루트), 출력 23/23 `ok`. 소스 무수정.

```ts
import { createInitialGameState, gameReducer, type GameState } from 'D:/개인 pjt/codex 게임 해커톤/src/game/GameProvider';
import { createBoard } from 'D:/개인 pjt/codex 게임 해커톤/src/game/go';
import type { DeckState, StoneCard } from 'D:/개인 pjt/codex 게임 해커톤/src/game/deck';
import type { BoardState, StoneKind } from 'D:/개인 pjt/codex 게임 해커톤/src/game/types';
import { DRAFT_GAME_CONFIG } from 'D:/개인 pjt/codex 게임 해커톤/tests/fixtures/draft-game-config';

let checks = 0;
function assert(condition: boolean, label: string): void {
  checks += 1;
  if (!condition) { console.error(`FAIL: ${label}`); process.exit(1); }
  console.log(`ok  : ${label}`);
}
function card(id: string, kind: StoneKind): StoneCard { return { id, kind, temporary: false }; }
function productBattle(activeKind: StoneKind, board: BoardState, drawKinds: readonly StoneKind[]): GameState {
  let state = createInitialGameState(DRAFT_GAME_CONFIG);
  state = gameReducer(state, { type: 'START_RUN' }, DRAFT_GAME_CONFIG);
  state = gameReducer(state, { type: 'OPEN_BATTLE', battle: 'normal' }, DRAFT_GAME_CONFIG);
  const battle = state.battle!;
  const playerDeck: DeckState = {
    ...battle.decks.B,
    hand: [card('active-card', activeKind), card('hand-1', 'STONE-001'), card('hand-2', 'STONE-001'), card('hand-3', 'STONE-001')],
    drawPile: drawKinds.map((kind, index) => card(`draw-${index + 1}`, kind)),
    discardPile: [],
  };
  return gameReducer({
    ...state,
    battle: { ...battle, board, turn: 'B', phase: 'choose-card', decks: { ...battle.decks, B: playerDeck } },
  }, { type: 'SELECT_CARD', cardId: 'active-card' }, DRAFT_GAME_CONFIG);
}
function captureBoard(capturedKind: StoneKind = 'STONE-001'): BoardState {
  const points = [...createBoard(7).points];
  points[1] = { color: 'W', kind: capturedKind, instanceId: 'capture-target' };
  points[2] = { color: 'B', kind: 'STONE-001', instanceId: 'wall-right' };
  points[8] = { color: 'B', kind: 'STONE-001', instanceId: 'wall-down' };
  return { size: 7, points };
}
const G = DRAFT_GAME_CONFIG;
const ids = (cards: readonly { readonly id: string }[]) => cards.map(({ id }) => id);

// A: 기병×2 — 두 번째 확정 성공
{
  const initial = gameReducer(productBattle('STONE-003', captureBoard(), ['STONE-004', 'STONE-004', 'STONE-003', 'STONE-005']), { type: 'CHOOSE_POINT', point: 0 }, G);
  assert(initial.pendingInspection?.kind === 'cavalry' && initial.queuedInspections.length === 1, 'A: general capture drew two cavalry, one pending + one queued');
  const first = initial.pendingInspection!;
  let s = gameReducer(initial, { type: 'INSPECT_TAKE', cardId: first.inspected[0].id }, G);
  s = gameReducer(s, { type: 'INSPECT_RETURN', cardId: s.battle!.decks.B.hand[0].id }, G);
  s = gameReducer(s, { type: 'CONFIRM_INSPECTION' }, G);
  assert(s.invalidReason === '', 'A: first confirmation succeeds');
  const second = s.pendingInspection!;
  assert(second !== null && second.kind === 'cavalry' && s.queuedInspections.length === 0, 'A: queued cavalry promoted to head');
  const liveTop = ids(s.battle!.decks.B.drawPile.slice(0, 2));
  assert(JSON.stringify(ids(second.inspected)) === JSON.stringify(liveTop), `A: promoted window equals live drawPile top (was stale pre-fix)`);
  assert(second.kind === 'cavalry' && second.takenCardId === null && second.discardedCardId === null, 'A: promoted head has cleared staging fields');
  let t = gameReducer(s, { type: 'INSPECT_TAKE', cardId: second.inspected[0].id }, G);
  const discardId = t.battle!.decks.B.hand[0].id;
  t = gameReducer(t, { type: 'INSPECT_RETURN', cardId: discardId }, G);
  t = gameReducer(t, { type: 'CONFIRM_INSPECTION' }, G);
  assert(t.invalidReason === '' && t.pendingInspection === null, 'A: SECOND confirmation succeeds (pre-fix: permanent RangeError message)');
  assert(t.battle!.decks.B.hand.some(({ id }) => id === second.inspected[0].id) && t.battle!.decks.B.discardPile.some(({ id }) => id === discardId), 'A: second exchange applied atomically');
  assert(t.battle!.turn === 'W' && t.battle!.phase === 'turn-start', 'A: turn ended exactly once after chain exhaustion');
}
// B: 척후→기병 — 시작 덱 도달 시나리오
{
  const initial = gameReducer(productBattle('STONE-002', captureBoard(), ['STONE-004', 'STONE-003', 'STONE-005', 'STONE-001']), { type: 'CHOOSE_POINT', point: 0 }, G);
  const scout = initial.pendingInspection!;
  assert(scout !== null && scout.kind === 'scout' && initial.queuedInspections.length === 1 && initial.queuedInspections[0].kind === 'cavalry', 'B: scout pending with cavalry queued');
  let s = gameReducer(initial, { type: 'INSPECT_TAKE', cardId: scout.inspected[0].id }, G);
  s = gameReducer(s, { type: 'INSPECT_RETURN', cardId: 'hand-1' }, G);
  s = gameReducer(s, { type: 'CONFIRM_INSPECTION' }, G);
  assert(s.invalidReason === '', 'B: scout confirmation succeeds');
  const cavalry = s.pendingInspection!;
  assert(cavalry !== null && cavalry.kind === 'cavalry', 'B: cavalry promoted after scout confirm');
  const liveTop = ids(s.battle!.decks.B.drawPile.slice(0, 2));
  assert(JSON.stringify(ids(cavalry.inspected)) === JSON.stringify(liveTop), `B: promoted cavalry window equals post-scout drawPile top`);
  let t = gameReducer(s, { type: 'INSPECT_TAKE', cardId: cavalry.inspected[0].id }, G);
  t = gameReducer(t, { type: 'INSPECT_RETURN', cardId: t.battle!.decks.B.hand[0].id }, G);
  t = gameReducer(t, { type: 'CONFIRM_INSPECTION' }, G);
  assert(t.invalidReason === '' && t.pendingInspection === null, 'B: scout->cavalry SECOND confirmation succeeds (pre-fix: blocked)');
  assert(t.battle!.turn === 'W' && t.battle!.phase === 'turn-start', 'B: turn ends once after chain');
}
// C: 빈 창 스킵 + 턴 1회 종료
{
  const initial = gameReducer(productBattle('STONE-003', captureBoard(), ['STONE-004', 'STONE-004', 'STONE-005']), { type: 'CHOOSE_POINT', point: 0 }, G);
  const first = initial.pendingInspection!;
  assert(first !== null && first.kind === 'cavalry' && initial.queuedInspections.length === 1 && first.inspected.length === 1, 'C: one-card window pending, second cavalry queued');
  let s = gameReducer(initial, { type: 'INSPECT_TAKE', cardId: first.inspected[0].id }, G);
  s = gameReducer(s, { type: 'INSPECT_RETURN', cardId: s.battle!.decks.B.hand[0].id }, G);
  s = gameReducer(s, { type: 'CONFIRM_INSPECTION' }, G);
  assert(s.battle!.decks.B.drawPile.length === 0, 'C: draw pile empty after first exchange');
  assert(s.pendingInspection === null && s.queuedInspections.length === 0, 'C: zero-window queued cavalry skipped instead of promoted');
  assert(s.battle!.turn === 'W' && s.battle!.phase === 'turn-start', 'C: turn ended exactly once on chain exhaustion');
}
// D: 취소 승격 — 창 재계산·staged 초기화·후속 확정 성공
{
  const initial = gameReducer(productBattle('STONE-003', captureBoard(), ['STONE-004', 'STONE-004', 'STONE-003', 'STONE-005']), { type: 'CHOOSE_POINT', point: 0 }, G);
  const cancelled = gameReducer(initial, { type: 'CANCEL_INSPECTION' }, G);
  assert(cancelled.battle!.decks.B === initial.battle!.decks.B, 'D: cancel leaves deck untouched (same reference)');
  const promoted = cancelled.pendingInspection!;
  assert(promoted !== null && promoted.kind === 'cavalry' && promoted.takenCardId === null && promoted.discardedCardId === null, 'D: cancel promotes queued cavalry with cleared staging fields');
  const liveTop = ids(cancelled.battle!.decks.B.drawPile.slice(0, 2));
  assert(JSON.stringify(ids(promoted.inspected)) === JSON.stringify(liveTop), `D: post-cancel promoted window equals live drawPile top`);
  let t = gameReducer(cancelled, { type: 'INSPECT_TAKE', cardId: promoted.inspected[0].id }, G);
  t = gameReducer(t, { type: 'INSPECT_RETURN', cardId: t.battle!.decks.B.hand[0].id }, G);
  t = gameReducer(t, { type: 'CONFIRM_INSPECTION' }, G);
  assert(t.invalidReason === '' && t.pendingInspection === null, 'D: confirmation after cancel-promotion succeeds');
  assert(t.battle!.turn === 'W' && t.battle!.phase === 'turn-start', 'D: turn ends once');
}
console.log(`\nALL ${checks} LIVE CHECKS PASSED`);
```

## 부록 B — DEF-4 독자 브라우저 검증 요지

검증자 자체 스크립트(제품 `playwright-mobile-check.mjs`와 별개 구현, 동일 draft config 주입, 380×844 터치 Chromium): 막 시작과 1노드 완료·보상 확정 후 두 시점에서 (1) 모든 `.map-node`의 `getBoundingClientRect` 쌍별 교차 검사 — 겹침 0건, (2) `document.documentElement`/`body` scrollWidth = 380 — 무가로스크롤, (3) `.map-edge` 18개, (4) 진행 후 `data-state="current"` = 완료한 노드 1개. 실행 출력:

```
[act-start] nodes=11 edges=18 innerWidth=380 htmlScroll=380 bodyScroll=380
[act-start] overlaps=[] interRowGapsPx=[28,28,28,28,28]
[reward] first tap: aria-expanded=true screen=reward
[progressed] nodes=11 edges=18 innerWidth=380 htmlScroll=380 bodyScroll=380
[progressed] overlaps=[] current nodes=["act-1-column-0-lane-0"]
INDEPENDENT MAP/REWARD BROWSER CHECK PASSED
```

스크린샷 육안 확인: 제목·부제(예: "떠돌이 도박사", "사건 EVENT-002") 전부 가려짐 없이 판독 가능, current 노드 금색 테두리 + '현재' 배지, open 경로 강조. 09 DEF-4의 부제 겹침은 재현되지 않는다.
