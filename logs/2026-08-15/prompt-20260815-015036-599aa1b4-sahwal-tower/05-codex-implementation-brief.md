# 05 — Codex 구현 브리프 (「사활(死活)의 탑」)

- 수신: Hermes/Codex (유일한 구현자, HDD-001 / AGENTS §2.2)
- 준거 문서: `02-claude-requirements-analysis.md`(요구·모순), `03-claude-implementation-plan.md`(설계·계약), `04-claude-acceptance-criteria.md`(수락 기준)
- 원칙: **원문 수치·좌표·한국어 문자열을 한 글자도 바꾸지 않는다.** 04의 테스트 이름을 그대로 사용한다(`-t` 매핑 실패 = 결함).

---

## 1. 시작 전 확인 (3분)

1. `python scripts/evidence/evidence.py gate --dir <prompt-dir> --name plan-frozen` → exit 0
2. `python scripts/evidence/evidence.py gate --dir <prompt-dir> --name pre-implement` → exit 0
3. `node_modules/<pkg>/package.json`에서 다음 실측 버전을 확인해 `package.json`에 그대로 기입:
   `react` `react-dom` `vite` `@vitejs/plugin-react` `vitest` `typescript` `jsdom` `vite-node` `@types/react` `@types/react-dom`
   → **추측 금지. `npm install`로 새 패키지를 받아야 하는 상황이면 즉시 중단하고 인간에게 보고**(AGENTS §9).

---

## 2. 구현 순서 (수직 TDD — 각 단계 RED 먼저)

각 단계는 **① RED 명령 실행 → 실패 출력을 `06-codex-implementation-log.md`에 원문 붙여넣기 → ② 해당 파일만 작성 → ③ 같은 명령 통과 → ④ `npx vitest run` 누적 회귀 exit 0** 순서를 지킨다. RED 증거가 없는 단계는 무효다.

| # | 단계 | 먼저 쓰는 테스트 | 그 다음 만드는 파일 |
|---|---|---|---|
| 1 | 스캐폴드 | `tests/engine.rules.test.ts`(첫 케이스만) | `package.json`, `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/engine.ts`(상수 뼈대) |
| 2 | 바둑 코어 | `tests/engine.rules.test.ts` 전체 | `src/engine.ts` §3.1~3.2 (`idx`~`legalMoves`) |
| 3 | `sweepDead` | 동 파일 해당 케이스 | `sweepDead` |
| 4 | 경제·승패 | `tests/engine.economy.test.ts` | `playerMove`/`playerPass`/승패 판정(계획 §6.3) |
| 5 | 층·골렘 | `tests/engine.floors.test.ts` | `FLOORS`, `startBattle`, 골렘 2연타 분기 |
| 6 | AI | `tests/engine.ai.test.ts` | `scoreAiMove`, `chooseAiMove`, `aiTurn` |
| 7 | 부활 | `tests/engine.revival.test.ts` | `reviveCandidates`/`reviveScore`/`applyRevival` |
| 8 | 유물·폭발석 | `tests/engine.relics.test.ts` | `RELICS`, `offerRelics`, `applyRelic`, `toggleBomb`, `detonateBomb` |
| 9 | 런 흐름 | `tests/run.flow.test.ts` | `newRun`, `finishFloor`, 런 전이 |
| 10 | 순수성·의존성 | `tests/engine.purity.test.ts`, `tests/meta.deps.test.ts` | `engine.ts` 정리, `package.json` 확정 |
| 11 | UI 렌더 | `tests/ui.render.test.tsx` | `src/strings.ts`, `src/theme.ts`, `src/styles.css`, `src/App.tsx`, `src/components/`(TitleScreen, BattleScreen, BoardSvg, ResultOverlay, RelicScreen, EndScreen, RulesModal, RestartModal) |
| 12 | 타이머 | `tests/ui.timer.test.tsx` | `src/hooks/useAiTurn.ts` |
| 13 | 반응형·비주얼 | `tests/ui.responsive.test.tsx` | `src/styles.css`·`index.html` 보정 |
| 14 | 시뮬레이션 | `tests/sim.random.test.ts` | (엔진 보정만) |
| 15 | 밸런스 | — | `src/engine.ts`의 `mirrorState`/`autoPlayerMove`, `scripts/balance.ts` |
| 16 | 마무리 | — | `evidence.config.json`(계획 §7.2), `.gitignore`에 `node_modules/`·`dist/` 추가 |

---

## 3. 절대 지켜야 할 계약 (요약)

- **엔진 단일 파일**: 게임 로직 전량 `src/engine.ts`. **import 0건**, `Math.random`/`Date`/`window`/`document`/`console`/`setTimeout` 등 **부수효과 토큰 0건**. 난수는 `rng: () => number` 주입(AC-103/104).
- **런타임 의존성**: `dependencies`는 정확히 `react`, `react-dom` **2개**(AC-101).
- **동결 층 데이터**: 1층 `pouchW 20`/바위 없음/호위 없음, 2층 `24`/`(2,2)(2,4)(4,2)(4,4)`/`(1,2)(1,4)`, 3층 `30`/`(3,3)(0,0)(0,6)`/`(1,2)(1,4)`. 전 층 W왕 `(1,3)`, B왕 `(5,3)`.
- **AI 16개 점수항**을 계수·부호 그대로. `rand()×6`은 `scoreAiMove(state, p, randomTerm)`로 분리해 테스트 가능하게.
- **판정 순서**: 상대 포획 → 자살 검사(원복) → superko 검사. `sweepDead`는 W 먼저 → 재계산 → B.
- **620ms 타이머**: `src/hooks/useAiTurn.ts` 한 곳에서만 생성. 콜백에서 **세대 토큰·전투 화면·W턴·`playing`** 4중 재검사, cleanup에서 `clearTimeout` + 세대 증가.
- **한국어 문자열**은 원문 그대로. 특히 `왕 주위에 두 집을 지으면 어떤 마물도 그 왕을 잡지 못한다`, `위험 — 내 왕돌이 단수에 몰렸다!`, `기회 — 적 왕돌이 단수다. 한 수면 잡는다.`, `…수를 읽는 중`, `전리품을 살핀다`, `탑 꼭대기로`, `기록을 남긴다`, `비운 채로 오른다`, `계속 오른다`, `새로 시작`, `처음부터 다시 오른다`, `등반 시작`, `한 수 쉼`, `폭발석 장전`, `새로하기`, `규칙`.
- **색 토큰 9개** 정확: `#16151c #211f29 #e3d3ae #6b5a3a #c0392b #8e2a1f #d4a938 #eae6da #8f8a7d`.
- **SVG** `viewBox="0 0 340 340"`, 빈 교차점 투명 반칸 반지름 터치영역.

---

## 4. 밸런스 충돌 — 반드시 이렇게 처리 (CONFLICT-01 / HDD-006)

원문은 한편으로 층 데이터를 **"정확한 값"** 으로 지정하고, 다른 한편으로 밸런스 목표를 벗어나면 **"호위 수·적 주머니·바위 배치를 조정하라"** 고 지시한다. **두 지시는 충돌한다.**

- 적용: **정확값 우선(동결).** 밸런스 결과를 이유로 `FLOORS`의 `pouchW`·`guardsW`·`rocks`를 **변경하지 않는다.**
- `scripts/balance.ts`는 **측정 성공 시 항상 exit 0**이며, 목표 이탈은 리포트의 `in_range: false`로만 표기한다. 목표 미달을 테스트 실패로 만들어 값을 튜닝하도록 유도하지 않는다.
- 이탈이 관측되면 `07-codex-result.md`와 `11-final-summary.md`에 **"밸런스 목표 미달성 — 후속 인간 decision gate 필요(CONFLICT-01/HDD-006)"** 를 명시한다. **성공으로 포장하지 않는다**(AGENTS §11-10).

---

## 5. 인간 승인 없이는 하지 말 것

| 항목 | 이유 |
|---|---|
| Google Fonts 등 **웹폰트 CDN 링크·폰트 파일 번들** | 외부 네트워크 의존 + 라이선스 확인 대상(AGENTS §9, OPEN-02). 지금은 `font-family: 'Noto Serif KR', 'Nanum Myeongjo', serif` 폴백 스택만 선언 |
| Playwright 등 **브라우저 자동화 도입** | 신규 의존성·네트워크 설치(OPEN-03) |
| ESLint/Prettier 도입 | 미설치. AGENTS §6.4 "명령 추측 금지" |
| 층 동결값 변경 | CONFLICT-01 / HDD-006 |
| `git commit` / `push` / `reset` / `rebase` | HDD-007, AGENTS §1 |
| `scripts/evidence/*.py`, `tests/evidence/*.py`, `AGENTS.md`, `.claude/settings.json`, `00`/`01`~`05` 증적 파일 수정 | 역할·소유권 위반 |

---

## 6. 완료 전 실행할 명령 (전부 exit 0이어야 함)

```bash
npx vitest run
npx tsc --noEmit
npx vite build
npx vite-node scripts/balance.ts
python -m unittest discover -s tests -v
python -m py_compile scripts/evidence/*.py tests/evidence/*.py
```

`npm run dev` 스모크: `npm run dev -- --port 5199 --strictPort` 실행 후 `http://127.0.0.1:5199/`가 200과 `<div id="root">`를 반환하는지 확인하고 종료(AC-108).

증적 기록:

```bash
python scripts/evidence/evidence.py capture-command --dir <prompt-dir> \
  --role implementer --name full_tests -- npx vitest run
python scripts/evidence/evidence.py snapshot --dir <prompt-dir> --stage implementation
```

---

## 7. 중단 조건 (STOP — 진행하지 말고 보고)

1. `node_modules`에 없는 패키지가 필요해졌다 → **중단, 인간 보고**(네트워크·의존성).
2. 원문 수치·규칙끼리 새로운 충돌을 발견했다 → **중단, 계획 갱신 요청**(임의 해석 금지).
3. 층 동결값을 바꿔야만 밸런스 목표를 맞출 수 있다 → **바꾸지 말고** 측정치와 함께 보고(CONFLICT-01).
4. 동일 테스트 실패가 **3회 반복**되어도 해결되지 않는다 → 루프 중단, 인간 에스컬레이션(AGENTS §3).
5. 04의 수락 기준을 만족시키려면 명세와 다른 동작이 필요하다 → **중단, 계획 결함으로 보고**.
6. 380px 실브라우저 확인이 자동화 불가하다는 사실을 우회해 "검증 완료"로 쓰고 싶어졌다 → 쓰지 말고 **인간 확인 항목으로 남긴다**(AC-824).
7. 밸런스 목표 미달을 감추고 완료 보고하고 싶어졌다 → **금지**. `FAILED`/`BLOCKED` 또는 "인간 결정 대기"로 보고한다.

---

## 8. 구현 후 인계

- `06-codex-implementation-log.md`: 단계별 **RED 출력 원문** + GREEN 파일 목록 + 실행 명령/exit code
- `07-codex-result.md`: 변경 파일 전체 목록, 필수 명령 결과, **밸런스 실측치와 `in_range` 판정**, 남은 인간 판단 항목(OPEN-01~OPEN-06)
- 구현 patch 보존 후 **fresh Claude verifier dispatch** 요청 (계획 세션과 다른 세션이어야 함, AGENTS §3-6)
