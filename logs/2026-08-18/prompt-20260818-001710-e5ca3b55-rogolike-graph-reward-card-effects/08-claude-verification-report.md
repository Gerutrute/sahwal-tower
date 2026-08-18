# 08 — Claude 독립 검증 보고서 (그래프 지도 · 보상 상세 · 특수돌 효과 개편)

- 검증자: fresh Claude Code verifier (Orca task `task_5b9eb74ae6e1` / dispatch `ctx_1e1f6dc4d153`) — planner 세션(`task_de51fe0392c4`)과 다른 독립 세션, 소스 읽기 전용
- 검증 일시: 2026-08-18T01:29+09:00
- 대상: dev 브랜치, HEAD `8df1159983b0642cf5d144761f518188a64bcc15`, verify-before tree `d42a4535229f7cc990b9888749556cad4b3c095f`
- 판정 기준: `04-claude-acceptance-criteria.md` (hash 동결본) — 06/07의 주장에 의존하지 않고 실제 소스·diff·테스트·직접 실행 결과만 사용

## 종합 판정: **FAIL (조건부)** — Blocking 0건 · **Major 1건** · Minor 4건

- 필수 명령 전부 exit 0, AC vitest 매핑 27/27, tree 불변, 규칙·수치 게이트 준수. 그러나 대기열에 쌓인 두 번째 척후/기병 상호작용이 **확정 불가능**해지는 Major 결함 1건을 재현했다(09 참조). Major=0 조건 미충족으로 PASS를 선언할 수 없다.
- 결함은 국소적(대기열 활성화 시 `inspected` 창 재계산 누락)이며 상태 손상은 없다. 수정 후 재검증 권장.

## 1. 검증 환경 무결성

| 항목 | 결과 |
|---|---|
| 소스 tree (검증 시작 시) | `d42a4535229f7cc990b9888749556cad4b3c095f` = manifest `snapshots.verify-before` ✓ |
| 소스 tree (모든 명령 실행 후 재계산) | `d42a4535229f7cc990b9888749556cad4b3c095f` — **검증 전후 동일** ✓ (snapshot_tree와 동일한 임시 index 방식으로 계산, 사용자 index 불변) |
| HEAD | `8df1159` = manifest `git_head_before` = `origin/dev` ✓ (커밋/푸시 없음) |
| 계획 hash | manifest `plan_hashes` 4건 모두 02~05 파일과 일치 (plan-frozen 유지) |
| 검증자 소스 수정 | 없음 — 본 보고서(08)·결함 보고서(09)와 evidence 도구가 생성한 `verification/` 로그만 작성 |

## 2. 필수 명령 직접 실행 (AC-CMD-001~006, `capture-command --role verifier`, exact argv)

모든 receipt는 `verification/commands.jsonl`과 `verification/<name>.log`에 보존. manifest 확인 결과 6건 모두 `executed_by: verifier`, `status: passed`, argv가 `evidence.config.json`과 **정확히 일치**.

| name | argv | exit | 핵심 결과 |
|---|---|---|---|
| full_tests | `npm.cmd test` | 0 | **42 files / 213 tests 전부 통과**, 실패 0 |
| typecheck | `npm.cmd run typecheck` | 0 | 오류 0 |
| build | `npm.cmd run build` | 0 | vite build 성공 |
| benchmark_ai | `npm.cmd run benchmark:ai` | 0 | 7×7 p95 **1.4ms** ≤ 100ms, 9×9 p95 **2.7ms** ≤ 200ms, candidate 수 82000/82000·138000/138000 일치 (AC-CMD-004 계약 충족) |
| runtime_audit | `npm.cmd audit --omit=dev --audit-level=high` | 0 | 취약점 0, `dependencies`는 react/react-dom 그대로 (AC-CMD-005) |
| mobile_check | `npm.cmd run check:mobile` | 0 | report.json `passed: true`, `mapEdgeCount: 18`, `rewardTapFirstExpanded: true`, scrollWidth 380 (검증자가 직접 빌드→preview 기동 후 실행) |

추가 verifier 실행: `ac_mapping` (`node scripts/check-ac-mapping.mjs <이번 run 04 경로>`) exit 0 — **"AC vitest mappings: 27/27 executed with at least one passing test"**. `python_tests` (`python -m unittest discover -s tests -v`) exit 0, OK (AC-EVID-001).

부정 계약(성공=exit 1이라 capture-command 미사용, 검증자 셸에서 직접 실행):

- AC-NEG-001: `git grep -nE "aiEffectWeight[^s]|resolveGuardianEffect|DeckInspectionEffectResult|PendingDeckInspection" -- src tests scripts` → **출력 0건, exit 1** ✓. 03 §3 추가 목록(`resolveCavalryEffect|resolveScoutEffect|ScoutEffectResult`)도 0건 ✓.
- AC-NEG-002: `git grep -nE "STONE-00[1-6]" -- src/App.tsx src/components` → 1건 (`src/App.tsx:310` 도장 액션의 `replacement: 'STONE-006'` **payload 값**). 사용자 노출 텍스트는 한국어 '희생석 교환'이며 원시 ID 노출 0건 — AC의 맥락 판단 조항에 따라 **통과**.

## 3. AC 1:1 매핑

표기: ✅ = 명령 exit 0 + 통과 조건을 테스트/코드/실행으로 확인. ⚠️ = 명령 GREEN이나 통과 조건 일부가 테스트로 직접 커버되지 않아 코드 검토로 보완(§5 Minor 참조). ❌ = 결함.

### 지도 (AC-MAP)
| AC | 판정 | 근거 |
|---|---|---|
| AC-MAP-001 | ✅ | `map.graph.test.ts` GREEN(ac_mapping·full_tests). `mapLayout.ts`: width 356≤380, column↑→y↓, boss 최소 y — 코드 확인 일치 |
| AC-MAP-002 | ✅ | edge 집합 = `next` 1:1(18개)·좌표 일치 테스트 GREEN + 실브라우저 카운트 18/18 (§6) |
| AC-MAP-003 | ⚠️✅ | current/done/open/locked 파생이 `selectableNodeIds` 재사용으로 구현(코드 확인). 완료 0/1개 시나리오는 테스트 GREEN, 완료 다수 시 이전 노드 done 상태는 직접 테스트 없음(코드로 확인) |
| AC-MAP-004 | ✅ | `ui.map.graph.test.tsx` `.map-edge` 18개·`data-edge` 실제 쌍 일치 GREEN |
| AC-MAP-005 | ✅ | `data-state` 4종·open만 활성(`disabled={state!=='open'}`)·SVG `aria-hidden`·`aria-label="1막 지도"` — 테스트+코드+실브라우저 확인 |
| AC-MAP-006 | ✅ | `ui.map.progression.test.tsx` GREEN — 마지막 완료 노드 current, 잠긴 노드 클릭 무반응 유지 |

### 보상 상세 (AC-RWD)
| AC | 판정 | 근거 |
|---|---|---|
| AC-RWD-001 | ✅ | `deck.test.ts` STARTING_DECK = 001×5 + 002~006 각 1, 총 10장 GREEN + `stones.ts:268` 확인 |
| AC-RWD-002 | ✅ | `rewards.detail.test.ts` 돌·부적·유물 6요소 한국어 GREEN |
| AC-RWD-003 | ✅ | ownedCount 규칙(돌=덱 수량 2 확인, 부적=개수, 유물=0/1 — 코드 확인)·ID/trigger 비노출 정규식 GREEN |
| AC-RWD-004 | ✅ | `stones.presentation.test.ts` 수치 명시(3장/5냥+1장/2장+맨 아래/활로 2+무효/패 한도+1장) 전부 assert GREEN |
| AC-RWD-005 | ✅ | `ui.reward.detail.test.tsx` 첫 클릭=펼침만·reward 화면 유지 GREEN + 실브라우저 tap 검증(§6): `aria-expanded=true`, 화면 유지, dt 6개, CHOOSE 미발생 |
| AC-RWD-006 | ✅ | `이 보상을 선택`으로만 확정·focus 펼침·한 번에 하나·6요소+보유 표시 GREEN. `onPointerDown preventDefault`로 tap-focus 선행 펼침/접힘 충돌 방지(코드 확인) |
| AC-RWD-007 | ✅ | `ui.card-clarity.test.tsx` GREEN — 원시 ID·trigger 비노출, 선택 카드 상세 실제 효과 노출 |

**hover media query 안전성(특별 점검 항목):** `window.matchMedia?.('(hover: hover)').matches` — optional chaining은 체인 전체를 단락(short-circuit)하므로 `matchMedia` 부재(jsdom·구형 브라우저)에서 `undefined.matches` TypeError가 **발생하지 않음**. 모바일 에뮬레이션에서 `(hover: hover)=false` 확인, mouseenter 펼침 차단 정상. **안전 판정.**

### 척후석 (AC-SCT)
| AC | 판정 | 근거 |
|---|---|---|
| AC-SCT-001 | ✅ | `stones.test.ts` 창=3장·순변화 0·상단 순서 반영 GREEN. import-check 뒤 실제 동작 assert 있음(단순 import 테스트 아님) |
| AC-SCT-002 | ⚠️✅ | 창 축소(2/0장)·잘못된 takenId RangeError·상태 불변·임시 카드 소멸 GREEN. 잘못된 returnedId/순열 케이스는 직접 테스트 없음 — `assertPermutation`/`assertExactPrefix` 코드로 원자성 확인 |
| AC-SCT-003 | ✅ | `battle.product-effects.test.ts` INSPECT_TAKE→RETURN→REORDER→CONFIRM 원자 반영·CANCEL 완전 불변 GREEN. 확정/취소 후 END_TURN은 `finishInspection` 코드 확인(`endsTurnOnResolve`) |
| AC-SCT-004 | ⚠️✅ | `ui.battle.test.tsx` 패널 단계 진행·확정/취소 GREEN. "패널 열림 중 착수 불가"는 직접 assert 없음 — `canAct = turn==='B' && !thinking && pendingInspection===null`이 BoardSvg/카드/패스/기권 모두 disabled 처리(코드 확인) |

### 장군석·기병석 (AC-GEN·AC-CAV)
| AC | 판정 | 근거 |
|---|---|---|
| AC-GEN-001 | ✅ (AI-제안 — **인간 확인 권장**) | `battle.effects.test.ts` 포획 시 패 = handLimit+1·effect 로그 GREEN. maxHandSize 도달 시 생략·재고 소진 시 no-op(임시 미생성) GREEN. "보충 후 일시 초과, maxHandSize 절대 상한" 해석은 02 R-GEN-02의 채택안 그대로 — 사람이 (a)/(b) 대안으로 변경 지시 가능 |
| AC-GEN-002 | ⚠️✅ | 드로우 불가 no-op·임시 미생성·effect 로그 GREEN. 초과분 자연 수렴·W 대칭 드로우는 직접 테스트 없음 — reducer가 `state.turn` 대칭으로 처리(코드 확인), 보충은 `hand<handLimit`일 때만이므로 자연 수렴 |
| AC-GEN-003 | ✅ | `battle.product-effects.test.ts` 5냥·`generalCaptureMoneyCap` 갱신 GREEN — 드로우 추가에도 냥 계약 불변 |
| AC-CAV-001 | ✅ | `deck.test.ts` 비임시 STONE-004 → drawPile 맨 아래(discard 아님)·타 병종 discard 유지 GREEN |
| AC-CAV-002 | ✅ | `previousCaptureBy` 추적: 포획 착수 후 드로우된 기병만 발동 GREEN. 비포획 미발동은 `startCavalryInspection(deck,false)=[]` 테스트로 커버 |
| AC-CAV-003 | ⚠️✅ | 창=2장·taken→hand·discarded→discard·미선택 원순서 잔류 GREEN. 임시 소멸·잘못된 입력 RangeError는 기병 경로 직접 테스트 없음(코드: 척후와 동일 `assertExactPrefix` 공유) |
| AC-CAV-004 | ⚠️✅ | 무효화 후 `previousCaptureBy=false`는 `battle.protection.test.ts`에서 GREEN. 빈 drawPile 즉시 재드로우 엣지는 유사 케이스(1장 pile)만 테스트 — 코드상 결정적 동작 확인 |
| AC-CAV-005 | ❌ **Major** | 원자 반영·CANCEL 불변·FIFO 순서는 GREEN이나, **첫 상호작용 확정 후 두 번째 대기 상호작용의 `inspected` 창이 갱신되지 않아 확정이 항상 실패**(취소만 가능). 검증자 재현 2종(기병×2, 척후→기병 — 시작 덱으로도 도달 가능). 상세: `09-claude-defect-report.md` DEF-1 |

### 수호석 (AC-GRD)
| AC | 판정 | 근거 |
|---|---|---|
| AC-GRD-001 | ✅ | 토큰 1개·`memberInstanceIds`=병합 그룹 정확 집합(수호석 포함) GREEN |
| AC-GRD-002 | ✅ | 무효화 시 **board 동일 참조**(`toBe`)·koForbiddenKey 불변·카드 정상 소비·토큰 소비·effect 로그·과반 판정 미발생 GREEN. moveNumber+1은 코드 확인 |
| AC-GRD-003 | ⚠️✅ | 정상 착수 1회 만료·패스 비소모 GREEN. "만료 후 같은 그룹 포획 성공"·"무효화 착수는 타 토큰 비만료"는 직접 테스트 없음 — 코드 확인(무효화 경로는 해당 토큰만 filter 제거, 만료는 정상 경로에서만 `color===mover` filter) |
| AC-GRD-004 | ⚠️✅ | 다중 토큰 교차 시 grantedAtMove 최소 1개 소비 GREEN(단위 테스트). 다중 그룹 혼재 전체 무효화(교집합 검사로 착수 전체 무효 — 부분 포획 코드 경로 자체가 없음)·부활 착수의 상대 착수 취급(`performRevivalSpecialMove`의 `captureNegatedBy` 분기)은 코드 확인 |
| AC-GRD-005 | ✅ | `go.rules.test.ts` GREEN — `tryPlay`/`canonicalKoKey`/`legalPlayPoints` 의미 불변(합법성 판정은 표준 그대로, 무효화는 해결 단계에서만) |
| AC-GRD-006 | ✅ | `ui.battle.test.tsx` `data-protected` 마커 GREEN. 마커는 `state.protections`에서 파생되므로 토큰 소멸 시 자동 제거(코드 확인) |

**제품 계층 누수 점검(특별 점검 항목):** `commitMove`/`performAiTurn` 모두 `captureNegatedBy` 공유 후 `effectiveCapturedCount=0` 처리 —
장군 냥 지급(`effectiveCapturedCount>0` 게이트) · captures 통계 · moveImpacts · 희생석 발동(`capturedStones=[]`) · 효과 정의(`effects=[]`) **전부 무효화 시 미발생. 누수 없음.**

### 희생석·AI (AC-SAC·AC-AI)
| AC | 판정 | 근거 |
|---|---|---|
| AC-SAC-001 | ✅ | 즉시 드로우+한도+1(기존)·END_TURN과 패스 모두에서 한도 원복·뽑은 카드 미회수 GREEN. `remainingTurns:1` + 턴 종료 색 덱에만 expire 배선 → "다음 내 턴 종료" 타이밍 정확(코드 확인) |
| AC-SAC-002 | ✅ | 동시 다중 개별 발동·자충수/자발 제거 비발동·maxHandSize 초과 착수 취소 가드 GREEN. 상대 손패 감소 코드 부재 확인 |
| AC-AI-001 | ✅ | `aiEffectWeights` 6키 shape·차등 주입 시 다른 선택·0 주입 시 포획-만 평가와 동일 GREEN. `assertConfig`가 6키 유한값 검증(코드 확인) |
| AC-AI-002 | ✅ | 보호 그룹 포획 후보 유효 포획 0 평가(reducer와 동일 `captureNegatedBy` 공유 — `performAiTurn` 코드 확인)·`candidatePlacementTriggersEffect` 병종별 판정(척후 항상/장군 유효포획>0/수호 위기 인접/기병·희생·일반 false) GREEN. **`candidatePlacementTriggersEffect`는 GameProvider에서 `effectiveCaptures`(무효화 시 0)를 받음 — 특별 점검 항목 확인 완료** |
| AC-AI-003 | ✅ | `sim.random.test.ts`·`balance.harness.test.ts` 신규 config shape 결정적 GREEN |

### 문서 (AC-DOC-001)
✅ `docs/03_content/01_특수돌.md` STONE-002~006이 HDD-005~009 승인 효과와 정확히 일치(척후 3장 교환, 장군 5냥+1드로우·자연 수렴, 기병 2장 교환·덱 아래·추가 착수 금지, 수호 착수 전체 무효화·만료 규칙, 희생 즉시 드로우+한도 만료·비발동 조건). `docs/CHANGELOG.md` 0.3.0 추가 — "인간 확인 권장" 섹션에 장군 드로우 해석과 문구·밸런스 톤을 명시(은폐 없음).

## 4. 실브라우저(모바일) 검증 — 특별 점검 항목

playwright `mobile_check`(exit 0) 외에 검증자 독자 스크립트로 실 Chromium(380×844·터치·config 주입)에서 재확인:

| 항목 | 결과 |
|---|---|
| `.map-edge` 렌더 수 / **시각적으로 보이는** 수(크기·stroke 검사) | **18 / 18** |
| 완료 0개: current 0 · open 2 | ✓ |
| 첫 노드 완료 후: `data-state="current"` 정확히 1개(완료한 그 노드) | ✓ |
| 보상 face 첫 tap: `aria-expanded=true`·reward 화면 유지·dt 6개·CHOOSE 미발생 | ✓ |
| `이 보상을 선택` tap → 지도 복귀 | ✓ |
| 스크린샷 육안: 아래→위 진행, 보스 최상단, 열림 노드 강조, current '현재' 배지 | ✓ (Minor: 노드 부제 겹침 — §5-3) |

관찰(제품 결함 아님): fullPage 스크린샷 후 Chromium 에뮬레이션의 `(hover: hover)`가 true로 뒤집혀 합성 mouseenter가 다른 후보를 펼칠 수 있음 — 실기기에서는 발생하지 않는 도구 아티팩트. 제품 가드는 환경 보고값에 정확히 따라 동작함.

## 5. Minor 결함·관찰 (상세는 09)

1. **DEF-2 (Minor, 테스트 커버리지):** §3의 ⚠️ 항목들 — AC 통과 조건 문장 중 일부(다중 그룹 혼재 무효화, W 대칭 드로우, 기병 RangeError, 패널 열림 중 착수 차단, 완료 다수 done 등)가 코드로는 충족되나 전용 assert가 없음.
2. **DEF-3 (Minor, 엣지):** 부활 전용 착수/부활 자동 패스 경로에서 W 덱의 `expireTemporaryHandLimits` 미적용 — W의 임시 패 한도가 한 턴 늦게 만료될 수 있는 극단 엣지. AC 요구 범위(END_TURN·패스) 밖.
3. **DEF-4 (Minor, UX·인간 판단):** 380px에서 지도 노드 상자가 행 간 겹쳐 부제(노드 설명)가 부분 가려짐. 제목·상태는 판독 가능, 기계 AC는 전부 통과 — 시각 폴리시는 인간 판단 항목.
4. **관찰:** `ui.reward.detail.test.tsx`의 인벤토리 불변 assert가 불변 객체 비교라 실효성 낮음(화면 유지 assert가 실제 보증). 개선 여지.

## 6. 남은 인간 판단 항목 (은폐 없음)

- **AC-GEN-001 (AI-제안 게이트):** 장군석 추가 드로우의 "보충 후 1장, handLimit 일시 초과, maxHandSize 절대 상한" 해석 — 구현·테스트 완료, 인간의 (a)/(b) 대안 선택 여지 있음.
- 보상·카드 상세 한국어 문구와 `aiEffectWeights` 초안 수치의 톤·밸런스 (CHANGELOG에도 명시됨).
- AI 기병 교환 decline 정책(R-CAV-06)은 명시적 정책으로 구현 — 후속 설계는 인간 결정.
- 지도 노드 겹침(§5-3)의 시각 폴리시.

## 7. 결론

필수 명령·AC 매핑·규칙 불변·수치 게이트·모바일 실브라우저 검증은 전부 통과했으나, AC-CAV-005 영역에서 재현 가능한 Major 결함 1건(대기열 상호작용 창 미갱신)이 존재한다. **Blocking 0 · Major 1 → FAIL.** Codex의 수정(`finishInspection`에서 head 승격 시 `inspected` 재계산 권장, 09 참조) 후 새 dispatch에서 재검증이 필요하다.
