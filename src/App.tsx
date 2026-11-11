import { useEffect, useReducer, useState } from 'react';
import { createDealAction, gameReducer, initialState, type GameState } from './engine/game';
import { shoeStatus } from './engine/presentation';
import { reshuffleThreshold, type HouseRules } from './engine/rules';
import { useAuth } from './auth';
import { loadHouseRules, saveHouseRules } from './houseRulesStorage';
import Controls from './components/Controls';
import Hand from './components/Hand';
import Hint from './components/Hint';
import HouseSettings from './components/HouseSettings';
import AuthPage from './components/AuthPage';
import MainMenu from './components/MainMenu';
import './App.css';

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

const splitStatus = { win: 'Win', lose: 'Lose', push: 'Push', blackjack: 'Win' } as const;

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
  const [state, dispatch] = useReducer(gameReducer, undefined, () => ({ ...initialState, rules: loadHouseRules() }));
  const [screen, setScreen] = useState<Screen>('menu');
  const [logoutError, setLogoutError] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  useEffect(() => { saveHouseRules(state.rules); }, [state.rules]);
  const shoe = shoeStatus(state);
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
            <button type="button" className="button button--secondary" onClick={() => setScreen('menu')}>Main menu</button>
            <HouseSettings rules={state.rules} canEdit={!playing} onChange={rules => dispatch({ type: 'SET_HOUSE_RULES', rules })} />
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

  const controls = (
    <Controls state={state} dispatch={dispatch}
      onDeal={() => dispatch(createDealAction(state.rules))}
      onRebet={() => dispatch(createDealAction(state.rules, 'REBET_AND_DEAL'))} />
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
      <main className="table table--trainer">
        {header}
        {rulesSummary}
        <div className="trainer-layout">
          <section className="trainer-layout__game" aria-label="Practice table">
            <div className="trainer-table">
              {state.phase === 'idle' ? (
                <p className="trainer-table__intro">
                  Deal a hand to practice basic strategy. Use the chart to find the best play, then check yourself with a hint.
                </p>
              ) : (
                <>
                  <Hand title="Dealer" cards={state.dealerHand} hideHoleCard={state.phase === 'playerTurn'} />
                  <PlayerHands state={state} />
                </>
              )}
            </div>
            {controls}
          </section>

          <aside className="trainer-layout__guide" aria-label="Basic strategy guide">
            <Hint key={state.phase} state={state} />
            <div className="trainer-guide__card">
              <h2 className="trainer-guide__heading">How Basic Strategy Works</h2>
              <p className="trainer-guide__intro">
                Basic Strategy is the mathematically optimal way to play every hand in Blackjack based on
                millions of simulated hands. To use the chart, find the <strong>Dealer&apos;s Upcard</strong>{' '}
                along the top row and match it with your hand type on the vertical axis:
              </p>
              <ul className="trainer-guide__list">
                <li>
                  <strong>Hard Totals (8–17):</strong> Any hand without an Ace, or where the Ace must count as 1
                  to avoid busting. Stand on 12–16 when the dealer shows a weak upcard (2–6, except hit 12 vs 2 or
                  3), and hit when the dealer shows 7 through Ace. Always double on 11!
                </li>
                <li>
                  <strong>Soft Totals (A,2–A,9):</strong> Hands with an Ace counted as 11 (e.g., A,6 is Soft 17).
                  Because you cannot bust on a single hit, play these aggressively—double against weak dealer cards
                  (4–6) or hit to improve low soft totals.
                </li>
                <li>
                  <strong>Pair Splitting (2,2–A,A):</strong> When dealt two cards of the same value. Always split
                  Aces (A,A) and 8s (8,8), and never split 10-value cards (T,T) or 5s (5,5).
                </li>
                <li>
                  <strong>Surrender &amp; Insurance:</strong> Only surrender Hard 16 vs. 9, 10, or Ace, and Hard
                  15 vs. 10 (if allowed). Never take Insurance or Even Money.
                </li>
              </ul>
              <div className="trainer-guide__legend">
                <span className="legend-badge legend-badge--h">H = Hit</span>
                <span className="legend-badge legend-badge--s">S = Stand</span>
                <span className="legend-badge legend-badge--d">D = Double (or Hit)</span>
                <span className="legend-badge legend-badge--ds">Ds = Double (or Stand)</span>
              </div>
              <div className="trainer-guide__chart-wrapper">
                <img
                  src="/basic-strategy-chart.png"
                  alt="Blackjack Basic Strategy Chart showing Hard Totals, Soft Totals, Pair Splitting, and Surrender rules"
                  className="trainer-guide__chart-img"
                />
              </div>
            </div>
          </aside>
        </div>
      </main>
    );
  }

  return (
    <main className="table">
      {header}
      {rulesSummary}
      <div className="game-layout">
        <section className="casino-scene" aria-label="Blackjack table">
          <div className="casino-table-wood">
            <div className="casino-table-felt">
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
                {state.phase !== 'idle' ? <Hand title="Dealer" cards={state.dealerHand} hideHoleCard={state.phase === 'playerTurn'} /> : (
                  <div className="empty-hand"><span>Dealer</span><div className="empty-hand__cards" aria-hidden="true"><i /><i /></div></div>
                )}
              </div>
              <div className="felt-lettering" aria-hidden="true">
                <svg viewBox="0 0 600 80"><defs><path id="blackjack-curve" d="M 35 20 Q 300 110 565 20" /></defs>
                  <text><textPath href="#blackjack-curve" startOffset="50%" textAnchor="middle">{ruleText.felt}</textPath></text>
                </svg>
              </div>
              <div className="player-zone">
                {state.phase !== 'idle' ? <PlayerHands state={state} /> : (
                  <div className="table-welcome"><h2>Your seat is ready.</h2><p>{state.freePlay ? 'Deal a hand to start practicing.' : 'Choose your chips, then deal.'}</p></div>
                )}
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
        <Hint key={state.phase} state={state} />
        {controls}
      </div>
    </main>
  );
}
