import { selectableNodeIds, type ActMap, type MapNode } from './map';

export type MapNodeUiState = 'done' | 'current' | 'open' | 'locked';
export type MapEdgeUiState = 'traveled' | 'open' | 'inactive';

export interface MapLayoutNode {
  readonly id: string;
  readonly node: MapNode;
  readonly x: number;
  readonly y: number;
}

export interface MapLayoutEdge {
  readonly fromId: string;
  readonly toId: string;
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

export interface MapLayout {
  readonly width: number;
  readonly height: number;
  readonly nodes: readonly MapLayoutNode[];
  readonly edges: readonly MapLayoutEdge[];
}

const MAP_VIEW_WIDTH = 356;
const HORIZONTAL_PADDING = 78;
const VERTICAL_PADDING = 48;

// The 68px minimum-height button may render three text rows; 96px center spacing
// keeps neighboring boxes and subtitles separate while retaining a narrow viewBox.
export const MAP_NODE_MIN_VERTICAL_SPACING = 96;

export function computeMapLayout(map: ActMap): MapLayout {
  const sourceNodes = [...map.columns.flat(), map.boss];
  const maximumColumn = Math.max(...sourceNodes.map(({ column }) => column));
  const height = VERTICAL_PADDING * 2 + maximumColumn * MAP_NODE_MIN_VERTICAL_SPACING;
  const nodes = sourceNodes.map((node): MapLayoutNode => ({
    id: node.id,
    node,
    x: node.type === 'boss'
      ? MAP_VIEW_WIDTH / 2
      : node.lane === 0 ? HORIZONTAL_PADDING : MAP_VIEW_WIDTH - HORIZONTAL_PADDING,
    y: height - VERTICAL_PADDING - node.column * MAP_NODE_MIN_VERTICAL_SPACING,
  }));
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const edges = sourceNodes.flatMap((node) => node.next.map((toId): MapLayoutEdge => {
    const from = byId.get(node.id);
    const to = byId.get(toId);
    if (from === undefined || to === undefined) throw new Error(`map references missing node: ${toId}`);
    return { fromId: node.id, toId, x1: from.x, y1: from.y, x2: to.x, y2: to.y };
  }));
  return { width: MAP_VIEW_WIDTH, height, nodes, edges };
}

export function mapNodeUiState(
  map: ActMap,
  completedNodeIds: readonly string[],
  nodeId: string,
): MapNodeUiState {
  const current = completedNodeIds.at(-1);
  if (nodeId === current) return 'current';
  if (completedNodeIds.includes(nodeId)) return 'done';
  if (selectableNodeIds(map, completedNodeIds).includes(nodeId)) return 'open';
  return 'locked';
}

export function mapEdgeUiState(
  completedNodeIds: readonly string[],
  openIds: ReadonlySet<string>,
  edge: MapLayoutEdge,
): MapEdgeUiState {
  const current = completedNodeIds.at(-1);
  if (current === edge.fromId && openIds.has(edge.toId)) return 'open';
  for (let index = 0; index < completedNodeIds.length - 1; index += 1) {
    if (completedNodeIds[index] === edge.fromId && completedNodeIds[index + 1] === edge.toId) return 'traveled';
  }
  return 'inactive';
}
