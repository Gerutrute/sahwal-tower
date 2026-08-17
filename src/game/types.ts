export type BoardSize = 7 | 9;
export type StoneColor = 'B' | 'W';
export type StoneKind =
  | 'STONE-001'
  | 'STONE-002'
  | 'STONE-003'
  | 'STONE-004'
  | 'STONE-005'
  | 'STONE-006';

export interface Stone {
  readonly color: StoneColor;
  readonly kind: StoneKind;
  readonly instanceId: string;
}

export interface BoardState {
  readonly size: BoardSize;
  readonly points: readonly (Stone | null)[];
}
