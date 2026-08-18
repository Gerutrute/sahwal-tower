import {
  createContext,
  useContext,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react';
import {
  battleReducer,
  captureNegatedBy,
  createBattleState,
  performRevivalSpecialMove,
  type BattleState,
  type EnemyDefinition,
} from './battle';
import { chooseBattleAiMove } from './ai';
import { addTemporaryHandLimit, createStoneFromCard, type StoneCard } from './deck';
import {
  createDojoVisit,
  generateShop,
  purchaseShopOffer,
  removeShopCard,
  useDojo,
  type DojoAction,
  type DojoVisitState,
  type EconomyConfig,
  type InventoryState,
  type ShopCatalog,
  type ShopState,
} from './economy';
import { resolveMove, type EffectDefinition, type EffectLimits, type EffectLog } from './effects';
import { createBoard, tryPlay, type IllegalMoveCode } from './go';
import { generateActMap, selectableNodeIds, type ActMap, type MapNode, type MapWeights } from './map';
import {
  decisiveMoveCandidates,
  generateRewardCandidates,
  type MoveImpactRecord,
  type RewardCatalog,
} from './rewards';
import { createSeededRng, type Seed } from './rng';
import { createRunState, runReducer, type BattleNodeKind, type BattleResolution, type RunState } from './run';
import { scoreArea, type AreaScore } from './scoring';
import {
  createStoneEffectDefinition,
  candidatePlacementTriggersEffect,
  resolveCavalryExchange,
  resolveGeneralCaptureEffect,
  resolveSacrificeEffects,
  resolveScoutExchange,
  startScoutInspection,
  startCavalryInspection,
  hasAdjacentEndangeredGroup,
  STARTING_DECK,
} from './content/stones';
import type { CharmId } from './content/charms';
import type { BoardState, StoneColor, StoneKind } from './types';
import type { AudioTuning } from '../audio/AudioManager';

export type GameScreen = 'title' | 'map' | 'battle' | 'reward' | 'shop' | 'event' | 'dojo' | 'result';

export interface GameConfig {
  readonly seed: Seed;
  readonly komiBySize: Readonly<Record<7 | 9, number>>;
  readonly economy: EconomyConfig;
  readonly mapWeights: MapWeights;
  readonly effectLimits: EffectLimits;
  readonly generalCaptureMoneyCap: number;
  readonly enemyDeck: readonly StoneKind[];
  readonly bossByAct: Readonly<Record<1 | 2, EnemyDefinition>>;
  readonly rewards: RewardCatalog;
  readonly shop: ShopCatalog;
  readonly eventCurrencyReward: number;
  readonly aiCaptureWeight: number;
  readonly aiEffectWeights: Readonly<Record<StoneKind, number>>;
  readonly aiPassScoreThreshold: number;
  readonly analysisCaptureWeight: number;
  readonly analysisEffectWeight: number;
  readonly audioTuning: AudioTuning;
}

export interface ResultAnalysis {
  readonly score: AreaScore;
  readonly captures: Readonly<Record<StoneColor, number>>;
  readonly criticalMoves: readonly MoveImpactRecord[];
  readonly effects: readonly string[];
}

export type PendingInteraction =
  | {
      readonly kind: 'scout';
      readonly sourceId: string;
      readonly inspected: readonly StoneCard[];
      readonly takenCardId: string | null;
      readonly returnedCardId: string | null;
      readonly orderedIds: readonly string[];
      readonly endsTurnOnResolve: boolean;
    }
  | {
      readonly kind: 'cavalry';
      readonly sourceId: string;
      readonly inspected: readonly StoneCard[];
      readonly takenCardId: string | null;
      readonly discardedCardId: string | null;
      readonly endsTurnOnResolve: boolean;
    };

export interface GameState {
  readonly screen: GameScreen;
  readonly run: RunState;
  readonly map: ActMap;
  readonly battle: BattleState | null;
  readonly battleKind: BattleNodeKind;
  readonly selectedNodeId: string | null;
  readonly completedNodeIds: readonly string[];
  readonly pendingInspection: PendingInteraction | null;
  readonly queuedInspections: readonly PendingInteraction[];
  readonly invalidPoint: number | null;
  readonly invalidReason: string;
  readonly captures: Readonly<Record<StoneColor, number>>;
  readonly moveImpacts: readonly MoveImpactRecord[];
  readonly result: ResultAnalysis | null;
  readonly shop: ShopState | null;
  readonly dojo: DojoVisitState | null;
  readonly eventResolved: boolean;
  readonly notice: string;
  readonly effectLog: readonly EffectLog[];
  readonly generalMoneyAwarded: number;
  readonly sequence: number;
}

export type GameAction =
  | { readonly type: 'START_RUN' }
  | { readonly type: 'OPEN_NODE'; readonly node: MapNode }
  | { readonly type: 'OPEN_BATTLE'; readonly battle: BattleNodeKind; readonly nodeId?: string }
  | { readonly type: 'SELECT_CARD'; readonly cardId: string }
  | { readonly type: 'CHOOSE_POINT'; readonly point: number }
  | { readonly type: 'AI_TURN' }
  | { readonly type: 'PASS' }
  | { readonly type: 'RESIGN' }
  | { readonly type: 'CONTINUE_TO_MOVE' }
  | { readonly type: 'USE_CHARM'; readonly charmId: CharmId }
  | { readonly type: 'USE_RELIC'; readonly relicId: string }
  | { readonly type: 'INSPECT_TAKE'; readonly cardId: string }
  | { readonly type: 'INSPECT_RETURN'; readonly cardId: string }
  | { readonly type: 'REORDER_INSPECTION'; readonly orderedIds: readonly string[] }
  | { readonly type: 'CONFIRM_INSPECTION' }
  | { readonly type: 'CANCEL_INSPECTION' }
  | { readonly type: 'CHOOSE_REWARD'; readonly candidateId: string }
  | { readonly type: 'REPLACE_CHARM'; readonly index: number }
  | { readonly type: 'DECLINE_REWARD' }
  | { readonly type: 'OPEN_SHOP' }
  | { readonly type: 'BUY_OFFER'; readonly offerId: string; readonly replaceCharmIndex?: number }
  | { readonly type: 'REMOVE_SHOP_CARD'; readonly cardIndex: number }
  | { readonly type: 'OPEN_EVENT' }
  | { readonly type: 'CHOOSE_EVENT'; readonly choice: 'currency' | 'scout' | 'leave' }
  | { readonly type: 'OPEN_DOJO' }
  | { readonly type: 'USE_DOJO'; readonly action: DojoAction }
  | { readonly type: 'RETURN_TO_MAP' }
  | { readonly type: 'RESTART' }
  | { readonly type: 'RESOLVE_BATTLE_FOR_ENGINE'; readonly battle: BattleNodeKind; readonly resolution: BattleResolution; readonly capturedStones: number };

function assertConfig(config: GameConfig): void {
  const numeric = [
    config.komiBySize[7],
    config.komiBySize[9],
    config.eventCurrencyReward,
    config.aiCaptureWeight,
    ...Object.values(config.aiEffectWeights),
    config.aiPassScoreThreshold,
    config.analysisCaptureWeight,
    config.analysisEffectWeight,
    config.generalCaptureMoneyCap,
    config.audioTuning.crossfadeSeconds,
    config.audioTuning.overlapSeconds,
    config.audioTuning.masterGain,
    ...Object.values(config.audioTuning.trackGains),
  ];
  if (numeric.some((value) => !Number.isFinite(value))) {
    throw new RangeError('GameConfig numeric values must be finite');
  }
  const stoneKinds: readonly StoneKind[] = ['STONE-001', 'STONE-002', 'STONE-003', 'STONE-004', 'STONE-005', 'STONE-006'];
  if (Object.keys(config.aiEffectWeights).length !== stoneKinds.length
    || stoneKinds.some((kind) => !Object.hasOwn(config.aiEffectWeights, kind))) {
    throw new RangeError('GameConfig aiEffectWeights must provide all six stone kinds');
  }
  if (config.enemyDeck.length === 0) throw new RangeError('GameConfig enemyDeck is required');
}

function rngFor(config: GameConfig, sequence: number, purpose: string) {
  return createSeededRng(`${String(config.seed)}:${sequence}:${purpose}`);
}

function asInventory(run: RunState): InventoryState {
  return {
    currency: run.currency,
    deck: run.deck,
    charms: run.charms,
    relics: run.relics,
    removalCount: run.removalCount,
  };
}

function applyInventory(run: RunState, inventory: InventoryState, config: GameConfig): RunState {
  return runReducer(run, { type: 'APPLY_INVENTORY', inventory }, config.economy);
}

function illegalReason(code: IllegalMoveCode): string {
  if (code === 'occupied') return '이미 돌이 놓인 자리입니다.';
  if (code === 'suicide') return '자충수라 둘 수 없습니다.';
  return '단순패 규칙으로 바로 되따낼 수 없습니다.';
}

export function buildResultAnalysis(
  board: BoardState,
  komi: number,
  records: readonly MoveImpactRecord[],
  seed: Seed,
  captures: Readonly<Record<StoneColor, number>>,
  effects: readonly string[] = [],
): ResultAnalysis {
  return {
    score: scoreArea(board, komi),
    captures,
    criticalMoves: decisiveMoveCandidates(records, seed),
    effects,
  };
}

export function createInitialGameState(config: GameConfig): GameState {
  assertConfig(config);
  const run = createRunState({ deck: STARTING_DECK, economy: config.economy });
  return {
    screen: 'title',
    run,
    map: generateActMap(1, config.mapWeights, rngFor(config, 0, 'map')),
    battle: null,
    battleKind: 'normal',
    selectedNodeId: null,
    completedNodeIds: [],
    pendingInspection: null,
    queuedInspections: [],
    invalidPoint: null,
    invalidReason: '',
    captures: { B: 0, W: 0 },
    moveImpacts: [],
    result: null,
    shop: null,
    dojo: null,
    eventResolved: false,
    notice: '',
    effectLog: [],
    generalMoneyAwarded: 0,
    sequence: 1,
  };
}

function readyBattle(battle: BattleState): BattleState {
  const begun = battleReducer(battle, { type: 'BEGIN_TURN' });
  return begun.phase === 'pre-move' && begun.turn === 'W'
    ? battleReducer(begun, { type: 'CONTINUE_TO_MOVE' })
    : begun;
}

function openBattle(state: GameState, kind: BattleNodeKind, config: GameConfig, nodeId?: string): GameState {
  const enemy = kind === 'boss' ? config.bossByAct[state.run.act] : { id: `RUN-${kind.toUpperCase()}` };
  const battle = readyBattle(createBattleState({
    act: state.run.act,
    board: createBoard(state.run.boardSize),
    playerDeck: state.run.deck,
    enemyDeck: config.enemyDeck,
    enemy,
    komi: config.komiBySize[state.run.boardSize],
    rng: rngFor(config, state.sequence, 'battle'),
    maxHandSize: config.effectLimits.maxHandSize,
    playerRelics: state.run.relics,
    playerCharms: state.run.charms,
  }));
  return {
    ...state,
    screen: 'battle',
    battle,
    battleKind: kind,
    selectedNodeId: nodeId ?? null,
    pendingInspection: null,
    queuedInspections: [],
    invalidPoint: null,
    invalidReason: '',
    captures: { B: 0, W: 0 },
    moveImpacts: [],
    result: null,
    notice: '',
    effectLog: [],
    generalMoneyAwarded: 0,
    sequence: state.sequence + 1,
  };
}

function completeRunBattle(
  state: GameState,
  battleKind: BattleNodeKind,
  resolution: BattleResolution,
  capturedStones: number,
  config: GameConfig,
): GameState {
  const completedNodeIds = resolution === 'win'
    && state.selectedNodeId !== null
    && !state.completedNodeIds.includes(state.selectedNodeId)
    ? [...state.completedNodeIds, state.selectedNodeId]
    : state.completedNodeIds;
  let run = runReducer(state.run, {
    type: 'BATTLE_RESOLVED',
    battle: battleKind,
    resolution,
    capturedStones,
  }, config.economy);
  if (run.status !== 'active') {
    return { ...state, run, completedNodeIds, screen: 'result', battle: null, pendingInspection: null, queuedInspections: [] };
  }
  if (battleKind === 'boss') {
    const map = generateActMap(run.act, config.mapWeights, rngFor(config, state.sequence, 'next-map'));
    return {
      ...state,
      run,
      map,
      screen: 'map',
      battle: null,
      pendingInspection: null,
      queuedInspections: [],
      selectedNodeId: null,
      completedNodeIds: [],
      notice: `${run.act}막 지도가 열렸습니다.`,
      sequence: state.sequence + 1,
    };
  }
  const candidates = generateRewardCandidates(config.rewards, battleKind === 'elite' ? '공격' : '안정', rngFor(config, state.sequence, 'reward'));
  run = runReducer(run, { type: 'OFFER_REWARDS', candidates }, config.economy);
  return {
    ...state,
    run,
    completedNodeIds,
    screen: 'reward',
    battle: null,
    pendingInspection: null,
    queuedInspections: [],
    sequence: state.sequence + 1,
  };
}

function settleEngineBattle(state: GameState, battle: BattleState, config: GameConfig): GameState {
  if (battle.phase !== 'result' || battle.outcome === null) return { ...state, battle };
  const result = buildResultAnalysis(
    battle.board,
    battle.komi,
    state.moveImpacts,
    `${String(config.seed)}:analysis:${state.sequence}`,
    state.captures,
    battle.log.map(({ message }) => message),
  );
  const withResult = { ...state, battle, result };
  return completeRunBattle(
    withResult,
    state.battleKind,
    battle.outcome === 'stage-win' ? 'win' : 'loss',
    state.captures.B,
    config,
  );
}

function scoreIfReady(state: GameState, battle: BattleState, config: GameConfig): GameState {
  if (battle.phase !== 'scoring') return { ...state, battle };
  const scored = battleReducer(battle, { type: 'SCORE', rng: rngFor(config, state.sequence, 'score') });
  if (scored.phase === 'revival-special-move') {
    return { ...state, battle: scored, sequence: state.sequence + 1 };
  }
  return settleEngineBattle({ ...state, sequence: state.sequence + 1 }, scored, config);
}

interface ProductEffectState {
  readonly battle: BattleState;
  readonly run: RunState;
  readonly log: readonly EffectLog[];
}

function moveEffectDefinitions(
  battle: BattleState,
  card: StoneCard,
  point: number,
  capturedKinds: readonly { readonly instanceId: string; readonly kind: StoneKind }[],
  projectedDeck: BattleState['decks']['B'],
): readonly EffectDefinition[] {
  const definitions: EffectDefinition[] = [];
  const active = createStoneEffectDefinition(card.kind, {
    sideRelation: 'active',
    acquisitionOrder: battle.moveNumber,
    sourceId: card.id,
  });
  const guardianTriggered = card.kind === 'STONE-005'
    && hasAdjacentEndangeredGroup(battle.board, point, 'B');
  if (active !== null && (
    card.kind === 'STONE-002'
    || (card.kind === 'STONE-003' && capturedKinds.length > 0)
    || guardianTriggered
  )) definitions.push(active);

  const handIdsBefore = new Set(battle.decks.B.hand.map(({ id }) => id));
  const cavalry = projectedDeck.hand.find(({ id, kind }) => !handIdsBefore.has(id) && kind === 'STONE-004');
  if (cavalry !== undefined && capturedKinds.length > 0) {
    const cavalryDefinition = createStoneEffectDefinition(cavalry.kind, {
      sideRelation: 'active',
      acquisitionOrder: battle.moveNumber,
      sourceId: cavalry.id,
    });
    if (cavalryDefinition !== null) definitions.push(cavalryDefinition);
  }
  capturedKinds.filter(({ kind }) => kind === 'STONE-006').forEach((captured) => {
    const sacrifice = createStoneEffectDefinition(captured.kind, {
      sideRelation: 'opponent',
      acquisitionOrder: battle.moveNumber,
      sourceId: captured.instanceId,
    });
    if (sacrifice !== null) definitions.push(sacrifice);
  });
  return definitions;
}

function inspectionsAfterMove(
  battleBefore: BattleState,
  battleAfter: BattleState,
  card: StoneCard,
  point: number,
): readonly PendingInteraction[] {
  const deck = battleAfter.decks.B;
  const interactions: PendingInteraction[] = [];
  if (card.kind === 'STONE-002') {
    const inspected = startScoutInspection(deck);
    if (inspected.length > 0) interactions.push({
      kind: 'scout',
      sourceId: card.id,
      inspected,
      takenCardId: null,
      returnedCardId: null,
      orderedIds: inspected.map(({ id }) => id),
      endsTurnOnResolve: true,
    });
  }

  const handIdsBefore = new Set(battleBefore.decks.B.hand.map(({ id }) => id));
  const cavalryCards = deck.hand.filter(({ id, kind }) => !handIdsBefore.has(id) && kind === 'STONE-004');
  cavalryCards.forEach((cavalry) => {
    const inspected = startCavalryInspection(deck, battleAfter.previousCaptureBy.B);
    if (inspected.length > 0) {
      interactions.push({
        kind: 'cavalry',
        sourceId: cavalry.id,
        inspected,
        takenCardId: null,
        discardedCardId: null,
        endsTurnOnResolve: true,
      });
    }
  });
  return interactions;
}

function commitMove(state: GameState, point: number, config: GameConfig): GameState {
  const battle = state.battle;
  if (battle === null || battle.turn !== 'B' || battle.phase !== 'choose-point' || battle.selectedCardId === null) {
    return { ...state, invalidPoint: point, invalidReason: '놓을 카드를 먼저 선택하세요.' };
  }
  const card = battle.decks.B.hand.find(({ id }) => id === battle.selectedCardId);
  if (card === undefined) return state;
  const stone = createStoneFromCard(card, 'B', `ui-move-${battle.moveNumber + 1}`);
  const play = tryPlay(battle.board, point, stone, battle.koForbiddenKey);
  if (!play.ok) return { ...state, invalidPoint: point, invalidReason: illegalReason(play.code) };
  const captureNegated = captureNegatedBy(battle.board, play.captured, battle.protections, 'B') !== null;
  const effectiveCapturedCount = captureNegated ? 0 : play.capturedCount;
  const moveRng = rngFor(config, state.sequence, 'player-move');
  const projectedDeck = battleReducer(battle, { type: 'PLAY_CARD', point, rng: moveRng }).decks.B;
  const capturedStones = (captureNegated ? [] : play.captured).flatMap((capturedPoint) => {
    const captured = battle.board.points[capturedPoint];
    return captured === null ? [] : [captured];
  });
  const sacrificeModifiers = resolveSacrificeEffects(capturedStones, 'opponent-placement');
  if (battle.decks.W.handLimit + sacrificeModifiers.length > config.effectLimits.maxHandSize) {
    return { ...state, invalidPoint: point, invalidReason: '효과 처리 안전 한도를 초과하여 착수를 취소했습니다.' };
  }
  const effects = captureNegated ? [] : moveEffectDefinitions(battle, card, point, capturedStones, projectedDeck);
  const effectState: ProductEffectState = { battle, run: state.run, log: state.effectLog };
  const dryRun = resolveMove(effectState, effects, config.effectLimits, { dryRun: true });
  if (!dryRun.ok) {
    return { ...state, invalidPoint: point, invalidReason: dryRun.log[0]?.message ?? '효과를 해결할 수 없습니다.' };
  }
  const committedEffects = resolveMove(effectState, effects, config.effectLimits, { dryRun: false });
  if (!committedEffects.ok) return state;
  let nextBattle = battleReducer(battle, { type: 'PLAY_CARD', point, rng: moveRng });
  sacrificeModifiers.forEach((modifier, index) => {
    nextBattle = {
      ...nextBattle,
      decks: {
        ...nextBattle.decks,
        W: addTemporaryHandLimit(nextBattle.decks.W, modifier, rngFor(config, state.sequence, `sacrifice-${index}`)),
      },
    };
  });
  let pendingInspection: PendingInteraction | null = null;
  let queuedInspections: readonly PendingInteraction[] = [];
  if (nextBattle.phase === 'resolving') {
    nextBattle = battleReducer(nextBattle, { type: 'RESOLVE_MOVE' });
    const inspections = captureNegated ? [] : inspectionsAfterMove(battle, nextBattle, card, point);
    [pendingInspection = null, ...queuedInspections] = inspections;
    if (pendingInspection === null) nextBattle = battleReducer(nextBattle, { type: 'END_TURN' });
  }

  let nextRun = state.run;
  let generalMoneyAwarded = state.generalMoneyAwarded;
  if (card.kind === 'STONE-003' && effectiveCapturedCount > 0) {
    const general = resolveGeneralCaptureEffect({
      money: state.run.currency,
      generalMoneyAwarded,
      generalMoneyCap: config.generalCaptureMoneyCap,
      sourceId: card.id,
      capturedCount: effectiveCapturedCount,
      triggeredSources: [],
    });
    if (general.awarded > 0) {
      nextRun = runReducer(nextRun, { type: 'GAIN_CURRENCY', amount: general.awarded }, config.economy);
      generalMoneyAwarded = general.generalMoneyAwarded;
    }
  }
  const advanced = {
    ...state,
    run: nextRun,
    battle: nextBattle,
    pendingInspection,
    queuedInspections,
    invalidPoint: null,
    invalidReason: '',
    captures: { ...state.captures, B: state.captures.B + effectiveCapturedCount },
    moveImpacts: [...state.moveImpacts, {
      id: `${battle.moveNumber + 1}수 · ${Math.floor(point / battle.board.size) + 1}행 ${point % battle.board.size + 1}열`,
      impact: effectiveCapturedCount * config.analysisCaptureWeight
        + committedEffects.log.length * config.analysisEffectWeight,
      turn: battle.moveNumber + 1,
    }],
    effectLog: committedEffects.state.log,
    generalMoneyAwarded,
    sequence: state.sequence + 1,
  };
  return nextBattle.phase === 'result' ? settleEngineBattle(advanced, nextBattle, config) : advanced;
}

function performAiTurn(state: GameState, config: GameConfig): GameState {
  const current = state.battle;
  if (current === null || current.turn !== 'W') return state;
  if (current.phase === 'revival-special-move') {
    const moved = performRevivalSpecialMove(current, rngFor(config, state.sequence, 'revival'));
    const advanced = {
      ...state,
      battle: moved.phase === 'result' ? moved : readyBattle(moved),
      sequence: state.sequence + 1,
    };
    return moved.phase === 'result' ? settleEngineBattle(advanced, moved, config) : advanced;
  }
  let battle = readyBattle(current);
  if (battle.phase === 'scoring') return scoreIfReady(state, battle, config);
  if (battle.phase !== 'choose-card') return { ...state, battle };
  const choice = chooseBattleAiMove({
    board: battle.board,
    color: 'W',
    hand: battle.decks.W.hand,
    koForbiddenKey: battle.koForbiddenKey,
  }, (candidate) => {
    const effectiveCaptures = captureNegatedBy(
      battle.board,
      candidate.captured,
      battle.protections,
      'W',
    ) === null ? candidate.captured.length : 0;
    return effectiveCaptures * config.aiCaptureWeight
    + (candidatePlacementTriggersEffect(
      battle.board,
      candidate.point,
      'W',
      candidate.card.kind,
      effectiveCaptures,
    ) ? config.aiEffectWeights[candidate.card.kind] : 0);
  }, rngFor(config, state.sequence, 'ai-choice'));
  if (choice.move === null || choice.move.score < config.aiPassScoreThreshold) {
    battle = battleReducer(battle, { type: 'PASS' });
    const scored = scoreIfReady({ ...state, sequence: state.sequence + 1 }, battle, config);
    const advanced = scored.battle?.phase === 'revival-special-move'
      ? performAiTurn(scored, config)
      : scored;
    return advanced.battle?.turn === 'B' && advanced.battle.phase === 'turn-start'
      ? { ...advanced, battle: readyBattle(advanced.battle) }
      : advanced;
  }
  battle = battleReducer(battle, { type: 'SELECT_CARD', cardId: choice.move.card.id });
  const aiPlay = tryPlay(
    battle.board,
    choice.move.point,
    createStoneFromCard(choice.move.card, 'W', `ai-move-${battle.moveNumber + 1}`),
    battle.koForbiddenKey,
  );
  if (!aiPlay.ok) return { ...state, battle };
  const aiCaptureNegated = captureNegatedBy(battle.board, aiPlay.captured, battle.protections, 'W') !== null;
  const effectiveAiCaptured = aiCaptureNegated ? 0 : aiPlay.captured.length;
  const capturedStones = (aiCaptureNegated ? [] : aiPlay.captured).flatMap((capturedPoint) => {
    const captured = battle.board.points[capturedPoint];
    return captured === null ? [] : [captured];
  });
  const sacrificeModifiers = resolveSacrificeEffects(capturedStones, 'opponent-placement');
  if (battle.decks.B.handLimit + sacrificeModifiers.length > config.effectLimits.maxHandSize) {
    battle = battleReducer(battle, { type: 'PASS', automatic: true });
    return scoreIfReady({ ...state, battle, sequence: state.sequence + 1 }, battle, config);
  }
  const sacrificeEffects = capturedStones
    .filter(({ kind }) => kind === 'STONE-006')
    .flatMap((captured) => {
      const definition = createStoneEffectDefinition(captured.kind, {
        sideRelation: 'opponent',
        acquisitionOrder: battle.moveNumber,
        sourceId: captured.instanceId,
      });
      return definition === null ? [] : [definition];
    });
  const resolvedEffects = resolveMove<ProductEffectState>(
    { battle, run: state.run, log: state.effectLog },
    sacrificeEffects,
    config.effectLimits,
    { dryRun: false },
  );
  if (!resolvedEffects.ok) {
    battle = battleReducer(battle, { type: 'PASS', automatic: true });
    return scoreIfReady({ ...state, battle, sequence: state.sequence + 1 }, battle, config);
  }
  battle = battleReducer(battle, { type: 'PLAY_CARD', point: choice.move.point, rng: rngFor(config, state.sequence, 'ai-move') });
  const playerHandIdsBeforeSacrifice = new Set(battle.decks.B.hand.map(({ id }) => id));
  sacrificeModifiers.forEach((modifier, index) => {
    battle = {
      ...battle,
      decks: {
        ...battle.decks,
        B: addTemporaryHandLimit(battle.decks.B, modifier, rngFor(config, state.sequence, `ai-sacrifice-${index}`)),
      },
    };
  });
  const placed = battle.board.points[choice.move.point];
  if (battle.phase === 'resolving') {
    battle = battleReducer(battleReducer(battle, { type: 'RESOLVE_MOVE' }), { type: 'END_TURN' });
    battle = readyBattle(battle);
  }
  const cavalryInspections = battle.decks.B.hand
    .filter(({ id, kind }) => !playerHandIdsBeforeSacrifice.has(id) && kind === 'STONE-004')
    .flatMap((cavalry): readonly PendingInteraction[] => {
      const inspected = startCavalryInspection(battle.decks.B, battle.previousCaptureBy.B);
      return inspected.length === 0 ? [] : [{
        kind: 'cavalry',
        sourceId: cavalry.id,
        inspected,
        takenCardId: null,
        discardedCardId: null,
        endsTurnOnResolve: false,
      }];
    });
  const [pendingInspection = null, ...queuedInspections] = cavalryInspections;
  const advanced = {
    ...state,
    battle,
    pendingInspection,
    queuedInspections,
    captures: { ...state.captures, W: state.captures.W + effectiveAiCaptured },
    moveImpacts: [...state.moveImpacts, {
      id: `${current.moveNumber + 1}수 · 상대 ${Math.floor(choice.move.point / current.board.size) + 1}행 ${choice.move.point % current.board.size + 1}열`,
      impact: -effectiveAiCaptured,
      turn: current.moveNumber + 1,
    }],
    notice: placed === null ? state.notice : '',
    effectLog: resolvedEffects.state.log,
    sequence: state.sequence + 1,
  };
  return battle.phase === 'result' ? settleEngineBattle(advanced, battle, config) : advanced;
}

function openNode(state: GameState, node: MapNode, config: GameConfig): GameState {
  if (!selectableNodeIds(state.map, state.completedNodeIds).includes(node.id)) {
    return { ...state, notice: '아직 이어지지 않은 길입니다.' };
  }
  if (node.type === 'battle' || node.type === 'elite' || node.type === 'boss') {
    return openBattle(state, node.type === 'battle' ? 'normal' : node.type, config, node.id);
  }
  const completed = {
    ...state,
    completedNodeIds: [...state.completedNodeIds, node.id],
  };
  if (node.type === 'shop') return gameReducer(completed, { type: 'OPEN_SHOP' }, config);
  if (node.type === 'event') return gameReducer(completed, { type: 'OPEN_EVENT' }, config);
  if (node.type === 'dojo') return gameReducer(completed, { type: 'OPEN_DOJO' }, config);
  return { ...completed, screen: 'map', notice: '사당은 이번 MVP에서 안전한 휴식 노드로 처리됩니다.' };
}

function refreshInspection(
  inspection: PendingInteraction,
  battle: BattleState,
): PendingInteraction | null {
  if (inspection.kind === 'scout') {
    const inspected = startScoutInspection(battle.decks.B);
    return inspected.length === 0 ? null : {
      kind: 'scout',
      sourceId: inspection.sourceId,
      inspected,
      takenCardId: null,
      returnedCardId: null,
      orderedIds: inspected.map(({ id }) => id),
      endsTurnOnResolve: inspection.endsTurnOnResolve,
    };
  }
  const inspected = startCavalryInspection(battle.decks.B, battle.previousCaptureBy.B);
  return inspected.length === 0 ? null : {
    kind: 'cavalry',
    sourceId: inspection.sourceId,
    inspected,
    takenCardId: null,
    discardedCardId: null,
    endsTurnOnResolve: inspection.endsTurnOnResolve,
  };
}

function promoteQueuedInspection(
  queuedInspections: readonly PendingInteraction[],
  battle: BattleState,
  endsTurnOnExhaustion: boolean,
): {
  readonly pendingInspection: PendingInteraction | null;
  readonly queuedInspections: readonly PendingInteraction[];
  readonly endsTurnOnExhaustion: boolean;
} {
  let shouldEndTurn = endsTurnOnExhaustion;
  for (let index = 0; index < queuedInspections.length; index += 1) {
    const queued = queuedInspections[index];
    shouldEndTurn ||= queued.endsTurnOnResolve;
    const refreshed = refreshInspection(queued, battle);
    if (refreshed !== null) {
      return {
        pendingInspection: { ...refreshed, endsTurnOnResolve: shouldEndTurn },
        queuedInspections: queuedInspections.slice(index + 1),
        endsTurnOnExhaustion: shouldEndTurn,
      };
    }
  }
  return { pendingInspection: null, queuedInspections: [], endsTurnOnExhaustion: shouldEndTurn };
}

function finishInspection(state: GameState, confirm: boolean): GameState {
  const inspection = state.pendingInspection;
  const battle = state.battle;
  if (inspection === null || battle === null) return state;
  let nextBattle = battle;
  if (confirm && inspection.kind === 'scout') {
    if (inspection.takenCardId === null || inspection.returnedCardId === null) {
      return { ...state, invalidReason: '가져올 카드와 되돌릴 카드를 먼저 고르세요.' };
    }
    try {
      const deck = resolveScoutExchange(
        battle.decks.B,
        inspection.inspected.map(({ id }) => id),
        {
          takenCardId: inspection.takenCardId,
          returnedCardId: inspection.returnedCardId,
          orderedIds: inspection.orderedIds,
        },
      );
      nextBattle = { ...battle, decks: { ...battle.decks, B: deck } };
    } catch {
      return { ...state, invalidReason: '확인한 카드 순서가 현재 덱과 일치하지 않습니다.' };
    }
  }
  if (confirm && inspection.kind === 'cavalry') {
    if (inspection.takenCardId === null || inspection.discardedCardId === null) {
      return { ...state, invalidReason: '가져올 카드와 버릴 카드를 먼저 고르세요.' };
    }
    try {
      const deck = resolveCavalryExchange(
        battle.decks.B,
        inspection.inspected.map(({ id }) => id),
        { takenCardId: inspection.takenCardId, discardedCardId: inspection.discardedCardId },
      );
      nextBattle = { ...battle, decks: { ...battle.decks, B: deck } };
    } catch {
      return { ...state, invalidReason: '확인한 카드가 현재 덱과 손패에 없습니다.' };
    }
  }
  const promoted = promoteQueuedInspection(
    state.queuedInspections,
    nextBattle,
    inspection.endsTurnOnResolve,
  );
  if (promoted.pendingInspection === null && promoted.endsTurnOnExhaustion) {
    nextBattle = battleReducer(nextBattle, { type: 'END_TURN' });
  }
  return {
    ...state,
    battle: nextBattle,
    pendingInspection: promoted.pendingInspection,
    queuedInspections: promoted.queuedInspections,
    invalidReason: '',
  };
}

export function gameReducer(state: GameState, action: GameAction, config: GameConfig): GameState {
  assertConfig(config);
  switch (action.type) {
    case 'START_RUN':
      return { ...state, screen: 'map', notice: '' };
    case 'OPEN_NODE':
      return openNode(state, action.node, config);
    case 'OPEN_BATTLE':
      return openBattle(state, action.battle, config, action.nodeId);
    case 'SELECT_CARD': {
      if (state.battle === null || state.battle.turn !== 'B') return state;
      const battle = battleReducer(state.battle, { type: 'SELECT_CARD', cardId: action.cardId });
      return { ...state, battle, invalidPoint: null, invalidReason: '' };
    }
    case 'CHOOSE_POINT':
      return commitMove(state, action.point, config);
    case 'AI_TURN':
      return performAiTurn(state, config);
    case 'CONTINUE_TO_MOVE':
      return state.battle === null || state.battle.turn !== 'B'
        ? state
        : { ...state, battle: battleReducer(state.battle, { type: 'CONTINUE_TO_MOVE' }) };
    case 'USE_CHARM': {
      if (state.battle === null || state.battle.turn !== 'B' || state.battle.phase !== 'pre-move') return state;
      const battle = battleReducer(state.battle, { type: 'USE_CHARM', charmId: action.charmId });
      if (battle === state.battle) return state;
      return {
        ...state,
        battle,
        run: runReducer(state.run, { type: 'CONSUME_CHARM', charmId: action.charmId }, config.economy),
      };
    }
    case 'PASS': {
      if (state.battle === null || state.battle.turn !== 'B') return state;
      const battle = battleReducer(state.battle, { type: 'PASS' });
      return scoreIfReady(state, battle, config);
    }
    case 'RESIGN': {
      if (state.battle === null) return state;
      const result = buildResultAnalysis(
        state.battle.board,
        state.battle.komi,
        state.moveImpacts,
        `${String(config.seed)}:resign:${state.sequence}`,
        state.captures,
        state.battle.log.map(({ message }) => message),
      );
      return {
        ...completeRunBattle({ ...state, result }, state.battleKind, 'resign', state.captures.B, config),
        result,
      };
    }
    case 'USE_RELIC':
      return state.battle === null ? state : { ...state, battle: battleReducer(state.battle, { type: 'USE_RELIC', relicId: action.relicId }) };
    case 'INSPECT_TAKE': {
      const inspection = state.pendingInspection;
      if (inspection === null || !inspection.inspected.some(({ id }) => id === action.cardId)) return state;
      return {
        ...state,
        pendingInspection: inspection.kind === 'scout'
          ? { ...inspection, takenCardId: action.cardId, returnedCardId: null, orderedIds: [] }
          : { ...inspection, takenCardId: action.cardId, discardedCardId: null },
        invalidReason: '',
      };
    }
    case 'INSPECT_RETURN': {
      const inspection = state.pendingInspection;
      const battle = state.battle;
      if (inspection === null || inspection.takenCardId === null || battle === null) return state;
      const taken = inspection.inspected.find(({ id }) => id === inspection.takenCardId);
      const stagedHand = taken === undefined ? battle.decks.B.hand : [...battle.decks.B.hand, taken];
      const returned = stagedHand.find(({ id }) => id === action.cardId);
      if (returned === undefined) return state;
      if (inspection.kind === 'cavalry') {
        return { ...state, pendingInspection: { ...inspection, discardedCardId: action.cardId }, invalidReason: '' };
      }
      const orderedIds = [
        ...inspection.inspected.filter(({ id }) => id !== inspection.takenCardId).map(({ id }) => id),
        ...(returned.temporary ? [] : [returned.id]),
      ];
      return { ...state, pendingInspection: { ...inspection, returnedCardId: action.cardId, orderedIds }, invalidReason: '' };
    }
    case 'REORDER_INSPECTION': {
      const inspection = state.pendingInspection;
      if (inspection === null || inspection.kind !== 'scout' || inspection.returnedCardId === null
        || action.orderedIds.length !== inspection.orderedIds.length
        || new Set(action.orderedIds).size !== action.orderedIds.length
        || action.orderedIds.some((id) => !inspection.orderedIds.includes(id))) return state;
      return { ...state, pendingInspection: { ...inspection, orderedIds: [...action.orderedIds] } };
    }
    case 'CONFIRM_INSPECTION':
      return finishInspection(state, true);
    case 'CANCEL_INSPECTION':
      return finishInspection(state, false);
    case 'CHOOSE_REWARD': {
      const run = runReducer(state.run, { type: 'CHOOSE_REWARD', candidateId: action.candidateId }, config.economy);
      return { ...state, run, screen: run.pendingCharm === null ? 'map' : 'reward', notice: run.pendingCharm === null ? '보상을 덱에 반영했습니다.' : '교체할 부적을 선택하세요.' };
    }
    case 'DECLINE_REWARD':
      return { ...state, run: runReducer(state.run, { type: 'DECLINE_REWARDS' }, config.economy), screen: 'map', notice: '보상을 받지 않았습니다.' };
    case 'REPLACE_CHARM': {
      const run = runReducer(state.run, { type: 'REPLACE_CHARM', index: action.index }, config.economy);
      return { ...state, run, screen: run.pendingCharm === null ? 'map' : 'reward', notice: run.pendingCharm === null ? '부적을 교체했습니다.' : state.notice };
    }
    case 'OPEN_SHOP':
      return {
        ...state,
        screen: 'shop',
        shop: generateShop(config.shop, config.economy, rngFor(config, state.sequence, 'shop')),
        notice: '',
        sequence: state.sequence + 1,
      };
    case 'BUY_OFFER': {
      if (state.shop === null) return state;
      const purchase = purchaseShopOffer(asInventory(state.run), state.shop, action.offerId, action.replaceCharmIndex);
      return purchase.purchased
        ? { ...state, run: applyInventory(state.run, purchase.inventory, config), shop: purchase.shop, notice: '구매를 완료했습니다.' }
        : state;
    }
    case 'REMOVE_SHOP_CARD': {
      if (state.shop === null) return state;
      const purchase = removeShopCard(asInventory(state.run), state.shop, action.cardIndex, config.economy);
      return purchase.purchased
        ? { ...state, run: applyInventory(state.run, purchase.inventory, config), shop: purchase.shop, notice: '덱에서 돌을 제거했습니다.' }
        : state;
    }
    case 'OPEN_EVENT':
      return { ...state, screen: 'event', eventResolved: false, notice: '' };
    case 'CHOOSE_EVENT': {
      if (state.eventResolved) return state;
      const run = action.choice === 'currency'
        ? runReducer(state.run, { type: 'GAIN_CURRENCY', amount: config.eventCurrencyReward }, config.economy)
        : state.run;
      return {
        ...state,
        run,
        screen: 'map',
        eventResolved: true,
        notice: action.choice === 'currency' ? `${config.eventCurrencyReward}냥을 얻었습니다.` : action.choice === 'scout' ? '다음 상대의 기풍을 확인했습니다.' : '아무것도 건드리지 않았습니다.',
      };
    }
    case 'OPEN_DOJO': {
      const free = state.run.freeDojoVisits > 0;
      return { ...state, screen: 'dojo', dojo: createDojoVisit(free), notice: '' };
    }
    case 'USE_DOJO': {
      if (state.dojo === null) return state;
      const result = useDojo(asInventory(state.run), state.dojo, action.action, config.economy);
      if (!result.applied) return state;
      let run = applyInventory(state.run, result.inventory, config);
      if (state.dojo.free) run = runReducer(run, { type: 'CONSUME_FREE_DOJO_VISIT' }, config.economy);
      return { ...state, run, dojo: result.visit, notice: '수련 결과를 덱에 반영했습니다.' };
    }
    case 'RETURN_TO_MAP':
      return { ...state, screen: 'map', battle: null, pendingInspection: null, queuedInspections: [], invalidPoint: null, invalidReason: '' };
    case 'RESTART':
      return createInitialGameState(config);
    case 'RESOLVE_BATTLE_FOR_ENGINE': {
      const next = completeRunBattle(state, action.battle, action.resolution, action.capturedStones, config);
      return action.battle === 'boss' && next.run.status === 'active'
        ? next
        : { ...next, screen: next.run.status === 'active' ? next.screen : 'result' };
    }
  }
}

interface GameContextValue {
  readonly state: GameState;
  readonly dispatch: Dispatch<GameAction>;
  readonly config: GameConfig;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({
  config,
  initialState,
  children,
}: {
  readonly config: GameConfig;
  readonly initialState?: GameState;
  readonly children: ReactNode;
}) {
  const reducer = useMemo(() => (state: GameState, action: GameAction) => gameReducer(state, action, config), [config]);
  const [state, dispatch] = useReducer(reducer, initialState ?? config, (value) => 'screen' in value ? value : createInitialGameState(value));
  const context = useMemo(() => ({ state, dispatch, config }), [state, config]);
  return <GameContext.Provider value={context}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const value = useContext(GameContext);
  if (value === null) throw new Error('useGame must be used inside GameProvider');
  return value;
}
