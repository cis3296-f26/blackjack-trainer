import { useEffect, useMemo, useReducer } from 'react';
import { canDouble, createDealAction, gameReducer, initialState } from './engine/game';
import { reshuffleThreshold } from './engine/rules';
import { DEFAULT_SHOE_DECKS } from './engine/shoe';
import { analyzeHand } from './engine/strategy';
import { useAuth } from './AuthContext';
import { loadHouseRules, saveHouseRules } from './houseRulesStorage';

import Controls from './components/Controls';
import Hand from './components/Hand';
import Hint from './components/Hint';
import HouseSettings from './components/HouseSettings';
import ResultBanner from './components/ResultBanner';
import './App.css';
import AuthPage from './components/AuthPage';

// Top-level screen: owns the game state and passes pieces of it down to components
export default function App() {
  const { currentUser, logout }= useAuth();
  // Start with the house rules saved from the last visit
  const [state, dispatch] = useReducer(gameReducer, undefined, () => ({
    ...initialState,
    rules: loadHouseRules(),
  }));

  useEffect(() => {
    saveHouseRules(state.rules);
  }, [state.rules]);

  // The dealer's hole card stays face down until the player stands or busts
  const hideHoleCard = state.phase === "playerTurn";
  const doubleAvailable = canDouble(state);

  const analysis = useMemo(
  () =>
    state.phase === 'playerTurn'
      ? analyzeHand(state.playerHand, state.dealerHand[0], doubleAvailable, state.rules.numDecks)
      : null,
  [state.phase, state.playerHand, state.dealerHand, doubleAvailable, state.rules.numDecks],
);

  // Hooks above must run on every render, so the login gate comes after them
  if (!currentUser) {
    return <AuthPage onSuccess={() => { }} />;
  }

  const totalShoeCards = DEFAULT_SHOE_DECKS * 52; // 312
  const cardsRemaining = state.deck.length > 0 ? state.deck.length : totalShoeCards;

  // Only count cards as discarded after the round is completed/settled
  const cardsUsedInCurrentHand = state.phase !== 'idle' ? state.playerHand.length + state.dealerHand.length : 0;
  const discardedCards = state.phase === 'done'
    ? totalShoeCards - cardsRemaining
    : Math.max(0, (totalShoeCards - cardsRemaining) - cardsUsedInCurrentHand);

  const shoePercent = Math.max(0, Math.min(100, Math.round((cardsRemaining / totalShoeCards) * 100)));
  const discardPercent = Math.max(4, Math.min(100, Math.round((discardedCards / totalShoeCards) * 100)));

  return (
    <main className="table">
      <div className="app__user-bar">
        <span className="app__user-name">
          {currentUser.displayName || currentUser.email}
        </span>
        <HouseSettings
          rules={state.rules}
          canEdit={state.phase === "idle" || state.phase === "done"}
          onChange={(rules) => dispatch({ type: "SET_HOUSE_RULES", rules })}
        />
        <button type="button" className="app__logout" onClick={logout}>
          Log Out
        </button>
      </div>

      <Hint analysis={analysis} />
      <h1 className="table__title">Blackjack Trainer</h1>

      <div className="casino-scene">
        <div className="casino-table-wood">
          <div className="casino-table-felt">

            {/* 1. TOP ROW: DISCARD HOLDER, DEALER CHIP RACK, & BLACK SHOE */}
            <div className="casino-top-equipment">

              {/* Top-Left: Clear Acrylic Discard Holder */}
              <div className="discard-holder" title={`${discardedCards} cards discarded`}>
                <div className="discard-acrylic-box">
                  <div
                    className="discard-card-stack"
                    style={{ height: `${discardPercent}%` }}
                  />
                </div>
                <div className="discard-wood-base" />
                <span className="equipment-badge">{discardedCards} Discarded</span>
              </div>

              {/* Top-Center: 10-Tube Dealer Chip Rack */}
              <div className="dealer-chip-tray" aria-hidden="true">
                <div className="chip-tube tube--red" />
                <div className="chip-tube tube--red-short" />
                <div className="chip-tube tube--orange" />
                <div className="chip-tube tube--blue" />
                <div className="chip-tube tube--green" />
                <div className="chip-tube tube--white-red" />
                <div className="chip-tube tube--white-red-full" />
                <div className="chip-tube tube--white-red-full" />
                <div className="chip-tube tube--white-blue" />
                <div className="chip-tube tube--white-black" />
              </div>

              {/* Top-Right: 3D Angled Matte Black 6-Deck Shoe */}
              <div
                className="black-dealing-shoe"
                title={`${cardsRemaining} / ${totalShoeCards} cards remaining in 6-deck shoe (Reshuffles at ${reshuffleThreshold(state.rules)})`}
              >
                <div className="shoe-3d-body">
                  <div className="shoe-top-lid" />
                  <div className="shoe-front-plate">
                    <div className="shoe-finger-cutout">
                      <div
                        className="shoe-visible-cards"
                        style={{ height: `${shoePercent}%` }}
                      />
                      <div className="shoe-cut-marker" title="Cut Card (75%)" />
                    </div>
                  </div>
                </div>
                <span className="equipment-badge">
                  Shoe: {cardsRemaining} / {totalShoeCards}
                </span>
              </div>
            </div>

            {/* 2. CURVED FELT GRAPHICS: CONCENTRIC ARCS & RIBBON BANNER */}
            <svg
              className="casino-felt-svg"
              viewBox="0 0 1100 680"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <defs>
                <path
                  id="blackjackCurve"
                  d="M 170 180 Q 550 430 930 180"
                />
                <path
                  id="dealerRulesCurve"
                  d="M 145 222 Q 550 490 955 222"
                />
                <path
                  id="insuranceCurve"
                  d="M 95 290 Q 550 580 1005 290"
                />
              </defs>

              {/* Ribbon tails */}
              <path
                d="M 110 250 L 65 170 L 107 190 L 133 151 L 154 278.5"
                fill="none"
                stroke="#dddccc"
                strokeWidth="3"
                strokeLinejoin="round"
              />

              <path
                d="M 990 250 L 1035 170 L 993 190 L 967 151 L 946 278.5"
                fill="none"
                stroke="#dddccc"
                strokeWidth="3"
                strokeLinejoin="round"
              />

              {/* Insurance band */}
              <path
                d="M 110 250 Q 550 550 990 250 L 1020 300 Q 550 610 80 300 Z"
                fill="rgba(0, 35, 18, 0.10)"
                stroke="#dddccc"
                strokeWidth="3"
                strokeLinejoin="round"
              />

              <text className="felt-text-blackjack">
                <textPath
                  href="#blackjackCurve"
                  startOffset="50%"
                  textAnchor="middle"
                >
                  BLACKJACK PAYS 3 TO 2
                </textPath>
              </text>

              <text className="felt-text-rules">
                <textPath
                  href="#dealerRulesCurve"
                  startOffset="50%"
                  textAnchor="middle"
                >
                  Dealer must draw to 16 and stand on all 17s
                </textPath>
              </text>

              <text className="felt-text-insurance">
                <textPath
                  href="#insuranceCurve"
                  startOffset="19%"
                  textAnchor="middle"
                >
                  PAYS 2 TO 1
                </textPath>

                <textPath
                  href="#insuranceCurve"
                  startOffset="50%"
                  textAnchor="middle"
                >
                  INSURANCE
                </textPath>

                <textPath
                  href="#insuranceCurve"
                  startOffset="81%"
                  textAnchor="middle"
                >
                  PAYS 2 TO 1
                </textPath>
              </text>
            </svg>

            {/* 3. DEALER HAND ZONE */}
            <div className="dealer-zone">
              {state.phase !== 'idle' && (
                <Hand
                  title="Dealer"
                  cards={state.dealerHand}
                  hideHoleCard={hideHoleCard}
                />
              )}
            </div>

            {/* 4. STATUS / HINT / RESULT BANNER */}
            <div className="table-center-status">
              {state.phase === 'idle' && (
                <p className="table__hint">
                  {state.freePlay
                    ? 'Press Deal to start a hand.'
                    : 'Place a bet with the chips below, then press Deal.'}
                </p>
              )}
              <ResultBanner result={state.result} />
            </div>

            {/* 5. PLAYER HAND ZONE */}
            <div className="player-zone" data-result={state.result}>
              {state.phase !== 'idle' && (
                <Hand
                  title={
                    state.result === 'win' ? 'You win!' :
                      state.result === 'blackjack' ? 'Blackjack! You win!' :
                        state.result === 'lose' ? 'You lose' :
                          state.result === 'push' ? 'Push — tie' :
                            'You'
                  }
                  cards={state.playerHand}
                />
              )}
            </div>

            {/* 6. BOTTOM BETTING BOXES */}
            <div className="betting-boxes-row">
              <div className="betting-rect-box betting-rect-box--far-left" aria-hidden="true" />
              <div className="betting-rect-box betting-rect-box--far-right" aria-hidden="true" />
              <div className="betting-rect-box betting-rect-box--left" aria-hidden="true" />

              <div
                className={`betting-rect-box betting-rect-box--center ${state.currentBet > 0 ? 'betting-rect-box--active' : ''
                  }`}
              >
                {!state.freePlay && state.currentBet > 0 ? (
                  <div className="box-chip-cluster">
                    <div className="box-chip box-chip--red" />
                    <div className="box-chip box-chip--blue" />
                    <div className="box-chip box-chip--main">
                      <span>${state.currentBet}</span>
                    </div>
                  </div>
                ) : (
                  <span className="betting-box-label">
                    {state.freePlay ? 'FREE PLAY' : 'BET HERE'}
                  </span>
                )}
              </div>

              <div className="betting-rect-box betting-rect-box--right" aria-hidden="true" />
            </div>

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
        onDeal={() => dispatch(createDealAction(state.rules))}
        onHit={() => dispatch({ type: "HIT" })}
        onStand={() => dispatch({ type: "STAND" })}
        onDouble={() => dispatch({ type: "DOUBLE" })}
        canDouble={doubleAvailable}
      />
    </main>
  );
}
