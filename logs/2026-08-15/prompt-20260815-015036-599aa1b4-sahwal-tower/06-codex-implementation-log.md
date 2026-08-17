# Codex Implementation Log

## 역할
- 구현자·결함 수정자: Hermes/Codex
- Claude Code는 제품 파일을 수정하지 않고 계획 산출물(02~05) 및 읽기 전용 독립 검증(08~09)만 수행했다.

## 구현 순서
1. 엔진 규칙 테스트를 먼저 작성해 missing module RED를 확인했다.
2. `src/engine.ts`에 7×7 보드, 그룹·활로, 포획·자살·positional superko, `sweepDead`를 순수 함수로 구현하고 GREEN을 확인했다.
3. 주머니 경제·왕 승패·층 데이터·골렘 연속수·불사왕 부활·AI·유물·폭발 연쇄 테스트를 먼저 추가한 뒤 엔진 상태 전이를 구현했다.
4. 타이틀/전투/유물/종료/모달/AI 타이머 UI 테스트를 RED로 만든 뒤 React UI와 SVG 바둑판, 모바일 CSS를 구현했다.
5. 무작위 시뮬레이션과 색 반전 AI 밸런스 하니스를 구현했다.
6. 최초 구현에서 12회 밸런스 목표를 hard gate로 오해해 2·3층 W 호위 `(1,2)`를 제거했으나, fresh Claude 검증에서 HDD-006 위반으로 판정됐다.
7. 결함 수정에서 2·3층 호위를 모두 `(1,2)(1,4)` 확정값으로 원복하고, 밸런스 하니스를 자동 튜닝·hard gate가 아닌 측정·보고 도구로 바꿨다.
8. 380px headless Chrome CDP 검사에서 `scrollWidth=380`, 모든 버튼 높이 ≥44px, SVG viewBox와 터치 착수·620ms AI 응답을 확인했다.
9. Windows의 한글 경로에서 Vite가 기존 `dist`를 비우는 단계에 exit 127로 종료되는 현상을 격리했다. `scripts/clean-dist.mjs`로 저장소 루트의 정확한 `dist`만 빌드 전에 정리하며 반복 빌드 통과를 확인했다.

## 주요 산출물
- `src/engine.ts`: UI 의존 없는 순수 게임 엔진
- `src/App.tsx`, `src/components/BoardSvg.tsx`, `src/hooks/useAiTurn.ts`, `src/styles.css`: 전체 화면 흐름과 모바일 UI
- `tests/*.test.ts(x)`: 규칙·경제·층·부활·AI·유물·런·UI·타이머·순수성·의존성·시뮬레이션·밸런스 104개 테스트
- `scripts/balance.ts`, `scripts/simulate.ts`, `scripts/check-mobile.mjs`, `scripts/check-ac-mapping.mjs`: 실행형 검증 하니스

## 구현자 자체 검증
- `npm test`: 14 files, 104 tests PASS
- `npm run typecheck`: PASS (`src`, `tests`, `scripts` 포함)
- `npm run build`: PASS
- AC vitest exact mapping: 89/89 명령에서 실제 테스트 ≥1개 실행·PASS
- `npm run balance`: 1층 12/12(100%, in_range=true), 2층 2/12(16.7%, false), 3층 0/12(0%, false); report 생성
- `npm run simulate`: 층별 3회, 400수 이내 종료, 음수 자원 없음
- `npm audit --omit=dev --audit-level=high`: runtime 취약점 0
- `npm run dev -- --port 5199 --strictPort`: IPv4 `127.0.0.1` HTTP 200 및 root 확인
- 380px Chrome CDP: overflow 없음, 버튼 45.375px, hit radius 25, 터치 수 입력·AI 응답 PASS
