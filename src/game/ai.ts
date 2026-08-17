import { tryPlay } from './go';
import { randomInt } from './rng';
import type { RandomSource } from './rng';
import type { StoneCard } from './deck';
import type { BoardState, Stone, StoneColor } from './types';

export interface AiSearchState {
  readonly board: BoardState;
  readonly color: StoneColor;
  readonly hand: readonly StoneCard[];
  readonly koForbiddenKey: string | null;
}

export interface AiCandidate {
  readonly card: StoneCard;
  readonly cardIndex: number;
  readonly point: number;
  readonly board: BoardState;
  readonly captured: readonly number[];
}

export interface ScoredAiCandidate extends AiCandidate {
  readonly score: number;
}

export type AiEvaluator = (candidate: AiCandidate) => number;

export interface AiChoice {
  readonly move: ScoredAiCandidate | null;
  readonly evaluatedCount: number;
}

export function enumerateLegalAiMoves(state: AiSearchState): AiCandidate[] {
  const candidates: AiCandidate[] = [];
  state.hand.forEach((card, cardIndex) => {
    for (let point = 0; point < state.board.points.length; point += 1) {
      const stone: Stone = {
        color: state.color,
        kind: card.kind,
        instanceId: `ai-probe-${card.id}-${point}`,
      };
      const play = tryPlay(state.board, point, stone, state.koForbiddenKey);
      if (play.ok) {
        candidates.push({
          card,
          cardIndex,
          point,
          board: play.board,
          captured: play.captured,
        });
      }
    }
  });
  return candidates;
}

export function chooseBattleAiMove(
  state: AiSearchState,
  evaluate: AiEvaluator,
  rng: RandomSource,
): AiChoice {
  const scored = enumerateLegalAiMoves(state).map<ScoredAiCandidate>((candidate) => ({
    ...candidate,
    score: evaluate(candidate),
  }));
  if (scored.length === 0) return { move: null, evaluatedCount: 0 };

  const bestScore = scored.reduce((best, candidate) => Math.max(best, candidate.score), -Infinity);
  const tied = scored.filter((candidate) => candidate.score === bestScore);
  const move = tied.length === 1 ? tied[0] : tied[randomInt(rng, tied.length)];
  return { move, evaluatedCount: scored.length };
}
