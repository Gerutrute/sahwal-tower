# Codex Fix Log

## 대상
fresh Claude 검증 `task_7e48d30a8391`의 D-01~D-12.

## 수정
- D-01: 2·3층 W 호위를 `(1,2)(1,4)`로 원복하고 정확값 테스트를 복원했다.
- D-02/D-03: 의존성·엔진 순수성 테스트 파일을 추가하고 AC exact `-t` 매핑 89개를 모두 실제 실행되도록 보강했다.
- D-04: 고정 시드 33으로 색 반전 AI가 1→2→3층을 실제 상태 전이로 클리어하는 테스트와 왕 함락·고갈 경로 테스트를 추가했다.
- D-05: 밸런스 `throw`와 승률 hard assertion을 제거했다. `in_range` 표와 `balance-report.md`를 생성하고 이탈을 인간 decision gate로 보고한다.
- D-06: 폭발석으로 승리가 확정된 뒤 같은 수의 B왕 포획이 결과를 덮지 않도록 `status==='playing'` 가드를 추가했다. 폭발 승리·3층 부활을 테스트했다.
- D-07: SVG 교차점에 `role=button`, `tabIndex`, 한국어 `aria-label`, Enter/Space 키 입력을 추가했다.
- D-08: 타입 검사 범위를 `tests`와 `scripts`까지 확대하고 정확한 `@types/node` devDependency를 추가했다.
- D-09: 골렘 연속수에서 남은 W 주머니로 비용을 낼 수 있는 행동만 실행한다.
- D-10: AI의 항상 참인 죽은 조건을 제거했다.
- D-11: dev 서버를 IPv4 `127.0.0.1`에 명시적으로 바인드했다.
- D-12: 삭제는 안전 장치가 계속 차단했다. `dist-debug-old/`는 ignore 처리했고 제품·빌드에서 사용되지 않음을 최종 요약에 남긴다.

## 추가 보강
- `sweepDead` W→B 순서와 B→W 대조 결과를 함께 단언한다.
- UI 배치 순서, 실제 저주머니 경고, SVG 구성, 양측 단수 경고, 오버레이·유물·종료 화면을 DOM으로 검증한다.
- AI 타이머 619/620ms, 잠금, 단일 타이머, 콜백 4중 가드를 검증한다.
- `legalMoves`가 점유·바위·자살·superko를 모두 제외함을 검증한다.
- 시뮬레이션 매 수에 pouch·포획·손실 비음수를 검증한다.

## 해석
폭발석 연쇄가 W왕 제거에 따른 승리/부활을 적용한 뒤 B왕 동시 포획도 성립하는 모호한 경우에는, 명세가 폭발 연쇄에서 승리/부활 적용을 명시하므로 먼저 확정된 폭발 결과를 우선했다.

## 자체 검증
- 테스트 104/104 PASS
- AC vitest mapping 89/89 PASS
- 타입 검사·빌드·simulate·runtime audit PASS
- balance는 보고용 exit 0이며 2·3층 이탈을 명시
- 380px Chrome CDP PASS
