import { useCallback, useEffect, useState } from 'react';
import { BoardSvg } from './components/BoardSvg';
import { MapGraph } from './components/MapGraph';
import { useAiTurn } from './hooks/useAiTurn';
import { useGameMusic } from './hooks/useGameMusic';
import { AudioControls } from './components/AudioControls';
import {
  GameProvider,
  useGame,
  type GameConfig,
  type GameScreen,
  type GameState,
} from './game/GameProvider';
import { STONE_DEFINITIONS } from './game/content/stones';
import { CHARM_DEFINITIONS, type CharmId } from './game/content/charms';
import { RELIC_DEFINITIONS, type RelicId } from './game/content/relics';
import { removalPrice } from './game/economy';
import { describeRewardCandidate } from './game/rewards';
import { ENEMY_DEFINITIONS } from './game/content/enemies';
import { type MapNode, type MapNodeType } from './game/map';
import type { MusicRoute } from './audio';

const NODE_NAMES: Readonly<Record<MapNodeType, string>> = {
  battle: '일반전',
  elite: '정예전',
  shop: '상점',
  event: '사건',
  dojo: '도장',
  shrine: '사당',
  boss: '보스전',
};

export interface DeployMeta {
  readonly target: 'production' | 'preview';
  readonly playtest: boolean;
}

function musicRoute(screen: GameScreen, boss: boolean, revival: boolean): MusicRoute {
  if (screen === 'battle') {
    if (revival) return 'revival';
    return boss ? 'boss' : 'battle';
  }
  return screen;
}

function nodeDescription(node: MapNode): string {
  if (node.enemyId) return ENEMY_DEFINITIONS[node.enemyId].name;
  if (node.eventId) return `사건 ${node.eventId}`;
  if (node.type === 'shop') return '돌과 부적';
  if (node.type === 'dojo') return '덱 다듬기';
  return '잠시 숨을 고른다';
}

function MapScreen() {
  const { state, dispatch } = useGame();
  return <main className="screen" data-screen="map">
    <header className="screen-heading">
      <div><p className="eyebrow">제 {state.run.act}막 · {state.run.boardSize}×{state.run.boardSize}</p><h1>길을 고르세요</h1></div>
      <span className="currency">냥 {state.run.currency}</span>
    </header>
    <p className="lead">실제 생성된 지도 노드는 전투와 쉼을 지나 막의 문지기로 이어집니다.</p>
    <MapGraph
      map={state.map}
      completedNodeIds={state.completedNodeIds}
      classNameFor={(node) => node.type === 'battle' ? 'battle-node' : node.type === 'elite' ? 'elite-node' : node.type === 'boss' ? 'boss-node' : ''}
      renderLabel={(node) => <><b>{NODE_NAMES[node.type]} · {node.column + 1}</b><span>{nodeDescription(node)}</span></>}
      onOpenNode={(node) => dispatch({ type: 'OPEN_NODE', node })}
    />
  </main>;
}

function BattleScreen({ thinking }: { readonly thinking: boolean }) {
  const { state, dispatch } = useGame();
  const battle = state.battle;
  if (battle === null) return null;
  const deck = battle.decks.B;
  const selected = deck.hand.find(({ id }) => id === battle.selectedCardId);
  const occupied = battle.board.points.reduce((counts, stone) => {
    if (stone?.color === 'B') counts.B += 1;
    if (stone?.color === 'W') counts.W += 1;
    return counts;
  }, { B: 0, W: 0 });
  const majority = Math.ceil(battle.board.points.length / 2);
  const protectedInstanceIds = new Set(battle.protections.flatMap(({ memberInstanceIds }) => memberInstanceIds));
  const protectedPoints = battle.board.points.flatMap((stone, point) => stone !== null && protectedInstanceIds.has(stone.instanceId) ? [point] : []);
  const enemyLabel = state.battleKind === 'boss' ? `제 ${state.run.act}막 문지기` : state.battleKind === 'elite' ? '정예 기객' : '길 위의 기객';
  const canAct = battle.turn === 'B' && !thinking && state.pendingInspection === null;
  const inspection = state.pendingInspection;
  const latestEffect = state.effectLog.at(-1)?.message ?? null;
  return <main className="screen battle-screen" data-screen="battle">
    <header className="screen-heading compact">
      <div>
        <p className="eyebrow">{state.battleKind === 'boss' ? '보스 대국' : state.battleKind === 'elite' ? '정예 대국' : '일반 대국'}{battle.revivalStage === 2 ? ' · 부활 2단계' : ''}</p>
        <h1>{enemyLabel}</h1>
      </div>
      <span className="currency">냥 {state.run.currency}</span>
    </header>
    <section className="enemy-card" aria-label="상대 정보">
      <div className="enemy-avatar" aria-hidden="true">敵</div>
      <div><b>{battle.enemy.id}</b><p>{state.battleKind === 'elite' ? '공격 기풍' : state.battleKind === 'boss' ? '부활 기풍' : '영역 기풍'} · AI가 합법 후보를 평가해 카드와 좌표를 고릅니다.</p></div>
    </section>
    <div className="battle-stats">
      <span>내 덱 {state.run.deck.length}</span>
      <span>뽑기 {deck.drawPile.length}</span>
      <span>버림 {deck.discardPile.length}</span>
      <span>부적 {battle.charms.B.length}</span>
      <span>유물 {battle.relics.B.length}</span>
      <span>연속 패스 {battle.consecutivePasses}</span>
      <span>포획 {state.captures.B}</span>
      <span>점유 흑 {occupied.B} · 백 {occupied.W} / {majority}</span>
    </div>
    <details className="deck-summary"><summary>덱 구성 {state.run.deck.length}장</summary><p>{state.run.deck.map((kind) => STONE_DEFINITIONS[kind].name).join(' · ')}</p></details>
    <BoardSvg
      size={battle.board.size}
      points={battle.board.points}
      disabled={!canAct}
      invalidPoint={state.invalidPoint}
      protectedPoints={protectedPoints}
      onMove={(point) => dispatch({ type: 'CHOOSE_POINT', point })}
    />
    <p className={`turn-line ${state.invalidReason ? 'invalid' : ''}`} role="status">
      {state.invalidReason
        || (thinking ? '상대가 합법 수를 평가하고 있습니다…'
          : battle.phase === 'pre-move' ? '부적·유물을 사용하거나 카드를 바로 고르세요.'
          : selected ? `${STONE_DEFINITIONS[selected.kind].name} 좌표를 누르면 즉시 착수합니다.` : '카드를 고르고 교차점을 누르세요.')}
    </p>
    <section className="hand" aria-label={`손패 ${deck.hand.length}장`}>
      {deck.hand.map((card) => {
        const definition = STONE_DEFINITIONS[card.kind];
        return <button
          key={card.id}
          className={`card ${battle.selectedCardId === card.id ? 'selected' : ''}`}
          data-stone-class={definition.ui.classKey}
          aria-pressed={battle.selectedCardId === card.id}
          onClick={() => dispatch({ type: 'SELECT_CARD', cardId: card.id })}
          disabled={!canAct || (battle.phase !== 'pre-move' && battle.phase !== 'choose-card' && battle.phase !== 'choose-point')}
        >
          <span className="card-icon" aria-hidden="true">{definition.ui.icon}</span>
          <strong>{definition.name}</strong>
          <small>{definition.ui.summary}</small>
        </button>;
      })}
    </section>
    {selected && <section className="card-detail" aria-label="선택 카드 상세">
      <h2>{STONE_DEFINITIONS[selected.kind].name}</h2>
      <p><b>발동 조건</b> {STONE_DEFINITIONS[selected.kind].ui.condition}</p>
      <p><b>실제 효과</b> {STONE_DEFINITIONS[selected.kind].ui.effect}</p>
      <p><b>전략</b> {STONE_DEFINITIONS[selected.kind].ui.strategy}</p>
    </section>}
    {inspection && <section className="effect-panel inspection-panel" aria-label={inspection.kind === 'scout' ? '척후 정찰' : '기병 교환'}>
      <h2>{inspection.kind === 'scout' ? '척후 정찰' : '기병 교환'}</h2>
      {inspection.takenCardId === null && <>
        <p>덱에서 가져올 카드 1장을 고르세요.</p>
        <div className="inspection-cards">{inspection.inspected.map((card) => <button key={card.id} data-inspect-card-id={card.id} onClick={() => dispatch({ type: 'INSPECT_TAKE', cardId: card.id })}>{STONE_DEFINITIONS[card.kind].name}</button>)}</div>
      </>}
      {inspection.takenCardId !== null
        && (inspection.kind === 'scout' ? inspection.returnedCardId : inspection.discardedCardId) === null && <>
        <p>{inspection.kind === 'scout' ? '손패에서 덱으로 되돌릴 카드 1장을 고르세요.' : '손패에서 버릴 카드 1장을 고르세요.'}</p>
        <div className="inspection-cards">{[
          ...deck.hand,
          ...inspection.inspected.filter(({ id }) => id === inspection.takenCardId),
        ].map((card) => <button key={card.id} data-inspect-card-id={card.id} onClick={() => dispatch({ type: 'INSPECT_RETURN', cardId: card.id })}>{STONE_DEFINITIONS[card.kind].name}</button>)}</div>
      </>}
      {inspection.kind === 'scout' && inspection.returnedCardId !== null && <>
        <p>덱 위에 놓을 순서를 정하세요. 첫 카드가 가장 먼저 뽑힙니다.</p>
        <ol>{inspection.orderedIds.map((id, index) => {
          const card = [...inspection.inspected, ...deck.hand].find((candidate) => candidate.id === id);
          return <li key={id}>{card ? STONE_DEFINITIONS[card.kind].name : '되돌린 카드'} {index > 0 && <button onClick={() => {
            const orderedIds = [...inspection.orderedIds];
            [orderedIds[index - 1], orderedIds[index]] = [orderedIds[index], orderedIds[index - 1]];
            dispatch({ type: 'REORDER_INSPECTION', orderedIds });
          }}>위로</button>}</li>;
        })}</ol>
      </>}
      <div className="controls">
        <button onClick={() => dispatch({ type: 'CANCEL_INSPECTION' })}>취소</button>
        <button onClick={() => dispatch({ type: 'CONFIRM_INSPECTION' })} disabled={inspection.takenCardId === null || (inspection.kind === 'scout' ? inspection.returnedCardId === null : inspection.discardedCardId === null)}>확정</button>
      </div>
    </section>}
    {battle.charms.B.length > 0 && <section className="relic-actions" aria-label="부적">
      {battle.charms.B.map((charmId) => <button
        key={charmId}
        data-charm-id={charmId}
        onClick={() => dispatch({ type: 'USE_CHARM', charmId: charmId as CharmId })}
        disabled={battle.phase !== 'pre-move'}
      >{CHARM_DEFINITIONS[charmId as CharmId].name} 사용</button>)}
    </section>}
    {battle.relics.B.length > 0 && <section className="relic-actions" aria-label="유물">
      {battle.relics.B.map((relicId) => <button
        key={relicId}
        data-relic-id={relicId}
        onClick={() => dispatch({ type: 'USE_RELIC', relicId })}
        disabled={battle.phase !== 'pre-move' || battle.usedRelicsThisTurn.includes(relicId)}
      >{RELIC_DEFINITIONS[relicId as RelicId]?.name ?? relicId} 사용</button>)}
    </section>}
    {battle.phase === 'pre-move' && <button className="primary" onClick={() => dispatch({ type: 'CONTINUE_TO_MOVE' })}>착수로 진행</button>}
    {latestEffect && <p className="effect-status" role="status">{latestEffect}</p>}
    <section className="effect-panel">
      <h2>효과 기록</h2>
      <ol>
        {[...battle.log.slice(-3).map(({ message }) => message), ...state.effectLog.slice(-3).map(({ message }) => message)].map((entry, index) => <li key={`${entry}-${index}`}>{entry}</li>)}
      </ol>
    </section>
    <div className="controls">
      <button onClick={() => dispatch({ type: 'PASS' })} disabled={!canAct}>패스</button>
      <button onClick={() => dispatch({ type: 'RESIGN' })} disabled={!canAct}>기권</button>
      <button onClick={() => dispatch({ type: 'RETURN_TO_MAP' })}>지도로 물러나기</button>
    </div>
  </main>;
}

function RewardScreen() {
  const { state, dispatch } = useGame();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  if (state.run.pendingCharm !== null) {
    return <main className="screen" data-screen="reward"><p className="eyebrow">부적 교체</p><h1>교체할 부적을 고르세요</h1><div className="choice-grid">
      {state.run.charms.map((charmId, index) => <button key={`${charmId}-${index}`} className="choice-card" onClick={() => dispatch({ type: 'REPLACE_CHARM', index })}><b>{CHARM_DEFINITIONS[charmId].name}</b><span>{CHARM_DEFINITIONS[state.run.pendingCharm!].name}으로 교체</span></button>)}
    </div></main>;
  }
  return <main className="screen" data-screen="reward">
    <p className="eyebrow">대국 보상</p><h1>전리품을 고르세요</h1>
    <div className="choice-grid">
      {(state.run.pendingRewards ?? []).map((candidate) => {
        const detail = describeRewardCandidate(candidate, state.run);
        const expanded = expandedId === candidate.id;
        const detailId = `reward-detail-${candidate.id}`;
        return <article key={candidate.id} className="reward-card" data-candidate-id={candidate.id} data-expanded={expanded}>
          <button
            className="reward-face"
            aria-expanded={expanded}
            aria-controls={detailId}
            onPointerDown={(event) => event.preventDefault()}
            onClick={() => setExpandedId((current) => current === candidate.id ? null : candidate.id)}
            onFocus={() => setExpandedId(candidate.id)}
            onMouseEnter={() => {
              if (window.matchMedia?.('(hover: hover)').matches) setExpandedId(candidate.id);
            }}
          >
            <b>{detail.name}</b><span>{detail.kindLabel} · {detail.summary}</span>
          </button>
          {expanded && <section id={detailId} className="reward-detail" aria-label={`${detail.name} 상세`}>
            <dl>
              <div><dt>효과 요약</dt><dd>{detail.summary}</dd></div>
              <div><dt>발동 조건</dt><dd>{detail.condition}</dd></div>
              <div><dt>실제 효과</dt><dd>{detail.effect}</dd></div>
              <div><dt>전략</dt><dd>{detail.strategy}</dd></div>
              <div><dt>추천 연계</dt><dd>{detail.synergy}</dd></div>
              <div><dt>현재 보유</dt><dd>{detail.ownedCount}개</dd></div>
            </dl>
            <button className="primary reward-select" onClick={() => dispatch({ type: 'CHOOSE_REWARD', candidateId: candidate.id })}>이 보상을 선택</button>
          </section>}
        </article>;
      })}
    </div>
    <button onClick={() => dispatch({ type: 'DECLINE_REWARD' })}>보상을 받지 않는다</button>
  </main>;
}

function ShopScreen() {
  const { state, dispatch, config } = useGame();
  const currentRemovalPrice = removalPrice(config.economy, state.run.removalCount);
  return <main className="screen" data-screen="shop">
    <header className="screen-heading"><div><p className="eyebrow">상점</p><h1>행상인의 돌상자</h1></div><span className="currency">냥 {state.run.currency}</span></header>
    <div className="choice-grid">
      {(state.shop?.offers ?? []).map((offer) => {
        const sold = state.shop?.soldOfferIds.includes(offer.id) ?? false;
        const name = offer.kind === 'stone'
          ? STONE_DEFINITIONS[offer.productId].name
          : offer.kind === 'charm'
            ? CHARM_DEFINITIONS[offer.productId].name
            : RELIC_DEFINITIONS[offer.productId].name;
        if (offer.kind === 'charm' && state.run.charms.length >= 2) {
          return state.run.charms.map((charmId, replaceCharmIndex) => <button key={`${offer.id}-${replaceCharmIndex}`} className="choice-card" disabled={sold || state.run.currency < offer.price} onClick={() => dispatch({ type: 'BUY_OFFER', offerId: offer.id, replaceCharmIndex })}>
            <b>{CHARM_DEFINITIONS[charmId].name} → {name}</b><span>{offer.price}냥</span>
          </button>);
        }
        return <button key={offer.id} className="choice-card" disabled={sold || state.run.currency < offer.price} onClick={() => dispatch({ type: 'BUY_OFFER', offerId: offer.id })}>
          <b>{name}</b><span>{sold ? '판매 완료' : `${offer.price}냥`}</span>
        </button>;
      })}
      {state.run.deck.map((kind, cardIndex) => <button key={`remove-${cardIndex}`} className="choice-card" disabled={state.shop?.removalUsed || state.run.currency < currentRemovalPrice} onClick={() => dispatch({ type: 'REMOVE_SHOP_CARD', cardIndex })}>
        <b>{STONE_DEFINITIONS[kind].name} 제거</b><span>{currentRemovalPrice}냥</span>
      </button>)}
    </div>
    <p className="hint">판매된 상품과 제거는 이번 방문에서 다시 결제되지 않습니다.</p>
    <button onClick={() => dispatch({ type: 'RETURN_TO_MAP' })}>지도로 돌아가기</button>
  </main>;
}

function EventScreen() {
  const { state, dispatch, config } = useGame();
  return <main className="screen" data-screen="event">
    <p className="eyebrow">사건</p><h1>금이 간 바둑판</h1>
    <p className="lead">돌 틈에서 오래된 기보 한 장이 빛납니다.</p>
    <div className="choice-grid">
      <button className="choice-card" onClick={() => dispatch({ type: 'CHOOSE_EVENT', choice: 'scout' })}><b>기보를 읽는다</b><span>다음 상대 정보</span></button>
      <button className="choice-card" onClick={() => dispatch({ type: 'CHOOSE_EVENT', choice: 'currency' })}><b>돌을 챙긴다</b><span>{config.eventCurrencyReward}냥 획득</span></button>
    </div>
    <button onClick={() => dispatch({ type: 'CHOOSE_EVENT', choice: 'leave' })}>조용히 떠난다</button>
  </main>;
}

function DojoScreen() {
  const { state, dispatch, config } = useGame();
  const used = state.dojo?.used ?? false;
  const price = (kind: keyof typeof config.economy.dojoPrices) => state.dojo?.free ? 0 : config.economy.dojoPrices[kind];
  return <main className="screen" data-screen="dojo">
    <p className="eyebrow">도장</p><h1>한 번의 수련</h1>
    <p className="lead">대상 돌과 작업을 함께 선택합니다. 방문마다 한 번만 적용됩니다.</p>
    <div className="dojo-list">
      {state.run.deck.map((kind, cardIndex) => <section key={`${kind}-${cardIndex}`} className="dojo-card">
        <b>{cardIndex + 1}. {STONE_DEFINITIONS[kind].name}</b>
        <div className="controls">
          <button disabled={used || state.run.currency < price('remove')} onClick={() => dispatch({ type: 'USE_DOJO', action: { type: 'remove', cardIndex } })}>제거 · {price('remove')}냥</button>
          <button disabled={used || state.run.currency < price('exchange')} onClick={() => dispatch({ type: 'USE_DOJO', action: { type: 'exchange', cardIndex, replacement: 'STONE-006' } })}>희생석 교환 · {price('exchange')}냥</button>
          <button disabled={used || state.run.currency < price('duplicate')} onClick={() => dispatch({ type: 'USE_DOJO', action: { type: 'duplicate', cardIndex } })}>복제 · {price('duplicate')}냥</button>
        </div>
      </section>)}
    </div>
    <button onClick={() => dispatch({ type: 'RETURN_TO_MAP' })}>지도로 돌아가기</button>
  </main>;
}

function ResultScreen() {
  const { state, dispatch } = useGame();
  const analysis = state.result;
  const won = state.run.status === 'won';
  return <main className="screen result-screen" data-screen="result">
    <div className="result-mark" aria-hidden="true">{won ? '勝' : '敗'}</div>
    <p className="eyebrow">대국 결과</p>
    <h1>{won ? '두 막을 완주했습니다' : '런 패배'}</h1>
    {analysis && <section className="score-card"><h2>점수 분해</h2><dl>
      <div><dt>흑 돌</dt><dd>{analysis.score.black.stones}</dd></div>
      <div><dt>흑 영역</dt><dd>{analysis.score.black.territory}</dd></div>
      <div><dt>백 돌</dt><dd>{analysis.score.white.stones}</dd></div>
      <div><dt>백 영역</dt><dd>{analysis.score.white.territory}</dd></div>
      <div><dt>덤</dt><dd>{analysis.score.komi}</dd></div>
      <div><dt>최종 차</dt><dd>{analysis.score.margin}</dd></div>
      <div><dt>내 포획</dt><dd>{analysis.captures.B}</dd></div>
      <div><dt>상대 포획</dt><dd>{analysis.captures.W}</dd></div>
    </dl></section>}
    <section className="effect-panel"><h2>복기 후보</h2><ol>
      {(analysis?.criticalMoves ?? []).map((move) => <li key={move.id}>{move.id}</li>)}
      {(analysis?.criticalMoves.length ?? 0) === 0 && <li>기록된 착수가 없습니다.</li>}
    </ol></section>
    <button className="primary" onClick={() => dispatch({ type: 'RESTART' })}>새 런 시작</button>
  </main>;
}

function GameShell({ deployMeta }: { readonly deployMeta?: DeployMeta }) {
  const { state, dispatch, config } = useGame();
  useEffect(() => { document.title = 'RoGolike'; }, []);
  const revival = state.battle?.revivalStage === 2;
  const route = musicRoute(state.screen, state.battleKind === 'boss', revival);
  const music = useGameMusic(route, config.audioTuning);
  const performAi = useCallback(() => dispatch({ type: 'AI_TURN' }), [dispatch]);
  const aiTurn = state.screen === 'battle' && state.battle?.turn === 'W';
  const { thinking } = useAiTurn({
    screen: state.screen,
    turn: aiTurn ? 'enemy' : 'player',
    active: state.screen === 'battle',
    onAiTurn: performAi,
  });
  const begin = () => {
    void music.unlock();
    dispatch({ type: 'START_RUN' });
  };

  let content;
  if (state.screen === 'title') content = null;
  else if (state.screen === 'map') content = <MapScreen />;
  else if (state.screen === 'battle') content = <BattleScreen thinking={thinking} />;
  else if (state.screen === 'reward') content = <RewardScreen />;
  else if (state.screen === 'shop') content = <ShopScreen />;
  else if (state.screen === 'event') content = <EventScreen />;
  else if (state.screen === 'dojo') content = <DojoScreen />;
  else content = <ResultScreen />;

  return <div className="app-shell" data-game-engine="integrated">
    <AudioControls music={music} />
    {deployMeta?.playtest === true && <p className="deploy-note" role="note" data-deploy-note="playtest">
      개발 플레이테스트 구성 · 승인된 제품 수치가 아닙니다
    </p>}
    {state.notice && state.screen === 'map' && <p className="notice" role="status">{state.notice}</p>}
    {state.screen === 'title'
      ? <main className="screen title-screen" data-screen="title">
          <p className="eyebrow">돌 한 장, 수 한 번, 달라지는 길</p><div className="title-mark" aria-hidden="true">碁</div><h1>RoGolike</h1>
          <p className="lead">바둑판 위에서 열 장의 덱을 순환시키며 두 막을 건너는 로그라이크 대국</p>
          <button className="primary start-button" onClick={begin}>등반 시작</button><p className="hint">게임 수치는 실행 시 주입된 설정을 사용합니다.</p>
        </main>
      : content}
  </div>;
}

export function App({ config, initialState, deployMeta }: {
  readonly config: GameConfig;
  readonly initialState?: GameState;
  readonly deployMeta?: DeployMeta;
}) {
  return <GameProvider config={config} initialState={initialState}><GameShell deployMeta={deployMeta} /></GameProvider>;
}
