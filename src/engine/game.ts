import type { Card } from './types';
import { createShoe, draw, shuffle } from './shoe';
import {
  DEFAULT_HOUSE_RULES,
  MIN_CARDS_BEFORE_RESHUFFLE,
  blackjackProfit,
  doubleAllowedOnTotal,
  reshuffleThreshold,
  type BlackjackPayout,
  type HouseRules,
} from './rules';
import { handValue, isBlackjack, isBust } from './hand';
import { INITIAL_BALANCE, BANKRUPT_BAILOUT, type ChipValue } from './types';

// 'dealerTurn' is part of the model, but for now the dealer plays instantly inside STAND,
// so the state never rests in it. It's there for later (e.g. animating dealer draws).
export type Phase = "idle" | "playerTurn" | "dealerTurn" | "done";

export type Result = "win" | "lose" | "push" | "blackjack";

export interface SplitHand {
  cards: Card[];
  bet: number;
  doubled: boolean;
  complete: boolean;
  result: Result | null;
}

export interface GameState {
  deck: Card[];
  playerHand: Card[];
  splitHands: SplitHand[];
  activeHandIndex: number;
  dealerHand: Card[]; // dealerHand[1] is the hole card, hidden during the player's turn
  phase: Phase;
  result: Result | null; // set only when phase is 'done'
  balance: number;
  currentBet: number;
  bailoutTriggered?: boolean;
  doubled: boolean;
  lastbet: number;
  freePlay: boolean; // no chips at stake; the bankroll is left untouched until betting resumes
  rules: HouseRules;
}

// DEAL carries its own shuffled deck so the reducer stays pure (no randomness inside it).
// Use createDealAction() in the UI; tests can pass a stacked deck instead.
export type GameAction =
  | { type: 'DEAL'; deck: Card[] }
  | { type: 'HIT' }
  | { type: 'STAND' }
  | { type: 'DOUBLE' }
  | { type: 'SPLIT' }
  | { type: 'PLACE_BET'; amount: ChipValue }
  | { type: 'CLEAR_BET' }
  | { type: 'SET_FREE_PLAY'; enabled: boolean }
  | { type: 'SET_HOUSE_RULES'; rules: HouseRules };

export const initialState: GameState = {
  deck: [],
  playerHand: [],
  splitHands: [],
  activeHandIndex: 0,
  dealerHand: [],
  phase: "idle",
  result: null,
  balance: INITIAL_BALANCE, // 500
  currentBet: 0,
  bailoutTriggered: false,
  doubled: false,
  lastbet: 0,
  freePlay: false,
  rules: DEFAULT_HOUSE_RULES,
};

function activeBet(state: GameState): number {
  return state.splitHands[state.activeHandIndex]?.bet ?? state.currentBet;
}

// One split per round; any two ten-value cards are also eligible.
export function canSplit(state: GameState): boolean {
  const [first, second] = state.playerHand;
  const value = (card: Card) => ['10', 'J', 'Q', 'K'].includes(card.rank) ? '10' : card.rank;
  return state.phase === 'playerTurn' && state.splitHands.length === 0 &&
    state.playerHand.length === 2 && value(first) === value(second) &&
    (state.freePlay || state.balance >= state.currentBet);
}

// Supplies a freshly shuffled shoe for the current house rules; DEAL only uses it once the current shoe hits the cut card
export function createDealAction(rules: HouseRules = DEFAULT_HOUSE_RULES): GameAction {
  return { type: "DEAL", deck: shuffle(createShoe(rules.numDecks)) };
}

// Doubling is only allowed on the first two cards, only on totals the house allows,
// and in betting mode only if the balance covers the extra bet
export function canDouble(state: GameState): boolean {
  return (
    state.phase === "playerTurn" &&
    state.playerHand.length === 2 &&
    doubleAllowedOnTotal(handValue(state.playerHand).total, state.rules.doubleOn) &&
    (state.freePlay || state.balance >= state.currentBet)
  );
}

// The dealer draws to 16 and stands on 17, except a soft 17 under H17 rules
export function dealerShouldHit(dealerHand: Card[], rules: HouseRules): boolean {
  const { total, soft } = handValue(dealerHand);
  return total < 17 || (total === 17 && soft && rules.dealerHitsSoft17);
}

// Decides the outcome from the player's point of view once the hand is over
export function decideResult(playerHand: Card[], dealerHand: Card[], fromSplit = false): Result {
  const playerBlackjack = !fromSplit && isBlackjack(playerHand);
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
  if (state.splitHands.length > 0) {
    const splitHands = state.splitHands.map((hand) => ({
      ...hand,
      complete: true,
      // A two-card 21 after a split is a regular 21, not a natural blackjack.
      result: decideResult(hand.cards, state.dealerHand, true),
    }));
    let returned = 0;
    let profit = 0;
    for (const hand of splitHands) {
      const payout = hand.result === 'win' ? 2 : hand.result === 'push' ? 1 : 0;
      returned += hand.bet * payout;
      profit += state.freePlay ? payout - 1 : hand.bet * (payout - 1);
    }
    const balance = state.freePlay ? state.balance : state.balance + returned;
    const bailoutTriggered = !state.freePlay && balance <= 0;
    return {
      ...state,
      splitHands,
      phase: 'done',
      result: profit > 0 ? 'win' : profit < 0 ? 'lose' : 'push',
      balance: bailoutTriggered ? BANKRUPT_BAILOUT : balance,
      currentBet: 0,
      lastbet: state.freePlay ? 0 : state.currentBet,
      bailoutTriggered,
    };
  }
  const result = decideResult(state.playerHand, state.dealerHand);

  // Free play has nothing to settle, so the balance stays as it was
  if (state.freePlay) {
    return {
      ...state,
      phase: "done",
      result,
      lastbet: 0,
      bailoutTriggered: false,
    };
  }

  const { nextBalance, bailoutTriggered } = settleRoundBet(
    state.balance,
    state.currentBet,
    result,
    state.rules.blackjackPayout,
  );

  return {
    ...state,
    phase: "done",
    result,
    balance: nextBalance,
    lastbet: state.currentBet,
    currentBet: 0,
    bailoutTriggered,
  };
}

// Keep the existing playerHand field pointing at the hand the controls act on.
function saveActiveHand(state: GameState): GameState {
  if (state.splitHands.length === 0) return state;
  return {
    ...state,
    splitHands: state.splitHands.map((hand, index) => index === state.activeHandIndex
      ? { ...hand, cards: state.playerHand, doubled: state.doubled }
      : hand),
  };
}

function completeActiveHand(state: GameState): GameState {
  if (state.splitHands.length === 0) {
    return isBust(state.playerHand) ? finish(state) : dealerPlays(state);
  }
  const saved = saveActiveHand(state);
  const splitHands = saved.splitHands.map((hand, index) => index === saved.activeHandIndex
    ? { ...hand, complete: true } : hand);
  const nextIndex = splitHands.findIndex((hand) => !hand.complete);
  if (nextIndex !== -1) {
    return { ...saved, splitHands, activeHandIndex: nextIndex,
      playerHand: splitHands[nextIndex].cards, doubled: splitHands[nextIndex].doubled };
  }
  const next = { ...saved, splitHands };
  return splitHands.every((hand) => isBust(hand.cards)) ? finish(next) : dealerPlays(next);
}

function dealerPlays(state: GameState): GameState {
  let deck = state.deck;
  const dealerHand = [...state.dealerHand];
  while (dealerShouldHit(dealerHand, state.rules)) {
    const { card, rest } = draw(deck);
    dealerHand.push(card);
    deck = rest;
  }
  return finish({ ...state, deck, dealerHand });
}
export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
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
        splitHands: [],
        activeHandIndex: 0,
        dealerHand: [dealt[1], dealt[3]],
        phase: "playerTurn",
        result: null,
        balance: state.balance,
        currentBet: state.currentBet,
        bailoutTriggered: state.bailoutTriggered,
        lastbet: state.lastbet,
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

      // A bust completes this hand and advances to any remaining split hand.
      if (isBust(next.playerHand)) return completeActiveHand(next);
      return saveActiveHand(next);
    }

    case "STAND": {
      if (state.phase !== "playerTurn") return state;
      return completeActiveHand(state);
    }

    case "SPLIT": {
      if (!canSplit(state)) return state;
      const first = draw(state.deck);
      const second = draw(first.rest);
      const splitAces = state.playerHand[0].rank === 'A';
      const splitHands: SplitHand[] = state.playerHand.map((card, index) => ({
        cards: [card, index === 0 ? first.card : second.card],
        bet: state.freePlay ? 0 : state.currentBet,
        doubled: false,
        complete: splitAces,
        result: null,
      }));
      const next: GameState = {
        ...state,
        deck: second.rest,
        splitHands,
        activeHandIndex: 0,
        playerHand: splitHands[0].cards,
        doubled: false,
        balance: state.freePlay ? state.balance : state.balance - state.currentBet,
        currentBet: state.freePlay ? 0 : state.currentBet * 2,
      };
      return splitAces ? dealerPlays(next) : next;
    }

    case "DOUBLE": {
      if (!canDouble(state)) return state;

      const bet = activeBet(state);
      const { card, rest } = draw(state.deck);
      const next = {
        ...state,
        deck: rest,
        playerHand: [...state.playerHand, card],
        doubled: true,
        // Free play has no bet to double
        balance: state.freePlay
          ? state.balance
          : state.balance - bet,
        currentBet: state.freePlay ? state.currentBet : state.currentBet + bet,
        splitHands: state.splitHands.map((hand, index) => index === state.activeHandIndex
          ? { ...hand, bet: hand.bet * 2 } : hand),
      };

      // Exactly one card, then the turn is over
      return completeActiveHand(next);
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
  blackjackPayout: BlackjackPayout,
): { nextBalance: number; bailoutTriggered: boolean } {
  let nextBalance = balance;

  switch (outcome) {
    case "blackjack":
      // Original bet returned + the house's blackjack payout (3:2, 6:5 or 1:1)
      nextBalance += currentBet + blackjackProfit(currentBet, blackjackPayout);
      break;
    case "win":
      // Standard win pays 1:1 (original bet returned + 1x winnings)
      nextBalance += currentBet * 2;
      break;
    case "push":
      // Tie returns the original bet
      nextBalance += currentBet;
      break;
    case "lose":
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