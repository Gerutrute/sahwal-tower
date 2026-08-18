import { describe, expect, it } from 'vitest';

import { createInitialGameState, gameReducer, type GameState } from '../src/game/GameProvider';
import { selectableNodeIds, type MapNode } from '../src/game/map';
import { DRAFT_GAME_CONFIG } from './fixtures/draft-game-config';

function findNode(state: GameState, id: string): MapNode {
  const node = [...state.map.columns.flat(), state.map.boss].find((candidate) => candidate.id === id);
  if (node === undefined) throw new Error(`missing test node: ${id}`);
  return node;
}

function finishNode(state: GameState, node: MapNode): GameState {
  let next = gameReducer(state, { type: 'OPEN_NODE', node }, DRAFT_GAME_CONFIG);
  if (node.type === 'battle' || node.type === 'elite') {
    next = gameReducer(next, {
      type: 'RESOLVE_BATTLE_FOR_ENGINE',
      battle: node.type === 'elite' ? 'elite' : 'normal',
      resolution: 'win',
      capturedStones: 0,
    }, DRAFT_GAME_CONFIG);
    return gameReducer(next, { type: 'DECLINE_REWARD' }, DRAFT_GAME_CONFIG);
  }
  if (node.type === 'boss') {
    return gameReducer(next, {
      type: 'RESOLVE_BATTLE_FOR_ENGINE',
      battle: 'boss',
      resolution: 'win',
      capturedStones: 0,
    }, DRAFT_GAME_CONFIG);
  }
  return next.screen === 'map'
    ? next
    : gameReducer(next, { type: 'RETURN_TO_MAP' }, DRAFT_GAME_CONFIG);
}

describe('지도 경로 진행', () => {
  it('시작에는 starts만, 완료 뒤에는 마지막 노드 next만 연다', () => {
    const state = createInitialGameState(DRAFT_GAME_CONFIG);
    expect(selectableNodeIds(state.map, [])).toEqual(state.map.starts);

    const start = findNode(state, state.map.starts[0]);
    expect(selectableNodeIds(state.map, [start.id])).toEqual(start.next);
    expect(selectableNodeIds(state.map, [start.id])).not.toContain(state.map.boss.id);

    const finalColumn = state.map.columns[4][0];
    expect(selectableNodeIds(state.map, [finalColumn.id])).toEqual([state.map.boss.id]);
    expect(() => selectableNodeIds(state.map, ['missing-node'])).toThrow(/missing-node/);
  });

  it('잠긴 OPEN_NODE를 reducer에서 막고 전투 승리·보상 뒤 next를 연다', () => {
    let state = createInitialGameState(DRAFT_GAME_CONFIG);
    state = gameReducer(state, { type: 'START_RUN' }, DRAFT_GAME_CONFIG);
    expect(state.completedNodeIds).toEqual([]);

    const locked = state.map.columns[1][0];
    const rejected = gameReducer(state, { type: 'OPEN_NODE', node: locked }, DRAFT_GAME_CONFIG);
    expect(rejected).toMatchObject({ screen: 'map', battle: null, completedNodeIds: [] });
    expect(rejected.notice).toContain('이어지지 않은');

    const start = findNode(state, state.map.starts[0]);
    state = gameReducer(state, { type: 'OPEN_NODE', node: start }, DRAFT_GAME_CONFIG);
    expect(state.completedNodeIds).toEqual([]);
    state = gameReducer(state, {
      type: 'RESOLVE_BATTLE_FOR_ENGINE',
      battle: 'normal',
      resolution: 'win',
      capturedStones: 0,
    }, DRAFT_GAME_CONFIG);
    expect(state.completedNodeIds).toEqual([start.id]);
    expect(state.screen).toBe('reward');
    state = gameReducer(state, { type: 'DECLINE_REWARD' }, DRAFT_GAME_CONFIG);
    expect(selectableNodeIds(state.map, state.completedNodeIds)).toEqual(start.next);
  });

  it('비전투 노드는 방문으로 완료되고 막 전환과 RESTART에서 진행을 초기화한다', () => {
    let state = createInitialGameState(DRAFT_GAME_CONFIG);
    state = gameReducer(state, { type: 'START_RUN' }, DRAFT_GAME_CONFIG);

    let nextId = state.map.starts[0];
    while (nextId !== state.map.boss.id) {
      const node = findNode(state, nextId);
      state = finishNode(state, node);
      expect(state.completedNodeIds).toContain(node.id);
      nextId = node.next[0];
    }

    const boss = state.map.boss;
    state = finishNode(state, boss);
    expect(state.run.act).toBe(2);
    expect(state.completedNodeIds).toEqual([]);
    expect(selectableNodeIds(state.map, state.completedNodeIds)).toEqual(state.map.starts);

    state = gameReducer(state, { type: 'RESTART' }, DRAFT_GAME_CONFIG);
    expect(state.completedNodeIds).toEqual([]);
  });
});
