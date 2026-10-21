import type { Card } from "./types";
import { createDeck, draw, shuffle } from "./shoe";
import { handValue, isBlackjack, isBust } from "./hand";

// 'dealerTurn' is part of the model, but for now the dealer plays instantly inside STAND,
// so the state never rests in it. It's there for later (e.g. animating dealer draws).
export type Phase = "idle" | "playerTurn" | "dealerTurn" | "done";

export type Result = "win" | "lose" | "push" | "blackjack";

export interface GameState {
  deck: Card[];
  playerHand: Card[];
  dealerHand: Card[]; // dealerHand[1] is the hole card, hidden during the player's turn
  phase: Phase;
  result: Result | null; // set only when phase is 'done'
  doubled: boolean;
}

// DEAL carries its own shuffled deck so the reducer stays pure (no randomness inside it).
// Use createDealAction() in the UI; tests can pass a stacked deck instead.
export type GameAction =
  | { type: "DEAL"; deck: Card[] }
  | { type: "HIT" }
  | { type: "STAND" }
  | { type: "DOUBLE" };

export const initialState: GameState = {
  deck: [],
  playerHand: [],
  dealerHand: [],
  phase: "idle",
  result: null,
  doubled: false,
};

// v0.1 rule: one standard 52-card deck, freshly shuffled every hand
export function createDealAction(): GameAction {
  return { type: "DEAL", deck: shuffle(createDeck()) };
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
  return {
    ...state,
    phase: "done",
    result: decideResult(state.playerHand, state.dealerHand),
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
    case "DEAL": {
      // Can't deal in the middle of a hand
      if (state.phase === "playerTurn" || state.phase === "dealerTurn")
        return state;

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
        phase: "playerTurn",
        result: null,
        doubled: false,
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
      // Only allowed on the first two cards
      if (state.phase !== "playerTurn" || state.playerHand.length !== 2)
        return state;

      const { card, rest } = draw(state.deck);
      const next = {
        ...state,
        deck: rest,
        playerHand: [...state.playerHand, card],
        doubled: true,
      };

      // Exactly one card, then the turn is over
      if (isBust(next.playerHand)) return finish(next);
      return dealerPlays(next);
    }
  }
}
