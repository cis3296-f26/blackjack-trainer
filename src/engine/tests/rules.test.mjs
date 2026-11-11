import assert from 'node:assert/strict';
import test from 'node:test';
import { loadEngine } from './loadEngine.mjs';

const { DEFAULT_HOUSE_RULES, HOUSE_RULE_PRESETS, findPreset, normalizeHouseRules, rulesEqual } =
    await loadEngine('rules');

test('rulesEqual ignores float noise in penetration but catches real differences', () => {
    assert.ok(rulesEqual(DEFAULT_HOUSE_RULES, { ...DEFAULT_HOUSE_RULES, penetration: 0.7500000001 }));
    assert.ok(!rulesEqual(DEFAULT_HOUSE_RULES, { ...DEFAULT_HOUSE_RULES, penetration: 0.7 }));
    assert.ok(!rulesEqual(DEFAULT_HOUSE_RULES, { ...DEFAULT_HOUSE_RULES, dealerHitsSoft17: true }));
    assert.ok(!rulesEqual(DEFAULT_HOUSE_RULES, { ...DEFAULT_HOUSE_RULES, blackjackPayout: '6:5' }));
    assert.ok(!rulesEqual(DEFAULT_HOUSE_RULES, { ...DEFAULT_HOUSE_RULES, doubleOn: '9-11' }));
});

test('every preset is a valid, distinct rule set with a unique id', () => {
    const ids = new Set(HOUSE_RULE_PRESETS.map((p) => p.id));
    assert.equal(ids.size, HOUSE_RULE_PRESETS.length);
    for (const preset of HOUSE_RULE_PRESETS) {
        // Survives a save/load round trip unchanged
        assert.deepEqual(normalizeHouseRules(JSON.parse(JSON.stringify(preset.rules))), preset.rules);
        // Matches itself and no other preset
        assert.equal(findPreset(preset.rules), preset);
    }
});

test('the defaults match a preset, and tweaked rules are custom', () => {
    assert.ok(findPreset(DEFAULT_HOUSE_RULES));
    assert.equal(findPreset({ ...DEFAULT_HOUSE_RULES, penetration: 0.55 }), undefined);
});
