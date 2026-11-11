import assert from 'node:assert/strict';
import test from 'node:test';
import { moduleUrl } from './load-module.mjs';

const { gameReducer, initialState, openingWager, canRebet, canDouble, canSplit, returnedChips, settleRoundBet } = await import(await moduleUrl(new URL('../game.ts', import.meta.url)));
const { shoeStatus, resultReason } = await import(await moduleUrl(new URL('../presentation.ts', import.meta.url)));
const { createShoe } = await import(await moduleUrl(new URL('../shoe.ts', import.meta.url)));
const card = rank => ({ rank, suit: '♠' });
const deck = (...ranks) => ranks.map(card);
const deal = (ranks, amount = 25) => gameReducer(gameReducer(initialState, { type: 'PLACE_BET', amount }), { type: 'DEAL', deck: deck(...ranks) });
const finished = () => gameReducer(deal(['10', '10', '10', '8']), { type: 'STAND' });

test('a win reports net profit and returned stake independently of the next bet', () => {
  const state = finished();
  assert.equal(state.balance, 525);
  assert.equal(state.currentBet, 0);
  assert.deepEqual(state.lastRound, { wager: 25, returned: 50, profit: 25, bailout: 0, freePlay: false });
  assert.equal(resultReason(state), 'Your 20 beats dealer 18.');
  const nextBet = gameReducer(state, { type: 'PLACE_BET', amount: 5 });
  assert.equal(nextBet.lastRound, state.lastRound);
  const free = gameReducer(nextBet, { type: 'SET_FREE_PLAY', enabled: true });
  assert.equal(free.balance, 525);
  assert.equal(free.lastRound, state.lastRound);
});

test('rebet deducts the original wager exactly once and starts a hand', () => {
  const action = { type: 'REBET_AND_DEAL', deck: deck('10', '6', '7', '10', '2') };
  const state = gameReducer(finished(), action);
  assert.equal(state.phase, 'playerTurn');
  assert.equal(state.balance, 500);
  assert.equal(state.currentBet, 25);
  assert.equal(state.lastRound, null);
  assert.equal(gameReducer(state, action), state);
});

test('rebet after double uses the opening bet rather than the final doubled stake', () => {
  const state = gameReducer(deal(['5', '10', '6', '8', '10']), { type: 'DOUBLE' });
  assert.equal(state.lastbet, 50);
  assert.equal(state.balance, 550);
  assert.equal(openingWager(state), 25);
  assert.equal(state.lastRound.profit, 50);
  const next = gameReducer(state, { type: 'REBET_AND_DEAL', deck: deck('10', '6', '7', '10') });
  assert.equal(next.currentBet, 25);
  assert.equal(next.balance, 525);
  assert.equal(next.doubled, false);
});

test('rebet guards reject invalid phases, free play, pending bets, and insufficient funds', () => {
  const done = finished();
  for (const state of [
    initialState,
    { ...done, phase: 'playerTurn' },
    { ...done, phase: 'dealerTurn' },
    { ...done, freePlay: true },
    { ...done, currentBet: 5 },
    { ...done, balance: 24 },
    { ...done, lastbet: 0 },
  ]) {
    assert.equal(canRebet(state), false);
    assert.equal(gameReducer(state, { type: 'REBET_AND_DEAL', deck: [] }), state);
  }
  assert.equal(canRebet({ ...done, balance: 25 }), true);
});

test('a natural blackjack on rebet settles immediately without losing the new summary', () => {
  const next = gameReducer(finished(), { type: 'REBET_AND_DEAL', deck: deck('A', '10', 'K', '8') });
  assert.equal(next.phase, 'done');
  assert.equal(next.result, 'blackjack');
  assert.equal(next.balance, 562);
  assert.equal(next.lastRound.profit, 37);
});

test('blackjack rounding, loss, and push summaries match settlement', () => {
  assert.equal(returnedChips(25, 'blackjack'), 62);
  assert.equal(settleRoundBet(475, 25, 'blackjack', '3:2').nextBalance, 537);
  const push = gameReducer(deal(['10', '10', '8', '8']), { type: 'STAND' });
  assert.equal(push.lastRound.profit, 0);
  assert.equal(push.lastRound.returned, 25);
  const loss = gameReducer(deal(['10', '10', '7', '8']), { type: 'STAND' });
  assert.equal(loss.lastRound.profit, -25);
  assert.equal(loss.lastRound.returned, 0);
  assert.equal(loss.balance, 475);
});

test('bailout credit is separate from the amount lost', () => {
  const state = gameReducer(deal(['10', '10', '7', '8'], 500), { type: 'STAND' });
  assert.equal(state.balance, 100);
  assert.equal(state.lastRound.profit, -500);
  assert.equal(state.lastRound.bailout, 100);
  assert.equal(canRebet(state), false);
});

test('free play leaves balance unchanged and has no monetary outcome', () => {
  const free = gameReducer(initialState, { type: 'SET_FREE_PLAY', enabled: true });
  const state = gameReducer(gameReducer(free, { type: 'DEAL', deck: deck('10', '10', '10', '8') }), { type: 'STAND' });
  assert.equal(state.balance, initialState.balance);
  assert.equal(state.lastbet, 0);
  assert.equal(state.lastRound.freePlay, true);
  assert.equal(state.lastRound.profit, 0);
});

test('shoe display follows every deck setting, active cards, and the actual cut threshold', () => {
  for (const numDecks of [1, 2, 4, 6, 8]) {
    const state = { ...initialState, rules: { numDecks, penetration: 0.8 } };
    const fresh = shoeStatus(state);
    assert.equal(fresh.total, numDecks * 52);
    assert.equal(fresh.remaining, fresh.total);
    assert.equal(fresh.discarded, 0);
    assert.equal(fresh.cutPercent, Math.max(20, Math.round(numDecks * 52 * 0.2)) / (numDecks * 52) * 100);
    const playing = { ...state, phase: 'playerTurn', deck: createShoe(numDecks).slice(10), playerHand: deck('10', '7'), dealerHand: deck('6', '10') };
    assert.equal(shoeStatus(playing).discarded, 6);
    assert.equal(shoeStatus({ ...playing, phase: 'done' }).discarded, 10);
  }
});

test('changing deck count after a round resets shoe indicators without counting old hands', () => {
  const next = gameReducer(finished(), { type: 'SET_HOUSE_RULES', rules: { numDecks: 1, penetration: 0.75 } });
  assert.equal(shoeStatus(next).remaining, 52);
  assert.equal(shoeStatus(next).discarded, 0);
});

test('result reasons cover busts, dealer blackjack, and tied blackjacks', () => {
  assert.equal(resultReason({ ...initialState, playerHand: deck('10', '9', '5'), dealerHand: deck('10', '8') }), 'Your 24 is over 21. You bust.');
  assert.equal(resultReason({ ...initialState, playerHand: deck('10', '9'), dealerHand: deck('10', '8', '5') }), 'The dealer busts with 23.');
  assert.equal(resultReason({ ...initialState, playerHand: deck('10', '9'), dealerHand: deck('A', 'K') }), 'The dealer has blackjack.');
  assert.equal(resultReason({ ...initialState, playerHand: deck('A', '10'), dealerHand: deck('A', 'K') }), 'You and the dealer both have blackjack.');
});

const withRules = (changes) => gameReducer(initialState, { type: 'SET_HOUSE_RULES', rules: { ...initialState.rules, ...changes } });

test('blackjack pays the table payout in settlement and the round summary', () => {
  const sixFive = withRules({ blackjackPayout: '6:5' });
  const state = gameReducer(gameReducer(sixFive, { type: 'PLACE_BET', amount: 25 }), { type: 'DEAL', deck: deck('A', '10', 'K', '8') });
  assert.equal(state.result, 'blackjack');
  assert.equal(state.balance, 530);
  assert.equal(state.lastRound.profit, 30);
  assert.equal(returnedChips(25, 'blackjack', '1:1'), 50);
});

test('double is allowed only on totals the table permits', () => {
  const tenEleven = { ...deal(['5', '10', '6', '8']), rules: { ...initialState.rules, doubleOn: '10-11' } };
  assert.equal(canDouble(tenEleven), true);
  const nine = { ...deal(['5', '10', '4', '8']), rules: { ...initialState.rules, doubleOn: '10-11' } };
  assert.equal(canDouble(nine), false);
  assert.equal(gameReducer(nine, { type: 'DOUBLE' }), nine);
});

test('split pairs and ten-value cards once, only when the bet can be matched', () => {
  assert.equal(canSplit(deal(['8', '10', '8', '7'])), true);
  assert.equal(canSplit(deal(['K', '10', 'Q', '7'])), true);
  assert.equal(canSplit(deal(['8', '10', '9', '7'])), false);
  assert.equal(canSplit(deal(['8', '10', '8', '7'], 300)), false);
});

test('split hands settle separately, double on the active stake, and rebet the opening bet', () => {
  const split = gameReducer(deal(['8', '10', '8', '7', '3', '10', '10']), { type: 'SPLIT' });
  assert.equal(split.balance, 450);
  assert.deepEqual(split.splitHands.map(hand => hand.cards.map(card => card.rank)), [['8', '3'], ['8', '10']]);
  assert.equal(canSplit(split), false);
  assert.equal(canDouble({ ...split, balance: 25 }), true);
  const doubled = gameReducer(split, { type: 'DOUBLE' });
  assert.equal(doubled.balance, 425);
  assert.equal(doubled.activeHandIndex, 1);
  const done = gameReducer(doubled, { type: 'STAND' });
  assert.equal(done.phase, 'done');
  assert.deepEqual(done.splitHands.map(hand => hand.result), ['win', 'win']);
  assert.equal(done.balance, 575);
  assert.deepEqual(done.lastRound, { wager: 75, returned: 150, profit: 75, bailout: 0, freePlay: false });
  assert.equal(resultReason(done), 'Hand 1 wins, Hand 2 wins.');
  assert.equal(openingWager(done), 25);
  assert.equal(gameReducer(done, { type: 'REBET_AND_DEAL', deck: deck('10', '6', '7', '10') }).balance, 550);
});
