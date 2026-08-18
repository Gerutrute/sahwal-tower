import type { ContentBehaviorContract } from './contracts';

export type CharmId = 'ITEM-001' | 'ITEM-002' | 'ITEM-003' | 'ITEM-004' | 'ITEM-005';

export interface CharmDefinition {
  readonly id: CharmId;
  readonly name: string;
  readonly style: string;
  readonly behavior: ContentBehaviorContract;
  readonly ui: {
    readonly summary: string;
    readonly condition: string;
    readonly effect: string;
    readonly strategy: string;
    readonly synergy: string;
  };
}

const charmUi = (summary: string, condition: string, effect: string, strategy: string, synergy: string) => ({ summary, condition, effect, strategy, synergy });

export const CHARM_DEFINITIONS: Readonly<Record<CharmId, CharmDefinition>> = {
  'ITEM-001': { id: 'ITEM-001', name: '수읽기 부적', style: '안정', behavior: { condition: 'pre-move', timing: 'before-card-selection', target: 'hand-and-deck-top', duration: 'immediate', stacking: 'replace', activationLimit: 'consumed-on-use', passBehavior: 'not-a-pass', endBehavior: 'discard-unused-at-run-end' }, ui: charmUi('손패와 덱 위를 미리 읽는다.', '착수 전 카드 선택보다 먼저 사용한다.', '손패와 덱 위 정보를 즉시 확인하고 소모된다.', '위험한 수 전에 선택지를 점검한다.', '척후석의 덱 정리와 함께 쓰면 다음 패를 정밀하게 설계한다.') },
  'ITEM-002': { id: 'ITEM-002', name: '환석부', style: '확장', behavior: { condition: 'pre-move', timing: 'before-card-selection', target: 'one-hand-card-and-deck-top', duration: 'immediate', stacking: 'replace', activationLimit: 'consumed-on-use', passBehavior: 'not-a-pass', endBehavior: 'discard-unused-at-run-end' }, ui: charmUi('손패 한 장을 덱 위 카드와 바꾼다.', '착수 전 카드 선택보다 먼저 사용한다.', '손패 한 장과 덱 맨 위 한 장을 즉시 교환하고 소모된다.', '지금 필요 없는 패를 다음 기회로 미룬다.', '기병석 교환과 연계해 손패 구성을 빠르게 바꾼다.') },
  'ITEM-003': { id: 'ITEM-003', name: '귀환부', style: '순환', behavior: { condition: 'pre-move', timing: 'before-card-selection', target: 'one-hand-card-and-deck-bottom', duration: 'immediate', stacking: 'replace', activationLimit: 'consumed-on-use', passBehavior: 'not-a-pass', endBehavior: 'discard-unused-at-run-end' }, ui: charmUi('손패 한 장을 덱 아래로 돌린다.', '착수 전 카드 선택보다 먼저 사용한다.', '선택한 손패를 덱 맨 아래로 보내고 소모된다.', '나중에 필요한 카드를 안전하게 순환시킨다.', '기병석의 덱 아래 귀환과 함께 순환 덱을 만든다.') },
  'ITEM-004': { id: 'ITEM-004', name: '금전부', style: '경제', behavior: { condition: 'capture-threshold', timing: 'after-capture', target: 'run-currency', duration: 'battle', stacking: 'none', activationLimit: 'once-per-battle', passBehavior: 'no-progress', endBehavior: 'expire' }, ui: charmUi('포획을 재화로 바꾼다.', '대국 중 필요한 포획 조건을 달성했을 때 발동한다.', '대국마다 한 번 재화를 얻고 효과가 끝난다.', '상점 방문을 앞두고 포획 수를 노린다.', '장군석의 포획 보상과 함께 경제 운영을 강화한다.') },
  'ITEM-005': { id: 'ITEM-005', name: '정심부', style: '활로', behavior: { condition: 'pre-move', timing: 'before-placement', target: 'move-preview', duration: 'turn', stacking: 'replace', activationLimit: 'consumed-on-use', passBehavior: 'expires-on-pass', endBehavior: 'expire' }, ui: charmUi('이번 수의 위험을 미리 살핀다.', '착수 전에 사용하고 패스하면 사라진다.', '이번 턴 착수 결과를 미리 확인할 수 있게 하고 소모된다.', '자충이나 큰 포획 실수를 피한다.', '수호석을 둘 위기 그룹의 활로 판단을 돕는다.') },
};

export const CHARM_IDS = Object.freeze(Object.keys(CHARM_DEFINITIONS) as CharmId[]);
