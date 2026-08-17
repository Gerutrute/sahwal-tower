export interface ContentBehaviorContract {
  readonly condition: string;
  readonly timing: string;
  readonly target: string;
  readonly duration: string;
  readonly stacking: 'none' | 'unique-source' | 'replace';
  readonly activationLimit: string;
  readonly passBehavior: string;
  readonly endBehavior: string;
}
