import type { Card, Rank, Suit } from './types';

const SUITS: Suit[] = ['♠', '♥', '♦', '♣'];
const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export const DEFAULT_SHOE_DECKS = 6;
export const CUT_CARD_THRESHOLD = 78

export function createDeck(): Card[] {
  return SUITS.flatMap((suit) => RANKS.map((rank) => ({ rank, suit })));
}

export function createShoe(numDecks: number = DEFAULT_SHOE_DECKS): Card[] {
  return Array.from({ length: numDecks }, () => createDeck()).flat();
}

// Fisher–Yates shuffle: returns a new shuffled array
export function shuffle(cards: Card[]): Card[] {
  const deck = [...cards];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

// Takes the top card without mutating the deck: returns the card and the remaining cards
export function draw(deck: Card[]): { card: Card; rest: Card[] } {
  if (deck.length === 0) throw new Error('Cannot draw from an empty deck');
  const [card, ...rest] = deck;
  return { card, rest };
}