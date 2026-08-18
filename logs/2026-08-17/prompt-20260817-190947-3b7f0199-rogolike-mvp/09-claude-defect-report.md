# 09 — Claude 결함 보고서 (종결 검증 후)

- 작성자: fresh Claude Code closure verifier (Orca task `task_f82de17957a4` / dispatch `ctx_0215182dd3cb`)
- 기준: `08-claude-verification-report.md` (tree `7835c339f4096a28ac32eb7a8bdfd33cb37c6ceb`)
- 본 verifier는 소스를 수정하지 않았다. **Blocking 0건 · Major 0건 · 실행 가능한 코드 결함 0건** — 코드 게이트를 막는 결함은 없다. 아래는 해소 확인 종결 항목과 잔여 인간 판단·프로세스 항목의 처분 대기 목록이다.

## 해소 확인 (종결)

### DEF-4 (Minor) — AC-CMD-006 430px 뷰포트 검사 부재 → **해소 (본 검증 종결)**

- `scripts/playwright-mobile-check.mjs:165-177`: 7×7 진입 직후 뷰포트를 380px·430px로 순차 전환하며 `documentElement`/`body` scrollWidth를 측정, 폭 초과 시 `7×7 {width}px 화면 가로 스크롤 발생` throw. `:239-253`: 9×9 네 귀 실탭 후 동일 검사(`9×9 …` throw), `battleMetrics`는 board9@380 측정값 재사용. `:266` report에 `boardWidths.board7/board9` 직렬화.
- 본 verifier 재실행 report(`playwright-results/report.json`): board7 380→html 380/body 380·430→430/430, board9 380→380/380·430→430/430 — **두 판 크기 × 두 폭 전부 overflow 0**, `passed:true`, 오류 4계열 0.
- 직전 PASS tree `37a6c905…` 대비 소스 변경은 이 파일 하나(+28/−2)뿐임을 `git diff`로 확인 — 다른 판정에 영향 없음.
- 관찰(비차단): 이 교정 배치는 `10-codex-fix-log.md`에 서술이 추가되지 않았고 implementer receipt `mobile-430-green`(exit 0, 22:29 KST)·재생성 patch·manifest로만 기록됐다. 검증 harness 확장이라 제품 TDD 의무 대상은 아니며, fix-log 서술 보강은 Hermes 재량으로 남긴다.

### DEF-1 (Blocking) — 부활 발동 방향 역전 → **해소 (유지 확인)**

- `src/game/battle.ts:296-306` 재독: winner `'W'` → 무조건 `run-loss`; winner `'B'` + 1막·1단계·부활 정의 → `startRevival`(판·덱·유물 참조 보존); 그 외 `'B'` → `stage-win`. 동결 docs 방향과 일치.
- `tests/battle.revival.test.ts`·`tests/ui.game.test.tsx` 포함 전체 150 테스트 GREEN, 모바일 e2e 1승→부활 2단계(bosstheme 유지)→2승→2막 9×9 완주.

### DEF-2 (Major) — 덱 확인/재정렬 패널 부재·특수 돌 제품 미배선 → **해소 (유지 확인)**

- `src/game/GameProvider.tsx` `previewOrCommit`/`resolveScoutEffect`/`resolveGeneralCaptureEffect` 배선 존재 재확인, 한도 초과 원자적 거부·척후 실덱 재정렬·장군석 실냥 지급·희생석 양방향 패 한도 +1.
- `tests/battle.product-effects.test.ts`(6 시나리오)·`tests/ui.battle.test.tsx` 패널 취소/확정 실 DOM 검증 GREEN.

### DEF-3 (Major) — pre-move 도달 불가·부적/유물 혼동 → **해소 (유지 확인)**

- `readyBattle`: AI 턴만 자동 통과, 플레이어는 pre-move 정지(`착수로 진행` 명시적 건너뛰기, App.tsx:168).
- 부적(ITEM-*)/유물(RELIC-*) 분리: `USE_CHARM`은 battle+run(`CONSUME_CHARM`, run.ts:145) 각 1개 소비, 유물은 `usedRelicsThisTurn` 착수당 1회. UI 개수·라벨·aria·버튼 분리.

## 잔여 항목 (Minor·인간 판단 — 코드 게이트 비차단)

### DEF-5 (Minor·인간 판단) — 전투 중 '지도로 물러나기' (유지)

`src/App.tsx:178` RETURN_TO_MAP은 진행 중 대국을 무패널티로 이탈·재입장 가능하게 한다. docs 취지와 충돌 소지 — 제거/기권 통합/유지 여부는 인간 결정으로 상신.

### DEF-6 (Minor·인간 판단) — 지도 상설 시설 버튼 (유지)

`src/App.tsx:66-73` 상설 상점/사건/도장 버튼은 노드 구조와 무관한 접근을 허용한다. HDD-012 미결이므로 위반은 아니나 노드 기반 접근 제한 여부는 인간 결정으로 상신.

### DEF-7 (Minor·관찰) — 도장 교환 대상 고정 (유지)

`src/App.tsx:253`이 교환 replacement를 `'STONE-006'`으로 고정한다. 엔진(`useDojo`)은 임의 병종을 수용하므로 UI 대상 선택 노출이 계약 취지에 부합한다.

## 유지되는 프로세스 결함 (코드 수정 대상 아님)

- **PRC-1 (처분 인간):** 무단 commit+push `8df1159` — HEAD==origin/dev 그대로. revert/유지 결정 전 추가 commit 금지.
- **PRC-2 (역사·공시됨):** 원 구현 Task 6·7 첫 RED 이름 불일치, Task 8 첫 red receipt exit 0 이상 기록 — append-only로 소급 불가, 교정 로그에 공시됨. 수용 여부 인간 판단.
- **PRC-3 (수명주기 잔여):** verify-after snapshot→post-verify→finalize --outcome→verify-checksums→`11-final-summary.md`(HDD 미결정·수동 QA 미검증 범위 명시 포함)는 본 PASS 보고 후 지정 소유자(Hermes)가 진행할 다음 단계다. 본 verifier는 지시에 따라 finalize를 실행하지 않았다.
