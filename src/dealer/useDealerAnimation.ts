import { useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { flushSync } from 'react-dom';
import {
  gameReducer,
  usesFreshShoe,
  type GameAction,
  type GameState,
} from '../engine/game';
import { DealerMotion } from './dealerMotion';
import './dealerMotion.css';

type View = {
  table: GameState;
  holeDown: boolean;
  remaining: number;
  discarded: number;
  flight?: {
    card: GameState['playerHand'][number];
    faceDown: boolean;
  };
};

const animated = new Set<GameAction['type']>([
  'DEAL',
  'REBET_AND_DEAL',
  'HIT',
  'STAND',
  'SPLIT',
  'DOUBLE',
  'SURRENDER',
]);

function playerRows(state: GameState) {
  return state.splitHands.length
    ? state.splitHands.map(hand => hand.cards)
    : [state.playerHand];
}

export function onFelt(state: GameState) {
  return playerRows(state).reduce(
    (total, cards) => total + cards.length,
    state.dealerHand.length,
  );
}

function scrollCardIntoHand(card: HTMLElement, group: HTMLElement) {
  const cardRect = card.getBoundingClientRect();
  const groupRect = group.getBoundingClientRect();

  if (cardRect.right > groupRect.right) {
    group.scrollLeft += cardRect.right - groupRect.right + 4;
  } else if (cardRect.left < groupRect.left) {
    group.scrollLeft -= groupRect.left - cardRect.left + 4;
  }
}

async function perform(
  felt: HTMLElement,
  motion: DealerMotion,
  before: GameState,
  next: GameState,
  action: GameAction,
  initial: View,
  render: (view: View) => void,
) {
  const opening = action.type === 'DEAL' || action.type === 'REBET_AND_DEAL';
  const split = action.type === 'SPLIT';
  const rows = playerRows(next);
  const counts = rows.map((_, index) =>
    opening || split ? 0 : playerRows(before)[index].length
  );

  function zone(selector: string) {
    const element = felt.querySelector<HTMLElement>(selector);
    if (!element) throw new Error(`Missing table element: ${selector}`);
    return element;
  }

  function cardAt(side: 'dealer' | 'player', index: number, row = 0) {
    const groups = felt.querySelectorAll<HTMLElement>(
      `.${side}-zone .hand__cards`,
    );
    const group = groups[row];
    const card = group?.children[index] as HTMLElement | undefined;

    if (!group || !card) {
      throw new Error(`Missing ${side} card ${index} in hand ${row}`);
    }

    scrollCardIntoHand(card, group);
    return card;
  }

  // Collect the finished round when the player starts the next hand.
  if (opening) {
    const tray = motion.measure(zone('.discard-acrylic-box'));
    let discarded = initial.discarded;

    const groups = [
      ...Array.from(felt.querySelectorAll<HTMLElement>('.player-zone .hand__cards')),
      ...Array.from(felt.querySelectorAll<HTMLElement>('.dealer-zone .hand__cards')),
    ];

    for (const group of groups) {
      for (const element of Array.from(group.children)) {
        const card = element as HTMLElement;
        scrollCardIntoHand(card, group);
        await motion.carry(card, motion.measure(card), tray, 'discard');
        discarded += 1;
        render({ ...initial, discarded });
      }
    }
  }

  // Measure the original pair before React lays out two separate split hands.
  let dealerCount = opening ? 0 : before.dealerHand.length;
  let holeDown = true;
  const finalCardCount = onFelt(next);

  function paint(flight?: View['flight']) {
    const splitHands = next.splitHands.map((hand, index) => ({
      ...hand,
      cards: hand.cards.slice(0, counts[index]),
      complete: false,
      result: null,
    }));

    const table: GameState = {
      ...next,
      phase: 'playerTurn',
      result: null,
      splitHands,
      playerHand:
        splitHands[next.activeHandIndex]?.cards ??
        next.playerHand.slice(0, counts[0]),
      dealerHand: next.dealerHand.slice(0, dealerCount),
    };

    const pending = finalCardCount - onFelt(table);
    const remaining = next.deck.length + pending;
    const discarded = Math.max(
      0,
      next.rules.numDecks * 52 - next.deck.length - finalCardCount,
    );

    render({ table, holeDown, remaining, discarded, flight });
  }

async function deliver(side: 'player' | 'dealer', row = 0) {
    const index = side === 'dealer' ? dealerCount : counts[row];

    // Read the exact card from the new hand, including the correct split hand.
    const dealtCard = side === 'dealer'
      ? next.dealerHand[index]
      : rows[row][index];

    if (side === 'dealer') {
      dealerCount += 1;
    } else {
      counts[row] += 1;
    }

    paint({
      card: dealtCard,
      faceDown: side === 'dealer' && index === 1 && holeDown,
    });

    const destination = cardAt(side, index, row);
    const shoe = motion.measure(zone('.shoe-finger-cutout'));
    const artwork = zone('.dealer-flight-source > .card');

    await motion.carry(
      destination,
      shoe,
      motion.measure(destination),
      'deal',
      artwork,
    );
  }

  if (opening) {
    if (usesFreshShoe(before, action.deck)) {
      await motion.shuffleShoe(zone('.shoe-finger-cutout'));
    }

    paint();

    await deliver('player');
    await deliver('dealer');
    await deliver('player');
    await deliver('dealer');

    const upcard = next.dealerHand[0].rank;
    if (['A', '10', 'J', 'Q', 'K'].includes(upcard)) {
      await motion.peek(cardAt('dealer', 1));
    }
    } else if (split) {
    const originals = [
      cardAt('player', 0),
      cardAt('player', 1),
    ];

    await motion.separatePair(originals, () => {
      counts.fill(1);
      paint();

      return [
        cardAt('player', 0, 0),
        cardAt('player', 0, 1),
      ];
    });

    await deliver('player', 0);
    await deliver('player', 1);
  } else {
    // Hit or double may add a card to either active split hand.
    for (let row = 0; row < rows.length; row++) {
      while (counts[row] < rows[row].length) {
        await deliver('player', row);
      }
    }
  }

  if (next.phase === 'done') {
    await motion.reveal(cardAt('dealer', 1), () => {
      holeDown = false;
      paint();
      return cardAt('dealer', 1);
    });

    while (dealerCount < next.dealerHand.length) {
      await deliver('dealer');
    }
  }

  await motion.rest();
}

export function useDealerAnimation(
  state: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  remaining: number,
) {
  const feltRef = useRef<HTMLDivElement>(null);
  const running = useRef<AbortController | null>(null);
  const [view, setView] = useState<View | null>(null);

  useEffect(() => {
    return () => running.current?.abort();
  }, []);

  async function play(action: GameAction) {
    if (running.current) return;

    const felt = feltRef.current;
    const reduceMotion = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)',
    )?.matches;

    // The trainer screen has no casino felt and resolves actions immediately.
    if (!felt || !animated.has(action.type) || reduceMotion) {
      setGameState(previous => gameReducer(previous, action));
      return;
    }

    // The action already contains its shuffled deck. Reusing that same action
    // gives the animation and the real reducer exactly the same cards.
    const next = gameReducer(state, action);
    if (next === state) return;

    const restoreFocus = !!document.activeElement?.closest('.action-dock');
    const controller = new AbortController();
    running.current = controller;

    let motion: DealerMotion | undefined;

    const initial: View = {
      table: state,
      holeDown: state.phase === 'playerTurn',
      remaining,
      discarded: Math.max(
        0,
        state.rules.numDecks * 52 - remaining - onFelt(state),
      ),
    };

    // Each card needs to be in the DOM before its destination can be measured.
    const render = (frame: View) => flushSync(() => setView(frame));

    try {
      render(initial);
      motion = new DealerMotion(felt, controller.signal);
      await perform(felt, motion, state, next, action, initial, render);
    } catch (error) {
      if (!controller.signal.aborted) {
        console.warn('Dealer animation interrupted', error);
      }
    } finally {
      motion?.close();

      if (!controller.signal.aborted) {
        flushSync(() => {
          setGameState(next);
          setView(null);
        });

        if (restoreFocus && document.activeElement === document.body) {
          felt.closest('.game-layout')
            ?.querySelector<HTMLElement>('.action-dock')
            ?.focus({ preventScroll: true });
        }
      }

      running.current = null;
    }
  }

  return { feltRef, view, play };
}