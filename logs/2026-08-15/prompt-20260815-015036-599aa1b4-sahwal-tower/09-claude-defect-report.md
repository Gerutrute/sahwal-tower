# 09 — Claude 결함 보고서 (「사활의 탑」) — Codex 수정 후 2차 재검증

- 작성자: fresh Claude verifier (read-only). 결함을 직접 고치지 않는다. 수정 주체는 Hermes/Codex다(AGENTS §2.1/§2.2).
- Orca task: `task_0a823409843f` / dispatch `ctx_27b2231ff358`
- 대상 tree: `cfa7d5750c073ef8e9dee933a13000a41d2e240c`
- 상세 근거: `08-claude-verification-report.md`

---

## 0. 판정

> **blocking 0 · high 0 · medium 0 — 재검증을 막는 결함 없음.**
>
> 1차 결함 **D-01 ~ D-11은 전부 해소**됐고, 검증자가 소스와 런타임에서 독립 재현해 확인했다.
> **D-12만 Hermes의 문서 기재 조건이 남은 이월 항목**이며, 그 밖에 **low 3건 + 운영/환경 3건의 권고**가 있다. 어느 것도 게이트가 아니다.

| 심각도 | 건수 | 항목 |
|---|---|---|
| blocking | 0 | — |
| high | 0 | — |
| medium | 0 | — |
| low (권고) | 3 | R-01, R-02, R-03 |
| 이월(문서 조건 미충족) | 1 | C-01 (구 D-12) |
| 운영·환경 관찰 | 3 | N-01, N-02, N-03 |

---

## 1. 1차 결함 종결 확인 (D-01 ~ D-12)

| ID | 1차 심각도 | 상태 | 재현 확인 |
|---|---|---|---|
| D-01 동결 층 데이터 변경 | blocking | **CLOSED** | 런타임 `FLOORS` 실측이 원문 §4와 완전 일치. `guardsW`가 2·3층 모두 `(1,2)(1,4)`, `pouchW` 20/24/30, rocks·왕 좌표 일치. 테스트 기대값도 동결값으로 복원 |
| D-02 AC 지정 테스트 파일 부재 | blocking | **CLOSED** | `tests/meta.deps.test.ts`·`tests/engine.purity.test.ts` 존재, AC 지정 이름 6개 그대로 |
| D-03 `-t` 매핑 38건 위장 통과 | blocking | **CLOSED** | `check-ac-mapping.mjs` 89/89. 검증자가 `04`를 독립 파싱해 추출 집합의 차집합이 0임을 확인 |
| D-04 3대 재현 경로 테스트 부재 | high | **CLOSED** | AC-701(시드 33 실제 3층 클리어)·702·703·705·706 존재·통과 |
| D-05 밸런스 hard gate·리포트 부재 | high | **CLOSED** | `throw` 제거, `in_range` 출력, `balance-report.md` 생성, 이탈에도 exit 0, `07`에 decision gate 문구 |
| D-06 폭발 승리가 패배로 덮임 | medium | **CLOSED** | 동시 성립 배치 재현 결과 `{"status":"win","reason":"king"}` |
| D-07 교차점 button 계약 | medium | **CLOSED** | `role="button"` + `tabIndex` + 한국어 `aria-label` + Enter/Space |
| D-08 타입 검사 범위 | medium | **CLOSED** | `include: ["src","tests","scripts","vite.config.ts"]`, exit 0 |
| D-09 골렘 두 번째 수 무료 | low | **CLOSED** | `pouchW=1`에서 1수만 두고 0으로 종료 |
| D-10 죽은 조건식 | low | **CLOSED** | 조건절 삭제, −120 적용/미적용 경계 실측 확인 |
| D-11 dev 서버 바인드 불일치 | low | **CLOSED** | `vite --host 127.0.0.1`, IPv4 HTTP 200 실측 |
| D-12 `dist-debug-old/` 잔여 | low | **CARRY-FORWARD → C-01** | 디렉터리 잔존. ignore·비참조는 재확인했으나 약속된 `11-final-summary.md` 기재가 미완 |

---

## C-01 — `dist-debug-old/` 잔존 사유가 최종 요약에 아직 기재되지 않았다

- **심각도: 이월(low). 제품 영향 없음.**
- **근거:** `10-codex-fix-log.md:17`("`.gitignore` 처리했고 제품·빌드에서 사용되지 않음을 최종 요약에 남긴다"), 1차 D-12 최소 수정 지침, AGENTS §10

**검증자 재확인**

- 저장소 루트에 `dist-debug-old/`(`assets/`, `index.html`)가 존재한다.
- `.gitignore`에 등재돼 있어 `snapshot_tree`가 산출하는 source tree hash에서 제외된다 → **tree 불변성에는 영향 없음.**
- `src/**`, `scripts/**`, `vite.config.ts`, `index.html`에서 참조 0건 → **빌드·런타임 영향 없음.**
- **미충족 조건:** `11-final-summary.md`가 아직 존재하지 않아 잔존 사유가 어디에도 기재되지 않았다.

**요청(Hermes)** — 다음 중 하나를 수행한다.

1. 인간 승인 아래 `dist-debug-old/`를 수동 삭제하고 그 사실을 `11-final-summary.md`에 남긴다. **또는**
2. 남기기로 한다면 `11-final-summary.md`에 "`.gitignore` 대상이며 tree hash·제품·빌드에서 참조되지 않음 / 실행 안전 장치가 삭제를 차단함"을 명시한다.

---

## R-01 — `soul` 환급 테스트가 `n=1`만 고정한다 (홀수 올림 회귀 미방어)

- **심각도: low(권고).** 동작은 정상이다.
- **위반이 아님 — AC-304의 `-t` 매핑은 통과한다.** 다만 AC 본문이 요구한 확인 값과 테스트가 고정하는 값이 다르다.

**증거**

```
04-claude-acceptance-criteria.md:75   ... | exit 0. n=3 → +2 확인 |
tests/engine.economy.test.ts:148      it('soul 보유 시 잃은 돌의 ceil(n/2)를 환급한다', ...)  // 1점 포획만 검증
```

**검증자 실측(런타임, 소스 미변경)** — B 3점 그룹을 W가 포획:

```
soul_n3:   {"lostB":3,"pouchBDelta":2,"pouchWDelta":-1}
nosoul_n3: {"lostB":3,"pouchBDelta":0}
```

`ceil(3/2)=2` 환급으로 **명세대로 동작한다.** 결함은 "`Math.ceil`이 `Math.floor`로 바뀌어도 테스트가 통과한다"는 회귀 방어 공백뿐이다.

**요청(Hermes)** — 기존 테스트 이름을 유지한 채 `n=3 → +2` 케이스를 같은 `it` 안에 한 줄 추가한다(테스트 이름을 바꾸면 AC 재동결이 필요하므로 이름은 건드리지 않는다).

---

## R-02 — 부활 점수식 테스트가 자기 일관성만 단언한다

- **심각도: low(권고).** 동작은 정상이다.

**증거**

```
04-claude-acceptance-criteria.md:94   ... 손계산 기대 좌표와 일치. `reviveScore`의 각 항을 개별 검증
tests/engine.revival.test.ts:351-356  expected = candidates.sort((a,b)=>reviveScore(b)-reviveScore(a))[0]
                                      expect(applyRevival(state).kingW).toBe(expected)
```

테스트가 `reviveScore`를 기준값으로 쓰기 때문에 **점수식 자체가 잘못 바뀌면 양쪽이 함께 틀려도 통과**한다.

**검증자 대조(소스 ↔ 원문)**

```
src/engine.ts:334-340
  libsOf(board, p) * 3  +  인접W * 5  −  인접B * 4  +  manhattan(p, kingB)
00-user-request.md:38
  점수 = 활로×3 + 인접W×5 − 인접B×4 + B왕과 맨해튼 거리
```

항·계수·부호가 전부 일치한다. 무료 재배치(`pouchW` 불변), 이력 push, `revived=true`, 동점 시 최소 인덱스도 실측 확인했다.

**요청(Hermes)** — 이름은 유지하고, `reviveScore`를 참조하지 않는 **손계산 상수 1케이스**(예: 특정 배치에서 기대 점수 정수값과 기대 좌표)를 추가한다.

---

## R-03 — AC-609·AC-819 테스트의 검증력이 계약 문구보다 약하다

- **심각도: low(권고).** 현재 구현은 두 계약을 모두 만족한다.

**증거 1 — AC-609(`chooseAiMove`는 최대 점수 지점을 고른다)**

```
tests/engine.ai.test.ts:33-38  board = Array(49).fill('R'); 빈 칸 2개만 열어 둔 판
```

합법수가 사실상 2곳뿐이라 "모든 합법수를 `tryMove`로 시뮬레이션해 최대 점수 선택"의 탐색 부분을 실질적으로 검증하지 못한다.

**증거 2 — AC-819(모든 조작 요소가 터치 가능한 button)**

```
tests/ui.responsive.test.tsx:698  expect(board).toContain('role="button"'); expect(board).toContain('tabIndex=');
```

AC 문구는 "클릭 핸들러를 가진 요소가 **전부** button 계약을 만족"인데 실제로는 소스 문자열 포함 여부만 본다. 새 `onClick` 요소가 계약 없이 추가돼도 통과한다.

**검증자 실측** — 현재 DOM에서 클릭 가능한 요소는 `<button>` 또는 `role="button"`+`tabIndex`+`onKeyDown`을 갖춘 SVG 교차점뿐이고, 버튼 `min-height:44px`·`touch-action:manipulation`·`flex-wrap:wrap`도 확인했다. 폭발석 연쇄는 무작위 2층 120런 중 25런에서 실제 발생했고 예외 0건이었다.

**요청(Hermes)** — 이름 유지. AC-609는 빈 칸을 넉넉히 둔 판에서 참조 스코어러 최대값과 비교하도록, AC-819는 렌더된 트리를 순회해 `onclick`을 가진 노드가 전부 button 계약을 만족하는지 단언하도록 본문만 보강한다.

---

## N-01 — `manifest.orca_tasks` / `orca_dispatches`가 비어 있다 (증적 완결성)

`manifest.json`의 `orca_tasks`는 `{prompt:null, plan:null, implement:null, verify:[]}`, `orca_dispatches`는 `{plan:null, verify:[]}`다. AGENTS §4는 manifest가 Orca ID를 연결하도록 요구한다.

기록해야 할 ID: 1차 검증 `task_7e48d30a8391` / `ctx_5ef403506fb6`, 2차 검증 `task_0a823409843f` / `ctx_27b2231ff358`.

`evidence.py`에는 이 필드를 채우는 서브커맨드가 없다. **기록 주체는 Hermes**이며, 검증자는 manifest를 임의 편집하지 않았다.

---

## N-02 — 이전 세션의 vite 개발 서버가 계속 떠 있다 (환경)

```
netstat: TCP 127.0.0.1:5173  LISTENING
         TCP 127.0.0.1:5199  LISTENING
```

제품 결함이 아니다. 다만 AC-108 원문 포트 `5199`가 점유돼 `--strictPort` 기동이 거부됐고, 검증자는 빈 포트 `5207`로 재실행해 HTTP 200을 확인했다. 다음 검증 전에 정리하면 절차가 원문과 정확히 일치한다.

---

## N-03 — `11-final-summary.md` 부재로 `validate --final`이 실패한다 (Hermes 잔여 작업)

```
$ python scripts/evidence/evidence.py validate --dir <prompt-dir>
{"failures": []}                       ← exit 0

$ python scripts/evidence/evidence.py validate --dir <prompt-dir> --final
{"failures": ["11-final-summary.md"]}  ← exit 2
```

이것이 finalize를 막는 **유일한** 항목이다. `11-final-summary.md`에는 최소한 다음이 포함돼야 한다.

1. **"밸런스 목표 미달성 — 인간 결정 필요(CONFLICT-01/HDD-006)"** (AC-908)
2. AC-824 실브라우저 380px 실측이 **인간 미확인 상태**라는 사실
3. C-01(`dist-debug-old/`) 잔존 사유 또는 삭제 사실
4. 난이도·재미·시각 인상 등 인간 검수 잔여 항목

---

## 2. 재검증 조건

D-01~D-11이 종결됐고 blocking/high가 0이므로 **추가 Claude 검증 라운드는 필요하지 않다.**

Hermes가 R-01~R-03을 반영하기로 하면 `tests/**`만 변경되므로, 그 경우에만 `npm test` / `npm run typecheck` / `node scripts/check-ac-mapping.mjs` 재실행과 새 `verify-before` / `verify-after` snapshot이 필요하다. C-01·N-01·N-03은 `logs/**`만 건드리므로 source tree에 영향이 없다.
