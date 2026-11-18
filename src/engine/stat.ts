import type { GameState, Result } from "./game";
import { blackjackProfit, type BlackjackPayout } from "./rules";

export interface hand_info {
  result: Result;
  bet: number;
  doubled: boolean;
  blackjackPayout: BlackjackPayout; // the table's rule when the hand was played
}

export interface Stats {
  handsPlayed: number;   // each split hand counts as its own hand
  wins: number;          // includes blackjacks
  losses: number;
  pushes: number;
  blackjacks: number;
  surrenders: number;
  doubles: number;
  doubleWins: number;
  splits: number;        // rounds where the player split
  totalWagered: number;
  netProfit: number;
  biggestWin: number;
  biggestLoss: number;
  currentStreak: number; // > 0 wins in a row, < 0 losses in a row
  longestWinStreak: number;
  longestLossStreak: number;
}

export const stats_initalizer: Stats = {
  handsPlayed: 0, wins: 0, losses: 0, pushes: 0, blackjacks: 0, surrenders: 0,
  doubles: 0, doubleWins: 0, splits: 0, totalWagered: 0, netProfit: 0,
  biggestWin: 0, biggestLoss: 0, currentStreak: 0, longestWinStreak: 0, longestLossStreak: 0,
};

// Betting and Free Play are tracked separately; Free Play's money fields stay 0
export interface AccountStats {
  betting: Stats;
  freePlay: Stats;
}
export type StatsMode = keyof AccountStats;

export const emptyAccountStats: AccountStats = { betting: stats_initalizer, freePlay: stats_initalizer };

// Everything needed to record one finished round, captured when it finishes
export interface RoundRecord {
  mode: StatsMode;
  split: boolean;
  hands: hand_info[];
}

export function profit_hand(hand: hand_info): number {
  switch (hand.result) {
    case "blackjack": return blackjackProfit(hand.bet, hand.blackjackPayout);
    case "win": return hand.bet;
    case "push": return 0;
    case "lose": return -hand.bet;
    // Half the bet comes back, rounded down like the table settles it
    case "surrender": return Math.floor(hand.bet / 2) - hand.bet;
  }
}

export function hand_record(stats: Stats, hand: hand_info): Stats {
  const profit = profit_hand(hand);
  const won = hand.result === "win" || hand.result === "blackjack";
  const lost = hand.result === "lose" || hand.result === "surrender";
  // A push leaves the streak as it is; a surrender counts as a loss for streaks
  const streak = won ? Math.max(stats.currentStreak, 0) + 1
    : lost ? Math.min(stats.currentStreak, 0) - 1
    : stats.currentStreak;
  return {
    handsPlayed: stats.handsPlayed + 1,
    wins: stats.wins + (won ? 1 : 0),
    losses: stats.losses + (hand.result === "lose" ? 1 : 0),
    pushes: stats.pushes + (hand.result === "push" ? 1 : 0),
    blackjacks: stats.blackjacks + (hand.result === "blackjack" ? 1 : 0),
    surrenders: stats.surrenders + (hand.result === "surrender" ? 1 : 0),
    doubles: stats.doubles + (hand.doubled ? 1 : 0),
    doubleWins: stats.doubleWins + (hand.doubled && won ? 1 : 0),
    splits: stats.splits,
    totalWagered: stats.totalWagered + hand.bet,
    netProfit: stats.netProfit + profit,
    biggestWin: Math.max(stats.biggestWin, profit),
    biggestLoss: Math.max(stats.biggestLoss, -profit),
    currentStreak: streak,
    longestWinStreak: Math.max(stats.longestWinStreak, streak),
    longestLossStreak: Math.max(stats.longestLossStreak, -streak),
  };
}

// Turns a finished round into per-hand records. Split hands each count as a hand.
// The bet already includes any double (lastRound.wager / the split hand's bet).
export function roundRecord(state: GameState): RoundRecord | null {
  if (state.phase !== "done" || !state.result) return null;
  const blackjackPayout = state.rules.blackjackPayout;
  const split = state.splitHands.length > 0;
  const hands: hand_info[] = split
    ? state.splitHands.map((hand) => ({ result: hand.result!, bet: hand.bet, doubled: hand.doubled, blackjackPayout }))
    : [{ result: state.result, bet: state.lastRound?.wager ?? 0, doubled: state.doubled, blackjackPayout }];
  return { mode: state.freePlay ? "freePlay" : "betting", split, hands };
}

export function recordRound(stats: AccountStats, round: RoundRecord): AccountStats {
  let mode = round.hands.reduce(hand_record, stats[round.mode]);
  if (round.split) mode = { ...mode, splits: mode.splits + 1 };
  return { ...stats, [round.mode]: mode };
}

// Saved data may come from an older version: missing or invalid fields fall back to 0 one by one
function normalizeStats(raw: unknown): Stats {
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const result = { ...stats_initalizer };
  for (const key of Object.keys(result) as (keyof Stats)[]) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) result[key] = value;
  }
  return result;
}

export function normalizeAccountStats(raw: unknown): AccountStats {
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return { betting: normalizeStats(source.betting), freePlay: normalizeStats(source.freePlay) };
}
