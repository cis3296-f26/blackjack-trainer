import { useState } from 'react';
import './Hint.css';

interface HintProps {
  text?: string;
}

// Button in the top-right corner that toggles a small window with hint text.
export default function Hint({ text = 'Hints will show up here.' }: HintProps) {
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
          <p className="hint__text">{text}</p>
        </div>
      )}
    </div>
  );
}