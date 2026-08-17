# 11 — Final Summary: 사활(死活)의 탑

## 최종 결과
「사활의 탑」의 Vite + React 18 + TypeScript 구현과 독립 검증을 완료했다. 제품·테스트 기준 최종 판정은 **PASS — blocking 0 / high 0 / medium 0**이다.

저장소 `AGENTS.md`의 역할 거버넌스를 우선 적용했기 때문에, 사용자의 일반적인 Claude 구현 선호와 달리 이번 실행에서는 Claude Code가 읽기 전용 계획·수락 기준·독립 검증을 맡고 Hermes/Codex가 제품 코드 구현과 결함 수정을 맡았다. Claude가 제품 파일을 수정하지 않았고, 구현과 검증 역할의 증적이 분리돼 있다.

## 구현 범위
- UI 의존 없는 순수 함수 엔진 `src/engine.ts`
- 7×7 포획·자살수 금지·positional superko·바위·W 선행 `sweepDead`
- 돌 주머니 경제, 왕 함락·돌 고갈·왕 포획·탈진 승패
- 침입귀·골렘 2연타·불사왕 1회 부활
- 유물 6종과 폭발석 연쇄
- 명세 계수의 1수 앞 AI
- 타이틀→전투→유물→3층 클리어/패배 전체 흐름
- 한국어 모바일 우선 UI, 380px 터치, 키보드 교차점 착수, reduced-motion
- 시뮬레이션·색 반전 AI 밸런스·AC 매핑 하니스

## 최종 자동 검증
- `npm test`: **14 files / 104 tests PASS**
- `npm run typecheck`: PASS (`src`, `tests`, `scripts` 포함)
- `npm run build`: PASS, 34 modules, `dist/index.html` 생성
- AC exact vitest mapping: **89/89 실제 테스트 실행 PASS**
- `npm run simulate`: 층별 3회, 400수 이내 종료, 음수 자원 없음
- `npm audit --omit=dev --audit-level=high`: **found 0 vulnerabilities**
- `npm run dev`: IPv4 `127.0.0.1` 바인드 및 HTTP 200, root 확인
- 증적 도구 회귀: Python 22/22 PASS, py_compile PASS, hook self-test PASS

## 실제 브라우저 자동 실측
Chrome headless CDP에서 viewport 380×800로 실행했다.

- `innerWidth=380`
- `documentElement.scrollWidth=380`
- `body.scrollWidth=380`
- SVG viewBox `0 0 340 340`
- 버튼 높이 45.375px
- 빈 교차점 hit radius 25
- 터치 착수 후 흑돌 2개
- 800ms 후 백돌 2개, 상태 `당신의 차례다.`

따라서 자동 실측상 380px 가로 overflow, 터치 목표 크기, 착수와 AI 지연 응답은 통과했다. 다만 AC-824는 HUMAN 항목이므로 **각 화면의 실제 시각 인상·스크린샷·사람 손 터치 확인은 인간 미확인 상태**로 남긴다.

## fresh Claude 독립 재검증
- 1차 fresh verifier가 blocking 3 / high 2 / medium 3 / low 4를 보고했다.
- Hermes/Codex가 D-01~D-11을 수정했다.
- 2차 fresh verifier `task_0a823409843f` / `ctx_27b2231ff358`가 현재 tree를 읽기 전용으로 재검증했다.
- 최종 판정: **PASS — blocking 0 / high 0 / medium 0**
- `verify-before` = `verify-after` = `cfa7d5750c073ef8e9dee933a13000a41d2e240c`
- `verifier_tree_unchanged=true`

## 밸런스 decision gate
**밸런스 목표 미달성 — 인간 결정 필요(CONFLICT-01/HDD-006).**

명세의 확정 층 데이터를 그대로 동결한 12회 측정:

| 층 | 승리 | 승률 | 목표 | in_range |
|---|---:|---:|---:|---|
| 1층 | 12/12 | 100.0% | 100% | true |
| 2층 | 2/12 | 16.7% | 40~60% | false |
| 3층 | 0/12 | 0.0% | 15~30% | false |

12회 결과는 보고용이며 자동 실패·자동 튜닝 근거가 아니다. 1차 verifier의 200회 참고 측정에서는 2층 40.0%, 3층 4.0%였으므로 2층은 표본 크기에 따라 판단이 달라진다. 적 주머니·바위·호위를 조정할지, 시행 수나 목표치를 바꿀지는 인간 결정 전까지 적용하지 않는다.

## 남은 low 권고 및 인간 검수
- `soul` 테스트에 n=3 → +2 회귀 케이스 추가 권고(현재 동작은 독립 실측 정상)
- 부활 점수 테스트에 `reviveScore`를 참조하지 않는 손계산 상수 케이스 추가 권고
- AI 최대점·클릭 요소 전수 접근성 테스트 강화 권고
- 난이도·재미·시각 인상·모션 체감은 인간 검수 필요
- `Noto Serif KR` 미설치 환경의 fallback 인상은 인간 확인 필요

이 권고들은 현재 명세 동작 위반이 아니며 독립 verifier의 완료 게이트를 막지 않는다.

## 잔여 빌드 산출물
`dist-debug-old/`는 이전 문제 빌드의 산출물이다. 사용자가 삭제를 명시 승인했지만 실행 안전 장치가 반복적으로 삭제를 차단해 남아 있다. `.gitignore` 대상이며 source tree hash, 제품, Vite 빌드 경로에서 참조되지 않는다. 최신 정상 빌드는 `dist/`다.

검증 중 남은 Vite/Chrome 프로세스와 5173·5199 포트 점유는 최종 정리했다.

## 저장소 상태
커밋·푸시·브랜치 변경은 수행하지 않았다.
