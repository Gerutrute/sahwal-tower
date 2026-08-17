import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { aiTurn, applyRelic, applyRevival, finishFloor, newRun, playerMove, playerPass, startBattle, toggleBomb } from '../src/engine';

describe('엔진 순수성', () => {
  const source = readFileSync('src/engine.ts', 'utf8');

  it('engine.ts는 어떤 모듈도 import하지 않는다', () => {
    expect(source).not.toMatch(/^\s*import\s/m);
    expect(source).not.toMatch(/\brequire\s*\(/);
    expect(source).not.toMatch(/\bfrom\s+['"]/);
  });

  it('engine.ts는 부수효과 API를 참조하지 않는다', () => {
    expect(source).not.toMatch(/\b(?:window|document|localStorage|sessionStorage|fetch|XMLHttpRequest|setTimeout|setInterval|Date|performance|console|process)\b/);
    expect(source).not.toContain('Math.random');
  });

  it('공개 함수는 입력 상태를 변형하지 않는다', () => {
    const run = { ...newRun(), relics: ['bomb' as const] };
    const battle = startBattle(run, 1);
    const runBefore = structuredClone(run);
    const before = structuredClone(battle);
    playerMove(battle, 0);
    playerPass(battle);
    toggleBomb(battle);
    aiTurn({ ...battle, turn: 'W' }, () => 0);
    applyRevival({ ...startBattle(newRun(), 3), kingW: null });
    finishFloor(run, { ...battle, status: 'win', reason: 'king' });
    applyRelic(run, 'pouch7');
    expect(run).toEqual(runBefore);
    expect(battle).toEqual(before);
  });
});
