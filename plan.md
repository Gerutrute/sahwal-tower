# 계획 문서 (plan.md) — LLM/GPU Top-View 통합 프로젝트

> 상태: **초안 (인간 승인 대기)** — 작성 2026-07-19
> 준거: `docs/AGENTS.md` (본 프로젝트 선언 §0.1)

## 1. 요구사항 요약

- **목적**: 형제 프로젝트 두 개를 `llm_gpu_top_view_mockup/` 하나의 프로젝트로 통합한다.
  - `../top_view_mockup/` — Python exporter(동적 시뮬레이션, 3노드×4GPU×2MIG=24슬롯) + Prometheus + Grafana 단일 대시보드. 계약 **TV-C1**(메트릭 스키마)·**TV-C2**(대시보드 JSON)의 소유자. Phase 1~5 완료.
  - `../top_view_react/` — 같은 화면의 React 재구현(React 18 + TS + Vite, C3/D3). Prometheus HTTP API 직접 조회, TV-C1 **소비자**. Phase R1~R9 완료.
- **인간 확정 사항** (2026-07-19 계획 질의):
  1. **전부 이식** — exporter + Prometheus + React + **Grafana 포함** 전부를 한 프로젝트로. 두 UI(Grafana/React) 병행 유지.
  2. **도메인 유지** — 1차 통합은 기존 GPU/SQream 도메인 그대로. **LLM 모니터링 확장은 보류(Deferred, §8 DEF-U1)** 로만 명시하고 지금 설계하지 않는다.
  3. **U1 산출물은 문서 2건** — `docs/plan.md`(본 문서) + `docs/AGENTS.md`(재작성). 코드 이동은 U2 이후의 일이다.
- **Out of Scope**: 기능 추가·리팩터링(통합은 "이동 + 이동이 강제하는 최소 경로 보정"만), 실 SQream/GPU 연동, 인증/알람, LLM 화면 구현(DEF-U1 착수 전), `../mockup/`·`../top_view_mockup_원본/`·`../서류/` 변경.

## 2. 통합 범위 매핑 표

| 구 경로 (저장소 루트 기준) | 신 경로 (`llm_gpu_top_view_mockup/` 기준) | Phase |
| --- | --- | --- |
| `top_view_react/{src,tests,scripts,index.html,vite.config.ts,tsconfig*,package*,eslint.config.js,.env.example,.gitignore}` | `web/` (npm 루트) | U2 |
| `top_view_react/docs/{adr,retrospectives,reviews,design-tokens.md,evidence*}` | `docs/` 하위 동명 병합 | U2 |
| `top_view_react/docs/{plan.md,AGENTS.md}` | `docs/history/top_view_react-{plan,AGENTS}.md` (동결) | U2 |
| `top_view_react/{native,native-linux,docker-compose.yml,Dockerfile*,nginx*,README.md}` | 일단 `web/` 아래 그대로 → U4에서 통합 | U2→U4 |
| `top_view_mockup/{exporter,prometheus,grafana}` | 동명 최상위 (`exporter/`·`prometheus/`·`grafana/`) | U3 |
| `top_view_mockup/docs/architecture/db-schema.md` | `docs/architecture/db-schema.md` (**무수정 이동** — TV-C1 SoT) | U3 |
| `top_view_mockup/docs/{adr,retrospectives,reviews}` | `docs/` 하위 동명 병합 | U3 |
| `top_view_mockup/docs/{plan.md,AGENTS.md}` | `docs/history/top_view_mockup-{plan,AGENTS}.md` (동결) | U3 |
| `top_view_mockup/docs/architecture/system.md` + `top_view_react/docs/architecture/system.md` | `docs/architecture/system.md` **신규 병합 작성** (유일한 파일명 충돌 — 구 2건은 git 이력으로 보존) | U3 |
| `top_view_mockup/{native,native-linux,docker-compose.yml,README.md,.env.example}` | `native/`·`native-linux/`·`docker-compose.yml`·`README.md` 통합 | U3 이동 → U4 병합 |

- 문서 파일명은 두 프로젝트가 충돌하지 않음을 확인했다: 회고·리뷰 `phase-1..5-*` vs `phase-R1..R9-*`, ADR `0001~0008` vs `R-0001~R-0007`. 신규 ADR은 `0009+`, 신규 회고·리뷰는 `phase-U<N>-*`.
- 이관된 이력 문서(ADR·회고·리뷰)의 본문·경로 표기는 **수정하지 않는다**(EXC-U3). `docs/history/README.md` 1곳에 "2026-07-19 이전 문서의 상대 경로·검증 명령은 작성 당시 구 루트 기준"임을 고지한다.
- `node_modules/`·`dist/`·`coverage/` 등 미추적 산출물은 이동하지 않는다 — `web/`에서 `npm ci`로 재생성. **(2026-07-19 개정)** 구 폴더는 삭제하지 않고 **보존 버전**으로 상주한다(§7 결정).

## 3. 계약 소유권 표 (§5.1)

| 필드 | TV-C1 | TV-C2 | TV-C3 (신규 — 구 react RC-1 승격) |
| --- | --- | --- | --- |
| contract_id | TV-C1 | TV-C2 | TV-C3 |
| 설명 | 메트릭 이름·라벨 스키마 | Grafana 대시보드 JSON | React 소비 PromQL 레지스트리 |
| source_of_truth_path | `docs/architecture/db-schema.md` | `grafana/gen_dashboard.py` | `web/src/api/queries.ts` (`queryRegistry()`) |
| owner_role | exporter | grafana | web |
| owner_human_approver | 프로젝트 소유 개발자 | 프로젝트 소유 개발자 | 프로젝트 소유 개발자 |
| producer_paths | `exporter/exporter/metrics.py` | `grafana/gen_dashboard.py` | `web/src/api/queries.ts` |
| consumer_paths | `grafana/gen_dashboard.py` **및** `web/src/api/queries.ts` (2소비자) | `grafana/provisioning/dashboards/json/top-view.json`, `native/grafana/provisioning/` | `web/src/hooks/`·컴포넌트 (PromQL 하드코딩 금지 — queries.ts가 유일 정의처) |
| regen_command | (해당 없음 — 문서가 SoT) | `python grafana/gen_dashboard.py` | (해당 없음 — 코드가 SoT) |
| drift_check_command | `(cd exporter && pytest tests/test_contract.py)` **그리고** `(cd web && npm run test:contract)` | regen 후 `git diff --exit-code -- llm_gpu_top_view_mockup/grafana/provisioning/dashboards/json/` (저장소 루트 기준) | `cd web && npm run test:contract` |
| 버전 | **v3.0** (2026-07-19, `llm_*` 네임스페이스 additive 추가 — DEF-U1 해제. v2.0(MIG)까지의 기존 메트릭은 불변) — 개정 이력은 db-schema.md 마이그레이션 절 | — | — |

- **TV-C2 확장 (2026-07-19)**: TV-C2는 "Grafana 대시보드 JSON **집합**"으로 확장한다 — SoT 생성기 2개: `grafana/gen_dashboard.py`(uid `tv-gpu-sqream`, 기존·무수정)와 `grafana/gen_llm_dashboard.py`(uid `tv-llm`, Phase L2 신규). regen은 두 생성기 순차 실행, drift_check는 기존 명령 그대로(json 디렉터리 단위라 두 파일 모두 커버). 검증기도 각 1개(`check_dashboard.py`·`check_llm_dashboard.py`).

- **TV-C3의 본질**: web이 실행하는 전 PromQL은 `queryRegistry()`에 등록되어야 하고 TV-C1의 부분집합이어야 한다. SoT는 queries.ts이되 **TV-C1에 종속(소비)** 이다. 구 react AGENTS의 `owner_role=external`은 폐기한다 — 통합 후 계약 소유자(exporter)가 같은 프로젝트 안에 있다.
- **TV-C1 변경 절차 (통합의 핵심 이득)**: 계획 문서 경유 + **한 커밋 안에서 3자 검증 전부 green** — ① `(cd exporter && pytest tests/test_contract.py)` ② `python grafana/gen_dashboard.py && python grafana/check_dashboard.py` + 드리프트 0 ③ `(cd web && npm run test:contract)`.
- **web 계약 테스트의 SoT 경로 변천** (`web/tests/queries.contract.test.ts`의 `SCHEMA` 상수):
  - 현재: `resolve(HERE, "../../top_view_mockup/docs/architecture/db-schema.md")`
  - U2(임시): `"../../../top_view_mockup/docs/architecture/db-schema.md"` — `web/tests/`에서 저장소 루트로 3단계
  - U3(최종): `"../../docs/architecture/db-schema.md"` — 통합 docs. 파일 헤더 주석의 SoT 표기도 동시 갱신.

## 4. 아키텍처 산출물 상태 (§3.4)

| 산출물 | 경로 | 상태/계획 |
| --- | --- | --- |
| DB 스키마 (TV-C1 + RDB N/A) | `docs/architecture/db-schema.md` | U3에서 무수정 이동 (이동 자체가 계약 개정이 아님 — 내용 diff 0) |
| 시스템 아키텍처 | `docs/architecture/system.md` | U3에서 신규 병합 작성 — 전 스택 mermaid(exporter → Prometheus → {Grafana, React} → 브라우저), 실행 3모드, 머리말에 구 2건의 출처 커밋 명기 |
| 디자인 토큰 | `docs/design-tokens.md` | U2에서 이동 (`web/src/styles/tokens.css`와 테스트 대사 유지) |
| ADR | `docs/adr/` (`0001~0008` + `R-0001~R-0007`) | U2·U3에서 병합 이동, 번호 재부여 금지(구 리뷰·회고가 인용), 신규는 `0009+` |
| 이력 거버넌스 | `docs/history/` | U2·U3에서 구 plan/AGENTS 2쌍 격리 + `README.md` 고지문 |

## 5. Phase 분해 (§6.2 닫힌 게이트)

각 Phase 공통 종료 게이트: 구현 → 테스트/린트/커버리지(§3.3, 발효된 영역 전부) → codex 리뷰(`docs/reviews/phase-U<N>-codex-review.md`) → 지적 전건 처리(`-resolution.md`) → 회고(`docs/retrospectives/phase-U<N>-*.md`) → dev 커밋. 스코프 검증 `SCOPE=llm_gpu_top_view_mockup/` (이행기 rename 예외는 EXC-U2).

### 선행 게이트 P0 — U2 착수 전 완료 필수 (Phase 아님)

- [x] `top_view_react/` 워킹트리 미커밋 변경(MIG 필터 드롭다운, 14파일) 해소 — 구 프로젝트 마지막 커밋 `d038446`으로 완주 (테스트 287 green 재확인 후)
- [x] `top_view_react/.git` **빈 디렉터리** 제거 (2026-07-19)
- [x] 이행기 중 구·신 스택 **동시 기동 금지** 확인 — 이관 전 구 스택(native 3프로세스)·Vite dev 서버(5173) 정지 후 전 포트 해제 확인

### Phase U1 — 통합 거버넌스 문서 (본 세션)

- **목표**: 통합 프로젝트의 거버넌스·로드맵을 확정한다. 코드 이동 없음.
- **작업/산출물**: `docs/plan.md`(본 문서, 신규), `docs/AGENTS.md`(재작성 — 두 형제 AGENTS의 상위 집합, 신 루트 기준).
- **수락 기준**:
  - [x] 문서 2건 존재 + AGENTS.md 스코프 선언이 신 루트: `grep -q "SCOPE='llm_gpu_top_view_mockup/'" docs/AGENTS.md`
  - [x] 구 루트 스코프 잔존 0: `! grep -nE "SCOPE='top_view_(mockup|react)/'" docs/AGENTS.md`
  - [x] 계약 표 §5.1 필수 8필드 완비: `for f in contract_id source_of_truth_path owner_role owner_human_approver producer_paths consumer_paths regen_command drift_check_command; do grep -q "$f" docs/plan.md || exit 1; done`
  - [x] codex 교차 리뷰·처리 기록 — EXC-U4에 따라 U2~U4와 통합 1회(`docs/reviews/phase-U2-U4-*`), 회고 `docs/retrospectives/phase-U2-U4-*`, 인간 승인(§7) 후 dev 커밋 `030b6f2`
- **의존성**: 없음

### Phase U2 — React 앱 이관 (react 먼저)

- **목표**: `top_view_react/` 전체를 `web/`과 통합 `docs/`로 이동하고, 모든 커밋 시점에 web 스위트를 green으로 유지한다.
- **순서 근거**: exporter를 먼저 옮기면 TV-C1 SoT(db-schema.md)가 함께 가면서 구 위치 react 계약 테스트가 죽고, 고치려면 구 폴더 동결 원칙을 깨야 한다. react를 먼저 옮기고 **임시로 구 SoT를 바라보게** 하면 전 커밋 시점 양쪽 스위트가 green이다.
- **작업/산출물**: §2 매핑 표의 U2 행 전부 `git mv`. `web/tests/queries.contract.test.ts` SCHEMA 경로 **임시** 조정(`../../../top_view_mockup/docs/architecture/db-schema.md`). `docs/history/` 생성 + 고지 README. **이동 + 이동이 강제한 최소 경로 보정만 한 커밋**(rename 검출 보존).
- **수락 기준**:
  - [x] `cd web && npm run lint && npm run typecheck && npm run test && npm run build` 전부 exit 0 (287 tests — node_modules 물리 이동으로 npm ci 불필요)
  - [x] git 이력 보존 표본: App.tsx가 rename을 넘어 R9 커밋까지 추적됨 (`git log --follow`)
  - [x] 구 폴더 잔존 추적 파일 0: `git ls-files top_view_react/` = 0 (커밋 `7c93d7c`, rename 113건)
  - [x] 스코프 검증 통과 (EXC-U2 적용 — 스코프 밖 변경은 공유 인프라 루트 `.gitignore` 2줄뿐, 회고 HCI 기록)
- **의존성**: P0, U1

### Phase U3 — Python 스택·계약 SoT 이관

- **목표**: exporter/prometheus/grafana와 TV-C1 SoT를 이동하고, SCHEMA 경로를 최종 형태로 확정한다.
- **작업/산출물**: §2 매핑 표의 U3 행 전부 `git mv`. SCHEMA 경로 **최종** 조정(`../../docs/architecture/db-schema.md`) + 테스트 헤더 주석 갱신. TV-C2 드리프트 명령 경로 갱신. `docs/architecture/system.md` 신규 병합 작성(mermaid).
- **수락 기준**:
  - [x] `cd exporter && ruff check . && mypy . && pytest --cov=exporter --cov-fail-under=80` exit 0 (41 tests, 98.66% — 시스템 Python 3.14)
  - [x] `python grafana/gen_dashboard.py` 후 드리프트 0 + `python grafana/check_dashboard.py` exit 0 (12패널·4변수)
  - [x] **web 게이트 재실행**: `cd web && npm run test && npm run build` exit 0 (최종 SCHEMA 경로 검증)
  - [x] db-schema.md 무수정 이동 확인: `rename (100%)` (커밋 `ee14c1b`)
  - [x] system.md 병합본 mermaid 블록 존재 (구 2건은 git 이력 보존 — mockup판은 재작성으로 유사도 하락해 delete+create 기록, react판은 delete)
  - [x] 구 폴더 잔존 추적 파일 0: `git ls-files top_view_mockup/` = 0
- **의존성**: U2

### Phase U4 — 실행 모드 통합

- **목표**: 실행 3모드(docker-compose / Windows 네이티브 / RHEL air-gapped)를 한 세트로 합치고 구 경로 하드코딩을 제거한다.
- **작업/산출물**: docker-compose 단일화(exporter+prometheus+grafana+web 4서비스). `native/`(ps1)·`native-linux/`(sh+systemd) 병합 — `serve-react-linux.sh` 기본 dist `$HERE/../web/dist`, systemd 유닛 `/opt/llm_gpu_top_view_mockup/...`, 반출 패키징 스크립트 단일 세트화. `web/` 아래 임시 보관하던 실행 파일들을 최상위로 흡수. README 통합. 루트 `.gitignore` 산출물명 갱신.
- **수락 기준**:
  - [x] `docker compose config` exit 0 (4서비스: exporter·prometheus·grafana·web)
  - [x] `powershell -File native/verify-native.ps1` **ALL CHECKS PASSED** — 통합 위치에서 스택 재기동 후 실측, 웹(8082) 체크 포함(web-serve 기동 상태에서 OK·미기동 시 선택 스킵 동작 확인). `web-verify.ps1`도 전 항목 OK(CORS·하드코딩 없음)
  - [x] 전 셸 스크립트 구문 `bash -n` exit 0 + 수정 ps1 3종 파서 검사 0오류
  - [x] 구 경로 하드코딩 0 (추적 파일 기준, 신 이름 부분 문자열·README 이력 언급 1건 제외. 미추적 런타임 잔재(.venv activate·과거 로그)의 구 경로는 회고 HCI 기록)
- **의존성**: U3

### Phase U5 — 전역 정합 마감 (구 폴더 삭제 **철회** — §7 2026-07-19 결정)

- **목표**: 저장소 전역의 참조 정합을 마감한다. **구 폴더 삭제는 철회** — `top_view_mockup/`·`top_view_react/`는 버저닝용 **보존 버전(동결·독립 기동 가능)** 으로 저장소에 상주한다(복원 커밋 `8c7200e`, 태그 `pre-integration`, 스왑 테스트로 기동성 실측 완료). **착수 조건: deploy/ 처리 방침의 인간 확정(HCI-U-1 잔여 — docker-kit 방침은 §7 2026-07-19 D1로 확정: 루트 킷 동결, 통합 킷 `docker-kit/` 신설)**.
- **작업/산출물**: `deploy/` 파일들의 구 경로 참조 처리(경로 갱신 vs 동결·폐기 — 인간 결정. 루트 `docker-kit/`은 구 스택용 동결 확정·수정 금지). 저장소 전역 참조 스캔(제외: 보존 폴더 2개·루트 `docker-kit/`·`docs/history/`·이관 이력 문서·`top_view_mockup_원본/`, 신 이름 부분 문자열 오탐은 치환 후 검사). 루트 `.gitignore` 사어 항목 정리.
- **수락 기준**:
  - [ ] deploy/ 방침 확정·반영 (docker-kit: 동결 확정 — §7 D1)
  - [ ] 전역 스캔: 통합 프로젝트 추적 파일에서 구 경로 참조 0건 (위 제외 목록 적용)
  - [ ] 루트 `.gitignore` 정리
- **의존성**: U4, 인간 결정(HCI-U-1 잔여). (E2E 실측은 U4에서 완료 — 재기동 검증 불요)

### Phase L1 — 계약 TV-C1 v3.0 + LLM 시뮬레이션 (DEF-U1 해제, 시안 `../서류/llm_dashboard.pptx`)

- **목표**: `llm_*` 메트릭 10종을 additive로 계약에 추가하고 동적 시뮬레이션으로 생산한다. 기존 메트릭·기존 소비자(두 대시보드·web) 무수정.
- **작업/산출물**: `docs/architecture/db-schema.md` §6(LLM 메트릭·워크로드 카탈로그 8종·카디널리티 상한 52)·타입 표·v3.0 개정 이력 추가. `exporter/exporter/{llm_params,llm_sim}.py` 신규(서비스 4종 홈 슬롯=gpu-server-01 GPU-0~3, 장수 상주+재시작 창, 단명 배치 포아송, GPU당 동시 1워크로드). `metrics.py` CONTRACT 10종 추가. `main.py` GPU 부하 `max(query_load, llm_load)` 결합(인간 확정 §7 — DCGM **값 거동**은 변할 수 있음, 스키마·기존 소비 쿼리는 불변). `tests/test_contract.py` 접두사 `llm_` + EXPECTED 10종, `tests/test_llm_sim.py` 신규(GPU당 1워크로드·상한 52·종료 remove·재현성·포화 비율).
- **수락 기준**:
  - [x] `cd exporter && ruff check . && mypy . && pytest --cov=exporter --cov-fail-under=80` exit 0 (50 tests, 98.93% — 커밋 `5b9ec70`)
  - [x] additive 증명 3자: 기존 대시보드 regen 드리프트 0 + check OK + web 계약 41 green — **기존 소비자 무수정**
  - [x] llm 계약 대사 편입: test_llm_metrics_included(10종·mig 금지) 단언
- **의존성**: 본 계획 승인(§7)

### Phase L2 — Grafana `tv-llm` 대시보드

- **목표**: 시안 ①~⑥을 두 번째 대시보드로 재현한다. 기존 `gen_dashboard.py`·`top-view.json` 무수정.
- **작업/산출물**: `grafana/gen_llm_dashboard.py`(uid `tv-llm`, 변수 env/instance/gpu — mig 없음, table ①(pid 조인)·table ②(service 조인)·state-timeline ③(0~8)·text+stat ④(8항목)·timeseries ⑤ 4스트립(`avg/sum by(node,gpu)`)·gauge ⑥ 3장, tv-gpu-sqream 링크는 tv-llm 쪽만) + `check_llm_dashboard.py`(llm_ 접두사 포함 계약 대사).
- **수락 기준**:
  - [x] gen_llm+check_llm exit 0 (12패널·3변수·계약 25종 대사), 멱등(sha256 동일) — 커밋 `69f6556`
  - [x] 기존 생성기·JSON 무수정 + 디렉터리 드리프트 0
  - [x] 스택 실측: 프로비저닝 2대시보드 확인, datasource 경유 llm 타임라인 12시리즈 조회, exporter llm 66시리즈 노출
- **의존성**: L1

### Phase L3 — React GPU/LLM 화면 (`#/llm`)

- **목표**: 시안 화면을 React 두 번째 화면으로 구현한다. 의존성 무추가, 기존 화면 회귀 0.
- **작업/산출물**: `web/src/hooks/useRoute.ts`(해시 `#/llm`) + `useFilters.ts` replaceState 해시 보존 1줄. `App.tsx` 라우터 셸화 — 본문을 `screens/GpuDashboard.tsx`로 무변경 추출 + `screens/LlmDashboard.tsx` 신규. `Sidebar` — "GPU/LLM 모니터링" 링크 추가(활성 표시), "인스턴스별 GPU" 유지(인간 확정). `queries.ts` — `llmSelector`·`LLM_CATALOG`·팩토리 6종 + `queryRegistry()` 등록. `queries.contract.test.ts` 파서 `llm_` + MANIFEST 25종 단언. 훅 3종(`useLlmData`/`useLlmCharts`/`useLlmRangeDetail`) 미러. 컴포넌트: `tables/{LlmProcesses,LlmServices}`·`detail/LlmRangeDetail` 신규, `Timeline` 파라미터화(기본값=현행)·`MetricStrip`·`ServerGauges` 재사용, `lib/colors.ts` `LLM_CATEGORY_COLORS`(기존 hex), `docs/design-tokens.md` LLM 절 추가. 신규 테스트(라우팅·해시 보존·조인·타임라인·링 카드).
- **수락 기준**:
  - [x] `cd web && npm run lint && npm run typecheck && npm run test:coverage && npm run build` exit 0 (커버리지 98/90.9/98/99 — 커밋 `bd85ff9`)
  - [x] 계약 대사: MANIFEST 25종·llm 팩토리 7종 registry 등록 단언 green
  - [x] 기존 스위트 전건 green — 테스트 312(기존 287 회귀 0)
- **의존성**: L1 (L2와 병행 가능)

### Phase L4 — 마감 (문서·ADR·E2E)

- **목표**: 산출물 문서·증거를 정리하고 전 실행 모드 재검증한다.
- **작업/산출물**: `README.md`·`docs/architecture/system.md`(mermaid에 tv-llm·`#/llm`) 갱신, ADR `0009-llm-timeline-workload-encoding.md`·`0010-hash-routing-two-screens.md`, evidence 캡처(Grafana tv-llm·React `#/llm`), plan.md 체크박스 갱신.
- **수락 기준**:
  - [x] `verify-native.ps1` **ALL CHECKS PASSED** (대시보드 2/2 정확 집합 + llm 메트릭 스팟체크 추가 — PS 5.1 배열 미열거 함정 수정 포함) + `docker compose config` exit 0
  - [x] 실측: 서빙 번들에 LLM 화면 포함(`:8082`), Grafana tv-llm 조회, 기존 대시보드·화면 회귀 없음
  - [x] 산출물: system.md(통합 mermaid 갱신)·db-schema.md §6·design-tokens §1.5b·ADR 0009/0010 존재
- **의존성**: L2, L3

### Phase X1 — 계약 TV-C1 additive: 쿼리 완료 이벤트 메트릭 (X-View 데이터) — **구현 완료 (2026-08-13, 커밋 d482e47)**

- **배경 (2026-08-13 인간 지시)**: GPU/SQream 화면 ③구역 우측의 **"시간구간"(TimeRangePanel) + "선택 구간 상세정보"(RangeDetail) 패널을 제니퍼 X-View 방식 산점도로 교체**한다(점 1개 = 완료 쿼리 1건, X=종료 시각, Y=소요시간). 타임라인 패널은 유지하며, 타임라인 브러시 선택 → X-View가 해당 구간을 표시하는 드릴다운 흐름. 현행 계약에는 완료 이벤트 메트릭이 없어(`sqm_statement_duration_seconds`는 실행 중에만 존재·종료 틱 remove, `sqm_statement_failed_timestamp`는 실패 최근 12건뿐, 성공 이벤트 전무) additive 확장이 선행돼야 한다.
- **목표**: 완료된 statement의 (종료 시각, 소요시간, 성공/실패)를 bounded ring으로 노출한다.
- **작업/산출물**: `query_sim._finish_expired()`에서 완료 시 게이지 2종 발행 — `sqm_statement_completed_timestamp{env,node,gpu,mig,stmt_id,query_id,sqream_user,query_name,status,reason}`(값=종료 epoch) · `sqm_statement_completed_duration_seconds{동일 labelset}`(값=소요초). `status="success"|"failed"`, `reason`은 기존 `FAIL_REASONS` 재사용(성공은 빈 값). `_failed` deque 패턴(`FAILED_KEEP=12`) 복제 — `COMPLETED_KEEP=60`. SoT `docs/architecture/db-schema.md` additive 갱신 + `exporter/exporter/metrics.py` CONTRACT **및 `_HELP` 2건**(XR-01) + `exporter/tests/test_contract.py` EXPECTED·개수 단언 갱신.
- **소비 의미론 (XR-02·XR-03 반영)**: `COMPLETED_KEEP=60`은 **현재 노출(exposition) 상한일 뿐**이다 — 완료율(도착률 합 ~10.8건/분)에서 링 한 바퀴는 ~5.6분으로 스크레이프 5s를 크게 웃돌아 **모든 완료 이벤트가 TSDB에 최소 1회 샘플링됨을 보장**한다. 시간창 재구성은 web이 **range 쿼리(`/query_range`)로 (라벨셋, 값=종료 epoch) 전환을 복원**하는 방식으로 한다(instant 조회는 최근 ~5.6분만 보이므로 금지). stmt_id 풀(72개) 재사용으로 동일 라벨셋의 값이 갱신되는 것은 range 복원에서는 정보 손실이 아니다(과거 샘플은 TSDB에 잔존). dedupe 키 = (전체 라벨셋, 종료 epoch 값). **동일 라벨셋이 링에 2회 존재할 때 오래된 엔트리 퇴출이 최신 게이지를 지우지 않도록 참조계수(또는 재등록 시 퇴출 스킵) 처리**한다.
- **행동 테스트 (XR-05 반영)**: 완료 시 양 메트릭 동시 발행·값(종료 epoch/소요초) 정확성·reason 매핑·`COMPLETED_KEEP` 상한 유지·퇴출 시 양쪽 remove·동일 라벨셋 재사용+퇴출 경합(참조계수) — `exporter/tests/test_query_sim.py`(또는 신규 파일)에 단위 테스트로 추가.
- **수락 기준**:
  - [x] 3자 검증 전량 green: exporter 계약 테스트(100 passed에 포함) + gen/check 드리프트 0(12패널·4변수·51쌍) + web test:contract 74 passed (MANIFEST 66종)
  - [x] exporter 게이트: ruff 0 · mypy 0 (mypy 2.1 기존 드리프트 8건을 동일 커밋에서 최소 보정 — 변수 섀도잉 리네임·유니언 분기·주석 1건, 로직 불변) · pytest 100 passed · 커버리지 99.32%
  - [x] 기존 메트릭 이름·라벨·타입 불변(additive-only — v4.5는 §2b 2종 추가뿐, 기존 소비자 무수정·드리프트 0으로 입증)
- **의존성**: 없음(L4 완료 기반). **Grafana 대시보드(TV-C2)에는 미적용** — React 전용 소비(이벤트 산점도는 시안 재현 범위 밖, 인간 확인 대상).

### Phase X2 — React X-View 패널 (detail-col 교체) — **구현 완료 (2026-08-13, 커밋 063320b)**

- **목표**: `.detail-col`의 `TimeRangePanel`+`RangeDetail`을 X-View 산점도 패널 1개로 교체한다. 그리드 18fr/6fr·`--dashboard-middle-h: 264px` 예산 유지.
- **작업/산출물**: `components/charts/XViewChart.tsx`(D3 v7 — `Timeline.tsx`의 고정 viewBox·콜백 ref 패턴 복제, ADR R-0002 d3 격리 준수) + `lib/xview.ts`(range 응답에서 (라벨셋, 종료 epoch) 전환 복원·dedupe·구간 필터 — 순수 함수) + **신규 훅 `useXViewEvents`**(range 쿼리 2종 폴링 → 이벤트 목록. XR-04: `useRangeDetail` 재사용으로는 실패 건수·완료 duration 평균을 만들 수 없음) + `XViewPanel`(헤더 요약행: 선택 구간·N건·에러 n건·평균 소요 — **표시 중인 동일 이벤트 집합에서 계산**, 교체로 제거되는 기존 `useRangeDetail` 폴링은 중단). 동작: 브러시 선택 없음=현재 시간범위 전체, 선택 있음=구간 줌·구간 밖 점 제외(`useRangeSelection` 구독). 점 색=`QUERY_TYPE_COLORS` 6색 재사용, **실패=✕ 마크(모양이 1차 채널 — `--qt-fullscan`과 `--danger`가 동일 hex `#f87171`이므로 색만으로는 풀스캔과 실패를 구분할 수 없음)**, 신규 색 토큰 0. `queryRegistry()`에 **range 쿼리 2종** 등록(TV-C3, TV-C1 부분집합). 테스트: `xview.test.ts`(전환 복원·dedupe·구간 필터)·`xviewRender.test.tsx`(점 수·색·✕·selection 재발화 금지 — timelineRender 패턴)·`layout.contract.test.tsx` detail-col 단언 갱신.
- **재검증(X-plan-2) 반영**: ① NX-01 — `useXViewEvents`는 두 range 쿼리를 **공통 `endMs`·동일 `stepSec`·동일 AbortSignal**로 호출하고, **timestamp 전환을 기준**으로 동일 평가시각의 duration 샘플을 결합한다(듀레이션 값이 연속 동일해 전환이 없는 경우 대비 — 결합 규칙 단위 테스트 포함). ② NX-02 — 훅은 기존 폴링 상태 계약을 승계한다: `failStreak`·`lastSuccessAt` 반환, 연속 3회 실패 시 이벤트 클리어(행동 테스트 포함). ③ NX-03 — `.detail-col` 그리드 단언은 **GPU 화면 전용 modifier**(예: `.detail-col--xview` 1행)로 분리하고, LLM 화면(`#/llm`)의 기존 2행 규칙 단언은 그대로 유지한다(LLM 화면 회귀 0 보장).
- **수락 기준**:
  - [x] `cd web && npm run lint && npm run typecheck && npm run test:coverage && npm run build` exit 0 (테스트 592 passed·커버리지 임계 통과 — 1회 플레이크 후 연속 2회 green, 회고 기록)
  - [x] 계약 대사: `xviewEvents` range 2종 registry 등록 + MANIFEST 66종 대사 — test:contract 74 passed
  - [x] 기존 스위트 회귀 0 (전 588→592) · 타임라인 패널(③) diff 0 (인간 지시 불가침 — Timeline.tsx·lib/timeline.ts 무수정 확인) · LLM 화면 무변경(.detail-col 2행 규칙 유지, NX-03)
  - [x] 기동 직후 완료 이벤트 0건 상태에서 빈 상태 문구 표시(백필 없음) — xviewRender 테스트 + 구현
- **의존성**: X1
- **인간 확인 항목(Design, 착수 전 확정)**: ① TimeRangePanel을 요약행으로 완전 흡수 여부 ② 18fr/6fr 폭 비율 유지 여부 ③ 점 색상 규칙(유형 6색 vs 단색+에러 구분) ④ 통합 브랜치(dev 원칙 vs 현재 feat/handoff-20260807)

### Phase X3 — X-View 호버 툴팁 확장: 생애주기 누적 막대 + Node + 실패 유형/발생 시점 — **승인 (2026-08-14 인간 지시·플랜 모드 확정)**

- **배경**: 호버 툴팁(X2-f1)에 ① Node(서버) 행(워커 위) ② 100% 누적 가로 막대 `Preparing → In Queue → Initializing → Executing → Completed` ③ SQream 가이드의 실패 유형↔발생 시점 표 반영. **불변 제약(인간 확정)**: X-View 산점도(점 Y=실행시간·개수·색·✕)·타임라인·시뮬레이션 거동 무변경, 실패 reason 열거형 불변(기존 5종) — 확장은 툴팁 표시 내용뿐.
- **계약(TV-C1 v4.6, additive)**: `sqm_statement_completed_phase_seconds{기존 10라벨 + phase}` Gauge 1종 — `phase ∈ preparing|queued|initializing|executing`(이벤트당 4시리즈), 링 퇴출 시 기존 2종과 동반 remove(참조계수 키=phase 제외 라벨셋), 누적 ≤ 324×4. 소비는 range 복원만(§2b 준용). Grafana(TV-C2) 미적용.
- **exporter**: 큐 항목에 제출 시각 추가 → In Queue 실측(배정·실행 로직 불변). Preparing 0.4~2.5s·Initializing 0.3~1.5s stmt_id 해시 결정론 합성(타임라인·실행 지속 무영향). `_record_completed()`에서 phase 4시리즈 발행. 행동 테스트 5건.
- **web**: `xviewEvents()` phases expr(레지스트리 range 3종, MANIFEST 67종), `restoreEvents` phase 조인(짝 없으면 phases=null·이벤트 유지), `lib/failureStages.ts`(가이드 8유형 전체 수록·조회는 기존 reason 5종), 툴팁 개편(누적 막대 4세그먼트+단계별 초·Completed 시각/상태·실패 단계 `--danger` 강조·유형/쉬운 설명·Node 행 `displayNode()` 재사용·폭 260px). **차트(점·축·색) 무변경.**
- **수락 기준**:
  - [x] exporter 게이트(ruff 0·mypy 0·pytest 101 passed) + 3자 검증(계약 테스트 green·grafana 드리프트 0·web test:contract 74 passed — MANIFEST 67종) 
  - [x] web 게이트(lint·typecheck·vitest 615 passed·build) green — X3 신규/변경 파일 파일별 임계 충족(전역 게이트의 기존 14파일 미달은 pre-X 기준선(d61d6d8)에서 동일 수치 재현 확인 — pre-existing, 회고 HCI)
  - [x] 산점도·타임라인 렌더 무변경(기존 테스트 회귀 0 — 점 개수·색·✕·Y축 단언 그대로) · reason 열거형 불변(5종)
  - [x] 실측: phase 메트릭 적재 확인 + 호버 캡처 3장(성공·실패·클릭 고정) 인간 전달 — 실측이 결함 2건(패널 클리핑 `cfd1f9f`, 캡처 캐시)을 추가 발견·해소
  - [x] 후속(인간 지시): 툴팁 클릭 고정/해제 `d0b54a8` — 바깥 클릭·Esc 해제, 고정 중 텍스트 복사 가능
- **의존성**: X2-f1 (커밋 6b6b03d)

## 6. Cross-Review 기록 (§3.1)

### 6.1 초안 작성

Claude Code (model_id `claude-fable-5`), 2026-07-19 — 세 폴더 탐색(구조·계약 결합점·git 상태) + 통합 설계 종합. 인간 개발자가 플랜 모드에서 통합 방침 3건(§1)을 질의·확정한 뒤 본 문서를 작성했다.

### 6.2 독립 교차 검증 (타 모델)

| 회차 | reviewer / model / session | 검토 대상 draft SHA-256 | 검토 시각 (UTC) | 결과 |
| --- | --- | --- | --- | --- |
| — | (U1 종료 게이트에서 수행 예정 — codex 플러그인, Claude와 상이한 모델·실행 주체) | — | — | `docs/reviews/phase-U1-codex-review.md`에 기록 |
| X-plan-1 | codex exec / codex-cli 0.147.0 (GPT-5 계열, reasoning=high, 독립 실행 주체 — Primary Planner=claude-fable-5와 상이) | `74cef166451b8e39e8c1cda6cab9f81772148675ec46f6e3d5b6a28e288c24ce` (plan.md @ 60ccca4) | 2026-08-13T04:55Z | XR-01~08 (blocking 3·major 2·minor 3) — `docs/reviews/phase-X-plan-codex-review.md`. 반영으로 draft 변경 → X-plan-2로 재검증 |
| X-plan-2 | codex exec / codex-cli 0.147.0 (동일 구성, 독립 세션 재실행) | XR 반영 워킹트리 (커밋 전 — 최종 해시는 커밋 메시지·§6.3 수렴 규칙 참조) | 2026-08-13T05:0xZ | XR-01~05 **전건 resolved · 미해결 blocking 0** + 신규 major 3(NX-01~03, 즉시 반영) — `docs/reviews/phase-X-plan-codex-resolution.md`. NX 반영으로 draft 재변경 → **X1 착수 직전 최종 해시 기준 확인 리뷰 1회 재실행**(수렴 규칙) |
| X3-plan | codex exec / codex-cli 0.147.0 (reasoning=low — 확인 목적 경량, 독립 세션) | plan.md Phase X3 절 (2026-08-14 등재본) | 2026-08-14 | **지적 없음 · 미해결 blocking 0** — 불변 제약↔작업 항목 모순 없음, phase 메트릭이 §2b 링/참조계수/range 복원 의미론과 정합 |
| X-plan-3 | codex exec / codex-cli 0.147.0 (reasoning=medium — 확인 목적 경량 재실행, 독립 세션) | `9c238a6fceb125a45971f08bc25302887ebb891028f307c1485996184dbac485` (plan.md, §7 승인 기록 반영본) | 2026-08-13T06:0xZ | **수렴 확인 완료**: XR-01~05·NX-01~03 전건 resolved 유지 · 신규 blocking 0 · 해시 일치. exporter 실코드(_finish_expired·CONTRACT/_HELP·도착률·stmt_id 풀) 대조 모순 없음 → **X1 구현 착수 게이트 통과**. 이후 §6.2/6.3 감사 기록 추가는 X1/X2 절 본문 불변 |

### 6.3 이의 처리 (Adjudication)

교차 검증 수행 후 각 지적을 **Accepted / Rejected / Escalated**로 분류해 여기에 기록한다. Rejected는 근거 필수.

**X-plan-1 (XR-01~08) 처리** — 상세는 `docs/reviews/phase-X-plan-codex-resolution.md`:

| ID | 판정 | 반영 |
| --- | --- | --- |
| XR-01 (`_HELP` 누락) | Accepted | X1 산출물에 `_HELP` 2건·import/수집 테스트 명시 |
| XR-02 (링 60건으로 30분 창 재구성 불가) | Accepted | X1에 "소비 의미론" 절 신설 — instant 금지, range 쿼리로 (라벨셋,값) 전환 복원. KEEP=60은 노출 상한(한 바퀴 ~5.6분 ≫ 스크레이프 5s) |
| XR-03 (stmt_id 재사용·퇴출 경합) | Accepted | range 복원으로 덮어쓰기 무해화 + 동일 라벨셋 퇴출 참조계수 처리 명시 |
| XR-04 (`useRangeDetail` 재사용 불가) | Accepted | X2를 신규 훅 `useXViewEvents`로 교체, 요약행은 표시 이벤트 집합에서 계산 |
| XR-05 (행동 테스트 부재) | Accepted | X1에 행동 테스트 목록 추가 |
| XR-06 (목업 데이터가 시뮬 불변식과 불일치) | Accepted(구현 지침) | 목업은 제안 시각화용으로 동결. X2 구현은 실데이터(실제 stmt_id 풀·결정론 실패 규칙) 사용이므로 자연 해소 — 구현 시 재현 금지 항목으로 기록 |
| XR-07 (`preserveAspectRatio="none"` 왜곡) | Accepted(구현 지침) | 실제 구현은 Timeline.tsx 고정 viewBox 패턴이라 미해당. 목업 파일은 증거로 동결 |
| XR-08 (데모 드래그 clamp 부재) | Accepted(구현 지침) | 학습용 데모 한정 결함. X2 구현은 d3.brushX(extent로 plot 경계 강제) 사용이라 미해당 |
| NX-01 (두 range 응답 결합 규칙 부재) | Accepted | X2 "재검증 반영" ① — 공통 endMs·stepSec·signal, timestamp 전환 기준 결합 |
| NX-02 (폴링 상태 계약 미승계) | Accepted | X2 "재검증 반영" ② — failStreak·lastSuccessAt·3회 실패 클리어 |
| NX-03 (detail-col 셀렉터 LLM 공유) | Accepted | X2 "재검증 반영" ③ — GPU 전용 `.detail-col--xview` 1행, LLM 2행 단언 유지 |

## 7. 인간 승인 기록

| 날짜 | 승인자 | 대상 | 결과 |
| --- | --- | --- | --- |
| 2026-07-19 | 프로젝트 소유 개발자 | 통합 방침 3건 — ① 전부 이식(Grafana 포함, 2 UI 병행) ② 도메인 유지·LLM은 Deferred ③ U1 산출물은 문서 2건 | **승인** (플랜 모드 질의 확정) |
| 2026-07-19 | 프로젝트 소유 개발자 | **통합 실행 승인** — 게이트 수위는 간소 진행(EXC-U4), 범위는 **U4까지**(U5는 별도 세션 재승인), 푸시는 마지막 1회 | **승인** (플랜 모드 질의 확정) |
| 2026-07-19 | 프로젝트 소유 개발자 | **구 폴더 보존 결정** — 버저닝 목적으로 `top_view_mockup/`·`top_view_react/`를 이관 직전 상태(`d038446`)의 추적 동결 버전으로 복원(독립 기동 가능, 스왑 테스트 실측). **U5의 '구 폴더 삭제' 철회** | **승인** (인간 지시 — 복원 커밋 `8c7200e`, 태그 `pre-integration`) |
| 2026-07-19 | 프로젝트 소유 개발자 | **DEF-U1 해제 — LLM 화면 착수** (시안 `../서류/llm_dashboard.pptx`, Grafana `tv-llm` + React `#/llm` 두 UI). 계약 v3.0 additive(`llm_*` 10종). 게이트: 간소(EXC-U4 방식 — Phase별 커밋·기계 게이트 전량, codex 리뷰·회고 통합 1회, 푸시 1회) | **승인** (플랜 모드 질의 확정) |
| 2026-07-19 | 프로젝트 소유 개발자 | LLM 화면 세부 결정 — ① 사이드바 메뉴 "인스턴스별 GPU" **유지** + "GPU/LLM 모니터링" 추가(시안의 대체안 기각 — R6 연동 보존) ② 시뮬 결합: 모듈 분리 + **GPU 부하 max() 결합 유지**(시연 정합 우선 — DCGM 값 거동 변화는 허용, 스키마만 additive. 부하 비결합·별도 exporter 대안 검토 후 선택) | **승인** (플랜 모드 질의 확정) |
| 2026-07-19 | 프로젝트 소유 개발자 | 사이드바 후속 3건 — ① "GPU/SQream 모니터링" 하위 링크 추가(화면 2종 병렬) ② 상위/현재 화면 강조 위계 분리(A안) ③ **"인스턴스별 GPU" 항목 제거**(위 ①번 '유지' 결정 개정 — 시안 정합, R6 시각 연동 강조 기능 폐지) | **승인** (인간 지시) |
| 2026-07-19 | 프로젝트 소유 개발자 | **폐쇄망 RHEL 8.1 Docker 배포 (Phase D1)** — 통합 프로젝트 안에 전용 킷 `docker-kit/` 신설(개발 PC 빌드·save → 현장 Windows는 반입 통로만(가상화 불가) → RHEL 오프라인 정적 엔진 + load). 루트 `docker-kit/`·`deploy/`는 **구(보존) 스택용 동결** — **HCI-U-1의 docker-kit 부분 해소**, `deploy/` 방침은 계속 대기. 실측: 패키지 433MB 생성·해제본 compose E2E `verify-docker.sh` ALL CHECKS PASSED·네이티브 원복 검증 | **승인** (플랜 모드 질의 확정) |
| — | 프로젝트 소유 개발자 | U5 착수(잔여: `deploy/` 방침 + 전역 참조 스캔 — docker-kit 방침은 위 D1로 확정) | 대기 |
| — | 프로젝트 소유 개발자 | DEF-U1 착수(LLM 모니터링 요구사항 확정) | 대기 |
| 2026-08-13 | 프로젝트 소유 개발자 | **Phase X1·X2 착수(X-View 교체)** — TV-C1 additive 완료 메트릭 2종 · detail-col(시간구간+선택 구간 상세) X-View 교체 · Grafana(TV-C2) 미적용. Design 확인 4건은 계획 본문 기본안대로 확정: ① TimeRangePanel은 X-View 헤더 요약행으로 완전 흡수 ② 18fr/6fr 폭 비율 유지 ③ 점 색 = 유형 6색(QUERY_TYPE_COLORS) + 실패 ✕ 마크 ④ 통합 브랜치 = `feat/handoff-20260807`(인간이 본 브랜치에서 착수 지시·문서 커밋 흐름 유지, dev 통합은 추후 일괄). **추가 제약(인간 지시)**: ③구역 "시간대별 GPU 세션 & SQL 쿼리 실행 타임라인"(Timeline.tsx·lib/timeline.ts·타임라인 쿼리·Grafana 동명 패널)은 **절대 수정 금지** — X2는 `useRangeSelection` 구독만 한다 | **승인** (인간 지시 "착수하고 다되면 스크린샷" — 착수 직전 codex 확인 리뷰(수렴 규칙) 수행 후 구현) |

## 8. 보류(Deferred) 항목

| ID | 항목 | 조건 | 상태 |
| --- | --- | --- | --- |
| DEF-U1 | **LLM 모니터링 확장** — 폴더명 `llm_gpu_top_view_mockup`의 최종 지향점: 이 GPU/SQream 목업 기반 위에 LLM 모니터링 화면을 얹는다 | 인간이 요구사항(대상 메트릭·화면 시안·데이터 원천)을 확정·승인 | **해제 (2026-07-19)** — 시안 `llm_dashboard.pptx` 제시 + 인간 승인(§7). 구현은 Phase L1~L4 |

- **DEF-U1 계약 원칙 (선점)**: LLM 확장은 TV-C1 v2.0에 대해 **additive-only** — 신규 `llm_*` 메트릭 네임스페이스를 추가할 뿐, 기존 메트릭 이름·라벨·타입은 불변이다(기존 두 UI 무수정 보장). 이 원칙을 벗어나는 설계는 계약 개정 절차(§3 TV-C1)와 인간 승인을 요한다.
- 메트릭 목록 초안·화면 스케치·일정은 **의도적으로 기록하지 않는다**(과속 방지).

## 9. 수락 기준 추적표 운영 규칙

Phase 종료 시 해당 Phase의 체크박스를 [x]로 갱신하고, 기준↔코드/테스트 경로 매핑을 회고에 기록한다.

## 10. 선언된 예외 (Declared Exceptions)

| ID | 대상 규칙 | 예외 내용 | 근거 |
| --- | --- | --- | --- |
| EXC-U1 | AGENTS.md §3.3-3 (신규/변경 라인 80%) | 커버리지 게이트를 **영역 전체 커버리지 임계값**으로 대체 운용 — exporter `--cov-fail-under=80`, web `npm run test:coverage`(라인·함수·구문 80%, 분기 70%) | 양 구 프로젝트의 동일 예외(각 plan.md EXC) 승계. 신규 로직의 테스트 존재는 codex 리뷰에서 별도 확인 |
| EXC-U2 | AGENTS.md §3.2-3 (스코프 검증 — rename 양쪽 경로 검사) | U2~U5 이관 커밋에서 rename **소스 측**의 `top_view_mockup/`·`top_view_react/` 경로는 스코프 위반이 아니다 | 통합의 본질이 구 폴더 → 신 폴더 이동이며, 검증 스니펫이 rename 양측을 검사하므로 예외 없이는 모든 이관 커밋이 위반 판정된다. 소스 측 경로가 위 2개 외이면 여전히 위반 |
| EXC-U3 | 문서 정합 일반 원칙 | `docs/history/` 및 이관된 이력 문서(ADR·회고·리뷰)의 본문·경로 표기는 **작성 당시 그대로 동결** — 구 루트 기준 경로가 남는 것을 허용 | 감사 기록의 사후 수정 금지. 고지문(`docs/history/README.md`)으로 갈음 |
| EXC-U4 | AGENTS.md §6.2 (Phase별 닫힌 게이트) | U1~U4의 codex 교차 리뷰·회고를 **통합 1회**(`phase-U2-U4-*`)로 갈음하고, push는 마지막 1회로 묶는다. 기계 검증 게이트(테스트·린트·커버리지·드리프트·스코프)와 Phase별 커밋은 전량 유지 | 인간 승인(2026-07-19, §7) — 이관 작업은 기능 변경이 없는 이동 중심이라 Phase별 리뷰의 한계 효용이 낮음. U5 및 이후 Phase는 원칙 복귀 |

## 11. 리스크 등록부

| ID | 리스크 | 완화 |
| --- | --- | --- |
| RK-1 | SCHEMA 상대경로 2단계 조정(U2 임시·U3 최종) 누락 | web 계약 테스트가 `npm run build` 경로에 포함 — 누락 시 빌드 즉사로 검출. 각 Phase 수락 기준에 빌드 green 명시 |
| RK-2 | 배포 스크립트 하드코딩 — `serve-react-linux.sh`(`../../top_view_react/dist`), systemd 유닛(`/opt/top_view_*`), native-linux README, 반출 tar 구조 | U4에서 일괄 갱신 + `grep top_view_` 스캔을 U4 수락 기준으로 |
| RK-3 | 미커밋 워킹트리 위에서 `git mv` 시작 | P0 게이트 — clean tree 필수 |
| RK-4 | `deploy/`·`docker-kit/` 6개 파일(git 추적, 통합 스코프 밖)이 구 경로 참조 — U5 삭제 시 파손 | U5 착수 조건으로 인간 결정(경로 갱신 vs 킷 동결·폐기), §7 승인 표 등재. **구 폴더 삭제 철회 + docker-kit 동결 확정(§7 D1)으로 절반 해소 — 잔여는 deploy/** |
| RK-5 | 모노레포 커밋 스코프 혼선(기존 `react`/`top-view` 접두사) | §7 커밋 규칙 — 신규 커밋은 `llm-top-view` 단일 스코프, 기존 접두사는 구 프로젝트 이력용으로 동결 |
| RK-6 | `top_view_react/.git` 빈 디렉터리 — 내용이 생기면 중첩 저장소화 | P0에서 제거 |
| RK-7 | AGENTS 스코프 검증이 rename 양측 경로를 검사 → 이관 커밋 전부 위반 판정 | EXC-U2로 기계 검증과 정합 |
| RK-8 | 이동+대량 수정 동시 커밋 시 rename 검출 저하로 git 이력 단절 | "이동 + 최소 경로 보정 1커밋" 규칙, `git log --follow` 표본 검사를 U2 수락 기준화 |
| RK-9 | 보존 버전 스택과 신 스택의 포트 공유(9801/9091/3001/8082) — 동시 기동 시 충돌 | **상시 규칙**: 한 번에 한 스택만 기동 (AGENTS §0.1 포트 선언) |
| RK-10 | U5 전역 스캔 오탐 — `top_view_mockup_원본/`(미추적 스냅샷), `docs/history/`·이관 이력 문서(동결) | 스캔 규칙에 제외 목록 명시(§5 U5 수락 기준) |
