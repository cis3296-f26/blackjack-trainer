import type { Result } from '../engine/game';
import './ResultBanner.css';

interface ResultBannerProps {
  result: Result | null;
}

const MESSAGES: Record<Result, string> = {
  blackjack: 'Blackjack! You win.',
  win: 'You win!',
  lose: 'You lose.',
  push: "Push. It's a tie.",
};

// Shows the outcome once the hand is over; renders nothing while a hand is in play
export default function ResultBanner({ result }: ResultBannerProps) {
  if (result === null) return null;

  return (
    <div className={`result-banner result-banner--${result}`} role="status">
      {MESSAGES[result]}
    </div>
  );
}
