// Headless sim + fuzz for Flipside. Plays many seeded games with bots against
// the real engine, checks invariants after every action, then prints a balance
// report. Exits non-zero on any invariant failure.
//
//   node scripts/sim.mjs            # default run
//   node scripts/sim.mjs --games 2000
import * as E from "../public/engine.js";

const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => (a.startsWith("--") ? [a.slice(2), all[i + 1]] : null)).filter(Boolean));
const GAMES = Number(args.games || 400);
const failures = [];
let failCount = 0;
function fail(seed, msg) {
	if (failCount++ < 25) failures.push(`[${seed}] ${msg}`);
}

// ---------- Invariants ----------
function check(game, tag) {
	for (const p of game.players) {
		const who = `${tag} day ${game.day} ${p.name}`;
		if (!Number.isInteger(p.cash) || p.cash < 0) fail(game.seed, `${who}: bad cash ${p.cash}`);
		if (!Number.isInteger(p.debt) || p.debt < 0) fail(game.seed, `${who}: bad debt ${p.debt}`);
		if (!Number.isInteger(p.bank) || p.bank < 0) fail(game.seed, `${who}: bad bank ${p.bank}`);
		const ledger = Object.values(p.ledger).reduce((a, b) => a + b, 0);
		if (p.startCash + ledger !== p.cash) fail(game.seed, `${who}: cash ${p.cash} != start ${p.startCash} + ledger ${ledger}`);
		for (const g in p.inv) {
			if (!Number.isInteger(p.inv[g]) || p.inv[g] <= 0) fail(game.seed, `${who}: inventory ${g}=${p.inv[g]}`);
			if (!(p.cost[g] >= 0)) fail(game.seed, `${who}: cost basis ${g}=${p.cost[g]}`);
		}
		if (E.used(p) > E.capacity(p)) fail(game.seed, `${who}: over capacity ${E.used(p)}/${E.capacity(p)}`);
		for (const s in p.stocks) if (!(p.stocks[s] > 0)) fail(game.seed, `${who}: stock ${s}=${p.stocks[s]}`);
		const nw = E.netWorth(game, p);
		if (!Number.isFinite(nw)) fail(game.seed, `${who}: net worth ${nw}`);
		if (p.simple && E.goodsFor(p).length >= E.GOODS.length) fail(game.seed, `${who}: simple mode shows every good`);
	}
	for (const m of E.MARKETS) {
		for (const g of E.GOODS) {
			const pr = E.price(game, m.id, g.id);
			const [lo, hi] = E.priceRange(m.id, g.id);
			if (!(pr >= Math.max(100, Math.floor(lo / 100) * 100 - 100) && pr <= Math.ceil(hi / 100) * 100 + 100)) fail(game.seed, `${tag} day ${game.day}: ${g.id}@${m.id} price ${pr} outside ${lo}-${hi}`);
		}
	}
	for (const c of game.companies) if (!(c.price >= 1) || !Number.isFinite(c.price)) fail(game.seed, `${tag}: ${c.id} price ${c.price}`);
	if (!(game.index.nav > 0)) fail(game.seed, `${tag}: index nav ${game.index.nav}`);
}

// ---------- Bots ----------
// Each bot gets its own RNG (not the game's) so bot choices never touch game streams.
function rng(seed) {
	return E.stream(seed, "bot");
}

// Random: buys and sells random amounts, wanders, ignores the loan.
function randomBot(game, p, r) {
	const goods = E.goodsFor(p);
	for (let k = 0; k < 2; k++) {
		if (r.chance(0.5)) {
			const held = Object.keys(p.inv);
			if (held.length) {
				const g = r.pick(held);
				E.sell(game, g, r.int(1, p.inv[g]));
			}
		} else {
			const g = r.pick(goods).id;
			const max = E.maxBuy(game, p, g);
			if (max > 0) E.buy(game, g, r.int(1, max));
		}
		check(game, "random");
	}
	return r.chance(0.7) ? r.pick(E.MARKETS).id : null;
}

// Buy-low/sell-high: remembers prices it has seen, knows the usual price of each item.
function smartBot(game, p, r, mem) {
	const goods = E.goodsFor(p);
	const at = p.at;
	const left = game.days - game.day;
	mem[at] = mem[at] || {};
	for (const g of goods) mem[at][g.id] = E.price(game, at, g.id);
	const expect = (m, g) => (mem[m] && mem[m][g]) || E.GOOD[g].base * 100 * 1.0;
	// Sell what's up enough over cost (or everything on the last day).
	for (const g of Object.keys(p.inv)) {
		const have = p.inv[g];
		const avg = p.cost[g] / have;
		const floorPrice = left === 0 ? 0 : Math.max(avg * 1.1, 1);
		let lo = 0, hi = have;
		while (lo < hi) {
			const mid = Math.ceil((lo + hi) / 2);
			const last = E.quoteSell(game, at, g, mid, p) - E.quoteSell(game, at, g, mid - 1, p);
			if (last >= floorPrice) lo = mid;
			else hi = mid - 1;
		}
		if (lo > 0) E.sell(game, g, lo);
	}
	check(game, "smart-sell");
	// Pay Eddie.
	if (at === "downtown" && p.debt > 0) {
		const pay = Math.min(p.debt, Math.max(0, p.cash - (p.debt * 1.5 > p.cash ? 0 : 30000)));
		if (pay > 0 && (p.cash > p.debt + 30000 || game.day >= p.dueDay - 1)) E.repay(game, Math.min(p.debt, p.cash));
	}
	// Storage.
	const next = E.STORAGE[p.storage + 1];
	if (next && left > 6 && p.debt === 0 && p.cash > next.price * 100 * 2.2) E.upgradeStorage(game);
	// Businesses: buy one if it can pay back most of itself before the end.
	if (p.tier2 && left > 25) {
		for (const B of [...E.BUSINESSES].reverse()) {
			const o = E.businessOutlook(B.id, false);
			if (p.cash > B.price * 100 * 2 && o.payback < left * 1.5 && p.businesses.length < 3) {
				E.buyBusiness(game, B.id);
				break;
			}
		}
	}
	if (left === 0) for (const b of [...p.businesses]) E.sellBusiness(game, b.uid);
	// Buy the best spread it knows about, if there's at least 25% to gain.
	if (left > 0) {
		let best = null;
		for (const g of goods) {
			const here = E.price(game, at, g.id);
			let target = 0, where = null;
			for (const m of E.MARKETS) {
				if (m.id === at) continue;
				const v = expect(m.id, g.id) - E.fare(at, m.id) / 4;
				if (v > target) (target = v), (where = m.id);
			}
			const ratio = target / here;
			if (ratio > 1.25 && (!best || ratio > best.ratio)) best = { g: g.id, ratio, target, where };
		}
		if (best) {
			let q = E.maxBuy(game, p, best.g);
			while (q > 0 && E.quoteBuy(game, at, best.g, q, p) - E.quoteBuy(game, at, best.g, q - 1, p) > best.target / 1.2) q = Math.floor(q * 0.8);
			if (q > 0) E.buy(game, best.g, q);
		}
	}
	check(game, "smart-buy");
	// Stocks at the end: park spare cash in the index while it waits.
	if (p.tier3 && left > 3 && p.cash > 600000) E.buyIndex(game, p.cash - 400000);
	if (p.tier3 && left === 1 && E.indexValue(game, p) > 0) E.sellIndex(game, E.indexValue(game, p));
	// Where next: Eddie if it's due, else the best place to sell what it holds.
	if (left === 0) return null;
	if (p.debt > 0 && game.day >= p.dueDay - 2 && at !== "downtown") return "downtown";
	let bestM = null, bestV = -Infinity;
	for (const m of E.MARKETS) {
		if (m.id === at) continue;
		let v = -E.fare(at, m.id);
		for (const g in p.inv) v += p.inv[g] * (expect(m.id, g) - p.cost[g] / p.inv[g]);
		if (!mem[m.id]) v += 5000; // worth a look
		v += r.next() * 1000;
		if (v > bestV) (bestV = v), (bestM = m.id);
	}
	return bestM;
}

function play(seed, days, kinds, simpleFlags = []) {
	const players = kinds.map((k, i) => ({ name: `${k}${i}`, simple: !!simpleFlags[i] }));
	const game = E.createGame({ seed, days, players });
	const rs = kinds.map((_, i) => rng(seed + "-" + i));
	const mems = kinds.map(() => ({}));
	check(game, "start");
	let guard = 0;
	while (!game.over) {
		if (guard++ > days * kinds.length + 10) {
			fail(seed, "game never ended");
			break;
		}
		const p = E.currentPlayer(game);
		const i = p.id;
		p.inbox.length = 0;
		let to;
		try {
			to = kinds[i] === "smart" ? smartBot(game, p, rs[i], mems[i]) : randomBot(game, p, rs[i]);
		} catch (e) {
			fail(seed, `bot threw: ${e.stack}`);
			break;
		}
		let res = E.endTurn(game, to);
		if (!res.ok) res = E.endTurn(game, null);
		check(game, "endTurn");
	}
	return game;
}

// Round trip never makes money.
function pumpCheck(seed) {
	const game = E.createGame({ seed, days: 30 });
	const p = game.players[0];
	const r = rng(seed + "pump");
	for (let k = 0; k < 40; k++) {
		const g = r.pick(E.GOODS).id;
		const before = p.cash;
		const q = Math.max(1, Math.min(E.maxBuy(game, p, g), r.int(1, 30)));
		if (!E.buy(game, g, q).ok) continue;
		// Sell back in random chunks.
		while (p.inv[g]) E.sell(game, g, Math.min(p.inv[g], r.int(1, q)));
		if (p.cash > before) fail(seed, `money pump on ${g}: ${before} -> ${p.cash}`);
	}
}

// ---------- Run ----------
const t0 = Date.now();
const median = (a) => {
	const s = [...a].sort((x, y) => x - y);
	return s[Math.floor(s.length / 2)];
};
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const $ = (c) => E.fmt(Math.round(c));

// 1. Solo 30-day games: smart vs random on the same seed.
const smartNW = [], randNW = [], wins = [];
const unlock2 = [], unlock3 = [];
let tier2Count = 0, tier3Count = 0;
for (let i = 0; i < GAMES; i++) {
	const seed = `SIM-${i}`;
	const a = play(seed, 30, ["smart"]);
	const b = play(seed, 30, ["random"]);
	const na = E.netWorth(a, a.players[0]), nb = E.netWorth(b, b.players[0]);
	smartNW.push(na);
	randNW.push(nb);
	wins.push(na > nb);
	const sp = a.players[0];
	if (sp.tier2) {
		tier2Count++;
		unlock2.push(sp.history.find((h) => h.nw >= E.TIER2_AT)?.day ?? 30);
	}
	if (sp.tier3) tier3Count++;
	// Same seed, different players: the news is identical.
	const na2 = a.news.map((n) => n.text).join("\n"), nb2 = b.news.map((n) => n.text).join("\n");
	if (na2 !== nb2) fail(seed, "news differs between two games on the same seed");
	// Determinism: replaying the same bot on the same seed gives the same result.
	if (i < 40) {
		const a2 = play(seed, 30, ["smart"]);
		if (E.netWorth(a2, a2.players[0]) !== na) fail(seed, "replay of the same seed and moves gave a different result");
	}
	if (i < 100) pumpCheck(seed);
}

// 2. Fuzz: hot-seat mixes, simple mode, all lengths.
let fuzzGames = 0;
for (let i = 0; i < Math.max(60, GAMES / 4); i++) {
	const r = rng("FUZZ" + i);
	const n = r.int(1, 4);
	const kinds = Array.from({ length: n }, () => (r.chance(0.5) ? "smart" : "random"));
	const simple = kinds.map(() => r.chance(0.3));
	const days = r.pick([30, 60, 90]);
	const g = play(`FUZZ-${i}`, days, kinds, simple);
	if (!g.over) fail(g.seed, "fuzz game did not finish");
	for (const p of g.players) {
		const d = E.debrief(g, p);
		if (!d.lines.length || d.lines.some((l) => /undefined|NaN/.test(l.text))) fail(g.seed, `debrief: ${JSON.stringify(d.lines)}`);
		for (const y of [10, 30]) {
			const ff = E.fastForward(g, p, y);
			if (ff.yours.some((v) => !Number.isFinite(v) || v < 0)) fail(g.seed, `fast-forward ${y}y has bad values`);
		}
	}
	fuzzGames++;
}

// 3. 30-year market: index vs a random single-stock picker.
const YEARS = 30, LONG = Math.max(300, GAMES);
const idxEnd = [], pickEnd = [], pick3End = [];
let idxBeatsPick = 0, idxBeatsPick3 = 0, pickBig = 0;
for (let i = 0; i < LONG; i++) {
	const g = E.createGame({ seed: `LONG-${i}` });
	const r = E.stream(g.seed, "long");
	const comps = g.companies.map((c) => ({ ...c, hist: undefined }));
	const pick = Math.floor(r.next() * comps.length);
	const pick3 = new Set();
	while (pick3.size < 3) pick3.add(Math.floor(r.next() * comps.length));
	let idx = 1;
	// Value per $1: single pick holds shares (dividends reinvested), busts go to 0.
	let one = { id: comps[pick].id, units: 1 / comps[pick].price };
	let three = [...pick3].map((k) => ({ id: comps[k].id, units: 1 / 3 / comps[k].price }));
	let next = g.nextCompany;
	for (let m = 1; m <= YEARS * 12; m++) {
		const ret = E.stepCompanies(comps, r, 1 / 12);
		idx *= 1 + ret.index;
		for (const c of comps) {
			if (c.div) {
				if (one.id === c.id) one.units *= 1 + c.div / 12;
				for (const t of three) if (t.id === c.id) t.units *= 1 + c.div / 12;
			}
		}
		for (let k = 0; k < comps.length; k++) {
			if (comps[k].price < 100) {
				if (one.id === comps[k].id) one.units = 0;
				for (const t of three) if (t.id === comps[k].id) t.units = 0;
				const nc = E.replacementCompany(g.seed, next++, 1000 + m);
				comps[k] = { ...nc, id: nc.id + "+" + m, hist: undefined };
			}
		}
	}
	const val = (h) => {
		const c = comps.find((x) => x.id === h.id);
		return c ? h.units * c.price : 0;
	};
	const v1 = val(one), v3 = three.reduce((a, h) => a + val(h), 0);
	idxEnd.push(idx);
	pickEnd.push(v1);
	pick3End.push(v3);
	if (idx > v1) idxBeatsPick++;
	if (idx > v3) idxBeatsPick3++;
	if (v1 > idx * 2) pickBig++;
}

// ---------- Report ----------
const pctS = (x) => `${Math.round(x * 100)}%`;
const lines = [];
lines.push(`# Flipside balance report`);
lines.push(``);
lines.push(`${GAMES} solo 30-day games per bot (same seeds), ${fuzzGames} fuzz games (1–4 hot-seat players, simple mode mixed in, 30/60/90 days), ${LONG} 30-year markets. ${((Date.now() - t0) / 1000).toFixed(1)}s.`);
lines.push(``);
lines.push(`## Flip: buy-low/sell-high bot vs random play (start: $500 own + $1,500 loan)`);
lines.push(`| | Median net worth | Mean | Worst | Best |`);
lines.push(`|---|---|---|---|---|`);
lines.push(`| Buy-low/sell-high bot | ${$(median(smartNW))} | ${$(mean(smartNW))} | ${$(Math.min(...smartNW))} | ${$(Math.max(...smartNW))} |`);
lines.push(`| Random play | ${$(median(randNW))} | ${$(mean(randNW))} | ${$(Math.min(...randNW))} | ${$(Math.max(...randNW))} |`);
lines.push(``);
lines.push(`The bot beat random play on the same seed in **${pctS(wins.filter(Boolean).length / GAMES)}** of games. It reached Tier 2 (${$(E.TIER2_AT)}) in ${pctS(tier2Count / GAMES)} of games (median day ${unlock2.length ? median(unlock2) : "–"}) and Tier 3 in ${pctS(tier3Count / GAMES)}.`);
lines.push(``);
lines.push(`## Invest: index fund vs random stock picking, 30 years, $1 in`);
lines.push(`| | Median | Mean | 10th pct | 90th pct |`);
const q = (a, f) => [...a].sort((x, y) => x - y)[Math.floor(a.length * f)];
lines.push(`|---|---|---|---|---|`);
for (const [name, a] of [["Index fund", idxEnd], ["One random stock", pickEnd], ["Three random stocks", pick3End]]) lines.push(`| ${name} | ${median(a).toFixed(2)}× | ${mean(a).toFixed(2)}× | ${q(a, 0.1).toFixed(2)}× | ${q(a, 0.9).toFixed(2)}× |`);
lines.push(``);
lines.push(`Index beat one random stock in **${pctS(idxBeatsPick / LONG)}** of runs and three random stocks in **${pctS(idxBeatsPick3 / LONG)}**. One random stock more than doubled the index in ${pctS(pickBig / LONG)} of runs.`);
lines.push(``);
lines.push(failCount ? `## FAILURES (${failCount})\n${failures.join("\n")}` : `## Invariants: all passed`);
console.log(lines.join("\n"));
if (args.out) (await import("node:fs")).writeFileSync(args.out, lines.join("\n") + "\n");
process.exit(failCount ? 1 : 0);
