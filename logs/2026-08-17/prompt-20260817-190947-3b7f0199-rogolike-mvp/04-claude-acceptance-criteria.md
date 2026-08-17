# 04 — Claude 수락 기준 (RoGolike MVP + 음악 통합)

- 작성자: Claude Code planner (Orca dispatch `task_9fde52777d0a` / `ctx_98fa5d528924`, 읽기 전용)
- 기준 계획 SHA-256: `94efc5bd04b8ee9cf0344486eacd127193de1909b31077aff35f8380ef64d7ea`
- 모든 AC는 **명령 + 통과 조건**으로 기계 검증한다. fresh Claude verifier는 각 AC를 실제 실행 증거와 1:1 매핑해야 하며, 실행하지 않은 명령을 통과로 기록할 수 없다.
- 백틱 안의 `npx vitest run tests/...` 명령은 `scripts/check-ac-mapping.mjs`(이번 run 경로로 갱신 후)가 자동 실행하며, 각 명령은 exit 0과 1개 이상의 passing test를 내야 한다.
- `-t` 명령의 테스트 이름은 동결 계획이 고정한 첫 수직 조각 이름이다. 정확히 이 이름의 테스트가 존재해야 한다.
- **게이트 열 표기** — `자유`: 즉시 완전 구현. `주입`: 엔진·테스트는 완전 구현하되 수치는 주입 설정/draft fixture만(제품 확정값 금지). `인간`: 인간 결정 후에만 완료 처리.

## 1. 바둑 코어 (Task 1~2)

| ID | 검증 명령 | 통과 조건 | 게이트 |
|---|---|---|---|
| AC-GO-001 | `npx vitest run tests/go.board.test.ts -t "7×7과 9×9 판을 만든다"` | `createBoard`가 size 7→49칸, size 9→81칸 빈 판 생성 | 자유 |
| AC-GO-002 | `npx vitest run tests/go.board.test.ts` | 두 판 크기의 귀(2)·변(3)·중앙(4) 이웃 수, 그룹·활로 계산, 입력 배열 불변성 assertion 전부 GREEN | 자유 |
| AC-GO-003 | `npx vitest run tests/rng.test.ts` | 동일 seed→동일 수열, 다른 seed→다른 수열, 셔플 재현성 GREEN | 자유 |
| AC-GO-010 | `npx vitest run tests/go.rules.test.ts` | 단일·다중 그룹 동시 포획(잡힌 수 합산), 자충수 금지, 희생석 자충수 불허 GREEN | 자유 |
| AC-GO-011 | `npx vitest run tests/go.rules.test.ts -t "병종이 달라도 즉시 되따냄은 단순패다"` | `canonicalKoKey`가 색 배치만 직렬화(병종·instanceId 제외)함을 두 병종 변형으로 assertion | 자유 |
| AC-GO-012 | `npx vitest run tests/go.rules.test.ts` | 직전 판면 즉시 재현만 금지, 그 외 반복 이력 허용(positional superko 아님), 패스 후 단순패 해제 GREEN | 자유 |
| AC-GO-013 | `npx vitest run tests/go.rules.test.ts` | 자발적 패스 허용, 패스는 카드 소비·드로우 없음, 상대 착수 시 연속 패스 초기화, 합법 수 0이면 자동 패스 GREEN | 자유 |
| AC-GO-014 | `npx vitest run tests/go.scoring.test.ts` | 양측 연속 패스(자동 패스 포함)→계가 전이 GREEN | 자유 |
| AC-GO-015 | `npx vitest run tests/go.scoring.test.ts` | 단색 경계 빈 영역 귀속, 혼합 경계 중립, 잔존 돌 전원 생존(사활 추론 없음) GREEN | 자유 |
| AC-GO-016 | `npx vitest run tests/go.scoring.test.ts` | `흑=돌+영역`, `백=돌+영역+komi(인자)`, `.5` komi에서 동점 불가 assertion GREEN. `scoreArea`는 komi를 필수 인자로 받음 | 주입(HDD-008) |
| AC-GO-017 | `npx vitest run tests/go.rules.test.ts` | 불법 사유가 구조화 코드(`occupied`/`suicide`/`ko` 상당)로 보고됨 GREEN | 자유 |

## 2. 덱 (Task 3)

| ID | 검증 명령 | 통과 조건 | 게이트 |
|---|---|---|---|
| AC-DECK-001 | `npx vitest run tests/deck.test.ts -t "10장에서 4장을 뽑는다"` | `createDeckState(deckList, rng)` 주입형 생성 + 시작 셔플 + 4장 드로우 | 자유 |
| AC-DECK-002 | `npx vitest run tests/deck.test.ts` | 착수 성공 후에만 사용 카드가 버림 더미로 이동, 패스는 무소비 GREEN | 자유 |
| AC-DECK-003 | `npx vitest run tests/deck.test.ts` | 뽑기 더미 소진 시 버림 더미 재셔플이 주입 RNG 스트림으로 결정적 GREEN | 자유 |
| AC-DECK-004 | `npx vitest run tests/deck.test.ts` | 카드 1장으로 같은 병종 돌 다수 배치, 판 위 돌 포획이 카드 상태에 무영향 GREEN | 자유 |
| AC-DECK-005 | `npx vitest run tests/deck.test.ts` | 뽑기·버림 모두 빈 상태에서 임시 일반석 생성, 사용 후 소멸, 런 덱 미추가, 덱 0장에서 매 턴 착수 보장 GREEN | 자유 |
| AC-DECK-006 | `npx vitest run tests/deck.test.ts` | 임시 패 한도 증가 중첩과 만료 GREEN | 자유 |
| AC-DECK-007 | `npx vitest run tests/deck.test.ts` | 확정 시작 덱 상수 = 일반석×6+척후석1+수호석1+희생석1+장군석1(HDD-004)과 일치 assertion GREEN | 자유 |

## 3. 효과 큐·특수 돌 (Task 4)

| ID | 검증 명령 | 통과 조건 | 게이트 |
|---|---|---|---|
| AC-EFF-001 | `npx vitest run tests/effects.queue.test.ts -t "동일 입력은 동일 로그를 낸다"` | 동일 입력→동일 효과 로그, dry-run 미리보기=실제 커밋 결과 동일(`resolveMove` 단일 경로) | 자유 |
| AC-EFF-002 | `npx vitest run tests/effects.queue.test.ts` | 우선순위 1~10(합법성→배치→포획 제거→피포획→포획 성공→활로/연결 참조→냥→패/덱→버림·보충→턴 종료) 순서 위반 0 GREEN | 자유 |
| AC-EFF-003 | `npx vitest run tests/effects.queue.test.ts` | 동일 우선순위 bucket 순서(턴측 돌→턴측 유물→상대 피포획 돌→상대 유물→획득 순서→sourceId tie-break) 4-bucket 전체와 tie 사례를 정밀 assertion GREEN | 자유 |
| AC-EFF-004 | `npx vitest run tests/effects.queue.test.ts` | 동시 다중 포획: 전체 제거 후 최종 판면 재계산, 희생석 각각 발동, 포획 사건 1회·잡힌 돌 수 합산 참조 GREEN | 자유 |
| AC-EFF-005 | `npx vitest run tests/stones.test.ts` | 척후석: 착수 후 덱 위 2장 확인·재정렬, 착수당 1회 GREEN | 자유 |
| AC-EFF-006 | `npx vitest run tests/stones.test.ts` | 장군석 +5냥·착수당 1회·**주입된** 대국당 상한 준수 / 기병석 직전 자기 포획 조건·즉시 추가 착수 없음 / 수호석 활로≤2 인접 조건 / 희생석 상대 포획만·동시 다중 각각·자충수·자발 제거 제외 GREEN | 주입(장군석 상한: HDD-010) |
| AC-EFF-007 | `npx vitest run tests/effects.queue.test.ts` | 효과 자기 재발동 차단, 유물 착수당 1회 원칙 GREEN | 자유 |
| AC-EFF-008 | `npx vitest run tests/effects.queue.test.ts` | 주입 `EffectLimits` 초과 시 해당 착수 원자적 미커밋(카드/판/냥 직전 안정 상태 복원), `EFFECT_LIMIT_EXCEEDED` 구조화 로그+한국어 안내, AI도 같은 수를 불법 취급 GREEN. 서로 다른 두 상한 주입값에서 다른 지점 차단 assertion | 주입(HDD-011) |

## 4. 전투·AI·부활 (Task 5)

| ID | 검증 명령 | 통과 조건 | 게이트 |
|---|---|---|---|
| AC-BAT-001 | `npx vitest run tests/battle.flow.test.ts -t "두 번째 패스 뒤 계가한다"` | battle reducer가 연속 패스 2회에서 scoring/result phase로 전이 | 자유 |
| AC-BAT-002 | `npx vitest run tests/battle.flow.test.ts` | 부적은 `pre-move`에서만 사용 가능, 착수·패스로 계산 안 됨, 착수 처리 시작 후 같은 턴 사용 불가 GREEN | 자유 |
| AC-BAT-003 | `npx vitest run tests/battle.flow.test.ts` | 합법 수 0에서 자동 패스, 양측 자동 패스→종료 GREEN | 자유 |
| AC-BAT-004 | `npx vitest run tests/battle.revival.test.ts` | 1막 1단계 패배 시: 보상 보류, 판면·양측 덱/패/버림·유물·판 위 병종 유지, 종료·연속 패스 초기화, 새 특성 추가 GREEN | 자유 |
| AC-BAT-005 | `npx vitest run tests/battle.revival.test.ts` | 전용 착수: AI 일반 손패 미소비·기본 보충 드로우 없음, 합법 수·자충수·단순패·우선순위 1~8 준수, 후보 0이면 자동 패스 기록 후 플레이어 턴 GREEN | 자유 |
| AC-BAT-006 | `npx vitest run tests/battle.revival.test.ts` | 2단계 패배=즉시 런 종료, 2단계 승리=스테이지 최종 승리 GREEN | 자유 |
| AC-BAT-007 | `npx vitest run tests/battle.flow.test.ts` | AI 결정성: `hand card order→board position index` 고정 순서 전수 평가 정확 1회, 동점만 seeded RNG, 동일 상태·seed→동일 착수 GREEN | 자유 |
| AC-BAT-008 | `npx vitest run tests/battle.revival.test.ts` | 2단계 특성 가중치·전용 착수 점수/동률 규칙·BOSS-001 게이지·전용 카드가 **주입 정의**로만 동작(서로 다른 주입값→다른 행동 assertion). src에 확정 상수 없음 | 주입(HDD-009) |
| AC-BAT-009 | AC-CMD-005 실행 결과 | benchmark JSON에 판 크기별 sample 수·p50/p95/max·기대/실제 candidate 수·seed 존재, 실제 평가 수=독립 열거 합법 조합 수, 7×7 p95≤100ms·9×9 p95≤200ms, exit 0 | 자유(측정 계약) |

## 5. 런·맵·경제 (Task 6·8)

| ID | 검증 명령 | 통과 조건 | 게이트 |
|---|---|---|---|
| AC-RUN-001 | `npx vitest run tests/map.property.test.ts -t "모든 경로에 일반전 1~3개"` | 다수 seed에서 모든 시작→보스 경로: 노드 5개, 일반 전투 1~3(보스 제외), 비전투≥2 — 생성기 단계 검증(사후 보정 없음) | 자유(가중치는 주입: HDD-012) |
| AC-RUN-002 | `npx vitest run tests/run.progression.test.ts` | 1막 보스 승리→2막 진입·9×9 확장·덱/유물 유지, MVP는 2막 보스에서 종료 GREEN | 자유 |
| AC-RUN-003 | `npx vitest run tests/run.progression.test.ts` | 보상 3후보 무중복·현재 기풍≥1·확장≥1·전체 거절 시 무보상 GREEN | 자유 |
| AC-RUN-004 | `npx vitest run tests/economy.test.ts` | 상점 3돌/2부적/1유물/제거 1회, 제거가 `50+이전 제거×25`, 새로고침 없음, 덱 0장 허용 GREEN | 주입(가격: HDD-010) |
| AC-RUN-005 | `npx vitest run tests/economy.test.ts` | 부적 최대 2개, 초과 획득 시 교체 선택 GREEN | 자유 |
| AC-RUN-006 | `npx vitest run tests/run.progression.test.ts` | 대국 패배/기권 즉시 런 종료(모드 무관) GREEN | 자유 |
| AC-RUN-007 | `npx vitest run tests/economy.test.ts` | `EconomyConfig` 주입형: 서로 다른 주입값→다른 결과 assertion, src에 확정 경제 상수 없음 GREEN | 주입(HDD-010) |
| AC-RUN-008 | `git grep -lE "RELIC-00[12357]|RELIC-009|RELIC-010|RELIC-013|ITEM-00[1-5]|ENEMY-00[1-3]|EVENT-00[1-3]" -- tests` | 채택된 모든 콘텐츠 ID가 테스트에서 참조됨(ID별 발동 조건·시점·대상·지속·중첩·횟수·패스/종료 케이스). 미채택 ID(STONE-007+, RELIC-004 등)는 src 콘텐츠 정의에 없음 | 자유(ID)/주입(수치) |

## 6. UI·모바일 (Task 7~8)

| ID | 검증 명령 | 통과 조건 | 게이트 |
|---|---|---|---|
| AC-UI-001 | `npx vitest run tests/ui.shell.test.tsx` + `git grep -n "RoGolike" -- index.html` | `document.title`·표시 제목이 대소문자 정확히 `RoGolike`. index.html `<title>RoGolike</title>` | 자유 |
| AC-UI-002 | `git grep -nE "사활의 탑|死活之塔|귀석록" -- src index.html scripts` | **exit 1 (매치 0건)** — 구형 표시 문자열 잔존 없음 (`docs/`·`logs/`·`package.json name` 제외) | 자유 |
| AC-UI-003 | `npx vitest run tests/ui.board.test.tsx -t "9×9가 81개 좌표를 비중첩 렌더한다"` | size 기반 viewBox, 9×9 81개·7×7 49개 hit target 비중첩 렌더 | 자유 |
| AC-UI-004 | `npx vitest run tests/ui.board.test.tsx` | hit target 규격(9×9 최대 42×42 비중첩, 7×7 ≥44×44 CSS px), aria-label에 판 크기·행·열, Enter/Space 착수 GREEN | 자유 |
| AC-UI-005 | `npx vitest run tests/ui.battle.test.tsx` | 전투 화면: 상대 기풍, 손패 4, 선택 카드, 덱/버림 수, 부적, 냥, 연속 패스, `resolveMove` dry-run 기반 미리보기, 덱 확인/재정렬 패널 취소·확정 GREEN. 카드 미선택 시 착수 차단 | 자유 |
| AC-UI-006 | `npx vitest run tests/result.analysis.test.ts` | 결과 화면 점수 분해(돌/영역/덤/최종 차/포획/주요 효과) + `criticalMoveCandidates` 1~3개가 동일 기록·seed에서 결정적, '복기 후보' 표기 GREEN | 자유 |
| AC-UI-007 | `npx vitest run tests/ui.progression.test.tsx` | 보상 거절·상점 구매/제거·부적 교체·사건 선택이 전부 순수 run reducer 경유, 중복 클릭 이중 결제 0 GREEN | 자유 |
| AC-UI-008 | `npx vitest run tests/ui.dojo.test.tsx -t "복제는 선택 카드만 한 장 추가한다"` | 도장 제거/교환/복제 방문당 1회, 비용은 주입 설정, 임시 카드 대상 제외 | 주입(비용: HDD-010) |

## 7. 오디오 (Task 9)

| ID | 검증 명령 | 통과 조건 | 게이트 |
|---|---|---|---|
| AC-AUD-001 | `npx vitest run tests/audio.manager.test.ts -t "첫 gesture 전 context를 만들지 않는다"` | 초기 렌더·라우팅 변경에서 AudioContext 미생성·재생 시도 0, 첫 사용자 gesture에서만 생성·resume | 자유 |
| AC-AUD-002 | `npx vitest run tests/audio.routing.test.tsx` | HDD-007 라우팅: overworld=타이틀/지도/보상/사건/결과/막 전환, battle=일반/정예, boss=보스+부활 2단계, shop=상점/도장 GREEN | 자유 |
| AC-AUD-003 | `npx vitest run tests/audio.manager.test.ts` | 같은 track 중복 decode 0, decode buffer ≤2곡 LRU·퇴출 시 참조 해제, 현재/확정된 다음 route만 lazy fetch GREEN | 자유 |
| AC-AUD-004 | `npx vitest run tests/audio.routing.test.tsx` | 동일 route 재렌더·임시 overlay 무재시작, 지도↔상점 왕복 시 overworld 위치 보존 GREEN | 자유 |
| AC-AUD-005 | `npx vitest run tests/audio.manager.test.ts` | route 전환 crossfade가 주입 `AudioTuning`값(0.4~1.5초 범위)으로 gain ramp, generation token이 stale fetch/decode·이전 crossfade 취소, 최종 route만 audible GREEN | 주입(HDD-013) |
| AC-AUD-006 | `npx vitest run tests/audio.manager.test.ts` | mute/볼륨 localStorage 저장·게임 상태와 분리, `visibilitychange`·`state='suspended'` interruption 후 설정에 따른 재개 GREEN | 자유 |
| AC-AUD-007 | `npx vitest run tests/audio.manager.test.ts` | `import.meta.env.BASE_URL` 기반 URL, Web Audio 부재 시 HTMLAudio 전체곡 loop+mute/pause fallback GREEN | 자유 |
| AC-AUD-008 | `npx vitest run tests/audio.manager.test.ts` | missing asset·decode 실패·storage 쓰기 실패가 비치명적 로그로 처리되고 게임 상태 불변 GREEN | 자유 |

## 8. 계측·해금 (Task 10·10-1)

| ID | 검증 명령 | 통과 조건 | 게이트 |
|---|---|---|---|
| AC-TEL-001 | `npx vitest run tests/telemetry.test.ts -t "동일 run은 동일 익명 지표를 낸다"` | 동일 run 입력→동일 지표, PII 필드 0, 외부 전송 코드 0(로컬 JSON만) | 자유 |
| AC-TEL-002 | `npx vitest run tests/balance.harness.test.ts tests/sim.random.test.ts` | 새 engine API 기반 seeded 시뮬레이션: komi 후보를 **입력**으로 받아 색 반전 쌍 대국·흑 승률·Wilson 95% CI 산출 GREEN. 제품 komi 기본값 미포함 | 주입(HDD-008) |
| AC-TEL-003 | `npx vitest run tests/telemetry.test.ts` | 지표 집합에 착수 수·고민 시간·병종 선택/발동률·일반석 선택률·패스·포획/승률·덱 크기/승률·판 크기별 흑 승률·죽은 돌 후보 포함 GREEN | 자유 |
| AC-UNL-001 | `npx vitest run tests/unlocks.test.ts -t "잠긴 ID는 후보에서 제외된다"` | `UnlockState`=해금 ID 집합만, 보상·상점 후보 생성기가 필터로 수용, 점수·덤·냥 직접 강화 필드 없음 | 자유 |

## 9. 전역 명령 (Task 11 — 전부 verifier가 직접 실행, exact argv)

| ID | 명령 (exact argv) | 통과 조건 |
|---|---|---|
| AC-CMD-001 | `npm.cmd test` | exit 0, 실패 0 |
| AC-CMD-002 | `npm.cmd run typecheck` | exit 0 |
| AC-CMD-003 | `npm.cmd run build` | exit 0 |
| AC-CMD-004 | `npm.cmd audit --omit=dev --audit-level=high` | exit 0 (high 이상 취약점 0) |
| AC-CMD-005 | `npm.cmd run benchmark:ai` | exit 0 + AC-BAT-009 JSON 계약 충족 |
| AC-CMD-006 | background preview + readiness 후 `npm.cmd run check:mobile` | exit 0, `playwright-results/report.json` `passed:true`, 380×800·430px 두 판 크기 overflow 0, hit target 비중첩, 네 귀 클릭, 최소 경로 완주, console/pageerror/requestfailed/badResponse 0, 네 BGM URL 200, 첫 gesture 전 재생 0, 종료 후 4173 LISTENING 0 |
| AC-CMD-007 | `python -m unittest discover -s tests -v` | exit 0 (evidence 도구 회귀) |

## 10. 금지·격리 계약 (negative)

| ID | 검증 명령 | 통과 조건 | 대응 게이트 |
|---|---|---|---|
| AC-NEG-001 | `git grep -niE "export const [a-z_]*komi|defaultKomi|DEFAULT_KOMI" -- src` | **exit 1 (매치 0건)**. komi는 함수 필수 인자로만 존재(AC-GO-016과 결합) | HDD-008 |
| AC-NEG-002 | `npx vitest run tests/effects.queue.test.ts` + verifier 소스 열람 | `EffectLimits`·장군석 냥 상한이 무기본값 필수 주입. 초안 수치(64/8/8/40/10, 15냥)는 `tests/` fixture에서만 draft 표기로 존재, `src/`에 리터럴 확정값 없음 | HDD-010/011 |
| AC-NEG-003 | `npx vitest run tests/economy.test.ts tests/map.property.test.ts` + verifier 소스 열람 | `EconomyConfig`·`MapWeights`가 무기본값 필수 주입. 초안 수치(30/40/75/100/60/110/35/140/25/30/25/20 등)는 `tests/` fixture에서만 draft 표기로 존재 | HDD-010/012 |
| AC-NEG-004 | `git grep -nE "FLOORS|START_POUCH|sweepDead|pouchB|pouchW|kingB|kingW|superko" -- src tests scripts` | **exit 1 (매치 0건)** — Task 8 완료 후 구형 계약 export·소비자 0 | 자유 |
| AC-NEG-005 | `npx vitest run tests/meta.deps.test.ts` | 런타임 dependencies가 정확히 `react`, `react-dom` 유지 | 자유 |

## 11. 증적·프로세스 (Task 0·12)

| ID | 검증 방법 | 통과 조건 |
|---|---|---|
| AC-EVID-001 | `evidence.config.json` 열람 + `python -m unittest discover -s tests -v` | `commands.benchmark_ai=["npm.cmd","run","benchmark:ai"]`, `commands.runtime_audit=["npm.cmd","audit","--omit=dev","--audit-level=high"]`, `commands.mobile_check=["npm.cmd","run","check:mobile"]`, `required`=full_tests+typecheck+build+위 3개 |
| AC-EVID-002 | `python -m unittest tests.evidence.test_evidence_cli -v` | 올바른 이름+다른 argv alias receipt는 finalize 실패, exact argv만 성공하는 테스트 존재·GREEN |
| AC-EVID-003 | gate 명령 exit code | `plan-frozen`·`pre-implement` exit 0, manifest `plan_hashes`에 `94efc5bd04b8ee9cf0344486eacd127193de1909b31077aff35f8380ef64d7ea` 기록 |
| AC-EVID-004 | `codex/exec-receipts.jsonl` 열람 | Task 1~10-1 각각에 대해 첫 focused RED(기대 assertion/미정의 API로 FAIL), 마지막 focused GREEN, 전체 회귀 `npm test`의 implementer receipt가 시간 순서대로 존재. 구형 테스트 삭제 커밋 묶음에 대응 신규 계약 GREEN 선행 |
| AC-EVID-005 | verifier receipt·snapshot 비교 | verify-before/verify-after source tree hash 동일, required 명령 전부 `--role verifier`·exact argv로 capture, `post-verify`·`finalize --outcome succeeded`·`verify-checksums` exit 0 |
| AC-EVID-006 | `11-final-summary.md` 열람 | HDD-008/009/010/011/012/013의 미결정·초안 상태와 수동 QA(실기 청음·시각 재미·밸런스) 미검증 범위가 숨김 없이 보고됨 |

## 12. 완료 판정 규칙

1. **구현 완료(코드):** §1~§10 중 게이트 `자유`·`주입` AC 전부 통과. `주입` AC는 draft fixture 주입 상태로 통과하면 코드 완료로 인정하되, **제품 밸런스 확정으로 보고하지 않는다**.
2. **run 완료(evidence):** §11 전부 통과 + AGENTS §11의 10개 조건.
3. **인간 게이트 잔존 항목:** HDD-008(덤), HDD-009(부활·보스 수치), HDD-010(경제·도장), HDD-011(안전 상한), HDD-012(지도 가중치), HDD-013(청음값) 및 수동 audio/재미 QA — 이들은 코드 완료 후에도 열린 인간 판단으로 11-final-summary에 명시된다. 어느 하나라도 '확정'으로 둔갑 보고되면 해당 검증은 무효다.
