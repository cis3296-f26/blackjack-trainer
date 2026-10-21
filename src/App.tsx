import { useReducer } from 'react';
import { createDealAction, gameReducer, initialState } from './engine/game';
import Controls from './components/Controls';
import Hand from './components/Hand';
import Hint from './components/Hint';
import ResultBanner from './components/ResultBanner';
import './App.css';

// Top-level screen: owns the game state and passes pieces of it down to components
export default function App() {
  const [state, dispatch] = useReducer(gameReducer, initialState);

  // The dealer's hole card stays face down until the player stands or busts
  const hideHoleCard = state.phase === 'playerTurn';

  return (
    <main className="table">
      <Hint />
      <h1 className="table__title">Blackjack Trainer</h1>

      {state.phase === 'idle' ? (
        <p className="table__hint">Press Deal to start a hand.</p>
      ) : (
        <>
          <Hand title="Dealer" cards={state.dealerHand} hideHoleCard={hideHoleCard} />
          <Hand title="You" cards={state.playerHand} />
        </>
      )}

      <ResultBanner result={state.result} />

      <Controls
        phase={state.phase}
        onDeal={() => dispatch(createDealAction())}
        onHit={() => dispatch({ type: 'HIT' })}
        onStand={() => dispatch({ type: 'STAND' })}
      />
    </main>
  );
}
