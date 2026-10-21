import type { Card } from './types';

export interface HandValue {
  total: number;
  soft: boolean; // true if an ace is still counted as 11
}

function cardValue(card: Card): number {
  if (card.rank === 'A') return 11;
  if (card.rank === 'J' || card.rank === 'Q' || card.rank === 'K') return 10;
  return Number(card.rank);
}

export function handValue(cards: Card[]): HandValue {
  let total = 0;
  let acesAsEleven = 0;

  for (const card of cards) {
    total += cardValue(card);
    if (card.rank === 'A') acesAsEleven++;
  }

  // Turn aces from 11 into 1, one at a time, while the hand is over 21
  while (total > 21 && acesAsEleven > 0) {
    total -= 10;
    acesAsEleven--;
  }

  return { total, soft: acesAsEleven > 0 };
}

export function isBust(cards: Card[]): boolean {
  return handValue(cards).total > 21;
}

export function isBlackjack(cards: Card[]): boolean {
  return cards.length === 2 && handValue(cards).total === 21;
}