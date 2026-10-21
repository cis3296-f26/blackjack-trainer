import type { Card } from './types';
import { createDeck, draw, shuffle } from './shoe';
import { handValue, isBlackjack, isBust } from './hand';
import { INITIAL_BALANCE, BANKRUPT_BAILOUT, type ChipValue } from './types';

// 'dealerTurn' is part of the model, but for now the dealer plays instantly inside STAND,
// so the state never rests in it. It's there for later (e.g. animating dealer draws).
export type Phase = 'idle' | 'playerTurn' | 'dealerTurn' | 'done';

export type Result = 'win' | 'lose' | 'push' | 'blackjack';

export interface GameState {
  deck: Card[];
  playerHand: Card[];
  dealerHand: Card[]; // dealerHand[1] is the hole card, hidden during the player's turn
  phase: Phase;
  result: Result | null; // set only when phase is 'done'
  balance: number;
  currentBet: number;
  bailoutTriggered?: boolean;
}

// DEAL carries its own shuffled deck so the reducer stays pure (no randomness inside it).
// Use createDealAction() in the UI; tests can pass a stacked deck instead.
export type GameAction =
  | { type: 'DEAL'; deck: Card[] }
  | { type: 'HIT' }
  | { type: 'STAND' }
  | { type: 'PLACE_BET'; amount: ChipValue }
  | { type: 'CLEAR_BET' };

export const initialState: GameState = {
  deck: [],
  playerHand: [],
  dealerHand: [],
  phase: 'idle',
  result: null,
  balance: INITIAL_BALANCE, // 500
  currentBet: 0,
  bailoutTriggered: false,
};

// v0.1 rule: one standard 52-card deck, freshly shuffled every hand
export function createDealAction(): GameAction {
  return { type: 'DEAL', deck: shuffle(createDeck()) };
}

// Decides the outcome from the player's point of view once the hand is over
export function decideResult(playerHand: Card[], dealerHand: Card[]): Result {
  const playerBlackjack = isBlackjack(playerHand);
  const dealerBlackjack = isBlackjack(dealerHand);

  if (playerBlackjack && dealerBlackjack) return 'push';
  if (playerBlackjack) return 'blackjack';
  if (dealerBlackjack) return 'lose';
  if (isBust(playerHand)) return 'lose';
  if (isBust(dealerHand)) return 'win';

  const player = handValue(playerHand).total;
  const dealer = handValue(dealerHand).total;
  if (player > dealer) return 'win';
  if (player < dealer) return 'lose';
  return 'push';
}

// Ends the hand: reveals everything and records the result
function finish(state: GameState): GameState {
  const result = decideResult(state.playerHand, state.dealerHand);
  const { nextBalance, bailoutTriggered } = settleRoundBet(
    state.balance,
    state.currentBet,
    result
  );

  return {
    ...state,
    phase: 'done',
    result,
    balance: nextBalance,
    currentBet: 0,
    bailoutTriggered,
  };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'DEAL': {
      // Can't deal in the middle of a hand
      if (state.phase === 'playerTurn' || state.phase === 'dealerTurn') return state;

      // Deal in casino order: player, dealer, player, dealer
      let deck = action.deck;
      const dealt: Card[] = [];
      for (let i = 0; i < 4; i++) {
        const { card, rest } = draw(deck);
        dealt.push(card);
        deck = rest;
      }

      const next: GameState = {
        deck,
        playerHand: [dealt[0], dealt[2]],
        dealerHand: [dealt[1], dealt[3]],
        phase: 'playerTurn',
        result: null,
        balance: state.balance,
        currentBet: state.currentBet,
        bailoutTriggered: state.bailoutTriggered,
      };

      // A blackjack on either side ends the hand immediately
      if (isBlackjack(next.playerHand) || isBlackjack(next.dealerHand)) return finish(next);
      return next;
    }

    case 'HIT': {
      if (state.phase !== 'playerTurn') return state;

      const { card, rest } = draw(state.deck);
      const next = { ...state, deck: rest, playerHand: [...state.playerHand, card] };

      // Busting ends the hand right away; the dealer doesn't need to play
      if (isBust(next.playerHand)) return finish(next);
      return next;
    }

    case 'STAND': {
      if (state.phase !== 'playerTurn') return state;

      // Dealer draws until 17 or more, standing on all 17s (including soft 17)
      let deck = state.deck;
      const dealerHand = [...state.dealerHand];
      while (handValue(dealerHand).total < 17) {
        const { card, rest } = draw(deck);
        dealerHand.push(card);
        deck = rest;
      }

      return finish({ ...state, deck, dealerHand });
    }

    case 'PLACE_BET': {
      if ((state.phase !== 'idle' && state.phase !== 'done') || state.balance < action.amount) {
        return state;
      }
      return {
        ...state,
        balance: state.balance - action.amount,
        currentBet: state.currentBet + action.amount,
        bailoutTriggered: false,
      };
    }

    case 'CLEAR_BET': {
      if (state.phase !== 'idle' && state.phase !== 'done') {
        return state;
      }
      return {
        ...state,
        balance: state.balance + state.currentBet,
        currentBet: 0,
      };
    }
  }
}

export const initialBettingState = {
  balance: INITIAL_BALANCE, // Starts at $500
  currentBet: 0,
  bailoutTriggered: false,
};

// 2. Helper function to settle bets and check for bankruptcy when a hand finishes:
export function settleRoundBet(
  balance: number,
  currentBet: number,
  outcome: 'blackjack' | 'win' | 'push' | 'lose'
): { nextBalance: number; bailoutTriggered: boolean } {
  let nextBalance = balance;

  switch (outcome) {
    case 'blackjack':
      // Blackjack pays 3:2 (original bet returned + 1.5x winnings)
      nextBalance += currentBet + Math.floor(currentBet * 1.5);
      break;
    case 'win':
      // Standard win pays 1:1 (original bet returned + 1x winnings)
      nextBalance += currentBet * 2;
      break;
    case 'push':
      // Tie returns the original bet
      nextBalance += currentBet;
      break;
    case 'lose':
      // Bet was already deducted from balance when placed
      break;
  }

  // Automatic Bankruptcy Bailout: If balance hits $0 after losing, grant $100
  let bailoutTriggered = false;
  if (nextBalance <= 0) {
    nextBalance = BANKRUPT_BAILOUT;
    bailoutTriggered = true;
  }

  return { nextBalance, bailoutTriggered };
}