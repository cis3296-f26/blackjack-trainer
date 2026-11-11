import { useMemo, useState } from 'react';
import { canDouble, type GameState } from '../engine/game';
import { analyzeHand, type Outcome } from '../engine/strategy';
import './Hint.css';

const names = { hit: 'Hit', stand: 'Stand', double: 'Double' };
const pct = (value: number) => `${Math.round(value * 100)}%`;

function OutcomeRow({ label, outcome, best }: { label: string; outcome: Outcome; best: boolean }) {
  return (
    <tr>
      <th scope="row">{label}{best && <span className="sr-only"> (recommended)</span>}{best && <span aria-hidden="true"> ✓</span>}</th>
      <td>{outcome.ev >= 0 ? '+' : ''}{outcome.ev.toFixed(3)}</td>
      <td>{pct(outcome.win)}</td><td>{pct(outcome.push)}</td><td>{pct(outcome.lose)}</td>
    </tr>
  );
}

export default function Hint({ state }: { state: GameState }) {
  const [open, setOpen] = useState(false);
  const available = state.phase === 'playerTurn';
  const doubleAvailable = canDouble(state);
  // Strategy calculation is deferred until the player requests help.
  const analysis = useMemo(() => open && available
    ? analyzeHand(state.playerHand, state.dealerHand[0], state.rules, doubleAvailable)
    : null, [open, available, state.playerHand, state.dealerHand, doubleAvailable, state.rules]);

  return (
    <aside className="practice-panel" aria-label="Practice help">
      <div className="practice-panel__intro">
        <span className="eyebrow">ONE DECISION AT A TIME</span>
        <h2>Practice</h2>
        <p>{available ? 'Try a move first, or ask for a hint.' : 'Deal a hand to practice your next decision.'}</p>
      </div>
      <button type="button" className="button button--action hint-toggle" disabled={!available}
        aria-expanded={open} aria-controls="hint-content" onClick={() => setOpen(value => !value)}>
        {open ? 'Hide hint' : 'Show hint'}
      </button>
      {open && analysis && (
        <div className="hint-content" id="hint-content">
          <p className="hint-recommendation" role="status">Recommended <strong>{names[analysis.recommended]}</strong></p>
          <p>This move has the highest expected return for your hand and the dealer’s visible card.</p>
          <details className="hint-comparison">
            <summary>Compare moves</summary>
            <div className="hint-table-scroll" role="region" aria-label="Move probabilities" tabIndex={0}>
              <table>
                <caption className="sr-only">Expected profit and outcome probabilities</caption>
                <thead><tr><th scope="col">Move</th><th scope="col">EV</th><th scope="col">Win</th><th scope="col">Tie</th><th scope="col">Lose</th></tr></thead>
                <tbody>
                  <OutcomeRow label="Hit" outcome={analysis.hit} best={analysis.recommended === 'hit'} />
                  <OutcomeRow label="Stand" outcome={analysis.stand} best={analysis.recommended === 'stand'} />
                  {analysis.double && <OutcomeRow label="Double" outcome={analysis.double} best={analysis.recommended === 'double'} />}
                </tbody>
              </table>
            </div>
            <p>EV is the average profit per original chip bet over many similar hands. A higher value is better; no move guarantees a win.</p>
          </details>
        </div>
      )}
      <details className="how-to-play">
        <summary>How to play</summary>
        <p>Get closer to 21 than the dealer without going over. Face cards count as 10; an ace counts as 1 or 11.</p>
        <dl>
          <dt>Hit</dt><dd>Take another card.</dd>
          <dt>Stand</dt><dd>Keep your total and let the dealer play.</dd>
          <dt>Double</dt><dd>Double your bet, take exactly one card, then stand. Available on your first two cards with enough chips. In Free Play, no chips are needed.</dd>
          <dt>Split</dt><dd>Turn a pair into two hands, each with its own bet. Allowed once per hand; any two ten-value cards count as a pair.</dd>
          <dt>Surrender</dt><dd>Give up your first two cards and get half your bet back. Not available after a hit or a split, or when the dealer has blackjack.</dd>
          <dt>Soft total</dt><dd>A hand with an ace counting as 11.</dd>
          <dt>Push</dt><dd>A tie. Your bet is returned.</dd>
        </dl>
        <p>Free Play lets you practice without betting. Change modes between hands.</p>
      </details>
    </aside>
  );
}
