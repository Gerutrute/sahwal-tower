export type Cell = null | 'B' | 'W' | 'R';
export type Color = 'B' | 'W';
export type Pos = number;
export type Board = readonly Cell[];
export type Rng = () => number;

export const SIZE = 7;
export const CELLS = 49;
export const START_POUCH = 28;
export const REST_BONUS = 4;
export const AI_DELAY_MS = 620;
export const SIM_MOVE_LIMIT = 400;
export const POUCH_WARN = 5;

export const idx = (row: number, col: number): Pos => row * SIZE + col;
export const rowOf = (p: Pos): number => Math.floor(p / SIZE);
export const colOf = (p: Pos): number => p % SIZE;
export const neighbors = (p: Pos): Pos[] => {
  const row = rowOf(p);
  const col = colOf(p);
  const result: Pos[] = [];
  if (row > 0) result.push(idx(row - 1, col));
  if (col > 0) result.push(idx(row, col - 1));
  if (col < SIZE - 1) result.push(idx(row, col + 1));
  if (row < SIZE - 1) result.push(idx(row + 1, col));
  return result;
};
export const manhattan = (a: Pos, b: Pos): number =>
  Math.abs(rowOf(a) - rowOf(b)) + Math.abs(colOf(a) - colOf(b));
export const chebyshev = (a: Pos, b: Pos): number =>
  Math.max(Math.abs(rowOf(a) - rowOf(b)), Math.abs(colOf(a) - colOf(b)));
export const boardKey = (board: Board): string => board.map((cell) => cell ?? '.').join('');

const isColor = (cell: Cell): cell is Color => cell === 'B' || cell === 'W';

export function getGroup(board: Board, p: Pos): Pos[] {
  const color = board[p];
  if (!isColor(color)) return [];
  const seen = new Set<Pos>([p]);
  const queue = [p];
  while (queue.length) {
    const current = queue.shift()!;
    for (const next of neighbors(current)) {
      if (board[next] === color && !seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return [...seen].sort((a, b) => a - b);
}

export function libertiesOfGroup(board: Board, group: readonly Pos[]): Pos[] {
  const liberties = new Set<Pos>();
  for (const stone of group) {
    for (const next of neighbors(stone)) if (board[next] === null) liberties.add(next);
  }
  return [...liberties].sort((a, b) => a - b);
}

export function libsOf(board: Board, p: Pos): number {
  return libertiesOfGroup(board, getGroup(board, p)).length;
}

export type IllegalReason = 'occupied' | 'suicide' | 'superko';
export interface MoveResult {
  ok: boolean;
  reason?: IllegalReason;
  board: Board;
  captured: Pos[];
  key: string;
}

export function tryMove(board: Board, p: Pos, color: Color, history: readonly string[]): MoveResult {
  if (p < 0 || p >= CELLS || board[p] !== null) {
    return { ok: false, reason: 'occupied', board, captured: [], key: boardKey(board) };
  }
  const next = [...board];
  next[p] = color;
  const opponent: Color = color === 'B' ? 'W' : 'B';
  const captured = new Set<Pos>();
  const checked = new Set<Pos>();
  for (const adjacent of neighbors(p)) {
    if (next[adjacent] !== opponent || checked.has(adjacent)) continue;
    const group = getGroup(next, adjacent);
    group.forEach((stone) => checked.add(stone));
    if (libertiesOfGroup(next, group).length === 0) group.forEach((stone) => captured.add(stone));
  }
  captured.forEach((stone) => { next[stone] = null; });
  if (libsOf(next, p) === 0) {
    return { ok: false, reason: 'suicide', board, captured: [], key: boardKey(board) };
  }
  const key = boardKey(next);
  if (history.includes(key)) {
    return { ok: false, reason: 'superko', board, captured: [], key: boardKey(board) };
  }
  return { ok: true, board: next, captured: [...captured].sort((a, b) => a - b), key };
}

export function legalMoves(board: Board, color: Color, history: readonly string[]): Pos[] {
  const result: Pos[] = [];
  for (let p = 0; p < CELLS; p += 1) if (tryMove(board, p, color, history).ok) result.push(p);
  return result;
}

export interface SweepResult { board: Board; removedW: Pos[]; removedB: Pos[] }

function zeroLibertyGroups(board: Board, color: Color): Pos[] {
  const visited = new Set<Pos>();
  const removed: Pos[] = [];
  for (let p = 0; p < CELLS; p += 1) {
    if (board[p] !== color || visited.has(p)) continue;
    const group = getGroup(board, p);
    group.forEach((stone) => visited.add(stone));
    if (libertiesOfGroup(board, group).length === 0) removed.push(...group);
  }
  return removed.sort((a, b) => a - b);
}

export function sweepDead(board: Board): SweepResult {
  const next = [...board];
  const removedW = zeroLibertyGroups(next, 'W');
  removedW.forEach((stone) => { next[stone] = null; });
  const removedB = zeroLibertyGroups(next, 'B');
  removedB.forEach((stone) => { next[stone] = null; });
  return { board: next, removedW, removedB };
}

export type FloorId = 1 | 2 | 3;
export type RelicId = 'recover' | 'soul' | 'pouch7' | 'tempo' | 'bomb' | 'guard';
export interface FloorData {
  id: FloorId;
  name: string;
  hanja: string;
  seal2: string;
  floorSeal: string;
  gimmick: string;
  rocks: Pos[];
  kingW: Pos;
  kingB: Pos;
  guardsW: Pos[];
  pouchW: number;
}

export const FLOORS: Readonly<Record<FloorId, FloorData>> = {
  1: { id: 1, name: '침입귀', hanja: '侵入鬼', seal2: '侵入', floorSeal: '一', gimmick: '기믹 없음', rocks: [], kingW: idx(1, 3), kingB: idx(5, 3), guardsW: [], pouchW: 20 },
  2: { id: 2, name: '두터움의 골렘', hanja: '厚壁魔', seal2: '厚壁', floorSeal: '二', gimmick: '세 번째 턴마다 두 수를 연달아 둔다', rocks: [idx(2, 2), idx(2, 4), idx(4, 2), idx(4, 4)], kingW: idx(1, 3), kingB: idx(5, 3), guardsW: [idx(1, 2), idx(1, 4)], pouchW: 24 },
  3: { id: 3, name: '불사왕', hanja: '不死王', seal2: '不死', floorSeal: '三', gimmick: '왕돌이 처음 제거되면 한 번 부활한다', rocks: [idx(3, 3), idx(0, 0), idx(0, 6)], kingW: idx(1, 3), kingB: idx(5, 3), guardsW: [idx(1, 2), idx(1, 4)], pouchW: 30 },
};

export interface RelicData { id: RelicId; name: string; hanja: string; desc: string }
export const RELICS: readonly RelicData[] = [
  { id: 'recover', name: '회수의 손', hanja: '回收', desc: '포획한 돌을 두 배로 회수한다' },
  { id: 'soul', name: '사석의 혼', hanja: '捨石', desc: '잃은 돌의 절반을 올림해 돌려받는다' },
  { id: 'pouch7', name: '두둑한 주머니', hanja: '碁囊', desc: '즉시 돌 7개를 얻는다' },
  { id: 'tempo', name: '선수의 부채', hanja: '先手', desc: '전투 첫 턴에 두 수를 연달아 둔다' },
  { id: 'bomb', name: '폭발석', hanja: '爆石', desc: '전투당 한 번 폭발석을 장전한다' },
  { id: 'guard', name: '왕의 호위', hanja: '護衛', desc: '왕 곁에 무료 호위돌 하나를 둔다' },
];

export type BattleStatus = 'playing' | 'win' | 'lose';
export type WinReason = 'king' | 'exhaust';
export type LoseReason = 'king' | 'depleted';
export interface BattleState {
  floor: FloorId;
  board: Board;
  history: string[];
  turn: Color;
  pouchB: number;
  pouchW: number;
  kingB: Pos | null;
  kingW: Pos | null;
  capturedW: number;
  lostB: number;
  relics: RelicId[];
  bomb: { armed: boolean; used: boolean; pos: Pos | null };
  pendingB: number;
  pendingW: number;
  turnCountW: number;
  revived: boolean;
  lastMove: Pos | null;
  status: BattleStatus;
  reason: WinReason | LoseReason | null;
  log: string[];
}
export interface RunState {
  floor: FloorId;
  pouch: number;
  relics: RelicId[];
  totalCaptured: number;
  totalLost: number;
  clearedFloors: number;
}

export const newRun = (): RunState => ({ floor: 1, pouch: START_POUCH, relics: [], totalCaptured: 0, totalLost: 0, clearedFloors: 0 });

export function applyRelic(run: RunState, id: RelicId): RunState {
  return { ...run, pouch: run.pouch + (id === 'pouch7' ? 7 : 0), relics: run.relics.includes(id) ? [...run.relics] : [...run.relics, id] };
}

export function offerRelics(owned: readonly RelicId[], rng: Rng): RelicId[] {
  const pool = RELICS.map((relic) => relic.id).filter((id) => !owned.includes(id));
  const result: RelicId[] = [];
  while (result.length < 3 && pool.length) {
    const chosen = Math.min(pool.length - 1, Math.floor(rng() * pool.length));
    result.push(pool.splice(chosen, 1)[0]);
  }
  return result;
}

export function startBattle(run: RunState, floor: FloorId): BattleState {
  const data = FLOORS[floor];
  const board = Array<Cell>(CELLS).fill(null);
  data.rocks.forEach((p) => { board[p] = 'R'; });
  board[data.kingW] = 'W';
  board[data.kingB] = 'B';
  data.guardsW.forEach((p) => { board[p] = 'W'; });
  if (run.relics.includes('guard')) {
    const candidates = [idx(4, 3), idx(5, 2), idx(5, 4), idx(6, 3)];
    const guard = candidates.find((p) => board[p] === null);
    if (guard !== undefined) board[guard] = 'B';
  }
  return {
    floor, board, history: [boardKey(board)], turn: 'B', pouchB: run.pouch, pouchW: data.pouchW,
    kingB: data.kingB, kingW: data.kingW, capturedW: 0, lostB: 0, relics: [...run.relics],
    bomb: { armed: false, used: false, pos: null }, pendingB: run.relics.includes('tempo') ? 2 : 1,
    pendingW: 0, turnCountW: 0, revived: false, lastMove: null, status: 'playing', reason: null,
    log: [`${floor}층 전투가 시작됐다.`],
  };
}

export function playerMove(state: BattleState, p: Pos): BattleState {
  if (state.status !== 'playing' || state.turn !== 'B' || state.pouchB <= 0) return state;
  const move = tryMove(state.board, p, 'B', state.history);
  if (!move.ok) return { ...state, log: [...state.log, '그곳에는 둘 수 없다.'] };
  const recovery = move.captured.length * (state.relics.includes('recover') ? 2 : 1);
  let next: BattleState = {
    ...state, board: move.board, history: [...state.history, move.key], pouchB: Math.max(0, state.pouchB - 1 + recovery),
    capturedW: state.capturedW + move.captured.length, lastMove: p,
    bomb: state.bomb.armed ? { armed: false, used: true, pos: p } : { ...state.bomb },
    pendingB: Math.max(0, state.pendingB - 1), log: [...state.log, move.captured.length ? `백돌 ${move.captured.length}개를 잡았다.` : '흑돌을 놓았다.'],
  };
  if (state.kingW !== null && move.captured.includes(state.kingW)) {
    next = resolveWKing({ ...next, kingW: null });
  }
  if (next.status === 'playing') next = { ...next, turn: next.pendingB > 0 ? 'B' : 'W' };
  return next;
}

export function playerPass(state: BattleState): BattleState {
  if (state.status !== 'playing' || state.turn !== 'B') return state;
  return { ...state, pendingB: 0, turn: 'W', log: [...state.log, '한 수 쉬었다.'] };
}

export function toggleBomb(state: BattleState): BattleState {
  if (!state.relics.includes('bomb') || state.bomb.used || state.status !== 'playing' || state.turn !== 'B') return state;
  return { ...state, bomb: { ...state.bomb, armed: !state.bomb.armed } };
}

function allGroups(board: Board, color: Color): Pos[][] {
  const seen = new Set<Pos>();
  const groups: Pos[][] = [];
  for (let p = 0; p < CELLS; p += 1) {
    if (board[p] !== color || seen.has(p)) continue;
    const group = getGroup(board, p);
    group.forEach((stone) => seen.add(stone));
    groups.push(group);
  }
  return groups;
}

export function scoreAiMove(state: BattleState, p: Pos, randomTerm: number): number {
  const move = tryMove(state.board, p, 'W', state.history);
  if (!move.ok) return Number.NEGATIVE_INFINITY;
  let score = move.captured.length * 100;
  if (state.kingB !== null && move.captured.includes(state.kingB)) score += 100000;
  const placedLibs = libsOf(move.board, p);
  score += placedLibs * 4;
  if (placedLibs === 1 && move.captured.length < 2) score -= 150;
  if (neighbors(p).every((n) => state.board[n] === 'W' || state.board[n] === 'R')) {
    score -= 120;
  }
  for (const group of allGroups(state.board, 'W')) {
    if (libertiesOfGroup(state.board, group).length !== 1) continue;
    const representative = group.find((stone) => move.board[stone] === 'W');
    if (representative !== undefined && libsOf(move.board, representative) >= 2) {
      score += 60 + group.length * 20;
      if (state.kingW !== null && group.includes(state.kingW)) score += 8000;
    }
  }
  if (state.kingW !== null && move.board[state.kingW] === 'W' && libsOf(move.board, state.kingW) === 1) score -= 5000;
  const adjacentGroups = new Map<Pos, Pos[]>();
  for (const adjacent of neighbors(p)) {
    if (state.board[adjacent] !== 'B') continue;
    const group = getGroup(state.board, adjacent);
    adjacentGroups.set(group[0], group);
  }
  for (const group of adjacentGroups.values()) {
    const representative = group.find((stone) => move.board[stone] === 'B');
    if (representative === undefined) continue;
    const liberties = libsOf(move.board, representative);
    const hasKing = state.kingB !== null && group.includes(state.kingB);
    if (liberties === 1) score += 50 + group.length * 8 + (hasKing ? 900 : 0);
    else if (liberties === 2 && hasKing) score += 200;
  }
  if (state.kingB !== null) score += (10 - manhattan(p, state.kingB)) * 3;
  score += 3 - chebyshev(p, idx(3, 3));
  score += neighbors(p).filter((n) => state.board[n] === 'W').length * 3;
  return score + randomTerm;
}

export function chooseAiMove(state: BattleState, rng: Rng): Pos | null {
  const moves = legalMoves(state.board, 'W', state.history);
  let best: Pos | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const move of moves) {
    const score = scoreAiMove(state, move, rng() * 6);
    if (score > bestScore) { bestScore = score; best = move; }
  }
  return best;
}

export function reviveCandidates(state: BattleState): Pos[] {
  const result: Pos[] = [];
  for (let p = 0; p < CELLS; p += 1) {
    if (state.board[p] !== null) continue;
    const board = [...state.board];
    board[p] = 'W';
    if (libsOf(board, p) >= 1) result.push(p);
  }
  return result;
}

export function reviveScore(state: BattleState, p: Pos): number {
  const board = [...state.board];
  board[p] = 'W';
  const adjacentW = neighbors(p).filter((n) => state.board[n] === 'W').length;
  const adjacentB = neighbors(p).filter((n) => state.board[n] === 'B').length;
  return libsOf(board, p) * 3 + adjacentW * 5 - adjacentB * 4 + (state.kingB === null ? 0 : manhattan(p, state.kingB));
}

export function applyRevival(state: BattleState): BattleState {
  if (state.revived) return { ...state, status: 'win', reason: 'king', kingW: null };
  const candidates = reviveCandidates(state);
  if (!candidates.length) return { ...state, status: 'win', reason: 'king', kingW: null };
  let best = candidates[0];
  for (const candidate of candidates.slice(1)) {
    if (reviveScore(state, candidate) > reviveScore(state, best)) best = candidate;
  }
  const board = [...state.board];
  board[best] = 'W';
  return { ...state, board, kingW: best, revived: true, status: 'playing', reason: null, history: [...state.history, boardKey(board)], log: [...state.log, '불사왕이 다시 일어섰다.'] };
}

function resolveWKing(state: BattleState): BattleState {
  if (state.floor === 3 && !state.revived) return applyRevival({ ...state, kingW: null });
  return { ...state, kingW: null, status: 'win', reason: 'king' };
}

export function detonateBomb(state: BattleState): BattleState {
  if (state.bomb.pos === null) return state;
  const board = [...state.board];
  const destroyed: Pos[] = [];
  for (const adjacent of neighbors(state.bomb.pos)) {
    if (board[adjacent] === 'W') { destroyed.push(adjacent); board[adjacent] = null; }
  }
  const swept = sweepDead(board);
  const removedW = [...destroyed, ...swept.removedW];
  const recovery = removedW.length * (state.relics.includes('recover') ? 2 : 1);
  const lost = swept.removedB.length;
  const refund = state.relics.includes('soul') ? Math.ceil(lost / 2) : 0;
  let next: BattleState = {
    ...state, board: swept.board, pouchB: state.pouchB + recovery + refund,
    capturedW: state.capturedW + removedW.length, lostB: state.lostB + lost,
    history: [...state.history, boardKey(swept.board)], bomb: { armed: false, used: true, pos: null },
    log: [...state.log, `폭발석이 백돌 ${removedW.length}개를 쓸어냈다.`],
  };
  if (state.kingW !== null && removedW.includes(state.kingW)) next = resolveWKing({ ...next, kingW: null });
  return next;
}

function swapCell(cell: Cell): Cell { return cell === 'B' ? 'W' : cell === 'W' ? 'B' : cell; }
function swapKey(key: string): string { return [...key].map((cell) => cell === 'B' ? 'W' : cell === 'W' ? 'B' : cell).join(''); }
export function mirrorState(state: BattleState): BattleState {
  return { ...state, board: state.board.map(swapCell), history: state.history.map(swapKey), kingB: state.kingW, kingW: state.kingB };
}
export function autoPlayerMove(state: BattleState, rng: Rng): Pos | null {
  return chooseAiMove({ ...mirrorState(state), turn: 'W' }, rng);
}

export function aiTurn(state: BattleState, rng: Rng): BattleState {
  if (state.status !== 'playing' || state.turn !== 'W') return state;
  if (state.pouchW <= 0) return { ...state, status: 'win', reason: 'exhaust', log: [...state.log, '적이 탈진했다.'] };
  const turnCountW = state.turnCountW + 1;
  const actions = state.floor === 2 && turnCountW % 3 === 0 ? 2 : 1;
  let next = { ...state, turnCountW, pendingW: actions };
  for (let action = 0; action < actions && next.status === 'playing' && next.pouchW > 0; action += 1) {
    const p = chooseAiMove(next, rng);
    if (p === null) {
      next = { ...next, pouchW: Math.max(0, next.pouchW - 1), pendingW: next.pendingW - 1, log: [...next.log, '적이 한 수 쉬었다.'] };
      continue;
    }
    const move = tryMove(next.board, p, 'W', next.history);
    if (!move.ok) continue;
    const refund = next.relics.includes('soul') ? Math.ceil(move.captured.length / 2) : 0;
    const bombCaptured = next.bomb.pos !== null && move.captured.includes(next.bomb.pos);
    next = {
      ...next, board: move.board, history: [...next.history, move.key], pouchW: Math.max(0, next.pouchW - 1),
      pouchB: next.pouchB + refund, lostB: next.lostB + move.captured.length, lastMove: p,
      pendingW: next.pendingW - 1, log: [...next.log, move.captured.length ? `흑돌 ${move.captured.length}개를 잃었다.` : '적이 백돌을 놓았다.'],
    };
    if (bombCaptured) next = detonateBomb(next);
    if (next.status === 'playing' && next.kingB !== null && move.captured.includes(next.kingB)) next = { ...next, kingB: null, status: 'lose', reason: 'king' };
  }
  if (next.status === 'playing' && next.pouchB <= 0) return { ...next, status: 'lose', reason: 'depleted' };
  return next.status === 'playing' ? { ...next, turn: 'B', pendingB: 1, pendingW: 0 } : next;
}

export function finishFloor(run: RunState, state: BattleState): RunState {
  return { ...run, floor: Math.min(3, run.floor + 1) as FloorId, pouch: state.pouchB + REST_BONUS, totalCaptured: run.totalCaptured + state.capturedW, totalLost: run.totalLost + state.lostB, clearedFloors: run.clearedFloors + 1 };
}
