import type { KeyboardEvent } from 'react';
import type { BoardSize, StoneColor, StoneKind } from '../game/types';

export interface BoardStone {
  readonly color: StoneColor;
  readonly kind: StoneKind;
}

interface BoardSvgProps {
  readonly size: BoardSize;
  readonly points: readonly (BoardStone | null)[];
  readonly disabled?: boolean;
  readonly invalidPoint?: number | null;
  readonly protectedPoints?: readonly number[];
  readonly onMove: (point: number) => void;
}

const VIEW_SIZE = 380;
const EDGE = 22;
const stepFor = (size: BoardSize): number => size === 9 ? 42 : 56;
const hitRadiusFor = (size: BoardSize): number => size === 9 ? 21 : 22;
const coordinate = (size: BoardSize, index: number): number => EDGE + index * stepFor(size);

export function BoardSvg({
  size,
  points,
  disabled = false,
  invalidPoint = null,
  protectedPoints = [],
  onMove,
}: BoardSvgProps) {
  const total = size * size;
  const end = coordinate(size, size - 1);
  const play = (point: number) => {
    if (!disabled) onMove(point);
  };
  const onKeyDown = (event: KeyboardEvent<SVGCircleElement>, point: number) => {
    if (disabled || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    onMove(point);
  };

  return <div className="board-wrap" data-board-size={size}>
    <svg className="board" viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`} role="grid" aria-label={`${size}×${size} 바둑판`}>
      <rect className="board-bg" width={VIEW_SIZE} height={VIEW_SIZE} rx="18" />
      {Array.from({ length: size }, (_, index) => <g key={`line-${index}`}>
        <line className="grid-line" x1={EDGE} y1={coordinate(size, index)} x2={end} y2={coordinate(size, index)} />
        <line className="grid-line" x1={coordinate(size, index)} y1={EDGE} x2={coordinate(size, index)} y2={end} />
      </g>)}
      {size === 9 && [2, 4, 6].flatMap((row) => [2, 4, 6].map((column) =>
        <circle key={`star-${row}-${column}`} className="star" cx={coordinate(size, column)} cy={coordinate(size, row)} r="3" />))}
      {size === 7 && <circle className="star" cx={coordinate(size, 3)} cy={coordinate(size, 3)} r="3" />}
      {Array.from({ length: total }, (_, point) => {
        const row = Math.floor(point / size);
        const column = point % size;
        const x = coordinate(size, column);
        const y = coordinate(size, row);
        const stone = points[point] ?? null;
        return <g key={`point-${point}`} role="row">
          {stone && <g className="stone-pop">
            <circle className={`stone stone-${stone.color.toLowerCase()}`} cx={x} cy={y} r="17" />
            <text className={`stone-kind stone-kind-${stone.color.toLowerCase()}`} x={x} y={y + 5}>{stone.kind.slice(-1)}</text>
          </g>}
          {protectedPoints.includes(point) && <circle className="protection-ring" data-protected={point} cx={x} cy={y} r="20" />}
          {invalidPoint === point && <circle className="invalid-ring" cx={x} cy={y} r="18" />}
          <circle
            className="hit"
            data-hit={`${row}-${column}`}
            data-point={point}
            cx={x}
            cy={y}
            r={hitRadiusFor(size)}
            fill="transparent"
            role="button"
            tabIndex={disabled ? -1 : 0}
            aria-disabled={disabled}
            aria-label={`${size}×${size} 바둑판 ${row + 1}행 ${column + 1}열${stone ? ', 놓을 수 없음' : ', 착수'}`}
            onClick={() => play(point)}
            onKeyDown={(event) => onKeyDown(event, point)}
          />
        </g>;
      })}
    </svg>
  </div>;
}
