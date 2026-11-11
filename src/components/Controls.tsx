import { useEffect, useRef, useState } from 'react';
import { activeBet, canDouble, canRebet, canSplit, openingWager, type GameAction, type GameState } from '../engine/game';
import { handValue } from '../engine/hand';
import { doubleAllowedOnTotal } from '../engine/rules';
import { CASINO_CHIPS } from '../engine/types';
import ResultBanner from './ResultBanner';
import './Controls.css';

interface ControlsProps {
  phase: Phase;
  balance: number;
  currentBet: number;
  bailoutTriggered?: boolean;
  canDouble: boolean;
  canSplit: boolean;
  canSurrender: boolean;
  onSurrender: () => void;
  freePlay: boolean;
  onToggleFreePlay: (enabled: boolean) => void;
  onPlaceBet: (amount: ChipValue) => void;
  onClearBet: () => void;
  state: GameState;
  dispatch: (action: GameAction) => void;
  onDeal: () => void;
  onRebet: () => void;
}

export default function Controls({ state, dispatch, onDeal, onRebet }: ControlsProps) {
  const [editingRound, setEditingRound] = useState<GameState['lastRound']>(null);
  const panelRef = useRef<HTMLElement>(null);
  const previousPhase = useRef(state.phase);
  const previousBetting = useRef(false);
  const playing = state.phase === 'playerTurn';
  const betweenHands = state.phase === 'idle' || state.phase === 'done';
  const repeatAmount = openingWager(state);
  const affordable = canRebet(state);
  const previousBetTooLarge = state.phase === 'done' && repeatAmount > state.balance && state.currentBet === 0;
  const betting = betweenHands && !state.freePlay && (
    state.phase === 'idle' || state.lastRound === editingRound || state.currentBet > 0 || !affordable
  );
  const handBet = activeBet(state);
  const doubleReason = state.playerHand.length !== 2
    ? 'Double is available only on your first two cards.'
    : !doubleAllowedOnTotal(handValue(state.playerHand).total, state.rules.doubleOn)
      ? `This table allows doubling only on ${state.rules.doubleOn === '9-11' ? '9, 10 or 11' : '10 or 11'}.`
      : `Double needs another $${handBet}; you have $${state.balance} available.`;
  const splitAvailable = canSplit(state);

  // Keep keyboard users at the action area when the button they used disappears.
  useEffect(() => {
    if (previousPhase.current !== state.phase || (previousPhase.current === 'done' && previousBetting.current !== betting)) {
      panelRef.current?.focus({ preventScroll: true });
    }
    previousPhase.current = state.phase;
    previousBetting.current = betting;
  }, [state.phase, betting]);

  return (
    <section className="action-dock" aria-label="Hand actions" tabIndex={-1} ref={panelRef}>
      <div className="action-dock__top">
        {betweenHands && <div className="mode-toggle" role="group" aria-label="Game mode">
          <button type="button" aria-pressed={!state.freePlay} disabled={!betweenHands}
            onClick={() => dispatch({ type: 'SET_FREE_PLAY', enabled: false })}>Betting</button>
          <button type="button" aria-pressed={state.freePlay} disabled={!betweenHands}
            onClick={() => dispatch({ type: 'SET_FREE_PLAY', enabled: true })}>Free Play</button>
        </div>}
        <span className="action-dock__note" id="mode-help">
          {betweenHands ? (state.freePlay ? 'Practice without betting' : 'Practice chips only') : `${state.freePlay ? 'Free Play' : 'Betting'} · Change mode between hands`}
        </span>
      </div>

      <ResultBanner state={state} />

      <div className="action-dock__status">
        {state.phase !== 'done' && <h2>{playing ? 'Your turn' : state.freePlay ? 'Ready to practice?' : 'Choose chips, then deal'}</h2>}
        {!state.freePlay && (
          <div className="bankroll-hud" aria-live="polite" aria-atomic="true">
            <span>Available <strong>${state.balance}</strong></span>
            {(betting || playing) && <span>{playing ? 'Bet' : 'Your bet'} <strong>${state.currentBet}</strong></span>}
          </div>
        )}
      </div>

      {betting && (
        <div className="bet-editor">
          <div className="chip-rack" role="group" aria-label="Add chips to your bet">
            {CASINO_CHIPS.map(chip => (
              <button key={chip.value} type="button" className="casino-chip"
                style={{ '--chip-color': chip.color } as React.CSSProperties}
                disabled={state.balance < chip.value} aria-label={`Add ${chip.label} to bet`}
                onClick={() => dispatch({ type: 'PLACE_BET', amount: chip.value })}>
                <span className="chip-inner">{chip.label}</span>
              </button>
            ))}
          </div>
          <p className="action-dock__help" id="bet-help">
            {previousBetTooLarge
              ? `Previous bet: $${repeatAmount}. Choose a smaller bet.`
              : state.currentBet === 0 ? 'Choose chips to deal. Each tap adds to your bet.' : 'Add more chips or deal your hand.'}
          </p>
          <div className="controls">
            <button type="button" className="button button--secondary" disabled={state.currentBet === 0}
              onClick={() => dispatch({ type: 'CLEAR_BET' })}>Clear bet</button>
            <button type="button" className="button button--primary" disabled={state.currentBet === 0}
              aria-describedby="bet-help" onClick={onDeal}>{state.currentBet > 0 ? `Deal $${state.currentBet}` : 'Deal'}</button>
          </div>
        </div>
      )}

      {playing && (
        <>
          <div className="controls controls--play">
            <button type="button" className="button button--action" onClick={() => dispatch({ type: 'HIT' })}>Hit</button>
            <button type="button" className="button button--action" onClick={() => dispatch({ type: 'STAND' })}>Stand</button>
            <button type="button" className="button button--action" disabled={!canDouble(state)}
              aria-describedby="double-help" onClick={() => dispatch({ type: 'DOUBLE' })}>Double</button>
            {state.splitHands.length === 0 && (
              <button type="button" className="button button--action" disabled={!splitAvailable}
                onClick={() => dispatch({ type: 'SPLIT' })}>Split</button>
            )}
          </div>
          <p className="action-dock__help" id="double-help">
            {canDouble(state) ? (state.freePlay ? 'Double takes one final card, then stands.' : `Double adds $${handBet}, takes one final card, then stands.`) : doubleReason}
          </p>
        </>
      )}

      {state.phase === 'done' && !state.freePlay && !betting && (
        <div className="controls">
          <button type="button" className="button button--primary" onClick={onRebet}>Rebet ${repeatAmount} &amp; deal</button>
          <button type="button" className="button button--secondary" onClick={() => setEditingRound(state.lastRound)}>Change bet</button>
        </div>
      )}
      {betweenHands && state.freePlay && <button type="button" className="button button--primary" onClick={onDeal}>{state.phase === 'done' ? 'Next hand' : 'Deal a hand'}</button>}
      {state.phase === 'dealerTurn' && <p role="status">Dealer is playing…</p>}
    </section>
  );
}
