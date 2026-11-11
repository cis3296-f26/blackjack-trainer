import type { GameState } from '../engine/game';
import { resultReason } from '../engine/presentation';
import './ResultBanner.css';

interface ResultBannerProps {
  result: Result | null;
}

const MESSAGES: Record<Result, string> = {
  blackjack: 'Blackjack! You win.',
  win: 'You win!',
  lose: 'You lose.',
  push: "Push. It's a tie.",
  surrender: 'You surrendered.',
};

// Shows the outcome once the hand is over; renders nothing while a hand is in play
export default function ResultBanner({ result }: ResultBannerProps) {
  if (result === null) return null;

export default function ResultBanner({ state }: { state: GameState }) {
  if (state.phase !== 'done' || !state.result || !state.lastRound) return null;
  const round = state.lastRound;
  return (
    <div className={`result-banner result-banner--${state.result}`} role="status" aria-atomic="true">
      <h2>{messages[state.result]} {!round.freePlay && <span className="result-banner__amount">{round.profit > 0 ? '+' : round.profit < 0 ? '−' : ''}${Math.abs(round.profit)}</span>}</h2>
      <p>{resultReason(state)}</p>
      {!round.freePlay && <p className="result-banner__detail">Bet ${round.wager} · Returned ${round.returned}</p>}
      {round.bailout > 0 && <p className="result-banner__bailout">+${round.bailout} practice chips added.</p>}
    </div>
  );
}
