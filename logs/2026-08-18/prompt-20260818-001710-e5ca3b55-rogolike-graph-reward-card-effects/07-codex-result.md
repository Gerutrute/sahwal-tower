# Codex 구현 결과

## 상태

**IMPLEMENTED — fresh Claude verifier 인계 준비 완료**

동결된 T1-T10과 AC 계약을 Hermes/Codex가 구현했다. 각 수직 slice는 focused test를 먼저 추가해 동작 RED를 기록하고 최소 구현으로 GREEN을 만든 뒤 회귀 검사를 실행했다.

## 결과 요약

- SVG next-edge 지도와 실제 진행 상태, 현재 노드 강조를 구현했다.
- 5개 기본 돌 + 5개 특수 돌 시작 덱과 부적/유물 UI를 구현했다.
- 보상 상세의 hover/focus/mobile tap-first-expand, 명시적 선택, 6개 상세 필드/개수 계약을 구현했다.
- 정찰병 3장 원자 교환, 장군 post-refill 추가 드로우, 기병 2장 교환·bottom cycle, 수호자 전체 수 포획 무효화·표식, 희생석 한도 만료를 구현했다.
- 종류별 주입 AI 가중치와 수호자 보호 인식, 문서 및 모바일 검사를 갱신했다.
- 구 심볼을 제거했고 go 규칙 시그니처와 런타임 의존성은 유지했다.

## 검증 결과

- Vitest: 42 files, 213 tests, exit 0
- TypeScript typecheck: exit 0
- production build: exit 0
- AI benchmark: exit 0
- production dependency audit: exit 0, 취약점 0건
- mobile Playwright check: exit 0, `passed: true`
- Python evidence tests: 23 tests, exit 0
- AC mapping: 27/27, exit 0
- 금지 구 심볼 negative grep: 결과 0건(계약상 기대한 grep exit 1)

상세 RED/GREEN receipt와 명령 출력은 `06-codex-implementation-log.md`, `codex/exec-receipts.jsonl`, `codex/self-check/`에 있다.

## 남은 게이트와 위험

- 이전 planner와 다른 fresh Claude verifier가 AC를 1:1로 독립 검증해야 한다.
- verify-before/verify-after tree 불변성, post-verify, finalize, checksum 검증은 아직 완료되지 않았다.
- 장군의 일시 손패 한도 초과 해석, 특수 돌/AI 밸런스, 문구·시각·모바일 체감은 인간 최종 판단 항목이다.
- 비차단 React `act(...)` 경고가 전체 테스트 로그에 남아 있다.
