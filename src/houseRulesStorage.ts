import { DEFAULT_HOUSE_RULES, isValidHouseRules, type HouseRules } from './engine/rules';

const STORAGE_KEY = 'bjt.houseRules';

// Reads saved house rules, falling back to the defaults if nothing valid is stored
export function loadHouseRules(): HouseRules {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isValidHouseRules(parsed)) return parsed;
    }
  } catch {
    // Corrupt JSON or storage unavailable: use the defaults
  }
  return DEFAULT_HOUSE_RULES;
}

export function saveHouseRules(rules: HouseRules): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
  } catch {
    // Storage full or blocked; the settings still apply for this session
  }
}
