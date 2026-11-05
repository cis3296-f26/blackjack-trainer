import type { Card as CardType } from '../engine/types';
import './Card.css';

interface CardProps {
  card: CardType;
  faceDown?: boolean;
}

type PipPosition = [number, number];

// Positions are percentages inside the card's central area.
const pipLayouts: Record<string, PipPosition[]> = {
  '2': [[50, 15], [50, 85]],
  '3': [[50, 15], [50, 50], [50, 85]],
  '4': [[20, 15], [80, 15], [20, 85], [80, 85]],
  '5': [[20, 15], [80, 15], [50, 50], [20, 85], [80, 85]],
  '6': [
    [20, 15], [80, 15],
    [20, 50], [80, 50],
    [20, 85], [80, 85],
  ],
  '7': [
    [20, 15], [80, 15], [50, 32],
    [20, 50], [80, 50],
    [20, 85], [80, 85],
  ],
  '8': [
    [20, 15], [80, 15], [50, 32],
    [20, 50], [80, 50], [50, 68],
    [20, 85], [80, 85],
  ],
  '9': [
    [20, 12], [80, 12],
    [20, 37], [80, 37], [50, 50],
    [20, 63], [80, 63],
    [20, 88], [80, 88],
  ],
  '10': [
    [20, 12], [80, 12], [50, 25],
    [20, 37], [80, 37],
    [20, 63], [80, 63], [50, 75],
    [20, 88], [80, 88],
  ],
};

const suitNames: Record<string, string> = {
  '♥': 'hearts',
  '♦': 'diamonds',
  '♣': 'clubs',
  '♠': 'spades',
};

const rankNames: Record<string, string> = {
  A: 'Ace',
  J: 'Jack',
  Q: 'Queen',
  K: 'King',
};

export default function Card({ card, faceDown = false }: CardProps) {
  if (faceDown) {
    return (
      <div
        className="card card--back"
        role="img"
        aria-label="Face-down card"
      />
    );
  }

  const rank = String(card.rank);
  const isRed = card.suit === '♥' || card.suit === '♦';
  const pips = pipLayouts[rank];

  return (
    <div
      className={`card${isRed ? ' card--red' : ''}`}
      role="img"
      aria-label={`${rankNames[rank] ?? rank} of ${
        suitNames[card.suit] ?? card.suit
      }`}
    >
      <div className="card__corner card__corner--top" aria-hidden="true">
        <span>{rank}</span>
        <span>{card.suit}</span>
      </div>

      <div className="card__center" aria-hidden="true">
        {pips ? (
          pips.map(([x, y], index) => (
            <span
              key={index}
              className={`card__pip${y > 50 ? ' card__pip--inverted' : ''}`}
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              {card.suit}
            </span>
          ))
        ) : rank === 'A' ? (
          <span className="card__ace">{card.suit}</span>
        ) : (
          <div className="card__court">
            <span>{rank}</span>
            <span>{card.suit}</span>
          </div>
        )}
      </div>

      <div
        className="card__corner card__corner--bottom"
        aria-hidden="true"
      >
        <span>{rank}</span>
        <span>{card.suit}</span>
      </div>
    </div>
  );
}