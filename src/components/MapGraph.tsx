import type { CSSProperties, ReactNode } from 'react';

import type { ActMap, MapNode } from '../game/map';
import { computeMapLayout, mapEdgeUiState, mapNodeUiState } from '../game/mapLayout';

interface MapGraphProps {
  readonly map: ActMap;
  readonly completedNodeIds: readonly string[];
  readonly renderLabel: (node: MapNode) => ReactNode;
  readonly classNameFor: (node: MapNode) => string;
  readonly onOpenNode: (node: MapNode) => void;
}

export function MapGraph({ map, completedNodeIds, renderLabel, classNameFor, onOpenNode }: MapGraphProps) {
  const layout = computeMapLayout(map);
  const openIds = new Set(layout.nodes
    .filter(({ id }) => mapNodeUiState(map, completedNodeIds, id) === 'open')
    .map(({ id }) => id));
  return <nav
    className="map-graph"
    aria-label={`${map.act}막 지도`}
    style={{ '--map-aspect': `${layout.width} / ${layout.height}` } as CSSProperties}
  >
    <svg aria-hidden="true" viewBox={`0 0 ${layout.width} ${layout.height}`} preserveAspectRatio="none">
      {layout.edges.map((edge) => <line
        key={`${edge.fromId}>${edge.toId}`}
        className="map-edge"
        data-edge={`${edge.fromId}>${edge.toId}`}
        data-edge-state={mapEdgeUiState(completedNodeIds, openIds, edge)}
        x1={edge.x1}
        y1={edge.y1}
        x2={edge.x2}
        y2={edge.y2}
      />)}
    </svg>
    {layout.nodes.map(({ id, node, x, y }) => {
      const state = mapNodeUiState(map, completedNodeIds, id);
      return <button
        key={id}
        className={`map-node ${classNameFor(node)}`}
        data-node-id={id}
        data-state={state}
        disabled={state !== 'open'}
        onClick={() => onOpenNode(node)}
        style={{ left: `${x / layout.width * 100}%`, top: `${y / layout.height * 100}%` }}
      >
        {renderLabel(node)}
      </button>;
    })}
  </nav>;
}
