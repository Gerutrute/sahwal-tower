import { useEffect, useRef, useState } from 'react';
import { AI_DELAY_MS, type BattleState } from '../engine';

export type Screen = 'title' | 'battle' | 'relic' | 'end';

export function useAiTurn(args: { screen: Screen; battle: BattleState | null; onAiTurn: () => void }) {
  const { screen, battle, onAiTurn } = args;
  const generation = useRef(0);
  const latest = useRef(args);
  const callback = useRef(onAiTurn);
  const [thinking, setThinking] = useState(false);
  latest.current = args;
  callback.current = onAiTurn;

  useEffect(() => {
    const active = screen === 'battle' && battle?.turn === 'W' && battle.status === 'playing';
    if (!active) { setThinking(false); return; }
    const token = ++generation.current;
    setThinking(true);
    const timer = setTimeout(() => {
      const current = latest.current;
      if (generation.current !== token || current.screen !== 'battle' || current.battle?.turn !== 'W' || current.battle.status !== 'playing') return;
      setThinking(false);
      callback.current();
    }, AI_DELAY_MS);
    return () => { clearTimeout(timer); generation.current += 1; setThinking(false); };
  }, [screen, battle?.turn, battle?.status, battle?.history.length]);

  return { thinking };
}
