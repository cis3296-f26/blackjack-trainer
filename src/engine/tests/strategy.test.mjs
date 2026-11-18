import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../strategy.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const { analyzeHand } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const card = (rank) => ({ rank, suit: '♠' });
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10);

test('double on 11 against 6 has twice the one-card profit and wins the recommendation', () => {
    const analysis = analyzeHand([card('5'), card('6')], card('6'));
    assert.equal(analysis.recommended, 'double');
    near(analysis.double.win + analysis.double.push + analysis.double.lose, 1);
    near(analysis.double.ev, 2 * (analysis.double.win - analysis.double.lose));
    // Every draw from hard 11 should stand, so hit and double have the same outcomes.
    near(analysis.double.win, analysis.hit.win);
    near(analysis.double.ev, 2 * analysis.hit.ev);
});

test('doubling stops after one card even when hitting again would improve the hand', () => {
    const analysis = analyzeHand([card('2'), card('3')], card('6'));
    assert.ok(analysis.hit.ev > analysis.double.ev / 2);
    near(analysis.double.win + analysis.double.push + analysis.double.lose, 1);
});

test('unavailable double falls back to a legal action', () => {
    const analysis = analyzeHand([card('5'), card('6')], card('6'), 1, false);
    assert.equal(analysis.double, null);
    assert.equal(analysis.recommended, 'hit');
});

test('double is unavailable after a hit even when explicitly enabled', () => {
    const analysis = analyzeHand([card('2'), card('3'), card('6')], card('6'), 1, true);
    assert.equal(analysis.double, null);
    assert.notEqual(analysis.recommended, 'double');
});

test('double includes bust risk and preserves probabilities for soft hands', () => {
    const hard = analyzeHand([card('10'), card('10')], card('6'));
    assert.ok(hard.double.lose > 0.8);
    assert.equal(hard.recommended, 'stand');
    const soft = analyzeHand([card('A'), card('7')], card('6'));
    near(soft.double.win + soft.double.push + soft.double.lose, 1);
    near(soft.double.ev, 2 * (soft.double.win - soft.double.lose));
});

test('split aces and eights against 6 beat the other actions', () => {
    for (const rank of ['A', '8']) {
        const analysis = analyzeHand([card(rank), card(rank)], card('6'));
        assert.equal(analysis.recommended, 'split');
        near(analysis.split.win + analysis.split.push + analysis.split.lose, 1);
        near(analysis.split.ev, 2 * (analysis.split.win - analysis.split.lose));
        assert.ok(analysis.split.ev > Math.max(analysis.hit.ev, analysis.stand.ev, analysis.double.ev));
    }
});

test('pairs still choose double or stand when those earn more than splitting', () => {
    assert.equal(analyzeHand([card('5'), card('5')], card('6')).recommended, 'double');
    assert.equal(analyzeHand([card('10'), card('K')], card('6')).recommended, 'stand');
});

test('late surrender on hard 16 against 10 loses exactly half the original bet', () => {
    const analysis = analyzeHand([card('10'), card('6')], card('10'), 6);
    assert.equal(analysis.recommended, 'surrender');
    assert.deepEqual(analysis.surrender, { ev: -0.5, win: 0, push: 0, lose: 1 });
    assert.ok(analysis.hit.ev < -0.5);
    assert.ok(analysis.stand.ev < -0.5);
});

test('surrender is not recommended for a strong hand', () => {
    const analysis = analyzeHand([card('10'), card('9')], card('6'));
    assert.equal(analysis.recommended, 'stand');
    assert.ok(analysis.stand.ev > analysis.surrender.ev);
});

test('split requires two cards of equal value, including mixed ten-valued ranks', () => {
    assert.equal(analyzeHand([card('8'), card('7')], card('6')).split, null);
    assert.ok(analyzeHand([card('J'), card('Q')], card('6')).split);
    const afterHit = analyzeHand([card('2'), card('2'), card('2')], card('6'));
    assert.equal(afterHit.split, null);
    assert.equal(afterHit.surrender, null);
    assert.ok(['hit', 'stand'].includes(afterHit.recommended));
});

test('disabled split and surrender fall back to the best available action', () => {
    const pair = analyzeHand([card('8'), card('8')], card('6'), 1, true, false);
    assert.equal(pair.split, null);
    assert.equal(pair.recommended, 'stand');
    const hard16 = analyzeHand([card('10'), card('6')], card('10'), 6, true, true, false);
    assert.equal(hard16.surrender, null);
    assert.equal(hard16.recommended, 'hit');
});

test('split availability is independent of double availability', () => {
    const analysis = analyzeHand([card('8'), card('8')], card('6'), 1, false, true, false);
    assert.equal(analysis.double, null);
    assert.equal(analysis.surrender, null);
    assert.equal(analysis.recommended, 'split');
});
