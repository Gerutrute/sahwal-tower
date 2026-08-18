import { describe, expect, it } from 'vitest';

import { generateActMap } from '../src/game/map';
import { DRAFT_MAP_WEIGHTS } from './fixtures/draft-run-config';

const map = generateActMap(1, DRAFT_MAP_WEIGHTS, () => 0.25);

describe('지도 그래프 레이아웃', () => {
  it('아래에서 위로 향하는 열 좌표를 만든다', async () => {
    const module = await import('../src/game/mapLayout').catch(() => ({}));
    expect(module).toHaveProperty('computeMapLayout');
    if (!('computeMapLayout' in module)) return;

    const layout = module.computeMapLayout(map);
    expect(layout.width).toBeLessThanOrEqual(380);
    expect(layout.nodes.every(({ x, y }) => x >= 0 && x <= layout.width && y >= 0 && y <= layout.height)).toBe(true);
    const yByColumn = new Map(layout.nodes.map(({ node, y }) => [node.column, y]));
    expect([...yByColumn.entries()].sort(([a], [b]) => a - b).map(([, y]) => y))
      .toEqual([...yByColumn.entries()].sort(([a], [b]) => b - a).map(([, y]) => y).reverse());
    expect(layout.nodes.find(({ node }) => node.type === 'boss')?.y)
      .toBe(Math.min(...layout.nodes.map(({ y }) => y)));
  });

  it('각 행은 68px 노드 상자·최대 3줄 문구·행간 여백을 위한 최소 96px를 확보한다', async () => {
    const { computeMapLayout, MAP_NODE_MIN_VERTICAL_SPACING } = await import('../src/game/mapLayout');
    const layout = computeMapLayout(map);
    const rowCenters = [...new Set(layout.nodes.map(({ y }) => y))].sort((left, right) => left - right);

    for (let index = 1; index < rowCenters.length; index += 1) {
      expect(rowCenters[index] - rowCenters[index - 1]).toBeGreaterThanOrEqual(MAP_NODE_MIN_VERTICAL_SPACING);
    }
    expect(layout.width).toBeLessThanOrEqual(380);
  });

  it('실제 next 관계만 정확한 좌표로 연결한다', async () => {
    const { computeMapLayout } = await import('../src/game/mapLayout');
    const layout = computeMapLayout(map);
    const expected = map.columns.flat().flatMap((node) => node.next.map((next) => `${node.id}>${next}`));
    expect(layout.edges.map(({ fromId, toId }) => `${fromId}>${toId}`).sort()).toEqual([...expected].sort());
    expect(layout.edges).toHaveLength(18);
    const byId = new Map(layout.nodes.map((node) => [node.id, node]));
    layout.edges.forEach((edge) => {
      expect([edge.x1, edge.y1]).toEqual([byId.get(edge.fromId)?.x, byId.get(edge.fromId)?.y]);
      expect([edge.x2, edge.y2]).toEqual([byId.get(edge.toId)?.x, byId.get(edge.toId)?.y]);
    });
  });

  it('마지막 완료 노드와 다음 노드의 상태를 구별한다', async () => {
    const { mapNodeUiState, mapEdgeUiState, computeMapLayout } = await import('../src/game/mapLayout');
    expect(map.starts.map((id) => mapNodeUiState(map, [], id))).toEqual(['open', 'open']);
    expect(computeMapLayout(map).nodes.filter(({ id }) => mapNodeUiState(map, [], id) === 'current')).toHaveLength(0);
    const current = map.starts[0];
    const currentNode = map.columns.flat().find(({ id }) => id === current)!;
    expect(mapNodeUiState(map, [current], current)).toBe('current');
    currentNode.next.forEach((id) => expect(mapNodeUiState(map, [current], id)).toBe('open'));
    const nextCurrent = currentNode.next[0];
    expect(mapNodeUiState(map, [current, nextCurrent], current)).toBe('done');
    expect(mapNodeUiState(map, [current, nextCurrent], nextCurrent)).toBe('current');
    const openIds = new Set(currentNode.next);
    const openEdges = computeMapLayout(map).edges.filter((edge) => mapEdgeUiState([current], openIds, edge) === 'open');
    expect(openEdges.map(({ fromId }) => fromId)).toEqual(currentNode.next.map(() => current));
  });
});
