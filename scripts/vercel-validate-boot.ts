import { createInitialGameState, type GameConfig } from '../src/game/GameProvider';
import { validateGameConfigText } from './vercel-runtime-config.mjs';

interface ValidationFailure {
  readonly ok: false;
  readonly code: string;
  readonly fields?: readonly string[];
}

export type BootValidationResult =
  | { readonly ok: true }
  | ValidationFailure
  | { readonly ok: false; readonly code: 'RUNTIME_CONFIG_BOOT_FAILED'; readonly message: string };

export function validateBootFromText(text: string | undefined): BootValidationResult {
  const validation = validateGameConfigText(text) as
    | { readonly ok: true; readonly config: GameConfig }
    | ValidationFailure;
  if (!validation.ok) return validation;

  try {
    createInitialGameState(validation.config);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      code: 'RUNTIME_CONFIG_BOOT_FAILED',
      message: error instanceof Error ? error.message : 'GameConfig boot validation failed',
    };
  }
}

function isDirectExecution(): boolean {
  // vite-node replaces argv[1] with its own runner path; Vitest provides an explicit test marker.
  return process.env.VITEST !== 'true' && process.env.NODE_ENV !== 'test';
}

if (isDirectExecution()) {
  const result = validateBootFromText(process.env.ROGOLIKE_GAME_CONFIG_JSON);
  if (result.ok) {
    console.log('RUNTIME_CONFIG_OK');
  } else {
    const suffix = 'fields' in result && result.fields?.length ? ` ${result.fields.join(',')}` : '';
    console.error(`${result.code}${suffix}`);
    process.exitCode = 1;
  }
}
