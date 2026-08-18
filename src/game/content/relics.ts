import type { ContentBehaviorContract } from './contracts';

export type RelicId =
  | 'RELIC-001'
  | 'RELIC-002'
  | 'RELIC-003'
  | 'RELIC-005'
  | 'RELIC-007'
  | 'RELIC-009'
  | 'RELIC-010'
  | 'RELIC-013';

export interface RelicDefinition {
  readonly id: RelicId;
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

const relicUi = (summary: string, condition: string, effect: string, strategy: string, synergy: string) => ({ summary, condition, effect, strategy, synergy });

export const RELIC_DEFINITIONS: Readonly<Record<RelicId, RelicDefinition>> = {
  'RELIC-001': { id: 'RELIC-001', name: '낡은 바둑통', style: '안정', behavior: { condition: '대국 시작', timing: 'opening-hand', target: 'player-deck', duration: 'battle-start', stacking: 'none', activationLimit: 'once-per-battle', passBehavior: 'unaffected', endBehavior: 'reset' }, ui: relicUi('대국 시작 손패를 안정시킨다.', '새 대국이 시작될 때 발동한다.', '시작 손패 구성에 한 번 영향을 준다.', '첫 수의 선택 폭을 확보한다.', '효과 카드가 많은 덱의 시작 변동을 줄인다.') },
  'RELIC-002': { id: 'RELIC-002', name: '장수의 호패', style: '포획', behavior: { condition: 'capture-threshold', timing: 'after-capture', target: 'run-currency', duration: 'battle', stacking: 'unique-source', activationLimit: 'injected-battle-cap', passBehavior: 'no-progress', endBehavior: 'reset-counter' }, ui: relicUi('포획할수록 재화를 얻는다.', '대국 중 상대 돌을 포획했을 때 발동한다.', '주입된 대국 상한까지 포획 보상을 누적한다.', '큰 포획을 상점 자원으로 바꾼다.', '장군석과 함께 포획 중심 덱을 강화한다.') },
  'RELIC-003': { id: 'RELIC-003', name: '빈 바둑통', style: '압축', behavior: { condition: 'deck-size-threshold', timing: 'before-inspection', target: 'inspection-count', duration: 'run', stacking: 'none', activationLimit: 'each-inspection', passBehavior: 'unaffected', endBehavior: 'persist' }, ui: relicUi('작은 덱의 확인 범위를 넓힌다.', '덱 크기 조건을 만족한 채 카드를 확인할 때 발동한다.', '각 확인 효과가 볼 수 있는 카드 수를 늘린다.', '덱을 줄여 원하는 카드를 빨리 찾는다.', '척후석과 기병석의 선택 폭을 넓힌다.') },
  'RELIC-005': { id: 'RELIC-005', name: '현무의 등껑질', style: '대마', behavior: { condition: 'friendly-group-threshold', timing: 'before-inspection', target: 'inspection-count', duration: 'while-condition-holds', stacking: 'none', activationLimit: 'each-inspection', passBehavior: 're-evaluate', endBehavior: 'persist' }, ui: relicUi('큰 아군 그룹이 확인을 돕는다.', '아군 그룹 크기 조건을 만족할 때 발동한다.', '조건이 유지되는 동안 카드 확인 수를 늘린다.', '연결을 키우며 덱 정보도 얻는다.', '수호석으로 큰 그룹을 지키면 조건을 유지하기 쉽다.') },
  'RELIC-007': { id: 'RELIC-007', name: '순장자의 혼', style: '희생', behavior: { condition: 'friendly-special-stone-captured', timing: 'after-capture', target: 'next-draw', duration: 'next-draw', stacking: 'unique-source', activationLimit: 'once-per-source-per-move', passBehavior: 'preserve-pending', endBehavior: 'clear-pending' }, ui: relicUi('특수돌의 희생을 다음 드로우로 잇는다.', '아군 특수돌이 상대 착수로 잡혔을 때 발동한다.', '다음 드로우에 한 번 영향을 주고 사라진다.', '가치 있는 버림돌로 손해를 회수한다.', '희생석과 함께 포획당한 뒤 손패 이득을 키운다.') },
  'RELIC-009': { id: 'RELIC-009', name: '푸른 실타래', style: '연결', behavior: { condition: 'connect-distinct-friendly-groups', timing: 'after-placement', target: 'player-deck', duration: 'move', stacking: 'unique-source', activationLimit: 'once-per-move', passBehavior: 'does-not-trigger', endBehavior: 'persist' }, ui: relicUi('서로 다른 아군 그룹 연결에 보상한다.', '한 착수로 두 아군 그룹을 이었을 때 발동한다.', '착수당 한 번 플레이어 덱에 이득을 준다.', '끊긴 돌을 연결하는 수를 우선한다.', '수호석으로 연결하며 위기 그룹도 함께 지킨다.') },
  'RELIC-010': { id: 'RELIC-010', name: '부러진 자', style: '활로', behavior: { condition: 'rescue-endangered-group', timing: 'after-placement', target: 'player-hand', duration: 'move', stacking: 'unique-source', activationLimit: 'once-per-move', passBehavior: 'does-not-trigger', endBehavior: 'persist' }, ui: relicUi('위기 그룹 구조에 손패 보상을 준다.', '착수로 위험한 아군 그룹을 살렸을 때 발동한다.', '착수당 한 번 손패에 이득을 준다.', '공격보다 구조 수의 가치를 높인다.', '수호석으로 위기 그룹 옆에 두면 조건을 노리기 좋다.') },
  'RELIC-013': { id: 'RELIC-013', name: '상인의 주판', style: '경제', behavior: { condition: 'cheapest-shop-offer', timing: 'shop-open', target: 'one-shop-offer', duration: 'shop-visit', stacking: 'none', activationLimit: 'once-per-shop', passBehavior: 'unaffected', endBehavior: 'persist' }, ui: relicUi('상점의 가장 싼 상품을 지원한다.', '상점에 들어갈 때 발동한다.', '방문마다 한 번 가장 저렴한 상품에 혜택을 준다.', '적은 재화로 덱을 꾸준히 개선한다.', '장군석과 금전부로 모은 재화를 효율적으로 쓴다.') },
};

export const RELIC_IDS = Object.freeze(Object.keys(RELIC_DEFINITIONS) as RelicId[]);
