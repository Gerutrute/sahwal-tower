# 11 — 최종 요약: 그래프 지도 · 보상 상세 · 특수돌 효과 개편

## 결과

- 최종 판정: **PASS**
- 독립 재검증: Blocking 0 / Major 0 / Minor 0
- 최종 source tree: `7f3f17fed42a8a8ff758a11bfaf43629bdcebb62`
- Git HEAD / origin/dev: `8df1159983b0642cf5d144761f518188a64bcc15` / 동일
- 이번 작업에서 commit·push·reset·rebase·stash·clean을 수행하지 않았다.

## 사용자 요청 반영

### 지도

- 기존 선택 상태 계산을 유지하면서 실제 `next`를 따라 연결선 18개를 그리는 세로형 그래프를 적용했다.
- 아래에서 위로 진행하며 완료(`done`), 현재(`current`), 선택 가능(`open`), 잠김(`locked`) 상태를 구별한다.
- 활성 노드는 현재 위치에서 연결된 다음 1~3개뿐이며 잠긴 노드와 보스는 진행 조건 전까지 선택할 수 없다.
- 356×576 viewBox, 행 중심 최소 96px, 올바른 `aspect-ratio: 356 / 576`으로 수정해 380px 실제 브라우저에서 노드 겹침 0건과 가로 스크롤 0건을 확인했다.

### 보상 상세

- 돌·부적·유물 보상에 이름, 효과, 발동 조건, 실제 수치/횟수, 전략, 추천 연계, 보유 수량을 한국어로 표시한다.
- 데스크톱 hover, 키보드 focus, 모바일 첫 tap으로 같은 상세를 연다.
- 모바일 첫 tap은 선택을 확정하지 않으며, 펼쳐진 `이 보상을 선택` 버튼만 실제 보상 선택을 수행한다.
- 원시 `STONE-00x` ID와 내부 trigger 이름을 사용자에게 노출하지 않는다.

### 시작 덱과 특수석

- 시작 덱은 일반석 5장과 척후석·장군석·기병석·수호석·희생석 각 1장, 총 10장으로 변경했다.
- 척후석: 덱 위 최대 3장 중 1장을 손패로 가져오고 손패 1장을 돌려보낸 뒤 나머지 순서를 정한다.
- 장군석: 실제 포획 시 기존 5냥 보상과 카드 1장 추가 드로우를 적용한다. `maxHandSize`는 절대 상한이고, 기본 `handLimit` 초과분은 다음 자기 착수 뒤 자연 수렴한다.
- 기병석: 직전 자기 착수가 실제 포획이고 기병석이 새로 손패에 들어온 경우 덱 위 최대 2장 중 1장을 가져오고 손패 1장을 버린다. 사용한 비임시 기병석은 덱 맨 아래로 돌아간다.
- 수호석: 활로 2 이하 아군 그룹 옆에 놓으면 보호 토큰을 부여한다. 해당 그룹 포획 시 착수 전체를 한 번 무효화하고 토큰을 소모하며, 상대의 다음 정상 착수 후 미사용 토큰은 만료된다.
- 희생석: 상대에게 포획되면 기존 다음 자기 턴 패 한도 +1과 함께 즉시 카드 1장을 드로우한다. 상대 손패 감소는 추가하지 않았다.
- 각 효과는 reducer, 전투 로그, UI 설명, 테스트, AI 평가에서 동일한 조건과 의미를 사용한다.

### AI

- `aiEffectWeights`를 6개 병종 키로 주입받으며 척후·장군·수호 등 실제 발동 가능한 특수 효과를 후보 점수에 반영한다.
- 수호로 무효화되는 포획은 유효 포획 0으로 평가해 장군 보상이나 포획 점수가 새지 않게 했다.

## 발견·수정한 추가 결함

첫 fresh Claude 검증에서 대기열의 두 번째 척후/기병 교환 창이 첫 교환 뒤 갱신되지 않아 확정이 영구 실패하는 Major 결함을 재현했다.

수정:

- 대기 상호작용이 head로 승격될 때 현재 덱 기준으로 확인 창을 다시 계산한다.
- staged 선택값을 초기화한다.
- 확인 창이 0장이면 FIFO 순서대로 건너뛴다.
- 연쇄가 끝날 때 턴을 정확히 한 번 종료한다.
- 확정과 취소가 같은 승격 경로를 사용한다.

추가로 부활 전용 상대 턴의 임시 패 한도 만료 누락과 380px 지도 노드 부제 겹침을 수정했다.

## 검증

두 번째 fresh Claude가 수정 후 tree를 독립적으로 재검증했다.

- `npm.cmd test`: exit 0, **42 files / 221 tests passed**
- `npm.cmd run typecheck`: exit 0
- `npm.cmd run build`: exit 0
- `npm.cmd run benchmark:ai`: exit 0
  - 7×7 p95 1.6ms ≤ 100ms
  - 9×9 p95 2.4ms ≤ 200ms
  - 후보 수 일치
- `npm.cmd audit --omit=dev --audit-level=high`: exit 0, 취약점 0
- `npm.cmd run check:mobile`: exit 0, `passed: true`
- AC mapping: 27/27
- Python evidence tests: 23 tests OK
- 검증자 독자 DEF-1 재현: 23/23 assert 통과
- 380×844 Chromium 독자 확인:
  - 초기/진행 지도 노드 겹침 0
  - html/body scrollWidth 380
  - 연결선 18개
  - 진행 후 current 노드 정확히 1개
  - 보상 첫 tap은 상세만 열고 명시 버튼에서만 확정
- 검증 전후 source tree hash 동일

상세 보고서:

- `08-claude-verification-report.md`: 최초 FAIL 및 Major 발견
- `09-claude-defect-report.md`: 결함 재현과 수정 요구
- `10-codex-fix-log.md`: strict TDD 수정 증적
- `11-claude-reverification-report.md`: 최종 PASS, Blocking 0 / Major 0 / Minor 0

## 인간 확인이 남은 항목

다음은 결함이 아니라 아직 승인되지 않은 밸런스·문구 판단 항목이다.

- 장군석 추가 드로우를 `handLimit` 일시 초과 + `maxHandSize` 절대 상한으로 해석한 현재 정책
- `aiEffectWeights` 초안 수치의 최종 밸런스
- 카드 상세 한국어 문구와 지도 간격의 체감 품질

위 값은 로컬 플레이테스트 구성으로만 취급하며 승인된 제품 기본값으로 선언하지 않는다.
