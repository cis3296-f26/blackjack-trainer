import type { GameState } from '../engine/game';
import { resultReason } from '../engine/presentation';
import './ResultBanner.css';

const messages = { blackjack: 'Blackjack!', win: 'You win!', lose: 'You lose', push: 'Push — a tie', surrender: 'You surrendered' };

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
