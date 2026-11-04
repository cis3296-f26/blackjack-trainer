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
    const analysis = analyzeHand([card('5'), card('6')], card('6'), false);
    assert.equal(analysis.double, null);
    assert.equal(analysis.recommended, 'hit');
});

test('double is unavailable after a hit even when explicitly enabled', () => {
    const analysis = analyzeHand([card('2'), card('3'), card('6')], card('6'), true);
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
