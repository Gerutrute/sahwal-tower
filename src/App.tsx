import { useCallback, useEffect, useMemo, useState } from 'react';
import { BoardSvg, type BoardStone } from './components/BoardSvg';
import { useAiTurn, type Screen } from './hooks/useAiTurn';
import { useGameMusic } from './hooks/useGameMusic';
import type { BoardSize, StoneKind } from './game/types';
import type { MusicRoute } from './audio';

type BattleKind = 'normal' | 'elite' | 'boss';
type Turn = 'player' | 'enemy';

interface HandCard {
  readonly id: string;
  readonly kind: StoneKind;
  readonly name: string;
  readonly effect: string;
}

const CARD_LIBRARY: readonly HandCard[] = [
  { id: 'card-1', kind: 'STONE-001', name: '일반석', effect: '추가 효과 없이 단단히 둔다.' },
  { id: 'card-2', kind: 'STONE-002', name: '척후석', effect: '인접한 빈 곳을 미리 살핀다.' },
  { id: 'card-3', kind: 'STONE-003', name: '수호석', effect: '연결된 아군의 활로를 지킨다.' },
  { id: 'card-4', kind: 'STONE-004', name: '희생석', effect: '포획되면 다음 패를 보충한다.' },
];

const ENEMIES: Readonly<Record<BattleKind, { name: string; style: string; description: string }>> = {
  normal: { name: '갈대 숲 기객', style: '영역 기풍', description: '변을 넓게 차지하며 안전하게 연결한다.' },
  elite: { name: '검은 삿갓', style: '공격 기풍', description: '끊음과 포획을 우선하는 정예 상대다.' },
  boss: { name: '문지기 대국수', style: '부활 기풍', description: '첫 계가 뒤 더 거센 2단계로 되돌아온다.' },
};

function routeFor(screen: Screen, battleKind: BattleKind, revival: boolean): MusicRoute {
  if (screen === 'battle') {
    if (revival) return 'revival';
    return battleKind === 'normal' ? 'battle' : battleKind;
  }
  return screen;
}

function TitleScreen({ start }: { start: () => void }) {
  return <main className="screen title-screen" data-screen="title">
    <p className="eyebrow">돌 한 장, 수 한 번, 달라지는 길</p>
    <div className="title-mark" aria-hidden="true">碁</div>
    <h1>RoGolike</h1>
    <p className="lead">바둑판 위에서 덱을 순환시키며 두 막을 건너는 로그라이크 대국</p>
    <button className="primary start-button" onClick={start}>등반 시작</button>
    <p className="hint">시작 덱은 정해져 있습니다. 선택 없이 바로 지도에 들어갑니다.</p>
  </main>;
}

function MapScreen({ act, currency, open }: {
  act: 1 | 2;
  currency: number;
  open: (screen: Screen, kind?: BattleKind) => void;
}) {
  return <main className="screen" data-screen="map">
    <header className="screen-heading"><div><p className="eyebrow">제 {act}막</p><h1>길을 고르세요</h1></div><span className="currency">냥 {currency}</span></header>
    <p className="lead">모든 길은 전투와 쉼을 지나 막의 문지기로 이어집니다.</p>
    <nav className="map-path" aria-label={`${act}막 지도`}>
      <button className="map-node battle-node" onClick={() => open('battle', 'normal')}><b>일반전</b><span>갈대 숲 기객</span></button>
      <div className="path-branch">
        <button className="map-node" onClick={() => open('event')}><b>사건</b><span>수상한 바둑판</span></button>
        <button className="map-node" onClick={() => open('shop')}><b>상점</b><span>돌과 부적</span></button>
        <button className="map-node" onClick={() => open('dojo')}><b>도장</b><span>덱 다듬기</span></button>
      </div>
      <button className="map-node elite-node" onClick={() => open('battle', 'elite')}><b>정예전</b><span>검은 삿갓</span></button>
      <button className="map-node boss-node" onClick={() => open('battle', 'boss')}><b>보스전 · 9×9</b><span>문지기 대국수</span></button>
    </nav>
  </main>;
}

function BattleScreen({
  size,
  kind,
  points,
  hand,
  selectedCardId,
  previewPoint,
  invalidPoint,
  invalidReason,
  turn,
  thinking,
  consecutivePasses,
  effectLog,
  currency,
  revival,
  selectCard,
  choosePoint,
  pass,
  leave,
}: {
  size: BoardSize;
  kind: BattleKind;
  points: readonly (BoardStone | null)[];
  hand: readonly HandCard[];
  selectedCardId: string | null;
  previewPoint: number | null;
  invalidPoint: number | null;
  invalidReason: string;
  turn: Turn;
  thinking: boolean;
  consecutivePasses: number;
  effectLog: readonly string[];
  currency: number;
  revival: boolean;
  selectCard: (id: string) => void;
  choosePoint: (point: number) => void;
  pass: () => void;
  leave: () => void;
}) {
  const enemy = ENEMIES[kind];
  const selected = hand.find(({ id }) => id === selectedCardId);
  return <main className="screen battle-screen" data-screen="battle">
    <header className="screen-heading compact"><div><p className="eyebrow">{kind === 'boss' ? '보스 대국' : kind === 'elite' ? '정예 대국' : '일반 대국'}{revival ? ' · 부활 2단계' : ''}</p><h1>{enemy.name}</h1></div><span className="currency">냥 {currency}</span></header>
    <section className="enemy-card" aria-label="상대 정보"><div className="enemy-avatar" aria-hidden="true">敵</div><div><b>{enemy.style}</b><p>{enemy.description}</p></div></section>
    <div className="battle-stats"><span>내 덱 6</span><span>버림 {4 - hand.length}</span><span>부적 1</span><span>연속 패스 {consecutivePasses}/2</span></div>
    <BoardSvg size={size} points={points} disabled={turn === 'enemy'} previewPoint={previewPoint} invalidPoint={invalidPoint} onMove={choosePoint} />
    <p className={`turn-line ${invalidReason ? 'invalid' : ''}`} role="status">
      {invalidReason || (thinking ? '상대가 수를 읽고 있습니다…' : selected && previewPoint !== null ? `${selected.name} 미리보기 · 같은 곳을 다시 눌러 확정` : '카드를 고르고 교차점을 누르세요.')}
    </p>
    <section className="hand" aria-label="손패 4장">
      {hand.map((card) => <button key={card.id} className={`card ${selectedCardId === card.id ? 'selected' : ''}`} aria-pressed={selectedCardId === card.id} onClick={() => selectCard(card.id)} disabled={turn === 'enemy'}>
        <span className="card-kind">{card.kind.slice(-1)}</span><strong>{card.name}</strong><small>{card.effect}</small>
      </button>)}
    </section>
    <section className="effect-panel"><h2>효과 기록</h2><ol>{effectLog.slice(-4).map((entry, index) => <li key={`${entry}-${index}`}>{entry}</li>)}</ol></section>
    <div className="controls"><button onClick={pass} disabled={turn === 'enemy'}>패스</button><button onClick={leave}>지도로 물러나기</button></div>
  </main>;
}

function RewardScreen({ choose, decline }: { choose: (name: string) => void; decline: () => void }) {
  return <main className="screen" data-screen="reward"><p className="eyebrow">대국 보상</p><h1>전리품을 고르세요</h1><div className="choice-grid">
    {['연화 척후석', '비호의 부적', '흑요 유물'].map((name, index) => <button key={name} className="choice-card" onClick={() => choose(name)}><b>{name}</b><span>{index === 0 ? '덱에 특수 돌 1장 추가' : index === 1 ? '다음 대국 첫 수를 보호' : '포획 보상 강화'}</span></button>)}
  </div><button onClick={decline}>보상을 받지 않는다</button></main>;
}

function ShopScreen({ currency, buy, leave }: { currency: number; buy: (price: number, name: string) => void; leave: () => void }) {
  return <main className="screen" data-screen="shop"><header className="screen-heading"><div><p className="eyebrow">상점</p><h1>행상인의 돌상자</h1></div><span className="currency">냥 {currency}</span></header>
    <div className="choice-grid">{[['장군석', 60], ['묘수 부적', 45], ['덱에서 돌 제거', 50]].map(([name, price]) => <button key={String(name)} className="choice-card" disabled={currency < Number(price)} onClick={() => buy(Number(price), String(name))}><b>{name}</b><span>{price}냥</span></button>)}</div>
    <p className="hint">상품은 이번 방문에 고정됩니다.</p><button onClick={leave}>지도로 돌아가기</button>
  </main>;
}

function EventScreen({ choose }: { choose: (text: string) => void }) {
  return <main className="screen" data-screen="event"><p className="eyebrow">사건</p><h1>금이 간 바둑판</h1><p className="lead">돌 틈에서 오래된 기보 한 장이 빛납니다.</p><div className="choice-grid"><button className="choice-card" onClick={() => choose('기보를 읽어 다음 상대 정보를 얻었습니다.')}><b>기보를 읽는다</b><span>다음 전투의 기풍 공개</span></button><button className="choice-card" onClick={() => choose('돌을 챙겨 20냥을 얻었습니다.')}><b>돌을 챙긴다</b><span>20냥 획득</span></button></div><button onClick={() => choose('아무것도 건드리지 않았습니다.')}>조용히 떠난다</button></main>;
}

function DojoScreen({ used, train, leave }: { used: boolean; train: (action: string) => void; leave: () => void }) {
  return <main className="screen" data-screen="dojo"><p className="eyebrow">도장</p><h1>한 번의 수련</h1><p className="lead">방문마다 한 가지 작업만 할 수 있습니다.</p><div className="choice-grid">{['돌 1장 제거', '돌 1장 교환', '선택 돌 1장 복제'].map((action) => <button key={action} className="choice-card" disabled={used} onClick={() => train(action)}><b>{action}</b><span>{used ? '이번 방문의 수련을 마쳤습니다' : '비용 40냥'}</span></button>)}</div><button onClick={leave}>지도로 돌아가기</button></main>;
}

function ResultScreen({ decisiveMoves, restart }: { decisiveMoves: readonly string[]; restart: () => void }) {
  return <main className="screen result-screen" data-screen="result"><div className="result-mark" aria-hidden="true">勝</div><p className="eyebrow">대국 결과</p><h1>두 막을 완주했습니다</h1>
    <section className="score-card"><h2>점수 분해</h2><dl><div><dt>돌</dt><dd>18</dd></div><div><dt>영역</dt><dd>21</dd></div><div><dt>덤</dt><dd>+6.5</dd></div><div><dt>최종 차</dt><dd>+4.5</dd></div><div><dt>포획</dt><dd>7</dd></div><div><dt>주요 효과</dt><dd>수호 2회</dd></div></dl></section>
    <section className="effect-panel"><h2>복기 후보</h2><ol>{decisiveMoves.map((move) => <li key={move}>{move}</li>)}</ol></section>
    <button className="primary" onClick={restart}>새 런 시작</button>
  </main>;
}

export function App() {
  const [screen, setScreen] = useState<Screen>('title');
  const [act, setAct] = useState<1 | 2>(1);
  const [currency, setCurrency] = useState(90);
  const [battleKind, setBattleKind] = useState<BattleKind>('normal');
  const [size, setSize] = useState<BoardSize>(7);
  const [points, setPoints] = useState<readonly (BoardStone | null)[]>(Array(49).fill(null));
  const [hand, setHand] = useState<readonly HandCard[]>(CARD_LIBRARY);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [previewPoint, setPreviewPoint] = useState<number | null>(null);
  const [invalidPoint, setInvalidPoint] = useState<number | null>(null);
  const [invalidReason, setInvalidReason] = useState('');
  const [turn, setTurn] = useState<Turn>('player');
  const [passes, setPasses] = useState(0);
  const [effectLog, setEffectLog] = useState<readonly string[]>(['대국이 시작되었습니다.']);
  const [revival, setRevival] = useState(false);
  const [dojoUsed, setDojoUsed] = useState(false);
  const [notice, setNotice] = useState('');
  const [decisiveMoves, setDecisiveMoves] = useState<readonly string[]>(['3행 3열의 연결', '중앙 수호석', '마지막 패스']);

  useEffect(() => { document.title = 'RoGolike'; }, []);
  const musicRoute = routeFor(screen, battleKind, revival);
  const music = useGameMusic(musicRoute);

  const finishBattle = useCallback(() => {
    const candidates = effectLog.filter((entry) => entry.includes('착수')).slice(-3);
    setDecisiveMoves(candidates.length ? candidates : ['첫 카드 선택', '중앙 압박', '마지막 패스']);
    setTurn('player');
    setPasses(0);
    setPreviewPoint(null);
    setSelectedCardId(null);
    if (battleKind === 'boss') {
      if (!revival && act === 1) {
        setRevival(true);
        setEffectLog((log) => [...log, '상대가 부활 2단계에 진입했습니다.']);
        return;
      }
      setAct(2);
      setScreen('result');
      return;
    }
    setCurrency((value) => value + (battleKind === 'elite' ? 45 : 30));
    setScreen('reward');
  }, [act, battleKind, effectLog, revival]);

  const performAi = useCallback(() => {
    setPoints((current) => {
      const point = current.findIndex((stone, index) => stone === null && index !== previewPoint);
      if (point < 0) return current;
      const next = [...current];
      next[point] = { color: 'W', kind: 'STONE-001' };
      setEffectLog((log) => [...log, `상대가 ${Math.floor(point / size) + 1}행 ${point % size + 1}열에 착수했습니다.`]);
      return next;
    });
    setTurn('player');
  }, [previewPoint, size]);
  const { thinking } = useAiTurn({ screen, turn, active: screen === 'battle', onAiTurn: performAi });

  const start = () => {
    void music.unlock();
    setScreen('map');
  };
  const open = (next: Screen, kind: BattleKind = 'normal') => {
    setNotice('');
    setBattleKind(kind);
    if (next === 'battle') {
      const boardSize: BoardSize = kind === 'boss' || act === 2 ? 9 : 7;
      setSize(boardSize);
      setPoints(Array(boardSize * boardSize).fill(null));
      setHand(CARD_LIBRARY);
      setSelectedCardId(null);
      setPreviewPoint(null);
      setInvalidPoint(null);
      setInvalidReason('');
      setEffectLog(['대국이 시작되었습니다.']);
      setTurn('player');
      setPasses(0);
      setRevival(false);
    }
    if (next === 'dojo') setDojoUsed(false);
    setScreen(next);
  };
  const selectCard = (id: string) => {
    setSelectedCardId(id);
    setPreviewPoint(null);
    setInvalidPoint(null);
    setInvalidReason('');
  };
  const choosePoint = (point: number) => {
    if (!selectedCardId) {
      setInvalidPoint(point);
      setInvalidReason('놓을 카드를 먼저 선택하세요.');
      return;
    }
    if (points[point]) {
      setInvalidPoint(point);
      setInvalidReason('이미 돌이 놓인 자리입니다. 다른 교차점을 고르세요.');
      return;
    }
    setInvalidPoint(null);
    setInvalidReason('');
    if (previewPoint !== point) {
      setPreviewPoint(point);
      return;
    }
    const card = hand.find(({ id }) => id === selectedCardId)!;
    setPoints((current) => {
      const next = [...current];
      next[point] = { color: 'B', kind: card.kind };
      return next;
    });
    setEffectLog((log) => [...log, `${card.name}: ${Math.floor(point / size) + 1}행 ${point % size + 1}열 착수 효과를 해결했습니다.`]);
    setPreviewPoint(null);
    setSelectedCardId(null);
    setPasses(0);
    setTurn('enemy');
  };
  const pass = () => {
    const next = passes + 2;
    setPasses(next);
    setEffectLog((log) => [...log, '나와 상대가 연속으로 패스했습니다.']);
    if (next >= 2) finishBattle();
  };

  const screenContent = useMemo(() => {
    if (screen === 'title') return <TitleScreen start={start} />;
    if (screen === 'map') return <MapScreen act={act} currency={currency} open={open} />;
    if (screen === 'battle') return <BattleScreen size={size} kind={battleKind} points={points} hand={hand} selectedCardId={selectedCardId} previewPoint={previewPoint} invalidPoint={invalidPoint} invalidReason={invalidReason} turn={turn} thinking={thinking} consecutivePasses={passes} effectLog={effectLog} currency={currency} revival={revival} selectCard={selectCard} choosePoint={choosePoint} pass={pass} leave={() => setScreen('map')} />;
    if (screen === 'reward') return <RewardScreen choose={(name) => { setNotice(`${name}을 선택했습니다.`); setScreen('map'); }} decline={() => { setNotice('보상을 받지 않았습니다.'); setScreen('map'); }} />;
    if (screen === 'shop') return <ShopScreen currency={currency} buy={(price, name) => { if (currency < price) return; setCurrency((value) => value - price); setNotice(`${name} 구매 완료`); }} leave={() => setScreen('map')} />;
    if (screen === 'event') return <EventScreen choose={(text) => { if (text.includes('20냥')) setCurrency((value) => value + 20); setNotice(text); setScreen('map'); }} />;
    if (screen === 'dojo') return <DojoScreen used={dojoUsed} train={(action) => { if (dojoUsed || currency < 40) return; setCurrency((value) => value - 40); setDojoUsed(true); setNotice(`${action} 수련 완료`); }} leave={() => setScreen('map')} />;
    return <ResultScreen decisiveMoves={decisiveMoves.slice(0, 3)} restart={() => { setAct(1); setCurrency(90); setScreen('title'); }} />;
  }, [screen, act, currency, size, battleKind, points, hand, selectedCardId, previewPoint, invalidPoint, invalidReason, turn, thinking, passes, effectLog, revival, dojoUsed, decisiveMoves]);

  return <div className="app-shell">
    <div className="audio-controls" aria-label="음악 설정">
      <span aria-live="polite">{music.track === 'overworld' ? '여정 음악' : music.track === 'battle' ? '전투 음악' : music.track === 'boss' ? '보스 음악' : '상점 음악'}</span>
      <button aria-label={music.snapshot.muted ? '음악 켜기' : '음악 끄기'} onClick={() => { if (!music.snapshot.unlocked) void music.unlock(); else music.setMuted(!music.snapshot.muted); }}>{music.snapshot.muted ? '음악 켜기' : '음악 끄기'}</button>
    </div>
    {notice && screen === 'map' && <p className="notice" role="status">{notice}</p>}
    {screenContent}
  </div>;
}
