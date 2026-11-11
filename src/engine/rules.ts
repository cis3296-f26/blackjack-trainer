import { DEFAULT_SHOE_DECKS } from './shoe';

// House settings that differ from casino to casino and that the engine can actually vary
export const DECK_OPTIONS = [1, 2, 4, 6, 8] as const;
export type DeckCount = (typeof DECK_OPTIONS)[number];

export const BLACKJACK_PAYOUT_OPTIONS = ['3:2', '6:5', '1:1'] as const;
export type BlackjackPayout = (typeof BLACKJACK_PAYOUT_OPTIONS)[number];

// Which first-two-card totals the player may double on
export const DOUBLE_ON_OPTIONS = ['any', '9-11', '10-11'] as const;
export type DoubleOn = (typeof DOUBLE_ON_OPTIONS)[number];

export interface HouseRules {
  numDecks: DeckCount;
  penetration: number; // fraction of the shoe dealt before reshuffling, e.g. 0.75
  dealerHitsSoft17: boolean; // false = S17 (stands on all 17s), true = H17
  blackjackPayout: BlackjackPayout;
  dealerPeeks: boolean; // false = European no-hole-card (ENHC)
  doubleOn: DoubleOn;
}

export const PENETRATION_MIN = 0.5;
export const PENETRATION_MAX = 0.8;
export const PENETRATION_STEP = 0.05;

// Never deal deeper than this, so even a single deck can't run out in the middle of a hand
export const MIN_CARDS_BEFORE_RESHUFFLE = 20;

export const DEFAULT_HOUSE_RULES: HouseRules = {
  numDecks: DEFAULT_SHOE_DECKS,
  penetration: 0.75,
  dealerHitsSoft17: false,
  blackjackPayout: '3:2',
  dealerPeeks: true,
  doubleOn: 'any',
};

// Winnings per unit bet on a natural, as [paid, per] so the math stays in whole numbers
// (bet * 1.2 can land a hair under the true value and floor a chip away)
const BLACKJACK_PAYOUT_RATIO: Record<BlackjackPayout, [number, number]> = {
  '3:2': [3, 2],
  '6:5': [6, 5],
  '1:1': [1, 1],
};

// Profit on a winning blackjack, rounded down to whole chips like the casino does
export function blackjackProfit(bet: number, payout: BlackjackPayout): number {
  const [paid, per] = BLACKJACK_PAYOUT_RATIO[payout];
  return Math.floor((bet * paid) / per);
}

// Whether a two-card total qualifies for doubling. Soft two-card hands are always 12 or more,
// so the 9-11 and 10-11 restrictions only ever allow hard totals.
export function doubleAllowedOnTotal(total: number, doubleOn: DoubleOn): boolean {
  switch (doubleOn) {
    case 'any':
      return true;
    case '9-11':
      return total >= 9 && total <= 11;
    case '10-11':
      return total >= 10 && total <= 11;
  }
}

// Rules the engine can't vary yet
export const FIXED_TABLE_RULES: string[] = [
  'Splitting, surrender, and insurance are not offered',
];

// Plain-English summary of the table rules (everything except the shoe settings)
export function describeRules(rules: HouseRules): string[] {
  return [
    rules.dealerHitsSoft17 ? 'Dealer hits soft 17' : 'Dealer stands on all 17s',
    `Blackjack pays ${rules.blackjackPayout}`,
    rules.dealerPeeks
      ? 'Dealer peeks for blackjack'
      : 'No hole card: dealer blackjack takes all bets, including doubles',
    {
      any: 'Double on any first two cards',
      '9-11': 'Double on hard 9, 10, or 11 only',
      '10-11': 'Double on hard 10 or 11 only',
    }[rules.doubleOn],
    ...FIXED_TABLE_RULES,
  ];
}

// Cards left in the shoe when the cut card comes out. 6 decks at 75% gives 78.
export function reshuffleThreshold(rules: HouseRules): number {
  return Math.max(
    MIN_CARDS_BEFORE_RESHUFFLE,
    Math.round(52 * rules.numDecks * (1 - rules.penetration)),
  );
}

const isOneOf = <T>(options: readonly T[], value: unknown): value is T =>
  (options as readonly unknown[]).includes(value);

// Builds a full HouseRules from untrusted input (e.g. localStorage), keeping every valid field
// and taking the default for anything missing or invalid. Rules saved before a field existed
// (older saves only had numDecks and penetration) keep their values and pick up the new defaults.
export function normalizeHouseRules(value: unknown): HouseRules {
  if (typeof value !== 'object' || value === null) return DEFAULT_HOUSE_RULES;
  const v = value as Record<string, unknown>;
  const d = DEFAULT_HOUSE_RULES;
  return {
    numDecks: isOneOf(DECK_OPTIONS, v.numDecks) ? v.numDecks : d.numDecks,
    penetration:
      typeof v.penetration === 'number' &&
      v.penetration >= PENETRATION_MIN - 1e-9 &&
      v.penetration <= PENETRATION_MAX + 1e-9
        ? v.penetration
        : d.penetration,
    dealerHitsSoft17:
      typeof v.dealerHitsSoft17 === 'boolean' ? v.dealerHitsSoft17 : d.dealerHitsSoft17,
    blackjackPayout: isOneOf(BLACKJACK_PAYOUT_OPTIONS, v.blackjackPayout)
      ? v.blackjackPayout
      : d.blackjackPayout,
    dealerPeeks: typeof v.dealerPeeks === 'boolean' ? v.dealerPeeks : d.dealerPeeks,
    doubleOn: isOneOf(DOUBLE_ON_OPTIONS, v.doubleOn) ? v.doubleOn : d.doubleOn,
  };
}
