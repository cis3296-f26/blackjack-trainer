import assert from 'node:assert/strict';
import test from 'node:test';
import { loadEngine } from './loadEngine.mjs';

const { analyzeHand } = await loadEngine('strategy');
const card = (rank) => ({ rank, suit: '♠' });
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10);
const sumTo1 = (probs) => near(probs.reduce((a, b) => a + b, 0), 1);

// Single deck S17, double on anything: small enough to keep the exact math fast
const S17 = { numDecks: 1, dealerHitsSoft17: false, doubleOn: 'any' };
const H17 = { ...S17, dealerHitsSoft17: true };

test('double on 11 against 6 has twice the one-card profit and wins the recommendation', () => {
    const analysis = analyzeHand([card('5'), card('6')], card('6'), S17);
    assert.equal(analysis.recommended, 'double');
    near(analysis.double.win + analysis.double.push + analysis.double.lose, 1);
    near(analysis.double.ev, 2 * (analysis.double.win - analysis.double.lose));
    // Every draw from hard 11 should stand, so hit and double have the same outcomes.
    near(analysis.double.win, analysis.hit.win);
    near(analysis.double.ev, 2 * analysis.hit.ev);
});

test('doubling stops after one card even when hitting again would improve the hand', () => {
    const analysis = analyzeHand([card('2'), card('3')], card('6'), S17);
    assert.ok(analysis.hit.ev > analysis.double.ev / 2);
    near(analysis.double.win + analysis.double.push + analysis.double.lose, 1);
});

test('unavailable double falls back to a legal action', () => {
    const analysis = analyzeHand([card('5'), card('6')], card('6'), S17, false);
    assert.equal(analysis.double, null);
    assert.equal(analysis.recommended, 'hit');
});

test('double is unavailable after a hit even when explicitly enabled', () => {
    const analysis = analyzeHand([card('2'), card('3'), card('6')], card('6'), S17, true);
    assert.equal(analysis.double, null);
    assert.notEqual(analysis.recommended, 'double');
});

test('double includes bust risk and preserves probabilities for soft hands', () => {
    const hard = analyzeHand([card('10'), card('10')], card('6'), S17);
    assert.ok(hard.double.lose > 0.8);
    assert.equal(hard.recommended, 'stand');
    const soft = analyzeHand([card('A'), card('7')], card('6'), S17);
    near(soft.double.win + soft.double.push + soft.double.lose, 1);
    near(soft.double.ev, 2 * (soft.double.win - soft.double.lose));
});

test('H17 makes the dealer hit soft 17, so finishing on 17 gets less likely', () => {
    const s17 = analyzeHand([card('10'), card('8')], card('6'), S17);
    const h17 = analyzeHand([card('10'), card('8')], card('6'), H17);
    sumTo1(s17.dealerOutcomes);
    sumTo1(h17.dealerOutcomes);
    assert.ok(h17.dealerOutcomes[0] < s17.dealerOutcomes[0]);
    assert.ok(h17.dealerOutcomes[5] > s17.dealerOutcomes[5]);
    // Standing on 18 vs a 6 still has a different EV once the dealer's 17s change
    assert.notEqual(h17.stand.ev, s17.stand.ev);
});

test('H17 changes nothing against a ten upcard, which can never make soft 17', () => {
    const s17 = analyzeHand([card('9'), card('7')], card('K'), S17);
    const h17 = analyzeHand([card('9'), card('7')], card('K'), H17);
    s17.dealerOutcomes.forEach((p, i) => near(p, h17.dealerOutcomes[i]));
    near(s17.hit.ev, h17.hit.ev);
});

test('doubleOn limits which two-card totals can double', () => {
    const nineEleven = { ...S17, doubleOn: '9-11' };
    const tenEleven = { ...S17, doubleOn: '10-11' };
    assert.equal(analyzeHand([card('5'), card('3')], card('6'), nineEleven).double, null);
    assert.notEqual(analyzeHand([card('5'), card('4')], card('6'), nineEleven).double, null);
    assert.equal(analyzeHand([card('5'), card('4')], card('6'), tenEleven).double, null);
    assert.notEqual(analyzeHand([card('5'), card('5')], card('6'), tenEleven).double, null);
    // Soft hands are 12 or more, so they can't double under either restriction
    const soft = analyzeHand([card('A'), card('7')], card('6'), nineEleven);
    assert.equal(soft.double, null);
    assert.notEqual(soft.recommended, 'double');
});

test('deck count comes from the rules', () => {
    const one = analyzeHand([card('10'), card('6')], card('10'), S17);
    const six = analyzeHand([card('10'), card('6')], card('10'), { ...S17, numDecks: 6 });
    assert.notEqual(one.hit.ev, six.hit.ev);
});
