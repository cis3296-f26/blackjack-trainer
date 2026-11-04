import { useMemo, useReducer, useState } from 'react';
import { createDealAction, gameReducer, initialState } from './engine/game';
import { analyzeHand } from './engine/strategy';
import { useAuth } from './AuthContext';

import Controls from './components/Controls';
// import TrainerControls from './components/TrainerControls'
import Hand from './components/Hand';
import Hint from './components/Hint';
import ResultBanner from './components/ResultBanner';
import './App.css';
import AuthPage from './components/AuthPage';
import MainMenu from './components/MainMenu';

// Top-level screen: owns the game state and passes pieces of it down to components
export default function App() {
  const { currentUser, logout }= useAuth();
  const [state, dispatch] = useReducer(gameReducer, initialState);
  const [inSimulation, setInSimulation] = useState(false);
  const [inTrainer, setInTrainer] = useState(false);

  // The dealer's hole card stays face down until the player stands or busts
  const hideHoleCard = state.phase === "playerTurn";

  const analysis = useMemo(
    () =>
      state.phase === 'playerTurn'
        ? analyzeHand(state.playerHand, state.dealerHand[0])
        : null,
    [state.phase, state.playerHand, state.dealerHand],
  );

const simulationClicked = () => {
    setInTrainer(false);
    setInSimulation(true);
  };

  const trainerClicked = () => {
    setInSimulation(false);
    setInTrainer(true);
  };

  const returnToMenu = () => {
    setInSimulation(false);
    setInTrainer(false);
  };

  // Hooks above must run on every render, so the login gate comes after them
  if (!currentUser) {
    return <AuthPage onSuccess={() => {}} />;
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
    <>
    { inSimulation && (
      <main className="table">
        <div className="app__user-bar">
          <span className="app__user-name">
            {currentUser.displayName || currentUser.email}
          </span>
          <button type="button" className="app__logout" onClick={returnToMenu}>
            Main Menu
          </button>
          <button type="button" className="app__logout" onClick={logout}>
            Log Out
          </button>
        </div>

        <Hint analysis={analysis} />
        <h1 className="table__title">Blackjack Trainer</h1>

        {state.phase === "idle" ? (
          <p className="table__hint">Press Deal to start a hand.</p>
        ) : (
          <>
            <Hand
              title="Dealer"
              cards={state.dealerHand}
              hideHoleCard={hideHoleCard}
            />
            <Hand title="You" cards={state.playerHand} />
          </>
        )}

        <ResultBanner result={state.result} />

        <Controls
          phase={state.phase}
          balance={state.balance}
          currentBet={state.currentBet}
          bailoutTriggered={state.bailoutTriggered}
          onPlaceBet={(amount) => dispatch({ type: "PLACE_BET", amount })}
          onClearBet={() => dispatch({ type: "CLEAR_BET" })}
          onDeal={() => dispatch(createDealAction())}
          onHit={() => dispatch({ type: "HIT" })}
          onStand={() => dispatch({ type: "STAND" })}
          onDouble={() => dispatch({ type: "DOUBLE" })}
          canDouble={
            state.phase === "playerTurn" &&
            state.playerHand.length === 2 &&
            state.balance >= state.currentBet
          }
        />
      </main>
    )} 
    { inTrainer && (
      <main className="table table--trainer">
          <div className="app__user-bar">
            <span className="app__user-name">
              {currentUser.displayName || currentUser.email}
            </span>
            <button type="button" className="app__logout" onClick={returnToMenu}>
              Main Menu
            </button>
            <button type="button" className="app__logout" onClick={logout}>
              Log Out
            </button>
          </div>

          <Hint analysis={analysis} />
          <h1 className="table__title">Basic Strategy Trainer</h1>

          <div className="trainer-layout">
            {/* Left Side: Interactive Practice Table */}
            <section className="trainer-layout__game">
              {state.phase === 'idle' ? (
                <p className="table__hint">
                  Place a bet and press Deal to practice Basic Strategy. Use the chart on the right to find the optimal play!
                </p>
              ) : (
                <>
                  <Hand
                    title="Dealer"
                    cards={state.dealerHand}
                    hideHoleCard={hideHoleCard}
                  />
                  <Hand title="You" cards={state.playerHand} />
                </>
              )}

              {/* Live Coaching Banner during Player Turn */}
              {state.phase === 'playerTurn' && analysis && (
                <div className="trainer-coach">
                  <strong>How to read this hand:</strong> Find your hand total on the left axis of the chart and cross-reference it with the Dealer&apos;s upcard (<strong>{state.dealerHand[0]?.rank}</strong>) across the top.
                </div>
              )}

              <ResultBanner result={state.result} />

              <Controls
                phase={state.phase}
                balance={state.balance}
                currentBet={state.currentBet}
                bailoutTriggered={state.bailoutTriggered}
                onPlaceBet={(amount) => dispatch({ type: 'PLACE_BET', amount })}
                onClearBet={() => dispatch({ type: 'CLEAR_BET' })}
                onDeal={() => dispatch(createDealAction())}
                onHit={() => dispatch({ type: "HIT" })}
                onStand={() => dispatch({ type: "STAND" })}
                onDouble={() => dispatch({ type: "DOUBLE" })}
                canDouble={
                  state.phase === 'playerTurn' &&
                  state.playerHand.length === 2 &&
                  state.balance >= state.currentBet
                }
              />
            </section>

            {/* Right Side: Basic Strategy Chart & Explanation */}
            <aside className="trainer-layout__guide">
              <div className="trainer-guide__card">
                <h2 className="trainer-guide__heading">How Basic Strategy Works</h2>
                <p className="trainer-guide__intro">
                  Basic Strategy is the mathematically optimal way to play every hand in Blackjack based on millions of simulated hands. To use the chart, find the <strong>Dealer&apos;s Upcard</strong> along the top row and match it with your hand type on the vertical axis:
                </p>

                <ul className="trainer-guide__list">
                  <li>
                    <strong>Hard Totals (8–17):</strong> Any hand without an Ace, or where the Ace must count as 1 to avoid busting. Stand on 12–16 when the dealer shows a weak upcard (2–6, except hit 12 vs 2 or 3), and hit when the dealer shows 7 through Ace. Always double on 11!
                  </li>
                  <li>
                    <strong>Soft Totals (A,2–A,9):</strong> Hands with an Ace counted as 11 (e.g., A,6 is Soft 17). Because you cannot bust on a single hit, play these aggressively—double against weak dealer cards (4–6) or hit to improve low soft totals.
                  </li>
                  <li>
                    <strong>Pair Splitting (2,2–A,A):</strong> When dealt two cards of the same value. Always split Aces (A,A) and 8s (8,8), and never split 10-value cards (T,T) or 5s (5,5).
                  </li>
                  <li>
                    <strong>Surrender &amp; Insurance:</strong> Only surrender Hard 16 vs. 9, 10, or Ace, and Hard 15 vs. 10 (if allowed). Never take Insurance or Even Money.
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
    )}
  </>
  );
}
