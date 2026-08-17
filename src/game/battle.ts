import { createDeckState, createStoneFromCard, resolveCardUse } from './deck';
import { libertiesAt, neighbors, tryPlay } from './go';
import { randomInt } from './rng';
import { scoreArea } from './scoring';
import type { DeckState } from './deck';
import type { RandomSource } from './rng';
import type { BoardState, Stone, StoneColor, StoneKind } from './types';

export type BattlePhase =
  | 'turn-start'
  | 'pre-move'
  | 'choose-card'
  | 'choose-point'
  | 'resolving'
  | 'turn-end'
  | 'scoring'
  | 'result'
  | 'revival-special-move';

export type RevivalPriority = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type RevivalTieBreak = 'lowest-point' | 'seeded';

export interface RevivalScoreWeights {
  readonly captured: number;
  readonly liberties: number;
  readonly adjacentFriendly: number;
  readonly adjacentOpponent: number;
  readonly pointWeights: readonly number[];
}

export interface RevivalTraitDefinition {
  readonly id: string;
  readonly scoreWeights: RevivalScoreWeights;
}

export interface RevivalSpecialMoveDefinition {
  readonly id: string;
  readonly priority: RevivalPriority;
  readonly stoneKind: StoneKind;
  readonly scoreWeights: RevivalScoreWeights;
  readonly tieBreak: RevivalTieBreak;
}

export interface BossGaugeDefinition {
  readonly id: string;
  readonly initial: number;
  readonly specialMoveDelta: number;
}

export interface RevivalDefinition {
  readonly trait: RevivalTraitDefinition;
  readonly specialMoves: readonly RevivalSpecialMoveDefinition[];
  readonly bossGauge?: BossGaugeDefinition;
}

export interface EnemyDefinition {
  readonly id: string;
  readonly revival?: RevivalDefinition;
}

export type BattleRewardStatus = 'none' | 'withheld' | 'available';
export type BattleOutcome = 'run-loss' | 'stage-win';

export interface BattleLogEntry {
  readonly type: 'move' | 'pass' | 'relic' | 'revival' | 'result';
  readonly actor: StoneColor;
  readonly automatic?: boolean;
  readonly cardId?: string;
  readonly point?: number;
  readonly sourceId?: string;
  readonly priority?: RevivalPriority;
  readonly message: string;
}

export interface BattleState {
  readonly act: number;
  readonly board: BoardState;
  readonly turn: StoneColor;
  readonly phase: BattlePhase;
  readonly decks: Readonly<Record<StoneColor, DeckState>>;
  readonly relics: Readonly<Record<StoneColor, readonly string[]>>;
  readonly enemyTraits: readonly string[];
  readonly enemy: EnemyDefinition;
  readonly komi: number;
  readonly selectedCardId: string | null;
  readonly koForbiddenKey: string | null;
  readonly consecutivePasses: number;
  readonly ending: boolean;
  readonly outcome: BattleOutcome | null;
  readonly rewardStatus: BattleRewardStatus;
  readonly revivalStage: 1 | 2;
  readonly bossGauges: Readonly<Record<string, number>>;
  readonly moveNumber: number;
  readonly usedRelicsThisTurn: readonly string[];
  readonly log: readonly BattleLogEntry[];
}

export interface CreateBattleInput {
  readonly act: number;
  readonly board: BoardState;
  readonly playerDeck: readonly StoneKind[];
  readonly enemyDeck: readonly StoneKind[];
  readonly enemy: EnemyDefinition;
  readonly komi: number;
  readonly rng: RandomSource;
  readonly playerRelics?: readonly string[];
  readonly enemyRelics?: readonly string[];
  readonly turn?: StoneColor;
  readonly koForbiddenKey?: string | null;
}

export type BattleAction =
  | { readonly type: 'BEGIN_TURN' }
  | { readonly type: 'CONTINUE_TO_MOVE' }
  | { readonly type: 'USE_RELIC'; readonly relicId: string }
  | { readonly type: 'SELECT_CARD'; readonly cardId: string }
  | { readonly type: 'PLAY_CARD'; readonly point: number; readonly rng: RandomSource }
  | { readonly type: 'RESOLVE_MOVE' }
  | { readonly type: 'END_TURN' }
  | { readonly type: 'PASS'; readonly automatic?: boolean }
  | { readonly type: 'SCORE'; readonly rng: RandomSource }
  | { readonly type: 'DECLARE_OUTCOME'; readonly winner: StoneColor; readonly rng: RandomSource }
  | { readonly type: 'REVIVAL_SPECIAL_MOVE'; readonly rng: RandomSource };

function assertPriority(priority: number): asserts priority is RevivalPriority {
  if (!Number.isSafeInteger(priority) || priority < 1 || priority > 8) {
    throw new RangeError('revival special move priority must be an integer from 1 through 8');
  }
}

function assertWeights(weights: RevivalScoreWeights, boardPoints?: number): void {
  const values = [
    weights.captured,
    weights.liberties,
    weights.adjacentFriendly,
    weights.adjacentOpponent,
    ...weights.pointWeights,
  ];
  if (values.some((value) => !Number.isFinite(value))) {
    throw new RangeError('revival score weights must be finite');
  }
  if (boardPoints !== undefined && weights.pointWeights.length !== boardPoints) {
    throw new RangeError(`revival pointWeights must contain ${boardPoints} entries`);
  }
}

export function validateEnemyDefinition(enemy: EnemyDefinition, boardPoints?: number): void {
  const revival = enemy.revival;
  if (revival === undefined) return;
  assertWeights(revival.trait.scoreWeights, boardPoints);
  if (revival.specialMoves.length === 0) {
    throw new RangeError('revival requires at least one injected special move');
  }
  revival.specialMoves.forEach((move) => {
    assertPriority(move.priority);
    assertWeights(move.scoreWeights, boardPoints);
  });
  if (revival.bossGauge !== undefined) {
    if (!Number.isFinite(revival.bossGauge.initial)
      || !Number.isFinite(revival.bossGauge.specialMoveDelta)) {
      throw new RangeError('boss gauge values must be finite');
    }
  }
}

export function createBattleState(input: CreateBattleInput): BattleState {
  if (!Number.isFinite(input.komi)) throw new RangeError('komi must be finite');
  validateEnemyDefinition(input.enemy, input.board.points.length);
  return {
    act: input.act,
    board: input.board,
    turn: input.turn ?? 'B',
    phase: 'turn-start',
    decks: {
      B: createDeckState(input.playerDeck, input.rng),
      W: createDeckState(input.enemyDeck, input.rng),
    },
    relics: {
      B: [...(input.playerRelics ?? [])],
      W: [...(input.enemyRelics ?? [])],
    },
    enemyTraits: [],
    enemy: input.enemy,
    komi: input.komi,
    selectedCardId: null,
    koForbiddenKey: input.koForbiddenKey ?? null,
    consecutivePasses: 0,
    ending: false,
    outcome: null,
    rewardStatus: 'none',
    revivalStage: 1,
    bossGauges: {},
    moveNumber: 0,
    usedRelicsThisTurn: [],
    log: [],
  };
}

function activeDeck(state: BattleState): DeckState {
  return state.decks[state.turn];
}

export function hasLegalCardMove(state: BattleState): boolean {
  return activeDeck(state).hand.some((card) => {
    for (let point = 0; point < state.board.points.length; point += 1) {
      const stone = createStoneFromCard(card, state.turn, `legal-${card.id}-${point}`);
      if (tryPlay(state.board, point, stone, state.koForbiddenKey).ok) return true;
    }
    return false;
  });
}

function passBattle(state: BattleState, automatic: boolean): BattleState {
  const consecutivePasses = state.consecutivePasses + 1;
  return {
    ...state,
    turn: state.turn === 'B' ? 'W' : 'B',
    phase: consecutivePasses >= 2 ? 'scoring' : 'turn-start',
    selectedCardId: null,
    koForbiddenKey: null,
    consecutivePasses,
    ending: consecutivePasses >= 2,
    usedRelicsThisTurn: [],
    log: [...state.log, {
      type: 'pass',
      actor: state.turn,
      automatic,
      message: automatic ? '합법 수가 없어 자동으로 패스했습니다.' : '패스했습니다.',
    }],
  };
}

function endTurn(state: BattleState): BattleState {
  return {
    ...state,
    turn: state.turn === 'B' ? 'W' : 'B',
    phase: 'turn-start',
    selectedCardId: null,
    usedRelicsThisTurn: [],
  };
}

function startRevival(state: BattleState): BattleState {
  const revival = state.enemy.revival;
  if (revival === undefined) return finishBattle(state, 'run-loss');
  const bossGauges = revival.bossGauge === undefined
    ? state.bossGauges
    : { ...state.bossGauges, [revival.bossGauge.id]: revival.bossGauge.initial };
  return {
    ...state,
    turn: 'W',
    phase: 'revival-special-move',
    selectedCardId: null,
    consecutivePasses: 0,
    ending: false,
    outcome: null,
    rewardStatus: 'withheld',
    revivalStage: 2,
    enemyTraits: state.enemyTraits.includes(revival.trait.id)
      ? state.enemyTraits
      : [...state.enemyTraits, revival.trait.id],
    bossGauges,
    usedRelicsThisTurn: [],
    log: [...state.log, {
      type: 'revival',
      actor: 'W',
      sourceId: revival.trait.id,
      message: '적이 2단계로 부활했습니다.',
    }],
  };
}

function finishBattle(state: BattleState, outcome: BattleOutcome): BattleState {
  return {
    ...state,
    phase: 'result',
    ending: true,
    outcome,
    rewardStatus: outcome === 'stage-win' ? 'available' : 'withheld',
    log: [...state.log, {
      type: 'result',
      actor: outcome === 'stage-win' ? 'B' : 'W',
      message: outcome === 'stage-win' ? '스테이지 최종 승리' : '런 종료',
    }],
  };
}

export function resolveBattleOutcome(
  state: BattleState,
  winner: StoneColor,
  _rng: RandomSource,
): BattleState {
  if (winner === 'B') return finishBattle(state, 'stage-win');
  if (state.act === 1 && state.revivalStage === 1 && state.enemy.revival !== undefined) {
    return startRevival(state);
  }
  return finishBattle(state, 'run-loss');
}

function combinedWeights(
  trait: RevivalScoreWeights,
  move: RevivalScoreWeights,
  point: number,
): Required<Omit<RevivalScoreWeights, 'pointWeights'>> & { readonly point: number } {
  return {
    captured: trait.captured + move.captured,
    liberties: trait.liberties + move.liberties,
    adjacentFriendly: trait.adjacentFriendly + move.adjacentFriendly,
    adjacentOpponent: trait.adjacentOpponent + move.adjacentOpponent,
    point: trait.pointWeights[point] + move.pointWeights[point],
  };
}

function revivalMoveScore(
  state: BattleState,
  move: RevivalSpecialMoveDefinition,
  point: number,
  play: Extract<ReturnType<typeof tryPlay>, { readonly ok: true }>,
): number {
  const revival = state.enemy.revival;
  if (revival === undefined) return -Infinity;
  const weights = combinedWeights(revival.trait.scoreWeights, move.scoreWeights, point);
  const adjacent = neighbors(state.board.size, point);
  const adjacentFriendly = adjacent.filter((candidate) => state.board.points[candidate]?.color === 'W').length;
  const adjacentOpponent = adjacent.filter((candidate) => state.board.points[candidate]?.color === 'B').length;
  const liberties = libertiesAt(play.board, point).length;
  return play.capturedCount * weights.captured
    + liberties * weights.liberties
    + adjacentFriendly * weights.adjacentFriendly
    + adjacentOpponent * weights.adjacentOpponent
    + weights.point;
}

interface RevivalCandidate {
  readonly definition: RevivalSpecialMoveDefinition;
  readonly point: number;
  readonly play: Extract<ReturnType<typeof tryPlay>, { readonly ok: true }>;
  readonly score: number;
}

function chooseRevivalCandidate(state: BattleState, rng: RandomSource): RevivalCandidate | null {
  const revival = state.enemy.revival;
  if (revival === undefined) return null;
  const definitions = revival.specialMoves
    .map((definition, order) => ({ definition, order }))
    .sort((left, right) => left.definition.priority - right.definition.priority || left.order - right.order);

  for (const { definition } of definitions) {
    const candidates: RevivalCandidate[] = [];
    for (let point = 0; point < state.board.points.length; point += 1) {
      const stone: Stone = {
        color: 'W',
        kind: definition.stoneKind,
        instanceId: `revival-${state.moveNumber + 1}-${definition.id}`,
      };
      const play = tryPlay(state.board, point, stone, state.koForbiddenKey);
      if (play.ok) {
        candidates.push({
          definition,
          point,
          play,
          score: revivalMoveScore(state, definition, point, play),
        });
      }
    }
    if (candidates.length === 0) continue;
    const bestScore = candidates.reduce((best, candidate) => Math.max(best, candidate.score), -Infinity);
    const tied = candidates.filter((candidate) => candidate.score === bestScore);
    if (definition.tieBreak === 'lowest-point') return tied[0];
    return tied[randomInt(rng, tied.length)];
  }
  return null;
}

export function performRevivalSpecialMove(
  state: BattleState,
  rng: RandomSource,
): BattleState {
  if (state.phase !== 'revival-special-move') return state;
  const candidate = chooseRevivalCandidate(state, rng);
  if (candidate === null) {
    return {
      ...state,
      turn: 'B',
      phase: 'turn-start',
      koForbiddenKey: null,
      consecutivePasses: 1,
      log: [...state.log, {
        type: 'pass',
        actor: 'W',
        automatic: true,
        message: '부활 전용 착수 후보가 없어 자동으로 패스했습니다.',
      }],
    };
  }

  const gauge = state.enemy.revival?.bossGauge;
  const bossGauges = gauge === undefined
    ? state.bossGauges
    : {
        ...state.bossGauges,
        [gauge.id]: (state.bossGauges[gauge.id] ?? gauge.initial) + gauge.specialMoveDelta,
      };
  return {
    ...state,
    board: candidate.play.board,
    turn: 'B',
    phase: 'turn-start',
    koForbiddenKey: candidate.play.koForbiddenKey,
    moveNumber: state.moveNumber + 1,
    bossGauges,
    log: [...state.log, {
      type: 'move',
      actor: 'W',
      sourceId: candidate.definition.id,
      priority: candidate.definition.priority,
      point: candidate.point,
      message: '부활 전용 착수를 수행했습니다.',
    }],
  };
}

export function battleReducer(state: BattleState, action: BattleAction): BattleState {
  switch (action.type) {
    case 'BEGIN_TURN':
      if (state.phase !== 'turn-start') return state;
      if (!hasLegalCardMove(state)) return passBattle(state, true);
      return { ...state, phase: 'pre-move' };
    case 'CONTINUE_TO_MOVE':
      if (state.phase !== 'pre-move') return state;
      if (!hasLegalCardMove(state)) return passBattle(state, true);
      return { ...state, phase: 'choose-card' };
    case 'USE_RELIC':
      if (state.phase !== 'pre-move'
        || !state.relics[state.turn].includes(action.relicId)
        || state.usedRelicsThisTurn.includes(action.relicId)) return state;
      return {
        ...state,
        usedRelicsThisTurn: [...state.usedRelicsThisTurn, action.relicId],
        log: [...state.log, {
          type: 'relic',
          actor: state.turn,
          sourceId: action.relicId,
          message: '부적을 사용했습니다.',
        }],
      };
    case 'SELECT_CARD':
      if (state.phase !== 'choose-card'
        || !activeDeck(state).hand.some((card) => card.id === action.cardId)) return state;
      return { ...state, phase: 'choose-point', selectedCardId: action.cardId };
    case 'PLAY_CARD': {
      if (state.phase !== 'choose-point' || state.selectedCardId === null) return state;
      const deck = activeDeck(state);
      const card = deck.hand.find((candidate) => candidate.id === state.selectedCardId);
      if (card === undefined) return state;
      const stone = createStoneFromCard(card, state.turn, `battle-${state.moveNumber + 1}`);
      const play = tryPlay(state.board, action.point, stone, state.koForbiddenKey);
      if (!play.ok) return state;
      const nextDeck = resolveCardUse(deck, card.id, true, action.rng);
      return {
        ...state,
        board: play.board,
        phase: 'resolving',
        decks: { ...state.decks, [state.turn]: nextDeck },
        selectedCardId: null,
        koForbiddenKey: play.koForbiddenKey,
        consecutivePasses: 0,
        ending: false,
        moveNumber: state.moveNumber + 1,
        log: [...state.log, {
          type: 'move',
          actor: state.turn,
          cardId: card.id,
          point: action.point,
          message: '착수했습니다.',
        }],
      };
    }
    case 'RESOLVE_MOVE':
      return state.phase === 'resolving' ? { ...state, phase: 'turn-end' } : state;
    case 'END_TURN':
      return state.phase === 'turn-end' ? endTurn(state) : state;
    case 'PASS':
      return state.phase === 'turn-start' || state.phase === 'pre-move'
        || state.phase === 'choose-card' || state.phase === 'choose-point'
        ? passBattle(state, action.automatic ?? false)
        : state;
    case 'SCORE': {
      if (state.phase !== 'scoring') return state;
      const score = scoreArea(state.board, state.komi);
      return resolveBattleOutcome(state, score.winner === 'B' ? 'B' : 'W', action.rng);
    }
    case 'DECLARE_OUTCOME':
      return resolveBattleOutcome(state, action.winner, action.rng);
    case 'REVIVAL_SPECIAL_MOVE':
      return performRevivalSpecialMove(state, action.rng);
  }
}
