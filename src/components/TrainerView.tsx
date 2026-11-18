import { useEffect, useRef, useState, type ReactNode } from 'react';
import { shoeStatus } from '../engine/presentation';
import type { GameAction, GameState } from '../engine/game';
import type { Card as CardType } from '../engine/types';
import { analyzeHand } from '../engine/strategy';
import Card from './Card';
import Hand from './Hand';
import Hint from './Hint';

interface TrainerViewProps {
  state: GameState;
  header: ReactNode;
  rulesSummary: ReactNode;
  playerHands: ReactNode;
  renderControls: (
    wrapDispatch: (baseDispatch: (action: GameAction) => void) => (action: GameAction) => void
  ) => ReactNode;
}

interface TrainerFeedback {
  correct: boolean;
  message: string;
}

type TrainerMode = 'strategy' | 'table-count' | 'speed-count';

// --- BASIC STRATEGY HELPERS ---
function extractRecommendation(analysis: any): { move: string | null; reason: string } {
  if (!analysis) return { move: null, reason: '' };
  if (typeof analysis === 'string') return { move: analysis, reason: '' };

  const move =
    analysis.action ??
    analysis.move ??
    analysis.recommendedAction ??
    analysis.recommendation ??
    null;

  const reason =
    analysis.reason ??
    analysis.explanation ??
    analysis.advice ??
    analysis.summary ??
    '';

  return { move: move ? String(move) : null, reason: String(reason) };
}

function isMoveMatch(chosenType: string, recommendedMove: string): boolean {
  const chosen = chosenType.toUpperCase();
  const rec = recommendedMove.toUpperCase().trim();

  if (chosen === rec || rec.startsWith(chosen)) return true;
  if (chosen === 'HIT' && rec === 'H') return true;
  if (chosen === 'STAND' && rec === 'S') return true;
  if (chosen === 'DOUBLE' && (rec === 'D' || rec === 'DS' || rec.includes('DOUBLE'))) return true;
  if (chosen === 'SPLIT' && (rec === 'Y' || rec === 'P' || rec === 'SP' || rec.includes('SPLIT'))) return true;
  if (chosen === 'SURRENDER' && (rec === 'SUR' || rec === 'R' || rec.includes('SURRENDER'))) return true;

  return false;
}

const PLAYER_MOVE_ACTIONS = new Set(['HIT', 'STAND', 'DOUBLE', 'SPLIT', 'SURRENDER']);

// --- HI-LO CARD COUNTING HELPERS ---
function hiLoValue(card: CardType): -1 | 0 | 1 {
  const rank = String(card.rank).toUpperCase();
  if (['2', '3', '4', '5', '6'].includes(rank)) return 1;
  if (['7', '8', '9'].includes(rank)) return 0;
  return -1; // 10, J, Q, K, A
}

function formatSigned(val: number): string {
  return val > 0 ? `+${val}` : String(val);
}

function getVisibleCards(state: GameState, holeDown: boolean): CardType[] {
  if (state.phase === 'idle') return [];
  const dealerVisible = holeDown ? state.dealerHand.slice(0, 1) : state.dealerHand;
  const playerVisible =
    state.splitHands.length > 0
      ? state.splitHands.flatMap((h) => h.cards)
      : state.playerHand;
  return [...dealerVisible, ...playerVisible];
}

function calculateTrueCount(runningCount: number, remainingCards: number): number {
  const decksRemaining = Math.max(0.5, remainingCards / 52);
  return Math.round((runningCount / decksRemaining) * 10) / 10;
}

function recommendedBetUnits(trueCount: number): { units: number; advice: string } {
  const tc = Math.floor(trueCount);
  if (tc <= 1) return { units: 1, advice: 'House edge — bet table minimum (1 unit).' };
  if (tc === 2) return { units: 2, advice: 'Slight player edge (+0.5%) — bet 2 units.' };
  if (tc === 3) return { units: 4, advice: 'Solid player edge (+1.0%) — bet 4 units.' };
  if (tc === 4) return { units: 6, advice: 'Strong player edge (+1.5%) — bet 6 units.' };
  return { units: 8, advice: 'Max player advantage (+2.0%+) — bet 8+ units.' };
}

const SUITS: CardType['suit'][] = ['♠', '♥', '♦', '♣'];
const RANKS: CardType['rank'][] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function randomCard(): CardType {
  return {
    rank: RANKS[Math.floor(Math.random() * RANKS.length)],
    suit: SUITS[Math.floor(Math.random() * SUITS.length)],
  };
}

export default function TrainerView({
  state,
  header,
  rulesSummary,
  playerHands,
  renderControls,
}: TrainerViewProps) {
  const [mode, setMode] = useState<TrainerMode>('strategy');
  const [strategyFeedback, setStrategyFeedback] = useState<TrainerFeedback | null>(null);

  // Card counting state
  const [showLiveCount, setShowLiveCount] = useState(false);
  const [bankedCount, setBankedCount] = useState(0);
  const [countGuess, setCountGuess] = useState('');
  const [countFeedback, setCountFeedback] = useState<TrainerFeedback | null>(null);
  const [countStreak, setCountStreak] = useState(0);

  // Speed flash drill state
  const [speedRunning, setSpeedRunning] = useState(false);
  const [speedIntervalMs, setSpeedIntervalMs] = useState(1200);
  const [speedCard, setSpeedCard] = useState<CardType | null>(null);
  const [speedCount, setSpeedCount] = useState(0);
  const [speedCardsSeen, setSpeedCardsSeen] = useState(0);
  const [speedCheckpoint, setSpeedCheckpoint] = useState(false);

  const shoe = shoeStatus(state);
  const holeDown = state.phase === 'playerTurn';
  const visibleCards = getVisibleCards(state, holeDown);
  const currentHandDelta = visibleCards.reduce((sum, c) => sum + hiLoValue(c), 0);

  const prevRemainingRef = useRef(shoe.remaining);
  const latestHandDeltaRef = useRef(currentHandDelta);
  latestHandDeltaRef.current = currentHandDelta;

  // Reset running count automatically if the shoe reshuffles
  useEffect(() => {
    if (shoe.remaining > prevRemainingRef.current) {
      setBankedCount(0);
      setCountFeedback({
        correct: true,
        message: 'Shoe reshuffled! Running count reset to 0.',
      });
    }
    prevRemainingRef.current = shoe.remaining;
  }, [shoe.remaining]);

  // Clear strategy feedback when a new hand starts
  useEffect(() => {
    if (
      state.phase === 'idle' ||
      (state.phase === 'playerTurn' &&
        state.playerHand.length === 2 &&
        state.splitHands.length === 0)
    ) {
      setStrategyFeedback(null);
    }
  }, [state.phase, state.playerHand.length, state.splitHands.length]);

  // Speed drill interval timer
  useEffect(() => {
    if (mode !== 'speed-count' || !speedRunning || speedCheckpoint) return;

    const timer = window.setInterval(() => {
      const next = randomCard();
      setSpeedCard(next);
      setSpeedCount((c) => c + hiLoValue(next));
      setSpeedCardsSeen((seen) => {
        const nextSeen = seen + 1;
        if (nextSeen % 10 === 0) {
          setSpeedRunning(false);
          setSpeedCheckpoint(true);
        }
        return nextSeen;
      });
    }, speedIntervalMs);

    return () => window.clearInterval(timer);
  }, [mode, speedRunning, speedCheckpoint, speedIntervalMs]);

  const activeRunningCount =
    mode === 'speed-count' ? speedCount : bankedCount + currentHandDelta;
  const decksRemaining = Math.max(0.5, shoe.remaining / 52);
  const trueCount = calculateTrueCount(activeRunningCount, shoe.remaining);
  const betAdvice = recommendedBetUnits(trueCount);

  const activeCards =
    state.splitHands.length > 0
      ? state.splitHands[state.activeHandIndex]?.cards ?? state.playerHand
      : state.playerHand;
  const dealerUpcard = state.dealerHand[0];

  function wrapDispatch(baseDispatch: (action: GameAction) => void) {
    return (action: GameAction) => {
      // Bank the finished hand's Hi-Lo delta before dealing the next hand
      if (action.type === 'DEAL' || action.type === 'REBET_AND_DEAL') {
        setBankedCount((prev) => prev + latestHandDeltaRef.current);
        setStrategyFeedback(null);
        setCountFeedback(null);
      }

      // Evaluate Basic Strategy on player turn moves
      if (
        state.phase === 'playerTurn' &&
        dealerUpcard &&
        PLAYER_MOVE_ACTIONS.has(action.type)
      ) {
        const rawAnalysis =
          analyzeHand.length <= 1
            ? (analyzeHand as any)(state)
            : (analyzeHand as any)(activeCards, dealerUpcard, state.rules);

        const { move, reason } = extractRecommendation(rawAnalysis);

        if (move) {
          const correct = isMoveMatch(action.type, move);
          setStrategyFeedback({
            correct,
            message: correct
              ? `Correct! ${action.type} is the optimal Basic Strategy move.${reason ? ` (${reason})` : ''}`
              : `Not quite — Basic Strategy recommends ${move.toUpperCase()} instead of ${action.type}.${reason ? ` ${reason}` : ''}`,
          });
        }
      }

      baseDispatch(action);
    };
  }

  function handleVerifyCount(e: React.FormEvent) {
    e.preventDefault();
    const parsed = Number.parseInt(countGuess.trim(), 10);
    if (Number.isNaN(parsed)) return;

    const isCorrect = parsed === activeRunningCount;
    if (isCorrect) {
      setCountStreak((s) => s + 1);
      setCountFeedback({
        correct: true,
        message: `Spot on! Running Count is ${formatSigned(activeRunningCount)} (True Count: ${formatSigned(trueCount)}). ${betAdvice.advice}`,
      });
      if (mode === 'speed-count' && speedCheckpoint) {
        setSpeedCheckpoint(false);
      }
    } else {
      setCountStreak(0);
      setCountFeedback({
        correct: false,
        message: `Off by ${Math.abs(parsed - activeRunningCount)}. Actual Running Count is ${formatSigned(activeRunningCount)} (you entered ${formatSigned(parsed)}).`,
      });
    }
    setCountGuess('');
  }

  function resetSpeedDrill() {
    setSpeedRunning(false);
    setSpeedCheckpoint(false);
    setSpeedCard(null);
    setSpeedCount(0);
    setSpeedCardsSeen(0);
    setCountFeedback(null);
    setCountGuess('');
  }

  const isCountingMode = mode === 'table-count' || mode === 'speed-count';

  return (
    <main className="table table--trainer">
      {header}
      {rulesSummary}

      {/* Top Mode Switcher Bar */}
      <div className="trainer-mode-bar" role="region" aria-label="Trainer mode selector">
        <div className="trainer-mode-bar__tabs" role="group" aria-label="Select training discipline">
          <button
            type="button"
            className={`button ${mode === 'strategy' ? 'button--primary' : 'button--secondary'}`}
            onClick={() => setMode('strategy')}
          >
            Basic Strategy
          </button>
          <button
            type="button"
            className={`button ${mode === 'table-count' ? 'button--primary' : 'button--secondary'}`}
            onClick={() => setMode('table-count')}
          >
            Hi-Lo Table Counter
          </button>
          <button
            type="button"
            className={`button ${mode === 'speed-count' ? 'button--primary' : 'button--secondary'}`}
            onClick={() => setMode('speed-count')}
          >
            Speed Count Drill
          </button>
        </div>

        {isCountingMode && (
          <div className="trainer-mode-bar__actions">
            <span className="trainer-pill">
              Streak: <strong>{countStreak}</strong>
            </span>
            <span className="trainer-pill">
              Decks Left: <strong>{decksRemaining.toFixed(1)}</strong> ({shoe.remaining}/{shoe.total})
            </span>
            <button
              type="button"
              className="button button--secondary"
              aria-pressed={showLiveCount}
              onClick={() => setShowLiveCount((v) => !v)}
            >
              {showLiveCount ? 'Hide Count HUD' : 'Peek Count HUD'}
            </button>
            {mode === 'table-count' && (
              <button
                type="button"
                className="button button--secondary"
                onClick={() => {
                  setBankedCount(0);
                  setCountFeedback({ correct: true, message: 'Running count reset to 0.' });
                }}
              >
                Reset Count
              </button>
            )}
          </div>
        )}
      </div>

      <div className="trainer-layout">
        <section className="trainer-layout__game" aria-label="Practice table">
          {/* Optional Live Count HUD when in Counting Mode & Peek is active */}
          {isCountingMode && showLiveCount && (
            <div className="counting-hud" role="status">
              <div className="counting-hud__item">
                <span className="counting-hud__label">Running Count</span>
                <strong className="counting-hud__value">{formatSigned(activeRunningCount)}</strong>
              </div>
              <div className="counting-hud__item">
                <span className="counting-hud__label">True Count</span>
                <strong className="counting-hud__value">{formatSigned(trueCount)}</strong>
              </div>
              <div className="counting-hud__item">
                <span className="counting-hud__label">Current Hand Net</span>
                <strong className="counting-hud__value">{formatSigned(currentHandDelta)}</strong>
              </div>
              <div className="counting-hud__item">
                <span className="counting-hud__label">Optimal Bet Spread</span>
                <strong className="counting-hud__value">{betAdvice.units}x Unit</strong>
              </div>
            </div>
          )}

          {mode !== 'speed-count' ? (
            <>
              <div className="trainer-table">
                {state.phase === 'idle' ? (
                  <p className="trainer-table__intro">
                    {mode === 'strategy'
                      ? 'Deal a hand to practice basic strategy. Use the chart to find the best play, then check yourself with a hint.'
                      : 'Deal a hand and track every face-up card (+1 for 2–6, 0 for 7–9, −1 for 10–A). Verify your running count below!'}
                  </p>
                ) : (
                  <>
                    <Hand
                      title="Dealer"
                      cards={state.dealerHand}
                      hideHoleCard={state.phase === 'playerTurn'}
                    />
                    {playerHands}
                  </>
                )}
              </div>

              {mode === 'strategy' && state.phase === 'playerTurn' && dealerUpcard && (
                <div className="trainer-coach">
                  <strong>Chart lookup:</strong> Cross-reference your active hand total on the left axis with the Dealer&apos;s upcard (<strong>{dealerUpcard.rank}</strong>) along the top row.
                </div>
              )}

              {/* Per-Card Hi-Lo tags when in Table Count mode and either hand is over or Peek is on */}
              {mode === 'table-count' &&
                visibleCards.length > 0 &&
                (showLiveCount || state.phase === 'done') && (
                  <div className="counting-breakdown">
                    <strong>Visible Cards on Felt ({formatSigned(currentHandDelta)} net):</strong>
                    <div className="counting-breakdown__tags">
                      {visibleCards.map((c, i) => {
                        const v = hiLoValue(c);
                        return (
                          <span
                            key={`${c.rank}${c.suit}-${i}`}
                            className={`counting-tag counting-tag--${v > 0 ? 'pos' : v < 0 ? 'neg' : 'zero'}`}
                          >
                            {c.rank}
                            {c.suit} ({formatSigned(v)})
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

              {/* Instant Basic Strategy Feedback */}
              {strategyFeedback && (
                <div
                  className={`trainer-feedback ${
                    strategyFeedback.correct
                      ? 'trainer-feedback--correct'
                      : 'trainer-feedback--incorrect'
                  }`}
                  role="status"
                >
                  {strategyFeedback.message}
                </div>
              )}
            </>
          ) : (
            /* Speed Flash Counting Drill */
            <div className="speed-drill">
              <h2>Speed Deck Flash Drill</h2>
              <p>
                Track the Hi-Lo running count as cards flash by. Every 10 cards, the drill pauses so you can verify your count.
              </p>

              <div className="speed-drill__stage">
                {speedCard ? (
                  <div className="speed-drill__card-slot">
                    <Card card={speedCard} />
                    {showLiveCount && (
                      <span className="speed-drill__card-tag">
                        {formatSigned(hiLoValue(speedCard))}
                      </span>
                    )}
                  </div>
                ) : (
                  <p>Press Start Drill to begin flashing cards.</p>
                )}
              </div>

              <div className="speed-drill__controls">
                <label className="speed-drill__speed">
                  <span>Speed: {(speedIntervalMs / 1000).toFixed(1)}s / card</span>
                  <input
                    type="range"
                    min={400}
                    max={2400}
                    step={200}
                    value={speedIntervalMs}
                    onChange={(e) => setSpeedIntervalMs(Number(e.target.value))}
                  />
                </label>
                <div className="speed-drill__buttons">
                  <button
                    type="button"
                    className="button button--primary"
                    disabled={speedCheckpoint}
                    onClick={() => setSpeedRunning((r) => !r)}
                  >
                    {speedRunning ? 'Pause' : speedCardsSeen > 0 ? 'Resume' : 'Start Drill'}
                  </button>
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={resetSpeedDrill}
                  >
                    Reset Drill
                  </button>
                </div>
                <span>Cards flashed: {speedCardsSeen}</span>
              </div>
            </div>
          )}

          {/* Count Quiz Box (shown in both Table Count and Speed Count modes) */}
          {isCountingMode && (
            <form className="counting-quiz" onSubmit={handleVerifyCount}>
              <label className="counting-quiz__label" htmlFor="trainer-count-input">
                {speedCheckpoint
                  ? `Checkpoint (${speedCardsSeen} cards)! Enter the Running Count to continue:`
                  : 'Test your Running Count:'}
              </label>
              <div className="counting-quiz__controls">
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() =>
                    setCountGuess((prev) => String((Number.parseInt(prev, 10) || 0) - 1))
                  }
                >
                  −1
                </button>
                <input
                  id="trainer-count-input"
                  type="number"
                  className="counting-quiz__input"
                  placeholder="0"
                  value={countGuess}
                  onChange={(e) => setCountGuess(e.target.value)}
                />
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() =>
                    setCountGuess((prev) => String((Number.parseInt(prev, 10) || 0) + 1))
                  }
                >
                  +1
                </button>
                <button type="submit" className="button button--primary">
                  Verify Count
                </button>
              </div>
            </form>
          )}

          {isCountingMode && countFeedback && (
            <div
              className={`trainer-feedback ${
                countFeedback.correct
                  ? 'trainer-feedback--correct'
                  : 'trainer-feedback--incorrect'
              }`}
              role="status"
            >
              {countFeedback.message}
            </div>
          )}

          {mode !== 'speed-count' && renderControls(wrapDispatch)}
        </section>

        {/* Right Side Guide: switches automatically between Basic Strategy Chart & Hi-Lo Guide */}
        <aside className="trainer-layout__guide" aria-label="Training guide">
          {mode !== 'speed-count' && <Hint key={state.phase} state={state} />}

          {!isCountingMode ? (
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
          ) : (
            <div className="trainer-guide__card">
              <h2 className="trainer-guide__heading">Hi-Lo Card Counting Guide</h2>
              <p className="trainer-guide__intro">
                Hi-Lo tracks the ratio of high cards (10s and Aces) to low cards (2–6) remaining in the shoe. When more low cards have been dealt out, the remaining shoe is rich in 10s and Aces—giving you a mathematical advantage.
              </p>

              <div className="counting-tiers">
                <div className="counting-tier counting-tier--pos">
                  <div className="counting-tier__badge">+1</div>
                  <div>
                    <strong>Low Cards (2, 3, 4, 5, 6)</strong>
                    <p>Add +1 for every low card dealt face-up.</p>
                  </div>
                </div>
                <div className="counting-tier counting-tier--zero">
                  <div className="counting-tier__badge">0</div>
                  <div>
                    <strong>Neutral Cards (7, 8, 9)</strong>
                    <p>Ignore these completely (count stays the same).</p>
                  </div>
                </div>
                <div className="counting-tier counting-tier--neg">
                  <div className="counting-tier__badge">−1</div>
                  <div>
                    <strong>High Cards (10, J, Q, K, A)</strong>
                    <p>Subtract 1 for every 10-value card or Ace dealt.</p>
                  </div>
                </div>
              </div>

              <ul className="trainer-guide__list">
                <li>
                  <strong>Cancel Pairs:</strong> Wait until a 2-card hand is dealt. A high card (−1) and a low card (+1) cancel out to <strong>0</strong> immediately.
                </li>
                <li>
                  <strong>True Count Conversion:</strong> Divide your Running Count by the number of decks left in the shoe:
                  <br />
                  <em>True Count = Running Count ÷ Decks Remaining</em>
                </li>
                <li>
                  <strong>Bet Sizing:</strong> Bet 1x minimum when True Count is +1 or below. Ramp up to 2x at +2, 4x at +3, 6x at +4, and 8x+ at +5 or higher.
                </li>
                <li>
                  <strong>Still Play Basic Strategy:</strong> Keep making optimal Basic Strategy moves while maintaining the count—both feedbacks stay active at the table!
                </li>
              </ul>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}