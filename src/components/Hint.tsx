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
                Recommended: <strong>{analysis.recommended === 'hit' ? 'Hit' : 'Stand'}</strong>
              </p>
              <Row label="Hit" o={analysis.hit} best={analysis.recommended === 'hit'} />
              <Row label="Stand" o={analysis.stand} best={analysis.recommended === 'stand'} />
            </>
          ) : (
            <p className="hint__text">Hints are available during your turn.</p>
          )}
        </div>
      )}
    </div>
  );
}