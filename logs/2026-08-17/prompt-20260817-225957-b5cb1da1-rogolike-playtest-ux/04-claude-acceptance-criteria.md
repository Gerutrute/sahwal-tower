# 04 — Claude 수락 기준 (RoGolike 플레이테스트 UX 개선)

- 작성자: Claude Code planner (Orca dispatch, 읽기 전용)
- 검증 주체: 구현과 다른 세션의 fresh Claude verifier. 모든 AC는 **명령 실행 결과(exit code·테스트명) 또는 소스 검사**로 기계 검증 가능해야 하며, verifier는 아래 명령을 직접 재실행한다.
- 공통 전제: 검증 전후 source tree 동일, dev 브랜치, commit/push 없음.

## A. 검증 명령 (정확한 argv)

| 키 | 명령 | 성공 기준 |
|---|---|---|
| CMD-F | `npm.cmd test` | exit 0, 실패 0 |
| CMD-T | `npm.cmd run typecheck` | exit 0 |
| CMD-B | `npm.cmd run build` | exit 0 |
| CMD-AI | `npm.cmd run benchmark:ai` | exit 0 |
| CMD-AU | `npm.cmd audit --omit=dev --audit-level=high` | exit 0 |
| CMD-M | `npm.cmd run check:mobile` | exit 0 |
| CMD-x(파일) | `npm.cmd test -- --run <파일>` | exit 0, 해당 파일 실패 0 |

RED 증적: 각 신규 테스트 파일에 대해 구현 전 실행 로그(exit ≠ 0)가 `codex/` 수하에 capture-command로 보존되어야 한다(AC-P4).

## B. 기능 수락 기준

### 대국 종료 — 점유 과반 (HDD-003 / R-END)

| ID | 기준 | 검증 |
|---|---|---|
| AC-01 | `stoneMajorityWinner`(또는 동등 순수 함수)가 돌 점유 수만으로 판정한다: 7×7 흑 24→null·25→'B'·백 25→'W', 9×9 41 기준. 영역·덤·포획 수 미사용. | CMD-x(`tests/battle.majority.test.ts`) + 함수 소스 검사(scoreArea 미호출) |
| AC-02 | 빈 판 첫 착수는 대국을 종료시키지 않는다(영역 계가 배제 보증). | 동 파일 테스트 |
| AC-03 | 완결된 착수(플레이어·AI `PLAY_CARD`, 부활 전용 착수) 직후에만 판정하며, 포획 제거가 반영된 판면 기준이다. 패스·dry-run은 판정 계기가 아니다. | 동 파일 테스트(착수/패스/포획 케이스) |
| AC-04 | 흑 기준 도달 → 즉시 승리 경로(`resolveBattleOutcome`): 부활 없는 적은 `outcome==='stage-win'`·`rewardStatus==='available'`, 1막 1단계 부활 적은 `phase==='revival-special-move'`·`revivalStage===2`·`rewardStatus==='withheld'`. 백 도달 → `outcome==='run-loss'`. | 동 파일 테스트 |
| AC-05 | 즉시 종료 시 종료 사유가 battle.log에 명시 항목으로 남고, 전투 화면에 흑/백 점유 수와 기준치가 상시 표시된다. | 동 파일 + CMD-x(`tests/ui.battle.test.tsx`) |
| AC-06 | 연속 패스 2회 → 면적 계가, 기권 경로는 기존과 동일하게 동작한다(회귀). | CMD-x(`tests/battle.flow.test.ts tests/go.scoring.test.ts`) |

### 지도 진행 (HDD-002 / R-MAP)

| ID | 기준 | 검증 |
|---|---|---|
| AC-07 | 막 시작 시 선택 가능 노드 = `map.starts`뿐이다. | CMD-x(`tests/map.progression.test.ts`) |
| AC-08 | 노드 완료 후 선택 가능 노드 = 그 노드의 `next`(1~3개)뿐이다. 보스는 `next`가 보스인 노드 완료 후에만 열린다. | 동 파일 테스트 |
| AC-09 | 잠긴 노드에 대한 `OPEN_NODE`는 reducer에서 무효(화면·전투 상태 불변)이고, UI에서도 해당 버튼이 `disabled`다. | 동 파일 + CMD-x(`tests/ui.map.progression.test.tsx`) |
| AC-10 | 전투/정예 노드는 승리 시에만 완료 처리된다. 비전투 노드(상점·사건·도장·사당)는 방문으로 완료되어 `next`가 열린다. | CMD-x(`tests/map.progression.test.ts`) |
| AC-11 | 보상 수령/거절 후 지도 복귀 시 진행 상태가 보존된다. 1막 보스 승리 → 2막 지도에서 진행 초기화(첫 열만 열림). `RESTART`도 초기화. | 동 파일 테스트 |
| AC-12 | MapScreen에서 노드와 무관한 무제한 상점/사건/도장 진입 수단("여정 시설")이 제거되었다. | CMD-x(`tests/ui.map.progression.test.tsx`) + `src/App.tsx` 검사 |

### 착수 흐름 (HDD-004/005 / R-TAP·R-PRE)

| ID | 기준 | 검증 |
|---|---|---|
| AC-13 | 카드 선택 후 합법 교차점 **1회 클릭**으로 착수가 확정된다(돌 배치·카드 소비·턴 진행). 같은 좌표 재확인 단계가 존재하지 않는다. | CMD-x(`tests/ui.onetap.test.tsx`) |
| AC-14 | 불법 좌표·효과 한도 초과 클릭은 착수 없이 사유 문구만 표시하고, 이후 합법 클릭은 정상 확정된다. | 동 파일 테스트 |
| AC-15 | `GameState.preview`·`MovePreview`·BoardSvg `previewPoint`·미리보기 문구가 소스에서 제거되었다(죽은 코드 금지). | `git diff` 검사 + CMD-T |
| AC-16 | 부적·유물이 없는 턴은 `BEGIN_TURN` 직후 `choose-card`다(pre-move 미진입). 시작 덱 런의 전투 화면에 "착수로 진행" 버튼이 나타나지 않는다. | CMD-x(`tests/battle.premove.test.ts`) + CMD-x(`tests/ui.battle.test.tsx`) |
| AC-17 | 부적·유물 보유 턴은 pre-move에 진입하되, pre-move에서 `SELECT_CARD`가 즉시 착수 단계로 전이한다(별도 진행 확인 불요). 부적/유물 사용 동작은 기존과 동일. | CMD-x(`tests/battle.premove.test.ts`) |
| AC-18 | 합법 수 없음 자동 패스 등 `BEGIN_TURN` 안전 규칙이 유지된다. | 동 파일 + CMD-x(`tests/battle.flow.test.ts`) |

### 카드 명시성 (HDD-006 / R-CARD)

| ID | 기준 | 검증 |
|---|---|---|
| AC-19 | 6개 병종 전부 한국어 `summary`(효과 요약)·`condition`(발동 조건)·`strategy`(전략 용도)를 가지며 비어 있지 않다. 문구 수치는 승인 문서와 일치(척후 2장·장군 5냥·기병 1장·수호 활로 2·희생 패 한도 +1). | CMD-x(`tests/stones.presentation.test.ts`) |
| AC-20 | 렌더된 전투 화면 어디에도 내부 trigger enum 문자열(`after-placement`, `capture-success`, `card-entered-hand`, `adjacent-endangered-group`, `captured-by-opponent-placement`)과 `STONE-00n` 원시 ID가 나타나지 않는다. | CMD-x(`tests/ui.card-clarity.test.tsx`) |
| AC-21 | 각 카드에 병종별로 서로 다른 클래스 식별자(`data-stone-class` 6종)와 문양 요소가 렌더된다. 카드 선택 시 조건·전략이 표시된다. | 동 파일 테스트 |
| AC-22 | 효과 발동 시 병종명이 포함된 명시적 발동 표시(`role="status"`)가 나타난다(예: 척후석 착수 → 배너에 `척후석`). | 동 파일 테스트 |
| AC-23 | 보상/상점 화면의 부적·유물이 원시 ID 대신 정의된 이름으로 표시된다. | 동 파일 테스트 |

### 전략적 덱 플레이 (HDD-007 / R-STRAT)

| ID | 기준 | 검증 |
|---|---|---|
| AC-24 | 병종 정체성 보존: 척후(덱 위 2장 확인·재정렬)·장군(포획 시 냥, 상한)·기병(조건부 1장 확인)·수호(위험 그룹 인접 시 2장 확인)·희생(피포획 시 다음 턴 패 한도 +1)의 기존 엔진 테스트가 모두 통과한다. | CMD-x(`tests/stones.test.ts tests/battle.product-effects.test.ts tests/effects.queue.test.ts`) |
| AC-25 | AI 평가에 효과 발동 예측 항이 추가되었고 `aiEffectWeight > 0`에서 효과 후보를 선호하며, `aiEffectWeight = 0`이면 기존 선택과 동일하다(결정론). | CMD-x(`tests/ai.effects.test.ts`) |
| AC-26 | `aiEffectWeight`는 `GameConfig` 주입 필수 필드다: `assertConfig`가 검증하고, 소스에 제품 기본값(fallback 수치)이 없다. | CMD-T + `src/game/GameProvider.tsx` 검사 |

### 음악 (HDD-001 / R-AUD)

| ID | 기준 | 검증 |
|---|---|---|
| AC-27 | `resume()` promise가 settle되지 않아도 `unlock()` 후 현재 트랙의 fetch·decode·`source.start`가 진행된다. | CMD-x(`tests/audio.manager.test.ts`) — start 카운터 테스트 |
| AC-28 | 첫 gesture 후 실제 재생 신호가 발생한다: WebAudio `source.start` ≥ 1 또는 fallback `audio.play()` 호출. WebAudio 로드 실패 시 fallback을 자동 시도한다. | 동 파일 테스트 |
| AC-29 | 실패가 invisible하지 않다: `onError` 전달 + `snapshot().playback` 상태(`web-audio`/`fallback`/`error` 구분) + `lastError` 노출. | 동 파일 테스트 |
| AC-30 | `playback==='error'`에서 AudioControls가 재시도 수단을 렌더하고, 재시도가 재로드를 유발한다. 기존 트랙 라벨·음소거·gesture 전 context 미생성·AudioTuning 주입 강제는 유지. | CMD-x(`tests/ui.audio-status.test.tsx tests/audio.manager.test.ts tests/audio.routing.test.tsx`) |

## C. 프로세스·불변 조건

| ID | 기준 | 검증 |
|---|---|---|
| AC-P1 | CMD-F/T/B/AI/AU/M 전부 exit 0이며 receipt argv가 `evidence.config.json`과 일치한다. | verifier 직접 재실행 |
| AC-P2 | `package.json` dependencies/devDependencies 변경 없음(신규 의존성 금지). | `git diff package.json` |
| AC-P3 | 새 수치는 전부 주입 경로(GameConfig/fixture)로만 존재하고, 제품 코드에 미승인 밸런스 기본값이 추가되지 않았다(기준식 `ceil(points/2)`는 승인된 규칙 상수식으로 예외). | diff 검사 |
| AC-P4 | 신규 테스트 파일 각각에 대해 RED(구현 전 실패) 실행 로그가 증적에 있다: `battle.majority`, `battle.premove`, `ui.onetap`, `map.progression`, `ui.map.progression`, `stones.presentation`, `ui.card-clarity`, `ai.effects`, `audio`(추가분), `ui.audio-status`. | `codex/` capture 로그 검사 |
| AC-P5 | 제품 표시명 `RoGolike` 불변, 소스 작성 주체는 Codex, Claude 검증 전후 tree 동일, `logs/` 외 임시 파일 잔존 없음. | manifest·diff·`git status` |
| AC-P6 | 모바일 게이트가 새 규칙을 실제로 검증한다: 잠긴 노드 클릭 무효 확인 1회 + 경로 완주로 보스 도달 + 1탭 착수 + "착수로 진행" 미사용. | `scripts/playwright-mobile-check.mjs` 소스 검사 + CMD-M |

## D. HDD ↔ AC 매핑

| HDD | AC |
|---|---|
| HDD-001 음악 | AC-27~30 |
| HDD-002 지도 | AC-07~12 |
| HDD-003 종료 | AC-01~06 |
| HDD-004 1탭 | AC-13~15 |
| HDD-005 pre-move | AC-16~18 |
| HDD-006 카드 명시성 | AC-19~23 |
| HDD-007 전략 플레이 | AC-24~26 |

## E. 자동 검증 불가 — 인간 판단 항목 (완료 보고에 명시)

1. 병종 색·문양의 미적 적합성(AC-21은 구별성까지만 보증).
2. `aiEffectWeight` 제품 주입값의 밸런스.
3. 점유 과반 종료가 만드는 실제 대국 템포(루즈함 해소 체감).
4. 전투 이탈 재진입 허용의 악용 위험(P-03).
5. 실기기 음악 청음(HDD-013 pending) — 테스트는 재생 신호까지만 보증.
