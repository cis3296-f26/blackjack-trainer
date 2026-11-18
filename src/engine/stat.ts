import type { Result } from "./game";
import { blackjackProfit, type BlackjackPayout } from "./rules";

export interface hand_info {
  result: Result;
  bet: number;
  doubled: boolean;
  blackjackPayout: BlackjackPayout; // the table's rule when the hand was played
}

export interface Stats {
  handsPlayed: number;
  wins: number;
  losses: number;
  pushes: number;
  blackjacks: number;
  doubles: number;
  doubleWins: number;
  totalWagered: number;
  netProfit: number;
  biggestWin: number;
  biggestLoss: number;
  currentStreak: number;
  longestWinStreak: number;
  longestLossStreak: number;
}

export const stats_initalizer: Stats = {
  handsPlayed: 0,
  wins: 0,
  losses: 0,
  pushes: 0,
  blackjacks: 0,
  doubles: 0,
  doubleWins: 0,
  totalWagered: 0,
  netProfit: 0,
  biggestWin: 0,
  biggestLoss: 0,
  currentStreak: 0,
  longestWinStreak: 0,
  longestLossStreak: 0,
};

export function profit_hand(hand: hand_info): number {
  switch (hand.result) {
    case "blackjack":
      return blackjackProfit(hand.bet, hand.blackjackPayout);
    case "win":
      return hand.bet;
    case "push":
      return 0;
    case "lose":
      return -hand.bet;
    case "surrender":
      // Half the bet comes back, rounded down like the table settles it
      return Math.floor(hand.bet / 2) - hand.bet;
  }
}

export function hand_record(stats: Stats, hand: hand_info) {
  const profit = profit_hand(hand);
  const won = hand.result === "win" || hand.result === "blackjack";
  const loss = hand.result === "lose";
  let streak = 0;
  if (won) stats.currentStreak > 0 ? stats.currentStreak + 1 : 1;
  if (loss) stats.currentStreak > 0 ? stats.currentStreak - 1 : -1;
  return {
    handsPlayed: stats.handsPlayed + 1,
    wins: stats.wins + (won ? 1 : 0),
    losses: stats.losses + (loss ? 1 : 0),
    pushes: stats.pushes + (hand.result === "push" ? 1 : 0),
    blackjacks: stats.blackjacks + (hand.result === "blackjack" ? 1 : 0),
    doubles: stats.doubles + (hand.doubled ? 1 : 0),
    doubleWins: stats.doubleWins + (hand.doubled && won ? 1 : 0),
    totalWagered: stats.totalWagered + hand.bet,
    netProfit: stats.netProfit + profit,
    biggestWin: Math.max(stats.biggestWin, profit),
    biggestLoss: Math.max(stats.biggestLoss, -profit),
    currentStreak: streak,
    longestWinStreak: Math.max(stats.longestWinStreak, streak),
    longestLossStreak: Math.max(stats.longestLossStreak, -streak),
  };
}
