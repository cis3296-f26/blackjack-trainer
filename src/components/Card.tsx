import type { Card as CardType } from '../engine/types';
import './Card.css';

interface CardProps {
  card: CardType;
  faceDown?: boolean;
}

// One playing card shown as text, e.g. "K♠". A face-down card hides its rank and suit.
export default function Card({ card, faceDown = false }: CardProps) {
  if (faceDown) {
    return <div className="card card--back" role="img" aria-label="Face-down card" />;
  }

  const isRed = card.suit === '♥' || card.suit === '♦';
  return (
    <div className={isRed ? 'card card--red' : 'card'}>
      {card.rank}
      {card.suit}
    </div>
  );
}
