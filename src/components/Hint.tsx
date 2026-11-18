import { useState } from 'react';
import type { Analysis, Outcome } from '../engine/strategy';
import './Hint.css';

interface HintProps {
  analysis: Analysis | null;
}

const pct = (n: number) => `${Math.round(n * 100)}%`;
const ev = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(3)}`;

function Row({ label, o, best }: { label: string; o: Outcome; best: boolean }) {
  return (
    <p className="hint__row">
      <strong>
        {label}
        {best ? ' ✓' : ''}
      </strong>{' '}
      EV {ev(o.ev)} · win {pct(o.win)} · push {pct(o.push)} · lose {pct(o.lose)}
    </p>
  );
}

export default function Hint({ analysis }: HintProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="hint">
      <button
        type="button"
        className="hint__toggle"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        Hint
      </button>

      {open && (
        <div className="hint__window" role="dialog" aria-label="Hint">
          <div className="hint__header">
            <strong>Hint</strong>
            <button
              type="button"
              className="hint__close"
              onClick={() => setOpen(false)}
              aria-label="Close hint"
            >
              ×
            </button>
          </div>

          {analysis ? (
            <>
              <p className="hint__text">
                Recommended: <strong>{{ hit: 'Hit', stand: 'Stand', double: 'Double', split: 'Split', surrender: 'Surrender' }[analysis.recommended]}</strong>
              </p>
              <Row label="Hit" o={analysis.hit} best={analysis.recommended === 'hit'} />
              <Row label="Stand" o={analysis.stand} best={analysis.recommended === 'stand'} />
              {analysis.double && (
                <Row label="Double" o={analysis.double} best={analysis.recommended === 'double'} />
              )}
              {analysis.split && (
                <Row label="Split (estimate)" o={analysis.split} best={analysis.recommended === 'split'} />
              )}
              {analysis.surrender && (
                <Row label="Surrender" o={analysis.surrender} best={analysis.recommended === 'surrender'} />
              )}
              <p className="hint__text">EV is profit per original unit bet.</p>
              {analysis.split && (
                <p className="hint__text">
                  Split EV covers both hands; percentages are per hand. Assumes one split,
                  no double after split, and one card on split aces. Cards drawn by the other hand are not modeled.
                </p>
              )}
              {analysis.surrender && (
                <p className="hint__text">Late surrender loses half your bet.</p>
              )}
              <p className="hint__text">Split and surrender are strategy hints only; play controls are not yet available.</p>
            </>
          ) : (
            <p className="hint__text">Hints are available during your turn.</p>
          )}
        </div>
      )}
    </div>
  );
}
