import { useEffect, useState, useMemo, useReducer } from 'react';
import { canDouble, canSplit, createDealAction, gameReducer, initialState } from './engine/game';
import { reshuffleThreshold } from './engine/rules';
import { analyzeHand } from './engine/strategy';
import { useAuth } from './AuthContext';
import { loadHouseRules, saveHouseRules } from './houseRulesStorage';

import Controls from './components/Controls';
// import TrainerControls from './components/TrainerControls'
import Hand from './components/Hand';
import Hint from './components/Hint';
import HouseSettings from './components/HouseSettings';
import ResultBanner from './components/ResultBanner';
import './App.css';
import AuthPage from './components/AuthPage';
import MainMenu from './components/MainMenu';

// Top-level screen: owns the game state and passes pieces of it down to components
export default function App() {
  const { currentUser, logout }= useAuth();
  const [inSimulation, setInSimulation] = useState(false);
  const [inTrainer, setInTrainer] = useState(false);
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
      ? analyzeHand(state.playerHand, state.dealerHand[0], state.rules, doubleAvailable)
      : null,
  [state.phase, state.playerHand, state.dealerHand, doubleAvailable, state.rules],
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
    return <AuthPage onSuccess={() => { }} />;
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

  const { rules } = state;
  const totalShoeCards = rules.numDecks * 52;
  const cutCardAt = reshuffleThreshold(rules); // cards left when the cut card comes out
  const cardsRemaining = state.deck.length > 0 ? state.deck.length : totalShoeCards;

  // Only count cards as discarded after the round is completed/settled
  const playerCardCount = state.splitHands.length > 0
    ? state.splitHands.reduce((total, hand) => total + hand.cards.length, 0)
    : state.playerHand.length;
  const cardsUsedInCurrentHand = state.phase !== 'idle' ? playerCardCount + state.dealerHand.length : 0;
  const discardedCards = state.phase === 'done'
    ? totalShoeCards - cardsRemaining
    : Math.max(0, (totalShoeCards - cardsRemaining) - cardsUsedInCurrentHand);

  const shoePercent = Math.max(0, Math.min(100, Math.round((cardsRemaining / totalShoeCards) * 100)));
  const discardPercent = Math.max(4, Math.min(100, Math.round((discardedCards / totalShoeCards) * 100)));
  const cutCardPercent = Math.min(100, (cutCardAt / totalShoeCards) * 100);

  // Felt lettering follows the house rules, e.g. "BLACKJACK PAYS 6 TO 5"
  const blackjackPaysText = `BLACKJACK PAYS ${rules.blackjackPayout.replace(':', ' TO ')}`;
  const dealerRuleText = rules.dealerHitsSoft17
    ? 'Dealer must draw to 16 and hit soft 17'
    : 'Dealer must draw to 16 and stand on all 17s';

return (
    <>
      {inSimulation && (
        <main className="table">
          <div className="app__user-bar">
            <button type="button" className="app__logout" onClick={returnToMenu}>
              Main Menu
            </button>
            <span className="app__user-name">
              {currentUser.displayName || currentUser.email}
            </span>
            <HouseSettings
              rules={state.rules}
              canEdit={state.phase === 'idle' || state.phase === 'done'}
              onChange={(rules) => dispatch({ type: 'SET_HOUSE_RULES', rules })}
            />
            <button type="button" className="app__logout" onClick={logout}>
              Log Out
            </button>
          </div>

          <Hint analysis={analysis} />
          <h1 className="table__title">Blackjack Simulation</h1>

          <div className="casino-scene">
            <div className="casino-table-wood">
              <div className="casino-table-felt">
                {/* 1. TOP ROW: DISCARD HOLDER, DEALER CHIP RACK, & BLACK SHOE */}
                <div className="casino-top-equipment">
                  {/* Top-Left: Clear Acrylic Discard Holder */}
                  <div
                    className="discard-holder"
                    title={`${discardedCards} cards discarded`}
                  >
                    <div className="discard-acrylic-box">
                      <div
                        className="discard-card-stack"
                        style={{ height: `${discardPercent}%` }}
                      />
                    </div>
                    <div className="discard-wood-base" />
                    <span className="equipment-badge">
                      {discardedCards} Discarded
                    </span>
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

                  {/* Top-Right: 3D Angled Matte Black Shoe */}
                  <div
                    className="black-dealing-shoe"
                    title={`${cardsRemaining} / ${totalShoeCards} cards remaining in ${rules.numDecks}-deck shoe (Reshuffles at ${cutCardAt})`}
                  >
                    <div className="shoe-3d-body">
                      <div className="shoe-top-lid" />
                      <div className="shoe-front-plate">
                        <div className="shoe-finger-cutout">
                          <div
                            className="shoe-visible-cards"
                            style={{ height: `${shoePercent}%` }}
                          />
                          <div
                            className="shoe-cut-marker"
                            style={{ bottom: `${cutCardPercent}%` }}
                            title={`Cut Card (${Math.round(rules.penetration * 100)}%)`}
                          />
                        </div>
                      </div>
                      <span className="equipment-badge">
                        Shoe: {cardsRemaining} / {totalShoeCards}
                      </span>
                    </div>
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
                      {blackjackPaysText}
                    </textPath>
                  </text>

                  <text className="felt-text-rules">
                    <textPath
                      href="#dealerRulesCurve"
                      startOffset="50%"
                      textAnchor="middle"
                    >
                      {dealerRuleText}
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
                  {state.splitHands.length > 0 ? (
                    <div className="split-hands" aria-label="Split hands">
                      {state.splitHands.map((hand, index) => {
                        const active =
                          state.phase === 'playerTurn' &&
                          state.activeHandIndex === index;
                        return (
                          <div
                            key={index}
                            className={`split-hand${active ? ' split-hand--active' : ''}`}
                            aria-current={active ? 'step' : undefined}
                          >
                            <Hand
                              fromSplit
                              cards={hand.cards}
                              title={`Hand ${index + 1}${active ? ' — Playing' : ''}`}
                            />
                            <p className="split-hand__status">
                              {!state.freePlay && `$${hand.bet} · `}
                              {hand.result === 'win'
                                ? 'Win'
                                : hand.result === 'lose'
                                  ? 'Lose'
                                  : hand.result === 'push'
                                    ? 'Push'
                                    : hand.complete
                                      ? 'Finished'
                                      : active
                                        ? 'Your turn'
                                        : 'Waiting'}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    state.phase !== 'idle' && (
                      <Hand
                        title={
                          state.result === 'win'
                            ? 'You win!'
                            : state.result === 'blackjack'
                              ? 'Blackjack! You win!'
                              : state.result === 'lose'
                                ? 'You lose'
                                : state.result === 'push'
                                  ? 'Push — tie'
                                  : 'You'
                        }
                        cards={state.playerHand}
                      />
                    )
                  )}
                </div>

                {/* 6. BOTTOM BETTING BOXES */}
                <div className="betting-boxes-row">
                  <div
                    className="betting-rect-box betting-rect-box--far-left"
                    aria-hidden="true"
                  />
                  <div
                    className="betting-rect-box betting-rect-box--far-right"
                    aria-hidden="true"
                  />
                  <div
                    className="betting-rect-box betting-rect-box--left"
                    aria-hidden="true"
                  />

                  <div
                    className={`betting-rect-box betting-rect-box--center ${
                      state.currentBet > 0 ? 'betting-rect-box--active' : ''
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

                  <div
                    className="betting-rect-box betting-rect-box--right"
                    aria-hidden="true"
                  />
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
            onToggleFreePlay={(enabled) =>
              dispatch({ type: 'SET_FREE_PLAY', enabled })
            }
            onPlaceBet={(amount) => dispatch({ type: 'PLACE_BET', amount })}
            onClearBet={() => dispatch({ type: 'CLEAR_BET', amount: 0 } as any)}
            onDeal={() => dispatch(createDealAction(state.rules))}
            onHit={() => dispatch({ type: 'HIT' })}
            onStand={() => dispatch({ type: 'STAND' })}
            onDouble={() => dispatch({ type: 'DOUBLE' })}
            canDouble={doubleAvailable}
            canSplit={canSplit(state)}
            onSplit={() => dispatch({ type: 'SPLIT' })}
          />
        </main>
      )}

      {inTrainer && (
        <main className="table table--trainer">
          <div className="app__user-bar">
            <button type="button" className="app__logout" onClick={returnToMenu}>
              Main Menu
            </button>
            <span className="app__user-name">
              {currentUser.displayName || currentUser.email}
            </span>
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
                  Place a bet and press Deal to practice Basic Strategy. Use the
                  chart on the right to find the optimal play!
                </p>
              ) : (
                <>
                  <Hand
                    title="Dealer"
                    cards={state.dealerHand}
                    hideHoleCard={hideHoleCard}
                  />

                  <div className="player-zone" data-result={state.result}>
                    {state.splitHands.length > 0 ? (
                      <div className="split-hands" aria-label="Split hands">
                        {state.splitHands.map((hand, index) => {
                          const active =
                            state.phase === 'playerTurn' &&
                            state.activeHandIndex === index;
                          return (
                            <div
                              key={index}
                              className={`split-hand${active ? ' split-hand--active' : ''}`}
                              aria-current={active ? 'step' : undefined}
                            >
                              <Hand
                                fromSplit
                                cards={hand.cards}
                                title={`Hand ${index + 1}${active ? ' — Playing' : ''}`}
                              />
                              <p className="split-hand__status">
                                {!state.freePlay && `$${hand.bet} · `}
                                {hand.result === 'win'
                                  ? 'Win'
                                  : hand.result === 'lose'
                                    ? 'Lose'
                                    : hand.result === 'push'
                                      ? 'Push'
                                      : hand.complete
                                        ? 'Finished'
                                        : active
                                          ? 'Your turn'
                                          : 'Waiting'}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <Hand
                        title={
                          state.result === 'win'
                            ? 'You win!'
                            : state.result === 'blackjack'
                              ? 'Blackjack! You win!'
                              : state.result === 'lose'
                                ? 'You lose'
                                : state.result === 'push'
                                  ? 'Push — tie'
                                  : 'You'
                        }
                        cards={state.playerHand}
                      />
                    )}
                  </div>
                </>
              )}

              <ResultBanner result={state.result} />

              <Controls
                phase={state.phase}
                balance={state.balance}
                currentBet={state.currentBet}
                bailoutTriggered={state.bailoutTriggered}
                freePlay={state.freePlay}
                onToggleFreePlay={(enabled) =>
                  dispatch({ type: 'SET_FREE_PLAY', enabled })
                }
                onPlaceBet={(amount) => dispatch({ type: 'PLACE_BET', amount })}
                onClearBet={() => dispatch({ type: 'CLEAR_BET' })}
                onDeal={() => dispatch(createDealAction(state.rules))}
                onHit={() => dispatch({ type: 'HIT' })}
                onStand={() => dispatch({ type: 'STAND' })}
                onDouble={() => dispatch({ type: 'DOUBLE' })}
                canDouble={doubleAvailable}
                canSplit={canSplit(state)}
                onSplit={() => dispatch({ type: 'SPLIT' })}
              />
            </section>

            {/* Right Side: Basic Strategy Chart & Explanation */}
            <aside className="trainer-layout__guide">
              <div className="trainer-guide__card">
                <h2 className="trainer-guide__heading">
                  How Basic Strategy Works
                </h2>
                <p className="trainer-guide__intro">
                  Basic Strategy is the mathematically optimal way to play every
                  hand in Blackjack based on millions of simulated hands. To use
                  the chart, find the <strong>Dealer&apos;s Upcard</strong>{' '}
                  along the top row and match it with your hand type on the
                  vertical axis:
                </p>

                <ul className="trainer-guide__list">
                  <li>
                    <strong>Hard Totals (8–17):</strong> Any hand without an
                    Ace, or where the Ace must count as 1 to avoid busting.
                    Stand on 12–16 when the dealer shows a weak upcard (2–6,
                    except hit 12 vs 2 or 3), and hit when the dealer shows 7
                    through Ace. Always double on 11!
                  </li>
                  <li>
                    <strong>Soft Totals (A,2–A,9):</strong> Hands with an Ace
                    counted as 11 (e.g., A,6 is Soft 17). Because you cannot
                    bust on a single hit, play these aggressively—double against
                    weak dealer cards (4–6) or hit to improve low soft totals.
                  </li>
                  <li>
                    <strong>Pair Splitting (2,2–A,A):</strong> When dealt two
                    cards of the same value. Always split Aces (A,A) and 8s
                    (8,8), and never split 10-value cards (T,T) or 5s (5,5).
                  </li>
                  <li>
                    <strong>Surrender &amp; Insurance:</strong> Only surrender
                    Hard 16 vs. 9, 10, or Ace, and Hard 15 vs. 10 (if allowed).
                    Never take Insurance or Even Money.
                  </li>
                </ul>

                <div className="trainer-guide__legend">
                  <span className="legend-badge legend-badge--h">H = Hit</span>
                  <span className="legend-badge legend-badge--s">S = Stand</span>
                  <span className="legend-badge legend-badge--d">
                    D = Double (or Hit)
                  </span>
                  <span className="legend-badge legend-badge--ds">
                    Ds = Double (or Stand)
                  </span>
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
