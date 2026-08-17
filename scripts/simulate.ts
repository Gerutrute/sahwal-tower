import { aiTurn, legalMoves, newRun, playerMove, playerPass, startBattle, type FloorId } from '../src/engine';

function seeded(seed: number) { let value = seed >>> 0; return () => { value = (value * 1664525 + 1013904223) >>> 0; return value / 4294967296; }; }
for (const floor of [1, 2, 3] as FloorId[]) {
  for (let game = 0; game < 3; game += 1) {
    const random = seeded(floor * 100 + game); let state = startBattle(newRun(), floor); let moves = 0;
    while (state.status === 'playing' && moves < 400) {
      if (state.turn === 'B') { const legal = legalMoves(state.board, 'B', state.history); state = legal.length ? playerMove(state, legal[Math.floor(random() * legal.length)]) : playerPass(state); }
      else state = aiTurn(state, random);
      if (state.pouchB < 0 || state.pouchW < 0) throw new Error('주머니 음수 발생');
      moves += 1;
    }
    if (state.status === 'playing') throw new Error(`${floor}층 ${game + 1}회: 400수 초과`);
    console.log(`${floor}층 ${game + 1}회: ${state.status} · ${moves}턴 · 흑 ${state.pouchB} / 백 ${state.pouchW}`);
  }
}
