import { useMemo, useReducer } from 'react';
import { canDouble, createDealAction, gameReducer, initialState } from './engine/game';
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

  // Hooks above must run on every render, so the login gate comes after them
  if (!currentUser) {
    return <AuthPage onSuccess={() => {}} />;
  }

  return (
    <main className="table">
      <div className="app__user-bar">
        <span className="app__user-name">
          {currentUser.displayName || currentUser.email}
        </span>
        <button type="button" className="app__logout" onClick={logout}>
          Log Out
        </button>
      </div>

      <Hint analysis={analysis} />
      <h1 className="table__title">Blackjack Trainer</h1>

      {state.phase === "idle" ? (
        <p className="table__hint">
          {state.freePlay
            ? "Press Deal to start a hand."
            : "Place a bet, then press Deal."}
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

      <ResultBanner result={state.result} />

      <Controls
        phase={state.phase}
        balance={state.balance}
        currentBet={state.currentBet}
        bailoutTriggered={state.bailoutTriggered}
        freePlay={state.freePlay}
        onToggleFreePlay={(enabled) => dispatch({ type: "SET_FREE_PLAY", enabled })}
        onPlaceBet={(amount) => dispatch({ type: "PLACE_BET", amount })}
        onClearBet={() => dispatch({ type: "CLEAR_BET" })}
        onDeal={() => dispatch(createDealAction())}
        onHit={() => dispatch({ type: "HIT" })}
        onStand={() => dispatch({ type: "STAND" })}
        onDouble={() => dispatch({ type: "DOUBLE" })}
        canDouble={canDouble(state)}
      />
    </main>
  );
}
