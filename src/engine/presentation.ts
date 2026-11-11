import type { GameState } from './game';
import { handValue, isBlackjack } from './hand';
import { reshuffleThreshold } from './rules';

export function shoeStatus(state: GameState) {
  const total = state.rules.numDecks * 52;
  // An empty shoe means a new one will be created at the next deal.
  const remaining = state.deck.length || total;
  const inPlay = state.phase === 'playerTurn' || state.phase === 'dealerTurn'
    ? state.playerHand.length + state.dealerHand.length : 0;
  return {
    total,
    remaining,
    discarded: Math.max(0, total - remaining - inPlay),
    remainingPercent: remaining / total * 100,
    cutPercent: reshuffleThreshold(state.rules) / total * 100,
    reshuffleNext: state.deck.length > 0 && remaining < reshuffleThreshold(state.rules),
  };
}

export function resultReason(state: GameState): string {
  const player = handValue(state.playerHand).total;
  const dealer = handValue(state.dealerHand).total;
  if (isBlackjack(state.playerHand) && isBlackjack(state.dealerHand)) return 'You and the dealer both have blackjack.';
  if (isBlackjack(state.dealerHand)) return 'The dealer has blackjack.';
  if (isBlackjack(state.playerHand)) return 'An ace and a ten-value card: blackjack.';
  if (player > 21) return `Your ${player} is over 21. You bust.`;
  if (dealer > 21) return `The dealer busts with ${dealer}.`;
  if (player === dealer) return `You and the dealer both have ${player}.`;
  return player > dealer ? `Your ${player} beats dealer ${dealer}.` : `Dealer ${dealer} beats your ${player}.`;
}
