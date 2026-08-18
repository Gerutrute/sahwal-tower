import { describe, expect, it } from 'vitest';

import {
  battleReducer,
  createBattleState,
  performRevivalSpecialMove,
  stoneMajorityWinner,
  type BattleState,
} from '../src/game/battle';
import { createBoard } from '../src/game/go';
import { createSeededRng } from '../src/game/rng';
import type { BoardState, StoneColor } from '../src/game/types';
import { DRAFT_BATTLE_DEFINITION, DRAFT_KOMI } from './fixtures/draft-battle-config';

function boardWith(size: 7 | 9, black: number, white: number): BoardState {
  const points = [...createBoard(size).points];
  for (let point = 0; point < black; point += 1) {
    points[point] = { color: 'B', kind: 'STONE-001', instanceId: `black-${point}` };
  }
  for (let point = black; point < black + white; point += 1) {
    points[point] = { color: 'W', kind: 'STONE-001', instanceId: `white-${point}` };
  }
  return { size, points };
}

function readyToPlay(board: BoardState, turn: StoneColor, revival = false): BattleState {
  const state = createBattleState({
    act: 1,
    board,
    playerDeck: ['STONE-001', 'STONE-002', 'STONE-003', 'STONE-004'],
    enemyDeck: ['STONE-001', 'STONE-002', 'STONE-003', 'STONE-004'],
    enemy: revival ? DRAFT_BATTLE_DEFINITION : { id: 'NO-REVIVAL' },
    komi: DRAFT_KOMI,
    rng: createSeededRng('majority-create'),
    maxHandSize: 8,
    turn,
  });
  return {
    ...state,
    phase: 'choose-point',
    selectedCardId: state.decks[turn].hand[0].id,
  };
}

function play(state: BattleState, point: number): BattleState {
  return battleReducer(state, {
    type: 'PLAY_CARD',
    point,
    rng: createSeededRng(`majority-play-${point}`),
  });
}

describe('돌 점유 과반 즉시 종료', () => {
  it('7x7과 9x9에서 영역이 아닌 돌 개수만으로 과반을 판정한다', () => {
    expect(stoneMajorityWinner(boardWith(7, 24, 0))).toBeNull();
    expect(stoneMajorityWinner(boardWith(7, 25, 0))).toBe('B');
    expect(stoneMajorityWinner(boardWith(7, 0, 25))).toBe('W');
    expect(stoneMajorityWinner(boardWith(9, 40, 0))).toBeNull();
    expect(stoneMajorityWinner(boardWith(9, 41, 0))).toBe('B');
  });

  it('빈 판 첫 착수는 영역 점수와 무관하게 대국을 끝내지 않는다', () => {
    const next = play(readyToPlay(createBoard(7), 'B'), 0);

    expect(next.phase).not.toBe('result');
    expect(next.outcome).toBeNull();
  });

  it('흑의 25번째 착수는 즉시 승리하고 종료 사유를 기록한다', () => {
    const next = play(readyToPlay(boardWith(7, 24, 0), 'B'), 24);

    expect(next).toMatchObject({
      phase: 'result',
      outcome: 'stage-win',
      rewardStatus: 'available',
    });
    expect(next.log.some(({ message }) => message.includes('점유 과반'))).toBe(true);
  });

  it('백의 25번째 착수는 대칭적으로 즉시 패배를 확정한다', () => {
    const next = play(readyToPlay(boardWith(7, 0, 24), 'W'), 24);

    expect(next).toMatchObject({ phase: 'result', outcome: 'run-loss' });
  });

  it('흑 과반 승리는 기존 부활 경로를 그대로 사용한다', () => {
    const next = play(readyToPlay(boardWith(7, 24, 0), 'B', true), 24);

    expect(next).toMatchObject({
      phase: 'revival-special-move',
      revivalStage: 2,
      rewardStatus: 'withheld',
    });
  });

  it('패스는 비정상 주입 판면에서도 점유 판정 계기가 아니다', () => {
    const state = { ...readyToPlay(boardWith(7, 25, 0), 'B'), phase: 'choose-card' as const };
    const next = battleReducer(state, { type: 'PASS' });

    expect(next.phase).toBe('turn-start');
    expect(next.outcome).toBeNull();
  });

  it('포획 제거가 반영된 완결 판면에서 점유를 판정한다', () => {
    const points = [...createBoard(7).points];
    for (let point = 2; point <= 25; point += 1) {
      points[point] = { color: 'B', kind: 'STONE-001', instanceId: `black-${point}` };
    }
    points[1] = { color: 'W', kind: 'STONE-001', instanceId: 'white-target' };
    points[8] = { color: 'B', kind: 'STONE-001', instanceId: 'black-down' };
    const next = play(readyToPlay({ size: 7, points }, 'B'), 0);

    expect(next.board.points[1]).toBeNull();
    expect(next.outcome).toBe('stage-win');
  });

  it('부활 전용 착수도 완결 직후 백 과반을 판정한다', () => {
    const points = [...boardWith(7, 0, 24).points];
    const revived = {
      ...readyToPlay({ size: 7, points }, 'W', true),
      phase: 'revival-special-move' as const,
      revivalStage: 2 as const,
      enemy: {
        ...DRAFT_BATTLE_DEFINITION,
        revival: {
          ...DRAFT_BATTLE_DEFINITION.revival!,
          specialMoves: DRAFT_BATTLE_DEFINITION.revival!.specialMoves.map((move) => ({
            ...move,
            scoreWeights: {
              ...move.scoreWeights,
              pointWeights: move.scoreWeights.pointWeights.map((_, point) => point === 24 ? 1000 : 0),
            },
          })),
        },
      },
    };
    const next = performRevivalSpecialMove(revived, createSeededRng('revival-majority'));

    expect(next).toMatchObject({ phase: 'result', outcome: 'run-loss' });
  });
});
