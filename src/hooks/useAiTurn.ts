import { useEffect, useRef, useState } from 'react';

export type Screen = 'title' | 'map' | 'battle' | 'reward' | 'shop' | 'event' | 'dojo' | 'result';

interface UseAiTurnInput {
  readonly screen: Screen;
  readonly turn: 'player' | 'enemy';
  readonly active: boolean;
  readonly onAiTurn: () => void;
  readonly delayMs?: number;
}

export function useAiTurn({ screen, turn, active, onAiTurn, delayMs = 420 }: UseAiTurnInput) {
  const generation = useRef(0);
  const latest = useRef({ screen, turn, active });
  const callback = useRef(onAiTurn);
  const [thinking, setThinking] = useState(false);
  latest.current = { screen, turn, active };
  callback.current = onAiTurn;

  useEffect(() => {
    if (screen !== 'battle' || turn !== 'enemy' || !active) {
      setThinking(false);
      generation.current += 1;
      return;
    }
    const token = ++generation.current;
    setThinking(true);
    const timer = window.setTimeout(() => {
      const current = latest.current;
      if (generation.current !== token || current.screen !== 'battle'
        || current.turn !== 'enemy' || !current.active) return;
      setThinking(false);
      callback.current();
    }, delayMs);
    return () => {
      window.clearTimeout(timer);
      generation.current += 1;
      setThinking(false);
    };
  }, [screen, turn, active, delayMs]);

  return { thinking };
}
