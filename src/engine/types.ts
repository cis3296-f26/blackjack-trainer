export type Suit = '♠' | '♥' | '♦' | '♣';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export interface Card {
  rank: Rank;
  suit: Suit;
}

export type ChipValue = 1 | 5 | 25 | 100 | 500;

export const CASINO_CHIPS: { value: ChipValue; color: string; label: string }[] = [
  { value: 1, color: '#f8fafc', label: '$1' },
  { value: 5, color: '#ef4444', label: '$5' },  
  { value: 25, color: '#22c55e', label: '$25' },
  { value: 100, color: '#1e293b', label: '$100' },
  { value: 500, color: '#a855f7', label: '$500' },
];

export const INITIAL_BALANCE = 500;
export const BANKRUPT_BAILOUT = 100;

export interface BettingState {
  balance: number;
  currentBet: number;
  bailoutTriggered?: boolean;
}

export type BettingAction =
  | { type: 'PLACE_BET'; amount: ChipValue }
  | { type: 'CLEAR_BET' }
  | { type: 'ALL_IN' };