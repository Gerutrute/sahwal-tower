# 08 — Claude 독립 검증 보고서 (RoGolike 플레이테스트 UX 개선)

- 작성자: fresh Claude Code verifier (Orca dispatch `task_dab3f8fa9aa6` / `ctx_8e5ac0b0a3bc`, 계획·구현 세션과 무관한 독립 세션)
- 검증 대상 snapshot: `bc2da5dc9aba316a344740d0f116299846f75646` (manifest `implementation` = `verify-before`)
- 기준 문서: `02-claude-requirements-analysis.md`, `03-claude-implementation-plan.md`, `04-claude-acceptance-criteria.md`(AC-01~30, AC-P1~P6), `AGENTS.md`
- 검증 방식: 제품/테스트/스크립트 소스 무수정(읽기 전용). 필수 명령 전부 직접 재실행하고 `evidence.py capture-command --role verifier`로 receipt/log 보존. 구현 diff(`diff/10-codex-implementation.patch`, 26개 파일, +1186/−198) 전량 검토.

## 1. 판정 요약

**PASS — Blocking 0건, Major 0건, Minor 0건.** AC-01~30과 AC-P1~P6 전부 충족을 확인했다. `09-claude-defect-report.md`는 작성하지 않는다(결함 없음). §6의 운영 참고와 인간 판단 항목은 결함이 아니라 보고 사항이다.

## 2. Verifier 직접 재실행 결과 (AC-P1)

모든 명령은 `verification/commands.jsonl` receipt와 `verification/*.log`로 보존했고, argv는 `evidence.config.json`의 exact argv와 일치한다.

| receipt 이름 | 명령 | 결과 |
|---|---|---|
| `verifier-full-tests` | `npm.cmd test` | exit 0 — **36 파일 / 188 테스트 전부 통과, 실패 0** |
| `verifier-typecheck` | `npm.cmd run typecheck` | exit 0 |
| `verifier-build` | `npm.cmd run build` | exit 0 (vite build 3.65s) |
| `verifier-benchmark-ai` | `npm.cmd run benchmark:ai` | exit 0 |
| `verifier-runtime-audit` | `npm.cmd audit --omit=dev --audit-level=high` | exit 0, `found 0 vulnerabilities` |
| `verifier-mobile-check` | `npm.cmd run check:mobile` | exit 0, `"passed": true`, consoleErrors/pageErrors/requestFailures 전부 빈 배열 |
| `verifier-focused-ac` (추가) | `npm.cmd test -- --run` AC 지정 14개 파일 | exit 0 — 14 파일 / 64 테스트 전부 통과 |

focused 묶음에 포함한 파일: `battle.majority`, `battle.premove`, `ui.onetap`, `map.progression`, `ui.map.progression`, `stones.presentation`, `ui.card-clarity`, `ai.effects`, `audio.manager`, `ui.audio-status` + 회귀 `battle.flow`, `go.scoring`, `ui.battle`, `audio.routing`.

## 3. 기능 AC 검증 (AC-01~30)

### 대국 종료 — 점유 과반 (AC-01~06) ✅

- AC-01: `src/game/battle.ts` `stoneMajorityWinner`는 판 위 B/W **돌 개수만** 세고 기준은 `Math.ceil(board.points.length / 2)`(7×7=25, 9×9=41). `scoreArea`·덤·포획 수 미사용을 소스로 확인. 테스트가 24→null·25→'B'·백25→'W'·9×9 40/41 경계를 검증.
- AC-02: 빈 판 첫 착수 비종료 테스트 통과(영역 계가 배제 보증).
- AC-03: 판정 계기는 `PLAY_CARD` 성공 분기(포획 제거가 반영된 `play.board`)와 `performRevivalSpecialMove` 착수 분기뿐. `PASS` 경로에는 판정이 없음을 소스와 테스트(비정상 주입 판면에서 패스 비종료)로 확인. 플레이어(`commitMove`→`PLAY_CARD`), AI(`performAiTurn` `GameProvider.tsx:613`→`PLAY_CARD`), 부활 착수 세 경로 모두 reducer를 경유하므로 판정이 일관 적용된다.
- AC-04: 흑 도달 → `resolveBattleOutcome` 경유 `stage-win`+`rewardStatus:'available'`, 부활 적이면 `revival-special-move`/`revivalStage:2`/`withheld`, 백 도달 → `run-loss` — 전부 테스트 통과.
- AC-05: 종료 사유 로그(`'…돌 점유 과반에 도달했습니다.'`, `type:'result'`) 기록 확인. 전투 화면 상시 표시 `점유 흑 n · 백 m / t`(`src/App.tsx` battle-stats) — `ui.battle` 테스트가 `점유 흑 0 · 백 0 / 25` 문자열을 검증.
- AC-06: 연속 패스 2회→면적 계가·기권 경로 회귀 — `battle.flow`/`go.scoring` 통과.

### 지도 진행 (AC-07~12) ✅

- AC-07/08: `src/game/map.ts` `selectableNodeIds` — 완료 목록이 비면 `map.starts`, 아니면 **마지막 완료 노드의 `next`만** 반환. 보스는 `next`가 보스인 노드(4번째 열) 완료 후에만 열림 — `map.progression` 테스트 통과.
- AC-09: 이중 방어 확인 — reducer `openNode`가 잠긴 노드에 `'아직 이어지지 않은 길입니다.'` notice만 반환(화면·전투 불변, 테스트 검증), UI는 `data-state="locked"` + `disabled`(`ui.map.progression` 테스트 검증).
- AC-10: 전투/정예/보스는 `completeRunBattle`의 `resolution === 'win'` 분기에서만 `completedNodeIds`에 추가. 비전투 노드는 `openNode` 진입 시 완료 — 테스트 통과.
- AC-11: 보상 수령/거절 후 진행 보존, 보스 승리 → 다음 막에서 `completedNodeIds: []` 초기화, `RESTART` 초기화 — 테스트 통과.
- AC-12: MapScreen "여정 시설" 섹션(무제한 OPEN_SHOP/EVENT/DOJO) 제거를 `src/App.tsx` 소스와 `aria-label="여정 시설"` null 단언 테스트로 확인. 시설 진입은 지도 노드 경유만 가능.

### 착수 흐름 (AC-13~18) ✅

- AC-13: `commitMove`(구 `previewOrCommit` 대체)가 카드 선택 후 합법 좌표 **1클릭에서 즉시 확정**(돌 배치·카드 소비·턴 진행) — `ui.onetap` 3개 테스트 통과. 재확인 단계 부재.
- AC-14: 점유/자충수/단순패/효과 한도 초과는 착수 없이 `invalidReason`만 표시, 이후 합법 클릭 정상 확정 — 테스트 통과.
- AC-15: `GameState.preview`, `MovePreview`, BoardSvg `previewPoint`, `.preview-stone` CSS, "합법 수 미리보기" 문구 전부 소스에서 제거됨을 grep으로 확인. 남은 `previewState`(`src/game/effects.ts`)는 효과 dry-run 검증 엔진의 기존 내부 명칭으로 R-TAP-02가 유지를 요구하는 검증 경로다(죽은 코드 아님). typecheck exit 0.
- AC-16: `BEGIN_TURN`에서 `charms[turn]`·`relics[turn]` 모두 비면 `choose-card` 직행(`battle.ts:456` 부근). 시작 덱 런 전투 화면에 "착수로 진행" 버튼 미표시 — `ui.battle` 단언 통과.
- AC-17: 부적/유물 보유 턴은 `pre-move` 진입, `SELECT_CARD`가 `pre-move`에서도 합법으로 즉시 `choose-point` 전이, `USE_CHARM` 후에도 확인 없이 선택 가능 — `battle.premove` 통과.
- AC-18: 합법 수 없음 자동 패스(`hasLegalCardMove`) 유지 — 테스트 통과.

### 카드 명시성 (AC-19~23) ✅

- AC-19: 6개 병종 전부 한국어 `ui.summary/condition/strategy` 비어 있지 않음. 수치가 승인 문서 `docs/03_content/01_특수돌.md` MVP 서술과 일치함을 교차 확인(척후 2장 확인·재정렬, 장군 5냥, 기병 1장, 수호 활로 2 이하·2장, 희생 패 한도 +1) — `stones.presentation` 통과.
- AC-20: 렌더된 화면에 trigger enum 5종·`STONE-00n` 원시 ID 부재 — `ui.card-clarity` 정규식 단언 통과.
- AC-21: `data-stone-class` 6종(`basic/scout/general/cavalry/guardian/sacrifice`) 상호 상이 + `card-icon` 문양(基/斥/將/騎/守/犧, 6종 상이) + 병종별 `--stone-accent` 색 CSS. 카드 선택 시 "선택 카드 상세" 패널에 발동 조건·전략 표시 — 테스트 통과.
- AC-22: 효과 발동 시 병종명 포함 `role="status"` 배너(`effect-status`) — 척후석 착수 케이스 테스트 통과.
- AC-23: 보상/상점/부적 교체 화면이 `CHARM_DEFINITIONS`/`RELIC_DEFINITIONS` 이름 표시, `ITEM-`/`RELIC-` 원시 ID 부재 단언 통과.

### 전략적 덱 플레이 (AC-24~26) ✅

- AC-24: 병종 정체성 보존 — `stones`, `battle.product-effects`, `effects.queue` 전부 통과(전체 스위트 내). 효과 정체성 변경·신규 병종 없음(diff 확인).
- AC-25: `candidatePlacementTriggersEffect` 순수 함수(척후=항상, 장군=포획 시, 수호=위험 아군 인접 시, 기병·희생=예측 제외 — P-08 그대로) + `ai.effects` 테스트: 양수 가중치에서 척후 선호, 가중치 0에서 기존 선택과 결정론적 동일.
- AC-26: `GameConfig.aiEffectWeight` 필수 필드, `assertConfig` numeric finite 목록 포함(`GameProvider.tsx:154`), 제품 소스에 `??` fallback 수치 없음(grep 확인 — 주입값 2는 테스트 fixture와 mobile-check 주입 config에만 존재).

### 음악 (AC-27~30) ✅

- AC-27: `unlock()`이 `await this.context.resume()` 대신 `void this.context.resume().catch(...)`로 변경되어 resume promise가 영원히 pending이어도 `switchWebAudio`(fetch→decode→`source.start`)가 진행 — 미해결 resume 하에 start 카운터 ≥1 테스트 통과.
- AC-28: **첫 gesture 후 실제 재생 신호 확인.** 단위 테스트에서 WebAudio `source.start` 발생, fetch 실패 시 `switchFallback` 자동 시도 + `audio.play()` 호출 검증. 모바일 게이트 실측: gesture 전 `{contexts:0, plays:0, starts:0}`(**pre-gesture context 미생성**), 등반 시작 클릭 후 `{contexts:1, plays:1, starts:0}` — headless Chromium에서는 WebAudio 디코드가 실패해 설계된 fallback `HTMLAudioElement.play()`가 실제 발동했다. "start ≥ 1 **또는** fallback play" 기준 충족이며 스크립트는 `starts + plays > 0`을 명시적으로 강제한다.
- AC-29: 실패 비은닉 — `reportError`가 `onError` 전달 + `snapshot().playback`(`idle/pending/web-audio/fallback/error`) + `lastError` 노출. WebAudio·fallback 동시 실패 시 `error` 상태와 원인 문자열 테스트 통과.
- AC-30: `playback==='error'`에서 AudioControls가 "음악 다시 시도" 버튼 렌더, 재시도 unlock이 재로드 유발(fetcher 2회 호출 테스트). 트랙 라벨·음소거·gesture 전 context 미생성·AudioTuning 주입 강제 회귀 — `ui.audio-status`/`audio.manager`/`audio.routing` 전부 통과.

## 4. 프로세스·불변 조건 (AC-P1~P6)

| ID | 결과 | 증거 |
|---|---|---|
| AC-P1 | ✅ | §2 — 6개 필수 명령 전부 exit 0, receipt argv가 `evidence.config.json`과 일치 |
| AC-P2 | ✅ | `git diff 7835c339..bc2da5dc -- package.json package-lock.json` 빈 출력(의존성 변경 없음) |
| AC-P3 | ✅ | diff 전수 검토 — 신규 수치는 `aiEffectWeight`(주입 필수)뿐이고 제품 기본값 없음. `Math.ceil(points/2)`는 승인 규칙 상수식(HDD-003) |
| AC-P4 | ✅ | 10개 신규 테스트 파일 전부 RED 로그 존재·검증: `red-v1-majority`(6 failed)·`red-v2-premove`(3 failed)·`red-v3-onetap`(3 failed)·`red-v4-map`(3 failed)·`red-v4-ui-map`(2 failed)·`red-v5-presentation`(3 failed)·`red-v5-card-ui`(3 failed)·`red-v5-ai-effects`(3 failed)·`red-v6-audio`(5 failed)·`red-v6-audio-ui`(1 failed), 대응 GREEN 전부 exit 0. manifest receipt와 일치 |
| AC-P5 | ✅ | `RoGolike` 표기 유지(`src/main.tsx:19`, `src/App.tsx:310,342`, `document.title`). baseline→implementation 변경 파일 26개 전부 소스/테스트/모바일 스크립트 범위 내. 검증 전후 tree 동일(§5). `logs/` 외 임시 파일 없음(`playwright-results/`·`dist/`는 gitignore로 tree 제외) |
| AC-P6 | ✅ | `scripts/playwright-mobile-check.mjs` 소스 검사 — 잠긴 보스 `data-state="locked"` 확인 + 잠긴 노드 강제 클릭 후 화면 불변 검사 1회 + `visitOpenNode`/`reachBoss`로 open 노드만 따라 경로 완주 후 보스 진입 + `playSinglePlacement` 1탭 착수(카드 클릭→hit 1클릭) + "착수로 진행" 사용 없음 + 재생 신호 강제. CMD-M exit 0 |

## 5. 스냅샷·Git 불변성

- 검증 시작 시 working tree 해시를 독립 재계산: `bc2da5dc9aba316a344740d0f116299846f75646` = manifest `implementation` = `verify-before` ✓
- 전 명령 실행 후 `snapshot --stage verify-after` = `bc2da5dc…` (동일), `gate --name post-verify` exit 0, `verifier_tree_unchanged: true` ✓
- HEAD `8df1159983b0642cf5d144761f518188a64bcc15` = manifest `git_head_before`, `origin/dev`도 동일 — **commit/push/history 변경 없음**(reflog 최신 항목도 기존 커밋) ✓
- plan hash 4건(02/03/04/05)과 `user_request_sha256` 전부 manifest와 일치(sha256 재계산) ✓

## 6. 운영 참고 (결함 아님)

1. **로컬 preview 실행 시 게임 미기동**: `src/main.tsx`는 `window.__ROGOLIKE_GAME_CONFIG__` 주입이 없으면 "승인된 GameConfig가 필요합니다" 화면을 표시한다. `index.html`에는 주입 코드가 없고 Playwright 게이트만 draft config를 주입한다. 이는 "미승인 밸런스 기본값을 제품에 넣지 않는다"는 승인 정책(HDD-013 pending, AC-P3)의 의도된 결과로, **코드 결함이 아니라 운영 항목**이다. 사람이 손으로 플레이테스트하려면 승인 config 주입 수단(또는 임시 주입 스니펫)이 필요하다.
2. **headless 게이트의 재생 경로**: 모바일 게이트에서는 WebAudio 디코드 실패로 fallback `play()`가 재생 신호였다(AC-28의 허용 경로이자 fallback 배선의 실증). 실기기/일반 Chrome에서의 WebAudio 청음 품질은 기존 인간 판단 항목(HDD-013)으로 남는다.
3. **`src/game/content/charms.ts:17`** 정심부(ITEM-005)의 선언적 메타데이터에 `target: 'move-preview'` 문자열이 남아 있다. 이번 프롬프트 이전부터 있던 콘텐츠 데이터로 diff 범위 밖이고 소비처·사용자 노출이 없어 결함으로 분류하지 않으나, 차기 콘텐츠 정리 시 용어 갱신 후보다.

## 7. 자동 검증 불가 — 인간 판단 항목 (04 §E 재확인)

1. 병종 색(`--stone-accent` 6색)·문양(基/斥/將/騎/守/犧)의 미적 적합성 — 구별성까지만 기계 검증됨.
2. `aiEffectWeight` 제품 주입값 밸런스(현재 2는 테스트/게이트 전용).
3. 점유 과반 조기 종료가 만드는 실제 대국 템포 체감.
4. 전투 이탈·재진입 재추첨 허용 정책의 악용 위험(P-03).
5. 실기기 음악 청음(HDD-013 pending).

## 8. 결론

구현 snapshot `bc2da5dc`는 AC-01~30·AC-P1~P6을 전부 충족하며, strict TDD 증적(RED→GREEN)과 필수 6게이트 독립 재실행이 모두 exit 0이다. Blocking/Major/Minor 결함 0건 — **검증 통과**. 남은 것은 §7의 인간 판단 항목과 §6-1의 운영상 config 주입 수단뿐이다.

## 9. 정확명 영수증 마감 (2026-08-18 추가 검증)

evidence finalizer가 `evidence.config.json`의 `required` 키와 **정확히 같은 이름**의 verifier receipt를 요구하므로, 독립 검증자가 6개 필수 명령을 정식 키명으로 재실행했다(소스/테스트/스크립트/설정 무변경).

| receipt | argv (config 일치) | exit |
|---|---|---|
| `full_tests` | `npm.cmd test` | 0 |
| `typecheck` | `npm.cmd run typecheck` | 0 |
| `build` | `npm.cmd run build` | 0 |
| `benchmark_ai` | `npm.cmd run benchmark:ai` | 0 |
| `runtime_audit` | `npm.cmd audit --omit=dev --audit-level=high` | 0 |
| `mobile_check` | `npm.cmd run check:mobile` | 0 |

- `mobile_check`는 처음 2회 exit 1로 실패했다(`verification/commands.jsonl`에 receipt 보존). 원인: 포트 4173의 preview 서버가 22:46에 뜬 잔존 프로세스로, 본 세션의 `build` receipt가 dist를 재생성한 뒤 `shoptheme.mp3` 응답이 느려져 AudioManager의 라우트 전환 시 fetch abort(`src/audio/AudioManager.ts` AbortController)가 `net::ERR_ABORTED`로 기록됨 — 앱 결함이 아닌 검증 환경 문제. 잔존 서버를 종료하고 새 `npm run preview`(현재 dist)로 재실행하자 exit 0.
- 재실행 후 `snapshot --stage verify-after` = `bc2da5dc…`(= `verify-before`), `gate --name post-verify` exit 0, `verifier_tree_unchanged: true` 유지.
- `validate --final` 결과 `{"failures": []}` — 정확명·정확 argv·verifier 역할 요건까지 **영수증 마감 완료**. §8 결론(검증 통과)은 그대로 유효하다.
