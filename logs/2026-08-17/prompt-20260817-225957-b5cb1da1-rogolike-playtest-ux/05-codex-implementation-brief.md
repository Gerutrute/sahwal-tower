# 05 — Codex 구현 브리프 (RoGolike 플레이테스트 UX 개선)

- 수신: Hermes/Codex (유일한 구현자)
- 근거: `02-claude-requirements-analysis.md`(REQ/P), `03-claude-implementation-plan.md`(V1~V7), `04-claude-acceptance-criteria.md`(AC)
- 절대 규칙: dev 브랜치, commit/push 금지. 새 런타임 의존성 금지. 제품 코드에 미승인 밸런스 기본값 금지(신규 수치는 GameConfig 주입). `RoGolike` 표기 불변. 각 슬라이스는 RED → GREEN 순서로 진행하고 실행 로그를 capture-command로 남긴다. 같은 실패 3회 반복 시 중단하고 에스컬레이션.

## 0. 작업 순서 요약

V1 점유 종료 → V2 pre-move → V3 1탭 → V4 지도 → V5 카드/AI → V6 오디오 → V7 스크립트·게이트. 슬라이스마다: (1) 신규 테스트 작성, (2) `npm.cmd test -- --run <신규 파일>`로 RED 기록, (3) 구현, (4) 같은 명령 GREEN 기록, (5) 인접 스위트 회귀.

## 1. V1 — 점유 과반 즉시 종료

**신규 테스트** `tests/battle.majority.test.ts` — 03 §V1의 8케이스. 판면 주입은 `createBattleState` 후 spread로 `board.points` 교체(기존 `ui.battle.test.tsx` fixture 패턴).

**구현** `src/game/battle.ts`:

```ts
export function stoneMajorityWinner(board: BoardState): StoneColor | null {
  // threshold = Math.ceil(board.points.length / 2); B/W 점유 수만 비교. scoreArea 호출 금지.
}
```

- `PLAY_CARD` 성공 분기: 착수 로그 append 후 `stoneMajorityWinner(play.board)`가 non-null이면, 점유 종료 사유 로그 1건을 추가하고 `resolveBattleOutcome(적용된 상태, winner, action.rng)` 반환. 이때 deck 소비·`moveNumber`·`koForbiddenKey`·`consecutivePasses:0` 반영은 기존과 동일하게 유지한 상태 객체 위에서 수행할 것.
- `performRevivalSpecialMove`: `candidate.play.board` 반영 후 동일 검사(도달 시 `resolveBattleOutcome`).
- `src/game/GameProvider.tsx`: `previewOrCommit`(V3에서 `commitMove`)와 `performAiTurn`에서 `PLAY_CARD` 결과 `phase==='result'` → `settleEngineBattle(...)` 호출, `'revival-special-move'` → 상태 반영 후 반환. 장군석 냥 지급은 종료 착수에서도 수행.
- `src/App.tsx` battle-stats: `점유 흑 {b} · 백 {w} / {Math.ceil(size*size/2)}` 표기(문구는 조정 가능하되 흑·백 점유 수와 기준치 모두 포함, AC-05).

주의: 승리 착수와 inspection 조건이 겹치면 종료 우선(inspection 미생성). 흑 승리 → 부활 적이면 `revival-special-move`로 전이되고 이후 AI 훅이 진행한다 — `useAiTurn`은 `turn==='W'`에서 발화하므로 추가 배선 불요, 단 테스트로 확인.

## 2. V2 — pre-move 자동 건너뛰기

**신규 테스트** `tests/battle.premove.test.ts` — 03 §V2의 5케이스 + UI 케이스는 `ui.battle.test.tsx`에 추가.

**구현** `src/game/battle.ts`:

- `BEGIN_TURN`: `hasLegalCardMove` 통과 후 `state.charms[state.turn].length === 0 && state.relics[state.turn].length === 0` → `phase:'choose-card'`, 아니면 `'pre-move'`.
- `SELECT_CARD` 가드에 `'pre-move'` 허용(전이는 기존과 동일하게 `choose-point`).
- `CONTINUE_TO_MOVE`는 그대로 두되 pre-move에서만 의미(명시적 건너뛰기 버튼).

`src/App.tsx`: 손패 카드 활성 조건에 `pre-move` 추가, "착수로 진행" 버튼은 `phase==='pre-move'`일 때만 렌더(현행 조건 유지 — 이제 아이템 보유 턴에만 나타남). 턴 안내 문구 갱신.

## 3. V3 — 1탭 착수 확정

**신규 테스트** `tests/ui.onetap.test.tsx` — 03 §V3의 3케이스.

**구현** `src/game/GameProvider.tsx`:

- `previewOrCommit` → `commitMove` 개명. `if (state.preview?.point !== point) { ...preview 저장... }` 분기 삭제 — dry-run 통과 즉시 커밋. `MovePreview` 타입·`GameState.preview` 필드·모든 초기화 지점(`openBattle`, `completeRunBattle`, `RETURN_TO_MAP` 등) 제거.
- `src/App.tsx`: `state.preview` 참조(`previewEffects`, BoardSvg `previewPoint`, "합법 수 미리보기…" 문구) 제거. `src/components/BoardSvg.tsx`: `previewPoint` prop 제거.

**동시 갱신(같은 슬라이스에서)**: 2탭·preview를 참조하는 기존 테스트 전부 — `ui.battle`, `ui.game`, `ui.progression`, `ui.board`, `effects.queue`, `sim.random`, `balance.harness` — 1탭 흐름으로 수정. `scripts/balance.ts`·`scripts/simulate.ts`의 `CHOOSE_POINT` 2회 호출·`CONTINUE_TO_MOVE` 의존을 제거.

## 4. V4 — 지도 도달 가능성

**신규 테스트** `tests/map.progression.test.ts`, `tests/ui.map.progression.test.tsx` — 03 §V4의 9케이스.

**구현**:

- `src/game/map.ts`: `selectableNodeIds(map, completedNodeIds)` — 빈 목록 → `[...map.starts]`; 아니면 마지막 완료 id를 `columns.flat()`+`boss`에서 찾아 `next` 반환; 미지 id는 `Error` throw.
- `src/game/GameProvider.tsx`:
  - `GameState.completedNodeIds: readonly string[]` 추가(`createInitialGameState`에서 `[]`).
  - `openNode`: 첫 줄에서 `selectableNodeIds(...)` 미포함 시 `{ ...state, notice: '아직 이어지지 않은 길입니다.' }` 반환(문구 조정 가능). 비전투 노드(`shop|event|dojo|shrine`)는 진입 처리 전에 `completedNodeIds: [...state.completedNodeIds, node.id]` 반영. 전투류는 진입만.
  - `completeRunBattle`: `resolution==='win' && state.selectedNodeId !== null`이면 append(비보스). 보스 승리 2막 전환 분기는 `completedNodeIds: []`. 패배·기권 분기는 무변경.
  - `OPEN_BATTLE`(nodeId 미지정 직접 진입)은 게이트 없이 유지(테스트·엔진용).
- `src/App.tsx` `MapScreen`: 열 구조 렌더(열 그룹 + 보스), 버튼에 `disabled={!open}`·`data-node-id`·`data-state="done|open|locked"`. **"여정 시설" 섹션 삭제**(`OPEN_SHOP`/`OPEN_EVENT`/`OPEN_DOJO` 액션 자체는 존치 — `openNode`가 내부적으로 사용).

## 5. V5 — 카드 명시성 + AI 효과 가중치

**신규 테스트** `tests/stones.presentation.test.ts`, `tests/ui.card-clarity.test.tsx`, `tests/ai.effects.test.ts` — 03 §V5의 10케이스.

**구현**:

- `src/game/content/stones.ts`: `StoneDefinition`에 `ui` 추가. 문구는 `docs/03_content/01_특수돌.md` MVP 서술 기반, 구현 동작과 정확히 일치하도록(과장 금지). 초안(조정 가능하되 AC-19 키워드 포함):

| kind | classKey | icon | summary | condition | strategy |
|---|---|---|---|---|---|
| STONE-001 일반석 | `basic` | 基 | 효과 없는 기본 돌. | 항상 착수 가능. | 덱을 안정시키고 효과 밀도를 조절한다. |
| STONE-002 척후석 | `scout` | 斥 | 착수 후 덱 위 2장을 확인하고 순서를 바꾼다. | 이 카드를 착수했을 때. | 다음 드로우를 설계해 원하는 병종을 준비한다. |
| STONE-003 장군석 | `general` | 將 | 이 카드로 착수해 포획하면 5냥을 얻는다(대국당 상한). | 이 착수로 상대 돌을 잡았을 때. | 포획 수를 경제로 바꿔 상점·도장을 연다. |
| STONE-004 기병석 | `cavalry` | 騎 | 패에 들어올 때 덱 위 1장을 확인한다. | 직전 내 착수로 상대 돌을 잡았을 때. | 포획 흐름을 이어 정보 우위를 만든다. |
| STONE-005 수호석 | `guardian` | 守 | 착수 후 덱 위 2장을 확인한다. | 활로 2 이하인 아군 그룹 옆에 착수했을 때. | 위기 그룹을 살리며 다음 수를 내다본다. |
| STONE-006 희생석 | `sacrifice` | 犧 | 잡히면 다음 내 턴 패 한도가 1 늘어난다. | 상대의 착수로 포획됐을 때. | 버림돌로 유인하고 손패 이득을 챙긴다. |

- 같은 파일에 `candidatePlacementTriggersEffect(board, point, color, kind, capturedCount): boolean` — scout→true, general→`capturedCount>0`, guardian→`resolveGuardianEffect(board, point, color, <빈 덱 아님 아무 deck>)`의 조건 재사용(주의: deck 인자가 필요 없도록 endangered 판정만 분리해도 좋다 — 분리 시 `resolveGuardianEffect`가 새 helper를 사용하게 리팩터), 그 외 false.
- `src/game/GameProvider.tsx`: `GameConfig.aiEffectWeight: number` 추가(assertConfig numeric 목록 포함), `performAiTurn` 평가식에 `+ (triggers ? config.aiEffectWeight : 0)`.
- **config 생성처 전수 갱신**(`aiCaptureWeight` grep으로 확인): `tests/fixtures/draft-game-config.ts`(제안값 `aiEffectWeight: 2` — 테스트 전용 명기), `tests/fixtures/ai-benchmark.ts`(GameConfig를 만들면), `scripts/playwright-mobile-check.mjs`, `scripts/balance.ts`, `scripts/simulate.ts`, `scripts/benchmark-ai.mjs` 경유 fixture.
- `src/App.tsx`: 카드 버튼 — `card.kind.slice(-1)` 뱃지와 `definition.effect?.trigger` 줄 삭제 → `<span className="card-icon" aria-hidden>{ui.icon}</span>`, 이름, `<small>{ui.summary}</small>`, `data-stone-class={ui.classKey}`. 선택 카드 상세 패널(조건·전략). 효과 배너: `role="status"`로 최신 효과 항목(`state.effectLog` 마지막 + `battle.log`의 charm/relic/revival 메시지) 강조 표시. RewardScreen/ShopScreen: `candidate.charmId`/`relicId`/`offer.productId` 원시 노출을 `CHARM_DEFINITIONS`/`RELIC_DEFINITIONS` 이름으로 교체.
- `src/styles.css`: `.card[data-stone-class=...]` 6종 색 변수·아이콘 스타일(값은 초안, 07에서 인간 검토 항목으로 보고).

## 6. V6 — 오디오

**테스트**: `tests/audio.manager.test.ts`에 03 §V6의 5케이스 추가(FakeSource에 `startCalls` 카운터, FakeContext에 pending resume 옵션). `tests/ui.audio-status.test.tsx` 신규(stub `music` 객체로 `AudioControls` 직접 렌더).

**구현** `src/audio/AudioManager.ts`:

- `unlock()`: `await this.context.resume().catch(...)` → `void this.context.resume().catch(this.onError)`로 변경(로드를 resume에 종속시키지 않음). 이후 `await this.switchWebAudio(...)`는 유지.
- `switchWebAudio` catch(비-Abort): `this.onError(error)` 후 `await this.switchFallback(track)` 시도 + 상태 갱신.
- 상태: private `playback: 'idle'|'pending'|'web-audio'|'fallback'|'error'`, `lastError: string | null`. 전이 — unlock 진입 시 `pending`; `scheduleSegment`에서 `source.start` 호출 성공 시 `web-audio`; fallback `play()` 성공 시 `fallback`; 로드·fallback 모두 실패 시 `error` + `lastError` 세팅. `snapshot()`에 두 필드 추가. 전이 시 `options.onStatusChange?.()` 호출.
- `unlock()` 재호출: `unlocked && playback === 'error'`면 재로드 경로(현재 트랙 `switchWebAudio` 재시도) — 그 외 기존 `resume()` 위임 유지.
- `src/audio/useGameMusic.ts`: `new AudioManager({ tuning, onError: () => refresh(...), onStatusChange: () => refresh(...) })` 형태로 리렌더 배선(콜백 안정성 주의 — manager는 `useMemo` 유지).
- `src/components/AudioControls.tsx`: `snapshot.playback === 'error'`면 `음악 다시 시도` 버튼 → `void music.unlock()`. 기존 라벨 문자열(`여정 음악` 등)은 변경 금지(모바일 게이트 의존).

## 7. V7 — 스크립트·게이트

1. `scripts/playwright-mobile-check.mjs` 재작성:
   - config에 `aiEffectWeight` 추가.
   - 흐름: 등반 시작 → (음악 라벨 확인) → **잠긴 노드(보스) 클릭이 무효임을 1회 확인** → 시작 열 노드부터 시드 고정 경로로 완료 반복(전투는 1탭 착수+패스 승리 흐름, 비전투는 방문·복귀) → 보스 진입 → 부활 2단계 → 2막 전환 → 9×9 확인 → 기존 터치 타깃 검증. `착수로 진행` 클릭과 좌표 2탭 제거.
   - 경로의 노드 유형은 고정 seed로 결정적이므로 `data-state="open"` 버튼을 순서대로 따라가는 일반 로직 권장(유형 하드코딩 지양).
2. 전체 게이트를 03 §V7의 capture-command 6종으로 실행·기록(argv는 `evidence.config.json`과 정확히 일치).
3. `snapshot --stage implementation` → `06/07` 작성 → fresh Claude 검증 dispatch 요청.

## 8. 금지·주의 사항

- 내부 enum·원시 ID를 사용자 문구로 노출하는 코드 경로를 새로 만들지 말 것(AC-20 전수 검사 대상).
- `stoneMajorityWinner`에서 `scoreArea`·territory 계산 호출 금지(AC-01 소스 검사 대상).
- `aiEffectWeight`·기타 신규 수치에 `?? <기본값>` fallback 금지 — 누락은 `assertConfig`가 throw해야 한다.
- 지도 생성기(`generateActMap`) 구조·`MapNode.next` 생성 로직 변경 금지 — 소비 측만 추가.
- 기능과 무관한 리팩터링·포맷 변경 금지. 테스트 로그·exit code는 실제 출력 그대로 보존.
- 07-codex-result에는 §E(04)의 인간 판단 항목(색·문양, aiEffectWeight 제품값, 대국 템포, 전투 이탈 정책, 실기기 청음)을 남은 판단으로 명시할 것.
