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
  'Split once per hand; split aces get one card each',
  'Surrender and insurance are not offered',
];

// Penetration is compared in whole percents so float noise (0.7 vs 0.7000000001) doesn't matter
const samePenetration = (a: number, b: number) => Math.round(a * 100) === Math.round(b * 100);

export function rulesEqual(a: HouseRules, b: HouseRules): boolean {
  return (
    a.numDecks === b.numDecks &&
    samePenetration(a.penetration, b.penetration) &&
    a.dealerHitsSoft17 === b.dealerHitsSoft17 &&
    a.blackjackPayout === b.blackjackPayout &&
    a.dealerPeeks === b.dealerPeeks &&
    a.doubleOn === b.doubleOn
  );
}

export interface HouseRulePreset {
  id: string;
  name: string;
  description: string;
  rules: HouseRules;
}

// Typical rule sets for common kinds of tables, so a player can match their casino in one click
export const HOUSE_RULE_PRESETS: HouseRulePreset[] = [
  {
    id: 'vegas-strip',
    name: 'Vegas Strip',
    description: '6 decks, dealer stands on soft 17, blackjack pays 3:2.',
    rules: DEFAULT_HOUSE_RULES,
  },
  {
    id: 'downtown-vegas',
    name: 'Downtown Vegas',
    description: 'Hand-pitched double deck, dealer hits soft 17, blackjack pays 3:2.',
    rules: { ...DEFAULT_HOUSE_RULES, numDecks: 2, penetration: 0.65, dealerHitsSoft17: true },
  },
  {
    id: 'atlantic-city',
    name: 'Atlantic City',
    description: '8 decks, dealer stands on soft 17, blackjack pays 3:2.',
    rules: { ...DEFAULT_HOUSE_RULES, numDecks: 8 },
  },
  {
    id: 'reno',
    name: 'Reno',
    description: '6 decks, dealer hits soft 17, double on 10 or 11 only.',
    rules: { ...DEFAULT_HOUSE_RULES, dealerHitsSoft17: true, doubleOn: '10-11' },
  },
  {
    id: 'low-limit-6-5',
    name: 'Low-limit 6:5 single deck',
    description: 'Single deck, shuffled at half, dealer hits soft 17, blackjack pays only 6:5.',
    rules: {
      ...DEFAULT_HOUSE_RULES,
      numDecks: 1,
      penetration: 0.5,
      dealerHitsSoft17: true,
      blackjackPayout: '6:5',
    },
  },
];

// The preset these rules match exactly, or undefined for a custom table
export function findPreset(rules: HouseRules): HouseRulePreset | undefined {
  return HOUSE_RULE_PRESETS.find((preset) => rulesEqual(preset.rules, rules));
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
