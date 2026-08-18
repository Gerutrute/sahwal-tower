# Codex 결함 수정 로그

## 작업 범위와 소유권

- 구현 주체: Hermes/Codex correction worker (`task_f9658a0813dc`, dispatch `ctx_0f4f8a8b65d3`)
- 입력 결함 보고서: `09-claude-defect-report.md` (읽기 전용, 수정하지 않음)
- 수정 대상: DEF-1 Major, DEF-3 Minor, DEF-4 Minor와 DEF-2의 지정된 고가치 회귀 누락
- 기존 dirty worktree를 보존했으며 commit, push, reset, rebase, stash, clean을 실행하지 않았다.

## Strict TDD와 재현 증거

모든 명령은 `evidence.py capture-command --role implementer`로 실행해 `codex/exec-receipts.jsonl`과 `codex/self-check/*.log`에 실제 출력과 exit code를 보존했다.

| 결함 | RED receipt | 관찰된 실패 | GREEN receipt |
|---|---|---|---|
| DEF-1 | `correction-def1-red` exit 1 | 기병→기병 창 `[draw-3, draw-4]` 대 실제 `[draw-4]`, 척후→기병 창 `[draw-2, draw-3]` 대 실제 `[draw-3, draw-4]`, 빈 창 대기 항목 미스킵의 3건 실패 | `correction-def1-green` exit 0, 10/10; 취소 승격·필드 초기화 추가 `correction-def1-cancel-green` exit 0, 13/13 |
| DEF-3 | `correction-def3-red` exit 1 | 정상 부활 전용 착수 후 W `handLimit` 5가 4로 만료되지 않음 | `correction-def3-green` exit 0, 9/9 |
| DEF-4 | `correction-def4-red` exit 1 | 기존 행 중심 간격 83.2가 문서화한 최소 96px 미달 | `correction-def4-green` exit 0, 6/6; 비율 회귀 `correction-def4-browser-green` exit 0, 6/6 |

DEF-4의 첫 실제 브라우저 재검사 `correction-mobile-green`은 행 좌표 확대 뒤에도 노드가 겹쳐 exit 1이었다. 이 RED로 CSS `aspect-ratio`가 `height / width`로 역전되어 실제 그래프 높이를 압축함을 확인했고, `width / height`로 수정한 뒤 `correction-mobile-final`이 exit 0과 `passed: true`를 기록했다.

## 구현 내용

### DEF-1 — 대기 상호작용 승격

- `src/game/GameProvider.tsx`에 현재 `battle.decks.B`로 대기 head를 다시 만드는 `refreshInspection`과 FIFO 승격 루프를 추가했다.
- scout는 `inspected`, `orderedIds`, `takenCardId`, `returnedCardId`를 재생성하고 cavalry는 `inspected`, `takenCardId`, `discardedCardId`를 재생성한다.
- 확인과 취소가 같은 승격 경로를 사용한다. 창이 0장이면 FIFO 순서대로 건너뛰며, 연쇄가 소진될 때 누적된 `endsTurnOnResolve` 의미에 따라 정확히 한 번 턴을 끝낸다.
- 두 기병 연쇄, 시작 덱으로 도달 가능한 척후→기병 연쇄, 빈 창 자동 스킵, 취소 뒤 현재 창 재계산과 staged field 초기화를 테스트했다.

### DEF-3 — 부활 턴의 임시 패 한도 만료

- `performRevivalSpecialMove`가 실제 W 전용 턴을 완료할 때 `expireTemporaryHandLimits(state.decks.W)`를 공통 적용한다.
- 정상 착수, 수호 토큰에 의한 포획 무효화, 후보 없음 자동 패스 세 경로를 한 회귀 테스트에서 검증했다.

### DEF-4 — 그래프 비겹침과 380px 폭

- 지도 행 중심의 최소 간격을 `MAP_NODE_MIN_VERTICAL_SPACING = 96`으로 문서화하고 viewBox 높이를 행 수에 맞춰 576으로 확장했다. 폭은 356으로 유지해 380 이하 계약을 보존했다.
- CSS `aspect-ratio` 전달값을 `356 / 576`으로 바로잡아 실제 렌더 높이도 viewBox와 같은 방향으로 확장했다.
- 단위 테스트는 모든 인접 행이 최소 96을 확보하는지 검증한다. 모바일 검사는 380px에서 막 시작과 첫 완료 뒤 모든 실제 `.map-node` 사각형의 비겹침 및 html/body 무가로스크롤을 검증한다.

### DEF-2 — 고가치 전용 assert

- W 장군석의 보충+추가 드로우 대칭성과 초과 손패의 다음 자기 착수 자연 수렴
- 잘못된 척후 `returnedCardId`, 불완전 순열, 잘못된 기병 take/discard의 `RangeError`
- 보호·비보호 혼합 포획 전체 무효화와 선택되지 않은 보호 토큰 보존
- 상호작용 패널 중 손패·패스·기권 `canAct` 비활성화
- 완료 이력에서 이전 노드는 `done`, 마지막 노드는 `current`

`correction-def2-focused`는 5파일 36/36, `correction-focused-green`은 7파일 47/47로 통과했다.

## 최종 검증 receipt

| receipt | 실제 결과 |
|---|---|
| `correction-full-tests-final-r2` | exit 0, 42 files / 221 tests passed |
| `correction-typecheck-final-r2` | exit 0, `tsc --noEmit` |
| `correction-build-final` | exit 0, 57 modules transformed, production build 완료 |
| `correction-mobile-final` | exit 0, `passed: true`, 380px 지도 비겹침·무가로스크롤, console/page/request/bad-response 오류 0 |
| `correction-scoped-diff-check` | exit 0 |

첫 `correction-mobile` exit 1은 preview 서버가 없어 발생한 `ERR_CONNECTION_REFUSED` 인프라 실패이며, 숨김 없이 receipt를 보존했다. 이후 로컬 preview를 명시적으로 기동해 실제 브라우저 RED와 최종 GREEN을 얻고 서버를 종료했다.

전체 worktree `git diff --check`인 `correction-diff-check`는 이번 범위 밖의 기존 `logs/2026-08-17/.../diff/10-codex-implementation.patch` 내 trailing whitespace 때문에 exit 2였다. 해당 과거 증적은 수정하지 않았고, 이번에 수정한 추적 파일만 대상으로 한 `correction-scoped-diff-check`는 exit 0이다.

## 변경 파일

프로덕션/검사:

- `src/game/GameProvider.tsx`
- `src/game/battle.ts`
- `src/game/mapLayout.ts`
- `src/components/MapGraph.tsx`
- `scripts/playwright-mobile-check.mjs`

테스트:

- `tests/battle.product-effects.test.ts`
- `tests/battle.revival.test.ts`
- `tests/battle.protection.test.ts`
- `tests/stones.test.ts`
- `tests/map.graph.test.ts`
- `tests/ui.map.graph.test.tsx`
- `tests/ui.battle.test.tsx`

증적:

- `10-codex-fix-log.md`
- `manifest.json`의 `after-fix` snapshot
- `diff/30-after-fix.patch`, `diff/40-fix-only.patch`
- `codex/exec-receipts.jsonl`, `codex/self-check/correction-*.log`

최종 after-fix source tree hash는 `7f3f17fed42a8a8ff758a11bfaf43629bdcebb62`다.

## 남은 단계와 알려진 비차단 항목

- fresh Claude verifier가 새 Task/Dispatch에서 09 결함과 수락 기준을 독립 검증해야 한다.
- 검증 전후 tree 불변성, post-verify, finalize, checksum 검증은 coordinator의 다음 단계다.
- 전체 Vitest는 exit 0이지만 기존 React 테스트의 비차단 `act(...)` 경고가 stderr에 남아 있다.
- 지도 문구·간격의 체감 품질과 게임 밸런스는 사람의 최종 판단 대상이다.
