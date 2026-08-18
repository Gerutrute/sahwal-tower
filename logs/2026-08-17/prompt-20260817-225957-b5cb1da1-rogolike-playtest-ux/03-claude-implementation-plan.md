# 03 — Claude 구현 계획 (RoGolike 플레이테스트 UX 개선)

- 작성자: Claude Code planner (Orca dispatch, 읽기 전용)
- 전제: 구현 주체는 Hermes/Codex. 각 슬라이스는 **strict vertical TDD** — RED 테스트 작성·실패 확인 → 최소 구현 → focused GREEN → 회귀 스위프 순서를 지킨다. RED/GREEN 실행은 `evidence.py capture-command`로 기록한다.
- 명령 규약(Windows): focused `npm.cmd test -- --run <파일...>`, 전체 `npm.cmd test`, 타입 `npm.cmd run typecheck`, 빌드 `npm.cmd run build`.

## 0. 슬라이스 개요와 순서

| 순서 | 슬라이스 | 대상 REQ | 주요 파일 |
|---|---|---|---|
| V1 | 점유 과반 즉시 종료 | R-END | `src/game/battle.ts`, `src/game/GameProvider.tsx`, `src/App.tsx` |
| V2 | pre-move 자동 건너뛰기 | R-PRE | `src/game/battle.ts`, `src/game/GameProvider.tsx`, `src/App.tsx` |
| V3 | 1탭 착수 확정 | R-TAP | `src/game/GameProvider.tsx`, `src/App.tsx`, `src/components/BoardSvg.tsx` |
| V4 | 지도 도달 가능성 | R-MAP | `src/game/map.ts`, `src/game/GameProvider.tsx`, `src/App.tsx` |
| V5 | 카드 명시성 + AI 효과 가중치 | R-CARD, R-STRAT | `src/game/content/stones.ts`, `src/game/ai.ts`, `src/game/GameProvider.tsx`, `src/App.tsx`, `src/styles.css` |
| V6 | 음악 실재생·오류 가시화 | R-AUD | `src/audio/AudioManager.ts`, `src/audio/useGameMusic.ts`, `src/components/AudioControls.tsx` |
| V7 | 회귀 스위프·제품 스크립트·전체 게이트 | 전체 | `scripts/*`, `tests/*`, 전체 명령 |

순서 근거: V1·V2는 순수 엔진(`battle.ts`) 변경으로 다른 슬라이스의 흐름 전제가 된다. V3은 V2의 phase 흐름 위에서 UI reducer를 단순화한다. V4·V5·V6은 상호 독립. V7은 전체 정합.

각 슬라이스 공통 절차:

```bash
# 1) RED: 새 테스트 파일 작성 후 실패 확인 (예시는 V1)
python scripts/evidence/evidence.py capture-command --dir logs/2026-08-17/prompt-20260817-225957-b5cb1da1-rogolike-playtest-ux --role implementer --name red-v1-majority -- npm.cmd test -- --run tests/battle.majority.test.ts
# 기대: exit != 0, 신규 테스트 전부 실패(구현 부재 사유). 통과하면 테스트가 잘못된 것 — 수정 후 재기록.

# 2) GREEN: 최소 구현 후 같은 명령 재실행
python scripts/evidence/evidence.py capture-command --dir ... --role implementer --name green-v1-majority -- npm.cmd test -- --run tests/battle.majority.test.ts

# 3) 슬라이스 회귀: 인접 스위트
npm.cmd test -- --run tests/battle.flow.test.ts tests/battle.revival.test.ts tests/ui.battle.test.tsx
```

---

## V1 — 점유 과반 즉시 종료 (R-END-01~06)

### RED 테스트: `tests/battle.majority.test.ts` (신규)

`createBattleState` + 손패/판면 주입 패턴은 `tests/ui.battle.test.tsx:29-50`의 fixture 구성 방식을 따른다.

1. **순수 함수** `stoneMajorityWinner`:
   - 7×7에서 흑 24·백 0 → `null`; 흑 25 → `'B'`; 백 25 → `'W'`; 9×9에서 흑 40 → `null`, 41 → `'B'`.
2. **첫 수 무승부 보증(영역 미포함)**: 빈 7×7에서 흑이 1수 착수(`PLAY_CARD`) → `phase !== 'result'`, `outcome === null`. (영역 계가라면 49점이 되는 상황 — 점유 수만 세므로 종료 금지.)
3. **흑 도달 → 즉시 승리**: 흑 돌 24개가 놓인 판을 주입하고(백 0) 흑이 25번째 착수 → 부활 없는 적 기준 `phase==='result'`, `outcome==='stage-win'`, `rewardStatus==='available'`, 로그 마지막에 점유 종료 메시지 존재.
4. **백 도달 → 즉시 패배(대칭)**: 백 24개 판에서 백 턴 `PLAY_CARD` 25번째 → `outcome==='run-loss'`.
5. **부활 연동**: `act:1`, revival 정의가 있는 적, 흑이 기준 도달 → `phase==='revival-special-move'`, `revivalStage===2`, `rewardStatus==='withheld'` (기존 `resolveBattleOutcome` 경로 재사용 확인).
6. **패스는 판정 계기가 아님**: 흑 25개 이상이어도(비정상 주입) `PASS`는 기존 흐름(턴 전환/scoring)만 수행.
7. **포획 반영**: 백 돌을 포획하며 착수해 흑이 기준 도달하는 판 구성 → 포획 제거 후 판면으로 판정.

### RED 테스트: `tests/ui.battle.test.tsx` 추가분

8. 전투 화면 battle-stats에 점유 표시(`점유` + 기준치 텍스트, 예: `점유 흑 0 · 백 0 / 25`)가 렌더된다.

### 구현

- `src/game/battle.ts`:
  - `export function stoneMajorityWinner(board: BoardState): StoneColor | null` — B/W 점유 수를 세고 `threshold = Math.ceil(board.points.length / 2)` 비교. 우선순위: 착수자 색이 먼저 검사될 필요는 없음(양측 동시 도달 불가) — B 검사 후 W 검사로 고정.
  - `PLAY_CARD` 성공 분기: `play.board` 확정 후 `stoneMajorityWinner(play.board)` 검사. 도달 시 착수 로그를 남긴 다음 `resolveBattleOutcome(<착수 반영 상태>, winner, action.rng)`를 반환(phase `resolving`을 거치지 않고 즉시 종료). 종료 로그 메시지는 `finishBattle`/`startRevival` 기존 로그에 선행하는 `type:'result'`성 안내가 아니라, `resolveBattleOutcome` 진입 전 `log`에 점유 종료 사유 항목 1건을 추가하는 방식(P-04 문구).
  - `performRevivalSpecialMove`: `candidate.play.board` 반영 후 동일 검사(현실적으로 W만 도달 가능 → run-loss).
- `src/game/GameProvider.tsx`:
  - `previewOrCommit`(V3 이후 `commitMove`): `PLAY_CARD` 결과가 `phase==='result'`면 inspection·`END_TURN`을 건너뛰고 `settleEngineBattle`로 정산. `phase==='revival-special-move'`면 상태만 반영(AI 훅이 진행).
  - `performAiTurn`: AI `PLAY_CARD` 후 `phase==='result'`면 `settleEngineBattle`, `'revival-special-move'`면 기존 경로 유지.
- `src/App.tsx`: battle-stats에 점유 현황/기준 표시(P-10). 기준치는 `Math.ceil(battle.board.points.length / 2)`로 표시 — 설정값 아님(규칙 자체가 승인된 상수식).

### 엣지 케이스

- 흑 승리 + `pendingInspection` 후보 동시 발생(척후석 25번째 착수) → 종료가 우선, inspection 미생성.
- 조기 종료 대국의 `settleEngineBattle`은 기존대로 `scoreArea` 분석을 생성(결과 화면 참고 정보) — 승패는 battle.outcome이 결정하므로 충돌 없음.
- 장군석 냥 지급(`resolveGeneralCaptureEffect`)은 착수 확정 시 이미 처리되는 흐름을 종료 분기에서도 유지할 것(승리 착수가 포획 착수인 경우 냥 지급 후 종료).

---

## V2 — pre-move 자동 건너뛰기 (R-PRE-01~03)

### RED 테스트: `tests/battle.premove.test.ts` (신규)

1. 부적·유물이 모두 없는 상태에서 `BEGIN_TURN` → `phase === 'choose-card'` (현재는 `'pre-move'`라 RED).
2. 부적 1개 보유 시 `BEGIN_TURN` → `phase === 'pre-move'` 유지.
3. `pre-move`에서 `SELECT_CARD` → `phase === 'choose-point'`, `selectedCardId` 설정 (현재는 무시되어 RED).
4. `pre-move`에서 `USE_CHARM` 뒤에도 `SELECT_CARD` 가능.
5. 합법 수가 없으면 `BEGIN_TURN` 자동 패스 유지(기존 동작 회귀 방지).

### RED 테스트: UI (`tests/ui.battle.test.tsx` 수정/추가)

6. 시작 덱 런(부적·유물 0) 전투 진입 직후 "착수로 진행" 버튼이 **없고** 손패 카드가 즉시 활성이다.
7. 부적 보유 fixture에서는 부적 버튼이 보이고, "착수로 진행" 없이 카드를 바로 선택해도 착수 단계로 진행된다(버튼은 존재해도 필수 아님 — P-05 채택 시 pre-move에서만 렌더 유지).

### 구현

- `src/game/battle.ts` `BEGIN_TURN`: `hasLegalCardMove` 검사 후, `state.charms[state.turn].length === 0 && state.relics[state.turn].length === 0`이면 `phase:'choose-card'`, 아니면 `'pre-move'`.
- `SELECT_CARD` 가드: `phase !== 'choose-card' && phase !== 'pre-move'`면 무시. pre-move에서 선택 시에도 `choose-point`로 전이.
- `CONTINUE_TO_MOVE`·`USE_CHARM`·`USE_RELIC`·`PASS` 가드는 기존 유지(모두 pre-move 상태 전제 동작 그대로).
- `src/game/GameProvider.tsx` `readyBattle`: 로직 유지(아이템 없는 W는 이제 `BEGIN_TURN`만으로 `choose-card` 도달; `CONTINUE_TO_MOVE` 분기는 아이템 보유 W 대비 잔존 — 죽은 코드 아님).
- `src/App.tsx`: "착수로 진행" 버튼은 `battle.phase === 'pre-move'`에서만 렌더(기존과 동일 위치). 손패 활성 조건에 `'pre-move'` 추가. 턴 안내 문구에서 pre-move 서술 갱신.

### 엣지 케이스

- 유물은 `usedRelicsThisTurn`이 턴 시작에 항상 비므로 "보유 = 사용 가능"으로 판정한다(단순·결정론적).
- `gameReducer`의 `USE_CHARM` 가드(`phase !== 'pre-move'`)는 유지 — 건너뛴 턴에는 사용할 아이템이 없으므로 모순 없음.

---

## V3 — 1탭 착수 확정 (R-TAP-01~03)

### RED 테스트: `tests/ui.onetap.test.tsx` (신규)

1. 전투 진입 → 카드 선택 → 교차점 **1회 클릭** → `.stone-b` 1개, `버림 1` 표시, "합법 수 미리보기" 문구 미표시. (현재는 1탭이 미리보기만 만들어 RED.)
2. 점유된 좌표 클릭 → 착수 없음 + `이미 돌이 놓인 자리입니다.` 표시, 이후 합법 좌표 1탭으로 정상 확정.
3. reducer 레벨: `CHOOSE_POINT` 1회 dispatch로 `battle.moveNumber === 1`, `preview` 관련 필드 부재.

### 구현

- `src/game/GameProvider.tsx`:
  - `previewOrCommit` → `commitMove`로 개명하고 `state.preview?.point !== point` 분기 삭제 — dry-run 검증 통과 시 즉시 확정. `MovePreview` 타입, `GameState.preview` 필드, 관련 초기화 지점 전부 제거.
  - V1에서 넣은 result/revival 정산 분기 유지.
- `src/App.tsx`: `previewEffects`·`state.preview` 사용처 제거, 턴 안내 문구에서 미리보기 서술 제거(`카드를 고르고 교차점을 누르면 즉시 착수합니다.` 류로 교체).
- `src/components/BoardSvg.tsx`: `previewPoint` prop 및 표시 로직 제거.

### 기존 테스트 갱신(같은 커밋 내)

- `tests/ui.battle.test.tsx`의 2탭 시나리오(65-84행 등), `tests/ui.game.test.tsx`·`tests/ui.progression.test.tsx`·`tests/ui.board.test.tsx`·`tests/effects.queue.test.ts`·`tests/sim.random.test.ts`·`tests/balance.harness.test.ts` 중 2탭/`preview` 참조 전부 1탭으로 수정.
- `scripts/balance.ts`·`scripts/simulate.ts`가 `CHOOSE_POINT`를 2회 dispatch하거나 `CONTINUE_TO_MOVE`를 호출한다면 1탭·자동 스킵 흐름으로 수정.

---

## V4 — 지도 도달 가능성 (R-MAP-01~07)

### RED 테스트: `tests/map.progression.test.ts` (신규)

1. `selectableNodeIds(map, [])` → `map.starts`와 동일(2개).
2. 첫 열 노드 완료 후 → 그 노드의 `next`(1~3개)와 동일, 다른 열·보스 미포함.
3. 4번째 열(column 4) 노드 완료 후 → `[bossId]`.
4. 존재하지 않는 노드 id가 completed에 있으면 throw(방어).
5. **reducer 경로**(`gameReducer` 직접 구동, `DRAFT_GAME_CONFIG`):
   - `START_RUN` 직후 `completedNodeIds`가 비어 있고, 잠긴 노드(2열 이후)로 `OPEN_NODE` → 화면 `map` 유지·전투 미생성·안내 notice.
   - 시작 열 전투 노드 `OPEN_NODE` → 전투 진입, `RESOLVE_BATTLE_FOR_ENGINE`(win) → `completedNodeIds`에 해당 id 추가, 보상 화면 → `CHOOSE_REWARD` → 지도 복귀 후 selectable이 그 노드의 `next`.
   - 비전투 노드(`shop` 등) `OPEN_NODE` → 즉시 완료 처리 + 해당 화면 진입, `RETURN_TO_MAP` 후 `next` 열림.
   - 경로를 보스까지 완주 → 보스 `OPEN_NODE` 허용; 보스 승리(`RESOLVE_BATTLE_FOR_ENGINE` win) → `run.act===2`, 새 지도, `completedNodeIds===[]`.
   - `RESTART` → 초기화.

### RED 테스트: `tests/ui.map.progression.test.tsx` (신규)

6. 등반 시작 직후 지도에서 시작 열 2개 버튼만 활성(`disabled` 아님), 나머지 노드·보스는 `disabled`.
7. 잠긴 노드 클릭 시 화면 전환 없음.
8. "여정 시설" 섹션(무제한 상점/사건/도장 버튼)이 렌더되지 않는다.
9. `completedNodeIds`를 주입한 initialState에서 완료 노드는 `data-state="done"`, 열린 노드만 `data-state="open"`.

### 구현

- `src/game/map.ts`: `export function selectableNodeIds(map: ActMap, completedNodeIds: readonly string[]): readonly string[]` — 완료 목록 비어 있으면 `starts`, 아니면 마지막 완료 id의 노드(`columns.flat()`+boss lookup)의 `next`. 미지 id는 throw.
- `src/game/GameProvider.tsx`:
  - `GameState`에 `completedNodeIds: readonly string[]` 추가(`createInitialGameState`에서 `[]`).
  - `openNode`: `selectableNodeIds(state.map, state.completedNodeIds)`에 없으면 `{ ...state, notice: '아직 이어지지 않은 길입니다.' }` 반환. 비전투 노드는 진입 시 `completedNodeIds` append(P-02). 전투/정예/보스는 append하지 않고 진입만.
  - `completeRunBattle`: 승리 시(`resolution==='win'`) `state.selectedNodeId`가 있으면 append. 보스 승리·2막 전환 분기에서는 `completedNodeIds: []`로 초기화. 패배/기권은 미변경(런 종료).
  - `RESTART`는 `createInitialGameState`로 자연 초기화.
  - 주의: `OPEN_BATTLE`(nodeId 없는 테스트용 직접 진입)은 가드 없이 유지 — 지도 게이트는 `OPEN_NODE` 전용.
- `src/App.tsx` `MapScreen`:
  - 평탄화 렌더를 열 구조 순회로 교체(열별 그룹 + 보스), 각 노드 버튼에 `disabled={!open}`, `data-node-id`, `data-state`(`done`/`open`/`locked`) 부여.
  - "여정 시설" 섹션 제거(R-MAP-07).

### 엣지 케이스

- 사당(shrine) `OPEN_NODE`: 완료 append + 기존 notice 유지(지도 잔류).
- 전투 이탈(`RETURN_TO_MAP`) 후 같은 노드만 다시 open 상태(마지막 완료 노드의 next 불변) — 테스트 5에 케이스 포함 권장.
- 보상 화면에서 `DECLINE_REWARD`도 동일하게 진행 보존.

---

## V5 — 카드 명시성 + AI 효과 가중치 (R-CARD, R-STRAT)

### RED 테스트: `tests/stones.presentation.test.ts` (신규)

1. 6개 `STONE_DEFINITIONS[*].ui`가 존재하고 `summary`/`condition`/`strategy`가 비어 있지 않은 한국어 문자열(내부 enum 문자열·`STONE-` 접두 미포함).
2. `classKey` 6종·`icon` 6종이 서로 모두 다르다.
3. 요약 문구가 승인 문서 수치와 일치: 척후석 summary에 `2장`, 장군석에 `5냥`, 기병석에 `1장`, 수호석에 `2` (활로), 희생석에 `패 한도`.

### RED 테스트: `tests/ui.card-clarity.test.tsx` (신규)

4. 전투 화면 손패 카드에 내부 enum(`after-placement` 등 5종 문자열)과 `STONE-00` 문자열이 렌더되지 않고, 각 카드에 `data-stone-class`와 문양 요소가 있다.
5. 카드 선택 시 상세 패널에 발동 조건·전략 문구가 표시된다.
6. 척후석 착수(1탭) 후 효과 발동 표시(`role="status"` 배너)에 `척후석`이 포함된다.
7. 보상 화면에서 부적/유물 후보가 원시 ID(`ITEM-`, `RELIC-`) 대신 정의 이름으로 표시된다.

### RED 테스트: `tests/ai.effects.test.ts` (신규)

8. 동일 포획 수(0)의 두 후보(일반석 vs 척후석)만 가능한 손패/판면에서, `aiEffectWeight > 0` 평가로 `chooseBattleAiMove`가 척후석 후보를 선택한다.
9. `aiEffectWeight = 0`이면 기존 포획 가중치 평가와 동일한 선택(회귀 보증).
10. 발동 예측 순수 함수: 장군석은 포획 후보에서만 참, 수호석은 활로≤2 아군 인접 착수에서만 참, 일반석·희생석·기병석은 항상 거짓.

### 구현

- `src/game/content/stones.ts`: `StoneDefinition`에 `ui` 필드 추가(P-06 구조·문구는 docs/03_content/01_특수돌.md의 MVP 서술 기반, 구현 동작과 일치하도록 작성 — 예: 장군석은 "이 카드로 착수해 포획하면"으로 그룹 서술을 구현 실태에 맞춤). `export function candidatePlacementTriggersEffect(board: BoardState, point: number, color: StoneColor, kind: StoneKind, capturedCount: number): boolean` 추가(척후=true, 장군=capturedCount>0, 수호=`resolveGuardianEffect` 조건 재사용, 그 외 false).
- `src/game/GameProvider.tsx` `performAiTurn`: 평가 클로저를 `(candidate) => candidate.captured.length * config.aiCaptureWeight + (candidatePlacementTriggersEffect(...) ? config.aiEffectWeight : 0)`으로 교체. `assertConfig` numeric 목록에 `aiEffectWeight` 추가.
- `GameConfig` 필드 추가에 따른 일괄 갱신: `tests/fixtures/draft-game-config.ts`(제안 fixture 값 2 — 테스트 전용), `tests/fixtures/ai-benchmark.ts`(해당 시), `scripts/playwright-mobile-check.mjs` 주입 config, `scripts/balance.ts`/`scripts/simulate.ts`(GameConfig 생성 시).
- `src/App.tsx`: 카드 버튼 렌더 교체(`card.kind.slice(-1)`·`effect?.trigger` 제거 → 문양·이름·summary·`data-stone-class`), 선택 카드 상세 패널, 효과 배너(최근 `effectLog`/`battle.log`의 효과 항목), RewardScreen에 `CHARM_DEFINITIONS`/`RELIC_DEFINITIONS` 이름 사용.
- `src/styles.css`: 병종 classKey별 색·문양 스타일(값은 AI 초안, 인간 시각 검토 항목로 07에 기록).

### 엣지 케이스

- 효과 문구는 렌더 전용이며 `createStoneEffectDefinition` 로그 메시지(`'…효과가 발동했다.'`)와 별개 — 엔진 메시지 변경은 범위 밖(기존 테스트 보호).
- `deck-summary`·도장·상점의 병종 표기는 이미 `name` 사용 — 유지.

---

## V6 — 음악 실재생·오류 가시화 (R-AUD-01~05)

### RED 테스트: `tests/audio.manager.test.ts` 추가분 (기존 Fake 패턴 재사용, FakeSource에 start 호출 카운터 추가)

1. **resume 미해결에도 재생 진행**: `resume`이 pending인 FakeContext로 `unlock()` → tick 후 fetcher 1회 호출·`source.start` ≥ 1. (현재 RED — fetch 자체가 안 일어남.)
2. **fetch 실패 → fallback**: fetcher가 reject → fallback `audio.play()` 호출 + `snapshot().playback === 'fallback'`(신규 필드) + `onError` 1회 이상.
3. **정상 경로 상태**: 성공 unlock 후 `snapshot().playback === 'web-audio'`.
4. **오류 상태 노출**: WebAudio 실패 + `createAudio: null` → `playback === 'error'`, `lastError` 비어 있지 않음.
5. **재시도**: error 상태에서 `unlock()` 재호출 시 다시 로드를 시도한다(fetcher 재호출).

### RED 테스트: `tests/ui.audio-status.test.tsx` (신규)

6. `AudioControls`에 `playback:'error'` 스냅샷 stub 전달 시 재시도 버튼이 렌더되고 클릭 시 `unlock`이 호출된다.
7. 정상/에러 외 상태에서 기존 트랙 라벨(`여정 음악` 등)·음소거 토글 유지(회귀).

### 구현

- `src/audio/AudioManager.ts`:
  - `unlock()`: context/master 생성 → `void this.context.resume().catch(this.onError)`(await 제거) → `await this.switchWebAudio(...)`. try/catch의 실패 → fallback 경로 유지.
  - `switchWebAudio` catch: AbortError가 아니면 `onError` 후 **`switchFallback` 자동 시도** + 상태 갱신.
  - 상태 필드: `playback`(P-09 5상태) + `lastError`. `scheduleSegment`의 `source.start` 성공 시 `'web-audio'`, `switchFallback`의 `play()` 성공 시 `'fallback'`, 모두 실패 시 `'error'`. `snapshot()`에 포함.
  - `AudioManagerOptions.onStatusChange?: () => void` — playback 전이 시 호출.
  - `unlock()` 재호출 가드: 현재 `if (this.unlocked) return this.resume()` — `playback==='error'`면 재로드(`switchWebAudio` 재시도)로 확장.
- `src/audio/useGameMusic.ts`: `onError`(lastError 반영 refresh)와 `onStatusChange`(refresh) 주입.
- `src/components/AudioControls.tsx`: `playback==='error'`일 때 재시도 버튼(`음악 다시 시도`) 렌더 → `music.unlock()`. 기존 라벨 문자열 유지(모바일 게이트가 `여정 음악` 텍스트를 검증).

### 엣지 케이스

- `dispose()` 중 pending load: 기존 generation/aborter 가드 유지 확인.
- 음소거 상태 unlock: 재생 시작하되 gain 0 — `playback`은 재생 경로 기준(음소거와 독립).
- StrictMode 이중 마운트: manager 재생성 후 첫 gesture에서만 unlock — 기존 구조 유지.

---

## V7 — 회귀 스위프·제품 스크립트·전체 게이트

1. **스크립트 정합**: `scripts/playwright-mobile-check.mjs` 재작성 —
   - 주입 config에 `aiEffectWeight` 추가.
   - "보스전 바로 클릭" 제거: 고정 seed의 지도 경로를 따라 시작 열부터 노드를 순서대로 완료하며 보스 도달(잠긴 노드 클릭이 무효인지 1회 검증 포함).
   - `착수로 진행` 클릭 제거(시작 런은 pre-move 없음), 좌표 2탭 → 1탭.
   - 기존 검증 유지: 화면별 음악 라우팅 텍스트, 7×7/9×9 좌표 수, 부활 2단계, 2막 전환, 터치 타깃.
2. **전체 테스트 갱신 확인**: §V3·V5에 나열된 기존 스위트가 새 흐름으로 갱신되었는지 `npm.cmd test`로 확인.
3. **필수 게이트 실행·기록** (`evidence.config.json` required와 argv 일치, verifier가 재실행할 명령과 동일):

```bash
python scripts/evidence/evidence.py capture-command --dir <prompt-dir> --role implementer --name full-tests -- npm.cmd test
python scripts/evidence/evidence.py capture-command --dir <prompt-dir> --role implementer --name typecheck -- npm.cmd run typecheck
python scripts/evidence/evidence.py capture-command --dir <prompt-dir> --role implementer --name build -- npm.cmd run build
python scripts/evidence/evidence.py capture-command --dir <prompt-dir> --role implementer --name benchmark-ai -- npm.cmd run benchmark:ai
python scripts/evidence/evidence.py capture-command --dir <prompt-dir> --role implementer --name runtime-audit -- npm.cmd audit --omit=dev --audit-level=high
python scripts/evidence/evidence.py capture-command --dir <prompt-dir> --role implementer --name mobile-check -- npm.cmd run check:mobile
```

4. `snapshot --stage implementation` 후 Claude 검증 dispatch 요청(AGENTS §3.6).

## 리스크와 완화

| 리스크 | 완화 |
|---|---|
| `GameConfig` 필드 추가 누락으로 typecheck/assertConfig 연쇄 실패 | V5에서 `aiCaptureWeight`를 grep해 config 생성처 전수 갱신 후 typecheck 즉시 실행 |
| phase 흐름 변경이 시뮬/밸런스 스크립트를 조용히 깨뜨림 | V7에서 `benchmark:ai`·`balance`·`simulate` 실행 확인(전자는 required) |
| 모바일 게이트 재작성 실패 반복 | 같은 실패 3회 시 중단·에스컬레이션(AGENTS §3) |
| 점유 종료와 inspection·부활의 상호작용 회귀 | V1 테스트 5·엣지 케이스를 battle.revival.test.ts와 함께 실행 |
