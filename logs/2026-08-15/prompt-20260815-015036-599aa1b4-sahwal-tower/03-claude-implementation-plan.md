# 03 — Claude 구현 계획 (「사활(死活)의 탑」)

- 작성자: Claude Code (planner, read-only). **실제 구현자는 Hermes/Codex**(HDD-001, AGENTS §2.2).
- 선행 문서: `02-claude-requirements-analysis.md`
- 원칙: 원문의 **모든 규칙·수치·좌표·한국어 문자열·AI 점수항을 1:1 재현**한다. 밸런스 결과를 이유로 동결값을 바꾸지 않는다(CONFLICT-01 / HDD-006).
- 방식: **수직 TDD**. 각 단계는 **RED 명령과 실패 증거를 먼저 남긴 뒤** 해당 슬라이스의 프로덕션 코드를 작성한다.

---

## 1. 아키텍처 결정

| 결정 | 내용 | 근거 |
|---|---|---|
| A-1 | 게임 로직 전량을 **단일 파일 `src/engine.ts`** 에 둔다. 하위 분할·재수출을 하지 않는다 | R-S3 문언("순수 함수 모듈 `src/engine.ts`"). 순수성·무UI 검사를 단일 파일 스캔으로 기계 검증 가능 |
| A-2 | 엔진은 **`Math.random`/`Date`/`window`/`document`/`console`/`fetch`/`localStorage`를 참조하지 않는다.** 난수는 `rng: Rng` 주입 | R-S3, ASM-10 |
| A-3 | 엔진의 모든 공개 함수는 **입력 불변**(입력 객체를 변형하지 않고 새 값을 반환) | R-S3 "부수효과 없음" |
| A-4 | React 상태는 **`App.tsx` 한 곳**에서만 소유하고, 하위 컴포넌트는 props만 받는 표현 컴포넌트 | R-S2(상태관리 라이브러리 금지) |
| A-5 | AI 지연 타이머는 **`src/hooks/useAiTurn.ts` 단일 지점**에서만 생성한다. 세대 토큰(generation token)으로 stale 재시작을 차단 | R-U5 |
| A-6 | 한국어 UI 문자열은 **`src/strings.ts`** 에 상수로 모은다(엔진은 참조하지 않음) | R-S7 + 문자열 검증 용이성 |
| A-7 | 밸런스 하니스는 `npm test`에서 분리하고 **`vite-node scripts/balance.ts`** 로 실행한다(`vite-node` 설치 확인됨 — 신규 의존성 없음) | ASM-20 |
| A-8 | `package.json`의 버전은 **설치된 실측 버전에 정확히 핀**한다(react 18.3.1 / react-dom 18.3.1 / vite 5.4.21 / @vitejs/plugin-react 4.7.0 / vitest 2.1.9 / typescript 5.9.3 / jsdom 25.0.1) | 오프라인 `node_modules` 재사용, AGENTS §9 |
| A-9 | UI 테스트는 `react-dom/client` + `react-dom/test-utils`의 `act`로 작성한다(Testing Library 미설치) | 베이스라인 실측 |
| A-10 | `dependencies`는 **정확히 `react`, `react-dom` 2개**. 그 외 전부 `devDependencies` | R-S2 |

---

## 2. 파일 인벤토리 (전부 신규 — 기존 파일 수정은 2건)

### 2.1 신규 생성

| # | 경로 | 역할 |
|---|---|---|
| 1 | `package.json` | 스크립트·의존성 핀 |
| 2 | `tsconfig.json` | 앱/테스트 TS 설정(`strict: true`) |
| 3 | `tsconfig.node.json` | vite 설정용 TS 설정 |
| 4 | `vite.config.ts` | vite + react 플러그인 + vitest 설정 |
| 5 | `index.html` | 진입 HTML, viewport meta |
| 6 | `src/main.tsx` | React 18 `createRoot` 부트스트랩 |
| 7 | **`src/engine.ts`** | **순수 게임 로직 전량** (§3) |
| 8 | `src/strings.ts` | 한국어 UI 문자열 상수 |
| 9 | `src/theme.ts` | 색 토큰 상수(R-V1) — CSS 변수와 1:1 |
| 10 | `src/styles.css` | 레이아웃·색·모션·reduced-motion |
| 11 | `src/App.tsx` | 화면 상태 머신·이벤트 배선 |
| 12 | `src/hooks/useAiTurn.ts` | 620ms 지연 + stale 가드 |
| 13 | `src/components/TitleScreen.tsx` | R-U1 |
| 14 | `src/components/BattleScreen.tsx` | R-U2 |
| 15 | `src/components/BoardSvg.tsx` | R-U3, R-U4 |
| 16 | `src/components/ResultOverlay.tsx` | R-U6 |
| 17 | `src/components/RelicScreen.tsx` | R-U7 |
| 18 | `src/components/EndScreen.tsx` | R-U9 |
| 19 | `src/components/RulesModal.tsx` | R-U10 |
| 20 | `src/components/RestartModal.tsx` | R-U8 |
| 21 | `scripts/balance.ts` | 색 반전 밸런스 하니스(R-T8) |
| 22~34 | `tests/*.test.ts(x)` | §5 테스트 매트릭스 |

### 2.2 기존 파일 수정 (Hermes 소유)

| 경로 | 변경 | 비고 |
|---|---|---|
| `evidence.config.json` | 게임 명령 선언(§7.2) | AGENTS §6.4 |
| `.gitignore` | `node_modules/`, `dist/` 추가 | OPEN-05. tree 비교 노이즈 방지 |

### 2.3 절대 금지

- `scripts/evidence/*.py`, `tests/evidence/*.py`, `AGENTS.md`, `.claude/settings.json`, `00`/`01` 증적 파일 수정
- 원문에 없는 라이브러리 추가, 네트워크 설치, 폰트 파일 번들(OPEN-02)
- `git commit` / `push` / `reset` / `rebase`(HDD-007)

---

## 3. `src/engine.ts` — 공개 계약 (타입·시그니처만. 구현 본문은 Codex가 작성)

> 아래는 **계약 선언**이다. 이름·인자·반환 형태를 그대로 사용하고, 본문은 Codex가 채운다.

### 3.1 기본 타입·상수

```ts
export type Cell = null | 'B' | 'W' | 'R';
export type Color = 'B' | 'W';
export type Pos = number;                 // 0..48, row*7+col
export type Board = readonly Cell[];      // length 49
export type Rng = () => number;           // [0,1)

export const SIZE = 7;
export const CELLS = 49;
export const START_POUCH = 28;
export const REST_BONUS = 4;
export const AI_DELAY_MS = 620;
export const SIM_MOVE_LIMIT = 400;
export const POUCH_WARN = 5;

export function idx(row: number, col: number): Pos;
export function rowOf(p: Pos): number;
export function colOf(p: Pos): number;
export function neighbors(p: Pos): Pos[];              // 상하좌우, 판 밖 제외
export function manhattan(a: Pos, b: Pos): number;
export function chebyshev(a: Pos, b: Pos): number;
export function boardKey(board: Board): string;        // 49자, '.'|'B'|'W'|'R'
```

### 3.2 바둑 코어 (R-G)

```ts
export function getGroup(board: Board, p: Pos): Pos[];        // 같은 색 연결군
export function libsOf(board: Board, p: Pos): number;         // 그룹 활로 수(중복 없음)
export function libertiesOfGroup(board: Board, group: readonly Pos[]): Pos[];

export type IllegalReason = 'occupied' | 'suicide' | 'superko';

export interface MoveResult {
  ok: boolean;
  reason?: IllegalReason;
  board: Board;              // ok=false면 입력 board 그대로
  captured: Pos[];           // 제거된 상대 돌 좌표(중복 없음)
  key: string;               // 결과 판 키
}

/** R-G4 순서: 상대 활로0 그룹 제거 → 자살 검사(원복) → positional superko 검사 */
export function tryMove(
  board: Board, p: Pos, color: Color, history: readonly string[]
): MoveResult;

export function legalMoves(board: Board, color: Color, history: readonly string[]): Pos[];

export interface SweepResult { board: Board; removedW: Pos[]; removedB: Pos[] }
/** R-G7: W 활로0 전부 제거 → 재계산 → B 활로0 제거 */
export function sweepDead(board: Board): SweepResult;
```

### 3.3 층·유물 데이터 (R-F, R-R — 동결값)

```ts
export type FloorId = 1 | 2 | 3;
export type RelicId = 'recover' | 'soul' | 'pouch7' | 'tempo' | 'bomb' | 'guard';

export interface FloorData {
  id: FloorId;
  name: string;        // '침입귀' | '두터움의 골렘' | '불사왕'
  hanja: string;       // '侵入鬼' | '厚壁魔' | '不死王'
  seal2: string;       // '侵入' | '厚壁' | '不死'   (ASM-11)
  floorSeal: string;   // '一' | '二' | '三'         (ASM-12)
  gimmick: string;     // 한국어 기믹 설명
  rocks: Pos[];        // 1층 [], 2층 (2,2)(2,4)(4,2)(4,4), 3층 (3,3)(0,0)(0,6)
  kingW: Pos;          // (1,3)
  kingB: Pos;          // (5,3)
  guardsW: Pos[];      // 1층 [], 2·3층 (1,2)(1,4)
  pouchW: number;      // 20 | 24 | 30
}
export const FLOORS: Readonly<Record<FloorId, FloorData>>;

export interface RelicData { id: RelicId; name: string; hanja: string; desc: string }
export const RELICS: readonly RelicData[];             // 길이 6
export function offerRelics(owned: readonly RelicId[], rng: Rng): RelicId[];  // 미보유 중 3개, 중복 없음
```

### 3.4 상태 모델

```ts
export type BattleStatus = 'playing' | 'win' | 'lose';
export type WinReason  = 'king'      | 'exhaust';        // W왕 포획 / W 탈진
export type LoseReason = 'king'      | 'depleted';       // B왕 포획 / B 돌 고갈

export interface BattleState {
  floor: FloorId;
  board: Board;
  history: string[];          // 시작 상태 + 판이 바뀐 모든 시점 (ASM-03)
  turn: Color;
  pouchB: number;             // 런 단위 누적 (ASM-01)
  pouchW: number;             // 층 값에서 시작
  kingB: Pos | null;          // 제거되면 null
  kingW: Pos | null;          // 부활 시 새 좌표
  capturedW: number;          // 이번 전투에서 잡은 W 수
  lostB: number;              // 이번 전투에서 잃은 B 수(영구)
  relics: RelicId[];
  bomb: { armed: boolean; used: boolean; pos: Pos | null };
  pendingB: number;           // 남은 B 연속 착수(tempo)
  pendingW: number;           // 남은 W 연속 착수(골렘)
  turnCountW: number;         // 골렘 3·6·9… 판정용 (ASM-07)
  revived: boolean;           // 불사왕 부활 사용 여부
  lastMove: Pos | null;
  status: BattleStatus;
  reason: WinReason | LoseReason | null;
  log: string[];              // 한국어. UI는 최근 3줄 표시
}

export interface RunState {
  floor: FloorId;
  pouch: number;              // 전투 밖에서 유지되는 B 주머니
  relics: RelicId[];
  totalCaptured: number;
  totalLost: number;
  clearedFloors: number;
}
```

### 3.5 전투 진행 API (전부 순수 — 새 상태를 반환)

```ts
export function newRun(): RunState;                                   // pouch = START_POUCH
export function startBattle(run: RunState, floor: FloorId): BattleState;
//  - 왕·호위·바위 배치, guard 유물 무료 돌(ASM-16), tempo면 pendingB=2, 시작 판 키를 history에 push

export function playerMove(state: BattleState, p: Pos): BattleState;  // 불법수면 상태 불변 + 로그
export function playerPass(state: BattleState): BattleState;          // 비용 0, pendingB=0 (R-E12)
export function toggleBomb(state: BattleState): BattleState;          // 전투당 1회 장전 토글

export function aiTurn(state: BattleState, rng: Rng): BattleState;    // 골렘 2연타·중간 판정 포함
export function chooseAiMove(state: BattleState, rng: Rng): Pos | null;   // null = 패스
export function scoreAiMove(state: BattleState, p: Pos, randomTerm: number): number;
//  ↑ randomTerm을 인자로 받아 R-A15를 분리 → 결정론적 단위 테스트 가능

export function reviveCandidates(state: BattleState): Pos[];          // 가상 W 배치 활로 ≥ 1
export function reviveScore(state: BattleState, p: Pos): number;      // 활로×3 + 인접W×5 − 인접B×4 + B왕 맨해튼 거리
export function applyRevival(state: BattleState): BattleState;        // 최대 지점 무료 배치, history push, revived=true

export function detonateBomb(state: BattleState): BattleState;        // 폭발석 연쇄 전체(R-R5)
export function finishFloor(run: RunState, state: BattleState): RunState;  // REST_BONUS +4, 누적 합산
export function applyRelic(run: RunState, id: RelicId): RunState;     // pouch7이면 즉시 +7
```

### 3.6 밸런스용 색 반전 API (R-T8)

```ts
export function mirrorState(state: BattleState): BattleState;
//  판·이력·왕을 반전해 "AI가 B를 두는" 관점으로 변환한다.
//  - 셀 색 B↔W 스왑, 바위 유지
//  - kingB↔kingW 스왑
//  - history의 각 키도 동일 규칙으로 변환해 superko 판정을 보존
export function autoPlayerMove(state: BattleState, rng: Rng): Pos | null;
//  mirrorState + chooseAiMove로 B측 자동 착수를 선택한다(무유물 밸런스 측정용)
```

### 3.7 순수성 계약 (기계 검증 대상)

- `src/engine.ts`는 **어떤 `import`도 갖지 않는다**(React·DOM·node 모듈 전부 금지).
- 다음 토큰이 소스에 등장하지 않는다: `Math.random`, `Date.`, `new Date`, `window`, `document`, `localStorage`, `fetch(`, `console.`, `performance.`, `setTimeout`, `process.`.
- 모든 공개 함수는 인자를 변형하지 않는다(테스트에서 입력 스냅샷 비교).

---

## 4. UI 상태 경계 (구현하지 않음 — 계약만)

### 4.1 `App.tsx` 소유 상태

```ts
type Screen = 'title' | 'battle' | 'overlay' | 'relic' | 'end';
type Modal  = null | 'rules' | 'restart';

interface AppState {
  screen: Screen;
  run: RunState;
  battle: BattleState | null;
  offer: RelicId[] | null;       // 유물 화면 3장
  modal: Modal;
  thinking: boolean;             // AI 지연 중 입력/버튼 잠금 (R-U5)
  endKind: '生' | '死' | null;
}
```

### 4.2 데이터 흐름 규칙

1. **엔진 → UI 단방향.** 컴포넌트는 `BattleState`/`RunState`를 읽기만 하고, 이벤트를 `App`으로 올린다.
2. 모든 상태 전이는 `engine.ts`의 순수 함수 호출 결과로만 만든다. 컴포넌트 안에서 규칙을 재구현하지 않는다.
3. `thinking === true`이면 판 클릭 핸들러와 `한 수 쉼`·`폭발석 장전`·`새로하기` 버튼이 **모두 `disabled`**.
4. 난수는 `App`이 `Math.random`을 엔진에 주입한다. 엔진 내부 호출 금지(A-2).

### 4.3 `useAiTurn.ts` stale 가드 계약 (R-U5)

```ts
export function useAiTurn(args: {
  screen: Screen;
  battle: BattleState | null;
  onAiTurn: () => void;          // App이 engine.aiTurn 결과를 커밋
}): { thinking: boolean };
```

동작 계약:

1. 타이머는 `screen === 'battle' && battle && battle.turn === 'W' && battle.status === 'playing'`일 때만 생성한다.
2. 생성 시 세대 토큰(`generationRef.current += 1`)을 캡처한다.
3. 콜백 진입 시 **① 세대 토큰 일치 ② 여전히 전투 화면 ③ 여전히 W턴 ④ 여전히 `playing`** 을 **재검사**한다. 하나라도 어긋나면 아무 것도 하지 않고 종료한다.
4. effect cleanup에서 `clearTimeout`을 호출하고 세대 토큰을 증가시켜 이전 타이머를 무효화한다.
5. 동일 턴에 대해 타이머는 **최대 1개**만 존재한다(재렌더로 중복 생성 금지).
6. 지연 시간은 `AI_DELAY_MS`(=620) 상수를 사용한다. 리터럴 하드코딩 금지.

---

## 5. 수직 TDD 단계 (RED → GREEN)

각 단계는 다음을 반드시 지킨다.

- **RED**: 표기된 명령을 먼저 실행하고, 실패 출력을 `06-codex-implementation-log.md`에 붙여 넣는다(파일명·실패 메시지 포함).
- **GREEN**: 해당 슬라이스의 프로덕션 파일만 작성/수정해 같은 명령을 통과시킨다.
- 단계 종료 시 `npx vitest run`(누적 회귀)이 exit 0이어야 다음 단계로 간다.
- RED 증거 없이 프로덕션 코드를 먼저 쓴 단계는 **무효**로 취급한다.

| 단계 | 슬라이스 | RED 명령 | 기대 RED 출력 | GREEN 산출물 |
|---|---|---|---|---|
| **P0** | 스캐폴드 부트 | `npx vitest run tests/engine.rules.test.ts` | `Failed to load .../src/engine.ts` (모듈 없음) | `package.json`, `tsconfig*.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, 빈 `src/engine.ts`(상수만) |
| **P1** | 바둑 코어: 그룹·활로·포획·자살·superko | `npx vitest run tests/engine.rules.test.ts` | `getGroup is not a function` 등 5개 실패 | `engine.ts` §3.1~3.2 |
| **P2** | `sweepDead` | `npx vitest run tests/engine.rules.test.ts -t "sweepDead"` | 실패 1건 | `sweepDead` |
| **P3** | 자원 경제·승패 판정 | `npx vitest run tests/engine.economy.test.ts` | 실패 | `playerMove`/`playerPass`/승패 판정(ASM-05) |
| **P4** | 층 데이터·전투 시작·골렘 2연타 | `npx vitest run tests/engine.floors.test.ts` | 실패 | `FLOORS`, `startBattle`, `aiTurn`의 골렘 분기(ASM-06/07) |
| **P5** | AI 휴리스틱 16개 항 | `npx vitest run tests/engine.ai.test.ts` | 실패 | `scoreAiMove`, `chooseAiMove` |
| **P6** | 불사왕 부활 | `npx vitest run tests/engine.revival.test.ts` | 실패 | `reviveCandidates`/`reviveScore`/`applyRevival` |
| **P7** | 유물 6종 (bomb 연쇄 포함) | `npx vitest run tests/engine.relics.test.ts` | 실패 | `RELICS`, `offerRelics`, `applyRelic`, `toggleBomb`, `detonateBomb`, guard/tempo/soul/recover 배선 |
| **P8** | 런 흐름: 클리어·왕 함락·돌 고갈 | `npx vitest run tests/run.flow.test.ts` | 실패 | `newRun`/`finishFloor`/런 전이 |
| **P9** | 엔진 순수성·의존성 감사 | `npx vitest run tests/engine.purity.test.ts tests/meta.deps.test.ts` | 실패 | (검사 통과를 위한 `engine.ts` 정리, `package.json` 확정) |
| **P10** | UI 렌더·한국어 문자열·SVG 구조 | `npx vitest run tests/ui.render.test.tsx` | `Cannot find module '../src/App'` | `strings.ts`, `theme.ts`, `styles.css`, `App.tsx`, 컴포넌트 8종 |
| **P11** | 620ms 타이머 + stale 가드 | `npx vitest run tests/ui.timer.test.tsx` | 실패 | `hooks/useAiTurn.ts` |
| **P12** | 380px/430px·터치 계약 | `npx vitest run tests/ui.responsive.test.tsx` | 실패 | `styles.css`·`index.html` 보정 |
| **P13** | 시뮬레이션 하니스 | `npx vitest run tests/sim.random.test.ts` | 실패 | 시드 PRNG 유틸(테스트 측), 시뮬 루프 |
| **P14** | 밸런스 하니스(색 반전) | `npx vite-node scripts/balance.ts --dry` → 스크립트 없음 오류 | `Cannot find` | `mirrorState`/`autoPlayerMove`, `scripts/balance.ts` |
| **P15** | 전체 회귀·증적 명령 | `npx vitest run` / `npx tsc --noEmit` / `npx vite build` | — | `evidence.config.json`, `.gitignore` 갱신 |

---

## 6. 알고리즘 상세 (구현 지침 — 값 변경 금지)

### 6.1 `tryMove` (R-G4)

```
1. board[p] !== null           → { ok:false, reason:'occupied' }
2. next = board.copy(); next[p] = color
3. captured = ∅
   for each n in neighbors(p) where next[n] === opponent(color):
       g = getGroup(next, n)
       if libertiesOfGroup(next, g).length === 0: captured ∪= g   // 중복 없이
   next[captured] = null
4. if libertiesOfGroup(next, getGroup(next, p)).length === 0 → { ok:false, reason:'suicide' }   // 원복
5. key = boardKey(next); if history.includes(key) → { ok:false, reason:'superko' }
6. → { ok:true, board:next, captured:[...], key }
```

- 4단계는 3단계 **이후**에 검사한다(포획으로 활로가 생기는 경우가 합법).
- 5단계 비교 대상은 **이번 전투의 모든 과거 키**(시작 상태 포함).

### 6.2 `sweepDead` (R-G7)

```
1. W 활로0 그룹 전부 수집 → removedW, 판에서 제거
2. 제거된 판으로 재계산
3. B 활로0 그룹 전부 수집 → removedB, 제거
4. return { board, removedW, removedB }
```

순서를 뒤집지 않는다(W 먼저 → 재계산 → B).

### 6.3 승패 판정 순서 (ASM-05)

```
B턴:  착수/패스 처리 → pouchB -= 1(패스면 0) → 포획 반영(+n, recover면 +2n)
      → W왕 그룹 소멸? → 3층 미부활이면 applyRevival, 아니면 win('king')
      → pendingB 남으면 계속 B턴, 아니면 W턴으로

W턴 시작: pouchW <= 0 → win('exhaust')
W 착수/패스: pouchW -= 1
      → B 돌 포획 시 lostB += n (soul이면 pouchB += ceil(n/2))
      → 폭발석 포함 B그룹이 잡혔으면 detonateBomb 연쇄 실행
      → B왕 그룹 소멸? → lose('king')
      → (골렘 2연타면 여기서 다시 W 착수, 그 사이에도 위 판정 수행)
W턴 종료: 미결이고 pouchB <= 0 → lose('depleted')
```

### 6.4 폭발석 연쇄 `detonateBomb` (R-R5)

```
전제: 폭발석이 포함된 B그룹이 W에게 잡혔다.
1. 폭발 위치 = bomb.pos
2. 그 위치의 상하좌우 중 W 돌을 파괴 → destroyed
3. sweepDead(board) → removedW, removedB
4. 회수량 = (destroyed + removedW).length,  recover 보유 시 ×2  → pouchB += 회수량
5. 잡힌 B그룹 + removedB 는 손실 합산 → lostB += n,  soul 보유 시 pouchB += ceil(n/2)
6. 결과 판 키를 history에 push (ASM-14)
7. W왕이 파괴/정리로 사라졌으면: 3층 미부활이면 applyRevival, 아니면 win('king') (ASM-15)
8. bomb.pos = null (폭발석 소멸), bomb.used 는 그대로 true 유지
```

### 6.5 부활 `applyRevival` (R-F5)

```
후보 = 빈 칸 중 가상 W 배치 시 활로 ≥ 1
if 후보 없음 → win('king')                              // 즉시 승리
점수(p) = libs(p)*3 + 인접W수*5 − 인접B수*4 + manhattan(p, kingB)
최대 점수 지점(동점이면 인덱스 최소 — ASM-17)에 무료 W 배치
kingW = 그 좌표, revived = true, history.push(boardKey)
두 번째 제거 시 → win('king')
```

- "무료"는 `pouchW`를 차감하지 않는다는 뜻이다.
- `kingB`가 이미 없으면(동시 상황) 맨해튼 항은 0으로 둔다.

### 6.6 AI 점수 (R-A) — 계산 순서

`scoreAiMove(state, p, randomTerm)`는 §2.6 표의 항을 **모두 합산**한다. 각 항의 부호·계수는 원문 그대로다. `randomTerm`은 호출자가 `rng() * 6`으로 만들어 전달한다(테스트는 0을 전달).

`chooseAiMove`: `legalMoves(board,'W',history)` 전부를 `tryMove`로 시뮬레이션해 최대 점수 지점을 반환. 합법수가 없으면 `null`(→ 패스, `pouchW -= 1`).

### 6.7 골렘 2연타 (R-F 2층)

```
W턴 시작 시 turnCountW += 1
pendingW = (floor === 2 && turnCountW % 3 === 0) ? 2 : 1
각 수마다 pouchW -= 1, 수 사이에 §6.3의 판정을 수행
승패가 결정되면 남은 pendingW를 버린다 (ASM-06)
```

### 6.8 `mirrorState` (R-T8)

색 반전은 **판·이력·왕 3요소를 모두** 뒤집어야 superko와 왕 판정이 보존된다.

```
board:   'B'→'W', 'W'→'B', 'R'→'R', null→null
history: 각 키에 동일 문자 치환 적용
kingB ↔ kingW
```

반전 상태에 `chooseAiMove`를 적용해 나온 좌표를 **원좌표 그대로** B의 착수로 사용한다(좌표계는 반전하지 않는다 — 색만 반전).

---

## 7. 명령·설정 계약

### 7.1 `package.json` 스크립트 (정확히 이 이름)

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "balance": "vite-node scripts/balance.ts"
  },
  "dependencies": { "react": "18.3.1", "react-dom": "18.3.1" },
  "devDependencies": {
    "@types/react": "<설치된 실측 버전>",
    "@types/react-dom": "<설치된 실측 버전>",
    "@vitejs/plugin-react": "4.7.0",
    "jsdom": "25.0.1",
    "typescript": "5.9.3",
    "vite": "5.4.21",
    "vite-node": "<설치된 실측 버전>",
    "vitest": "2.1.9"
  }
}
```

> `@types/*`와 `vite-node` 버전은 Codex가 `node_modules/<pkg>/package.json`에서 **실측해 기입**한다. 추측 금지. 새 패키지를 설치해야 하는 상황이 생기면 **작업을 멈추고 인간에게 보고**한다(AGENTS §9).

### 7.2 `evidence.config.json` 제안값 (Hermes가 반영)

```json
{
  "commands": {
    "focused_tests": ["npx", "vitest", "run", "tests/engine.rules.test.ts"],
    "lint": [],
    "typecheck": ["npx", "tsc", "--noEmit"],
    "full_tests": ["npx", "vitest", "run"],
    "build": ["npx", "vite", "build"]
  },
  "required": ["full_tests", "typecheck", "build"],
  "note": "ESLint 미설치 — lint는 비워 둔다. 증적 도구 Python suite는 별도로 python -m unittest discover -s tests 로 실행한다."
}
```

`lint`를 비워 두는 이유: ESLint가 설치되어 있지 않고, AGENTS §6.4는 **명령을 추측하지 말라**고 규정한다.

---

## 8. 테스트 매트릭스 (파일 ↔ 요구사항)

| 테스트 파일 | 환경 | 커버 요구사항 |
|---|---|---|
| `tests/engine.rules.test.ts` | node | R-G1~R-G7, R-T1~R-T4 |
| `tests/engine.economy.test.ts` | node | R-E1~R-E12, ASM-05 |
| `tests/engine.floors.test.ts` | node | R-F1~R-F4, R-D4, ASM-06/07 |
| `tests/engine.ai.test.ts` | node | R-A1~R-A16 |
| `tests/engine.revival.test.ts` | node | R-F5, R-D5, ASM-17 |
| `tests/engine.relics.test.ts` | node | R-R1~R-R6, R-T5, R-D6 |
| `tests/run.flow.test.ts` | node | R-T6, R-D1~R-D3, R-E11 |
| `tests/engine.purity.test.ts` | node | R-S3, R-D9 |
| `tests/meta.deps.test.ts` | node | R-S2, A-8, A-10 |
| `tests/ui.render.test.tsx` | jsdom | R-U1~R-U4, R-U6~R-U10, R-S7, R-V1~R-V3 |
| `tests/ui.timer.test.tsx` | jsdom | R-U5 |
| `tests/ui.responsive.test.tsx` | jsdom | R-S5, R-S6, R-D8, R-V4~R-V6 |
| `tests/sim.random.test.ts` | node | R-T7 |
| `scripts/balance.ts` (명령) | node | R-T8, R-T9(측정), CONFLICT-01 |

환경 지정은 파일 상단 `// @vitest-environment jsdom` 도크블록으로 한다(엔진 테스트는 node 환경 유지 → DOM 전역 오염 방지).

---

## 9. 엣지 케이스 체크리스트 (구현 시 반드시 처리)

1. 포획으로 활로가 생겨 합법이 되는 착수(자살 검사는 포획 **후**).
2. 여러 상대 그룹을 동시에 잡을 때 **중복 제거**(같은 그룹이 두 인접점으로 발견되는 경우).
3. 패 모양에서의 즉시 되따냄 → `superko`로 거부.
4. `sweepDead`의 W→재계산→B 순서 의존성(뒤집으면 결과가 달라진다).
5. 바위는 활로를 주지 않고 잡히지도 않으며 그룹에 포함되지 않는다.
6. W가 합법수 0 → 패스하고도 `pouchW -= 1` → 다음 W턴 시작에 `pouchW <= 0`이면 탈진 승리.
7. `pouchB`가 0 이하인 상태에서 B가 착수할 수 있는가 → 착수 자체는 막지 않되, **W턴 종료 후** 고갈 패배로 판정(R-E10 문언).
8. `tempo` 2연속 중 B가 패스하면 남은 연속수 소멸(R-E12).
9. 골렘 2연타 중 첫 수로 승패가 나면 두 번째 수를 두지 않는다.
10. `guard` 무료 돌이 B왕 4방향 모두 막혔을 때 배치 없음.
11. `bomb` 장전 상태에서 착수가 **불법수로 거부**되면 장전 상태가 유지되어야 한다(소모되지 않음).
12. 폭발석 연쇄로 B 자신의 돌이 추가로 정리되는 경우 손실에 합산(`soul` 적용).
13. 부활 후보가 0개 → 즉시 승리.
14. 부활한 왕이 다시 잡히면 승리(2회차).
15. 3층 바위 `(3,3)`이 화점과 겹칠 때의 렌더 순서.
16. `pouch7` 획득 시점의 주머니 표시 갱신(≤5 빨강 임계 해제).
17. 620ms 타이머 중 `새로하기 → 새로 시작`을 눌렀을 때 옛 타이머가 새 전투를 오염시키지 않을 것.
18. 오버레이·모달이 떠 있는 동안 판 클릭이 통과하지 않을 것.
19. `prefers-reduced-motion: reduce`에서 모든 애니메이션 비활성.
20. 시뮬레이션 400수 도달 시 예외 없이 종료(무승부 상태를 정상 종료로 기록).

---

## 10. 범위 밖 (Out of scope)

- 사운드, 튜토리얼, 저장/불러오기, 랭킹, 다국어, 온라인 기능
- ESLint/Prettier 도입, CI 설정, Docker
- 웹폰트 파일 번들·CDN 링크(OPEN-02 인간 승인 전 금지)
- Playwright 등 브라우저 자동화 도입(OPEN-03 인간 승인 전 금지)
- 밸런스 목표를 맞추기 위한 층 데이터 조정(**CONFLICT-01 / HDD-006 — 금지**)
- 증적 도구 Python 코드 수정
- commit/push(HDD-007)

---

## 11. 위험과 완화

| 위험 | 영향 | 완화 |
|---|---|---|
| 밸런스 목표 미달(특히 1층 ≈100%) | 완료 기준 R-D7 미충족 | 값을 바꾸지 않고 **측정치 보고 + 인간 게이트**(CONFLICT-01). 리포트에 `in_range` 표기 |
| jsdom 레이아웃 부재 | 380px 자동 검증 불완전 | CSS·DOM 계약 테스트로 대체하고 **인간 브라우저 확인 항목으로 명시**(OPEN-03). 통과했다고 과장하지 않는다 |
| `engine.ts` 비대화 | 가독성 | 섹션 주석으로 구획. 분할은 R-S3 문언 위반 위험이 커서 하지 않는다(A-1) |
| AI 난수로 인한 테스트 불안정 | 재현성 | `scoreAiMove(randomTerm)` 분리 + 시드 PRNG 주입(ASM-10) |
| 오프라인 `node_modules` 불일치 | 설치 실패 | 실측 버전 핀(A-8). 불일치 시 즉시 인간 보고 |
| RED 증거 누락 | 단계 무효 | 각 단계 RED 출력을 `06-codex-implementation-log.md`에 원문 보존 |
