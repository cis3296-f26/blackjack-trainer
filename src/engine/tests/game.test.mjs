import assert from 'node:assert/strict';
import test from 'node:test';
import { loadEngine } from './loadEngine.mjs';

const { gameReducer, initialState, canDouble } = await loadEngine('game');
const { DEFAULT_HOUSE_RULES, normalizeHouseRules, blackjackProfit } = await loadEngine('rules');
const { profit_hand } = await loadEngine('stat');

const card = (rank) => ({ rank, suit: '♠' });
// Cards come off the top in order: player, dealer, player, dealer, then any draws
const stack = (...ranks) => ranks.map(card);

// Bets $10 under the given rules and deals the stacked deck
function dealHand(ranks, rules = {}) {
    let state = { ...initialState, rules: { ...DEFAULT_HOUSE_RULES, ...rules } };
    state = gameReducer(state, { type: 'PLACE_BET', amount: 5 });
    state = gameReducer(state, { type: 'PLACE_BET', amount: 5 });
    return gameReducer(state, { type: 'DEAL', deck: stack(...ranks) });
}

test('dealer stands on soft 17 under S17', () => {
    // Player 10+8 = 18, dealer A+6 = soft 17, next card a 2
    const state = gameReducer(dealHand(['10', 'A', '8', '6', '2']), { type: 'STAND' });
    assert.equal(state.dealerHand.length, 2);
    assert.equal(state.result, 'win');
});

test('dealer hits soft 17 under H17', () => {
    const state = gameReducer(
        dealHand(['10', 'A', '8', '6', '2'], { dealerHitsSoft17: true }),
        { type: 'STAND' },
    );
    assert.equal(state.dealerHand.length, 3); // A+6+2 = soft 19
    assert.equal(state.result, 'lose');
});

test('dealer stands on hard 17 even under H17', () => {
    const state = gameReducer(
        dealHand(['10', '10', '8', '7', '2'], { dealerHitsSoft17: true }),
        { type: 'STAND' },
    );
    assert.equal(state.dealerHand.length, 2);
    assert.equal(state.result, 'win');
});

test('blackjack pays according to the table payout', () => {
    const naturals = ['A', '9', 'K', '7'];
    // $500 start, $10 bet: balance after the bet is $490, then the bet comes back plus winnings
    assert.equal(dealHand(naturals).balance, 490 + 10 + 15);
    assert.equal(dealHand(naturals, { blackjackPayout: '6:5' }).balance, 490 + 10 + 12);
    assert.equal(dealHand(naturals, { blackjackPayout: '1:1' }).balance, 490 + 10 + 10);
    assert.equal(dealHand(naturals, { blackjackPayout: '6:5' }).result, 'blackjack');
});

test('blackjack profit rounds down to whole chips without float drift', () => {
    assert.equal(blackjackProfit(5, '3:2'), 7);
    assert.equal(blackjackProfit(10, '6:5'), 12);
    assert.equal(blackjackProfit(5, '6:5'), 6);
    assert.equal(blackjackProfit(25, '6:5'), 30);
    assert.equal(blackjackProfit(7, '1:1'), 7);
});

test('stats use the table payout for blackjacks', () => {
    const hand = { result: 'blackjack', bet: 10, doubled: false };
    assert.equal(profit_hand({ ...hand, blackjackPayout: '3:2' }), 15);
    assert.equal(profit_hand({ ...hand, blackjackPayout: '6:5' }), 12);
});

test('canDouble respects the doubleOn rule', () => {
    const hard8 = ['5', '10', '3', '9', '4'];
    const hard9 = ['5', '10', '4', '9', '4'];
    const hard10 = ['5', '10', '5', '9', '4'];
    assert.equal(canDouble(dealHand(hard8)), true);
    assert.equal(canDouble(dealHand(hard8, { doubleOn: '9-11' })), false);
    assert.equal(canDouble(dealHand(hard9, { doubleOn: '9-11' })), true);
    assert.equal(canDouble(dealHand(hard9, { doubleOn: '10-11' })), false);
    assert.equal(canDouble(dealHand(hard10, { doubleOn: '10-11' })), true);
    // Soft 18 is never in 9-11
    assert.equal(canDouble(dealHand(['A', '10', '7', '9', '4'], { doubleOn: '9-11' })), false);
});

test('DOUBLE is ignored when the rules forbid it', () => {
    const before = dealHand(['5', '10', '3', '9', '4'], { doubleOn: '10-11' });
    assert.equal(gameReducer(before, { type: 'DOUBLE' }), before);
});

test('normalizeHouseRules keeps old saves and fills new fields with defaults', () => {
    const old = normalizeHouseRules({ numDecks: 2, penetration: 0.6 });
    assert.deepEqual(old, { ...DEFAULT_HOUSE_RULES, numDecks: 2, penetration: 0.6 });
});

test('normalizeHouseRules replaces only the invalid fields', () => {
    const rules = normalizeHouseRules({
        numDecks: 3,
        penetration: 0.95,
        dealerHitsSoft17: true,
        blackjackPayout: '2:1',
        dealerPeeks: 'yes',
        doubleOn: '10-11',
    });
    assert.deepEqual(rules, { ...DEFAULT_HOUSE_RULES, dealerHitsSoft17: true, doubleOn: '10-11' });
    assert.deepEqual(normalizeHouseRules(null), DEFAULT_HOUSE_RULES);
    assert.deepEqual(normalizeHouseRules('6'), DEFAULT_HOUSE_RULES);
});
