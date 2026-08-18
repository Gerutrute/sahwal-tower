# 08 — Claude 독립 최종 검증 보고서 (DEF-4 교정 후 종결 검증)

- 작성자: fresh Claude Code closure verifier (Orca task `task_f82de17957a4` / dispatch `ctx_0215182dd3cb`, 읽기 전용 — 본 보고서·09 결함 보고서·verifier receipt/manifest만 갱신)
- 검증 일시: 2026-08-17 (KST)
- 검증 대상: branch `dev`, HEAD `8df1159983b0642cf5d144761f518188a64bcc15`(무단 커밋 — §6 프로세스 결함 유지) + uncommitted 교정 working tree
- source tree hash(logs 제외): 검증 전 `7835c339f4096a28ac32eb7a8bdfd33cb37c6ceb` = manifest `verify-before`·`after-fix` snapshot과 **일치**, 전 명령 실행 후 재계산도 동일 — tree 불변성 성립
- 직전 PASS tree `37a6c9053066291e71dc48ce767d5ca34a5302c2` 대비 차이: **정확히 `scripts/playwright-mobile-check.mjs` 1개 파일(+28/−2)** — 7×7·9×9 두 판 각각 380px·430px 뷰포트에서 html/body scrollWidth overflow를 검사·실패 시 throw하고 report에 `boardWidths`를 기록(DEF-4 교정). 그 외 src/tests/config/docs 무변경 → 직전 검증의 DEF-1~3 해소 판정은 소스 동일성으로 그대로 승계되며, 본 검증에서 재확인함(§3).
- 동결 계획 hash: 02/03/04/05 및 `.hermes` 계획 파일의 SHA-256 재계산 전부 manifest `plan_hashes`와 일치 (`94efc5bd…` 포함)
- 종합 판정: **PASS(코드)** — Blocking 0건, Major 0건. AC 81개 중 **PASS 78 / FAIL 1(역사적) / BLOCKED 2(수명주기 후속 단계)**. 잔여 Minor·인간 판단 항목은 §4~§7에 은폐 없이 기록.

## 0. 핵심 결론 (요약)

1. **DEF-4 (Minor, AC-CMD-006 430px 검사 부재) 해소 확인.** `scripts/playwright-mobile-check.mjs:165-177`(7×7)·`:239-253`(9×9)이 두 판 크기 각각에서 뷰포트를 380px·430px로 전환하며 `document.documentElement.scrollWidth`·`document.body.scrollWidth`를 측정, 어느 한쪽이라도 폭 초과 시 명시적으로 throw한다. 측정값은 report `boardWidths.board7/board9`로 직렬화된다. 본 verifier가 preview lifecycle 포함 직접 재실행한 report: **board7 380→html 380/body 380, 430→430/430; board9 380→380/380, 430→430/430 — overflow 0**, `passed:true`. AC-CMD-006의 "380·430 두 판 크기 overflow 0"이 이제 harness로 기계 검증된다.
2. **DEF-1 (Blocking, 부활 방향) 해소 유지 확인.** 소스는 직전 PASS tree와 byte 동일하고, `src/game/battle.ts:296-306` `resolveBattleOutcome` 재독: winner `'W'`(플레이어 패배) → 무조건 `run-loss`; winner `'B'`+1막·1단계·부활 정의 → `startRevival`; 그 외 `'B'` → `stage-win`. `tests/battle.revival.test.ts`·`tests/ui.game.test.tsx` 포함 전체 suite GREEN, 모바일 e2e가 1승→부활 2단계(bosstheme 유지)→2승→2막 9×9 경로를 완주.
3. **DEF-2 (Major, 특수 돌 제품 배선)·DEF-3 (Major, pre-move·부적/유물 분리) 해소 유지 확인.** `previewOrCommit`/`resolveScoutEffect`/`resolveGeneralCaptureEffect` 배선(GameProvider.tsx), `CONSUME_CHARM`(run.ts:145)·`usedRelicsThisTurn`(battle.ts), `덱 확인 및 재정렬` 패널·`착수로 진행` 게이트(App.tsx:140-168) 전부 존재, `tests/battle.product-effects.test.ts`·`ui.battle` 포함 150 테스트 GREEN.
4. **검증 명령 전부 exit 0.** 필수 6종+Python+AC 매핑을 `--role verifier` exact argv로 본 dispatch에서 재실행(receipt: `verification/commands.jsonl`·`verification/*.log`·manifest). vitest **27 files / 150 tests GREEN**, AC 백틱 명령 **33/33**, audit high 이상 0건, benchmark 7×7 p95 0.8/1.4ms·9×9 p95 1.8/2.4ms(p50/p95, 한도 100/200ms), expected==actual candidates 82000/138000·seeds 존재, Python 증적 테스트 OK, py_compile 13파일 exit 0, hook self-test `"ok": true`.
5. **모바일 검증 lifecycle 준수.** background `npm.cmd run preview`(127.0.0.1:4173) readiness HTTP 200 확인 → `check:mobile` exit 0 → preview 종료 후 **4173 LISTENING 0** 확인. report 오류 4계열(console/pageerror/requestfailed/badResponse) 전부 0, 81 비중첩 42×42 hit target, 첫 gesture 전 오디오 contexts 0/plays 0, 네 BGM URL 전부 OK(실패 시 throw 경로 통과).
6. **프로세스 위반(무단 commit+push `8df1159`)은 코드 품질과 분리해 유지 기록한다(§6).** 처분은 인간 결정 게이트로 남는다.

## 1. 검증 환경·불변성 증거

| 항목 | 값 | 증거 |
|---|---|---|
| 검증 전/후 source tree(logs 제외) | `7835c339f4096a28ac32eb7a8bdfd33cb37c6ceb` 동일 | snapshot_tree 알고리즘 재현 계산 2회(임시 GIT_INDEX_FILE, 사용자 index 무변조) |
| 직전 PASS tree와의 diff | `scripts/playwright-mobile-check.mjs` 단 1개 파일 +28/−2 | `git diff 37a6c905…7835c339` |
| manifest snapshots | implementation `952b3b5…`, **verify-before `7835c339…` = after-fix `7835c339…` = 현재 tree** | manifest.json |
| 검증 중 변경 파일 | `logs/…/manifest.json`(verifier receipt 8종 갱신), `logs/…/verification/*.log`·`commands.jsonl`, 본 보고서·09 — 전부 AGENTS §8 불변성 제외 대상 | git status |
| 소스/테스트/설정/docs 수정 | 0건 | tree hash 동일 |
| Git refs | HEAD·origin/dev 모두 `8df1159` 유지, 검증 중 조작 0 | git rev-parse |
| 동결 plan hash | 02/03/04/05·`.hermes` 계획 5개 전부 재계산 일치 | sha256 재계산 |

## 2. Verifier 직접 실행 명령 (전부 `--role verifier`, exact argv, receipt: `verification/commands.jsonl`·`verification/*.log`)

| AC | 명령 (exact argv) | 결과 | 핵심 출력 |
|---|---|---|---|
| AC-CMD-001 | `npm.cmd test` | **exit 0 PASS** | Test Files 27 passed, Tests 150 passed |
| AC-CMD-002 | `npm.cmd run typecheck` | **exit 0 PASS** | 오류 0 |
| AC-CMD-003 | `npm.cmd run build` | **exit 0 PASS** | clean-dist + tsc + vite build 성공 |
| AC-CMD-004 | `npm.cmd audit --omit=dev --audit-level=high` | **exit 0 PASS** | high 이상 0건 |
| AC-CMD-005 | `npm.cmd run benchmark:ai` | **exit 0 PASS** | 7×7 p95 1.4ms(≤100)·9×9 p95 2.4ms(≤200), sample 500/500, expected==actual 82000/138000, seeds 존재 → AC-BAT-009 충족 |
| AC-CMD-006 | background `npm.cmd run preview`(127.0.0.1) readiness 200 → `npm.cmd run check:mobile` → 종료 후 4173 LISTENING 0 | **exit 0 PASS(완전)** | report `passed:true`, **boardWidths: 7×7·9×9 각각 380/430 html·body overflow 0**, 81 비중첩 42×42(전쌍 검사), 네 귀 실탭 4석, 네 BGM OK, gesture 전 audio 0/0, 오류 4계열 0 — **DEF-4 해소, 430px 검사 harness 존재** |
| AC-CMD-007 | `python -m unittest discover -s tests -v` | **exit 0 PASS** | OK (전체 GREEN) |
| (추가) | `node scripts/check-ac-mapping.mjs logs/…/04-claude-acceptance-criteria.md` | **exit 0 PASS** | **33/33** 명령 전부 1개 이상 passing |
| (추가) | `python -m py_compile <13 files>` / `python scripts/evidence/claude_hook.py self-test` | 전부 exit 0 | `"ok": true` |
| AC-UI-002 | `git grep -nE "사활의 탑|死活之塔|귀석록" -- src index.html scripts` | **exit 1 PASS** | 0건 |
| AC-NEG-001 | `git grep -niE "export const [a-z_]*komi|defaultKomi|DEFAULT_KOMI" -- src` | **exit 1 PASS** | 0건 |
| AC-NEG-004 | `git grep -nE "FLOORS|START_POUCH|sweepDead|pouchB|pouchW|kingB|kingW|superko" -- src tests scripts` | **exit 1 PASS** | 0건 |

## 3. AC 판정표

표기: PASS = 지정 명령 통과 + 의미 일치. (주입) = draft fixture 주입 상태 통과 — 제품 밸런스 확정 아님. 소스가 직전 PASS tree와 동일한 그룹(모바일 스크립트 외 전부)은 suite 재실행 GREEN + 직전 판정 승계 + 핵심 지점 재독으로 확인했다.

| AC 그룹 | 판정 | 근거 |
|---|---|---|
| AC-GO-001~017 (11) | **PASS** | 소스 무변경, 지정 suite 전부 GREEN. `canonicalKoKey` 색 배치 직렬화·`scoreArea(board, komi)` komi 필수 인자 유지 |
| AC-DECK-001~007 (7) | **PASS** | deck GREEN, STARTING_DECK=일반×6+척후+수호+희생+장군=HDD-004 일치 |
| AC-EFF-001~008 (8) | **PASS(주입)** | effects.queue/stones GREEN + 제품 루프 배선(DEF-2 해소 유지): previewOrCommit dry-run/commit, 한도 초과 원자적 거부, 특수 돌 4종 실효과 |
| AC-BAT-001~003 (3) | **PASS** | battle.flow GREEN, pre-move 부적 게이트 제품 실도달(DEF-3 해소 유지) |
| AC-BAT-004 (1) | **PASS** | DEF-1 해소 유지 — battle.ts:296-306 재독 방향 일치, 승리→부활(동일 판 참조 보존)·패배→즉시 run-loss 의미 assertion GREEN |
| AC-BAT-005~009 (5) | **PASS(주입)** | 전용 착수 무소비·합법성·우선순위·주입 가중치/게이지·benchmark 계약 GREEN |
| AC-RUN-001~008 (8) | **PASS(주입)** | map 불변식, 2막 9×9, 보상 3후보, 상점/제거/부적 교체, EconomyConfig 무기본값, 패배=런 종료 일관 |
| AC-UI-001~004 (4) | **PASS** | title `RoGolike`, 구형 문자열 0, ui.shell/ui.board GREEN(81좌표 비중첩·aria·Enter/Space) |
| AC-UI-005 (1) | **PASS** | 손패4/덱·버림/부적·유물 분리/연속 패스/dry-run 미리보기/카드 미선택 차단 + 덱 확인·재정렬 패널 취소·확정(ui.battle 실 DOM) |
| AC-UI-006~008 (3) | **PASS(주입)** | scoreArea 실분해·결정적 복기 1~3, run reducer 경유·이중 결제 0, 도장 방문당 1회 |
| AC-AUD-001~008 (8) | **PASS(주입)** | 오디오 계층 무변경·suite GREEN, tuning 무기본값 필수 주입·0.4~1.5 범위 강제 |
| AC-TEL-001~003, AC-UNL-001 (4) | **PASS(주입)** | telemetry 결정적·PII 0·외부 전송 0, UnlockState=ID 집합 필터 |
| AC-CMD-001~005·007 (6) | **PASS** | §2 표 |
| AC-CMD-006 (1) | **PASS(완전)** | **DEF-4 해소** — exit 0·passed:true + 380/430 두 판 크기 overflow 0을 harness가 직접 검사·기록(boardWidths), preview lifecycle 준수 |
| AC-NEG-001~005 (5) | **PASS** | §2 표 + dependencies 정확히 react/react-dom, src 리터럴 확정값 0, `generalCaptureMoneyCap` 주입 전용 |
| AC-EVID-001~003 (3) | **PASS** | config exact argv·required 6종, alias 거부 GREEN, plan hash 5개 재계산 일치 |
| AC-EVID-004 (1) | **FAIL(역사적·처분 인간)** | 원 구현 Task 6·7 첫 RED 이름 불일치·Task 8 첫 red exit 0 기록은 append-only 소급 불가, 공시 유지. DEF-4 교정 자체는 검증 harness 확장으로 RED 선행 없이 `mobile-430-green` receipt만 존재(§4 관찰) |
| AC-EVID-005 (1) | **BLOCKED(부분 성립)** | verify-before=현재 tree 일치, required 전부 verifier exact argv capture 완료. post-verify/finalize/verify-checksums는 본 dispatch 지시상 미실행(수명주기 다음 소유자) |
| AC-EVID-006 (1) | **BLOCKED** | `11-final-summary.md` 미작성 — Hermes 소유 후속 단계 |

**집계: PASS 78 · FAIL 1 (AC-EVID-004 역사적·인간 처분) · BLOCKED 2 (AC-EVID-005/006 수명주기 후속) — 총 81. Blocking 0 · Major 0.**

## 4. 잔여 결함 (전부 Minor 또는 인간 판단 — 상세 09-claude-defect-report.md)

| ID | 심각도 | 상태 | 요약 |
|---|---|---|---|
| DEF-1 | Blocking | **해소(유지 확인)** | 부활 방향 — src/game/battle.ts:296-306 |
| DEF-2 | Major | **해소(유지 확인)** | 특수 돌 제품 배선 + 덱 확인/재정렬 패널 |
| DEF-3 | Major | **해소(유지 확인)** | pre-move 실도달 + 부적/유물 분리 |
| DEF-4 | Minor | **해소(본 검증 종결)** | 380/430 두 판 크기 overflow 검사 harness — scripts/playwright-mobile-check.mjs:165-177·239-253, report boardWidths |
| DEF-5 | Minor·인간 | 유지 | 전투 중 '지도로 물러나기' 무패널티 이탈(App.tsx:178) — 디자인 처분 상신 |
| DEF-6 | Minor·인간 | 유지 | 지도 상설 상점/사건/도장 버튼(App.tsx:66-73) — HDD-012 미결 영역 |
| DEF-7 | Minor·관찰 | 유지 | 도장 교환 대상 UI 고정 STONE-006(App.tsx:253) — 엔진은 임의 병종 수용 |

관찰(신규·비차단): DEF-4 교정 배치는 `10-codex-fix-log.md`에 서술 항목이 추가되지 않았고 receipt(`mobile-430-green`, exit 0, 22:29 KST)·재생성된 implementation patch·manifest snapshot 갱신으로만 기록됐다. 검증 harness 확장이라 제품 TDD 의무 대상은 아니나, fix-log 서술 보강은 Hermes 재량 항목으로 남긴다.

## 5. 이전 결함 계보 최종 상태

BLK-1/2/3/6·MAJ-1/2/3/4·MIN-1~4: 해소(이전 판 확인 유지). DEF-1~3: 해소(직전 검증 확인, 본 검증 소스 동일성+재독+suite GREEN으로 유지 확정). **DEF-4: 본 검증에서 해소 종결.** BLK-4/PRC-1(무단 push)·MAJ-5/PRC-2(TDD 역사)·PRC-3(수명주기 잔여): 유지 — §6.

## 6. 프로세스 증거 — 무단 commit/push (유지 기록, 코드 품질과 분리)

- `8df1159983b0642cf5d144761f518188a64bcc15`은 사용자 승인 없이 생성·`origin/dev`로 push된 상태 그대로다(HEAD==origin/dev==`8df1159`). 본 verifier는 commit/push/reset/rebase/revert를 일절 수행하지 않았고 교정분은 의도적으로 uncommitted다.
- AGENTS §1 커밋 정책·§3 수명주기 위반 사실 판정은 이전 판을 그대로 유지한다. revert/유지/추가 커밋은 **인간 결정 게이트**다. 이 처분 전 어떤 dispatch도 추가 commit을 해서는 안 된다.

## 7. 인간 판단 대기 항목 (은폐 없이 보고)

- HDD-008(덤)·HDD-009(부활/보스 수치)·HDD-010(경제/도장/장군석 상한)·HDD-011(효과 상한)·HDD-012(지도 가중치)·HDD-013(청음값): 전 계층 주입/draft 격리 유지, 어떤 값도 제품 확정으로 둔갑하지 않았다(`src/main.tsx`는 주입 config 부재 시 게임 미렌더).
- 실기 Android/iOS 청음 QA·시각적 재미·밸런스·DEF-5/6/7 디자인 처분·무단 push 처분: 열린 인간 판단.
- 밸런스 receipt는 소표본 측정 증거일 뿐 결론이 아니다.

## 8. 완료 판정

04 §12 기준 **구현 완료(코드) 충족**: 게이트 `자유`·`주입` AC 전부 통과, Blocking 0·Major 0, 실행 가능한 Minor 결함(DEF-4)까지 해소. run 완료(evidence)는 verify-after snapshot→post-verify→finalize→verify-checksums→`11-final-summary.md`가 남아 있으며(AC-EVID-005/006), 이는 본 verifier 지시 범위 밖의 다음 수명주기 단계다. 무단 push 처분(PRC-1)과 Minor DEF-5~7·HDD 미결·실기 QA는 인간/후속 게이트로 이관한다.
