import { useMemo, useReducer } from 'react';
import { canDouble, createDealAction, gameReducer, initialState } from './engine/game';
import { CUT_CARD_THRESHOLD, DEFAULT_SHOE_DECKS } from './engine/shoe';
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

  const totalShoeCards = DEFAULT_SHOE_DECKS * 52; // 312
  const cardsRemaining = state.deck.length > 0 ? state.deck.length : totalShoeCards;
  const shoePercent = Math.max(0, Math.min(100, Math.round((cardsRemaining / totalShoeCards) * 100)));

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

      <div className="casino-table-outer">
        <div className="casino-wood-rail">
          <div className="casino-felt">
            {/* Top-Right 6-Deck Shoe Case */}
            <div className="table-top-row">
              <div
                className="shoe-case"
                title={`${cardsRemaining} / ${totalShoeCards} cards left (Reshuffles at ${CUT_CARD_THRESHOLD})`}
              >
                <div className="shoe-label">6-DECK SHOE</div>
                <div className="shoe-window">
                  <div className="shoe-card-stack" style={{ height: `${shoePercent}%` }} />
                  <div className="shoe-cut-card" title="Cut Card (75% Penetration)" />
                </div>
                <div className="shoe-counter">
                  {cardsRemaining} <span>/ {totalShoeCards}</span>
                </div>
              </div>
            </div>

            {/* Curved Casino Felt Markings */}
            <svg
              className="felt-markings-svg"
              viewBox="0 0 900 300"
              preserveAspectRatio="xMidYMid meet"
              aria-hidden="true"
            >
              <defs>
                <path id="bjArc" d="M 160,95 Q 450,225 740,95" />
                <path id="rulesArc" d="M 200,140 Q 450,250 700,140" />
              </defs>
              <path
                d="M 130,75 Q 450,220 770,75"
                fill="none"
                stroke="rgba(212, 175, 55, 0.35)"
                strokeWidth="2.5"
              />
              <text className="felt-arc-title">
                <textPath href="#bjArc" startOffset="50%" textAnchor="middle">
                  BLACKJACK PAYS 3 TO 2
                </textPath>
              </text>
              <text className="felt-arc-sub">
                <textPath href="#rulesArc" startOffset="50%" textAnchor="middle">
                  DEALER MUST STAND ON ALL 17s
                </textPath>
              </text>
            </svg>

            {/* Dealer & Player Hands */}
            <div className="table-play-area">
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
            </div>

            {/* Center Betting Circle on the Felt */}
            {!state.freePlay && (
              <div className="betting-spot-wrapper">
                <div className={`betting-circle ${state.currentBet > 0 ? "betting-circle--active" : ""}`}>
                  {state.currentBet > 0 ? (
                    <div className="table-wager-chip">
                      <span>${state.currentBet}</span>
                    </div>
                  ) : (
                    <span className="betting-circle-text">BET</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
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
        onDeal={() => dispatch(createDealAction())}
        onHit={() => dispatch({ type: "HIT" })}
        onStand={() => dispatch({ type: "STAND" })}
        onDouble={() => dispatch({ type: "DOUBLE" })}
        canDouble={canDouble(state)}
      />
    </main>
  );
}
