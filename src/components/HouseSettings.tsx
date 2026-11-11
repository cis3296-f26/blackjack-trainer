import { useEffect, useRef, useState } from 'react';
import {
  DECK_OPTIONS,
  DEFAULT_HOUSE_RULES,
  FIXED_TABLE_RULES,
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

// Table-rules button plus a native modal for casino-specific settings.
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
        className="button button--secondary house-settings__toggle"
        onClick={() => setOpen(true)}
        aria-label="Table rules"
        aria-haspopup="dialog"
        title="Table rules"
      >
        Table rules
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
            <h2 id="house-settings-title">Table rules</h2>
            <button
              type="button"
              className="house-settings__close"
              onClick={() => setOpen(false)}
              aria-label="Close table rules"
            >
              ×
            </button>
          </div>

          {!canEdit && (
            <p className="house-settings__notice">
              Finish this hand to change table rules.
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
              <label htmlFor="house-settings-penetration">Reshuffle after {toPercent(rules.penetration)}% dealt</label>
            </h3>
            <div className="house-settings__slider">
              <input
                id="house-settings-penetration"
                type="range"
                aria-valuetext={`${toPercent(rules.penetration)} percent dealt`}
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
              About {reshuffleThreshold(rules)} cards remain before reshuffling.
            </p>
          </section>

          <section className="house-settings__section">
            <h3>Fixed rules</h3>
            <ul className="house-settings__rules">
              {FIXED_TABLE_RULES.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </section>

          <p className="house-settings__help">Changes save automatically on this device.</p>
          <div className="house-settings__footer">
            <button
              type="button"
              className="button button--secondary"
              disabled={!canEdit || isDefault}
              onClick={() => onChange(DEFAULT_HOUSE_RULES)}
            >
              Reset defaults
            </button>
            <button type="button" className="button button--primary" onClick={() => setOpen(false)}>Done</button>
          </div>
        </div>
      </dialog>
    </>
  );
}
