import { useEffect, useRef, useState } from 'react';
import {
  DECK_OPTIONS,
  DEFAULT_HOUSE_RULES,
  describeRules,
  PENETRATION_MAX,
  PENETRATION_MIN,
  PENETRATION_STEP,
  reshuffleThreshold,
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

  const isDefault =
    rules.numDecks === DEFAULT_HOUSE_RULES.numDecks &&
    toPercent(rules.penetration) === toPercent(DEFAULT_HOUSE_RULES.penetration);

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
            <h3>Number of decks</h3>
            <div className="mode-toggle" role="group" aria-label="Number of decks">
              {DECK_OPTIONS.map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={rules.numDecks === n}
                  disabled={!canEdit}
                  onClick={() => onChange({ ...rules, numDecks: n })}
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="house-settings__help">Changing decks starts a fresh shoe.</p>
          </section>

          <section className="house-settings__section">
            <h3>
              <label htmlFor="house-settings-penetration">Shoe penetration</label>
            </h3>
            <div className="house-settings__slider">
              <input
                id="house-settings-penetration"
                type="range"
                min={toPercent(PENETRATION_MIN)}
                max={toPercent(PENETRATION_MAX)}
                step={toPercent(PENETRATION_STEP)}
                value={toPercent(rules.penetration)}
                disabled={!canEdit}
                onChange={(e) =>
                  onChange({ ...rules, penetration: Number(e.target.value) / 100 })
                }
              />
              <output htmlFor="house-settings-penetration">
                {toPercent(rules.penetration)}%
              </output>
            </div>
            <p className="house-settings__help">
              Reshuffles with ~{reshuffleThreshold(rules)} cards left in the shoe.
            </p>
          </section>

          <section className="house-settings__section">
            <h3>Table rules</h3>
            <ul className="house-settings__rules">
              {describeRules(rules).map((rule) => (
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
