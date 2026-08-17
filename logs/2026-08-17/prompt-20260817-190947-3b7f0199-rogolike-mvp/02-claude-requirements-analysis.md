# 02 — Claude 요구사항 분석 (RoGolike MVP + 음악 통합)

- 작성자: Claude Code planner (Orca dispatch, 읽기 전용)
- Orca Task/Dispatch: `task_9fde52777d0a` / `ctx_98fa5d528924`
- 기준 계획: `.hermes/plans/2026-08-17_172618-gwiseokrok-mvp-music-integration.md`
- 계획 SHA-256 (작성 시작 시 검증): `94efc5bd04b8ee9cf0344486eacd127193de1909b31077aff35f8380ef64d7ea` — 일치 확인
- 기준 문서: `docs/` 버전 `0.2.3` (README 명시), `AGENTS.md`, `logs/2026-08-17/prompt-20260817-190947-3b7f0199-rogolike-mvp/01-human-design-decisions.md`
- 제품 표시명: **`RoGolike`** (대소문자 정확히 유지, HDD-001). 문서집 내부 명칭 《귀석록》과 구형 코드의 《사활의 탑》 표시 문자열을 대체한다.

## 1. 요청 요약

사용자 요청(`00-user-request.md`)은 "구현 시작해"이며, 동결된 Hermes 계획이 정의한 범위를 승인한다. 범위는 두 축이다.

1. **게임 전환:** 현재 3층 왕돌·돌주머니 기반 《사활의 탑》 프로토타입(`src/engine.ts` 421줄, 7×7 고정)을 docs 0.2.3의 《RoGolike》로 교체 — 7×7(1막)→9×9(2막) 바둑, 순환형 10장 돌 덱, 노드형 로그라이크 런, 1막 AI 부활 2단계, 2막 보스까지.
2. **음악 통합:** `music/` 네 MP3를 화면 상태별 BGM으로 모바일 브라우저 제약(autoplay 정책, 전송량, 포털 하위 경로)을 지키며 통합.

## 2. 현재 코드 기준선 (읽기 전용 확인 결과)

| 항목 | 확인 내용 |
|---|---|
| `src/engine.ts` | `SIZE=7`, `CELLS=49`, `START_POUCH=28`, `FLOORS`(3층), `RELICS` 6종, `sweepDead`, `IllegalReason='occupied'\|'suicide'\|'superko'`, 왕 포획·주머니 소진 승패 — 계획의 구형 계약 목록과 정확히 일치 |
| `src/App.tsx`, `src/components/BoardSvg.tsx`(340×340 고정 viewBox), `src/hooks/useAiTurn.ts` | 구형 전투 화면·AI 턴 훅. 신규 screen/battle 타입으로 교체 대상 |
| `index.html` | `<title>사활의 탑</title>` — `RoGolike`로 교체 대상 |
| `tests/` | 구형 엔진 계약 테스트 13개 파일 + evidence Python 테스트. 계획 마이그레이션 매트릭스의 대상 목록과 일치 |
| `scripts/playwright-mobile-check.mjs` | Chrome 절대경로 하드코딩(`C:/Program Files/...`), `死活之塔` heading·`0 0 340 340` viewBox·49칸 검증 — 전면 교체 대상 |
| `scripts/check-ac-mapping.mjs` | **2026-08-15 run의 AC 파일 경로가 하드코딩**되어 있음(§7 관찰 사항 참조) |
| `evidence.config.json` | `commands`: focused_tests/lint(빈)/typecheck/full_tests/build. `required`: full_tests, typecheck, build. `benchmark_ai`/`runtime_audit`/`mobile_check`는 아직 없음 — Task 0에서 추가 예정 |
| `package.json` | name `sahwal-tower`(유지, HDD-001), scripts에 `benchmark:ai` 없음(Task 5에서 추가) |
| `music/` | 4개 MP3만 존재(총 7,445,288B), 별도 메타데이터 파일 없음. 메타데이터(길이·LUFS·무음 구간)는 동결 계획 §1 '음악 자산 조사' 표가 유일한 기록 |
| `manifest.json` | status `STARTED`, baseline tree `94705b8f…`, plan_hashes 비어 있음(plan freeze 전 단계) |

## 3. 기능 요구사항 (docs 0.2.3 추적)

각 항목은 `[출처]`로 문서를 추적한다. 상태: **확정**=문서·인간 승인 완료, **주입**=엔진은 구현하되 수치는 주입 설정만 허용.

### R-GO 바둑 코어

| ID | 요구사항 | 상태 | 출처 |
|---|---|---|---|
| R-GO-01 | 7×7과 9×9를 동일 순수 엔진이 `size` 인자로 처리. 49 고정 상수 제거 | 확정 | 02_progression/01 §3, 계획 Task 1 |
| R-GO-02 | 플레이어 항상 흑, AI 항상 백 | 확정 | README 코어 규칙 11 |
| R-GO-03 | 그룹·활로·포획: 가로세로 인접, 활로 0 그룹 동시 제거, 다중 그룹 포획 합산 | 확정 | 01_battle/01 §5 |
| R-GO-04 | 자충수 금지(포획 없이 자기 그룹 활로 0). 희생석도 자충수 불허 | 확정 | 01_battle/01 §6 |
| R-GO-05 | 단순패: 직전 판면 즉시 재현만 금지. positional superko 제거 | 확정 | 01_battle/01 §7, CHANGELOG 0.2.0 |
| R-GO-06 | 패 키는 색 배치만 직렬화(병종·카드 ID·instanceId 제외). 병종이 달라도 같은 색 배치 재현이면 단순패 금지 | 확정 | 계획 Task 2 Ko key 계약 |
| R-GO-07 | 자발적 패스 허용, 합법수 없으면 자동 패스. 패스는 카드 소비·드로우 없음. 상대 착수 시 연속 패스 초기화 | 확정 | 01_battle/01 §8 |
| R-GO-08 | 양측 연속 패스(자동 패스 포함)→종료→면적 계가. 잔존 돌 전부 생존 처리, 사활 추론 없음 | 확정 | 01_battle/03 §1·§4 |
| R-GO-09 | 계가: `자기 돌 수 + 자기 색으로만 둘러싸인 빈 교차점 + (백이면 덤)`. 혼합 경계 빈 영역은 중립 | 확정 | 01_battle/03 §3 |
| R-GO-10 | 덤은 `.5` 단위, 무승부 불가능. **판 크기별 값은 미정(HDD-008)** — 엔진은 `komi`를 인자로만 수용, 제품 기본값 금지 | 주입 | 01_battle/03 §6, HDD-008 |
| R-GO-11 | 유물·특수 효과는 최종 집 점수를 직접 변경하지 않음 | 확정 | README 규칙 10, 01_battle/03 §7 |

### R-DECK 순환형 돌 덱

| ID | 요구사항 | 상태 | 출처 |
|---|---|---|---|
| R-DECK-01 | 덱=병종 출현 빈도. 카드와 판 위 돌은 상태·ID 분리, `kind`만 복사 | 확정 | 01_battle/02 §1·§4 |
| R-DECK-02 | 뽑기 더미→패→사용→버림 더미→소진 시 재셔플 순환. 시작 셔플 후 패 한도(4)까지 드로우 | 확정 | 01_battle/02 §3 |
| R-DECK-03 | 착수 성공 후에만 사용 카드를 버림. 패스는 무소비 | 확정 | 01_battle/01 §8, 02 §3 |
| R-DECK-04 | 카드 1장으로 같은 병종 돌 여러 개 배치 가능. 판 위 돌 포획은 카드 상태에 영향 없음 | 확정 | 01_battle/02 §4·§5 |
| R-DECK-05 | 뽑기·버림 모두 비면 임시 일반석 카드를 패에 생성. 사용 후 소멸, 런 덱에 미추가. 덱 0장에서도 매 턴 착수 보장 | 확정 | 01_battle/02 §9·§10 |
| R-DECK-06 | 시작 덱: `일반석×6 + 척후석×1 + 수호석×1 + 희생석×1 + 장군석×1` 10장 단일 기본 덱. 시작 기풍/덱 선택 UI 제외 | 확정 | HDD-004 (docs의 '선택 병종×1'을 인간이 장군석으로 확정) |
| R-DECK-07 | 패 조작: 확인(덱 위 n장 보고 순서 변경), 교환, 임시 패 한도 초과 보유, 임시 카드 생성, 제거(영구/대국 한정 명시) | 확정 | 01_battle/02 §8 |
| R-DECK-08 | `createDeckState(deckList, rng)`는 카드 목록을 주입받음. HDD-004 승인 완료로 확정 기본 덱 상수 export는 허용 | 확정 | 계획 Task 3 |

### R-EFF 효과 큐와 특수 돌

| ID | 요구사항 | 상태 | 출처 |
|---|---|---|---|
| R-EFF-01 | 착수 1회의 1~10 우선순위(합법성→배치→포획 제거→피포획 효과→포획 성공 효과→활로/연결 참조 효과→냥→패/덱 조작→버림·보충→턴 종료) 고정 | 확정 | 01_battle/04 §2 |
| R-EFF-02 | 동일 우선순위 큐: 턴 진행측 돌→턴 진행측 유물→상대 피포획 돌→상대 유물→묶음 내 획득 순서(→안정적 sourceId tie-break) | 확정 | 01_battle/04 §4, 계획 Task 4 |
| R-EFF-03 | 동시 포획: 전체 제거 후 최종 판면 기준 재계산. 희생석 다중 각각 발동. 장군석 포획 사건 1회 계산, 잡힌 돌 수는 합산 참조 | 확정 | 01_battle/04 §3 |
| R-EFF-04 | 효과 자기 재발동 금지, 유물 착수당 1회 원칙, 생성 카드 착수당 상한, 큐 안전 상한 초과 시 중단+로그 | 확정(상한 수치는 주입) | 01_battle/04 §8, HDD-011 |
| R-EFF-05 | 미리보기=실제 처리와 동일 `resolveMove()` dry-run. 포획 예정 돌·예상 활로·발동 예정 효과·드로우/냥 변화·불법 사유 표시 | 확정 | 01_battle/04 §10, 계획 Task 4 |
| R-EFF-06 | STONE-001~006 효과: 일반석(무효과), 척후석(착수 후 덱 위 2장 확인·재정렬, 착수당 1회), 장군석(그룹 포획 시 +5냥, 착수당 1회, 대국당 상한), 기병석(직전 자기 착수 포획 시 패 진입 때 덱 위 1장 확인, 즉시 추가 착수 금지), 수호석(활로 2 이하 아군 그룹 인접 착수 시 덱 위 2장 확인), 희생석(상대 착수로 포획 시 다음 플레이어 턴 패 한도 +1, 동시 다중 각각 발동, 자충수·자발 제거 제외) | 확정(장군석 대국당 냥 상한 수치만 주입: HDD-010) | 03_content/01 §3 |
| R-EFF-07 | 패스는 착수 시·후 효과 미발동, 턴 시작·종료 효과는 발동. '다음 착수' 효과는 패스를 건너뜀 | 확정 | 01_battle/04 §6 |
| R-EFF-08 | 종료 직전: 두 번째 연속 패스 시 턴 종료 효과 먼저 처리. MVP 종료 효과는 돌 생성·제거 불가. 냥 보상은 계가 확정 후 정산 | 확정 | 01_battle/04 §7 |

### R-BAT 전투 상태 머신·AI·부활

| ID | 요구사항 | 상태 | 출처 |
|---|---|---|---|
| R-BAT-01 | 명시적 phase: `turn-start … scoring, result, revival-special-move`. 턴 순서는 01_battle/01 §3의 1~12 | 확정 | 계획 Task 5, 01_battle/01 §3 |
| R-BAT-02 | 부적은 `pre-move`(카드 선택·착수 전)에만 사용, 착수·패스로 계산 안 함, 최대 2개 보유·초과 시 교체 선택 | 확정 | 01_battle/01 §9, 02_부적과_유물 §2 |
| R-BAT-03 | 1막 AI 1단계 패배 시: 최종 보상 보류→종료·연속 패스 초기화→판면/양측 덱·패·유물·병종 유지→새 특성 추가→일반 손패·보충 드로우 없는 전용 착수 1회(합법 수·자충수·단순패·1~8 우선순위 준수)→후보 없으면 자동 패스 기록→플레이어 정상 턴 | 확정 | 01_battle/03 §10, 04 §9, CHANGELOG 0.2.2·0.2.3 |
| R-BAT-04 | 부활 2단계 패배도 일반 패배와 동일하게 즉시 런 종료. 2단계 승리 시에만 스테이지 승리 | 확정 | 01_battle/03 §10 |
| R-BAT-05 | AI 후보 열거: `hand card order → board position index` 고정 순서로 모든 합법 `(card, point)` 정확히 1회 평가, 동점만 seeded RNG. elapsed-time 중단 금지 → 동일 상태·seed에서 결정적 | 확정 | 계획 Task 5 |
| R-BAT-06 | 부활 2단계 특성 가중치(검사/노승/도박사 +25%), 전용 착수 점수화·동률 규칙, 2막 `BOSS-001` 게이지·전용 카드 구성 | **AI 초안·미승인(HDD-009)** — 주입 설정/fixture만 | 계획 §2 초안 |
| R-BAT-07 | AI 성능: Chromium 4× CPU throttling에서 p95 7×7≤100ms, 9×9≤200ms (benchmark acceptance, 종료 조건 아님. 미달 시 fail/escalate, wall-clock fallback 금지) | 확정(측정 계약) | 계획 Task 5 |
| R-BAT-08 | ENEMY-001~003(검사/노승/도박사) 기풍·주력 병종 표시. 대국 전 상대 이름·기풍·주력 병종 2~3개 정보 제공 | 확정(ID), 세부 수치 주입 | 03_content/03 §1~2, HDD-003 |

### R-RUN 런·맵·경제

| ID | 요구사항 | 상태 | 출처 |
|---|---|---|---|
| R-RUN-01 | 막당 지도 노드 5개 후 보스. 1막 7×7, 2막 9×9, MVP는 2막 보스 종료. 판 확장 시 덱 유지 | 확정 | 02_progression/01 §3 |
| R-RUN-02 | 모든 유효 시작→보스 경로: 일반 전투 1~3개(보스 제외), 비전투 노드 ≥2. 생성기 단계에서 불변식 검증(사후 보정 금지) | 확정 | 02_progression/01 §3·02 §1, CHANGELOG 0.2.3 |
| R-RUN-03 | MVP 노드 종류: 대국·정예·상점·사건·도장·(기원은 가중치 후보)·보스. 사건은 `EVENT-001~003`만, 상점 새로고침 제외 | 확정 | HDD-005, 계획 D-010 |
| R-RUN-04 | 일반 보상: 기본 냥+성과 추가 냥+3개 후보 중 1개 선택. 같은 이름 중복 금지, 현재 기풍 연관 ≥1·확장 ≥1, 전체 거절 시 무보상 | 확정(후보 생성 가중치는 주입) | 02_progression/02 §3~4 |
| R-RUN-05 | 상점: 특수 돌 3·부적 2·유물 1·제거 1회. 제거 가격 `50+이전 제거×25`냥, 최소 덱 제한 없음 | 확정(상품 가격은 주입: HDD-010) | 02_progression/02 §6~7 |
| R-RUN-06 | 대국 패배/기권 즉시 런 종료(모드 무관) | 확정 | README 규칙 22 |
| R-RUN-07 | 시작 냥·보상 냥 범위 내 고정값·포획 냥 상한·도장 비용·2막 전 무료 정비 | **AI 초안·미승인(HDD-010)** — 주입 설정만 | 계획 §2 D-005 초안 |
| R-RUN-08 | 비전투 노드 가중치(상점25/사건30/도장25/기원20)·막별 상점 접근 규칙 | **AI 초안·미승인(HDD-012)** — 불변식 엔진만 확정 구현 | 계획 §2 D-010 초안 |
| R-RUN-09 | 도장: 제거·교환·복제 중 방문당 1회 (세부 비용·횟수는 HDD-010 초안) | 주입 | 02_progression/02 §2, 계획 D-005 |

### R-UI 화면·모바일

| ID | 요구사항 | 상태 | 출처 |
|---|---|---|---|
| R-UI-01 | `document.title`과 표시 제목이 대소문자 포함 정확히 `RoGolike`. `귀석록`·`사활의 탑`·`死活之塔` 표시 문자열 잔존 0 | 확정 | HDD-001 |
| R-UI-02 | 화면 흐름: 타이틀→지도→전투 예고→대국→계가 결과→보상/상점/사건/도장→…→보스→막 전환 | 확정 | 계획 Task 7 |
| R-UI-03 | 전투 화면: 상대 기풍, 손패 4, 선택 카드, 덱/버림 수, 부적, 냥, 연속 패스, 착수 미리보기(포획·활로·효과). 덱 확인/재정렬 전용 패널(취소·확정) | 확정 | 계획 Task 7, 01_battle/04 §10 |
| R-UI-04 | 결과 화면: 흑백 돌 점수·영역·덤·최종 차·포획 수·주요 효과·결정적 착수 후보 1~3개('복기 후보'로 표기, 동일 기록·seed에서 결정적) | 확정 | 01_battle/03 §9, 계획 Task 8 |
| R-UI-05 | 380px viewport: 가로 overflow 0, 9×9 hit target 비중첩 최대 42×42 CSS px, 7×7 ≥44×44px, WCAG 24px 초과. aria-label에 판 크기·행·열, 키보드 Enter/Space 착수 | 확정 | 계획 Task 7 |
| R-UI-06 | 보상·구매·제거·도장·부적 교체·사건 선택 전부 순수 run reducer 경유, 중복 클릭 이중 결제 금지 | 확정 | 계획 Task 8 |

### R-AUD 음악

| ID | 요구사항 | 상태 | 출처 |
|---|---|---|---|
| R-AUD-01 | 라우팅: overworld=타이틀·지도·보상·사건·결과·막 전환 / battle=일반·정예 / boss=보스·부활 2단계 / shop=상점·도장 | 확정 | HDD-007 |
| R-AUD-02 | 초기 렌더 자동 재생 금지. 첫 사용자 gesture에서만 AudioContext 생성·resume | 확정 | 계획 Task 9 규칙 1 |
| R-AUD-03 | 단일 AudioContext, 곡별 GainNode→master. 현재/다음 route 곡만 lazy fetch, decode buffer 최대 2곡 LRU | 확정 | 계획 Task 9 규칙 2 |
| R-AUD-04 | 동일 route 재렌더 무재시작, 지도↔상점 왕복 시 overworld 재생 위치 보존, route 전환 0.4~1.5초 crossfade | 확정(정확한 전환값은 HDD-013) | 계획 Task 9 규칙 3 |
| R-AUD-05 | 곡별 gain으로 약 -16 LUFS 공통 체감·-1.5dBTP headroom(battletheme +0.26dBTP 주의). 재인코딩 금지 | 확정(곡별 최종값은 HDD-013) | 계획 §1 음악 조사·Task 9 규칙 8 |
| R-AUD-06 | 정확한 loop start/end·gain·crossfade 값은 **Android/iOS 실기 청음 후 인간 확정(HDD-013)**. 그 전에는 두 BufferSource 1~2초 equal-power overlap의 기술 기본값만 | 주입 | 계획 Task 9 규칙 7, HDD-013 |
| R-AUD-07 | mute/볼륨 localStorage 저장(게임 진행과 분리), visibilitychange·interruption 후 설정 따라 재개, `import.meta.env.BASE_URL` 기반 URL, Web Audio 부재 시 HTMLAudio fallback | 확정 | 계획 Task 9 규칙 4~6·9 |
| R-AUD-08 | 빠른 route 연속 변경 시 generation token으로 stale fetch/decode·이전 crossfade 취소. decode·storage 실패는 게임 상태 비파괴 | 확정 | 계획 Task 9 Audio tests |
| R-AUD-09 | 배포 권리: 사용자가 직접 생성, 해커톤·공개 빌드 배포 가능(HDD-006 확정). Suno 태그 존재는 evidence에 기록 | 확정 | HDD-006, 계획 §1 |

### R-TEL 계측·해금

| ID | 요구사항 | 상태 | 출처 |
|---|---|---|---|
| R-TEL-01 | 지표: 착수 수, 턴 고민 시간, 병종 선택/발동률, 일반석 선택률, 패스, 포획·승률, 덱 크기·승률, 판 크기별 흑 승률, 종료 시 죽은 돌 후보. PII 없는 로컬 JSON, 외부 API 금지 | 확정 | 04_prototype/01 §6, 계획 Task 10 |
| R-TEL-02 | 동일 run 입력→동일 익명 지표(결정적) | 확정 | 계획 Task 10 |
| R-TEL-03 | 덤 산출: 후보(7×7 `2.5/3.5/4.5/5.5`, 9×9 `4.5/5.5/6.5/7.5`)마다 ≥10,000대국 동일 seed·색 반전 쌍, 흑 승률 48~52%·Wilson 95% CI 비교 → **제안까지만**, 확정은 인간(HDD-008) | 주입 | 계획 §2 덤 절차 |
| R-UNL-01 | `UnlockState`: 해금 ID 집합만 보유, 후보 생성기 필터로 주입. 직접 점수·덤·냥 강화 필드 금지. persistence는 MVP 제외 | 확정 | README 규칙 24, 계획 Task 10-1 |

### R-EVID 증적·프로세스

| ID | 요구사항 | 상태 | 출처 |
|---|---|---|---|
| R-EVID-01 | `evidence.config.json`에 `benchmark_ai`/`runtime_audit`/`mobile_check` exact argv 추가, 셋 다 `required` 포함. verifier receipt의 argv가 config와 정확히 일치해야 통과 (alias receipt 거부 테스트 포함) | 확정 | 계획 Task 0 |
| R-EVID-02 | 모든 Task: 실패 테스트 1개→focused RED 기록→최소 구현→focused GREEN→전체 회귀. 첫 RED·마지막 GREEN·회귀는 `capture-command` 보존. import/구문 오류는 유효한 RED 아님 | 확정 | 계획 §3 공통 TDD 규약 |
| R-EVID-03 | 구형 테스트 삭제는 대응 새 계약 테스트 GREEN 이후 같은 변경 묶음에서만 | 확정 | 계획 §3 |
| R-EVID-04 | commit/push는 사용자 명시 요청 시에만, `dev` 브랜치. Claude는 소스 무수정 | 확정 | AGENTS.md §1·§2.1 |

## 4. 승인된 인간 결정 vs 미승인 AI 초안 (경계 확정)

### 4.1 인간 승인 완료 — 제품 확정값으로 구현 가능

| 원장 ID | 내용 |
|---|---|
| HDD-001 | 표시명 `RoGolike` (저장소·npm 이름 유지) |
| HDD-002 | docs 0.2.3의 7×7→9×9·순환 덱·노드형 로그라이크 방향 |
| HDD-003 | 콘텐츠 **ID 집합**: STONE-001~006, ITEM-001~005, RELIC-001/002/003/005/007/009/010/013, ENEMY-001~003 |
| HDD-004 | 시작 덱 10장 구성(일반석6·척후1·수호1·희생1·장군1), 시작 기풍 선택 제외 |
| HDD-005 | EVENT-001~003 사용, 상점 새로고침 제외 |
| HDD-006 | 음악 4곡 자작·공개 배포 권리 확인 |
| HDD-007 | 화면별 음악 라우팅 + 부활 2단계 bosstheme |
| (docs 0.2.3 확정 규칙) | README §3의 24개 코어 규칙, 부활 처리 계약(0.2.2·0.2.3), 경로 불변식 등 §3의 '확정' 항목 전부 |

docs에 수치가 명시된 돌 효과 기준값(척후 2장, 장군 +5냥, 수호 활로≤2, 희생 패 한도+1, 강화 1단계 값)은 docs 0.2.3 본문의 MVP 기준으로 구현한다. 단 장군석 **대국당 냥 상한의 구체 수치**(초안 15냥)는 HDD-010 소속 초안이다.

### 4.2 인간 결정 대기 (Human pending) — 제품 기본값 금지

| 원장 ID | 내용 | 허용 범위 |
|---|---|---|
| HDD-008 | 7×7/9×9 덤 | `komi` 함수 인자·시뮬레이션 후보 fixture만. 제품 기본 덤 상수 export 금지 |
| HDD-013 | 곡별 gain·loop start/end·crossfade 정확값 | 주입형 `AudioTuning` 설정 + 기술 기본값(초안 표기)만. '음악적 승인' 완료 처리 금지 |

### 4.3 AI 초안·미승인 — 주입 설정/fixture로만 구현, 확정값 둔갑 금지

| 원장 ID | 초안 내용 (계획 §2) | 허용 범위 |
|---|---|---|
| HDD-009 | 부활 특성 가중치(+25% 3종), 전용 착수 점수화·고정 좌표 tie-break, BOSS-001 게이지 3→드로우 후보+2, 전용 카드(수호2·연결1) | 주입형 enemy/boss 정의 + 테스트 fixture. 초안임을 코드 주석·fixture 이름으로 명시 |
| HDD-010 | 시작 30냥, 일반 40/정예 75/보스 100냥, 포획 상한 15냥, 할인 floor·최소 1냥, 상품가(60/110/35/140), 제거 50+25n, 도장 50/35/75, 2막 전 무료 도장 1회 | 주입형 `EconomyConfig`. 밸런스 '확정' 보고 금지 |
| HDD-011 | 효과 64·깊이 8·임시 카드 8·총 40·손패 10, 초과 시 원자적 rollback+`EFFECT_LIMIT_EXCEEDED` | 주입형 `EffectLimits`. rollback·로그 **메커니즘**은 확정 구현 |
| HDD-012 | 비전투 가중치 25/30/25/20, 경로당 상점 ≤1·막당 상점 경로 ≥1 | 주입형 `MapWeights`. 경로 불변식(전투 1~3·비전투≥2)은 가중치와 무관하게 확정 구현 |

**둔갑 방지 원칙:** 초안 수치는 (a) `tests/fixtures/` 또는 명명된 draft 설정 객체에만 존재하고, (b) 이름에 draft/초안 표식을 갖고, (c) 엔진 모듈이 이를 무기본값 필수 인자로 받는다. 수락 기준 AC-NEG-* 계열이 이를 기계 검증한다.

## 5. 주입 설정으로 즉시 진행 가능한 슬라이스 (게이트 보존)

| Task | 진행 가능 범위 | 게이트 |
|---|---|---|
| 1 바둑판·RNG | 전체 | 없음 |
| 2 규칙·계가 | 전체 (komi 인자 주입) | HDD-008: 기본 덤 금지 |
| 3 덱 | 전체 (확정 덱) | 없음 |
| 4 효과·돌 | STONE-001~006 + 주입형 상한 엔진 | HDD-010/011: 상한·냥 수치 주입만 |
| 5 전투·부활 | 상태 머신·부활 phase·1막 휴리스틱·benchmark 전체 | HDD-009: 2단계 가중치·보스 콘텐츠는 주입 정의만 |
| 6/8 맵·경제 | 불변식 생성기·run reducer·UI 골격 | HDD-010/012: 경제·가중치 주입, 완료 선언 보류 |
| 7 UI | 전체 (`RoGolike`·확정 덱 기준) | 없음 |
| 9 음악 | 배포·확정 라우팅·상태 머신 전체 | HDD-013: 청음값 전 '음악 승인' 보류 |
| 10/10-1 계측·해금 | 도구·시뮬레이션·해금 골격 전체 | HDD-008~010: 밸런스 결론 금지 |

## 6. 비기능 요구사항

- **결정성:** 동일 seed·입력→동일 셔플·AI 착수·효과 로그·지표. AI에 시간 기반 중단 없음.
- **성능:** AI p95 벤치마크 계약(R-BAT-07). 음악 총 7.1MiB 전곡 선로드 금지, 2곡 LRU.
- **접근성:** WCAG 2.2 24px 초과 터치 타깃, aria-label, 키보드 착수.
- **호환:** Android≥7/iOS≥12(legacy plugin 유지), `base:'./'` 하위 경로, Web Audio 부재 fallback.
- **의존성:** 런타임 의존성은 `react`, `react-dom`만 유지(`tests/meta.deps.test.ts` 계약 유지·확장).
- **보안:** 비밀 미기록, 외부 네트워크·분석 API 추가 금지(AGENTS §9).

## 7. 관찰 사항·위험 (계획 외 신규 발견 포함)

1. **계획 리뷰 해시 불일치(정보):** `.hermes/plans/...review.md`는 SHA `0759efce…`에 대한 PASSED 기록이다. 현재 canonical 계획은 `94efc5bd…`(본 dispatch 지시로 검증)이므로, 리뷰 기록 자체가 "계획 변경 시 재리뷰 필요"를 명시한다. Hermes가 plan freeze 시 `94efc5bd…`를 manifest `plan_hashes`에 기록해야 하며, 구 리뷰를 현재 계획의 승인 근거로 인용하면 안 된다.
2. **`scripts/check-ac-mapping.mjs` 경로 하드코딩(갭):** 2026-08-15 run의 AC 파일을 읽는다. 이번 run의 AC(`04-claude-acceptance-criteria.md`)를 검증하려면 경로를 인자/환경변수로 받거나 이번 run 경로로 갱신해야 한다. 계획 마이그레이션 매트릭스에 명시돼 있지 않으므로 **AI 권고**로 brief에 포함한다(소폭 변경, 인간 승인 불요한 도구 정합성 수정으로 판단하되 Hermes 재량).
3. **구형 표시 문자열 제거 범위:** `index.html`(사활의 탑), `scripts/playwright-mobile-check.mjs`(死活之塔), `src/App.tsx` 내 문자열이 대상. `package.json name: sahwal-tower`는 HDD-001에 따라 **유지**한다 — 표시 문자열 검사에서 제외해야 한다.
4. **음악 메타데이터의 단일 출처:** `music/`에는 MP3 외 메타 파일이 없다. 길이·LUFS·무음 수치의 유일한 기록은 동결 계획 §1 표이므로, AC는 이 표를 참조 기준으로 사용한다(재측정은 검증 단계에서 선택적).
5. **evidence.config 갱신 순서:** `benchmark_ai` 등 required 추가는 해당 명령이 존재하기 전(Task 5 이전) finalize를 실패시키므로, finalize는 전체 구현 완료 후에만 시도한다(계획 Task 0·12 순서와 일치, 순서 위반 주의만 기록).
6. **덱 재셔플 결정성:** 버림 더미 재셔플은 반드시 battle RNG 스트림에서 유도해 동일 seed 재현성을 보존해야 한다(R-TEL-02·AC-DECK-003·AC-TEL-002와 연결).
7. **9×9 AI 성능 위험:** 계획 §5와 동일 — 후보 전수 평가 계약 유지 하에 평가 캐시·할당 감소로 대응, p95 미달 시 escalate(fallback 금지).

## 8. 결론

docs 0.2.3, 인간 결정 원장, 동결 계획(94efc5bd) 사이에 계약 충돌은 발견되지 않았다. 요구사항은 전부 기계 검증 가능한 형태로 `04-claude-acceptance-criteria.md`에 매핑했으며, 미승인 초안 수치는 주입 설정 경계로 격리해 구현 진행과 인간 승인 게이트를 분리했다.
