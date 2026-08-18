import { createDeckState, createStoneFromCard, drawExtra, expireTemporaryHandLimits, resolveCardUse } from './deck';
import { groupAt, libertiesAt, neighbors, tryPlay } from './go';
import { hasAdjacentEndangeredGroup } from './content/stones';
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
  readonly type: 'move' | 'pass' | 'charm' | 'relic' | 'revival' | 'result' | 'effect';
  readonly actor: StoneColor;
  readonly automatic?: boolean;
  readonly cardId?: string;
  readonly point?: number;
  readonly sourceId?: string;
  readonly priority?: RevivalPriority;
  readonly message: string;
}

export interface GroupProtection {
  readonly id: string;
  readonly color: StoneColor;
  readonly memberInstanceIds: readonly string[];
  readonly grantedAtMove: number;
}

export interface BattleState {
  readonly act: number;
  readonly board: BoardState;
  readonly turn: StoneColor;
  readonly phase: BattlePhase;
  readonly decks: Readonly<Record<StoneColor, DeckState>>;
  readonly charms: Readonly<Record<StoneColor, readonly string[]>>;
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
  readonly maxHandSize: number;
  readonly previousCaptureBy: Readonly<Record<StoneColor, boolean>>;
  readonly protections: readonly GroupProtection[];
}

export interface CreateBattleInput {
  readonly act: number;
  readonly board: BoardState;
  readonly playerDeck: readonly StoneKind[];
  readonly enemyDeck: readonly StoneKind[];
  readonly enemy: EnemyDefinition;
  readonly komi: number;
  readonly rng: RandomSource;
  readonly maxHandSize: number;
  readonly playerRelics?: readonly string[];
  readonly enemyRelics?: readonly string[];
  readonly playerCharms?: readonly string[];
  readonly enemyCharms?: readonly string[];
  readonly turn?: StoneColor;
  readonly koForbiddenKey?: string | null;
}

export type BattleAction =
  | { readonly type: 'BEGIN_TURN' }
  | { readonly type: 'CONTINUE_TO_MOVE' }
  | { readonly type: 'USE_CHARM'; readonly charmId: string }
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
  if (!Number.isSafeInteger(input.maxHandSize) || input.maxHandSize < 1) throw new RangeError('maxHandSize must be a positive integer');
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
    charms: {
      B: [...(input.playerCharms ?? [])],
      W: [...(input.enemyCharms ?? [])],
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
    maxHandSize: input.maxHandSize,
    previousCaptureBy: { B: false, W: false },
    protections: [],
  };
}

export function captureNegatedBy(
  board: BoardState,
  capturedPoints: readonly number[],
  protections: readonly GroupProtection[],
  mover: StoneColor,
): GroupProtection | null {
  const capturedIds = new Set(capturedPoints.flatMap((point) => {
    const stone = board.points[point];
    return stone === null ? [] : [stone.instanceId];
  }));
  return protections
    .filter((protection) => protection.color !== mover
      && protection.memberInstanceIds.some((id) => capturedIds.has(id)))
    .sort((left, right) => left.grantedAtMove - right.grantedAtMove)[0] ?? null;
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

export function stoneMajorityWinner(board: BoardState): StoneColor | null {
  const threshold = Math.ceil(board.points.length / 2);
  let black = 0;
  let white = 0;
  board.points.forEach((stone) => {
    if (stone?.color === 'B') black += 1;
    if (stone?.color === 'W') white += 1;
  });
  if (black >= threshold) return 'B';
  if (white >= threshold) return 'W';
  return null;
}

function passBattle(state: BattleState, automatic: boolean): BattleState {
  const consecutivePasses = state.consecutivePasses + 1;
  const expiredDeck = expireTemporaryHandLimits(state.decks[state.turn]);
  return {
    ...state,
    decks: { ...state.decks, [state.turn]: expiredDeck },
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
  const expiredDeck = expireTemporaryHandLimits(state.decks[state.turn]);
  return {
    ...state,
    decks: { ...state.decks, [state.turn]: expiredDeck },
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
  if (winner === 'W') return finishBattle(state, 'run-loss');
  if (state.act === 1 && state.revivalStage === 1 && state.enemy.revival !== undefined) {
    return startRevival(state);
  }
  return finishBattle(state, 'stage-win');
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
  const decksAfterEnemyTurn = {
    ...state.decks,
    W: expireTemporaryHandLimits(state.decks.W),
  };
  const candidate = chooseRevivalCandidate(state, rng);
  if (candidate === null) {
    return {
      ...state,
      decks: decksAfterEnemyTurn,
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

  const negatedBy = captureNegatedBy(state.board, candidate.play.captured, state.protections, 'W');
  if (negatedBy !== null) {
    return {
      ...state,
      decks: decksAfterEnemyTurn,
      turn: 'B',
      phase: 'turn-start',
      consecutivePasses: 0,
      moveNumber: state.moveNumber + 1,
      previousCaptureBy: { ...state.previousCaptureBy, W: false },
      protections: state.protections.filter(({ id }) => id !== negatedBy.id),
      log: [...state.log, {
        type: 'effect',
        actor: 'W',
        point: candidate.point,
        sourceId: negatedBy.id,
        message: '수호 효과가 포획을 무효화했습니다.',
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
  const baseProtections = state.protections.filter(({ color }) => color === 'W');
  const grantsProtection = candidate.definition.stoneKind === 'STONE-005'
    && hasAdjacentEndangeredGroup(state.board, candidate.point, 'W');
  const group = grantsProtection ? groupAt(candidate.play.board, candidate.point) : [];
  const revivalProtection: GroupProtection | null = grantsProtection ? {
    id: `protection-${state.moveNumber + 1}`,
    color: 'W',
    memberInstanceIds: group.flatMap((point) => {
      const member = candidate.play.board.points[point];
      return member === null ? [] : [member.instanceId];
    }),
    grantedAtMove: state.moveNumber + 1,
  } : null;
  const placed: BattleState = {
    ...state,
    board: candidate.play.board,
    decks: decksAfterEnemyTurn,
    turn: 'B',
    phase: 'turn-start',
    koForbiddenKey: candidate.play.koForbiddenKey,
    moveNumber: state.moveNumber + 1,
    previousCaptureBy: { ...state.previousCaptureBy, W: candidate.play.capturedCount > 0 },
    protections: revivalProtection === null ? baseProtections : [...baseProtections, revivalProtection],
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
  const majority = stoneMajorityWinner(placed.board);
  if (majority === null) return placed;
  return resolveBattleOutcome({
    ...placed,
    log: [...placed.log, {
      type: 'result',
      actor: majority,
      message: `${majority === 'B' ? '흑' : '백'}이 돌 점유 과반에 도달했습니다.`,
    }],
  }, majority, rng);
}

export function battleReducer(state: BattleState, action: BattleAction): BattleState {
  switch (action.type) {
    case 'BEGIN_TURN':
      if (state.phase !== 'turn-start') return state;
      if (!hasLegalCardMove(state)) return passBattle(state, true);
      return {
        ...state,
        phase: state.charms[state.turn].length === 0 && state.relics[state.turn].length === 0
          ? 'choose-card'
          : 'pre-move',
      };
    case 'CONTINUE_TO_MOVE':
      if (state.phase !== 'pre-move') return state;
      if (!hasLegalCardMove(state)) return passBattle(state, true);
      return { ...state, phase: 'choose-card' };
    case 'USE_CHARM':
      if (state.phase !== 'pre-move' || !state.charms[state.turn].includes(action.charmId)) return state;
      {
        const charms = [...state.charms[state.turn]];
        charms.splice(charms.indexOf(action.charmId), 1);
      return {
        ...state,
        charms: {
          ...state.charms,
          [state.turn]: charms,
        },
        log: [...state.log, {
          type: 'charm',
          actor: state.turn,
          sourceId: action.charmId,
          message: '부적을 사용했습니다.',
        }],
      };
      }
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
          message: '유물을 사용했습니다.',
        }],
      };
    case 'SELECT_CARD':
      if ((state.phase !== 'choose-card' && state.phase !== 'pre-move')
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
      const negatedBy = captureNegatedBy(state.board, play.captured, state.protections, state.turn);
      if (negatedBy !== null) {
        return {
          ...state,
          phase: 'resolving',
          decks: { ...state.decks, [state.turn]: resolveCardUse(deck, card.id, true, action.rng) },
          selectedCardId: null,
          consecutivePasses: 0,
          ending: false,
          moveNumber: state.moveNumber + 1,
          previousCaptureBy: { ...state.previousCaptureBy, [state.turn]: false },
          protections: state.protections.filter(({ id }) => id !== negatedBy.id),
          log: [...state.log, {
            type: 'effect',
            actor: state.turn,
            cardId: card.id,
            point: action.point,
            sourceId: negatedBy.id,
            message: '수호 효과가 포획을 무효화했습니다.',
          }],
        };
      }
      let nextDeck = resolveCardUse(deck, card.id, true, action.rng);
      const generalDrawn = card.kind === 'STONE-003' && play.capturedCount > 0;
      if (generalDrawn) nextDeck = drawExtra(nextDeck, state.maxHandSize, action.rng);
      const protections = state.protections.filter(({ color }) => color === state.turn);
      const grantsProtection = card.kind === 'STONE-005'
        && hasAdjacentEndangeredGroup(state.board, action.point, state.turn);
      const mergedGroup = grantsProtection ? groupAt(play.board, action.point) : [];
      const grantedProtection: GroupProtection | null = grantsProtection ? {
        id: `protection-${state.moveNumber + 1}`,
        color: state.turn,
        memberInstanceIds: mergedGroup.flatMap((point) => {
          const member = play.board.points[point];
          return member === null ? [] : [member.instanceId];
        }),
        grantedAtMove: state.moveNumber + 1,
      } : null;
      const placed: BattleState = {
        ...state,
        board: play.board,
        phase: 'resolving',
        decks: { ...state.decks, [state.turn]: nextDeck },
        selectedCardId: null,
        koForbiddenKey: play.koForbiddenKey,
        consecutivePasses: 0,
        ending: false,
        moveNumber: state.moveNumber + 1,
        previousCaptureBy: { ...state.previousCaptureBy, [state.turn]: play.capturedCount > 0 },
        protections: grantedProtection === null ? protections : [...protections, grantedProtection],
        log: [...state.log, {
          type: 'move',
          actor: state.turn,
          cardId: card.id,
          point: action.point,
          message: '착수했습니다.',
        }, ...(generalDrawn ? [{
          type: 'effect' as const,
          actor: state.turn,
          cardId: card.id,
          message: '장군석 효과로 카드 1장을 추가로 뽑았습니다.',
        }] : []), ...(grantedProtection === null ? [] : [{
          type: 'effect' as const,
          actor: state.turn,
          cardId: card.id,
          point: action.point,
          sourceId: grantedProtection.id,
          message: '수호석이 그룹에 수호를 부여했습니다.',
        }])],
      };
      const majority = stoneMajorityWinner(placed.board);
      if (majority === null) return placed;
      return resolveBattleOutcome({
        ...placed,
        log: [...placed.log, {
          type: 'result',
          actor: majority,
          message: `${majority === 'B' ? '흑' : '백'}이 돌 점유 과반에 도달했습니다.`,
        }],
      }, majority, action.rng);
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
