# 04 — Claude 수락 기준 (「사활(死活)의 탑」)

- 작성자: Claude Code (planner, read-only)
- 선행: `02-claude-requirements-analysis.md`, `03-claude-implementation-plan.md`
- 검증 주체: 구현 세션과 **다른 fresh Claude verifier**(AGENTS §3-6). verifier는 소스를 수정하지 않는다.
- 실행 위치: 저장소 루트 `D:\개인 pjt\codex 게임 해커톤`
- 증적 기록: 모든 명령은 아래 래퍼로 실행해 출력·exit code를 보존한다.

```bash
python scripts/evidence/evidence.py capture-command \
  --dir logs/2026-08-15/prompt-20260815-015036-599aa1b4-sahwal-tower \
  --role verifier --name <AC의 evidence name> -- <command>
```

**판정 규칙**

- `PASS` = 표기된 exact command가 **exit 0**이고 기대 결과가 출력에 존재.
- 테스트 이름(`-t "..."`)은 구현이 그대로 사용해야 한다. 이름이 다르면 매핑 실패 → **결함**.
- `HUMAN` 표시 항목은 자동 통과로 보고하지 않는다(AGENTS §10 마지막 줄).
- 밸런스 목표(AC-901)는 **측정·보고 의무**이며 통과 기준이 아니다(CONFLICT-01 / HDD-006).

---

## 0. 게이트 · 전제 조건

| ID | 기준 | 명령/절차 | 기대 결과 |
|---|---|---|---|
| AC-000 | 계획 동결 | `python scripts/evidence/evidence.py gate --dir <prompt-dir> --name plan-frozen` → `--name pre-implement` | 둘 다 exit 0, `manifest.plan_hashes`에 02·03·04·05 hash 기록 |
| AC-001 | 구현 전 baseline 대비 tree 변화가 Codex 구현분뿐임 | `python scripts/evidence/evidence.py snapshot --dir <prompt-dir> --stage implementation` | exit 0 |
| AC-002 | verifier 전후 source tree 동일 | `snapshot --stage verify-before` / `--stage verify-after` 후 `manifest.verifier_tree_unchanged === true` | 동일 tree hash |
| AC-003 | 증적 도구 회귀(도구 미변경 확인) | `python -m unittest discover -s tests -v` | exit 0, 실패·오류 0건 |
| AC-004 | Python 구문 검사 | `python -m py_compile scripts/evidence/*.py tests/evidence/*.py` | exit 0, stderr 없음 |

---

## 1. 스택·의존성·순수성 (R-S2, R-S3, R-D9)

| ID | 요구 | 파일/테스트 | 정확한 명령 | 기대 증거 |
|---|---|---|---|---|
| AC-101 | **런타임 의존성 감사** — `dependencies`는 정확히 `react`, `react-dom` 2개, 버전 `18.3.1` | `tests/meta.deps.test.ts` › `"dependencies는 react와 react-dom 뿐이다"` | `npx vitest run tests/meta.deps.test.ts -t "dependencies는 react와 react-dom 뿐이다"` | exit 0. 테스트는 `package.json`을 읽어 `Object.keys(dependencies)`가 `['react','react-dom']`(정렬 후)와 정확히 일치하고 UI/상태관리 라이브러리(`redux`,`zustand`,`mobx`,`jotai`,`recoil`,`styled-components`,`emotion`,`mui`,`antd`,`tailwindcss`,`chakra`) 문자열이 `package.json` 전체에 없음을 단언 |
| AC-102 | devDependencies가 **설치된 실측 버전과 일치**(오프라인 재현성) | `tests/meta.deps.test.ts` › `"devDependencies 버전이 설치본과 일치한다"` | `npx vitest run tests/meta.deps.test.ts -t "devDependencies 버전이 설치본과 일치한다"` | exit 0. 각 devDependency에 대해 `node_modules/<pkg>/package.json`의 `version`과 문자열 일치 |
| AC-103 | **engine zero-UI-import** — `src/engine.ts`에 import 0건 | `tests/engine.purity.test.ts` › `"engine.ts는 어떤 모듈도 import하지 않는다"` | `npx vitest run tests/engine.purity.test.ts -t "engine.ts는 어떤 모듈도 import하지 않는다"` | exit 0. 소스에 `/^\s*import\s/m`, `require(`, `from '`가 0건 |
| AC-104 | **엔진 부수효과 금지 토큰 부재** | `tests/engine.purity.test.ts` › `"engine.ts는 부수효과 API를 참조하지 않는다"` | `npx vitest run tests/engine.purity.test.ts -t "engine.ts는 부수효과 API를 참조하지 않는다"` | exit 0. `Math.random`, `new Date`, `Date.`, `window`, `document`, `localStorage`, `fetch(`, `console.`, `performance.`, `setTimeout`, `process.` 전부 0건 |
| AC-105 | 엔진 함수의 입력 불변성 | `tests/engine.purity.test.ts` › `"공개 함수는 입력 상태를 변형하지 않는다"` | `npx vitest run tests/engine.purity.test.ts -t "공개 함수는 입력 상태를 변형하지 않는다"` | exit 0. 호출 전후 입력 객체의 deep-equal 스냅샷 동일 |
| AC-106 | 타입 검사 | `tsconfig.json` (`strict: true`) | `npx tsc --noEmit` | exit 0, 진단 0건 |
| AC-107 | 프로덕션 빌드 | — | `npx vite build` | exit 0, `dist/index.html` 생성 |
| AC-108 | **`npm run dev` 동작**(R-S4) | 절차 | ① `npm run dev -- --port 5199 --strictPort` 백그라운드 실행 ② `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:5199/` ③ 프로세스 종료 | ②가 `200`, 응답 HTML에 `<div id="root">` 포함. 출력과 종료를 증적에 보존 |
| AC-109 | 외부 네트워크·신규 의존성 미도입 | 절차 | `npx vitest run tests/meta.deps.test.ts -t "외부 폰트·CDN 링크가 없다"` | exit 0. `index.html`·`src/**`에 `http://`/`https://` 원격 리소스 링크, `@import url(`, `fonts.googleapis` 0건 (OPEN-02) |

---

## 2. 바둑 코어 (R-G, R-T1~R-T4)

| ID | 요구 | 테스트 | 정확한 명령 | 기대 증거 |
|---|---|---|---|---|
| AC-201 | **귀 1점 포획** | `tests/engine.rules.test.ts` › `"귀의 1점을 포획한다"` | `npx vitest run tests/engine.rules.test.ts -t "귀의 1점을 포획한다"` | exit 0. `(0,0)`의 W 1점을 `(0,1)`·`(1,0)` B로 포획, `captured.length === 1`, 결과 판 `(0,0) === null` |
| AC-202 | **자살 불법** | 동 파일 › `"활로 0이 되는 자살수는 불법이다"` | `npx vitest run tests/engine.rules.test.ts -t "활로 0이 되는 자살수는 불법이다"` | exit 0. `ok === false`, `reason === 'suicide'`, 반환 board가 입력과 동일 |
| AC-203 | 포획이 동반되면 자살이 아니다 | 동 파일 › `"포획이 발생하면 자살이 아니다"` | `npx vitest run tests/engine.rules.test.ts -t "포획이 발생하면 자살이 아니다"` | exit 0. `ok === true` |
| AC-204 | **패 즉시 되따냄 superko 불법** | 동 파일 › `"패의 즉시 되따냄은 superko로 불법이다"` | `npx vitest run tests/engine.rules.test.ts -t "패의 즉시 되따냄은 superko로 불법이다"` | exit 0. `reason === 'superko'` |
| AC-205 | 이력에 시작 상태와 매 착수 후 키 push, 키 길이 49 | 동 파일 › `"판 키는 49자이며 시작 상태부터 기록된다"` | `npx vitest run tests/engine.rules.test.ts -t "판 키는 49자이며 시작 상태부터 기록된다"` | exit 0. `boardKey().length === 49`, 문자 집합 `{'.','B','W','R'}` |
| AC-206 | 바위·판 밖은 벽(활로 아님) | 동 파일 › `"바위와 판 밖은 활로를 주지 않는다"` | `npx vitest run tests/engine.rules.test.ts -t "바위와 판 밖은 활로를 주지 않는다"` | exit 0 |
| AC-207 | 다중 그룹 동시 포획 시 중복 제거 | 동 파일 › `"여러 그룹을 동시에 잡을 때 중복 없이 제거한다"` | `npx vitest run tests/engine.rules.test.ts -t "여러 그룹을 동시에 잡을 때 중복 없이 제거한다"` | exit 0. `new Set(captured).size === captured.length` |
| AC-208 | **`sweepDead`** — W 먼저 제거 → 재계산 → B 제거 | 동 파일 › `"sweepDead는 W를 먼저 정리하고 재계산 후 B를 정리한다"` | `npx vitest run tests/engine.rules.test.ts -t "sweepDead는 W를 먼저 정리하고 재계산 후 B를 정리한다"` | exit 0. `removedW`/`removedB` 좌표 집합이 기대값과 일치하며, 순서를 뒤집은 대조 케이스와 결과가 다름을 함께 단언 |
| AC-209 | `legalMoves`가 superko·자살·점유를 모두 배제 | 동 파일 › `"legalMoves는 불법수를 제외한다"` | `npx vitest run tests/engine.rules.test.ts -t "legalMoves는 불법수를 제외한다"` | exit 0 |

---

## 3. 자원 경제·승패 (R-E)

| ID | 요구 | 테스트 | 정확한 명령 | 기대 증거 |
|---|---|---|---|---|
| AC-301 | `START_POUCH === 28`, 상한 없음 | `tests/engine.economy.test.ts` › `"시작 주머니는 28이고 상한이 없다"` | `npx vitest run tests/engine.economy.test.ts -t "시작 주머니는 28이고 상한이 없다"` | exit 0 |
| AC-302 | B 착수 -1 / 포획 +n | 동 › `"B 착수는 -1, 포획은 +n이다"` | `npx vitest run tests/engine.economy.test.ts -t "B 착수는 -1, 포획은 +n이다"` | exit 0 |
| AC-303 | `recover` 포획 +2n | 동 › `"recover 보유 시 포획 회수가 2배다"` | `npx vitest run tests/engine.economy.test.ts -t "recover 보유 시 포획 회수가 2배다"` | exit 0 |
| AC-304 | B돌 포획은 영구 손실 / `soul` 시 `ceil(n/2)` 환급 | 동 › `"soul 보유 시 잃은 돌의 ceil\(n\/2\)를 환급한다"` | `npx vitest run tests/engine.economy.test.ts -t "soul 보유 시"` | exit 0. n=3 → +2 확인 |
| AC-305 | W 착수 -1, W 패스도 -1, W 포획 회수 없음 | 동 › `"W는 착수와 패스 모두 주머니를 1 소모한다"` | `npx vitest run tests/engine.economy.test.ts -t "W는 착수와 패스 모두 주머니를 1 소모한다"` | exit 0 |
| AC-306 | **탈진 승리** — W턴 시작 시 `pouchW <= 0` | 동 › `"W턴 시작 시 주머니가 0 이하면 탈진 승리다"` | `npx vitest run tests/engine.economy.test.ts -t "탈진 승리"` | exit 0. `status==='win'`, `reason==='exhaust'` |
| AC-307 | **돌 고갈 패배** — W턴 종료 후 미결 + `pouchB <= 0` | 동 › `"W턴 종료 후 미결이고 B 주머니가 0 이하면 고갈 패배다"` | `npx vitest run tests/engine.economy.test.ts -t "고갈 패배"` | exit 0. `status==='lose'`, `reason==='depleted'` |
| AC-308 | B 패스 비용 0, tempo 잔여 연속수 소멸 | 동 › `"B 패스는 비용 0이며 tempo 잔여 연속수를 소멸시킨다"` | `npx vitest run tests/engine.economy.test.ts -t "B 패스는 비용 0이며"` | exit 0. `pouchB` 불변, `pendingB === 0` |
| AC-309 | `REST_BONUS === 4` 층 승리 시 가산 | `tests/run.flow.test.ts` › `"층 승리 시 주머니가 4 늘어난다"` | `npx vitest run tests/run.flow.test.ts -t "층 승리 시 주머니가 4 늘어난다"` | exit 0 |
| AC-310 | 왕 그룹 포획 승/패 | `tests/engine.economy.test.ts` › `"왕 그룹이 잡히면 승패가 결정된다"` | `npx vitest run tests/engine.economy.test.ts -t "왕 그룹이 잡히면 승패가 결정된다"` | exit 0 |

---

## 4. 층 데이터·기믹 (R-F, R-D4, R-D5)

| ID | 요구 | 테스트 | 정확한 명령 | 기대 증거 |
|---|---|---|---|---|
| AC-401 | **정확한 층 데이터 동결값** | `tests/engine.floors.test.ts` › `"층 데이터는 확정값과 정확히 일치한다"` | `npx vitest run tests/engine.floors.test.ts -t "층 데이터는 확정값과 정확히 일치한다"` | exit 0. 1층: rocks `[]`, guards `[]`, pouchW `20` / 2층: rocks `(2,2)(2,4)(4,2)(4,4)`, guards `(1,2)(1,4)`, pouchW `24` / 3층: rocks `(3,3)(0,0)(0,6)`, guards `(1,2)(1,4)`, pouchW `30`. 전 층 W왕 `(1,3)`, B왕 `(5,3)` |
| AC-402 | 왕돌 시작 배치 | 동 › `"왕돌은 전투 시작 시 배치된다"` | `npx vitest run tests/engine.floors.test.ts -t "왕돌은 전투 시작 시 배치된다"` | exit 0 |
| AC-403 | **2층 골렘 2연속 착수 + 각 수 -1** | 동 › `"골렘은 3의 배수 턴에 2연속 착수하며 각 수마다 -1이다"` | `npx vitest run tests/engine.floors.test.ts -t "골렘은 3의 배수 턴에 2연속 착수하며"` | exit 0. 1·2턴은 1수, 3턴은 2수. 3턴에서 `pouchW`가 2 감소 |
| AC-404 | **골렘 2연타 수 사이 승패 판정** | 동 › `"골렘 2연타는 수 사이에 승패를 판정하고 결정되면 두 번째 수를 두지 않는다"` | `npx vitest run tests/engine.floors.test.ts -t "골렘 2연타는 수 사이에 승패를 판정하고"` | exit 0. 첫 수로 B왕이 잡히는 배치에서 `status==='lose'`이고 `pouchW`가 **1만** 감소, 두 번째 수가 판에 반영되지 않음 |
| AC-405 | **3층 부활 1회** | `tests/engine.revival.test.ts` › `"불사왕은 처음 제거될 때 1회 부활한다"` | `npx vitest run tests/engine.revival.test.ts -t "불사왕은 처음 제거될 때 1회 부활한다"` | exit 0. `revived===true`, `status==='playing'`, 판에 새 W왕 존재 |
| AC-406 | 부활 점수식 = `활로×3 + 인접W×5 − 인접B×4 + B왕 맨해튼 거리`, 최대 지점 선택 | 동 › `"부활 위치는 점수식 최대 지점이다"` | `npx vitest run tests/engine.revival.test.ts -t "부활 위치는 점수식 최대 지점이다"` | exit 0. 손계산 기대 좌표와 일치. `reviveScore`의 각 항을 개별 검증 |
| AC-407 | 부활은 무료(주머니 차감 없음) + 이력 push | 동 › `"부활은 무료이며 이력에 push된다"` | `npx vitest run tests/engine.revival.test.ts -t "부활은 무료이며 이력에 push된다"` | exit 0. `pouchW` 불변, `history.length` +1 |
| AC-408 | **두 번째 제거 시 승리** | 동 › `"부활한 왕이 다시 제거되면 승리한다"` | `npx vitest run tests/engine.revival.test.ts -t "부활한 왕이 다시 제거되면 승리한다"` | exit 0. `status==='win'`, `reason==='king'` |
| AC-409 | **부활 후보 없으면 즉시 승리** | 동 › `"부활 후보가 없으면 즉시 승리한다"` | `npx vitest run tests/engine.revival.test.ts -t "부활 후보가 없으면 즉시 승리한다"` | exit 0 |
| AC-410 | 부활 동점 시 결정론(ASM-17) | 동 › `"부활 점수 동점이면 인덱스가 작은 칸을 고른다"` | `npx vitest run tests/engine.revival.test.ts -t "부활 점수 동점이면"` | exit 0 |

---

## 5. 유물 6종 (R-R, R-T5, R-D6)

| ID | 요구 | 테스트 | 정확한 명령 | 기대 증거 |
|---|---|---|---|---|
| AC-501 | 유물 6종 정의(키·이름·한자) | `tests/engine.relics.test.ts` › `"유물 6종의 키와 이름이 명세와 일치한다"` | `npx vitest run tests/engine.relics.test.ts -t "유물 6종의 키와 이름이 명세와 일치한다"` | exit 0. `recover 회수의 손(回收)`, `soul 사석의 혼(捨石)`, `pouch7 두둑한 주머니(碁囊)`, `tempo 선수의 부채(先手)`, `bomb 폭발석(爆石)`, `guard 왕의 호위(護衛)` |
| AC-502 | **`pouch7` 즉시 +7** | 동 › `"pouch7을 선택하면 주머니가 즉시 7 늘어난다"` | `npx vitest run tests/engine.relics.test.ts -t "pouch7을 선택하면 주머니가 즉시 7 늘어난다"` | exit 0 |
| AC-503 | `tempo` 매 전투 첫 턴 2연속, 각 -1 | 동 › `"tempo는 매 전투 첫 턴에 2연속 착수를 준다"` | `npx vitest run tests/engine.relics.test.ts -t "tempo는 매 전투 첫 턴에"` | exit 0. `pendingB===2`, 두 수 합계 `pouchB` -2 |
| AC-504 | `guard` 무료 돌 배치 순서 위→왼→오→아래 | 동 › `"guard는 B왕 주위 위·왼쪽·오른쪽·아래 순 첫 빈 칸에 무료로 놓인다"` | `npx vitest run tests/engine.relics.test.ts -t "guard는 B왕 주위"` | exit 0. 위가 막힌 배치에서 왼쪽 선택, `pouchB` 불변 |
| AC-505 | `bomb` 전투당 1회 장전 토글 | 동 › `"bomb은 전투당 1회만 장전할 수 있다"` | `npx vitest run tests/engine.relics.test.ts -t "bomb은 전투당 1회만 장전할 수 있다"` | exit 0. 사용 후 재장전 불가 |
| AC-506 | 장전 상태에서 불법수 거부 시 장전 유지 | 동 › `"불법수가 거부되면 폭발석 장전이 소모되지 않는다"` | `npx vitest run tests/engine.relics.test.ts -t "불법수가 거부되면"` | exit 0 |
| AC-507 | **폭발석 연쇄 정확** | 동 › `"폭발석 연쇄는 상하좌우 W 파괴 후 sweepDead하고 회수량을 합산한다"` | `npx vitest run tests/engine.relics.test.ts -t "폭발석 연쇄는 상하좌우 W 파괴 후"` | exit 0. ① 폭발 위치 4방향 W 제거 ② `sweepDead` 수행 ③ 회수 = (파괴 + 정리 W) 수, `recover` 시 2배 ④ 정리된 B는 손실 합산(`soul` 적용) ⑤ 결과 판 키 이력 push |
| AC-508 | 폭발석으로 W왕 제거 시 부활/승리 동일 적용 | 동 › `"폭발석으로 W왕이 제거되면 부활 또는 승리가 적용된다"` | `npx vitest run tests/engine.relics.test.ts -t "폭발석으로 W왕이 제거되면"` | exit 0. 3층 미부활 → `revived===true`, 그 외 → `status==='win'` |
| AC-509 | 1·2층 승리 후 **미보유 중 3개 제시**, 선택 또는 건너뛰기 | `tests/run.flow.test.ts` › `"층 승리 후 미보유 유물 3개가 중복 없이 제시된다"` | `npx vitest run tests/run.flow.test.ts -t "층 승리 후 미보유 유물 3개가 중복 없이 제시된다"` | exit 0. 길이 3, 중복 없음, 보유분 미포함 |
| AC-510 | 3층은 유물 없이 바로 클리어 | 동 › `"3층 승리 후에는 유물 화면 없이 클리어한다"` | `npx vitest run tests/run.flow.test.ts -t "3층 승리 후에는 유물 화면 없이 클리어한다"` | exit 0 |

---

## 6. 적 AI 휴리스틱 (R-A)

| ID | 요구 | 테스트 | 정확한 명령 | 기대 증거 |
|---|---|---|---|---|
| AC-601 | 포획 `+100n`, B왕 포함 `+100000` | `tests/engine.ai.test.ts` › `"포획은 100n이고 B왕 포획은 100000이다"` | `npx vitest run tests/engine.ai.test.ts -t "포획은 100n이고 B왕 포획은 100000이다"` | exit 0. `scoreAiMove(state,p,0)` 값 일치 |
| AC-602 | 결과 활로 `+4L`, `L===1 && 포획<2 → -150` | 동 › `"결과 활로는 4L이고 활로1에 포획 2 미만이면 -150이다"` | `npx vitest run tests/engine.ai.test.ts -t "결과 활로는 4L이고"` | exit 0 |
| AC-603 | 사방이 W·바위·밖이면 `-120` | 동 › `"사방이 W·바위·판 밖이면 -120이다"` | `npx vitest run tests/engine.ai.test.ts -t "사방이 W·바위·판 밖이면 -120이다"` | exit 0 |
| AC-604 | 구조 보너스 `+60+크기×20`, W왕 포함 추가 `+8000` | 동 › `"활로1 W그룹 구조는 60+크기×20이고 왕 포함 시 8000을 더한다"` | `npx vitest run tests/engine.ai.test.ts -t "활로1 W그룹 구조는"` | exit 0 |
| AC-605 | 결과 W왕 그룹 활로1 → `-5000` | 동 › `"결과 W왕 그룹이 단수면 -5000이다"` | `npx vitest run tests/engine.ai.test.ts -t "결과 W왕 그룹이 단수면 -5000이다"` | exit 0 |
| AC-606 | 인접 B그룹 활로1 `+50+크기×8`, B왕 포함 `+900`; 활로2 & B왕 `+200` | 동 › `"인접 B그룹 압박 점수가 명세와 일치한다"` | `npx vitest run tests/engine.ai.test.ts -t "인접 B그룹 압박 점수가 명세와 일치한다"` | exit 0 |
| AC-607 | B왕 접근 `+(10−맨해튼)×3`, 중앙 `+(3−체비쇼프)`, 인접 W당 `+3` | 동 › `"위치 보정 항이 명세와 일치한다"` | `npx vitest run tests/engine.ai.test.ts -t "위치 보정 항이 명세와 일치한다"` | exit 0 |
| AC-608 | 난수항 `rand()×6` 분리·주입 | 동 › `"난수항은 rand\(\)×6이며 주입 가능하다"` | `npx vitest run tests/engine.ai.test.ts -t "난수항은"` | exit 0. `rng` 고정 시 결과 결정론적 |
| AC-609 | 모든 합법수를 `tryMove`로 시뮬레이션해 최대 점수 선택 | 동 › `"chooseAiMove는 최대 점수 지점을 고른다"` | `npx vitest run tests/engine.ai.test.ts -t "chooseAiMove는 최대 점수 지점을 고른다"` | exit 0 |
| AC-610 | 합법수 없으면 패스 + `-1` | 동 › `"합법수가 없으면 패스하고 주머니가 1 줄어든다"` | `npx vitest run tests/engine.ai.test.ts -t "합법수가 없으면 패스하고"` | exit 0. `chooseAiMove === null` |

---

## 7. 런 흐름 · 실제 재현 경로 (R-D1~R-D3, R-T6)

| ID | 요구 | 테스트 | 정확한 명령 | 기대 증거 |
|---|---|---|---|---|
| AC-701 | **실제 클리어 경로** — 1→2→3층 승리 후 클리어 화면 | `tests/run.flow.test.ts` › `"3층까지 연속 승리하면 클리어 상태가 된다"` | `npx vitest run tests/run.flow.test.ts -t "3층까지 연속 승리하면 클리어 상태가 된다"` | exit 0. 시드 고정 시나리오로 `clearedFloors===3`, 종료 화면 인장 `生` |
| AC-702 | **실제 왕 함락 패배 경로** | 동 › `"B왕이 잡히면 런이 즉시 종료된다"` | `npx vitest run tests/run.flow.test.ts -t "B왕이 잡히면 런이 즉시 종료된다"` | exit 0. `status==='lose'`, `reason==='king'`, 종료 인장 `死` |
| AC-703 | **실제 돌 고갈 패배 경로** | 동 › `"주머니가 고갈되면 런이 종료된다"` | `npx vitest run tests/run.flow.test.ts -t "주머니가 고갈되면 런이 종료된다"` | exit 0. `reason==='depleted'` |
| AC-704 | **승리 → 유물 3개 → 선택 → 다음 층**(R-T6) | 동 › `"승리 후 유물 3개 제시와 선택을 거쳐 다음 층으로 간다"` | `npx vitest run tests/run.flow.test.ts -t "승리 후 유물 3개 제시와 선택을 거쳐 다음 층으로 간다"` | exit 0. 선택한 유물이 `run.relics`에 반영되고 `run.floor`가 +1 |
| AC-705 | 건너뛰기 경로 | 동 › `"유물을 건너뛰어도 다음 층으로 간다"` | `npx vitest run tests/run.flow.test.ts -t "유물을 건너뛰어도 다음 층으로 간다"` | exit 0 |
| AC-706 | 주머니가 층 사이에 유지(ASM-01) | 동 › `"주머니는 층 사이에 유지된다"` | `npx vitest run tests/run.flow.test.ts -t "주머니는 층 사이에 유지된다"` | exit 0 |
| AC-707 | 새 런은 타이틀 생략하고 1층부터(R-U8) | `tests/ui.render.test.tsx` › `"새로 시작하면 타이틀 없이 1층 전투로 간다"` | `npx vitest run tests/ui.render.test.tsx -t "새로 시작하면 타이틀 없이 1층 전투로 간다"` | exit 0 |

---

## 8. UI · 문자열 · 타이머 · 반응형 (R-U, R-V, R-S5~R-S7, R-D8)

| ID | 요구 | 테스트 | 정확한 명령 | 기대 증거 |
|---|---|---|---|---|
| AC-801 | 타이틀 요소 | `tests/ui.render.test.tsx` › `"타이틀 화면 요소가 모두 있다"` | `npx vitest run tests/ui.render.test.tsx -t "타이틀 화면 요소가 모두 있다"` | exit 0. `塔`, `死活之塔`, `一`~`四`, `등반 시작`, 힌트 `왕 주위에 두 집을 지으면 어떤 마물도 그 왕을 잡지 못한다` 렌더 |
| AC-802 | 전투 화면 배치 순서 | 동 › `"전투 화면 요소가 명세 순서대로 배치된다"` | `npx vitest run tests/ui.render.test.tsx -t "전투 화면 요소가 명세 순서대로 배치된다"` | exit 0. DOM 순서: 제목+층 인장 → 적 2자 인장/층·이름/기믹 → 주머니·포획·손실·적 주머니 → SVG판 → 상태 → 버튼 4종 → 유물 칩 → 최근 로그 3줄 |
| AC-803 | 내 주머니 ≤5 빨강 | 동 › `"주머니가 5 이하면 경고 색으로 표시된다"` | `npx vitest run tests/ui.render.test.tsx -t "주머니가 5 이하면"` | exit 0. 해당 노드에 경고 클래스 부여, 값 `var(--ju)` |
| AC-804 | SVG `viewBox` 340×340 · 구성요소 | 동 › `"SVG 판은 viewBox 340×340이며 구성요소를 갖춘다"` | `npx vitest run tests/ui.render.test.tsx -t "SVG 판은 viewBox 340×340이며"` | exit 0. `viewBox="0 0 340 340"`, 격자, 화점(3,3), 마지막 수 붉은 링, 왕 금색 링+`王`, 폭발석 `✸`, 바위 회색 원 |
| AC-805 | 빈 교차점 **투명 반칸 반지름 터치영역** | `tests/ui.responsive.test.tsx` › `"빈 교차점 터치 영역은 반칸 반지름이며 투명하다"` | `npx vitest run tests/ui.responsive.test.tsx -t "빈 교차점 터치 영역은"` | exit 0. 빈 칸마다 `<circle r=반칸>` + `fill="transparent"`(또는 `fill-opacity="0"`) 존재 |
| AC-806 | 왕 단수 경고 문구·펄스 | `tests/ui.render.test.tsx` › `"왕이 단수면 경고 문구와 펄스가 나타난다"` | `npx vitest run tests/ui.render.test.tsx -t "왕이 단수면 경고 문구와 펄스가 나타난다"` | exit 0. `위험 — 내 왕돌이 단수에 몰렸다!` / `기회 — 적 왕돌이 단수다. 한 수면 잡는다.` 정확 일치 |
| AC-807 | 승패 오버레이 | 동 › `"승패 오버레이 문구와 버튼이 명세와 같다"` | `npx vitest run tests/ui.render.test.tsx -t "승패 오버레이 문구와 버튼이 명세와 같다"` | exit 0. `勝`(gold) / `死`(ju), 사유, `전리품을 살핀다` / `탑 꼭대기로` / `기록을 남긴다` |
| AC-808 | 유물 화면 | 동 › `"유물 화면은 카드 3장과 건너뛰기·새로하기를 보여준다"` | `npx vitest run tests/ui.render.test.tsx -t "유물 화면은 카드 3장과"` | exit 0. `비운 채로 오른다`, `새로하기` |
| AC-809 | 새로하기 확인 모달 | 동 › `"새로하기는 현재 층·돌·유물 요약 모달을 띄운다"` | `npx vitest run tests/ui.render.test.tsx -t "새로하기는 현재 층·돌·유물 요약 모달을 띄운다"` | exit 0. `계속 오른다` / `새로 시작` |
| AC-810 | 종료 화면 | 동 › `"종료 화면은 生 또는 死 인장과 기록을 보여준다"` | `npx vitest run tests/ui.render.test.tsx -t "종료 화면은 生 또는 死 인장과"` | exit 0. 도달 층·총 포획·유물, `처음부터 다시 오른다` |
| AC-811 | 규칙 모달 7개 주제 | 동 › `"규칙 모달이 7개 주제를 모두 설명한다"` | `npx vitest run tests/ui.render.test.tsx -t "규칙 모달이 7개 주제를 모두 설명한다"` | exit 0. 활로·포획 / 경제 / 왕·고갈 패배 / 탈진 승리 / 바위 / 패 금지 / 두 집 힌트 |
| AC-812 | **모든 게임 텍스트 한국어**(한자 인장 제외) | 동 › `"게임 텍스트에 영문 문장이 없다"` | `npx vitest run tests/ui.render.test.tsx -t "게임 텍스트에 영문 문장이 없다"` | exit 0. 렌더된 텍스트 노드에 `[A-Za-z]{3,}` 매치 0건(허용 목록: 없음) |
| AC-813 | **620ms AI 지연 + 잠금** | `tests/ui.timer.test.tsx` › `"B 착수 후 620ms 뒤에 AI가 둔다"` | `npx vitest run tests/ui.timer.test.tsx -t "B 착수 후 620ms 뒤에 AI가 둔다"` | exit 0. `vi.useFakeTimers()`로 619ms에서는 AI 미착수·`…수를 읽는 중` 표시·버튼 `disabled`, 620ms에서 AI 착수 |
| AC-814 | **stale 타이머 가드** | 동 › `"화면을 떠난 뒤 만료된 타이머는 아무 것도 하지 않는다"` | `npx vitest run tests/ui.timer.test.tsx -t "화면을 떠난 뒤 만료된 타이머는"` | exit 0. B 착수 후 620ms 경과 전에 `새로하기 → 새로 시작`을 실행하고 타이머를 진행시켜도 새 전투 상태가 변하지 않고 예외·경고 0건 |
| AC-815 | 타이머 중복 생성 금지 | 동 › `"같은 턴에 타이머가 중복 생성되지 않는다"` | `npx vitest run tests/ui.timer.test.tsx -t "같은 턴에 타이머가 중복 생성되지 않는다"` | exit 0. `setTimeout` 스파이 호출 1회 |
| AC-816 | 타이머 콜백의 4중 재검사 | 동 › `"타이머 콜백은 화면·턴·상태·세대를 재검사한다"` | `npx vitest run tests/ui.timer.test.tsx -t "타이머 콜백은 화면·턴·상태·세대를 재검사한다"` | exit 0 |
| AC-817 | **380px 무가로스크롤 계약** | `tests/ui.responsive.test.tsx` › `"380px 기준 가로 오버플로를 유발하는 스타일이 없다"` | `npx vitest run tests/ui.responsive.test.tsx -t "380px 기준 가로 오버플로를 유발하는 스타일이 없다"` | exit 0. `styles.css`에 `width`/`min-width`가 `380px` 초과인 고정 px 규칙 0건, 루트에 `overflow-x: hidden` 또는 `max-width:100%` 계약, 판 SVG에 고정 px 폭 없음, `index.html`에 `<meta name="viewport" content="width=device-width, initial-scale=1...">` 존재 |
| AC-818 | **데스크톱 최대폭 430px 중앙 정렬** | 동 › `"앱 컨테이너는 최대폭 430px 중앙 정렬이다"` | `npx vitest run tests/ui.responsive.test.tsx -t "앱 컨테이너는 최대폭 430px 중앙 정렬이다"` | exit 0. `max-width: 430px` + `margin-inline: auto`(또는 `margin: 0 auto`) |
| AC-819 | **전 기능 터치** | 동 › `"모든 조작 요소가 터치 가능한 button이며 최소 크기를 만족한다"` | `npx vitest run tests/ui.responsive.test.tsx -t "모든 조작 요소가 터치 가능한 button이며"` | exit 0. 클릭 핸들러를 가진 요소가 전부 `<button>`(또는 `role="button"` + `tabindex`), 버튼 CSS `min-height` ≥ 44px, `touch-action: manipulation` 선언, 버튼 컨테이너 `flex-wrap: wrap` |
| AC-820 | 색 토큰 정확 일치 | 동 › `"색 토큰이 명세 값과 정확히 일치한다"` | `npx vitest run tests/ui.responsive.test.tsx -t "색 토큰이 명세 값과 정확히 일치한다"` | exit 0. `#16151c`, `#211f29`, `#e3d3ae`, `#6b5a3a`, `#c0392b`, `#8e2a1f`, `#d4a938`, `#eae6da`, `#8f8a7d` 9개 전부 존재 |
| AC-821 | 모션 규격·reduced-motion 전면 비활성 | 동 › `"reduced-motion에서 모든 애니메이션이 비활성화된다"` | `npx vitest run tests/ui.responsive.test.tsx -t "reduced-motion에서 모든 애니메이션이 비활성화된다"` | exit 0. 돌 팝 `0.18s` 선언 존재, `@media (prefers-reduced-motion: reduce)` 블록이 `animation: none` + `transition: none`을 전역 적용 |
| AC-822 | 붉은색은 인장·위험에만 / warm glow는 판에만 | 동 › `"붉은색과 warm glow의 사용 범위가 제한된다"` | `npx vitest run tests/ui.responsive.test.tsx -t "붉은색과 warm glow의 사용 범위가 제한된다"` | exit 0. `--ju`/`--ju-deep` 사용처가 인장·위험·마지막 수 링 셀렉터로 한정, `filter/box-shadow` glow 셀렉터가 판 컨테이너로 한정 |
| AC-823 | 숫자 tabular | 동 › `"숫자는 tabular 정렬을 사용한다"` | `npx vitest run tests/ui.responsive.test.tsx -t "숫자는 tabular 정렬을 사용한다"` | exit 0. `font-variant-numeric: tabular-nums` 선언 |
| AC-824 **HUMAN** | 실브라우저 380px 무가로스크롤·터치 실측 | 절차 | Chrome DevTools 380×740, 각 화면(타이틀/전투/오버레이/유물/종료/모달)에서 `document.documentElement.scrollWidth <= 380` 확인 및 스크린샷 보존 | **자동 검증 아님.** jsdom은 레이아웃을 계산하지 않는다(OPEN-03). 인간 확인 결과를 `11-final-summary.md`에 기록 |

---

## 9. 시뮬레이션 · 밸런스 (R-T7~R-T9, CONFLICT-01)

| ID | 요구 | 테스트/스크립트 | 정확한 명령 | 기대 증거 |
|---|---|---|---|---|
| AC-901 | **무작위 시뮬레이션 층별 3회 이상** | `tests/sim.random.test.ts` › `"층별 3회 이상 무작위 대국이 400수 안에 예외 없이 종료된다"` | `npx vitest run tests/sim.random.test.ts -t "층별 3회 이상 무작위 대국이 400수 안에 예외 없이 종료된다"` | exit 0. 층 1·2·3 각 3회 이상, 각 판 수 ≤ 400, 예외 0건 |
| AC-902 | **자원 음수 없음** | 동 › `"시뮬레이션 도중 자원이 음수가 되지 않는다"` | `npx vitest run tests/sim.random.test.ts -t "시뮬레이션 도중 자원이 음수가 되지 않는다"` | exit 0. 매 수마다 `pouchB >= 0 이상 규약`·`capturedW >= 0`·`lostB >= 0` 단언(주머니는 0 이하 종료 규칙 범위 내에서 음수 미발생 확인) |
| AC-903 | 시뮬 종료 사유 기록 | 동 › `"시뮬레이션 종료 사유가 기록된다"` | `npx vitest run tests/sim.random.test.ts -t "시뮬레이션 종료 사유가 기록된다"` | exit 0. `king`/`exhaust`/`depleted`/`limit` 중 하나 |
| AC-904 | **밸런스 하니스 — 색 반전 AI, 층별 12회, 무유물** | `scripts/balance.ts` | `npx vite-node scripts/balance.ts` | exit 0. stdout에 층별 표(층/시행 12/승/패/승률/목표/`in_range`)와 리포트 파일 경로. 리포트를 `logs/2026-08-15/prompt-20260815-015036-599aa1b4-sahwal-tower/balance-report.md`에 기록 |
| AC-905 | 색 반전 정확성(판·이력·왕 미러링) | `tests/engine.ai.test.ts` › `"mirrorState는 판·이력·왕을 함께 반전한다"` | `npx vitest run tests/engine.ai.test.ts -t "mirrorState는 판·이력·왕을 함께 반전한다"` | exit 0. 두 번 적용하면 원본과 동일(involution), 이력 키도 반전, `kingB`↔`kingW` |
| AC-906 | 밸런스 목표치 **측정·보고**(통과 기준 아님) | 리포트 | AC-904의 출력 | 목표 1층 `≈100%`, 2층 `40~60%`, 3층 `15~30%` 대비 실측치와 `in_range: true｜false` 기재 |
| AC-907 | **동결값 무변경 증명** | `tests/engine.floors.test.ts` (AC-401) + diff | `npx vitest run tests/engine.floors.test.ts -t "층 데이터는 확정값과 정확히 일치한다"` 및 구현 diff에서 `FLOORS` 변경 이력 확인 | exit 0. 밸런스 결과와 무관하게 pouchW 20/24/30, guards `(1,2)(1,4)`, rocks 좌표가 원문과 동일 |
| AC-908 | 밸런스 이탈 시 처리 | 절차 | 이탈이면 `07-codex-result.md`·`11-final-summary.md`에 **"밸런스 목표 미달성 — 인간 결정 필요(CONFLICT-01/HDD-006)"** 명시 | 자동 튜닝 흔적이 없을 것. 목표 미달을 성공으로 보고하면 **결함** |

---

## 10. 전체 회귀 (필수 명령)

| ID | 기준 | 정확한 명령 | 기대 결과 |
|---|---|---|---|
| AC-1001 | 전체 게임 테스트 | `npx vitest run` | exit 0, 실패 0건. 위 모든 테스트 파일 포함 |
| AC-1002 | 타입 검사 | `npx tsc --noEmit` | exit 0 |
| AC-1003 | 빌드 | `npx vite build` | exit 0 |
| AC-1004 | 증적 도구 회귀 | `python -m unittest discover -s tests -v` | exit 0 |
| AC-1005 | 증적 검증 | `python scripts/evidence/evidence.py validate --dir <prompt-dir> --final` | exit 0 |
| AC-1006 | checksum | `python scripts/evidence/evidence.py verify-checksums --dir <prompt-dir>` | exit 0 |

`evidence.config.json`의 `required`에 선언된 이름(`full_tests`, `typecheck`, `build`)은 **verifier 역할로 capture-command 실행**되어 `passed` 상태여야 finalize가 통과한다(`scripts/evidence/evidence.py` 검증 로직).

---

## 11. 매핑 요약 (요구사항 → AC)

| 요구 | AC |
|---|---|
| R-S1·S4 | AC-107, AC-108, AC-1001~AC-1003 |
| R-S2 | AC-101, AC-102, AC-109 |
| R-S3 / R-D9 | AC-103, AC-104, AC-105 |
| R-S5 / R-D8 | AC-817, AC-819, AC-824(HUMAN) |
| R-S6 | AC-818 |
| R-S7 | AC-812 |
| R-G1~G7 | AC-201~AC-209 |
| R-E1~E12 | AC-301~AC-310 |
| R-F1~F4 / R-D4 | AC-401~AC-404 |
| R-F5 / R-D5 | AC-405~AC-410 |
| R-R1~R6 / R-D6 | AC-501~AC-510 |
| R-A1~A16 | AC-601~AC-610 |
| R-U1~U10 | AC-801~AC-811, AC-707 |
| R-V1~V6 | AC-820~AC-823 |
| R-T1~T4 | AC-201, AC-202, AC-204, AC-208 |
| R-T5·T6 | AC-502, AC-704 |
| R-T7 | AC-901~AC-903 |
| R-T8·T9 / CONFLICT-01 | AC-904~AC-908 |
| R-D1~D3 | AC-701~AC-703 |
| R-D7 | AC-1001 + AC-906(측정) |

---

## 12. 결함 판정 기준

다음 중 하나라도 해당하면 `09-claude-defect-report.md`에 **blocking**으로 기록한다.

1. 위 exact command 중 하나라도 exit ≠ 0.
2. 테스트 이름이 표기와 달라 `-t` 매핑이 실패.
3. 원문 수치·좌표·한국어 문자열이 한 글자라도 다름.
4. **밸런스 결과를 이유로 층 동결값이 변경됨**(CONFLICT-01 / HDD-006 위반).
5. `src/engine.ts`에 import 또는 부수효과 토큰이 존재.
6. `dependencies`에 React 외 런타임 패키지가 존재.
7. 실행하지 않은 명령을 통과했다고 기록(AGENTS §10).
8. 밸런스 목표 미달을 보고하지 않고 성공으로 마감.
