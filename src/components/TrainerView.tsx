import { useEffect, useState, type ReactNode } from 'react';
import type { GameAction, GameState } from '../engine/game';
import { analyzeHand } from '../engine/strategy';
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

export default function TrainerView({
  state,
  header,
  rulesSummary,
  playerHands,
  renderControls,
}: TrainerViewProps) {
  const [feedback, setFeedback] = useState<TrainerFeedback | null>(null);

  // Clear previous hand's feedback when returning to idle or starting a fresh 2-card deal
  useEffect(() => {
    if (
      state.phase === 'idle' ||
      (state.phase === 'playerTurn' &&
        state.playerHand.length === 2 &&
        state.splitHands.length === 0)
    ) {
      setFeedback(null);
    }
  }, [state.phase, state.playerHand.length, state.splitHands.length]);

  const activeCards =
    state.splitHands.length > 0
      ? state.splitHands[state.activeHandIndex]?.cards ?? state.playerHand
      : state.playerHand;

  const dealerUpcard = state.dealerHand[0];

  function wrapDispatch(baseDispatch: (action: GameAction) => void) {
    return (action: GameAction) => {
      if (action.type === 'DEAL' || action.type === 'REBET_AND_DEAL') {
        setFeedback(null);
      }

      if (
        state.phase === 'playerTurn' &&
        dealerUpcard &&
        PLAYER_MOVE_ACTIONS.has(action.type)
      ) {
        // Supports analyzeHand(state) or analyzeHand(playerCards, dealerUpcard, rules)
        const rawAnalysis =
          analyzeHand.length <= 1
            ? (analyzeHand as any)(state)
            : (analyzeHand as any)(activeCards, dealerUpcard, state.rules);

        const { move, reason } = extractRecommendation(rawAnalysis);

        if (move) {
          const correct = isMoveMatch(action.type, move);
          setFeedback({
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
                <Hand
                  title="Dealer"
                  cards={state.dealerHand}
                  hideHoleCard={state.phase === 'playerTurn'}
                />
                {playerHands}
              </>
            )}
          </div>

          {state.phase === 'playerTurn' && dealerUpcard && (
            <div className="trainer-coach">
              <strong>Chart lookup:</strong> Cross-reference your active hand total on the left axis with the Dealer&apos;s upcard (<strong>{dealerUpcard.rank}</strong>) along the top row.
            </div>
          )}

          {feedback && (
            <div
              className={`trainer-feedback ${
                feedback.correct
                  ? 'trainer-feedback--correct'
                  : 'trainer-feedback--incorrect'
              }`}
              role="status"
            >
              {feedback.message}
            </div>
          )}

          {renderControls(wrapDispatch)}
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