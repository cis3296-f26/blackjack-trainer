import type { Phase } from "../engine/game";
import "./Controls.css";

interface ControlsProps {
  phase: Phase;
  canDouble: boolean;
  onDeal: () => void;
  onHit: () => void;
  onStand: () => void;
  onDouble: () => void;
}

export default function Controls({
  phase,
  canDouble,
  onDeal,
  onHit,
  onStand,
  onDouble,
}: ControlsProps) {
  const isPlayerTurn = phase === "playerTurn";
  const canDeal = phase === "idle" || phase === "done";

  return (
    <div className="controls">
      <button type="button" onClick={onDeal} disabled={!canDeal}>
        {phase === "done" ? "New Hand" : "Deal"}
      </button>
      <button type="button" onClick={onHit} disabled={!isPlayerTurn}>
        Hit
      </button>
      <button type="button" onClick={onStand} disabled={!isPlayerTurn}>
        Stand
      </button>
      <button type="button" onClick={onDouble} disabled={!canDouble}>
        Double
      </button>
    </div>
  );
}
