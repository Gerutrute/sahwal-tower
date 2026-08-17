import type { LegalPlay } from './go';
import type { BoardState, Stone } from './types';

export type EffectPriority = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export type EffectSideRelation = 'active' | 'opponent';
export type EffectSourceKind = 'stone' | 'relic';

export interface EffectLimits {
  readonly maxResolvedEffects: number;
  readonly maxQueueDepth: number;
  readonly maxGeneratedEffects: number;
  readonly maxEffectsPerSource: number;
  readonly maxHandSize: number;
}

export interface EffectDefinition {
  readonly id: string;
  readonly trigger: string;
  readonly priority: EffectPriority;
  readonly sideRelation: EffectSideRelation;
  readonly sourceKind: EffectSourceKind;
  readonly acquisitionOrder: number;
  readonly sourceId: string;
  readonly perMoveLimit: number;
  readonly message: string;
  readonly generatedEffects?: readonly EffectDefinition[];
}

export interface EffectLogEntry {
  readonly type: 'effect';
  readonly effectId: string;
  readonly sourceId: string;
  readonly priority: EffectPriority;
  readonly message: string;
}

export interface EffectLimitLogEntry {
  readonly type: 'error';
  readonly code: 'EFFECT_LIMIT_EXCEEDED';
  readonly limit: keyof EffectLimits;
  readonly message: string;
}

export type EffectLog = EffectLogEntry | EffectLimitLogEntry;

export interface ResolvedEffectQueue {
  readonly ok: true;
  readonly log: readonly EffectLogEntry[];
}

export interface RejectedEffectQueue {
  readonly ok: false;
  readonly code: 'EFFECT_LIMIT_EXCEEDED';
  readonly log: readonly EffectLimitLogEntry[];
}

export type EffectQueueResult = ResolvedEffectQueue | RejectedEffectQueue;

interface QueuedEffect {
  readonly effect: EffectDefinition;
  readonly depth: number;
  readonly ancestors: readonly string[];
}

function bucketOf(effect: EffectDefinition): number {
  if (effect.sideRelation === 'active' && effect.sourceKind === 'stone') return 0;
  if (effect.sideRelation === 'active' && effect.sourceKind === 'relic') return 1;
  if (effect.sideRelation === 'opponent' && effect.sourceKind === 'stone') return 2;
  return 3;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareEffects(left: QueuedEffect, right: QueuedEffect): number {
  return left.effect.priority - right.effect.priority
    || bucketOf(left.effect) - bucketOf(right.effect)
    || left.effect.acquisitionOrder - right.effect.acquisitionOrder
    || compareText(left.effect.sourceId, right.effect.sourceId)
    || compareText(left.effect.id, right.effect.id);
}

function limitExceeded(limit: keyof EffectLimits): RejectedEffectQueue {
  return {
    ok: false,
    code: 'EFFECT_LIMIT_EXCEEDED',
    log: [{
      type: 'error',
      code: 'EFFECT_LIMIT_EXCEEDED',
      limit,
      message: '효과 처리 안전 한도를 초과하여 착수를 취소했습니다.',
    }],
  };
}

export function resolveEffectQueue(
  effects: readonly EffectDefinition[],
  limits: EffectLimits,
): EffectQueueResult {
  const queue: QueuedEffect[] = effects.map((effect) => ({ effect, depth: 0, ancestors: [] }));
  const log: EffectLogEntry[] = [];
  const sourceCounts = new Map<string, number>();
  const resolvedRelics = new Set<string>();
  let generatedCount = 0;

  while (queue.length > 0) {
    queue.sort(compareEffects);
    const current = queue.shift();
    if (current === undefined) break;

    const { effect } = current;
    if (current.ancestors.includes(effect.id)) continue;
    if (effect.sourceKind === 'relic' && resolvedRelics.has(effect.sourceId)) continue;

    const sourceCount = sourceCounts.get(effect.sourceId) ?? 0;
    if (sourceCount >= effect.perMoveLimit) continue;
    if (sourceCount >= limits.maxEffectsPerSource) return limitExceeded('maxEffectsPerSource');
    if (log.length >= limits.maxResolvedEffects) return limitExceeded('maxResolvedEffects');
    if (current.depth > limits.maxQueueDepth) return limitExceeded('maxQueueDepth');

    log.push({
      type: 'effect',
      effectId: effect.id,
      sourceId: effect.sourceId,
      priority: effect.priority,
      message: effect.message,
    });
    sourceCounts.set(effect.sourceId, sourceCount + 1);
    if (effect.sourceKind === 'relic') resolvedRelics.add(effect.sourceId);

    const generatedEffects = effect.generatedEffects ?? [];
    generatedCount += generatedEffects.length;
    if (generatedCount > limits.maxGeneratedEffects) {
      return limitExceeded('maxGeneratedEffects');
    }
    const ancestors = [...current.ancestors, effect.id];
    generatedEffects.forEach((generated) => {
      queue.push({ effect: generated, depth: current.depth + 1, ancestors });
    });
  }

  return { ok: true, log };
}

export interface CapturedStone {
  readonly point: number;
  readonly stone: Stone;
}

export interface CaptureSummary {
  readonly board: BoardState;
  readonly capturedStones: readonly CapturedStone[];
  readonly capturedCount: number;
  readonly captureEventCount: 0 | 1;
}

export function summarizeCapture(before: BoardState, play: LegalPlay): CaptureSummary {
  const capturedStones = play.captured.map((point) => {
    const captured = before.points[point];
    if (captured === null) {
      throw new Error(`captured point ${point} did not contain a stone`);
    }
    return { point, stone: captured };
  });
  return {
    board: play.board,
    capturedStones,
    capturedCount: capturedStones.length,
    captureEventCount: capturedStones.length === 0 ? 0 : 1,
  };
}

export interface EffectMoveState {
  readonly log: readonly EffectLog[];
}

export interface ResolveMoveOptions {
  readonly dryRun: boolean;
}

export interface ResolveMoveResult<State extends EffectMoveState> {
  readonly ok: boolean;
  readonly committed: boolean;
  readonly state: State;
  readonly previewState: State;
  readonly log: readonly EffectLog[];
  readonly code?: 'EFFECT_LIMIT_EXCEEDED';
}

export function resolveMove<State extends EffectMoveState>(
  state: State,
  effects: readonly EffectDefinition[],
  limits: EffectLimits,
  options: ResolveMoveOptions,
): ResolveMoveResult<State> {
  const resolved = resolveEffectQueue(effects, limits);
  if (!resolved.ok) {
    return {
      ok: false,
      committed: false,
      state,
      previewState: state,
      log: resolved.log,
      code: resolved.code,
    };
  }

  const previewState = { ...state, log: [...state.log, ...resolved.log] } as State;
  return {
    ok: true,
    committed: !options.dryRun,
    state: options.dryRun ? state : previewState,
    previewState,
    log: resolved.log,
  };
}
