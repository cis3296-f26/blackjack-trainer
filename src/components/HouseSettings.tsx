import { useEffect, useId, useRef, useState } from 'react';
import {
  BLACKJACK_PAYOUT_OPTIONS,
  DECK_OPTIONS,
  DEFAULT_HOUSE_RULES,
  FIXED_TABLE_RULES,
  HOUSE_RULE_PRESETS,
  PENETRATION_MAX,
  PENETRATION_MIN,
  PENETRATION_STEP,
  findPreset,
  reshuffleThreshold,
  rulesEqual,
  type DoubleOn,
  type HouseRules,
} from '../engine/rules';
import './HouseSettings.css';

interface HouseSettingsProps {
  rules: HouseRules;
  canEdit: boolean; // only between hands
  onChange: (rules: HouseRules) => void;
}

// The slider works in whole percents so the stored fraction never picks up float noise
const toPercent = (fraction: number) => Math.round(fraction * 100);

const CUSTOM = 'custom';

const DOUBLE_ON_CHOICES: { value: DoubleOn; label: string }[] = [
  { value: 'any', label: 'Any 2' },
  { value: '9-11', label: '9–11' },
  { value: '10-11', label: '10–11' },
];

interface ChoiceGroupProps<T> {
  label: string;
  choices: readonly { value: T; label: string }[];
  value: T;
  disabled: boolean;
  onSelect: (value: T) => void;
}

// One labelled row of mutually exclusive buttons, styled like the Betting / Free play toggle
function ChoiceGroup<T extends string | number | boolean>({
  label,
  choices,
  value,
  disabled,
  onSelect,
}: ChoiceGroupProps<T>) {
  const labelId = useId();
  return (
    <div className="house-settings__field">
      <span id={labelId} className="house-settings__label">
        {label}
      </span>
      <div className="mode-toggle" role="group" aria-labelledby={labelId}>
        {choices.map((choice) => (
          <button
            key={String(choice.value)}
            type="button"
            aria-pressed={value === choice.value}
            disabled={disabled}
            onClick={() => onSelect(choice.value)}
          >
            {choice.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// Gear button plus a modal for the casino-specific table settings
export default function HouseSettings({ rules, canEdit, onChange }: HouseSettingsProps) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Keep the native <dialog> in sync with the open state; showModal gives Esc, focus and a backdrop
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const isDefault = rulesEqual(rules, DEFAULT_HOUSE_RULES);
  const preset = findPreset(rules);
  const set = (changes: Partial<HouseRules>) => onChange({ ...rules, ...changes });

  return (
    <>
      <button
        type="button"
        className="house-settings__toggle"
        onClick={() => setOpen(true)}
        aria-label="House settings"
        aria-haspopup="dialog"
        title="House Settings"
      >
        ⚙
      </button>

      <dialog
        ref={dialogRef}
        className="house-settings__dialog"
        aria-labelledby="house-settings-title"
        onClose={() => setOpen(false)}
        // Clicks on the backdrop land on the <dialog> itself, not the panel inside it
        onClick={(e) => {
          if (e.target === e.currentTarget) setOpen(false);
        }}
      >
        <div className="house-settings__panel">
          <div className="house-settings__header">
            <h2 id="house-settings-title">House Settings</h2>
            <button
              type="button"
              className="house-settings__close"
              onClick={() => setOpen(false)}
              aria-label="Close house settings"
            >
              ×
            </button>
          </div>

          {!canEdit && (
            <p className="house-settings__notice">
              Finish the current hand to change house settings.
            </p>
          )}

          <section className="house-settings__section">
            <h3>
              <label htmlFor="house-settings-preset">Casino preset</label>
            </h3>
            <select
              id="house-settings-preset"
              className="house-settings__select"
              value={preset?.id ?? CUSTOM}
              disabled={!canEdit}
              onChange={(e) => {
                const chosen = HOUSE_RULE_PRESETS.find((p) => p.id === e.target.value);
                if (chosen) onChange(chosen.rules);
              }}
            >
              {HOUSE_RULE_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
              {/* Shown when the rules have been tweaked away from every preset */}
              <option value={CUSTOM} disabled>
                Custom
              </option>
            </select>
            <p className="house-settings__help">
              {preset ? preset.description : 'Your own mix of rules.'}
            </p>
          </section>

          <section className="house-settings__section">
            <h3>Shoe</h3>
            <ChoiceGroup
              label="Number of decks"
              choices={DECK_OPTIONS.map((n) => ({ value: n, label: String(n) }))}
              value={rules.numDecks}
              disabled={!canEdit}
              onSelect={(numDecks) => set({ numDecks })}
            />
            <p className="house-settings__help">Changing decks starts a fresh shoe.</p>

            <div className="house-settings__field">
              <label htmlFor="house-settings-penetration" className="house-settings__label">
                Shoe penetration
              </label>
              <div className="house-settings__slider">
                <input
                  id="house-settings-penetration"
                  type="range"
                  min={toPercent(PENETRATION_MIN)}
                  max={toPercent(PENETRATION_MAX)}
                  step={toPercent(PENETRATION_STEP)}
                  value={toPercent(rules.penetration)}
                  disabled={!canEdit}
                  onChange={(e) => set({ penetration: Number(e.target.value) / 100 })}
                />
                <output htmlFor="house-settings-penetration">
                  {toPercent(rules.penetration)}%
                </output>
              </div>
            </div>
            <p className="house-settings__help">
              Reshuffles with ~{reshuffleThreshold(rules)} cards left in the shoe.
            </p>
          </section>

          <section className="house-settings__section">
            <h3>Dealer</h3>
            <ChoiceGroup
              label="Soft 17"
              choices={[
                { value: false, label: 'Stand' },
                { value: true, label: 'Hit' },
              ]}
              value={rules.dealerHitsSoft17}
              disabled={!canEdit}
              onSelect={(dealerHitsSoft17) => set({ dealerHitsSoft17 })}
            />
          </section>

          <section className="house-settings__section">
            <h3>Payouts</h3>
            <ChoiceGroup
              label="Blackjack pays"
              choices={BLACKJACK_PAYOUT_OPTIONS.map((p) => ({ value: p, label: p }))}
              value={rules.blackjackPayout}
              disabled={!canEdit}
              onSelect={(blackjackPayout) => set({ blackjackPayout })}
            />
          </section>

          <section className="house-settings__section">
            <h3>Player options</h3>
            <ChoiceGroup
              label="Double down on"
              choices={DOUBLE_ON_CHOICES}
              value={rules.doubleOn}
              disabled={!canEdit}
              onSelect={(doubleOn) => set({ doubleOn })}
            />
            <ul className="house-settings__rules">
              {FIXED_TABLE_RULES.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </section>

          <div className="house-settings__footer">
            <button
              type="button"
              className="house-settings__reset"
              disabled={!canEdit || isDefault}
              onClick={() => onChange(DEFAULT_HOUSE_RULES)}
            >
              Reset to defaults
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
