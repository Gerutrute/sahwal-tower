# 《RoGolike》 MVP 전환 및 음악 통합 구현 계획

> **For Hermes:** 저장소 `AGENTS.md`의 evidence lifecycle과 역할 분리를 따른다. Claude Code는 Orca를 통한 읽기 전용 계획·수락 기준·독립 검증만 담당하고, Hermes/Codex가 유일한 제품 코드 구현자다. 일반 서브에이전트가 제품 코드를 수정하게 하지 않는다.

**Goal:** 현재의 3층 왕돌·주머니 기반 《사활의 탑》 프로토타입을 최신 `docs/` 0.2.3 게임 규칙에 맞는 《RoGolike》 7×7→9×9 바둑·순환형 돌 덱·노드형 로그라이크 MVP로 단계적으로 전환하고, `music/`의 네 곡을 모바일 브라우저 제약을 지키며 화면 상태별 BGM으로 통합한다.

**Architecture:** 바둑 규칙, 덱, 효과 큐, 전투, AI, 런 진행을 서로 분리된 순수 TypeScript 모듈과 결정적 상태 전이로 구현한다. React는 순수 엔진 상태를 표시하고 사용자 명령을 전달하는 UI 계층으로 제한한다. 기존 `src/engine.ts`는 마이그레이션 동안 새 모듈의 얇은 공개 facade로 유지하고, 구형 왕돌·바위·돌 주머니·포지셔널 슈퍼코 계약은 새 테스트로 대체한 뒤 제거한다.

**Tech Stack:** Vite 5, React 18, TypeScript, Vitest/jsdom, Playwright, 브라우저 기본 Web Audio/HTMLAudio API. 런타임 외부 의존성은 계속 `react`, `react-dom`만 사용한다.

---

## 1. 조사 결과와 기준 문서

### 최신 제품 기준

- 최신 문서 버전은 `docs/README.md`의 `0.2.3`이다. 문서의 코어 규칙은 유지하되 사용자 결정으로 제품 표시명은 《RoGolike》를 사용한다.
- MVP는 1막 7×7과 2막 9×9, 막당 지도 노드 5개 후 보스, 유효 경로별 일반 전투 1~3개다 (`docs/02_progression/01_런진행과_바둑판성장.md`, `docs/04_prototype/01_MVP와_플레이테스트.md`).
- 승패는 왕돌/돌 고갈이 아니라 양측 연속 패스 후 면적 계가와 소수점 덤으로 결정한다 (`docs/01_battle/03_종료_계가_승패.md`).
- 패 규칙은 positional superko가 아니라 단순패다 (`docs/01_battle/01_전투_기본규칙.md`).
- 덱은 돌 수량이 아니라 병종 출현 빈도이며, 10장 시작 덱·4장 패·버림/재순환·빈 덱 임시 일반석을 사용한다 (`docs/01_battle/02_돌덱과_드로우.md`).
- 모든 특수 돌은 일반 바둑 규칙을 따르고 판 위 병종 상태는 카드 순환과 독립적이다 (`docs/03_content/01_특수돌.md`).
- 1막 AI는 첫 패배 뒤 같은 판면·덱·패·유물 상태에서 새 특성의 전용 착수 1회를 수행한 뒤 플레이어 턴으로 재개한다 (`docs/CHANGELOG.md` 0.2.3, `docs/01_battle/03_종료_계가_승패.md`).

### 현재 코드와의 핵심 차이

현재 `src/engine.ts`, `src/App.tsx`, `src/components/BoardSvg.tsx`는 다음 구형 계약에 강하게 결합돼 있으므로 부분적인 문구 변경이 아니라 엔진·화면 흐름의 단계적 교체가 필요하다.

- 고정 7×7, 49칸 인덱스와 340×340 전용 SVG
- 바위와 왕돌, 왕 포획 승패
- 흑·백 돌 주머니 소진 승패
- positional superko와 전체 history 비교
- 선형 3층 및 층별 고정 기믹
- 덱/패/버림 더미/병종 카드가 없는 단일 착수
- 유물 6종만 존재하고 부적·냥·지도·상점이 없음

기존 순수 함수 구조, 그룹/활로/포획 구현 방식, 접근 가능한 SVG 터치 영역, 모바일 380px Playwright 검증은 재사용한다.

### 구형 계약 소비자 마이그레이션 매트릭스

| 처리 | 파일 | 전환 시점 |
|---|---|---|
| migrate | `src/engine.ts` | Task 1에서 좌표·그룹 facade, Task 2~6에서 새 공개 API re-export, Task 8 뒤 구형 export 0개 확인 |
| replace | `src/App.tsx`, `src/components/BoardSvg.tsx`, `src/hooks/useAiTurn.ts` | Task 7에서 새 screen/battle 타입으로 교체 |
| replace | `tests/engine.rules.test.ts`, `engine.economy.test.ts`, `engine.revival.test.ts`, `engine.ai.test.ts`, `engine.floors.test.ts`, `engine.relics.test.ts`, `engine.purity.test.ts` | 대응 새 `go/deck/effects/battle` 테스트가 GREEN인 Task에서 구형 계약 삭제 |
| replace | `tests/run.flow.test.ts`, `balance.harness.test.ts`, `sim.random.test.ts` | Task 6과 Task 10에서 새 2막 run·seeded simulation으로 교체 |
| replace | `tests/ui.render.test.tsx`, `ui.timer.test.tsx`, `ui.responsive.test.tsx` | Task 7~8에서 새 화면·동적 보드·AI lifecycle 계약으로 교체 |
| rewrite | `scripts/balance.ts`, `scripts/simulate.ts` | Task 10에서 새 engine API와 7×7/9×9 입력 사용 |
| rewrite | `scripts/check-mobile.mjs`, `scripts/playwright-mobile-check.mjs` | Task 11에서 제품명·동적 판·새 화면·portable browser 계약으로 교체 |
| keep and extend | `tests/meta.deps.test.ts`, evidence 관련 `scripts/tests` | 런타임 의존성·증적 회귀 유지 |

각 단계에서 facade가 re-export할 심볼은 해당 Task의 새 모듈 public API뿐이며, 최종적으로 `FLOORS`, `START_POUCH`, `kingB/kingW`, `pouchB/pouchW`, `sweepDead`, 폭발석·바위·왕돌 관련 export와 소비자가 0개인지 검색 테스트로 확인한다.

### 음악 자산 조사

| 파일 | 제목 태그 | 길이 | 크기 | 오디오 | 음량 | 관찰된 무음 |
|---|---|---:|---:|---|---|---|
| `music/overworld.mp3` | Untitled | 79.8135초 | 1,960,760B | MP3, 48kHz, stereo, 약 193.6kbps | -14.36 LUFS, -0.08 dBTP | 시작 약 0.422초 |
| `music/battletheme.mp3` | The Weight of the Crown | 87.9335초 | 2,334,785B | MP3, 48kHz, stereo, 약 209.8kbps | -13.25 LUFS, +0.26 dBTP | 시작 약 0.552초 |
| `music/bosstheme.mp3` | Iron and Silk | 72.7735초 | 1,767,882B | MP3, 48kHz, stereo, 약 191.5kbps | -13.68 LUFS, -1.74 dBTP | 시작 약 0.404초 |
| `music/shoptheme.mp3` | Unresolved Circle | 56.2135초 | 1,381,861B | MP3, 48kHz, stereo, 약 193.1kbps | -12.91 LUFS, -0.92 dBTP | 시작 약 0.656초, 끝 약 0.183초(-50dBFS 이하) |

네 파일 모두 `ailiterature`, `made with suno` 태그와 front-cover MJPEG 스트림을 포함한다. 총 전송량은 7,445,288B(약 7.10MiB)이므로 전곡 선로드는 피하고 현재/다음 화면의 곡만 지연 로드한다. 네 곡은 seamless loop master가 아니라 intro와 fade-out을 가진 완성곡이다. 단순 `audio.loop=true`는 특히 상점 곡에서 반복 간격이 들릴 수 있다. `battletheme`은 +0.26dBTP, `overworld`는 -0.08dBTP로 headroom이 부족하므로 재인코딩 대신 Web Audio gain에서 곡별 감쇄를 적용한다. 무음 수치는 `ffmpeg -i <file> -af "silencedetect=noise=-50dB:d=0.15" -f null -` 기준의 신호 분석값이며 MP3 메타데이터가 아니다.

---

## 2. 구현 전 인간 결정 게이트

코어 엔진은 아래 결정과 병렬로 진행할 수 있지만, 콘텐츠·밸런스 단계는 확정 전 완료 처리하지 않는다.

1. **D-001 제품명 — 확정:** 사용자 표시명과 `document.title`은 대소문자를 그대로 지킨 `RoGolike`로 전환한다. 저장소명과 npm package 이름은 이번 MVP에서 유지한다.
2. **D-002 덤:** 7×7과 9×9의 `.5` 단위 초깃값. 자동으로 ‘정답’을 정하지 않고 seeded self-play와 인간 플레이테스트 결과로 확정한다.
3. **D-003 콘텐츠 셋 — ID 확정/세부 수치 초안:** `STONE-001~006`, `ITEM-001~005`, `RELIC-001/002/003/005/007/009/010/013`, `ENEMY-001~003`을 MVP에 사용한다. 각 효과의 기준 수치, 반올림, 발동/리셋 범위, 중첩, 선택 UI와 예외는 아래 AI 초안을 인간이 승인한 뒤 동결한다.
4. **D-004 1막 부활·보스:** 모든 1막 AI 전투는 첫 패배 후 같은 판면에서 1회 부활한다는 0.2.3 확정 계약을 구현한다. 아직 미정인 부활 후 새 특성의 수치, 전용 착수 후보·동률 선택 규칙, 2막 9×9 최종 보스 ID·게이지 임계값·전용 카드만 사람이 확정한다. 적용 범위에 예외를 두려면 별도 인간 명세 변경이 필요하다.
5. **D-005 경제·도장:** 보상 범위 안의 초기 고정값, 포획 냥 상한, 할인 시 정수 냥 반올림, 도장 제거·교환·복제 각각의 비용·대상·횟수, 상점 새로고침 여부, 2막 진입 전 정비 제공 여부.
6. **D-006 음악 권리 — 확정:** 사용자가 네 곡을 직접 생성했고 해커톤 제출물과 공개 빌드에 배포할 권리가 있음을 확인했다. 이 진술을 evidence에 기록한다.
7. **D-007 음악 연출 — 라우팅 확정/청음값 후속:** `overworld=타이틀·지도·보상·사건·결과·막 전환`, `battletheme=일반·정예`, `bosstheme=보스와 일반 적 부활 2단계`, `shoptheme=상점·도장`으로 확정한다. 지도 계열 재생 위치를 보존한다. 곡별 gain, 정확한 loop start/end와 0.4~1.5초 전환값은 실제 모바일 청음 뒤 확정한다.
8. **D-008 시작 덱·선택 — 확정:** `일반석×6 + 척후석×1 + 수호석×1 + 희생석×1 + 장군석×1`의 10장 단일 기본 덱을 사용한다. 시작 기풍/기본 덱 선택 UI는 MVP에서 제외한다.
9. **D-009 효과 안전 상한:** 효과 큐 처리 상한과 생성 카드 착수당 상한을 확정한다. 엔진에는 설정값과 초과 진단 로그를 먼저 만들되 임의 수치를 제품 밸런스로 고정하지 않는다.
10. **D-010 맵 콘텐츠 — 일부 확정:** MVP 사건은 `EVENT-001~003`만 사용하고 상점 새로고침은 제외한다. 지도 생성 가중치와 막별 상점 접근 수는 아래 AI 초안을 인간이 승인한 뒤 동결한다. 경로 불변식은 가중치와 무관하게 항상 지킨다.

### 2026-08-17 사용자 승인과 남은 초안

**확정:** `RoGolike`, 위 MVP 콘텐츠 ID, 시작 덱, 시작 기풍 선택 제외, 음악 공개 배포 권리, 화면별 음악 라우팅과 부활 시 보스곡, `EVENT-001~003`, 상점 새로고침 제외.

**덤 산출 절차 초안(D-002):** 엔진 구현 후 7×7은 `2.5/3.5/4.5/5.5`, 9×9은 `4.5/5.5/6.5/7.5`를 후보로 한다. 후보마다 최소 10,000대국을 동일 seed·색 반전 쌍으로 실행하고, 흑 승률 48~52%, 평균 흑-백 점수차, 95% Wilson 신뢰구간을 비교한다. 가장 작은 편향의 `.5` 값을 인간 플레이테스트 시작값으로 제안하며 이 단계 전 제품 기본값은 두지 않는다.

**부활·보스 초안(D-004):** 1막 부활 전용 착수는 모든 합법점 중 `즉시 포획 수→자기 최소 활로 2 이상→약한 아군 그룹 연결→영역 평가` 순으로 점수화하고 고정 좌표 순서로 동률을 깬다. 적별 2단계 특성은 검사=`포획 평가 +25%`, 노승=`연결·활로 평가 +25%`, 도박사=`희생석 평가 +25%`로 시작한다. 2막 보스는 9×9 `BOSS-001 철벽 장군`; 서로 다른 보스 그룹 연결마다 철벽 게이지 +1, 3에서 다음 드로우의 확인 후보 +2 후 게이지 0, 전용 카드는 수호석 2장과 연결석 1장으로 시작한다. 수치는 시뮬레이션 후 인간 승인 전까지 초안이다.

**경제·도장 초안(D-005):** 시작 30냥, 일반전 40냥, 정예 75냥, 1막 보스 100냥. 장군석/포획 유물 추가 냥은 대국당 합산 15냥 상한. 할인은 최종 가격에 `floor`, 최소 1냥. 상품은 일반 돌 60, 희귀 돌 110, 부적 35, 유물 140냥. 제거는 `50+이전 제거×25`; 도장 방문당 제거(50)/교환(35)/복제(75) 중 1회, 같은 카드 반복 대상 허용, 덱 0장 허용, 임시 카드는 대상 제외. 2막 진입 전 무료 도장 행동 1회를 제공한다.

**효과 안전 상한 초안(D-009):** 한 착수당 효과 처리 64개, 연쇄 깊이 8, 임시 생성 카드 8장, 전투 중 총 카드 상태 40장, 손패 10장. 초과 시 해당 원자적 착수를 커밋하지 않고 `EFFECT_LIMIT_EXCEEDED` 구조화 로그와 한국어 안내를 남긴 뒤 카드/판/냥을 직전 안정 상태로 복구한다. AI도 같은 수를 불법 후보로 취급한다.

**맵 초안(D-010):** 각 막 5열에서 모든 경로의 일반전 1~3개·비전투 2개 이상을 먼저 만족시킨 뒤 비전투 후보 가중치를 상점 25, 사건 30, 도장 25, 기원 20으로 둔다. 각 막에서 적어도 한 경로에는 상점 1개가 있고 한 경로에서 상점은 최대 1개다. 사건은 `EVENT-001~003`, 새로고침은 없다. 이 가중치와 상점 접근 규칙은 인간 승인 전 초안이다.

---

## 3. 단계별 구현 계획

### 모든 코드 Task의 공통 TDD 실행 규약

각 테스트 항목을 한 번에 구현하지 않고 아래 5단계를 반복한다.

1. 명명된 동작 하나의 실패 테스트만 작성한다.
2. `npx vitest run <test-file> -t "<exact test name>"`을 실행해 기대한 assertion/미정의 API로 FAIL하는지 기록한다. 테스트 구문 오류나 import 오류는 유효한 RED가 아니다.
3. 해당 동작만 만족하는 최소 순수 구현을 작성한다.
4. 같은 focused 명령이 PASS인지 확인한다.
5. 해당 Task 파일 전체와 `npm test`를 실행해 회귀 0건을 확인한 뒤 다음 동작으로 이동한다.

각 Task의 첫 RED, 마지막 GREEN, 전체 회귀 명령은 evidence `capture-command`로 보존한다. 구형 테스트 삭제는 대응 새 계약 테스트가 먼저 GREEN이 된 뒤 같은 변경 묶음에서만 허용한다.

### Task 0: evidence run 시작과 명세 동결

**Objective:** 최신 문서, 음악 권리, 인간 결정과 구현 범위를 감사 가능한 run에 고정한다.

**Files:**
- Generated by `evidence.py start`: `logs/YYYY-MM-DD/prompt-.../00-user-request.md`
- Generated by `evidence.py start`: `logs/YYYY-MM-DD/prompt-.../01-human-design-decisions.md`
- Claude artifacts: `02-claude-requirements-analysis.md`~`05-codex-implementation-brief.md`
- Modify: `evidence.config.json` — `benchmark_ai`, `runtime_audit`, `mobile_check`의 exact argv를 commands에 추가하고 세 이름 모두 `required`에 추가
- Modify: `scripts/evidence/evidence.py` — required verifier receipt의 실제 `argv`가 `evidence.config.json.commands[name]`과 정확히 같아야 통과
- Modify: `tests/evidence/test_evidence_cli.py` — 올바른 이름에 다른 argv를 붙인 alias receipt는 finalize 실패, exact argv만 성공

**Steps:**
1. 저장소 첫 side effect가 evidence start가 되도록 사용자 요청 원문을 저장소 밖 OS 임시 파일 `REQUEST_FILE`에 기록한다. 아래 명령으로 현재 untracked `docs/**`, `music/**`를 baseline에 포함한 evidence run을 시작하고 출력된 실제 `PROMPT_DIR`을 이후 명령에 사용한 뒤 임시 파일을 제거한다.
   `python scripts/evidence/evidence.py start --request-file "$REQUEST_FILE" --slug gwiseokrok-mvp`
2. D-001~D-010을 확정/초안/차단으로 구분한다.
3. Orca Claude planner가 이 계획과 최신 문서를 읽고 기계 검증 가능한 AC를 작성한다.
4. `python scripts/evidence/evidence.py gate --dir "$PROMPT_DIR" --name plan-frozen`과 `--name pre-implement`가 exit 0인지 확인한다.

**Implementation/verification recording:**
- `python scripts/evidence/evidence.py snapshot --dir "$PROMPT_DIR" --stage implementation`
- `python scripts/evidence/evidence.py capture-command --dir "$PROMPT_DIR" --role implementer --name <name> -- <command>`
- 검증 직전/직후 `snapshot --stage verify-before`, `snapshot --stage verify-after`
- verifier 명령은 `--role verifier`로 capture
- verifier는 `npm run benchmark:ai`를 정확한 command name `benchmark_ai`로 capture하고 exit 0·candidate count·p95 JSON을 보존
- verifier는 preview readiness 이후 `npm.cmd run check:mobile`을 `mobile_check`, `npm.cmd audit --omit=dev --audit-level=high`를 `runtime_audit`로 exact argv capture
- 마지막에 `gate --name post-verify`, `finalize --outcome succeeded`, `verify-checksums`

**Evidence command contract:**
- `commands.benchmark_ai = ["npm.cmd", "run", "benchmark:ai"]`
- `commands.runtime_audit = ["npm.cmd", "audit", "--omit=dev", "--audit-level=high"]`
- `commands.mobile_check = ["npm.cmd", "run", "check:mobile"]`
- `required`에는 기존 `full_tests`, `typecheck`, `build`와 위 세 이름이 모두 포함된다.

**Verification:** evidence CLI의 plan hash, baseline, 역할 소유권, required name과 exact argv 검증 및 evidence Python 회귀 테스트가 exit 0.

### 결정 게이트 의존성

| Task | 차단 결정 | 미확정 상태에서 허용되는 범위 |
|---|---|---|
| Task 1 | 없음 | 전체 구현 가능 |
| Task 2 | D-002 | `komi`를 함수 인자로 받는 점수 엔진·테스트만 가능, 제품 기본값 금지 |
| Task 3 | 없음 | 확정된 단일 10장 기본 덱 구현, 시작 선택 UI 제외 |
| Task 4 | D-003, D-005, D-009 | `STONE-001~006`과 설정 주입형 상한 엔진만 가능, 미선정 유물/부적·임의 상한 금지 |
| Task 5 | D-003, D-004 | 모든 1막 AI의 1회 부활·상태 유지·전용 착수 phase는 즉시 구현. 미정인 새 특성 수치·전용 착수 후보/동률 규칙·2막 보스 콘텐츠만 보류 |
| Task 6/8 | D-003, D-005, D-010 | 맵 불변식과 reducer 골격만 가능, 임의 경제·사건·상점 규칙으로 완료 금지 |
| Task 7 | 없음 | `RoGolike` 제품명과 단일 시작 덱 기준 전체 구현 가능 |
| Task 9 | D-007 청음값 | 공개 배포와 확정 routing 구현 가능; exact gain/loop/crossfade 값은 실제 모바일 청음 뒤 완료 |
| Task 10 | D-002~D-005 | 계측 도구 가능, 밸런스 결론·제품 수치 확정 금지 |

### Task별 첫 RED와 focused GREEN 명령

아래는 각 Task의 첫 수직 조각이다. 이후 열거된 TDD case도 공통 실행 규약으로 한 동작씩 반복한다.

| Task | 첫 실패 테스트/RED 이유 | 최소 구현 심볼 | focused GREEN 명령 |
|---|---|---|---|
| 1 | `tests/go.board.test.ts`의 `7×7과 9×9 판을 만든다`; `createBoard` 미정의 | `createBoard`, `neighbors`, `groupAt` | `npx vitest run tests/go.board.test.ts tests/rng.test.ts` |
| 2 | `tests/go.rules.test.ts`의 `병종이 달라도 즉시 되따냄은 단순패다`; `canonicalKoKey` 미정의 | `canonicalKoKey`, `tryPlay`, `pass`, `scoreArea` | `npx vitest run tests/go.rules.test.ts tests/go.scoring.test.ts` |
| 3 | `tests/deck.test.ts`의 `10장에서 4장을 뽑는다`; `createDeckState` 미정의 | `createDeckState`, `drawToLimit`, `discardUsed`, `reshuffle` | `npx vitest run tests/deck.test.ts` |
| 4 | `tests/effects.queue.test.ts`의 `동일 입력은 동일 로그를 낸다`; `resolveEffectQueue` 미정의 | `resolveEffectQueue`, `previewMove`, `STONE-001~006` definitions | `npx vitest run tests/effects.queue.test.ts tests/stones.test.ts` |
| 5 | `tests/battle.flow.test.ts`의 `두 번째 패스 뒤 계가한다`; battle reducer 미정의 | `createBattle`, `reduceBattle`, `chooseAiAction`, revival phase | `npx vitest run tests/battle.flow.test.ts tests/battle.revival.test.ts` |
| 6 | `tests/map.property.test.ts`의 `모든 경로에 일반전 1~3개`; map generator 미정의 | `generateActMap`, `reduceRun`, reward/shop/dojo actions | `npx vitest run tests/map.property.test.ts tests/run.progression.test.ts tests/economy.test.ts` |
| 7 | `tests/ui.board.test.tsx`의 `9×9가 81개 좌표를 비중첩 렌더한다`; 새 screen/board 미정의 | `GameProvider`, screen components, dynamic `BoardSvg` | `npx vitest run tests/ui.shell.test.tsx tests/ui.board.test.tsx tests/ui.battle.test.tsx` |
| 8 | `tests/ui.dojo.test.tsx`의 `복제는 선택 카드만 한 장 추가한다`; dojo reducer/UI 미정의 | reward/shop/dojo/event/result screens, `criticalMoveCandidates` | `npx vitest run tests/ui.progression.test.tsx tests/ui.dojo.test.tsx tests/result.analysis.test.ts` |
| 9 | `tests/audio.manager.test.ts`의 `첫 gesture 전 context를 만들지 않는다`; manager 미정의 | `AudioManager`, `useGameMusic`, `AudioControls` | `npx vitest run tests/audio.manager.test.ts tests/audio.routing.test.tsx` |
| 10 | `tests/telemetry.test.ts`의 `동일 run은 동일 익명 지표를 낸다`; telemetry 미정의 | `recordTelemetry`, new simulation/balance scripts | `npx vitest run tests/telemetry.test.ts tests/balance.harness.test.ts tests/sim.random.test.ts` |
| 10-1 | `tests/unlocks.test.ts`의 `잠긴 ID는 후보에서 제외된다`; interface/filter 미정의 | `UnlockState`, `filterUnlockedPool` | `npx vitest run tests/unlocks.test.ts` |

각 RED는 해당 심볼이 없거나 기대 계약이 불충족해서 실패해야 하며, focused GREEN 직후 `npm test`를 실행한다. D-003에서 채택한 각 유물·부적·적은 ID별로 발동 조건·시점·대상·지속·중첩·횟수·패스/종료 테스트를 추가하지 않으면 Task 4/6을 완료하지 않는다.

### Task 1: 동적 바둑판 도메인과 결정적 RNG 도입

**Objective:** 7×7/9×9를 같은 순수 엔진에서 처리하고 향후 테스트를 재현 가능하게 한다.

**Files:**
- Create: `src/game/types.ts`
- Create: `src/game/rng.ts`
- Create: `src/game/go.ts`
- Modify: `src/engine.ts` (새 모듈 re-export facade)
- Create: `tests/go.board.test.ts`
- Create: `tests/rng.test.ts`

**Design:**
- `BoardState = { size: 7 | 9; points: readonly (Stone | null)[] }`
- `Stone = { color: 'B' | 'W'; kind: StoneKind; instanceId: string }`
- 모든 좌표·이웃·그룹 함수는 `size`를 인자로 받고 49 상수를 제거한다.
- seeded RNG를 셔플, 보상, 맵, AI tie-break의 단일 입력으로 사용한다.

**TDD:** 7×7/9×9 귀·변·중앙 이웃, 그룹, 활로, 입력 불변성, seed 재현 테스트를 RED→GREEN으로 수행한다.

### Task 2: 단순패·패스·면적 계가로 바둑 규칙 교체

**Objective:** 최신 승패 계약을 구현하고 구형 왕돌/주머니/superko/sweepDead 승패를 제거한다.

**Files:**
- Modify: `src/game/go.ts`
- Create: `src/game/scoring.ts`
- Create: `tests/go.rules.test.ts`
- Create: `tests/go.scoring.test.ts`
- Retire/replace assertions: `tests/engine.rules.test.ts`만 새 규칙 suite GREEN 후 교체

**TDD cases:**
- 포획, 다중 그룹 동시 제거, 자충수 금지
- 바로 전 판면만 재현하는 즉시 되따냄 금지, 다른 반복 이력은 허용
- 패스가 단순패 금지를 해제하고 덱을 소비하지 않음
- 두 번 연속 패스와 양측 자동 패스 종료
- 단색 경계 영역, 혼합 경계 중립, 잔존 돌 전부 생존
- `흑=돌+영역`, `백=돌+영역+덤`, `.5`로 무승부 없음

**Ko key:** `canonicalKoKey(board)`는 판 크기와 교차점별 `B/W/empty`만 직렬화하고 병종·카드 ID·`instanceId`는 포함하지 않는다. 같은 색 배치가 직전 판면을 재현하면 새로 놓은 돌의 병종이 달라도 단순패로 금지하며, 이 계약을 별도 테스트한다.

### Task 3: 순환형 돌 덱 엔진

**Objective:** 10장 덱, 4장 패, 사용/버림/재순환과 빈 덱 임시 일반석을 순수 함수로 구현한다.

**Files:**
- Create: `src/game/deck.ts`
- Create: `src/game/content/stones.ts`
- Create: `tests/deck.test.ts`

**State:** `drawPile`, `hand`, `discardPile`, `temporaryCards`, `handLimit`, `nextCardId`를 분리한다. 카드와 판 위 돌은 ID/상태를 공유하지 않고 `kind` 값만 복사한다. `createDeckState(deckList, rng)`는 외부에서 정확한 카드 10장을 주입받으며 D-008 승인 전 production default를 export하지 않는다.

**TDD cases:** 초기 셔플/4장 드로우, 착수 성공 후에만 버림, 패스 무소비, 버림 재셔플, 카드 1장으로 같은 병종 여러 돌 배치, 덱 0장 임시 일반석 생성·사용 후 소멸, 일시 패 한도 중첩과 만료.

### Task 4: 결정적 효과 큐와 MVP 특수 돌

**Objective:** 문서의 1~10 우선순위와 동시 효과를 로그와 미리보기 양쪽에서 같은 결과로 처리한다.

**Files:**
- Create: `src/game/effects.ts`
- Expand: `src/game/content/stones.ts`
- Create: `tests/effects.queue.test.ts`
- Create: `tests/stones.test.ts`

**Design:** 효과는 `trigger`, `priority`, `sideRelation: 'active' | 'opponent'`, `sourceKind: 'stone' | 'relic'`, `acquisitionOrder`, `sourceId`, `perMoveLimit`을 가진 data-driven 정의로 등록한다. 동일 priority comparator는 `active stone → active relic → opponent captured stone → opponent relic → acquisitionOrder → sourceId` 순서를 명시적으로 적용한다. 실제 처리와 미리보기는 같은 `resolveMove()`를 dry-run 옵션으로 호출해 결과 불일치를 막는다.

**TDD cases:** 척후석 확인/재정렬, 장군석 포획 냥 1회·상한, 기병석 조건부 확인, 수호석 위험 그룹 인접, 희생석 상대 포획만 발동·다중 중첩, 한 효과의 자기 재발동 차단, 큐 안전 상한과 구조화 로그. 별도 focused test에서 네 source bucket 전체 순서, 동시 포획된 여러 돌, 같은 bucket의 획득 순서 tie와 안정적 `sourceId` tie-break를 정확히 assertion한다.

### Task 5: 전투 상태 머신과 AI 부활 2단계

**Objective:** 카드 선택→합법 위치→효과→보충→턴 전환→패스/계가를 하나의 명시적 상태 머신으로 구성한다.

**Files:**
- Create: `src/game/battle.ts`
- Create: `src/game/ai.ts`
- Create: `tests/battle.flow.test.ts`
- Create: `tests/battle.revival.test.ts`
- Create: `tests/fixtures/ai-benchmark.ts`
- Create: `scripts/ai-benchmark-browser.ts`
- Create: `scripts/benchmark-ai.mjs`
- Modify: `package.json` (`benchmark:ai` script)
- Retire after `tests/battle.revival.test.ts` GREEN: `tests/engine.revival.test.ts`

**Phases:** `turn-start | pre-move | choose-card | choose-point | resolving | turn-end | scoring | result | revival-special-move`.

**Rules:**
- 부적은 `pre-move`에서만 사용 가능.
- 합법 수가 없으면 자동 패스.
- 1막 AI 1단계 패배 시 최종 보상 보류, 판면/덱/패/유물/병종 유지, 종료와 연속 패스 초기화, 새 특성 추가, 일반 손패·드로우를 건드리지 않는 전용 착수 1회 후 흑 턴.
- 전용 착수 후보가 없으면 자동 패스 로그 후 흑 턴.
- 플레이어와 AI의 덱 상태는 분리하되 같은 셔플·드로우·버림·재순환 계약을 사용한다. 2막 전용 카드는 공개된 적 콘텐츠 정의를 통해서만 일반 규칙을 확장한다.

**AI:** 1막은 포획·활로·연결·영역을 가중한 얕은 휴리스틱, 2막은 적 정의의 기풍 가중치와 전용 카드 후보를 추가한다. 후보는 `hand card order → board position index`의 고정 순서로 모든 합법 `(card, point)` 조합을 정확히 한 번 평가하고, 동점만 seeded RNG로 선택한다. 제품 결정은 elapsed time으로 중단하지 않으므로 동일 상태·seed에서 항상 같다. Chromium 4× CPU throttling의 고정 판면 묶음에서 p95 목표를 7×7 100ms 이하, 9×9 200ms 이하로 측정하되 이는 benchmark acceptance일 뿐 종료 조건이 아니다. 목표 미달 시 fail/escalate하여 최적화하거나 Worker gate를 열고, wall-clock best-so-far fallback은 도입하지 않는다.

**Reproducible AI benchmark:** `scripts/benchmark-ai.mjs`는 임시 Vite server를 시작하고 Playwright Chromium CDP의 `Emulation.setCPUThrottlingRate({rate:4})`를 적용한 뒤 `scripts/ai-benchmark-browser.ts`를 browser module로 실행한다. fixture는 고정 seed의 7×7 5개·9×9 5개 상태를 포함한다. fixture별 10회 warm-up 후 100회를 측정하며, 측정 경계는 `chooseAiAction` 호출 직전/직후 `performance.now()`다. 결과 JSON은 판 크기별 sample 수, p50/p95/max, 기대·실제 candidate 수와 seed를 정렬해 출력한다. 각 호출의 실제 평가 수가 독립적으로 열거한 모든 합법 `(card, point)` 수와 같지 않거나 7×7 p95>100ms, 9×9 p95>200ms면 exit 1이다. browser/server는 `finally`에서 종료하고 결과는 evidence `capture-command`로 보존한다.

### Task 6: 런·맵 생성·보상·냥 경제

**Objective:** 막당 5노드 후 보스, 모든 유효 경로의 일반 전투 1~3개, 비전투 최소 2개를 보장한다.

**Files:**
- Create: `src/game/run.ts`
- Create: `src/game/map.ts`
- Create: `src/game/rewards.ts`
- Create: `src/game/content/relics.ts`
- Create: `src/game/content/charms.ts`
- Create: `src/game/content/enemies.ts`
- Create: `src/game/content/events.ts`
- Create: `tests/map.property.test.ts`
- Create: `tests/run.progression.test.ts`
- Create: `tests/economy.test.ts`
- Retire after both replacements are GREEN: `tests/engine.economy.test.ts`, `tests/run.flow.test.ts`

**TDD cases:**
- seed 여러 개에서 모든 시작→보스 경로의 전투 1~3, 5노드, 비전투≥2 불변식
- 1막 7×7→2막 9×9 전환과 덱 유지
- 일반 보상 3개 무중복, 현재 기풍 1개+확장 1개, 모두 거절 시 대체 보상 없음
- 상점 3돌/2부적/1유물/제거 1회, 제거가 `50+이전 제거×25`, 덱 0 허용
- 부적 최대 2개와 교체 선택
- 대국 패배/기권 즉시 런 종료

### Task 7: React 화면 상태와 동적 바둑판 마이그레이션

**Objective:** 새 런 흐름을 모바일 우선 UI로 표시하고 7×7/9×9 모두 380px에서 터치 가능하게 한다.

**Files:**
- Refactor: `src/App.tsx`
- Create: `src/app/GameProvider.tsx`
- Create: `src/screens/TitleScreen.tsx`
- Create: `src/screens/MapScreen.tsx`
- Create: `src/screens/PreBattleScreen.tsx`
- Create: `src/screens/BattleScreen.tsx`
- Create: `src/screens/RewardScreen.tsx`
- Create: `src/screens/ShopScreen.tsx`
- Create: `src/screens/DojoScreen.tsx`
- Create: `src/screens/EventScreen.tsx`
- Create: `src/screens/ResultScreen.tsx`
- Modify: `src/components/BoardSvg.tsx`
- Modify: `index.html` — `<title>RoGolike</title>`
- Split: `src/styles.css` into screen/component files only if selectors remain traceable
- Create/replace: `tests/ui.shell.test.tsx`
- Create/replace: `tests/ui.board.test.tsx`
- Create/replace: `tests/ui.battle.test.tsx`

**UI flow:** 타이틀→지도→전투 예고→대국→계가 결과→보상/상점/사건/도장→다음 노드→보스→막 전환. 전투 화면은 상대 기풍, 손패 4장, 선택 카드, 덱/버림 수, 부적, 냥, 연속 패스, 예상 포획·활로·효과를 표시한다. 척후석·부적의 덱 확인/재정렬은 별도 선택 패널에서 취소·확정할 수 있어야 한다.

`tests/ui.shell.test.tsx`와 Playwright 타이틀 검사는 사용자 표시 제목 및 `document.title`이 대소문자를 포함해 정확히 `RoGolike`인지 확인하고 구형 `귀석록`/`사활의 탑`/`死活之塔` 문구가 남지 않았음을 검증한다.

**Board:** viewBox와 grid는 `size`에서 계산한다. 380px viewport에서 좌우 10px padding과 약 360px 보드 폭을 사용하면 9×9 교차점 간격은 약 42px이므로, 9×9 hit target은 서로 겹치지 않는 최대 42×42 CSS px, 7×7은 44×44px 이상으로 둔다. 이는 WCAG 2.2의 24px 최소 타깃을 넘기면서 좌표 오인 영역을 만들지 않는다. `aria-label`은 판 크기와 행/열을 정확히 말하며 키보드 Enter/Space 착수를 보존한다. `scripts/playwright-mobile-check.mjs`를 수정해 모든 hit target의 `getBoundingClientRect()` 비중첩, 네 귀 edge point 실제 클릭, 380×800/430px의 7×7·9×9 overflow 0을 검증한다.

### Task 8: 결과·보상·상점·이벤트 콘텐츠 UI

**Objective:** 런의 비전투 판단과 패배 학습 정보를 실제 조작 가능한 화면으로 완성한다.

**Files:**
- Implement the screens from Task 7
- Create: `src/components/CardHand.tsx`
- Create: `src/components/EffectPreview.tsx`
- Create: `src/components/ScoreBreakdown.tsx`
- Create: `tests/ui.progression.test.tsx`
- Create: `tests/ui.dojo.test.tsx`
- Create: `tests/result.analysis.test.ts`

**Acceptance:** 결과 화면은 돌 점수/영역/덤/최종 차/포획/주요 효과와 결정적인 착수 후보 1~3개를 구분한다. `BattleState`는 착수별 최소 재현 snapshot과 후보 평가에 필요한 seed를 보존하고, 결과 분석기는 패배/승리 기여도가 큰 턴에서 합법 대안 수를 동일한 one-ply evaluator로 재평가해 1~3개를 `criticalMoveCandidates`로 만든다. 이는 ‘정답 수’가 아닌 ‘복기 후보’로 표시하며 같은 기록/seed에서 결과가 고정되는지 테스트한다. 보상 거절, 상점 구매·제거, 도장의 제거·교환·복제, 부적 교체, 사건 선택이 모두 순수 run reducer를 거치며 새로고침/중복 클릭으로 이중 결제되지 않는다.

### Task 9: 음악 자산 배치와 오디오 상태 머신

**Objective:** 네 곡을 화면 상태에 맞춰 지연 로드하고 모바일 autoplay·포털 경로·화면 전환을 안전하게 처리한다.

**Files:**
- Keep source assets: `music/*.mp3`
- Modify: `vite.config.ts` (`publicDir: 'music'`로 확정; 빌드에는 네 파일을 루트 public asset으로 한 번만 복사)
- Create: `src/audio/tracks.ts`
- Create: `src/audio/AudioManager.ts`
- Create: `src/audio/useGameMusic.ts`
- Create: `src/components/AudioControls.tsx`
- Create: `tests/audio.manager.test.ts`
- Create: `tests/audio.routing.test.tsx`

**Track routing — 사용자 승인:**
- `overworld.mp3`: 타이틀, 지도, 일반 보상, 사건, 결과, 막 전환
- `battletheme.mp3`: 일반 전투와 정예 전투
- `bosstheme.mp3`: 1막·2막 보스 및 AI 부활 2단계
- `shoptheme.mp3`: 상점과 도장. MVP 제외 노드인 기원은 이후 추가할 때 같은 트랙을 재검토한다.

**Playback rules:**
1. 초기 렌더에서는 자동 재생하지 않는다. 첫 `등반 시작`/명시적 음향 버튼의 사용자 gesture에서 AudioContext를 생성·resume한다.
2. 단일 `AudioContext` 아래 `AudioBufferSourceNode → 곡별 GainNode → master GainNode → destination` 구조를 사용한다. 현재 곡만 fetch/decode하고 다음 route가 확정될 때만 다음 곡을 lazy fetch한다. decode buffer는 최대 2곡 LRU로 제한하고 퇴출 시 참조와 예정 source를 해제한다.
3. 동일 route 재렌더와 임시 overlay에서는 재시작하지 않는다. 지도·상점 왕복 시 overworld 재생 위치를 보존하고, route 변경은 `audioContext.currentTime` 기준 gain ramp로 0.4~1.5초 crossfade한다.
4. `visibilitychange`와 audio interruption 이후 사용자 설정에 따라 재개한다.
5. 음소거/볼륨은 `localStorage`에 저장하되 게임 진행과 분리한다.
6. `import.meta.env.BASE_URL` 기반 URL로 Orca 포털 하위 경로와 `base:'./'` 빌드를 지원한다.
7. `ffmpeg silencedetect` 분석에서 나온 무음 구간만 잘라 seamless loop라고 가정하지 않는다. 전용 loop master 전에는 두 BufferSource를 1~2초 equal-power overlap하고, 최종 loopStart/loopEnd는 청음 gate D-007의 값만 반영한다.
8. Web Audio의 곡별 gain을 사용해 약 -16 LUFS의 공통 체감 기준과 최소 -1.5dBTP headroom을 확보한다. 원본 MP3를 반복 재인코딩하지 않으며, cover/tag 제거가 필요하면 무손실 remux만 사용한다.
9. Web Audio가 없는 브라우저의 fallback은 단일 `HTMLAudioElement` 전체곡 native loop와 mute/pause만 지원하며 정밀 fade·trim 품질을 승인하지 않는다.

**Audio tests:** unlock 전 context 생성/재생 없음, 화면별 track 선택, 같은 track 중복 decode 없음, mute persistence, cleanup, hidden/resume, missing asset의 비치명적 로그를 mock Audio API로 검증한다. 빠른 route 연속 변경에서는 generation token으로 stale fetch/decode와 이전 crossfade를 취소하고 최종 route만 audible인지, iOS interruption을 모사한 `AudioContext.state='suspended'`, 저장소 쓰기 실패와 decode 실패가 게임 상태를 깨지 않는지도 검증한다.

### Task 10: 플레이테스트 계측과 결정 리포트

**Objective:** 문서의 핵심 가설과 덤/AI/덱 밸런스를 실제 수치로 판단할 수 있게 한다.

**Files:**
- Create: `src/game/telemetry.ts`
- Update: `scripts/simulate.ts`
- Update: `scripts/balance.ts`
- Create: `tests/telemetry.test.ts`
- Create: `docs/playtest-report-template.md` only after implementation request/evidence start

**Metrics:** 대국 착수 수, 턴 고민 시간, 병종 선택/발동률, 일반석 선택률, 패스, 포획과 승률, 덱 크기와 승률, 판 크기별 흑 승률, 종료 시 죽은 돌 후보. 원시 이벤트는 개인식별정보 없이 로컬 JSON 다운로드로 제공하고 외부 분석 API를 추가하지 않는다.

### Task 10-1: 영구 해금 구조의 최소 골격

**Objective:** MVP에서 대규모 메타 진행 콘텐츠는 만들지 않되, 문서에서 확정한 ‘후보군 해금’ 계약을 직접 점수 강화 없이 표현한다.

**Files:**
- Create: `src/game/unlocks.ts`
- Create: `tests/unlocks.test.ts`

**Design:** `UnlockState` 순수 도메인 인터페이스는 해금된 돌·부적·유물 ID 집합만 보유하고 보상·상점 후보 생성기가 이를 필터로 받는다. 점수·덤·시작 패·냥을 직접 강화하는 필드는 두지 않는다. 실제 persistence, migration, 해금 조건과 속도는 MVP 이후이므로 구현하지 않는다.

### Task 11: 전체 회귀·모바일·오디오 수동 QA

**Objective:** 규칙 정확성, 재현성, 모바일 렌더링, 음악 전환을 실제 빌드에서 검증한다.

**Automated commands:**
```bash
npm test
npm run typecheck
npm run build
npm audit --omit=dev --audit-level=high
npm run benchmark:ai
npm run preview -- --host 0.0.0.0 --port 4173 --strictPort
npm run check:mobile
```

**Playwright 확장:**
- 380×800 및 430px에서 7×7/9×9 가로 overflow 없음
- 타이틀→지도→일반전→계가→보상→상점→보스 최소 경로
- 카드 선택 전 착수 차단, 불법수 이유, 패스/연속 패스
- console error, pageerror, request failure, bad response 0
- 네 BGM URL HTTP 200, 첫 gesture 전 재생 시도 없음, mute 버튼 상태
- `scripts/playwright-mobile-check.mjs`는 `PLAYWRIGHT_CHROMIUM_EXECUTABLE` 환경변수→Playwright 관리 Chromium→현재 Windows Chrome 탐색 순서로 실행 경로를 결정하고 `try/finally`에서 browser를 닫아 Windows 고정 경로 의존을 제거한다.

**Preview 실행 순서:** Hermes `terminal(background=true)`로 preview를 시작하고, `curl -sf http://127.0.0.1:4173/` readiness가 성공한 뒤 별도 foreground 호출에서 `BASE_URL=http://127.0.0.1:4173/ npm run check:mobile`을 실행한다. 보고서 저장을 확인한 후 추적된 process를 종료하고 4173 LISTENING 프로세스가 남지 않았는지 검증한다. preview와 Playwright를 한 shell의 순차 foreground 명령으로 실행하지 않는다.

**Manual audio QA:** 실제 Android/iOS 브라우저에서 첫 재생, 화면 간 페이드, 통화/백그라운드 복귀, 무음/볼륨 유지, 네 곡 반복 seam과 체감 음량을 청음한다. 자동 테스트만으로 음악적 루프 품질을 승인하지 않는다.

### Task 12: 독립 검증과 완료 게이트

**Objective:** 최신 frozen plan과 실제 diff를 fresh Claude verifier가 읽기 전용으로 1:1 검증한다.

**Steps:** implementation snapshot→verify-before→fresh Orca Claude verification→필요 시 Codex 수정→새 verifier→verify-after→post-verify→finalize→checksum 검증. `docs/`와 `music/`도 최종 manifest 및 라이선스 결정에 포함한다.

---

## 4. 권장 구현 순서와 커밋 경계

1. `test/feat: dynamic go board and scoring`
2. `feat: add cyclic stone deck`
3. `feat: add deterministic effect queue and stone kinds`
4. `feat: add battle flow and revival phase`
5. `feat: add map progression and economy`
6. `feat: migrate RoGolike screens`
7. `feat: integrate routed game music`
8. `test: add telemetry simulations and mobile e2e`

실제 commit/push는 사용자가 요청한 경우에만 하며 항상 `dev` 브랜치에서 수행한다. 각 경계 전에 focused RED→GREEN과 전체 테스트를 남긴다.

## 5. 주요 위험과 대응

- **명세 충돌:** 구형 테스트를 억지로 유지하면 신구 승패 규칙이 공존한다. 새 계약 테스트를 먼저 작성하고 구형 왕돌/주머니 테스트를 명시적으로 폐기한다.
- **9×9 AI 성능:** 모든 수의 깊은 탐색은 모바일을 막을 수 있다. 고정 후보 순서와 seeded heuristic을 유지하면서 평가 캐시·할당 감소·규칙을 보존하는 중복 계산 제거로 최적화하고 별도 p95 benchmark로 판정한다. wall-clock cutoff는 사용하지 않으며 필요할 때 Worker를 별도 gate로 둔다.
- **효과 복잡도:** UI와 엔진이 효과를 따로 계산하지 않는다. `resolveMove` dry-run 결과를 미리보기에 그대로 사용한다.
- **맵 불가능 경로:** 단순 랜덤 배치 후 UI에서 보정하지 않고 생성기 단계에서 모든 경로 불변식을 검증한다.
- **음악 autoplay:** mount 시 재생 금지, 첫 사용자 gesture unlock, play promise rejection 처리.
- **음악 루프 seam:** MP3의 0.4~0.8초 시작 무음과 상점 곡 끝 무음을 고려하고 실제 청음으로 루프 지점을 승인한다.
- **전송량/메모리:** 총 7.4MB를 전부 decode하지 않고 현재 곡 중심으로 lazy load한다.
- **라이선스:** Suno 태그가 있으므로 권리 확인 전 공개 배포 완료로 처리하지 않는다.
- **인지 부하:** 효과 미리보기와 패 선택을 점진적으로 노출하고 문서의 턴당 고민 시간/병종 무시율을 수집한다.

## 6. 완료 기준

- 최신 0.2.3의 확정 규칙이 테스트와 코드에서 1:1 추적된다.
- 7×7과 9×9 모두 포획·자충수·단순패·패스·면적 계가가 결정적으로 동작한다.
- 덱/패/버림/재순환/임시 일반석과 판 위 병종 분리가 검증된다.
- MVP 콘텐츠 수, 지도 5노드, 일반 전투 1~3개, 1막 부활, 2막 보스까지 플레이 가능하다.
- 네 곡이 지정 화면에서 사용자 gesture 이후 재생되며 mute/전환/복귀가 모바일에서 안전하다.
- 380px 모바일에서 가로 스크롤 없이 모든 핵심 조작이 터치 가능하다.
- 전체 테스트, 타입 검사, 빌드, audit, Playwright가 통과하고 fresh Claude 검증·evidence finalize가 완료된다.
- D-001~D-010의 인간 결정 또는 명시적 미결정 상태가 증적에 남는다.
