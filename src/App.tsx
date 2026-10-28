import { useMemo, useReducer } from 'react';
import { createDealAction, gameReducer, initialState } from './engine/game';
import { analyzeHand } from './engine/strategy';
import { useAuth } from './AuthContext';

import Controls from './components/Controls';
import Hand from './components/Hand';
import Hint from './components/Hint';
import ResultBanner from './components/ResultBanner';
import './App.css';
import AuthPage from './components/AuthPage';

// Top-level screen: owns the game state and passes pieces of it down to components
export default function App() {
  const { currentUser, logout }= useAuth();

  if (!currentUser) {
    return <AuthPage onSuccess={() => {}} />;
  }
  const [state, dispatch] = useReducer(gameReducer, initialState);

  // The dealer's hole card stays face down until the player stands or busts
  const hideHoleCard = state.phase === "playerTurn";

  const analysis = useMemo(
  () =>
    state.phase === 'playerTurn'
      ? analyzeHand(state.playerHand, state.dealerHand[0])
      : null,
  [state.phase, state.playerHand, state.dealerHand],
);

  return (
    <main className="table">
      <Hint analysis={analysis} />
      <div className="app__user-bar">
        <span className="app__user-name">
          {currentUser.displayName || currentUser.email}
        </span>
        <button type="button" className="app__logout" onClick={logout}>
          Log Out
        </button>
      </div>

      <Hint />
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
        onPlaceBet={(amount) => dispatch({ type: 'PLACE_BET', amount })}
        onClearBet={() => dispatch({ type: 'CLEAR_BET' })}
        onDeal={() => dispatch(createDealAction())}
        onHit={() => dispatch({ type: "HIT" })}
        onStand={() => dispatch({ type: "STAND" })}
        onDouble={() => dispatch({ type: "DOUBLE" })}
      />
    </main>
  );
}
