export interface UnlockState { readonly unlockedIds: readonly string[] }

export type UnlockAction =
  | { readonly type: 'UNLOCK'; readonly id: string }
  | { readonly type: 'RESET'; readonly ids: readonly string[] };

function normalize(ids: readonly string[]): readonly string[] {
  return [...new Set(ids.filter((id) => id.length > 0))].sort();
}

export function createUnlockState(ids: readonly string[] = []): UnlockState {
  return { unlockedIds: normalize(ids) };
}

export function unlockReducer(state: UnlockState, action: UnlockAction): UnlockState {
  if (action.type === 'RESET') return createUnlockState(action.ids);
  if (state.unlockedIds.includes(action.id) || action.id.length === 0) return state;
  return { unlockedIds: normalize([...state.unlockedIds, action.id]) };
}

export function isUnlocked(state: UnlockState, id: string): boolean {
  return state.unlockedIds.includes(id);
}

export function unlockPredicate(state: UnlockState): (id: string) => boolean {
  return (id) => isUnlocked(state, id);
}

export function filterUnlocked<T>(candidates: readonly T[], state: UnlockState, getId: (candidate: T) => string): readonly T[] {
  return candidates.filter((candidate) => isUnlocked(state, getId(candidate)));
}
