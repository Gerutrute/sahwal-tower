import { CELLS, SIZE, colOf, idx, libsOf, rowOf, type BattleState, type Pos } from '../engine';

const STEP = 50;
const PAD = 20;
const point = (p: Pos) => ({ x: PAD + colOf(p) * STEP, y: PAD + rowOf(p) * STEP });

export function BoardSvg({ state, disabled, onMove }: { state: BattleState; disabled: boolean; onMove: (p: Pos) => void }) {
  const kingBAtari = state.kingB !== null && state.board[state.kingB] === 'B' && libsOf(state.board, state.kingB) === 1;
  const kingWAtari = state.kingW !== null && state.board[state.kingW] === 'W' && libsOf(state.board, state.kingW) === 1;
  return <div className="board-wrap">
    <svg className="board" viewBox="0 0 340 340" role="grid" aria-label="칠 줄 바둑판">
      <rect className="board-bg" x="0" y="0" width="340" height="340" rx="10" />
      {Array.from({ length: SIZE }, (_, n) => <g key={n}>
        <line className="grid-line" x1={PAD} y1={PAD+n*STEP} x2={PAD+6*STEP} y2={PAD+n*STEP} />
        <line className="grid-line" x1={PAD+n*STEP} y1={PAD} x2={PAD+n*STEP} y2={PAD+6*STEP} />
      </g>)}
      <circle className="star" cx={PAD+3*STEP} cy={PAD+3*STEP} r="4" />
      {Array.from({ length: CELLS }, (_, p) => {
        const cell = state.board[p]; const { x, y } = point(p);
        if (cell === 'R') return <circle key={p} className="rock" cx={x} cy={y} r="18" />;
        if (cell === null) return <circle key={p} data-hit={`${rowOf(p)}-${colOf(p)}`} className="hit" cx={x} cy={y} r={STEP/2} fill="transparent"
          role="button" tabIndex={disabled ? -1 : 0} aria-label={`${rowOf(p)+1}행 ${colOf(p)+1}열에 착수`}
          onClick={() => !disabled && onMove(p)} onKeyDown={(event) => {
            if (!disabled && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onMove(p); }
          }} />;
        const king = p === state.kingB || p === state.kingW;
        const atari = (p === state.kingB && kingBAtari) || (p === state.kingW && kingWAtari);
        return <g key={p} className="stone-pop">
          <circle className={`stone stone-${cell.toLowerCase()}`} cx={x} cy={y} r="20" />
          {state.lastMove === p && <circle className="last-ring" cx={x} cy={y} r="12" />}
          {king && <circle className="king-ring" cx={x} cy={y} r="23" />}
          {atari && <circle className="atari-ring" cx={x} cy={y} r="27" />}
          {king && <text className={`king-text king-text-${cell.toLowerCase()}`} x={x} y={y+6}>王</text>}
          {state.bomb.pos === p && <text className="bomb-mark" x={x} y={y+7}>✸</text>}
        </g>;
      })}
    </svg>
    {(kingBAtari || kingWAtari) && <p className="danger-line">{kingBAtari ? '위험 — 내 왕돌이 단수에 몰렸다!' : '기회 — 적 왕돌이 단수다. 한 수면 잡는다.'}</p>}
  </div>;
}
