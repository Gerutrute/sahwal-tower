# 09 — Claude 결함 보고서 (그래프 지도 · 보상 상세 · 특수돌 효과 개편)

- 작성자: fresh Claude Code verifier (Orca task `task_5b9eb74ae6e1` / dispatch `ctx_1e1f6dc4d153`)
- 대상 tree: `d42a4535229f7cc990b9888749556cad4b3c095f` (verify-before)
- 수신자: Hermes/Codex — 결함 수정은 Codex만 수행한다. 검증자는 소스를 수정하지 않았다.

## DEF-1 (Major) — 대기열 두 번째 상호작용의 `inspected` 창 미갱신으로 확정 영구 실패

### 요약

`PendingInteraction`의 `inspected` 창이 **생성 시점(착수 직후)에 고정**되고, 대기열에서 head로 승격될 때 재계산되지 않는다. 첫 상호작용의 확정이 덱을 바꾸면(척후 교환·기병 교환) 두 번째 상호작용의 창은 실제 `drawPile` 상단과 어긋나고, `resolveScoutExchange`/`resolveCavalryExchange`의 `assertExactPrefix`가 **항상 RangeError**를 던져 확정이 영구히 실패한다. 사용자는 "확인한 카드가 현재 덱과 손패에 없습니다."만 보게 되며 **취소 외의 출구가 없어 부여된 효과를 사용할 수 없다**. UI 패널도 이미 손패/버림으로 이동한 카드를 "가져올 카드"로 표시한다.

- 위반: HDD-007 / R-CAV-04("확인 창 = drawPile.slice(0, min(2, ...))" — 교환 시점의 실제 덱), AC-CAV-005의 "대기열 FIFO 순차 처리" 취지
- 상태 손상/크래시: 없음(원자성은 유지 — CONFIRM 실패 시 덱 불변, CANCEL로 복구 가능)
- 참고: 03 §1.6이 `inspected`를 생성 시점에 담도록 기술했고 head 승격 시 재계산을 명시하지 않았으므로 **계획 단계의 설계 공백**이 근인이다. Codex는 계획을 충실히 따랐으나 제품 결함은 실재한다.

### 위치

- `src/game/GameProvider.tsx` — `inspectionsAfterMove()`(창을 생성 시점 deck으로 고정), `performAiTurn()`의 cavalryInspections 생성부(동일), `finishInspection()`(`const [nextInspection, ...remaining] = state.queuedInspections;` — 재계산 없이 그대로 head 승격)
- 검증 함수 자체는 정상: `src/game/content/stones.ts`의 `assertExactPrefix`가 의도대로 어긋남을 원자적으로 거부

### 재현 1 — 기병 2장 동시 진입 (테스트와 동일 시나리오의 다음 단계)

`tests/battle.product-effects.test.ts`의 FIFO 테스트 설정(장군석 포획, drawPile `[기병,기병,장군,수호]`)에서 테스트가 멈춘 지점(첫 확정) **이후**를 실행:

```
pending kind: cavalry | queued: 1
active window: [ 'draw-3', 'draw-4' ]      ← 두 상호작용 모두 같은 창
queued window: [ 'draw-3', 'draw-4' ]
첫 번째 교환 확정(take draw-3) 후:
second window (stale): [ 'draw-3', 'draw-4' ]
drawPile now         : [ 'draw-4' ]        ← 실제 상단과 불일치
두 번째 확정(take draw-4, 실제 덱 상단 카드) 시도:
pending still open: true | invalidReason: "확인한 카드가 현재 덱과 손패에 없습니다."
deck unchanged: true                        ← 어떤 입력으로도 확정 불가
```

도달성: 기병석 2장은 도장 복제·보상으로 실플레이에서 확보 가능.

### 재현 2 — 시작 덱만으로 도달: 척후 착수 → 보충 드로우로 기병 진입

척후석을 포획 착수로 사용, 보충 드로우가 기병석을 손패에 넣는 경우(시작 덱 구성으로 발생 가능):

```
pending: scout | queued: [ 'cavalry' ]
scout window  : [ 'draw-2', 'draw-3', 'draw-4' ]
cavalry window: [ 'draw-2', 'draw-3' ]
척후 교환 확정(take draw-2, return hand-1) 후:
cavalry stale window: [ 'draw-2', 'draw-3' ]   ← draw-2는 이미 손패에 있음
actual drawPile top : [ 'draw-3', 'draw-4' ]
cavalry confirm blocked: true | reason: "확인한 카드가 현재 덱과 손패에 없습니다."
```

두 재현 모두 `gameReducer` 공개 액션만 사용(검증자 스크래치 스크립트, 저장소 외부 — `repro-cavalry-fifo.ts`/`repro-scout-cavalry.ts`, vite-node로 실행, 소스 무수정).

### 기존 테스트가 놓친 이유

FIFO 테스트는 첫 확정 후 `pendingInspection`이 cavalry로 승격되고 큐가 비는 것까지만 assert하고, **두 번째 교환의 확정을 시도하지 않는다**.

### 수정 제안 (Codex 판단으로 조정 가능)

`finishInspection()`에서 head 승격 시(확정·취소 공통) 다음 상호작용의 창을 **그 시점의 `nextBattle.decks.B`로 재계산**한다:

1. scout: `startScoutInspection(deck)`, cavalry: `startCavalryInspection(deck, battle.previousCaptureBy.B)` 재호출로 `inspected`·`orderedIds` 재설정, `takenCardId` 등 스테이징 필드 초기화.
2. 재계산 결과 창이 0장이면 해당 상호작용을 건너뛰고(효과 미발동 규칙과 일관) 다음 대기 항목으로 진행, 큐가 비면 기존 `endsTurnOnResolve` 처리.
3. 회귀 테스트: 재현 1·2를 그대로 테스트로 옮겨 "두 번째 교환도 확정 가능"과 "창 0장 시 자동 스킵"을 assert. 기존 FIFO 테스트는 확정까지 연장.

수정 후 `npm test`·`typecheck`·`check:mobile` 전체 재실행과 **새 Claude 검증 dispatch** 재검증이 필요하다.

---

## DEF-2 (Minor) — AC 통과 조건 일부의 전용 테스트 부재 (코드로는 충족)

아래 조건들은 구현이 충족함을 검증자가 코드 검토로 확인했으나, 해당 AC가 지정한 테스트 파일에 전용 assert가 없다. 회귀 안전망 강화를 위해 추가 권장(우선순위 낮음):

| AC | 미커버 조건 |
|---|---|
| AC-GRD-003/004 | 만료 후 같은 그룹 포획 성공, 무효화 착수의 타 토큰 비만료, 보호+비보호 다중 그룹 혼재 전체 무효화, 부활 착수의 상대 착수 취급 |
| AC-GEN-002 | 초과분 자연 수렴(다음 착수 후 handLimit 복귀), W(적) 장군석 대칭 드로우 |
| AC-CAV-003/004 | 기병 교환 잘못된 입력 RangeError, 빈 drawPile 사용 기병 즉시 재드로우 |
| AC-SCT-002 | 잘못된 returnedId·불완전 순열 RangeError |
| AC-SCT-004 | 패널 열림 중 착수 불가(canAct) UI assert |
| AC-MAP-003 | 완료 다수 시 이전 노드 done 상태 |

## DEF-3 (Minor) — 부활 경로에서 W 덱 임시 패 한도 만료 미적용

`performRevivalSpecialMove`의 정상 착수·자동 패스 경로는 `expireTemporaryHandLimits`를 호출하지 않아, 부활 국면에서 W가 임시 패 한도를 보유한 극단 엣지에서 만료가 한 턴 지연될 수 있다. AC-SAC-001의 요구 범위(END_TURN·패스)는 충족되어 있음. 일관성 차원의 후속 정리 후보.

## DEF-4 (Minor·인간 판단) — 380px 지도 노드 부제 겹침

세로 500 viewBox에 6행을 배치하면서 노드 상자가 행 간 겹쳐 부제(적 이름 등)가 부분 가려진다(검증자 스크린샷 확인). 제목·상태 구별·연결선 판독은 가능하고 기계 AC는 전부 통과 — R-MAP-05의 "판독 가능" 최소선은 지키나 시각 완성도는 인간 판단 필요. 행 높이 확대 또는 부제 축약 검토 권장.

---

## 심각도 집계

| 심각도 | 건수 | 목록 |
|---|---|---|
| Blocking | 0 | — |
| Major | 1 | DEF-1 |
| Minor | 3 | DEF-2, DEF-3, DEF-4 |

DEF-1 해결(및 회귀 테스트 추가) 후 재검증을 요청한다.
