import type { Card as CardType } from '../engine/types';
import { handValue, isBlackjack } from '../engine/hand';
import Card from './Card';
import './Hand.css';

interface HandProps {
  title: string;
  cards: CardType[];
  hideHoleCard?: boolean; // hides the second card (the dealer's hole card)
}

// Text for a hand's total, e.g. "17", "soft 17", "Blackjack", "24 (bust)"
function describeTotal(cards: CardType[]): string {
  if (isBlackjack(cards)) return 'Blackjack';
  const { total, soft } = handValue(cards);
  if (total > 21) return `${total} (bust)`;
  return soft ? `soft ${total}` : String(total);
}

// A row of cards with a title and the hand's total.
// While the hole card is hidden, the total only counts the cards you can see.
export default function Hand({ title, cards, hideHoleCard = false }: HandProps) {
  const visibleCards = hideHoleCard ? cards.slice(0, 1) : cards;

  return (
    <section className="hand">
      <h2 className="hand__title">
        {title}
        {cards.length > 0 && <span className="hand__total">{describeTotal(visibleCards)}</span>}
      </h2>
      <div className="hand__cards">
        {cards.map((card, i) => (
          <Card key={`${card.rank}${card.suit}`} card={card} faceDown={hideHoleCard && i === 1} />
        ))}
      </div>
    </section>
  );
}
