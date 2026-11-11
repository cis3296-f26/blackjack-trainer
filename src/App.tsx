import { useEffect, useReducer, useState } from 'react';
import { createDealAction, gameReducer, initialState } from './engine/game';
import { shoeStatus } from './engine/presentation';
import { reshuffleThreshold } from './engine/rules';
import { useAuth } from './auth';
import { loadHouseRules, saveHouseRules } from './houseRulesStorage';
import Controls from './components/Controls';
// import TrainerControls from './components/TrainerControls'
import Hand from './components/Hand';
import Hint from './components/Hint';
import HouseSettings from './components/HouseSettings';
import AuthPage from './components/AuthPage';
import './App.css';
import MainMenu from './components/MainMenu';

export default function App() {
  const { currentUser, logout } = useAuth();
  if (!currentUser) return <AuthPage />;
  return <GameTable key={currentUser.uid} userName={currentUser.displayName || currentUser.email || 'Player'} onLogout={logout} />;
}

export function GameTable({ userName, onLogout }: { userName: string; onLogout: () => Promise<void> }) {
  const [state, dispatch] = useReducer(gameReducer, undefined, () => ({ ...initialState, rules: loadHouseRules() }));
  const [logoutError, setLogoutError] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  useEffect(() => { saveHouseRules(state.rules); }, [state.rules]);
  const shoe = shoeStatus(state);
  const playing = state.phase === 'playerTurn' || state.phase === 'dealerTurn';
  const shownBet = state.currentBet;

  async function handleLogout() {
    setLoggingOut(true);
    setLogoutError('');
    try { await onLogout(); }
    catch { setLogoutError('Could not log out. Please try again.'); setLoggingOut(false); }
  }
  
  if (!inSimulation && !inTrainer) {
    return (
      <>
        <div className="app__user-bar">
          <span className="app__user-name">
            {currentUser.displayName || currentUser.email}
          </span>
          <button type="button" className="app__logout" onClick={logout}>
            Log Out
          </button>
        </div>
        <MainMenu 
          onStartSimulation={() => setInSimulation(true)} 
          onStartTrainer={trainerClicked}
         />
      </>
    )
  }

  return (
    <main className="table">
      <header className="app-header">
        <h1><span className="app-header__suit" aria-hidden="true">♠</span> Blackjack Trainer</h1>
        <nav className="app-header__actions" aria-label="Table and account">
          <HouseSettings rules={state.rules} canEdit={!playing} onChange={rules => dispatch({ type: 'SET_HOUSE_RULES', rules })} />
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
      <div className="table-rules-summary">
        <span>{state.rules.numDecks} {state.rules.numDecks === 1 ? 'deck' : 'decks'}</span>
        <span>Dealer stands on 17</span>
        <span>Blackjack pays 3:2</span>
      </div>
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
                  <text><textPath href="#blackjack-curve" startOffset="50%" textAnchor="middle">BLACKJACK PAYS 3 TO 2</textPath></text>
                </svg>
              </div>
              <div className="player-zone">
                {state.phase !== 'idle' ? <Hand title="You" cards={state.playerHand} /> : (
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
        <Controls state={state} dispatch={dispatch}
          onDeal={() => dispatch(createDealAction(state.rules))}
          onRebet={() => dispatch(createDealAction(state.rules, 'REBET_AND_DEAL'))} />
      </div>
    </main>
  );
}
