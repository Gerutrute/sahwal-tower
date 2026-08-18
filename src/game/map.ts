import { ENEMY_IDS, type EnemyId } from './content/enemies';
import { EVENT_IDS, type EventId } from './content/events';
import type { RandomSource } from './rng';
import type { BoardSize } from './types';

export type ActNumber = 1 | 2;
export type MapNodeType = 'battle' | 'elite' | 'shop' | 'event' | 'dojo' | 'shrine' | 'boss';
export type NonCombatNodeType = 'shop' | 'event' | 'dojo' | 'shrine';

export interface MapWeights {
  readonly nonCombat: Readonly<Record<NonCombatNodeType, number>>;
  readonly shopAccess: {
    readonly minimumPaths: number;
    readonly maximumPerPath: number;
  };
}

export interface MapNode {
  readonly id: string;
  readonly column: number;
  readonly lane: number;
  readonly type: MapNodeType;
  readonly next: readonly string[];
  readonly enemyId?: EnemyId;
  readonly eventId?: EventId;
}

export interface ActMap {
  readonly act: ActNumber;
  readonly boardSize: BoardSize;
  readonly columns: readonly (readonly MapNode[])[];
  readonly starts: readonly string[];
  readonly boss: MapNode;
}

function validateWeights(weights: MapWeights): void {
  const values = Object.values(weights.nonCombat);
  if (values.some((value) => !Number.isFinite(value) || value < 0)
    || values.every((value) => value === 0)) {
    throw new RangeError('map weights must be finite, non-negative, and not all zero');
  }
  if (!Number.isSafeInteger(weights.shopAccess.minimumPaths)
    || !Number.isSafeInteger(weights.shopAccess.maximumPerPath)
    || weights.shopAccess.minimumPaths < 0
    || weights.shopAccess.maximumPerPath < 0
    || (weights.shopAccess.minimumPaths > 0 && weights.shopAccess.maximumPerPath === 0)) {
    throw new RangeError('shop access constraints are invalid');
  }
}

function weightedNonCombat(
  weights: MapWeights,
  rng: RandomSource,
  allowShop: boolean,
): NonCombatNodeType {
  const entries = (Object.entries(weights.nonCombat) as [NonCombatNodeType, number][])
    .filter(([type, weight]) => weight > 0 && (allowShop || type !== 'shop'));
  if (entries.length === 0) throw new RangeError('at least one eligible non-combat weight is required');
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let cursor = rng() * total;
  for (const [type, weight] of entries) {
    cursor -= weight;
    if (cursor < 0) return type;
  }
  return entries.at(-1)?.[0] ?? 'event';
}

function node(
  act: ActNumber,
  column: number,
  lane: number,
  type: MapNodeType,
  next: readonly string[],
  rng: RandomSource,
): MapNode {
  const enemyId = type === 'battle' || type === 'elite' || type === 'boss'
    ? ENEMY_IDS[Math.floor(rng() * ENEMY_IDS.length)]
    : undefined;
  const eventId = type === 'event'
    ? EVENT_IDS[Math.floor(rng() * EVENT_IDS.length)]
    : undefined;
  return {
    id: `act-${act}-column-${column}-lane-${lane}`,
    column,
    lane,
    type,
    next,
    ...(enemyId === undefined ? {} : { enemyId }),
    ...(eventId === undefined ? {} : { eventId }),
  };
}

export function generateActMap(
  act: ActNumber,
  weights: MapWeights,
  rng: RandomSource,
): ActMap {
  validateWeights(weights);
  const bossId = `act-${act}-boss`;
  const ids = (column: number) => [0, 1].map((lane) => `act-${act}-column-${column}-lane-${lane}`);
  const types: readonly (readonly MapNodeType[])[] = [
    ['battle', 'battle'],
    [weights.shopAccess.minimumPaths > 0 ? 'shop' : weightedNonCombat(weights, rng, weights.shopAccess.maximumPerPath > 0), weightedNonCombat(weights, rng, false)],
    ['battle', 'elite'],
    [weightedNonCombat(weights, rng, false), weightedNonCombat(weights, rng, false)],
    ['battle', weightedNonCombat(weights, rng, false)],
  ];
  const columns = types.map((columnTypes, column) => columnTypes.map((type, lane) => node(
    act,
    column,
    lane,
    type,
    column === 4 ? [bossId] : ids(column + 1),
    rng,
  )));
  const boss: MapNode = {
    ...node(act, 5, 0, 'boss', [], rng),
    id: bossId,
  };
  return {
    act,
    boardSize: act === 1 ? 7 : 9,
    columns,
    starts: ids(0),
    boss,
  };
}

export function enumerateMapPaths(map: ActMap): readonly (readonly MapNode[])[] {
  const byId = new Map<string, MapNode>([
    ...map.columns.flat().map((candidate) => [candidate.id, candidate] as const),
    [map.boss.id, map.boss] as const,
  ]);
  const paths: MapNode[][] = [];
  const visit = (id: string, path: readonly MapNode[]) => {
    const current = byId.get(id);
    if (current === undefined) throw new Error(`map references missing node: ${id}`);
    const nextPath = [...path, current];
    if (current.type === 'boss') {
      paths.push(nextPath);
      return;
    }
    current.next.forEach((next) => visit(next, nextPath));
  };
  map.starts.forEach((start) => visit(start, []));
  return paths;
}

export function selectableNodeIds(
  map: ActMap,
  completedNodeIds: readonly string[],
): readonly string[] {
  if (completedNodeIds.length === 0) return [...map.starts];
  const byId = new Map<string, MapNode>([
    ...map.columns.flat().map((candidate) => [candidate.id, candidate] as const),
    [map.boss.id, map.boss] as const,
  ]);
  const lastCompletedId = completedNodeIds.at(-1)!;
  const lastCompleted = byId.get(lastCompletedId);
  if (lastCompleted === undefined) throw new Error(`map references missing node: ${lastCompletedId}`);
  return [...lastCompleted.next];
}
