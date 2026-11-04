import type { Result } from "./game";

export interface hand_info {
  result: Result;
  bet: number;
  doubled: boolean;
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
  currentStreal: number;
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
  currentStreal: 0,
  longestWinStreak: 0,
  longestLossStreak: 0,
};
