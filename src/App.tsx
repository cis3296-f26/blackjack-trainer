import { useEffect, useState } from 'react';
import { createDealAction, initialState, type GameState } from './engine/game';
import { shoeStatus } from './engine/presentation';
import { reshuffleThreshold, type HouseRules } from './engine/rules';
import { useAuth } from './auth';
import { loadAllowNegativeBalance, loadHouseRules, saveAllowNegativeBalance, saveHouseRules } from './houseRulesStorage';
import Controls from './components/Controls';
import Hand from './components/Hand';
import Card from './components/Card';
import Hint from './components/Hint';
import HouseSettings from './components/HouseSettings';
import AuthPage from './components/AuthPage';
import MainMenu from './components/MainMenu';
import './App.css';
import { onFelt, useDealerAnimation } from './dealer/useDealerAnimation';
import TrainerView from './components/TrainerView';

type Screen = 'menu' | 'simulation' | 'trainer';

export default function App() {
  const { currentUser, logout } = useAuth();
  if (!currentUser) return <AuthPage />;
  return <GameTable key={currentUser.uid} userName={currentUser.displayName || currentUser.email || 'Player'} onLogout={logout} />;
}

// Rule text shown above the table and printed on the felt
function describeRules(rules: HouseRules) {
  const doubleOn = rules.doubleOn === 'any' ? 'Double on any two cards'
    : `Double on ${rules.doubleOn === '9-11' ? '9–11' : '10–11'} only`;
  return {
    decks: `${rules.numDecks} ${rules.numDecks === 1 ? 'deck' : 'decks'}`,
    dealer: rules.dealerHitsSoft17 ? 'Dealer hits soft 17' : 'Dealer stands on all 17s',
    payout: `Blackjack pays ${rules.blackjackPayout}`,
    doubleOn,
    felt: `BLACKJACK PAYS ${rules.blackjackPayout.replace(':', ' TO ')}`,
  };
}

const splitStatus = { win: 'Win', lose: 'Lose', push: 'Push', blackjack: 'Win', surrender: 'Surrendered' } as const;

// The player's cards: one hand normally, or each split hand with its bet and status
function PlayerHands({ state }: { state: GameState }) {
  if (state.splitHands.length === 0) return <Hand title="You" cards={state.playerHand} />;
  return (
    <div className="split-hands" aria-label="Split hands">
      {state.splitHands.map((hand, index) => {
        const active = state.phase === 'playerTurn' && state.activeHandIndex === index;
        const status = hand.result ? splitStatus[hand.result]
          : hand.complete ? 'Finished' : active ? 'Your turn' : 'Waiting';
        return (
          <div key={index} className={`split-hand${active ? ' split-hand--active' : ''}`}
            aria-current={active ? 'step' : undefined}>
            <Hand fromSplit cards={hand.cards} title={`Hand ${index + 1}${active ? ' — Playing' : ''}`} />
            <p className="split-hand__status">{!state.freePlay && `$${hand.bet} · `}{status}</p>
          </div>
        );
      })}
    </div>
  );
}

export function GameTable({ userName, onLogout }: { userName: string; onLogout: () => Promise<void> }) {
    const [state, setGameState] = useState<GameState>(() => ({
    ...initialState,
    rules: loadHouseRules(),
    allowNegativeBalance: loadAllowNegativeBalance(),
  }));
  const [screen, setScreen] = useState<Screen>('menu');
  const [logoutError, setLogoutError] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  useEffect(() => { saveHouseRules(state.rules); }, [state.rules]);
    const baseShoe = shoeStatus(state);
  const { feltRef, view, play } = useDealerAnimation(
    state,
    setGameState,
    baseShoe.remaining,
  );

  const table = view?.table ?? state;
  const holeDown = view?.holeDown ?? (state.phase === 'playerTurn');
  const remaining = view?.remaining ?? baseShoe.remaining;

  const shoe = {
    ...baseShoe,
    remaining,
    remainingPercent: (remaining / baseShoe.total) * 100,
    discarded:
      view?.discarded ??
      Math.max(0, baseShoe.total - remaining - onFelt(state)),
    reshuffleNext: remaining < reshuffleThreshold(state.rules),
  };

  useEffect(() => { saveAllowNegativeBalance(state.allowNegativeBalance); }, [state.allowNegativeBalance]);
  const playing = state.phase === 'playerTurn' || state.phase === 'dealerTurn';
  const shownBet = state.currentBet;
  const ruleText = describeRules(state.rules);

  async function handleLogout() {
    setLoggingOut(true);
    setLogoutError('');
    try { await onLogout(); }
    catch { setLogoutError('Could not log out. Please try again.'); setLoggingOut(false); }
  }

  const header = (
    <header className="app-header">
      <h1><span className="app-header__suit" aria-hidden="true">♠</span> {screen === 'trainer' ? 'Basic Strategy Trainer' : 'Blackjack Trainer'}</h1>
      <nav className="app-header__actions" aria-label="Table and account">
        {screen !== 'menu' && (
          <>
            <button
              type="button"
              className="button button--secondary"
              disabled={!!view}
              onClick={() => setScreen('menu')}
            >
              Main menu
            </button>

            <HouseSettings
              rules={state.rules}
              canEdit={!playing && !view}
              onChange={rules => play({ type: 'SET_HOUSE_RULES', rules })}
              allowNegativeBalance={state.allowNegativeBalance}
              onAllowNegativeBalanceChange={enabled =>
                play({ type: 'SET_NEGATIVE_BALANCE', enabled })
              }
            />
          </>
        )}
        <details className="account-menu" onKeyDown={event => {
          if (event.key === 'Escape') {
            event.currentTarget.open = false;
            event.currentTarget.querySelector('summary')?.focus();
          }
        }}>
          <summary>Account</summary>
          <div className="account-menu__panel">
            <span className="eyebrow">SIGNED IN AS</span>
            <p>{userName}</p>
            <button type="button" className="button button--secondary" disabled={loggingOut} onClick={handleLogout}>{loggingOut ? 'Logging out…' : 'Log out'}</button>
            {logoutError && <p role="alert">{logoutError}</p>}
          </div>
        </details>
      </nav>
    </header>
  );

  const rulesSummary = (
    <div className="table-rules-summary">
      <span>{ruleText.decks}</span>
      <span>{ruleText.dealer}</span>
      <span>{ruleText.payout}</span>
      <span>{ruleText.doubleOn}</span>
    </div>
  );

    const controls = view ? (
    <p className="dealer-status" role="status">
      Dealer is handling the cards…
    </p>
  ) : (
    <Controls
      state={state}
      dispatch={play}
      onDeal={() => play(createDealAction(state.rules))}
      onRebet={() => play(createDealAction(state.rules, 'REBET_AND_DEAL'))}
    />
  );

  if (screen === 'menu') {
    return (
      <main className="table table--menu">
        {header}
        <MainMenu onStartSimulation={() => setScreen('simulation')} onStartTrainer={() => setScreen('trainer')} />
      </main>
    );
  }

  if (screen === 'trainer') {
    return (
      <TrainerView
        state={state}
        header={header}
        rulesSummary={rulesSummary}
        playerHands={<PlayerHands state={state} />}
        renderControls={(wrapDispatch) => {
          const trainerPlay = wrapDispatch(play);
          return view ? (
            <p className="dealer-status" role="status">
              Dealer is handling the cards…
            </p>
          ) : (
            <Controls
              state={state}
              dispatch={trainerPlay}
              onDeal={() => trainerPlay(createDealAction(state.rules))}
              onRebet={() => trainerPlay(createDealAction(state.rules, 'REBET_AND_DEAL'))}
            />
          );
        }}
      />
    );
  }

  return (
    <main className="table">
      {header}
      {rulesSummary}
      <div className="game-layout">
        <section className="casino-scene" aria-label="Blackjack table">
          <div className="casino-table-wood">
                        <div
              className="casino-table-felt"
              ref={feltRef}
              data-dealing={view ? true : undefined}
            >
              {view?.flight && (
                <div className="dealer-flight-source" hidden aria-hidden="true">
                  <Card
                    card={view.flight.card}
                    faceDown={view.flight.faceDown}
                  />
                </div>
              )}

              <div className="casino-top-equipment" aria-hidden="true">
                <div className="discard-holder">
                  <div className="discard-acrylic-box"><div className="discard-card-stack" style={{ height: `${shoe.discarded / shoe.total * 100}%` }} /></div>
                  <div className="discard-wood-base" />
                </div>
                <div className="dealer-chip-tray">
                  {['red', 'red-short', 'orange', 'blue', 'green', 'white-red', 'white-red-full', 'white-red-full', 'white-blue', 'white-black'].map((color, index) => <div key={index} className={`chip-tube tube--${color}`} />)}
                </div>
                <div className="black-dealing-shoe">
                  <div className="shoe-3d-body"><div className="shoe-top-lid" /><div className="shoe-front-plate"><div className="shoe-finger-cutout">
                    <div className="shoe-visible-cards" style={{ height: `${shoe.remainingPercent}%` }} />
                    <div className="shoe-cut-marker" style={{ bottom: `${shoe.cutPercent}%` }} />
                  </div></div></div>
                </div>
              </div>
                            <div className="dealer-zone">
                {table.dealerHand.length > 0 ? (
                  <Hand
                    title="Dealer"
                    cards={table.dealerHand}
                    hideHoleCard={holeDown}
                  />
                ) : (
                  <div className="empty-hand">
                    <span>Dealer</span>
                    <div className="empty-hand__cards" aria-hidden="true">
                      <i />
                      <i />
                    </div>
                  </div>
                )}
              </div>
              <div className="felt-lettering" aria-hidden="true">
                <svg viewBox="0 0 600 80"><defs><path id="blackjack-curve" d="M 35 20 Q 300 110 565 20" /></defs>
                  <text><textPath href="#blackjack-curve" startOffset="50%" textAnchor="middle">{ruleText.felt}</textPath></text>
                </svg>
              </div>
              <div className="player-zone">
                {table.playerHand.length > 0 ? (
                  <PlayerHands state={table} />
                ) : table.phase === 'idle' ? (
                  <div className="table-welcome">
                    <h2>Your seat is ready.</h2>
                    <p>
                      {table.freePlay
                        ? 'Deal a hand to start practicing.'
                        : 'Choose your chips, then deal.'}
                    </p>
                  </div>
                ) : null}
              </div>
              <div className="table-bet" aria-hidden="true">
                {state.freePlay ? <span>FREE PLAY</span> : shownBet > 0 ? <div className="table-bet__chip">${shownBet}</div> : <span>{state.phase === 'done' ? 'HAND COMPLETE' : 'YOUR BET'}</span>}
              </div>
            </div>
          </div>
          <div className="shoe-summary">
            <span>Shoe <strong>{shoe.remaining} / {shoe.total}</strong></span>
            <span>{shoe.discarded} discarded</span>
            <span>{shoe.reshuffleNext ? 'Reshuffles next hand' : `Reshuffles below ${reshuffleThreshold(state.rules)} cards`}</span>
          </div>
        </section>
        {!view && <Hint key={state.phase} state={state} />}
        {controls}
      </div>

      <Controls
        phase={state.phase}
        balance={state.balance}
        currentBet={state.currentBet}
        bailoutTriggered={state.bailoutTriggered}
        freePlay={state.freePlay}
        onToggleFreePlay={(enabled) => dispatch({ type: "SET_FREE_PLAY", enabled })}
        onPlaceBet={(amount) => dispatch({ type: "PLACE_BET", amount })}
        onClearBet={() => dispatch({ type: "CLEAR_BET" })}
        onDeal={() => dispatch(createDealAction(state.rules))}
        onHit={() => dispatch({ type: "HIT" })}
        onStand={() => dispatch({ type: "STAND" })}
        onDouble={() => dispatch({ type: "DOUBLE" })}
        canDouble={doubleAvailable}
      />
    </main>
  );
}
