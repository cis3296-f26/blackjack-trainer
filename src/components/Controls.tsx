import type { Phase } from '../engine/game';
import './Controls.css';

interface ControlsProps {
  phase: Phase;
  onDeal: () => void;
  onHit: () => void;
  onStand: () => void;
}

// Action buttons. Each one is enabled only in the phase where it makes sense.
export default function Controls({ phase, onDeal, onHit, onStand }: ControlsProps) {
  const isPlayerTurn = phase === 'playerTurn';
  const canDeal = phase === 'idle' || phase === 'done';

  return (
    <div className="controls">
      <button type="button" onClick={onDeal} disabled={!canDeal}>
        {phase === 'done' ? 'New Hand' : 'Deal'}
      </button>
      <button type="button" onClick={onHit} disabled={!isPlayerTurn}>
        Hit
      </button>
      <button type="button" onClick={onStand} disabled={!isPlayerTurn}>
        Stand
      </button>
    </div>
  );
}
