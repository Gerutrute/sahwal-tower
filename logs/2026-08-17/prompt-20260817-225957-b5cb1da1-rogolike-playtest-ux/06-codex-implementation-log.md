# 06 — Codex 구현 로그 (RoGolike 플레이테스트 UX 개선)

- 구현자: Hermes/Codex (`task_1a4cf18fef00` / `ctx_0fe456e7aa5b`)
- 작업 브랜치/위치: `dev`, canonical worktree `D:\개인 pjt\codex 게임 해커톤`
- 정책: commit/push/reset/rebase/revert 및 신규 의존성 추가 없음
- 동결 게이트: `plan-frozen`, `pre-implement` 모두 exit 0 확인 후 구현 시작

## Strict vertical TDD 실행

각 슬라이스에서 신규 계약 테스트를 먼저 작성하고 `capture-command`로 구현 부재에 따른 RED(exit 1)를 보존한 뒤 최소 구현과 GREEN(exit 0)을 진행했다.

| 슬라이스 | RED receipt | GREEN receipt | 구현 요약 |
|---|---|---|---|
| V1 점유 과반 | `red-v1-majority` | `green-v1-majority` | 돌 개수 `ceil(points/2)` 판정, 플레이어·AI·부활 착수 직후 종료, 기존 부활/보상 정산 재사용, 점유 UI |
| V2 pre-move | `red-v2-premove` | `green-v2-premove` | 빈 인벤토리 자동 건너뛰기, 선택형 pre-move에서 카드 직접 선택 |
| V3 1탭 | `red-v3-onetap` | `green-v3-onetap` | GameState/Board 미리보기 제거, 한 번의 좌표 입력으로 확정, 기존 테스트·스크립트 흐름 갱신 |
| V4 지도 엔진 | `red-v4-map` | `green-v4-map` | `selectableNodeIds`, reducer OPEN_NODE 게이트, 전투 승리/비전투 방문 완료, 막/재시작 초기화 |
| V4 지도 UI | `red-v4-ui-map` | `green-v4-ui-map` | 열 구조, `done/open/locked`, disabled 잠금, 무제한 여정 시설 제거 |
| V5 카드 계약 | `red-v5-presentation` | `green-v5-presentation` | 6병종 한국어 요약·조건·전략, 고유 클래스·문양 |
| V5 카드 UI | `red-v5-card-ui` | `green-v5-card-ui` | 내부 enum/ID 제거, 상세 패널, 효과 상태 배너, 보상·상점 정의 이름 |
| V5 AI 효과 | `red-v5-ai-effects` | `green-v5-ai-effects` | 배치 효과 예측, 필수 주입 `aiEffectWeight`, 포획+효과 결정론 평가 |
| V6 오디오 | `red-v6-audio` | `green-v6-audio` | pending resume 비대기, WebAudio 실제 start, fallback, 5상태/오류/재시도 |
| V6 오디오 UI | `red-v6-audio-ui` | `green-v6-audio-ui` | 오류 상태 재시도 버튼과 기존 라벨·음소거 유지 |

초기 `green-v1-majority` 1회는 포획 fixture의 흑 돌 수가 24가 아닌 23이었던 테스트 데이터 결함으로 실패했고 fixture를 바로잡은 뒤 동일 계약 전체가 exit 0이 됐다. 초기 `green-v6-audio` 1회는 Node 테스트 환경에서 `window.setTimeout`이 없어 정상 WebAudio start 뒤 fallback으로 떨어지는 교차 환경 결함을 드러냈고, `globalThis` 타이머로 수정한 뒤 13개 오디오 테스트가 exit 0이 됐다.

V4/V5/V6 일부 독립 RED 명령을 동시에 실행하면서 `exec-receipts.jsonl`과 각 RED/GREEN 로그는 모두 정상 보존됐지만, 당시 manifest read-modify-write가 경합해 6개 verification key가 빠졌다. 구현 종료 시 실제 receipt의 argv/exit/log를 대조해 누락된 `red-v4-map`, `green-v4-map`, `green-v5-presentation`, `red-v5-ai-effects`, `green-v5-ai-effects`, `red-v6-audio` 항목을 manifest에 정확히 복원했다.

## 주요 변경 파일

- 엔진/상태: `src/game/battle.ts`, `src/game/GameProvider.tsx`, `src/game/map.ts`, `src/game/content/stones.ts`
- UI/스타일: `src/App.tsx`, `src/components/BoardSvg.tsx`, `src/components/AudioControls.tsx`, `src/styles.css`
- 오디오: `src/audio/AudioManager.ts`, `src/audio/useGameMusic.ts`
- 제품 검증: `scripts/playwright-mobile-check.mjs`, `tests/fixtures/draft-game-config.ts`
- 신규 계약 테스트: `tests/battle.majority.test.ts`, `tests/battle.premove.test.ts`, `tests/ui.onetap.test.tsx`, `tests/map.progression.test.ts`, `tests/ui.map.progression.test.tsx`, `tests/stones.presentation.test.ts`, `tests/ui.card-clarity.test.tsx`, `tests/ai.effects.test.ts`, `tests/ui.audio-status.test.tsx`
- 갱신 회귀 테스트: `tests/audio.manager.test.ts`, `tests/battle.product-effects.test.ts`, `tests/ui.battle.test.tsx`, `tests/ui.board.test.tsx`, `tests/ui.game.test.tsx`

## V7 필수 게이트

`evidence.config.json`과 동일한 argv로 모두 implementer receipt를 보존했다.

| receipt | 명령 | 결과 |
|---|---|---|
| `full-tests` | `npm.cmd test` | exit 0, 36 files / 188 tests passed |
| `typecheck` | `npm.cmd run typecheck` | exit 0 |
| `build` | `npm.cmd run build` | exit 0 |
| `benchmark-ai` | `npm.cmd run benchmark:ai` | exit 0, 7×7/9×9 candidate count 일치 |
| `runtime-audit` | `npm.cmd audit --omit=dev --audit-level=high` | exit 0, 0 vulnerabilities |
| `mobile-check` | `npm.cmd run check:mobile` | exit 0 |

모바일 게이트는 시작 시 잠긴 보스 클릭 무효, `data-state="open"` 경로 완주, 1회 탭 착수, 1막 부활 2단계, 2막 9×9, 42×42 비중첩 터치 타깃을 검증했다. 첫 gesture 뒤 오디오 audit은 이번 실행에서 WebAudio 대신 자동 fallback으로 `HTMLMediaElement.play()` 1회를 실제 관측했으며, `BufferSource.start >= 1 || fallback play >= 1` 계약을 충족했다.

## 구현 snapshot

- `python scripts/evidence/evidence.py snapshot --dir <prompt-dir> --stage implementation`
- source tree hash: `bc2da5dc9aba316a344740d0f116299846f75646`
