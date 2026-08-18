# 02 — Claude 요구사항 분석 (RoGolike 플레이테스트 UX 개선)

- 작성자: Claude Code planner (Orca dispatch, 읽기 전용)
- Orca Task/Dispatch: `task_5a022ba841b5` / `ctx_973f89a5b1a6`
- 기준 입력: `00-user-request.md`, `01-human-design-decisions.md`(HDD-001~007), `AGENTS.md`, `docs/` 0.2.3, dev 브랜치 현재 소스(`git_head_before: 8df1159`)
- 제품 표시명: **`RoGolike`** 유지. dev 브랜치, commit/push 금지. Claude는 소스를 수정하지 않고 본 증적 4개 파일만 작성한다.

## 1. 요청 요약

2026-08-17 사용자 플레이테스트에서 6개 결함/개선이 보고되었고, 인간 게임 디자인 결정 HDD-001~007로 승인됐다.

1. 음악 미재생 (HDD-001)
2. 지도 전 노드 동시 선택 가능 — 도달 가능성 미적용 (HDD-002)
3. 승리 조건 모호·대국이 루즈함 — 점유 우세 즉시 종료 필요 (HDD-003)
4. 착수 확인 단계 과다 — 1탭 확정, 빈 pre-move 강요 금지 (HDD-004/005)
5. 카드 효과 불명시·시각 구별 불가 (HDD-006)
6. 카드 고유 효과의 전략적 활용이 승리로 이어지는 구조 (HDD-007)

## 2. 현재 코드 기준선과 근본 원인 (읽기 전용 재현 확인)

증적 재현은 이번 프롬프트의 사전 조사에서 완료됐다. 각 항목의 코드 상 원인 위치는 아래와 같다.

### 2.1 음악 (재현: 등반 시작 클릭 후 AudioContext 생성 1회·resume 호출 1회, 그러나 5초 내 BufferSource.start 0회·음악 asset 네트워크 요청 0건)

| 위치 | 원인 |
|---|---|
| `src/audio/AudioManager.ts:130-150` `unlock()` | `await this.context.resume()`이 **buffer 로드보다 앞에서 await** 된다. resume promise가 브라우저 정책·상태에 따라 settle되지 않으면 `switchWebAudio`(fetch→decode→`source.start`)가 영원히 실행되지 않는다. |
| `src/audio/AudioManager.ts:142` / `:266` | resume·load 실패가 `.catch(this.onError)`로 흡수되는데 기본 `onError`는 `() => undefined`(`:114`) — **오류가 완전히 invisible**. `switchWebAudio` 실패 시 fallback 시도도 없다. |
| `src/audio/useGameMusic.ts:6` | `new AudioManager({ tuning })` — `onError` 미주입. 스냅샷에 재생 상태·오류 필드가 없어(`AudioSnapshot`, `AudioManager.ts:20-28`) UI가 실패를 표시할 방법이 없다. |
| `src/components/AudioControls.tsx` | 트랙명·음소거 토글만 표시. 재생 실패·복구 UI 없음. |

### 2.2 지도 진행 (재현: 지도에서 보스 포함 모든 노드가 즉시 클릭·진입 가능)

| 위치 | 원인 |
|---|---|
| `src/App.tsx:49` `MapScreen` | `[...state.map.columns.flat(), state.map.boss]`로 **전 노드를 평탄화**해 모두 활성 버튼으로 렌더, 클릭 시 무조건 `OPEN_NODE` dispatch. |
| `src/game/GameProvider.tsx:637-645` `openNode` | 도달 가능성 검사 없음. `MapNode.next`(`src/game/map.ts:23`)는 생성만 되고 **소비처가 없다**(`enumerateMapPaths`는 테스트용). |
| `src/App.tsx:66-73` | "여정 시설" 버튼이 `OPEN_SHOP`/`OPEN_EVENT`/`OPEN_DOJO`를 노드와 무관하게 무제한 개방 — 노드 진행을 완전히 우회한다. |
| `src/game/GameProvider.tsx` `GameState` | 현재 위치·완료 노드를 기록하는 필드가 없다(`selectedNodeId`는 전투 진입 시에만 세팅). |

### 2.3 대국 종료 (재현: 흑이 판 과반을 점유해도 양측 연속 패스 전까지 대국 지속)

| 위치 | 원인 |
|---|---|
| `src/game/battle.ts:221-239`, `:515-519` | 종료 경로가 **연속 패스 2회 → `scoring` → `scoreArea`** 뿐이다. 착수 후 점유 검사 없음. |
| `src/App.tsx` BattleScreen | 승리 조건이 화면 어디에도 명시되지 않는다. |

### 2.4 착수 확인 단계 (재현: 카드 선택 → 좌표 1탭 = 미리보기 → 같은 좌표 재탭 = 확정, 매 턴 "착수로 진행" 버튼 필수)

| 위치 | 원인 |
|---|---|
| `src/game/GameProvider.tsx:482-489` `previewOrCommit` | `state.preview?.point !== point`면 미리보기만 저장하고 **두 번째 동일 좌표 탭에서만 확정**. |
| `src/game/battle.ts:433-436` `BEGIN_TURN` | 부적·유물 유무와 무관하게 항상 `pre-move` 진입. `src/game/GameProvider.tsx:241-246` `readyBattle`은 W만 자동 통과시키고 **플레이어는 항상 pre-move에서 정지** → `App.tsx:168` "착수로 진행" 버튼 클릭 강제. 시작 덱 런은 부적·유물이 0개이므로 모든 턴에서 빈 확인 단계가 강요된다. |

### 2.5 카드 명시성 (재현: 카드에 `after-placement` 등 내부 enum 문자열 노출)

| 위치 | 원인 |
|---|---|
| `src/App.tsx:136` | `<small>{definition.effect?.trigger ?? '기본 착수'}</small>` — `StoneEffectTrigger` **내부 enum을 그대로 렌더**. |
| `src/game/content/stones.ts:25-52` | `STONE_DEFINITIONS`에 사용자용 효과 문장·조건·전략 필드가 없다. |
| `src/App.tsx:134` | 병종 구별 표기가 `card.kind.slice(-1)`(숫자 한 자리)뿐. 병종별 색·문양 없음. |
| `src/App.tsx:169-174` | 효과 발동이 하단 "효과 기록" 목록 3줄에 섞여 표시 — 발동 사실이 시각적으로 묻힌다. |
| `src/App.tsx:194` RewardScreen | 부적/유물 보상이 `candidate.charmId`/`relicId` 원시 ID로 노출(부수 결함). |

### 2.6 전략적 카드 플레이

- 6개 병종 효과 자체는 엔진에 구현돼 있다(`stones.ts`의 척후/장군/기병/수호/희생 resolver, `GameProvider.tsx`의 발동 배선). 문제는 (a) 발동이 §2.5처럼 비가시적이고, (b) AI 평가함수가 `captured.length * aiCaptureWeight` 단일 항(`GameProvider.tsx:561`)이라 **AI가 특수 돌을 전략적으로 쓰지 않으며**, (c) 확인(inspection) 패널 흐름이 확인 중심이라 효과 체감이 약하다.

## 3. 요구사항 (인간 결정 번역)

상태 표기 — **확정**: HDD로 승인된 디자인 결정의 직접 번역. **파생**: 승인 결정이 논리적으로 강제하는 결과. 구현 기법 선택은 §4의 AI 제안으로 분리한다.

### R-END 대국 종료: 점유 과반 즉시 종료 (HDD-003)

| ID | 요구사항 | 상태 |
|---|---|---|
| R-END-01 | 과반 판정값은 **문자 그대로의 돌 점유 수**다: 판 위에 놓인 해당 색 돌의 개수. 영역(집)·덤·포획 수는 판정에 포함하지 않는다. | 확정 |
| R-END-02 | 기준치 = `ceil(판 전체 교차점 수 / 2)` — 7×7은 `ceil(49/2)=25`, 9×9는 `ceil(81/2)=41`. "정확히 절반도 기준 도달"을 ceil이 포괄한다(짝수 교차점 판이 생기면 정확히 절반=기준 도달). | 확정 |
| R-END-03 | 판정 시점은 **완결된 착수 직후**(포획 제거까지 반영된 판면)뿐이다: 플레이어 카드 착수, AI 카드 착수, 부활 전용 착수. 패스·미리보기(dry-run)·대국 시작 시에는 판정하지 않는다. 따라서 영역 계가로 인한 첫 수 승리는 구조적으로 불가능하다. | 확정 |
| R-END-04 | 흑 돌 수 ≥ 기준치 → 즉시 흑 승 판정(기존 `resolveBattleOutcome` 경로: 1막 1단계 부활 적이면 부활 2단계 진입, 그 외 stage-win). 백 돌 수 ≥ 기준치 → 즉시 run-loss. 대칭 규칙. (홀수 교차점 판에서 양측 동시 도달은 수학적으로 불가능: `2×ceil(n/2) > n`.) | 확정 |
| R-END-05 | 기존 종료 경로(연속 패스 2회 → 면적 계가, 기권)는 유지된다. 점유 과반은 추가 조기 종료 조건이다. | 확정 |
| R-END-06 | 전투 UI에 승리 조건이 명시적으로 표시된다: 현재 흑/백 점유 수와 기준치. 즉시 종료 발생 시 종료 사유가 로그/화면에 명시된다. | 확정(표시 의무) / 문구·배치는 AI 제안 |

### R-MAP 지도 진행 (HDD-002)

| ID | 요구사항 | 상태 |
|---|---|---|
| R-MAP-01 | 각 막은 첫 번째 열(`map.starts`)의 노드에서만 시작할 수 있다. | 확정 |
| R-MAP-02 | 노드 완료 후에는 **해당 노드의 `next`에 연결된 1~3개**만 선택 가능하다. 그 외 모든 노드는 선택 불가여야 한다(모든 노드 동시 선택 금지). | 확정 |
| R-MAP-03 | 도달 불가 노드는 UI에서 비활성이며, reducer 차원에서도 `OPEN_NODE`가 거부된다(이중 방어). | 파생 |
| R-MAP-04 | 보스 노드는 `next`가 보스를 가리키는 노드(현 생성기에서 4번째 열)를 완료한 뒤에만 진입 가능하다. | 파생 |
| R-MAP-05 | 비전투 노드(상점·사건·도장·사당)도 완료 개념을 가지며, 완료 후 그 노드의 `next`가 열린다. 전투/정예 노드는 **승리 시에만** 완료된다(패배·기권은 런 종료, 이탈은 미완료 유지). | 파생 |
| R-MAP-06 | 보상 화면에서 지도로 복귀해도 진행 상태가 보존된다(완료한 전투 노드의 `next`만 열림). 1막 보스 승리 → 2막 지도 생성 시 진행 상태는 초기화되어 2막 첫 열만 열린다. `RESTART`도 초기화한다. | 파생 |
| R-MAP-07 | MapScreen의 "여정 시설" 무제한 상점/사건/도장 버튼은 노드 진행을 우회하므로 제거한다. 시설 진입은 오직 도달 가능한 지도 노드를 통해서만 한다. | 파생 |

### R-TAP 착수 확정 (HDD-004)

| ID | 요구사항 | 상태 |
|---|---|---|
| R-TAP-01 | 카드 선택 후 **합법 교차점을 한 번 누르면 착수가 즉시 확정**된다. 같은 좌표 재확인(2탭 미리보기→확정)을 요구하지 않는다. | 확정 |
| R-TAP-02 | 불법 좌표(점유·자충수·단순패) 또는 효과 안전 한도 초과 탭은 착수 없이 사유를 표시한다(기존 `invalidReason` 동작 유지). | 파생 |
| R-TAP-03 | 미리보기 상태(`GameState.preview`, `MovePreview`, BoardSvg `previewPoint`, "합법 수 미리보기…" 문구)는 확정 전 단계가 사라지므로 함께 제거한다(죽은 코드 금지, AGENTS §10). | 파생 |

### R-PRE Pre-move 흐름 (HDD-005)

| ID | 요구사항 | 상태 |
|---|---|---|
| R-PRE-01 | 현재 턴 플레이어가 사용할 부적·유물이 **하나도 없으면 pre-move 단계를 자동으로 건너뛰고** 즉시 카드 선택 단계로 진입한다. | 확정 |
| R-PRE-02 | 사용할 효과가 있는 턴에도 착수 흐름을 과도하게 막지 않는다: pre-move 상태에서 곧바로 카드를 선택하면 별도 "진행" 확인 없이 착수 단계로 넘어갈 수 있어야 한다. | 확정 |
| R-PRE-03 | pre-move 진입 시에도 합법 수 부재 자동 패스(`hasLegalCardMove`) 등 기존 안전 규칙은 유지된다. | 파생 |

### R-CARD 카드 명시성 (HDD-006)

| ID | 요구사항 | 상태 |
|---|---|---|
| R-CARD-01 | 모든 돌 카드는 한국어 사용자 문구로 **이름·짧은 효과 요약·발동 조건·전략적 용도**를 제공한다. 문구는 승인 문서 `docs/03_content/01_특수돌.md`의 MVP 효과 서술과 일치해야 하며 실제 구현 동작을 과장 없이 기술한다. | 확정 |
| R-CARD-02 | 내부 trigger enum(`after-placement`, `capture-success`, `card-entered-hand`, `adjacent-endangered-group`, `captured-by-opponent-placement`) 및 `STONE-00n` 원시 ID는 어떤 사용자 화면에도 렌더되지 않는다. | 확정 |
| R-CARD-03 | 병종별로 즉시 구별 가능한 색·문양(아이콘)을 가진다. 6개 병종의 색·문양·클래스 식별자는 서로 달라야 한다. (구체 색상값·문양은 시각 디자인으로 인간 최종 판단 대상 — 자동 검증은 "구별되는 식별자 존재"까지만.) | 확정(구별 의무) / 구체 값은 AI 제안 |
| R-CARD-04 | 효과 발동 시 어떤 병종의 무슨 효과가 발동했는지 사용자에게 명시적으로 표시된다(눈에 띄는 발동 표시, `role="status"`). | 확정 |
| R-CARD-05 | 보상/상점 화면의 부적·유물도 원시 ID 대신 정의된 이름(`CHARM_DEFINITIONS`/`RELIC_DEFINITIONS`)으로 표시한다. | 파생(R-CARD-02의 일관 적용) |

### R-STRAT 전략적 덱 플레이 (HDD-007)

| ID | 요구사항 | 상태 |
|---|---|---|
| R-STRAT-01 | 6개 병종의 승인된 정체성을 **보존**한다: 척후석=착수 후 덱 위 2장 확인·재정렬, 장군석=포획 착수 시 +5냥(대국당 상한), 기병석=직전 내 착수 포획 시 패 진입 때 덱 위 1장 확인, 수호석=활로 2 이하 아군 그룹 인접 착수 시 덱 위 2장 확인, 희생석=상대 착수로 포획되면 다음 내 턴 패 한도 +1, 일반석=무효과. 효과 정체성 변경·신규 병종 추가는 범위 밖이다. | 확정 |
| R-STRAT-02 | 각 효과는 판세·손패·덱 순환·자원(냥)에 **관찰 가능한 실제 차이**를 만들어야 하며, 그 차이가 결정론적 테스트로 검증된다(§: 04 AC 참조). 숨은 밸런스 기본값 추가 금지 — 새 수치는 전부 `GameConfig` 주입. | 확정 |
| R-STRAT-03 | AI도 특수 돌 효과를 평가에 반영해, 효과를 이해한 플레이가 상대에게도 관찰되도록 한다. 반영 가중치는 주입 설정(`aiEffectWeight`)이며 제품 확정값은 인간 밸런스 판단으로 남긴다. | 확정(방향) / 평가식 구성은 AI 제안 |

### R-AUD 음악 (HDD-001)

| ID | 요구사항 | 상태 |
|---|---|---|
| R-AUD-01 | 사용자의 첫 게임 시작 gesture(등반 시작 또는 오디오 컨트롤) 후, 현재 화면 경로의 BGM이 **실제로 재생**되어야 한다: WebAudio 경로에서 `AudioBufferSourceNode.start` 호출이 실제 발생하거나, 실패 시 fallback `HTMLAudioElement.play()`가 호출되어야 한다. | 확정 |
| R-AUD-02 | `unlock()`은 `context.resume()`의 settle 여부에 **버퍼 로드를 종속시키지 않는다**. resume이 지연·미해결이어도 fetch→decode→start 스케줄이 진행된다(재현된 근본 원인의 직접 수정). | 파생 |
| R-AUD-03 | 로드·디코드·재생 실패를 조용히 삼키지 않는다: 실패는 onError로 전달되고, 스냅샷에 재생 상태가 노출되며, WebAudio 경로 실패 시 fallback을 자동 시도한다. | 확정 |
| R-AUD-04 | UI(AudioControls)는 복구 가능한 상태를 표시한다: 실패 시 재시도 수단(다시 unlock/resume)을 제공한다. | 확정 |
| R-AUD-05 | 기존 승인 사항 유지: 경로→트랙 매핑(HDD-007/이전 프롬프트), gesture 전 context 미생성, AudioTuning 주입 필수(제품 기본값 금지, HDD-013 pending). | 확정 |

## 4. AI 구현 제안 (인간 결정 아님 — 채택·변경·기각 대상)

| ID | 제안 | 관련 REQ |
|---|---|---|
| P-01 | 진행 상태 모델: `GameState.completedNodeIds: readonly string[]`(막 내 완료 순서 누적) 단일 필드 + 순수 함수 `selectableNodeIds(map, completedNodeIds)`(비어 있으면 `map.starts`, 아니면 마지막 완료 노드의 `next`)를 `src/game/map.ts`에 추가. | R-MAP |
| P-02 | 비전투 노드의 완료 시점 = `OPEN_NODE` 진입 시(실패 상태가 없으므로). 전투 노드는 `completeRunBattle`의 승리 분기에서 `selectedNodeId`를 완료 처리. | R-MAP-05 |
| P-03 | 전투 중 "지도로 물러나기"는 현행 유지(노드 미완료, 재진입 시 `sequence` 기반으로 새 대국 생성). 재진입 재추첨의 악용 가능성은 인간 밸런스 검토 항목으로 보고(§6). | R-MAP-05 |
| P-04 | 점유 판정 순수 함수 `stoneMajorityWinner(board): StoneColor | null`을 `battle.ts`에 추가하고 `PLAY_CARD` 성공 분기와 `performRevivalSpecialMove` 착수 분기에서 호출, 도달 시 `resolveBattleOutcome`로 위임. 종료 로그 메시지 예: `'점유 우세로 대국을 즉시 종료합니다.'` | R-END |
| P-05 | pre-move 구현: `BEGIN_TURN`에서 `charms[turn].length===0 && relics[turn].length===0`이면 `choose-card`로 직행. `SELECT_CARD`를 `pre-move`에서도 합법화(선택 즉시 `choose-point` 전이). `CONTINUE_TO_MOVE`는 명시적 건너뛰기 버튼용으로 유지(pre-move에서만 렌더). | R-PRE |
| P-06 | `StoneDefinition`에 `ui: { summary, condition, strategy, classKey, icon }` 추가. classKey: `basic/scout/general/cavalry/guardian/sacrifice`, 문양 초안: 基/斥/將/騎/守/犧, 병종색은 CSS 변수로 부여. 색상 hex·문양 최종안은 인간 시각 검토 대상. | R-CARD |
| P-07 | 선택된 카드의 발동 조건·전략을 손패 위 상세 패널로 표시, 최신 효과 발동은 `role="status"` 배너로 강조. | R-CARD-01/04 |
| P-08 | AI 평가식: `captured×aiCaptureWeight + (효과 발동 예측 ? aiEffectWeight : 0)`. 발동 예측은 순수 함수(척후=항상, 장군=포획 시, 수호=위험 아군 인접 시; 기병·희생은 착수 시점 예측 불가로 제외). `aiEffectWeight`는 `GameConfig` 신규 필수 필드(모든 config 생성처 일괄 갱신). | R-STRAT-03 |
| P-09 | 오디오 상태 모델: `AudioSnapshot`에 `playback: 'idle'|'pending'|'web-audio'|'fallback'|'error'`와 `lastError: string | null` 추가. `switchWebAudio` 실패 시 `switchFallback` 자동 시도. `AudioManagerOptions.onStatusChange` 콜백으로 훅 리렌더. | R-AUD |
| P-10 | 판정 UI 표기: battle-stats에 `점유 흑 n · 백 m / 기준 t` 표시. | R-END-06 |

## 5. 범위 밖 (이번 프롬프트에서 하지 않음)

- 신규 병종·부적·유물 콘텐츠 추가, 병종 강화 시스템, 덤 확정(HDD-008), 부활·경제 제품 수치 확정(HDD-009/010), 음악 청음값 확정(HDD-013).
- 새 런타임 의존성 추가(금지), 지도 생성기 구조 변경(열 2레인×5+보스 구조 유지 — `next`는 이미 올바르게 생성됨), 세이브/복원.
- 시각적 재미·색상 최종 판단은 자동 검증 대상이 아니다(AGENTS §10) — 인간 플레이테스트 항목으로 남긴다.

## 6. 인간에게 남는 판단·위험 보고

1. **전투 이탈 재진입**(P-03): 노드 미완료 유지 정책상 같은 노드 전투를 다시 생성하며 셔플이 달라질 수 있다. 악용 여지의 허용 여부는 인간 밸런스 판단.
2. **병종 색·문양 최종안**(P-06): 구별성 자동 검증까지만 가능. 미적 승인 필요.
3. **`aiEffectWeight` 제품값**(P-08): fixture 값은 테스트 전용. 제품 주입값은 밸런스 판단.
4. **비전투 노드 완료 시점**(P-02): "진입 즉시 완료"는 구현 해석. 다른 해석(이탈 시 완료)을 원하면 지시 필요 — 어느 쪽이든 HDD-002는 충족되므로 blocking 아님.
5. 점유 과반 조기 종료로 인해 **면적 계가 화면(점수 분해)** 이 조기 종료 대국에서는 참고 정보가 된다(승패는 점유로 이미 확정) — 결과 화면 서술을 조정할지는 인간 UX 판단.

## 7. 교차 영향 (회귀 범위)

- `BattlePhase` 흐름 변화(R-PRE)·preview 제거(R-TAP)는 다음을 반드시 갱신: `tests/ui.battle.test.tsx`, `tests/ui.game.test.tsx`, `tests/ui.progression.test.tsx`, `tests/battle.flow.test.ts`, `tests/battle.product-effects.test.ts`, `tests/battle.revival.test.ts`, `tests/effects.queue.test.ts`, `tests/sim.random.test.ts`, `tests/balance.harness.test.ts`, `scripts/balance.ts`, `scripts/simulate.ts`, `scripts/playwright-mobile-check.mjs`.
- `GameConfig.aiEffectWeight` 추가는 config를 생성하는 모든 지점(테스트 fixture, `scripts/playwright-mobile-check.mjs`의 주입 config, 벤치마크/시뮬 스크립트)의 일괄 갱신을 요구한다 — 누락 시 `assertConfig`/typecheck 실패.
- 지도 reachability는 `scripts/playwright-mobile-check.mjs`의 "보스전 바로 클릭" 흐름을 깨뜨린다 — 스크립트는 시드 고정 경로를 따라 실제 진행하도록 재작성해야 한다(required 게이트 `mobile_check` 유지 의무).
