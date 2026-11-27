import type { Card } from './types';
import type { GameState } from './game';

export type HiLoValue = -1 | 0 | 1;

// Standard Hi-Lo system: 2–6 = +1, 7–9 = 0, 10–A = -1
export function hiLoValue(card: Card): HiLoValue {
  const rank = String(card.rank).toUpperCase();
  if (['2', '3', '4', '5', '6'].includes(rank)) return 1;
  if (['7', '8', '9'].includes(rank)) return 0;
  return -1; // 10, T, J, Q, K, A
}

export function formatSignedCount(value: number): string {
  if (value > 0) return `+${value}`;
  return String(value);
}

export function sumHiLo(cards: Card[]): number {
  return cards.reduce((sum, card) => sum + hiLoValue(card), 0);
}

// Extracts all currently face-up cards on the felt so the dealer's face-down hole card isn't counted early
export function getVisibleTableCards(state: GameState, holeDown: boolean): Card[] {
  if (state.phase === 'idle') return [];

  const dealerVisible = holeDown ? state.dealerHand.slice(0, 1) : state.dealerHand;
  const playerVisible =
    state.splitHands.length > 0
      ? state.splitHands.flatMap((hand) => hand.cards)
      : state.playerHand;

  return [...dealerVisible, ...playerVisible];
}

// True Count = Running Count / Decks Remaining (rounded to nearest 0.5 or integer)
export function calculateTrueCount(runningCount: number, remainingCards: number): number {
  const decksRemaining = Math.max(0.5, remainingCards / 52);
  return Math.round((runningCount / decksRemaining) * 10) / 10;
}

// Recommended bet sizing in units based on the True Count (1 unit when TC <= +1, ramps up as TC rises)
export function recommendedBetUnits(trueCount: number): { units: number; advice: string } {
  const flooredTC = Math.floor(trueCount);
  if (flooredTC <= 1) {
    return { units: 1, advice: 'House has the edge — bet the table minimum (1 unit).' };
  }
  if (flooredTC === 2) {
    return { units: 2, advice: 'Slight player edge (+0.5%) — raise bet to 2 units.' };
  }
  if (flooredTC === 3) {
    return { units: 4, advice: 'Solid player edge (+1.0%) — raise bet to 4 units.' };
  }
  if (flooredTC === 4) {
    return { units: 6, advice: 'Strong player edge (+1.5%) — raise bet to 6 units.' };
  }
  return { units: 8, advice: 'Maximum advantage (+2.0%+) — bet your top spread (8+ units).' };
}