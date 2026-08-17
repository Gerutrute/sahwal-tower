import { chooseBattleAiMove, type AiSearchState } from '../../src/game/ai';
import { createBoard, tryPlay } from '../../src/game/go';
import { createSeededRng } from '../../src/game/rng';
import type { BoardSize, BoardState, Stone, StoneKind } from '../../src/game/types';

export interface AiBenchmarkFixture {
  readonly size: BoardSize;
  readonly seed: string;
  readonly state: AiSearchState;
}

const DRAFT_BENCHMARK_HAND: readonly StoneKind[] = [
  'STONE-001',
  'STONE-002',
  'STONE-005',
  'STONE-006',
];

function benchmarkBoard(size: BoardSize, seed: string): BoardState {
  const rng = createSeededRng(seed);
  let board = createBoard(size);
  let color: Stone['color'] = 'B';
  const placements = size === 7 ? 8 : 12;
  for (let index = 0; index < placements; index += 1) {
    const start = Math.floor(rng() * board.points.length);
    for (let offset = 0; offset < board.points.length; offset += 1) {
      const point = (start + offset) % board.points.length;
      const stone: Stone = {
        color,
        kind: DRAFT_BENCHMARK_HAND[index % DRAFT_BENCHMARK_HAND.length],
        instanceId: `fixture-${seed}-${index}`,
      };
      const play = tryPlay(board, point, stone, null);
      if (play.ok) {
        board = play.board;
        color = color === 'B' ? 'W' : 'B';
        break;
      }
    }
  }
  return board;
}

export function createAiBenchmarkFixtures(): AiBenchmarkFixture[] {
  return ([7, 9] as const).flatMap((size) => Array.from({ length: 5 }, (_, index) => {
    const seed = `draft-ai-${size}-${index}`;
    return {
      size,
      seed,
      state: {
        board: benchmarkBoard(size, seed),
        color: 'W',
        hand: DRAFT_BENCHMARK_HAND.map((kind, cardIndex) => ({
          id: `fixture-card-${cardIndex}`,
          kind,
          temporary: false,
        })),
        koForbiddenKey: null,
      },
    };
  }));
}

export function independentLegalCombinationCount(state: AiSearchState): number {
  let count = 0;
  state.hand.forEach((card) => {
    for (let point = 0; point < state.board.points.length; point += 1) {
      const stone: Stone = {
        color: state.color,
        kind: card.kind,
        instanceId: `independent-${card.id}-${point}`,
      };
      if (tryPlay(state.board, point, stone, state.koForbiddenKey).ok) count += 1;
    }
  });
  return count;
}

export function runDraftAiChoice(state: AiSearchState, seed: string) {
  return chooseBattleAiMove(state, (candidate) => (
    candidate.captured.length * 100
    + candidate.point
    - candidate.cardIndex
  ), createSeededRng(seed));
}
