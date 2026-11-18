import { DEFAULT_HOUSE_RULES, normalizeHouseRules, type HouseRules } from './engine/rules';

const STORAGE_KEY = 'bjt.houseRules';

// Reads saved house rules. Invalid or missing fields fall back to their defaults one by one,
// so rules saved by an older version of the app still load.
export function loadHouseRules(): HouseRules {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return normalizeHouseRules(JSON.parse(raw));
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

// The bankroll setting is saved separately: it's a player preference, not a house rule
const NEGATIVE_BALANCE_KEY = 'bjt.allowNegativeBalance';

export function loadAllowNegativeBalance(): boolean {
  try {
    return localStorage.getItem(NEGATIVE_BALANCE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function saveAllowNegativeBalance(enabled: boolean): void {
  try {
    localStorage.setItem(NEGATIVE_BALANCE_KEY, String(enabled));
  } catch {
    // Storage full or blocked; the setting still applies for this session
  }
}
