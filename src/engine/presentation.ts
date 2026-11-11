import type { GameState } from './game';
import { handValue, isBlackjack } from './hand';
import { reshuffleThreshold } from './rules';

export function shoeStatus(state: GameState) {
  const total = state.rules.numDecks * 52;
  // An empty shoe means a new one will be created at the next deal.
  const remaining = state.deck.length || total;
  // After a split, playerHand is only the active hand, so count every split hand instead
  const playerCards = state.splitHands.length > 0
    ? state.splitHands.reduce((count, hand) => count + hand.cards.length, 0)
    : state.playerHand.length;
  const inPlay = state.phase === 'playerTurn' || state.phase === 'dealerTurn'
    ? playerCards + state.dealerHand.length : 0;
  return {
    total,
    remaining,
    discarded: Math.max(0, total - remaining - inPlay),
    remainingPercent: remaining / total * 100,
    cutPercent: reshuffleThreshold(state.rules) / total * 100,
    reshuffleNext: state.deck.length > 0 && remaining < reshuffleThreshold(state.rules),
  };
}

const splitOutcome = { win: 'wins', lose: 'loses', push: 'pushes', blackjack: 'wins', surrender: 'surrenders' } as const;

export function resultReason(state: GameState): string {
  if (state.splitHands.length > 0) {
    const hands = state.splitHands.map((hand, index) =>
      `Hand ${index + 1} ${hand.result ? splitOutcome[hand.result] : 'is unsettled'}`);
    return `${hands.join(', ')}.`;
  }
  const player = handValue(state.playerHand).total;
  const dealer = handValue(state.dealerHand).total;
  if (state.result === 'surrender') {
    return `You surrendered your ${player}${state.freePlay ? '' : ' and got half your bet back'}.`;
  }
  if (isBlackjack(state.playerHand) && isBlackjack(state.dealerHand)) return 'You and the dealer both have blackjack.';
  if (isBlackjack(state.dealerHand)) return 'The dealer has blackjack.';
  if (isBlackjack(state.playerHand)) return 'An ace and a ten-value card: blackjack.';
  if (player > 21) return `Your ${player} is over 21. You bust.`;
  if (dealer > 21) return `The dealer busts with ${dealer}.`;
  if (player === dealer) return `You and the dealer both have ${player}.`;
  return player > dealer ? `Your ${player} beats dealer ${dealer}.` : `Dealer ${dealer} beats your ${player}.`;
}
