import type { Card } from './types';
import { createShoe, draw, shuffle } from './shoe';
import {
  DEFAULT_HOUSE_RULES,
  MIN_CARDS_BEFORE_RESHUFFLE,
  reshuffleThreshold,
  type HouseRules,
} from './rules';
import { handValue, isBlackjack, isBust } from './hand';
import { INITIAL_BALANCE, BANKRUPT_BAILOUT, type ChipValue } from './types';

// 'dealerTurn' is part of the model, but for now the dealer plays instantly inside STAND,
// so the state never rests in it. It's there for later (e.g. animating dealer draws).
export type Phase = "idle" | "playerTurn" | "dealerTurn" | "done";

export type Result = "win" | "lose" | "push" | "blackjack";

export interface RoundSummary {
  wager: number;
  returned: number;
  profit: number;
  bailout: number;
  freePlay: boolean;
}

export interface GameState {
  deck: Card[];
  playerHand: Card[];
  dealerHand: Card[]; // dealerHand[1] is the hole card, hidden during the player's turn
  phase: Phase;
  result: Result | null; // set only when phase is 'done'
  balance: number;
  currentBet: number;
  bailoutTriggered?: boolean;
  doubled: boolean;
  lastbet: number;
  lastRound: RoundSummary | null;
  freePlay: boolean; // no chips at stake; the bankroll is left untouched until betting resumes
  rules: HouseRules;
}

// DEAL carries its own shuffled deck so the reducer stays pure (no randomness inside it).
// Use createDealAction() in the UI; tests can pass a stacked deck instead.
export type GameAction =
  | { type: 'DEAL'; deck: Card[] }
  | { type: 'REBET_AND_DEAL'; deck: Card[] }
  | { type: 'HIT' }
  | { type: 'STAND' }
  | { type: 'DOUBLE' }
  | { type: 'PLACE_BET'; amount: ChipValue }
  | { type: 'CLEAR_BET' }
  | { type: 'SET_FREE_PLAY'; enabled: boolean }
  | { type: 'SET_HOUSE_RULES'; rules: HouseRules };

export const initialState: GameState = {
  deck: [],
  playerHand: [],
  dealerHand: [],
  phase: "idle",
  result: null,
  balance: INITIAL_BALANCE, // 500
  currentBet: 0,
  bailoutTriggered: false,
  doubled: false,
  lastbet: 0,
  lastRound: null,
  freePlay: false,
  rules: DEFAULT_HOUSE_RULES,
};

// Supplies a freshly shuffled shoe for the current house rules; DEAL only uses it once the current shoe hits the cut card
export function createDealAction(
  rules: HouseRules = DEFAULT_HOUSE_RULES,
  type: 'DEAL' | 'REBET_AND_DEAL' = 'DEAL',
): GameAction {
  return { type, deck: shuffle(createShoe(rules.numDecks)) };
}

export function openingWager(state: GameState): number {
  return state.lastbet / (state.doubled ? 2 : 1);
}

export function canRebet(state: GameState): boolean {
  const amount = openingWager(state);
  return state.phase === 'done' && !state.freePlay && state.currentBet === 0 &&
    amount > 0 && state.balance >= amount;
}

// Shared by settlement and the UI so displayed winnings use the same rounding.
export function returnedChips(wager: number, result: Result): number {
  if (result === 'blackjack') return wager + Math.floor(wager * 1.5);
  if (result === 'win') return wager * 2;
  if (result === 'push') return wager;
  return 0;
}

// Doubling is only allowed on the first two cards, and in betting mode only if the balance covers the extra bet
export function canDouble(state: GameState): boolean {
  return (
    state.phase === "playerTurn" &&
    state.playerHand.length === 2 &&
    (state.freePlay || state.balance >= state.currentBet)
  );
}

// Decides the outcome from the player's point of view once the hand is over
export function decideResult(playerHand: Card[], dealerHand: Card[]): Result {
  const playerBlackjack = isBlackjack(playerHand);
  const dealerBlackjack = isBlackjack(dealerHand);

  if (playerBlackjack && dealerBlackjack) return "push";
  if (playerBlackjack) return "blackjack";
  if (dealerBlackjack) return "lose";
  if (isBust(playerHand)) return "lose";
  if (isBust(dealerHand)) return "win";

  const player = handValue(playerHand).total;
  const dealer = handValue(dealerHand).total;
  if (player > dealer) return "win";
  if (player < dealer) return "lose";
  return "push";
}

// Ends the hand: reveals everything and records the result
function finish(state: GameState): GameState {
  const result = decideResult(state.playerHand, state.dealerHand);

  // Free play has nothing to settle, so the balance stays as it was
  if (state.freePlay) {
    return {
      ...state,
      phase: "done",
      result,
      lastbet: 0,
      lastRound: { wager: 0, returned: 0, profit: 0, bailout: 0, freePlay: true },
      bailoutTriggered: false,
    };
  }

  const { nextBalance, bailoutTriggered } = settleRoundBet(
    state.balance,
    state.currentBet,
    result,
  );

  return {
    ...state,
    phase: "done",
    result,
    balance: nextBalance,
    lastbet: state.currentBet,
    lastRound: {
      wager: state.currentBet,
      returned: returnedChips(state.currentBet, result),
      profit: returnedChips(state.currentBet, result) - state.currentBet,
      bailout: bailoutTriggered ? BANKRUPT_BAILOUT : 0,
      freePlay: false,
    },
    currentBet: 0,
    bailoutTriggered,
  };
}
function dealerPlays(state: GameState): GameState {
  let deck = state.deck;
  const dealerHand = [...state.dealerHand];
  while (handValue(dealerHand).total < 17) {
    const { card, rest } = draw(deck);
    dealerHand.push(card);
    deck = rest;
  }
  return finish({ ...state, deck, dealerHand });
}
export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'REBET_AND_DEAL': {
      if (!canRebet(state)) return state;
      const amount = openingWager(state);
      return gameReducer({
        ...state,
        balance: state.balance - amount,
        currentBet: amount,
      }, { type: 'DEAL', deck: action.deck });
    }
    case "DEAL": {
      // Can't deal in the middle of a hand
      if (
        state.phase === "playerTurn" ||
        state.phase === "dealerTurn" ||
        (state.currentBet === 0 && !state.freePlay)
      )
        return state;

      // Deal in casino order: player, dealer, player, dealer
      const isStackedTestDeck = action.deck.length < MIN_CARDS_BEFORE_RESHUFFLE;
      const needsReshuffle =
        state.deck.length < reshuffleThreshold(state.rules) || isStackedTestDeck;
      let deck = needsReshuffle ? action.deck : state.deck;
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
        phase: "playerTurn",
        result: null,
        balance: state.balance,
        currentBet: state.currentBet,
        bailoutTriggered: false,
        lastbet: state.lastbet,
        lastRound: null,
        doubled: false,
        freePlay: state.freePlay,
        rules: state.rules,
      };

      // A blackjack on either side ends the hand immediately
      if (isBlackjack(next.playerHand) || isBlackjack(next.dealerHand))
        return finish(next);
      return next;
    }

    case "HIT": {
      if (state.phase !== "playerTurn") return state;

      const { card, rest } = draw(state.deck);
      const next = {
        ...state,
        deck: rest,
        playerHand: [...state.playerHand, card],
      };

      // Busting ends the hand right away; the dealer doesn't need to play
      if (isBust(next.playerHand)) return finish(next);
      return next;
    }

    case "STAND": {
      if (state.phase !== "playerTurn") return state;
      return dealerPlays(state);
    }

    case "DOUBLE": {
      if (!canDouble(state)) return state;

      const { card, rest } = draw(state.deck);
      const next = {
        ...state,
        deck: rest,
        playerHand: [...state.playerHand, card],
        doubled: true,
        // Free play has no bet to double
        balance: state.freePlay
          ? state.balance
          : state.balance - state.currentBet,
        currentBet: state.freePlay ? state.currentBet : state.currentBet * 2,
      };

      // Exactly one card, then the turn is over
      if (isBust(next.playerHand)) return finish(next);
      return dealerPlays(next);
    }

    case "PLACE_BET": {
      if (
        (state.phase !== "idle" && state.phase !== "done") ||
        state.freePlay ||
        state.balance < action.amount
      ) {
        return state;
      }
      return {
        ...state,
        balance: state.balance - action.amount,
        currentBet: state.currentBet + action.amount,
        bailoutTriggered: false,
      };
    }

    case "CLEAR_BET": {
      if (
        (state.phase !== "idle" && state.phase !== "done") ||
        state.freePlay
      ) {
        return state;
      }
      return {
        ...state,
        balance: state.balance + state.currentBet,
        currentBet: 0,
      };
    }

    case "SET_FREE_PLAY": {
      // Mode can only change between hands
      if (
        (state.phase !== "idle" && state.phase !== "done") ||
        state.freePlay === action.enabled
      ) {
        return state;
      }
      // Entering free play refunds any chips already on the table
      return {
        ...state,
        freePlay: action.enabled,
        balance: state.balance + state.currentBet,
        currentBet: 0,
        bailoutTriggered: false,
      };
    }

    case "SET_HOUSE_RULES": {
      // House rules can only change between hands
      if (state.phase !== "idle" && state.phase !== "done") return state;
      // A different deck count means a different shoe, so drop the current one;
      // the empty deck forces a fresh shuffle on the next DEAL
      const decksChanged = action.rules.numDecks !== state.rules.numDecks;
      return {
        ...state,
        rules: action.rules,
        deck: decksChanged ? [] : state.deck,
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
  outcome: "blackjack" | "win" | "push" | "lose",
): { nextBalance: number; bailoutTriggered: boolean } {
  let nextBalance = balance + returnedChips(currentBet, outcome);

  // Automatic Bankruptcy Bailout: If balance hits $0 after losing, grant $100
  let bailoutTriggered = false;
  if (nextBalance <= 0) {
    nextBalance = BANKRUPT_BAILOUT;
    bailoutTriggered = true;
  }

  return { nextBalance, bailoutTriggered };
}
