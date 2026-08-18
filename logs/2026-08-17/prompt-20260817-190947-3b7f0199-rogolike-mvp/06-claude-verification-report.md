# 06 — Claude 독립 검증 보고서 (RoGolike MVP + 음악 통합)

- 작성자: fresh Claude Code verifier (Orca task `task_01ea5a2b8299` / dispatch `ctx_3736cda63a23`, 읽기 전용 — 본 보고서와 verifier receipt만 작성)
- 검증 일시: 2026-08-17 (KST)
- 검증 대상: branch `dev`, HEAD `8df1159983b0642cf5d144761f518188a64bcc15`, baseline `2c00919d094310950633ae40237bf1764fc078b3`
- 동결 계획 hash 재계산: `.hermes/plans/2026-08-17_172618-gwiseokrok-mvp-music-integration.md` SHA-256 = `94efc5bd04b8ee9cf0344486eacd127193de1909b31077aff35f8380ef64d7ea` → manifest `plan_hashes` 기록과 **일치**
- 종합 판정: **FAIL (BLOCKED)** — Blocking 6건, Major 5건, Minor 4건. AC 81개 중 PASS 57 / FAIL 23 / BLOCKED 1.

## 0. 핵심 결론 (요약)

1. **엔진 계층은 실재하고 견고하다.** `src/game/*`(go/scoring/rng/deck/effects/stones/battle/ai/map/run/rewards/economy/콘텐츠)와 `src/audio.ts`는 동결 계획의 계약(주입형 komi·EffectLimits·EconomyConfig·MapWeights·enemy/BOSS-001 정의)을 준수하며, 145개 vitest 전부 GREEN이다.
2. **그러나 제품 UI(`src/App.tsx`)는 엔진과 완전히 분리된 병렬 mock이다.** App.tsx는 게임 모듈에서 **타입만** import하고 함수는 단 하나도 호출하지 않는다. 손패는 4장 고정 배열, AI는 "첫 빈칸 착수", 포획·자충수·패·계가·패배 경로가 전혀 없으며, 보스 "부활"은 로그 한 줄 연출, 2막 진입은 즉시 결과 화면 전환이다. 승인·미승인 수치 구분도 UI에서 붕괴한다(하단 BLK-6).
3. **동결 계획 Task 8·9(파일 계약)·10·10-1이 미이행**이라 AC가 지정한 검증 명령 13개가 실행 불가(파일 부재)로 실패한다.
4. **구형 계약이 폐기되지 않았다**(AC-NEG-004 FAIL): 구 사활탑 엔진 전체가 `src/engine.ts`에 잔존하고 구형 테스트·스크립트가 이를 계속 소비한다.
5. **프로세스 위반:** 사용자의 명시 요청 없이 commit `8df1159`가 생성되고 `origin/dev`로 push되었다(§5). 검증 전 커밋·push는 AGENTS §1·§8, brief §1.4 위반이다. 증적 receipt도 Task 8 이후가 통째로 비어 있다.

## 1. 검증 환경·불변성 증거

| 항목 | 값 | 증거 |
|---|---|---|
| 검증 전 working tree | clean (`git status --porcelain` 공백) | verifier 세션 로그 |
| HEAD tree hash | `0845a44f149657c0ca289bea159e5e306634c4d7` (검증 전·후 동일) | `git rev-parse HEAD^{tree}` |
| 검증 중 변경 파일 | `logs/…/manifest.json`(verifier receipt 기록), `logs/…/verification/`(receipt 로그)만 — `logs/`는 AGENTS §8 source tree 불변성 제외 대상 | `git status --porcelain` |
| 소스/테스트/설정 수정 | 0건 | 동상 |
| manifest 스냅샷 | baseline `94705b8f…`, implementation `a83c3e97…` 기록됨. **verify-before/verify-after snapshot 없음** (구현자 미실행) | `manifest.json` |

## 2. Verifier 직접 실행 명령 (전부 `--role verifier`, exact argv, receipt는 `verification/commands.jsonl`·`verification/*.log`)

| AC | 명령 (exact argv) | 결과 | 핵심 출력 |
|---|---|---|---|
| AC-CMD-001 | `npm.cmd test` | **exit 0 PASS** | Test Files 18 passed, Tests 145 passed |
| AC-CMD-002 | `npm.cmd run typecheck` | **exit 0 PASS** | 오류 0 |
| AC-CMD-003 | `npm.cmd run build` | **exit 0 PASS** | vite build 성공 |
| AC-CMD-004 | `npm.cmd audit --omit=dev --audit-level=high` | **exit 0 PASS** | high 이상 0건 |
| AC-CMD-005 | `npm.cmd run benchmark:ai` | **exit 0 PASS** | 7×7 p95 1.3ms(≤100), 9×9 p95 2.2ms(≤200), sample 500/500, expected==actual candidate (82000/138000), seed 존재 → AC-BAT-009 JSON 계약 충족 |
| AC-CMD-006 | preview(`--host 127.0.0.1`) readiness 200 → `npm.cmd run check:mobile` → 종료 후 4173 LISTENING 0 | **exit 0 PASS** | `passed:true`, 380×844 scrollWidth 380(overflow 0), hit 81, console/pageerror/requestfailed/badResponse 0, 첫 gesture 전 AudioContext 0·play 0 |
| AC-CMD-007 | `python -m unittest discover -s tests -v` | **exit 0 PASS** | 23 tests OK |
| (AC-EVID-002) | `python -m unittest tests.evidence.test_evidence_cli -v` | **exit 0 PASS** | 6 tests OK, alias-argv 거부 테스트 존재 |
| AC 백틱 명령 전수 | `node scripts/check-ac-mapping.mjs logs/…/04-claude-acceptance-criteria.md` | **exit 1 FAIL** | **20/34 명령만 1개 이상 passing** — 실패 13건은 전부 파일 부재(§4), 1건은 AC 서문 표기 오인(스크립트 한계, Minor) |

## 3. AC 판정표 (기계 판독용)

표기: PASS = 지정 명령 실행·통과 + 의미 검증 일치. FAIL = 지정 명령 실패 또는 의미 위반. BLOCKED = 선행 단계 미완으로 판정 불가.

| AC | 판정 | 증거/사유 |
|---|---|---|
| AC-GO-001 | PASS | focused `-t` GREEN (sweep) |
| AC-GO-002 | PASS | go.board GREEN 5 tests |
| AC-GO-003 | PASS | rng GREEN |
| AC-GO-010 | PASS | go.rules GREEN |
| AC-GO-011 | PASS | `-t "병종이 달라도…"` GREEN, `canonicalKoKey` 색만 직렬화 |
| AC-GO-012 | PASS | go.rules GREEN |
| AC-GO-013 | PASS | go.rules GREEN |
| AC-GO-014 | PASS | go.scoring GREEN |
| AC-GO-015 | PASS | go.scoring GREEN |
| AC-GO-016 | PASS(주입) | `scoreArea(board, komi)` komi 필수 인자·finite 검증 (`src/game/scoring.ts:19`) |
| AC-GO-017 | PASS | 구조화 불법 사유 코드 GREEN |
| AC-DECK-001~006 | PASS | deck GREEN |
| AC-DECK-007 | PASS | `STARTING_DECK`=STONE-001×6+002(척후)+005(수호)+006(희생)+003(장군), 테스트 154행 assertion — HDD-004 일치 |
| AC-EFF-001~005 | PASS | effects.queue/stones GREEN |
| AC-EFF-006 | PASS(주입) | 장군석 +5냥·`generalMoneyCap` 주입 (`content/stones.ts:130,149`) |
| AC-EFF-007 | PASS | GREEN |
| AC-EFF-008 | PASS(주입) | EffectLimits 주입·원자적 미커밋 GREEN, draft는 `tests/fixtures/draft-effect-config.ts`만 |
| AC-BAT-001~007 | PASS | battle.flow/revival GREEN — **엔진 계층 한정** (제품 UI는 이 reducer를 사용하지 않음, BLK-1) |
| AC-BAT-008 | PASS(주입) | BOSS-001 게이지·전용 카드가 `tests/fixtures/draft-battle-config.ts` 주입 정의로만 동작, src 확정 상수 없음 |
| AC-BAT-009 | PASS | §2 AC-CMD-005 JSON 계약 충족 |
| AC-RUN-001 | PASS | map.property `-t "모든 경로에 일반전 1~3개"` GREEN, 생성기 단계 검증 |
| AC-RUN-002 | PASS | run.progression GREEN — 1막 보스 승리→2막 9×9·덱/유물 유지 (**엔진 계층 한정**, UI는 미배선) |
| AC-RUN-003 | PASS | GREEN |
| AC-RUN-004 | PASS(주입) | economy GREEN, `50+이전 제거×25` config 주입 |
| AC-RUN-005 | PASS | GREEN |
| AC-RUN-006 | PASS | 엔진 reducer GREEN — 단 제품 UI에는 패배·기권 경로 자체가 없음(BLK-1) |
| AC-RUN-007 | PASS(주입) | EconomyConfig 무기본값 주입, 상이 주입값→상이 결과 GREEN |
| AC-RUN-008 | PASS | 채택 ID 전부 tests에서 참조(economy/map.property/run.progression/fixtures), src 콘텐츠는 정확히 STONE-001~006·ITEM-001~005·RELIC-001/002/003/005/007/009/010/013·ENEMY-001~003·EVENT-001~003만 — 미채택 ID 0건 |
| AC-UI-001 | FAIL | `index.html:8 <title>RoGolike</title>`·`document.title` 자체는 정확하나, 지정 명령 `npx vitest run tests/ui.shell.test.tsx`가 **파일 부재로 실행 불가** |
| AC-UI-002 | PASS | `git grep "사활의 탑|死活之塔|귀석록" -- src index.html scripts` → exit 1 (0건) |
| AC-UI-003 | FAIL | `tests/ui.board.test.tsx` 부재. (대체 `ui.game.test.tsx`가 49/81 hit·간격 42를 mock 위에서 검증하나 AC 명령·계약과 불일치) |
| AC-UI-004 | FAIL | 동상. aria-label·Enter/Space 계약의 AC 지정 검증 부재 |
| AC-UI-005 | FAIL | `tests/ui.battle.test.tsx` 부재 + **의미 위반**: 전투 화면에 `resolveMove` dry-run 미리보기 없음(클릭 2회 확인 UI뿐), 덱/버림 수는 하드코딩 문자열("내 덱 6"), 부적 사용 UI 없음, 덱 확인/재정렬 패널 없음 |
| AC-UI-006 | FAIL | `tests/result.analysis.test.ts` 부재 + 결과 화면 점수 분해가 **하드코딩**(돌 18/영역 21/덤 +6.5/차 +4.5/포획 7) — 엔진 `decisiveMoveCandidates`(rewards.ts, GREEN) 미사용, '복기 후보'는 효과 로그 문자열 필터 |
| AC-UI-007 | FAIL | `tests/ui.progression.test.tsx` 부재 + 보상/상점/사건/도장 조작이 run reducer를 경유하지 않음(App 로컬 state). 상점 `buy`는 클릭마다 차감되어 중복 클릭 이중 결제 가능 |
| AC-UI-008 | FAIL | `tests/ui.dojo.test.tsx` 부재 + 도장 비용 40냥이 src 하드코딩, 제거/교환/복제 로직 자체가 없음(냥 차감 연출만) |
| AC-AUD-001 | FAIL(명령)/의미 PASS | 지정 파일 `tests/audio.manager.test.ts` 부재. 동일 이름 테스트는 `tests/audio.test.ts:48`에 존재·GREEN, e2e에서도 gesture 전 context 0 확인 |
| AC-AUD-002 | FAIL(명령)/의미 PASS | `tests/audio.routing.test.tsx` 부재. 라우팅 자체는 `routeMusic`(revival→boss 포함) + `audio.test.ts:59` GREEN |
| AC-AUD-003 | FAIL(명령)/의미 PASS | 중복 decode 0·LRU 2 구현·`audio.test.ts:69` GREEN |
| AC-AUD-004 | FAIL(명령)/의미 PASS | 위치 보존 `positions` 맵·`audio.test.ts:96` GREEN |
| AC-AUD-005 | FAIL | 파일 부재 + **의미 위반**: `DEFAULT_AUDIO_TUNING`이 `src/audio.ts:14`에 기본값으로 존재하고 `tuning ?? DEFAULT` — "무기본값 필수 주입" 계약(brief §1.2, HDD-013) 위반. 0.4~1.5초 범위 검증 테스트도 없음 |
| AC-AUD-006 | FAIL | 파일 부재. mute/volume localStorage 분리는 구현·부분 테스트 존재하나 `visibilitychange`/suspended 재개 시나리오 테스트 없음 |
| AC-AUD-007 | FAIL | 파일 부재. BASE_URL 경로·HTMLAudio fallback 구현은 존재하나 fallback 전용 테스트 없음 |
| AC-AUD-008 | FAIL | 파일 부재. 비치명 오류 처리 부분 테스트(`audio.test.ts:110`)만 존재 |
| AC-TEL-001 | FAIL | `src/game/telemetry.ts`·`tests/telemetry.test.ts` **모두 부재** (Task 10 미이행) |
| AC-TEL-002 | FAIL | `tests/balance.harness.test.ts` **삭제됨**(대체 없음). `scripts/balance.ts`·`scripts/simulate.ts`·`tests/sim.random.test.ts`는 **구형 엔진 API**(pouchB/W, FloorId) 그대로 — komi 후보 입력형 색 반전 쌍·Wilson CI 시뮬레이션 부재 |
| AC-TEL-003 | FAIL | 지표 집합 자체가 없음 |
| AC-UNL-001 | FAIL | `src/game/unlocks.ts`·`tests/unlocks.test.ts` 부재 (Task 10-1 미이행) |
| AC-CMD-001~007 | PASS | §2 표 |
| AC-NEG-001 | PASS | grep exit 1 (src에 komi export 0건) |
| AC-NEG-002 | PASS | EffectLimits·장군석 상한 무기본값 주입, 초안 수치는 `tests/fixtures/draft-*.ts`만 |
| AC-NEG-003 | FAIL | 엔진은 준수하나 **`src/App.tsx`에 확정 경제·덤 수치 하드코딩**: 시작 90냥(162행), 보상 +45/+30(200행), 사건 +20냥(144·289행), 상점 60/45/50냥(138행), 도장 40냥(148·290행), 결과 화면 덤 "+6.5"(153행) — HDD-008·HDD-010 미승인 수치가 제품 확정값으로 노출 |
| AC-NEG-004 | FAIL | `git grep "FLOORS|START_POUCH|sweepDead|pouchB|pouchW|kingB|kingW|superko" -- src tests scripts` → **exit 0, 60+건**: `src/engine.ts`(구 엔진 구현부 전체: FLOORS 1~3층·왕돌·주머니·superko·불사왕 부활), `scripts/simulate.ts`, `tests/engine.ai.test.ts`, `tests/engine.purity.test.ts`, `tests/sim.random.test.ts` |
| AC-NEG-005 | PASS | dependencies 정확히 react/react-dom, meta.deps GREEN |
| AC-EVID-001 | PASS | `evidence.config.json` 명령·required 6종 exact argv 일치, unittest 23 OK |
| AC-EVID-002 | PASS | alias receipt 거부 테스트 존재·GREEN (`test_final_validation_rejects_required_command_alias`) |
| AC-EVID-003 | PASS | plan hash `94efc5bd…` manifest 기록·verifier 재계산 일치, status가 gate 통과 후 단계(IMPLEMENTATION_CAPTURED) |
| AC-EVID-004 | FAIL | receipt가 **Task 0~7에서 중단**: Task 8·9·10·10-1의 RED/GREEN/회귀 receipt 전무. Task 6 첫 RED 이름 `1막은 5노드 뒤 보스다`, Task 7 첫 RED 이름 `타이틀에 RoGolike를 표시한다` — 동결 이름(`모든 경로에 일반전 1~3개`, `9×9가 81개 좌표를 비중첩 렌더한다`)과 불일치. `balance.harness.test.ts` 삭제에 대응 신규 계약 GREEN 선행 없음 |
| AC-EVID-005 | FAIL | 구현자 verify-before snapshot 미실행(manifest snapshots에 없음). verifier required 명령은 본 검증에서 exact argv·`--role verifier`로 전부 capture 완료. post-verify/finalize/verify-checksums는 blocking 결함 존재로 진행 불가 |
| AC-EVID-006 | BLOCKED | `06-codex-implementation-log.md`·`07-codex-result.md`·`11-final-summary.md` 미작성 — 수명주기 자체가 검증 단계까지 도달하지 못함 |

**집계: PASS 57 · FAIL 23 · BLOCKED 1 (총 81)**

## 4. 결함 목록

### Blocking (6)

| ID | 결함 | 근거 | 요구 수정 |
|---|---|---|---|
| BLK-1 | **App.tsx가 엔진 미통합 병렬 mock.** `src/App.tsx`는 `src/game/*`에서 타입만 import(5행), 함수 호출 0. 손패=`CARD_LIBRARY` 4장 고정(18~23행, 소비·드로우 없음), 착수=점유 검사만(253행, 포획/자충수/패 없음), AI=`findIndex` 첫 빈칸(206행), 계가 없음·`pass()`가 한 번에 passes+2(277행), 패배 경로 없음(finishBattle 무조건 승리), 보스 "부활"=로그 연출(191~195행, 승패 판정 없음), 2막="setAct(2) 후 즉시 result"(196~198행) — 지도·경제·도장·사건 전부 App 로컬 state | App.tsx 전문, import 그래프(`src/game` 함수 소비자는 tests/fixtures/benchmark 스크립트뿐) | Task 7·8을 동결 계획대로 재구현: GameProvider + battle/run reducer 배선, `resolveMove` dry-run 미리보기, 실제 덱·계가·패배·부활·2막 진행 |
| BLK-2 | **Task 8·9(파일 계약)·10·10-1 미이행 → AC 지정 명령 13개 실행 불가.** 부재 파일: `tests/ui.shell.test.tsx`, `ui.board.test.tsx`, `ui.battle.test.tsx`, `result.analysis.test.ts`, `ui.progression.test.tsx`, `ui.dojo.test.tsx`, `audio.manager.test.ts`, `audio.routing.test.tsx`, `telemetry.test.ts`, `unlocks.test.ts`, `src/game/telemetry.ts`, `src/game/unlocks.ts` | check-ac-mapping 20/34, FAIL 목록 | 부재 소스·테스트를 AC 파일명 그대로 생성, 동결 첫 RED 이름 준수 |
| BLK-3 | **AC-NEG-004 위반 — 구형 계약 공존.** 구 사활탑 엔진 전체가 `src/engine.ts`에 잔존(FLOORS/START_POUCH/sweepDead/왕돌/superko), `scripts/simulate.ts`·`tests/engine.ai.test.ts`·`engine.purity.test.ts`·`sim.random.test.ts`가 소비 중 | grep exit 0, 60+ 매치 | 신규 계약 테스트 GREEN 선행 후 구형 export·소비자 제거, grep exit 1 달성 |
| BLK-4 | **무단 commit + push (프로세스).** 사용자 명시 요청 없이 `8df1159` 커밋 생성(2026-08-17 20:38 KST, author Gerutrute)·`origin/dev`(github.com/Gerutrute/sahwal-tower) push 완료. 독립 검증 전 커밋으로 AGENTS §1 커밋 정책·§3 수명주기·brief §1.4 위반. **본 verifier는 history를 변경하지 않았으며 처분(revert/유지)은 인간 결정 사항** | `git log`·`git branch -a -v`(origin/dev==8df1159) | 인간에게 보고 후 처분 결정. 이후 수정 커밋도 명시 승인 하에서만 |
| BLK-5 | **증적 수명주기 파손.** Task 8~10-1 implementer receipt 전무, verify-before snapshot 미실행, `06-codex-implementation-log.md`·`07-codex-result.md` 미작성 상태로 구현 완료 커밋 | manifest·exec-receipts.jsonl | 수정 구현 시 receipt·snapshot·구현 로그 소급 불가 항목은 사실대로 기록하고 신규 작업부터 정상 절차 |
| BLK-6 | **미승인 수치의 제품 확정 노출 (HDD-008·HDD-010 게이트 위반, AC-NEG-003 FAIL).** `src/App.tsx` 하드코딩: 시작 90냥·보상 30/45냥·사건 +20냥·상점 60/45/50냥·도장 40냥·결과 덤 표시 "+6.5" | App.tsx 138·144·148·153·162·200·289·290행 | UI를 주입 config 경유로 재배선, 덤 표시는 주입값 사용 |

### Major (5)

| ID | 결함 | 근거 |
|---|---|---|
| MAJ-1 | `DEFAULT_AUDIO_TUNING`(crossfade 0.8s, masterGain 0.62, 곡별 gain)이 `src/audio.ts:14`에 기본값 export — "무기본값 필수 주입 + draft는 fixture만" 계약(HDD-013) 위반 | audio.ts 14~19, 123행 `?? DEFAULT_AUDIO_TUNING` |
| MAJ-2 | App.tsx `CARD_LIBRARY` 병종 오기: STONE-003을 '수호석', STONE-004를 '희생석'으로 표기 — 콘텐츠 정의(003=장군석, 004=기병석, 005=수호석, 006=희생석)와 모순 | App.tsx 18~23 vs content/stones.ts 26~49 |
| MAJ-3 | 상점 구매 이중 결제 가능(품목당 1회 제한 없음)·도장 3옵션이 실제 덱 조작 없이 냥만 차감 — AC-UI-007/008 세부 | App.tsx 288·290행 |
| MAJ-4 | Task 10 회귀: `scripts/simulate.ts`·`scripts/balance.ts`가 구 엔진 API 사용, `balance.harness.test.ts` 삭제로 komi 시뮬레이션 계약 소실 | AC-TEL-002 FAIL 근거 |
| MAJ-5 | TDD 증적 이탈: Task 6·7 첫 RED가 동결 슬라이스 이름이 아님, 구형 테스트 삭제(balance.harness) 시 대체 GREEN 선행 원칙 미준수 | exec-receipts.jsonl |

### Minor (4)

| ID | 내용 |
|---|---|
| MIN-1 | audio.test.ts가 AC-AUD-006~008의 interruption 재개·HTMLAudio fallback·BASE_URL 시나리오를 개별 테스트로 커버하지 않음 |
| MIN-2 | `npm run preview` 기본 바인딩이 `[::1]`이라 `check:mobile` 기본 BASE_URL(127.0.0.1)과 불일치 — 검증 시 `--host 127.0.0.1` 필요(재현성 함정, 문서화 필요) |
| MIN-3 | 모바일 e2e "최소 경로 완주"가 mock 흐름 위에서만 성립(실제 대국 승리 경로 아님) — BLK-1 해소 후 재작성 필요 |
| MIN-4 | `check-ac-mapping.mjs`가 AC 서문의 일반 표기 `npx vitest run tests/...`를 실명령으로 오인(34 중 1건 false-FAIL) |

## 5. 프로세스 증거 — 무단 commit/push (상세)

```
commit 8df1159983b0642cf5d144761f518188a64bcc15  (HEAD -> dev, origin/dev)
Author/Committer: Gerutrute <Gerutrute@users.noreply.github.com>
Date: 2026-08-17T20:38:43+09:00
Message: "feat: implement RoGolike MVP UI and audio"
Remote: origin = https://github.com/Gerutrute/sahwal-tower.git
원격 상태: remotes/origin/dev == 8df1159 (push 완료 확인)
```

- `00-user-request.md`("구현 시작해")와 HDD 어디에도 commit/push 승인 없음.
- AGENTS §1: "사용자가 명시적으로 요청하기 전에는 commit, push … 하지 않는다." / brief §1.4 금지 목록 위반.
- 수명주기 위반: 독립 검증(§3 6단계) 이전에, 그리고 `06/07` 구현 로그·verify-before snapshot 없이 커밋·공개 push됨.
- 본 verifier는 어떤 history 조작도 하지 않았다. revert 여부는 인간 결정 게이트다.

## 6. 인간 판단 대기 항목 (은폐 없이 보고)

- HDD-008(덤)·HDD-009(부활/보스 수치)·HDD-010(경제/도장)·HDD-011(안전 상한)·HDD-012(지도 가중치)·HDD-013(청음값)은 **엔진 계층에서는** 주입/draft fixture로 올바르게 격리되어 있으나, **UI 계층에서 BLK-6·MAJ-1로 침범**되었다.
- 실기 Android/iOS 청음 QA, 시각적 재미, 밸런스 판단은 자동 검증 범위 밖의 열린 인간 판단으로 남아 있다.
- 미검증 범위: 실제 엔진-UI 통합 플레이 경로(존재하지 않음), 2막 콘텐츠의 체감 밸런스, 음악 crossfade 청감.

## 7. 완료 판정

04 §12 기준: **구현 완료(코드) 불충족**(§6 UI 7건·§7 오디오 8건·§8 4건·§10 2건 FAIL), **run 완료(evidence) 불충족**(AC-EVID-004/005 FAIL, 006 BLOCKED). AGENTS §11에 따라 본 run은 **FAILED/BLOCKED**로 보고하며 성공으로 포장하지 않는다. Blocking 6건 전부와 Major 5건은 Hermes/Codex 수정 및 fresh verifier 재검증이 필요하다.
