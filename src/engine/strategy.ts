import type { Card, Rank } from './types';

const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
// Index into RANKS
const RANK_VALUE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 10, 10];

// The dealer's final result is stored as an array of 6 probabilities:
//   index 0..4 -> dealer finishes on 17, 18, 19, 20, 21 (so index = total - 17)
//   index 5    -> dealer busts
// BUST is the last slot. The dealer never finishes below 17 meaning they will keep hitting,
// so there are no slots for lower totals.
const BUST = 5; // dealer outcome slots: 0..4 = 17..21, 5 = bust

//Accepted actions so far
export type Action = 'hit' | 'stand';

export interface Outcome {
    ev: number; // expected profit per 1 unit bet: win = +1, lose = -1, push = 0
    win: number; // probability of winning the hand (0 to 1)
    push: number; // probability of tying the dealer (0 to 1)
    lose: number; // probability of losing the hand (0 to 1)
}

// What the UI needs to show a hint.
export interface Analysis {
    stand: Outcome;
    hit: Outcome; // assumes you play optimally after the first hit
    recommended: Action;
    dealerOutcomes: number[]; // P(dealer ends on 17,18,19,20,21,bust)
}

//Math portion

interface Total {
    hard: number;
    hasAce: boolean;
}

const fromCards = (cards: Card[]): Total => ({
    hard: cards.reduce((sum, c) => sum + RANK_VALUE[RANKS.indexOf(c.rank)], 0),
    hasAce: cards.some((c) => c.rank === 'A'),
});

const addRank = (t: Total, r: number): Total => ({
    hard: t.hard + RANK_VALUE[r],
    hasAce: t.hasAce || r === 0,
});

const bestTotal = (t: Total): number => (t.hasAce && t.hard + 10 <= 21 ? t.hard + 10 : t.hard);

//shared context + memo tables

interface Ctx {
    upcard: number; // rank index
    dealerMemo: Map<string, number[]>;
    playerMemo: Map<string, Step>;
}

const sum = (counts: number[]) => counts.reduce((a, b) => a + b, 0);
const key = (t: Total, counts: number[]) => `${t.hard}|${t.hasAce}|${counts.join(',')}`;

// ---- dealer ----

// Distribution of the dealer's final result, starting from `hand` and drawing from `counts`
function dealerFrom(hand: Total, counts: number[], ctx: Ctx): number[] {
    const total = bestTotal(hand);
    const dist = [0, 0, 0, 0, 0, 0];
    if (total > 21) {
        dist[BUST] = 1;
        return dist;
    }
    if (total >= 17) {
        dist[total - 17] = 1;
        return dist;
    }

    const k = key(hand, counts);
    const cached = ctx.dealerMemo.get(k);
    if (cached) return cached;

    const n = sum(counts);
    for (let r = 0; r < 13; r++) {
        if (counts[r] === 0) continue;
        const p = counts[r] / n;
        counts[r]--;
        const sub = dealerFrom(addRank(hand, r), counts, ctx);
        counts[r]++;
        for (let i = 0; i < 6; i++) dist[i] += p * sub[i];
    }
    ctx.dealerMemo.set(k, dist);
    return dist;
}

// Same, but the hole card is drawn first with the "no dealer blackjack" restriction
function dealerDistribution(counts: number[], ctx: Ctx): number[] {
    const start = addRank({ hard: 0, hasAce: false }, ctx.upcard);
    const blocked =
        ctx.upcard === 0 ? [9, 10, 11, 12] : RANK_VALUE[ctx.upcard] === 10 ? [0] : [];

    let n = 0;
    for (let r = 0; r < 13; r++) if (!blocked.includes(r)) n += counts[r];

    const dist = [0, 0, 0, 0, 0, 0];
    for (let r = 0; r < 13; r++) {
        if (blocked.includes(r) || counts[r] === 0) continue;
        const p = counts[r] / n;
        counts[r]--;
        const sub = dealerFrom(addRank(start, r), counts, ctx);
        counts[r]++;
        for (let i = 0; i < 6; i++) dist[i] += p * sub[i];
    }
    return dist;
}

//player 

const LOSS: Outcome = { ev: -1, win: 0, push: 0, lose: 1 };

function standOutcome(player: number, dealer: number[]): Outcome {
    let win = dealer[BUST];
    let push = 0;
    let lose = 0;
    for (let i = 0; i < BUST; i++) {
        const dealerTotal = 17 + i;
        if (player > dealerTotal) win += dealer[i];
        else if (player === dealerTotal) push += dealer[i];
        else lose += dealer[i];
    }
    return { ev: win - lose, win, push, lose };
}

interface Step {
    stand: Outcome;
    hit: Outcome;
    best: Outcome;
}

function playerStep(hand: Total, counts: number[], ctx: Ctx): Step {
    const k = key(hand, counts);
    const cached = ctx.playerMemo.get(k);
    if (cached) return cached;

    const stand = standOutcome(bestTotal(hand), dealerDistribution(counts, ctx));

    const hit: Outcome = { ev: 0, win: 0, push: 0, lose: 0 };
    const n = sum(counts);
    for (let r = 0; r < 13; r++) {
        if (counts[r] === 0) continue;
        const p = counts[r] / n;
        const next = addRank(hand, r);
        counts[r]--;
        const o = bestTotal(next) > 21 ? LOSS : playerStep(next, counts, ctx).best;
        counts[r]++;
        hit.win += p * o.win;
        hit.push += p * o.push;
        hit.lose += p * o.lose;
    }
    hit.ev = hit.win - hit.lose;

    const step: Step = { stand, hit, best: hit.ev > stand.ev ? hit : stand };
    ctx.playerMemo.set(k, step);
    return step;
}

//public API

export function analyzeHand(playerHand: Card[], dealerUpcard: Card): Analysis {
    const counts = Array<number>(13).fill(4);
    for (const c of [...playerHand, dealerUpcard]) counts[RANKS.indexOf(c.rank)]--;

    const ctx: Ctx = {
        upcard: RANKS.indexOf(dealerUpcard.rank),
        dealerMemo: new Map(),
        playerMemo: new Map(),
    };

    const step = playerStep(fromCards(playerHand), counts, ctx);
    return {
        stand: step.stand,
        hit: step.hit,
        recommended: step.hit.ev > step.stand.ev ? 'hit' : 'stand',
        dealerOutcomes: dealerDistribution(counts, ctx),
    };
}