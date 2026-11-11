import { DEFAULT_SHOE_DECKS } from './shoe';

// House settings that differ from casino to casino and that the engine can actually vary
export const DECK_OPTIONS = [1, 2, 4, 6, 8] as const;
export type DeckCount = (typeof DECK_OPTIONS)[number];

export interface HouseRules {
  numDecks: DeckCount;
  penetration: number; // fraction of the shoe dealt before reshuffling, e.g. 0.75
}

export const PENETRATION_MIN = 0.5;
export const PENETRATION_MAX = 0.8;
export const PENETRATION_STEP = 0.05;

// Never deal deeper than this, so even a single deck can't run out in the middle of a hand
export const MIN_CARDS_BEFORE_RESHUFFLE = 20;

export const DEFAULT_HOUSE_RULES: HouseRules = {
  numDecks: DEFAULT_SHOE_DECKS,
  penetration: 0.75,
};

// Rules the engine plays by but can't vary yet. Keep this in sync with game.ts.
export const FIXED_TABLE_RULES: string[] = [
  'Dealer stands on all 17s',
  'Blackjack pays 3:2',
  'Dealer peeks for blackjack',
  'Double on any first two cards',
  'Split equal-value cards once per round (no resplitting)',
  'Double after split is allowed',
  'Split aces receive one card each; split 21 pays 1:1',
  'Surrender and insurance are not offered',
];

// Cards left in the shoe when the cut card comes out. 6 decks at 75% gives 78.
export function reshuffleThreshold(rules: HouseRules): number {
  return Math.max(
    MIN_CARDS_BEFORE_RESHUFFLE,
    Math.round(52 * rules.numDecks * (1 - rules.penetration)),
  );
}

export function isValidHouseRules(value: unknown): value is HouseRules {
  if (typeof value !== 'object' || value === null) return false;
  const { numDecks, penetration } = value as Record<string, unknown>;
  return (
    (DECK_OPTIONS as readonly unknown[]).includes(numDecks) &&
    typeof penetration === 'number' &&
    penetration >= PENETRATION_MIN - 1e-9 &&
    penetration <= PENETRATION_MAX + 1e-9
  );
}
