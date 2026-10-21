import type { Phase } from '../engine/game';
import { CASINO_CHIPS, type ChipValue } from '../engine/types';
import './Controls.css';


interface ControlsProps {
  phase: Phase;
  balance: number;
  currentBet: number;
  bailoutTriggered?: boolean;
  onPlaceBet: (amount: ChipValue) => void;
  onClearBet: () => void;
  onDeal: () => void;
  onHit: () => void;
  onStand: () => void;
  onDouble: () => void;
}

// Action buttons. Each one is enabled only in the phase where it makes sense.
export default function Controls({ phase, balance = 500, currentBet = 0, bailoutTriggered = false, onPlaceBet, onClearBet,onDeal, onHit, onStand }: ControlsProps) {
  const isPlayerTurn = phase === 'playerTurn';
  const canBet = phase === 'idle' || phase === 'done';
  const canDeal = canBet && currentBet > 0;

  return (
    <div className="controls-wrapper">
      {/* Bankroll & Current Bet Display */}
      <div className="bankroll-hud">
        <div className="stat-box">
          <span className="stat-label">Bankroll</span>
          <span className="stat-value">${balance}</span>
        </div>
        <div className="stat-box">
          <span className="stat-label">Current Bet</span>
          <span className="stat-value">${currentBet}</span>
        </div>
      </div>

      {/* Bankruptcy Bailout Alert */}
      {bailoutTriggered && canBet && (
        <div className="bailout-banner">
          Bankrupt! You received a <strong>+$100</strong> bailout to keep playing.
        </div>
      )}

      {/* Casino Chip Selector (Enabled between hands in 'idle' or 'done' phase) */}
      <div className="chip-rack">
        {CASINO_CHIPS.map((chip) => {
          const canAfford = balance >= chip.value;
          return (
            <button
              key={chip.value}
              type="button"
              className="casino-chip"
              style={{ '--chip-color': chip.color } as React.CSSProperties}
              disabled={!canBet || !canAfford}
              onClick={() => onPlaceBet(chip.value)}
              title={`Bet ${chip.label}`}
            >
              <span className="chip-inner">{chip.label}</span>
            </button>
          );
        })}
      </div>

      {/* Game Action Buttons */}
      <div className="controls">
        <button
          type="button"
          onClick={onClearBet}
          disabled={!canBet || currentBet === 0}
        >
          Clear Bet
        </button>
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
    </div>
  );
}
