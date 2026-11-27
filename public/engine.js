// Flipside engine: pure game state + rules. No DOM. Imported by the UI and by
// scripts/sim.mjs, so the headless fuzz plays the exact rules the browser does.
//
// Money is integer cents everywhere. Randomness is counter-based: every draw
// comes from stream(seed, tag, day, ...), so a seed replays the same prices,
// news and hazard rolls no matter what the players do (only their own market
// impact differs).

// ---------- RNG ----------
function hashStr(s) {
	let h = 2166136261 >>> 0;
	for (let i = 0; i < s.length; i++) {
		h ^= s.charCodeAt(i);
		h = Math.imul(h, 16777619) >>> 0;
	}
	return h >>> 0;
}
function mulberry(a) {
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
export function stream(seed, ...keys) {
	const r = mulberry(hashStr(String(seed) + "|" + keys.join("|")));
	const s = {
		next: r,
		range: (a, b) => a + r() * (b - a),
		int: (a, b) => a + Math.floor(r() * (b - a + 1)),
		pick: (arr) => arr[Math.floor(r() * arr.length)],
		chance: (p) => r() < p,
		normal: () => {
			const u = Math.max(r(), 1e-12);
			return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
		},
	};
	return s;
}
export function randomSeed() {
	const words = ["MAPLE", "ROCKET", "PICKLE", "TIGER", "COMET", "WAFFLE", "BISON", "LASER", "OTTER", "CACTUS", "NOODLE", "THUNDER"];
	const w = words[Math.floor(Math.random() * words.length)];
	return w + "-" + Math.floor(100 + Math.random() * 900);
}

// ---------- Data ----------
// vol: daily log-price shock. impact: log price move per unit traded.
export const GOODS = [
	{ id: "fidget", name: "Fidget Spinners", icon: "🌀", base: 6, vol: 0.12, impact: 0.0015, size: 1, simple: false, cardboard: false },
	{ id: "comics", name: "Comic Books", icon: "📚", base: 22, vol: 0.08, impact: 0.003, size: 1, simple: false, cardboard: true },
	{ id: "cards", name: "Trading Cards", icon: "🃏", base: 40, vol: 0.11, impact: 0.0035, size: 1, simple: true, cardboard: true },
	{ id: "games", name: "Video Games", icon: "💿", base: 45, vol: 0.06, impact: 0.004, size: 1, simple: true, cardboard: false },
	{ id: "jerseys", name: "Vintage Jerseys", icon: "👕", base: 70, vol: 0.07, impact: 0.005, size: 1, simple: false, cardboard: false },
	{ id: "bricks", name: "Brick Sets", icon: "🧱", base: 95, vol: 0.05, impact: 0.006, size: 2, simple: true, cardboard: true },
	{ id: "tickets", name: "Concert Tickets", icon: "🎟️", base: 120, vol: 0.14, impact: 0.007, size: 1, simple: false, cardboard: false },
	{ id: "kicks", name: "Sneakers", icon: "👟", base: 150, vol: 0.09, impact: 0.006, size: 1, simple: true, cardboard: false },
	{ id: "consoles", name: "Retro Consoles", icon: "🕹️", base: 240, vol: 0.07, impact: 0.008, size: 2, simple: false, cardboard: true },
];
export const GOOD = Object.fromEntries(GOODS.map((g) => [g.id, g]));

// bias: long-run price multiplier per good in that market.
export const MARKETS = [
	{ id: "downtown", name: "Downtown", icon: "🏙️", x: 50, y: 45, blurb: "Busy and pricey. Fast Eddie's shack is here.", bias: { fidget: 1.1, comics: 1.05, cards: 1.0, games: 1.1, jerseys: 1.15, bricks: 1.1, tickets: 1.2, kicks: 1.2, consoles: 1.05 } },
	{ id: "maple", name: "Maple Heights", icon: "🏡", x: 22, y: 20, blurb: "Suburbs full of garage sales.", bias: { fidget: 0.85, comics: 0.8, cards: 0.9, games: 0.8, jerseys: 1.0, bricks: 0.75, tickets: 1.05, kicks: 1.0, consoles: 0.8 } },
	{ id: "harbor", name: "Harbor Flea", icon: "⚓", x: 80, y: 78, blurb: "The big weekend flea market.", bias: { fidget: 0.7, comics: 0.9, cards: 0.85, games: 0.95, jerseys: 0.85, bricks: 1.0, tickets: 0.9, kicks: 0.8, consoles: 0.9 } },
	{ id: "campus", name: "College Row", icon: "🎓", x: 82, y: 22, blurb: "Students with money for fun.", bias: { fidget: 1.2, comics: 1.1, cards: 1.15, games: 1.2, jerseys: 0.95, bricks: 0.9, tickets: 1.3, kicks: 1.1, consoles: 1.25 } },
	{ id: "mill", name: "Old Mill", icon: "🏭", x: 18, y: 76, blurb: "Thrift stores and dusty attics.", bias: { fidget: 0.9, comics: 0.75, cards: 1.0, games: 0.9, jerseys: 0.7, bricks: 0.95, tickets: 0.85, kicks: 0.9, consoles: 0.75 } },
	{ id: "arcade", name: "Arcade Strip", icon: "🎮", x: 50, y: 88, blurb: "Gamers, collectors and card nights.", bias: { fidget: 1.0, comics: 1.2, cards: 1.25, games: 1.05, jerseys: 1.05, bricks: 1.2, tickets: 1.0, kicks: 1.0, consoles: 1.3 } },
];
export const MARKET = Object.fromEntries(MARKETS.map((m) => [m.id, m]));

export const STORAGE = [
	{ id: "backpack", name: "Backpack", icon: "🎒", cap: 20, price: 0 },
	{ id: "car", name: "Old Car", icon: "🚗", cap: 60, price: 1200 },
	{ id: "unit", name: "Storage Unit", icon: "🏬", cap: 200, price: 5000 },
];

export const BUSINESSES = [
	{ id: "lawn", name: "Lawn Crew", icon: "🌱", price: 2000, rev: 120, sd: 70, exp: 60, repairP: 0.04, repair: 250, repairWhat: "The mower threw a blade", upgrade: { name: "Second crew", price: 2000, rev: 100, exp: 45 }, rainy: true },
	{ id: "vending", name: "Vending Route", icon: "🥤", price: 2500, rev: 100, sd: 30, exp: 25, repairP: 0.03, repair: 300, repairWhat: "A machine ate a pile of quarters and jammed", upgrade: { name: "Five more machines", price: 1800, rev: 70, exp: 15 } },
	{ id: "truck", name: "Food Truck", icon: "🌮", price: 7500, rev: 420, sd: 160, exp: 190, repairP: 0.05, repair: 900, repairWhat: "The fryer died mid-lunch", upgrade: { name: "Late-night menu", price: 3000, rev: 120, exp: 40 }, rainy: true },
	{ id: "shop", name: "Card Shop", icon: "🏪", price: 15000, rev: 640, sd: 120, exp: 310, repairP: 0.02, repair: 1000, repairWhat: "The roof leaked onto the display case", upgrade: { name: "Tournament nights", price: 5000, rev: 150, exp: 30 } },
];
export const BUSINESS = Object.fromEntries(BUSINESSES.map((b) => [b.id, b]));
export const BUSINESS_RESALE = 0.85;

export const SECTORS = { tech: "Tech", food: "Food", toys: "Toys & Games", energy: "Energy", retail: "Retail", health: "Health" };
// mu, sigma: annual arithmetic drift and idiosyncratic vol; div: annual dividend yield.
export const COMPANY_POOL = [
	{ id: "ZAPR", name: "Zappr Robotics", sector: "tech", price: 42 },
	{ id: "PXTD", name: "Pixeltide Studios", sector: "tech", price: 88 },
	{ id: "CRNC", name: "Crunchy Co.", sector: "food", price: 31 },
	{ id: "BRGR", name: "Burger Barn", sector: "food", price: 57 },
	{ id: "TOYB", name: "Toybox Inc.", sector: "toys", price: 24 },
	{ id: "VOLT", name: "Voltwind Energy", sector: "energy", price: 65 },
	{ id: "MRKT", name: "MegaMart", sector: "retail", price: 112 },
	{ id: "HLTH", name: "Healix Labs", sector: "health", price: 73 },
	// Reserve: a bust company's slot is filled from here.
	{ id: "NOVA", name: "Nova Rockets", sector: "tech", price: 20 },
	{ id: "SNAK", name: "Snackwave", sector: "food", price: 18 },
	{ id: "GLOW", name: "Glowstick Games", sector: "toys", price: 15 },
	{ id: "SUNR", name: "Sunrise Solar", sector: "energy", price: 22 },
	{ id: "THRD", name: "Threadline", sector: "retail", price: 25 },
	{ id: "MEND", name: "Mendwell", sector: "health", price: 19 },
];
export const STOCK_SLOTS = 8;
export const MARKET_VOL = 0.16; // shared market factor, annual
export const SECTOR_VOL = 0.12;
export const CD_RATE = 0.055; // annual
export const BANK_RATE = 0.04; // annual
export const CD_TERM = 30; // days
export const LOAN_RATE = 0.015; // daily
export const LATE_FEE = 5000; // cents per day
export const TRADING_DAYS = 252;

const ECON = {
	normal: { cash: 50000, loan: 150000 },
	simple: { cash: 100000, loan: 0 },
	tier2NetWorth: 500000,
	tier3NetWorth: 1500000,
};
export const TIER2_AT = ECON.tier2NetWorth;
export const TIER3_AT = ECON.tier3NetWorth;

const THETA = 0.12; // mean reversion per day
const IMPACT_DECAY = 0.6;
const SHOCK_DECAY = 0.8;
const LOG_MIN = Math.log(0.3);
const LOG_MAX = Math.log(3.5);
export const PRICE_BOUNDS = [0.3, 3.5]; // × base × bias

// ---------- Helpers ----------
export function fmt(c) {
	const neg = c < 0;
	const s = "$" + Math.abs(Math.round(c / 100)).toLocaleString("en-US");
	return neg ? "-" + s : s;
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function distance(a, b) {
	const A = MARKET[a], B = MARKET[b];
	return Math.hypot(A.x - B.x, A.y - B.y);
}
export function fare(from, to) {
	if (from === to) return 0;
	const d = distance(from, to);
	return Math.round((200 + d * d * 0.25) / 100) * 100; // cents: $2 plus more the farther you ride
}
export function goodsFor(player) {
	return player.simple ? GOODS.filter((g) => g.simple) : GOODS;
}
export function capacity(player) {
	return STORAGE[player.storage].cap;
}
export function used(player) {
	let n = 0;
	for (const id in player.inv) n += player.inv[id] * GOOD[id].size;
	return n;
}

// ---------- Setup ----------
export function createGame({ seed = randomSeed(), days = 30, players = [{ name: "Player 1", emoji: "😎", color: "#ff7a30", simple: false }] } = {}) {
	seed = String(seed).trim().toUpperCase() || randomSeed();
	const r = stream(seed, "setup");
	const markets = {};
	for (const m of MARKETS) {
		markets[m.id] = {};
		for (const g of GOODS) markets[m.id][g.id] = { x: r.normal() * g.vol * 1.5, impact: 0, shock: 0, prev: 0, hist: [] };
	}
	const companies = [];
	for (let i = 0; i < STOCK_SLOTS; i++) companies.push(newCompany(seed, COMPANY_POOL[i], 0));
	const game = {
		v: 1,
		seed,
		days,
		day: 1,
		turn: 0, // index into order
		order: [],
		markets,
		pending: [], // scheduled shocks from rumors
		rumors: { heard: 0, real: 0, fake: 0 },
		news: [],
		companies,
		nextCompany: STOCK_SLOTS,
		index: { nav: 100, hist: [100] },
		over: false,
		players: players.map((p, i) => newPlayer(p, i, days)),
	};
	for (const m of MARKETS) for (const g of GOODS) markets[m.id][g.id].prev = price(game, m.id, g.id);
	game.order = turnOrder(game);
	game.news.push({ day: 1, text: `Day 1. ${game.players.length > 1 ? "Everyone starts" : "You start"} Downtown with a backpack and big plans.`, kind: "info" });
	recordHistory(game);
	return game;
}

function newPlayer(p, i, days) {
	const e = p.simple ? ECON.simple : ECON.normal;
	const player = {
		id: i,
		profile: p.id || null,
		name: p.name || `Player ${i + 1}`,
		emoji: p.emoji || "😎",
		color: p.color || "#ff7a30",
		simple: !!p.simple,
		at: "downtown",
		cash: e.cash + e.loan,
		startCash: e.cash + e.loan,
		ownMoney: e.cash,
		debt: e.loan,
		dueDay: Math.min(20, days),
		bank: 0,
		storage: 0,
		inv: {},
		cost: {}, // total cents paid for current holdings, per good
		insuredUntil: 0,
		businesses: [],
		stocks: {}, // symbol -> shares
		stockCost: {},
		indexUnits: 0,
		indexCost: 0,
		cds: [], // { amount, day }
		tier2: false,
		tier3: false,
		ownedBusiness: false,
		inbox: [],
		ledger: {}, // category -> cents (cash deltas)
		stats: { interestPaid: 0, bankEarned: 0, insurancePaid: 0, insurancePaidOut: 0, hazardLoss: 0, lateFees: 0, louTaken: 0, louVisits: 0, flips: [], bigMove: null, fares: 0, dividends: 0, cdEarned: 0 },
		history: [],
		travelTo: null,
	};
	return player;
}

function newCompany(seed, base, day) {
	const r = stream(seed, "company", base.id, day);
	return {
		id: base.id,
		name: base.name,
		sector: base.sector,
		price: base.price * 100,
		start: base.price * 100,
		mu: 0.1 + r.normal() * 0.05,
		sigma: 0.2 + r.next() * 0.25,
		beta: 0.7 + r.next() * 0.6,
		div: r.chance(0.5) ? Math.round(r.range(0.005, 0.035) * 1000) / 1000 : 0,
		hist: [base.price * 100],
		listed: day,
	};
}

// The company that takes a bust company's slot. `n` counts replacements so far
// (game.nextCompany); ids get a number once the reserve pool wraps.
export function replacementCompany(seed, n, day) {
	const base = COMPANY_POOL[n % COMPANY_POOL.length];
	return newCompany(seed, { ...base, id: base.id + (n >= COMPANY_POOL.length ? n : "") }, day);
}

function turnOrder(game) {
	const n = game.players.length;
	const start = (game.day - 1) % n;
	return Array.from({ length: n }, (_, i) => (start + i) % n);
}

// ---------- Prices ----------
function logMult(state) {
	return clamp(state.x + state.impact + state.shock, LOG_MIN, LOG_MAX);
}
function rawPrice(game, m, g) {
	const s = game.markets[m][g];
	return GOOD[g].base * 100 * MARKET[m].bias[g] * Math.exp(logMult(s));
}
// Price of the next unit, whole dollars (in cents). Simple players see $5 steps over $20.
export function price(game, m, g, player) {
	const p = Math.max(100, Math.round(rawPrice(game, m, g) / 100) * 100);
	if (player && player.simple) return simpleRound(p);
	return p;
}
function simpleRound(p) {
	if (p >= 2000) return Math.max(500, Math.round(p / 500) * 500);
	return Math.max(100, Math.round(p / 100) * 100);
}
export function prevPrice(game, m, g) {
	return game.markets[m][g].prev;
}
export function priceRange(m, g) {
	const b = GOOD[g].base * 100 * MARKET[m].bias[g];
	return [b * PRICE_BOUNDS[0], b * PRICE_BOUNDS[1]];
}

// Total cost to buy q units (cents) with slippage: unit i costs p·r^i. Rounded up.
export function quoteBuy(game, m, g, q, player) {
	if (q <= 0) return 0;
	if (player && player.simple) return price(game, m, g, player) * q;
	const p = rawPrice(game, m, g);
	const k = GOOD[g].impact;
	const r = Math.exp(k);
	// Respect the price ceiling: past the cap, units cost the capped price.
	const s = game.markets[m][g];
	const room = Math.max(0, Math.floor((LOG_MAX - logMult(s)) / k));
	const n1 = Math.min(q, room);
	let total = n1 > 0 ? (p * (Math.pow(r, n1) - 1)) / (r - 1) : 0;
	if (q > n1) total += (q - n1) * p * Math.pow(r, n1);
	// Round (not ceil) so buying one costs exactly the shown price. Selling floors,
	// so a buy-then-sell round trip can never make money.
	return Math.max(q * 100, Math.round(total / 100) * 100);
}
// Total proceeds for selling q units: unit i gets p·r^-(i+1). Rounded down.
export function quoteSell(game, m, g, q, player) {
	if (q <= 0) return 0;
	if (player && player.simple) return price(game, m, g, player) * q;
	const p = rawPrice(game, m, g);
	const k = GOOD[g].impact;
	const r = Math.exp(-k);
	const s = game.markets[m][g];
	const room = Math.max(0, Math.floor((logMult(s) - LOG_MIN) / k));
	const n1 = Math.min(q, room);
	let total = n1 > 0 ? (p * r * (1 - Math.pow(r, n1))) / (1 - r) : 0;
	if (q > n1) total += (q - n1) * p * Math.pow(r, n1);
	return Math.max(0, Math.floor(total / 100) * 100);
}

export function maxBuy(game, player, g) {
	const free = Math.floor((capacity(player) - used(player)) / GOOD[g].size);
	if (free <= 0) return 0;
	let lo = 0, hi = free;
	while (lo < hi) {
		const mid = Math.ceil((lo + hi) / 2);
		if (quoteBuy(game, player.at, g, mid, player) <= player.cash) lo = mid;
		else hi = mid - 1;
	}
	return lo;
}

// ---------- Holdings ----------
// Cost basis of n of your g (average cost). The UI previews profit with it too.
export function costBasis(p, g, n) {
	return Math.round((p.cost[g] * n) / p.inv[g]);
}
// Remove n of g and their share of the cost basis; returns that basis.
function takeGoods(p, g, n) {
	const basis = costBasis(p, g, n);
	p.inv[g] -= n;
	p.cost[g] -= basis;
	if (!p.inv[g]) {
		delete p.inv[g];
		delete p.cost[g];
	}
	return basis;
}
// One cheap unit fits and is affordable (the per-row Buy button).
export function canBuy(game, p, g) {
	return capacity(p) - used(p) >= GOOD[g].size && quoteBuy(game, p.at, g, 1, p) <= p.cash;
}

// ---------- Ledger ----------
function move(player, cat, cents) {
	if (!Number.isInteger(cents)) throw new Error(`non-integer cents ${cat} ${cents}`);
	player.cash += cents;
	player.ledger[cat] = (player.ledger[cat] || 0) + cents;
}
function note(player, text, kind = "info") {
	player.inbox.push({ text, kind });
}

// ---------- Player actions (current player only) ----------
export function currentPlayer(game) {
	return game.players[game.order[game.turn]];
}
function fail(msg) {
	return { ok: false, msg };
}

export function buy(game, g, q) {
	const p = currentPlayer(game);
	q = Math.floor(q);
	if (game.over || q <= 0) return fail("Pick how many.");
	if (!goodsFor(p).some((x) => x.id === g)) return fail("Not sold to you here.");
	if (used(p) + q * GOOD[g].size > capacity(p)) return fail("No room in your " + STORAGE[p.storage].name.toLowerCase() + ".");
	const cost = quoteBuy(game, p.at, g, q, p);
	if (cost > p.cash) return fail("Not enough cash.");
	const before = price(game, p.at, g);
	move(p, "goods", -cost);
	p.inv[g] = (p.inv[g] || 0) + q;
	p.cost[g] = (p.cost[g] || 0) + cost;
	// Simple-mode players trade at a flat round price, so their trades leave
	// prices alone; otherwise buy-then-sell at the moved price would print money.
	if (!p.simple) game.markets[p.at][g].impact += q * GOOD[g].impact;
	trackMove(game, p, g, before, "buying");
	return { ok: true, cost };
}

export function sell(game, g, q) {
	const p = currentPlayer(game);
	q = Math.floor(q);
	const have = p.inv[g] || 0;
	if (game.over || q <= 0) return fail("Pick how many.");
	if (q > have) return fail("You don't have that many.");
	const proceeds = quoteSell(game, p.at, g, q, p);
	const before = price(game, p.at, g);
	const basis = takeGoods(p, g, q);
	move(p, "goods", proceeds);
	if (!p.simple) game.markets[p.at][g].impact -= q * GOOD[g].impact;
	p.stats.flips.push({ g, q, basis, proceeds, profit: proceeds - basis, at: p.at, day: game.day });
	trackMove(game, p, g, before, "selling");
	return { ok: true, proceeds, profit: proceeds - basis };
}

function trackMove(game, p, g, before, how) {
	const after = price(game, p.at, g);
	const pct = (after - before) / before;
	if (!p.stats.bigMove || Math.abs(pct) > Math.abs(p.stats.bigMove.pct)) {
		p.stats.bigMove = { g, pct, at: p.at, day: game.day, how };
	}
}

export function borrow(game, cents) {
	const p = currentPlayer(game);
	cents = Math.floor(cents / 100) * 100;
	if (p.at !== "downtown") return fail("Fast Eddie only does business Downtown.");
	if (cents <= 0) return fail("Pick an amount.");
	if (cents > borrowLimit(game, p)) return fail("Eddie won't lend you that much.");
	p.debt += cents;
	move(p, "loan", cents);
	if (p.dueDay < game.day) p.dueDay = Math.min(game.days, game.day + 10);
	return { ok: true };
}
export function borrowLimit(game, p) {
	const nw = netWorth(game, p);
	return Math.max(0, Math.floor((Math.max(200000, nw) - p.debt) / 100) * 100);
}
export function repay(game, cents) {
	const p = currentPlayer(game);
	if (p.at !== "downtown") return fail("Fast Eddie only takes payments Downtown.");
	cents = Math.min(Math.floor(cents), p.debt, p.cash);
	if (cents <= 0) return fail("Nothing to pay.");
	p.debt -= cents;
	move(p, "loan", -cents);
	return { ok: true };
}
export function deposit(game, cents) {
	const p = currentPlayer(game);
	cents = Math.min(Math.floor(cents), p.cash);
	if (cents <= 0) return fail("Nothing to deposit.");
	p.bank += cents;
	move(p, "bank", -cents);
	return { ok: true };
}
export function withdraw(game, cents) {
	const p = currentPlayer(game);
	cents = Math.min(Math.floor(cents), p.bank);
	if (cents <= 0) return fail("Nothing to withdraw.");
	p.bank -= cents;
	move(p, "bank", cents);
	return { ok: true };
}
export function upgradeStorage(game) {
	const p = currentPlayer(game);
	const next = STORAGE[p.storage + 1];
	if (!next) return fail("You already have the biggest storage.");
	const cost = next.price * 100;
	if (cost > p.cash) return fail("Not enough cash.");
	move(p, "storage", -cost);
	p.storage++;
	return { ok: true };
}
export function insuranceCost(p) {
	return [1500, 4000, 9000][p.storage];
}
export function buyInsurance(game) {
	const p = currentPlayer(game);
	const cost = insuranceCost(p);
	if (cost > p.cash) return fail("Not enough cash.");
	move(p, "insurance", -cost);
	p.insuredUntil = Math.max(p.insuredUntil, game.day - 1) + 7;
	p.stats.insurancePaid += cost;
	return { ok: true };
}
export function insured(game, p) {
	return p.insuredUntil >= game.day;
}

// Businesses
export function buyBusiness(game, id) {
	const p = currentPlayer(game);
	const b = BUSINESS[id];
	if (!p.tier2) return fail("Locked.");
	const cost = b.price * 100;
	if (cost > p.cash) return fail("Not enough cash.");
	move(p, "business", -cost);
	p.businesses.push({ type: id, uid: `${id}-${(p.bizSeq = (p.bizSeq || 0) + 1)}`, bought: game.day, paid: cost, upgraded: false, earned: 0, days: 0, repairs: 0 });
	p.ownedBusiness = true;
	checkUnlocks(game, p);
	return { ok: true };
}
export function upgradeBusiness(game, uid) {
	const p = currentPlayer(game);
	const biz = p.businesses.find((x) => x.uid === uid);
	if (!biz || biz.upgraded) return fail("Can't upgrade that.");
	const cost = BUSINESS[biz.type].upgrade.price * 100;
	if (cost > p.cash) return fail("Not enough cash.");
	move(p, "business", -cost);
	biz.paid += cost;
	biz.upgraded = true;
	return { ok: true };
}
export function businessValue(biz) {
	return Math.floor((biz.paid * BUSINESS_RESALE) / 100) * 100;
}
export function sellBusiness(game, uid) {
	const p = currentPlayer(game);
	const i = p.businesses.findIndex((x) => x.uid === uid);
	if (i < 0) return fail("Not yours.");
	const biz = p.businesses[i];
	move(p, "business", businessValue(biz));
	p.businesses.splice(i, 1);
	p.stats.soldBusinesses = (p.stats.soldBusinesses || []).concat([{ ...biz, sold: businessValue(biz) }]);
	return { ok: true };
}
// Expected daily numbers, for the card.
export function businessOutlook(type, upgraded) {
	const b = BUSINESS[type];
	const rev = b.rev + (upgraded ? b.upgrade.rev : 0);
	const exp = b.exp + (upgraded ? b.upgrade.exp : 0);
	const repairs = b.repairP * b.repair;
	const profit = (rev - exp - repairs) * (b.rainy ? 0.85 : 1);
	const cost = b.price + (upgraded ? b.upgrade.price : 0);
	return { rev, exp, profit: Math.round(profit), payback: Math.ceil(cost / profit), roi: (profit * 30) / cost }; // roi per 30 days
}

// Investing
export function companyBySymbol(game, sym) {
	return game.companies.find((c) => c.id === sym);
}
export function buyStock(game, sym, shares) {
	const p = currentPlayer(game);
	if (!p.tier3) return fail("Locked.");
	shares = Math.floor(shares);
	const c = companyBySymbol(game, sym);
	if (!c || shares <= 0) return fail("Pick how many.");
	const cost = c.price * shares;
	if (cost > p.cash) return fail("Not enough cash.");
	move(p, "stocks", -cost);
	p.stocks[sym] = (p.stocks[sym] || 0) + shares;
	p.stockCost[sym] = (p.stockCost[sym] || 0) + cost;
	return { ok: true };
}
export function sellStock(game, sym, shares) {
	const p = currentPlayer(game);
	shares = Math.floor(shares);
	const have = p.stocks[sym] || 0;
	const c = companyBySymbol(game, sym);
	if (!c || shares <= 0 || shares > have) return fail("You don't have that many.");
	const proceeds = c.price * shares;
	const basis = Math.round((p.stockCost[sym] * shares) / have);
	move(p, "stocks", proceeds);
	p.stocks[sym] = have - shares;
	p.stockCost[sym] -= basis;
	if (!p.stocks[sym]) {
		delete p.stocks[sym];
		delete p.stockCost[sym];
	}
	return { ok: true };
}
export function indexPrice(game) {
	return Math.max(1, Math.round(game.index.nav * 100));
}
export function buyIndex(game, cents) {
	const p = currentPlayer(game);
	if (!p.tier3) return fail("Locked.");
	cents = Math.min(Math.floor(cents / 100) * 100, Math.floor(p.cash / 100) * 100);
	if (cents <= 0) return fail("Pick an amount.");
	move(p, "index", -cents);
	p.indexUnits += cents / indexPrice(game);
	p.indexCost += cents;
	return { ok: true };
}
export function indexValue(game, p) {
	return Math.floor((p.indexUnits * indexPrice(game)) / 100) * 100;
}
export function sellIndex(game, cents) {
	const p = currentPlayer(game);
	const val = indexValue(game, p);
	cents = Math.min(Math.floor(cents / 100) * 100, val);
	if (cents <= 0) return fail("Nothing to sell.");
	const frac = cents / val;
	move(p, "index", cents);
	p.indexCost = Math.round(p.indexCost * (1 - frac));
	p.indexUnits = cents === val ? 0 : p.indexUnits * (1 - frac);
	return { ok: true };
}
export function buyCD(game, cents) {
	const p = currentPlayer(game);
	if (!p.tier3) return fail("Locked.");
	cents = Math.min(Math.floor(cents / 100) * 100, p.cash);
	if (cents < 10000) return fail("CDs start at $100.");
	move(p, "cd", -cents);
	p.cds.push({ amount: cents, day: game.day });
	return { ok: true };
}
export function cdValue(game, cd) {
	const held = game.day - cd.day;
	return held >= CD_TERM ? Math.floor(cd.amount * (1 + (CD_RATE * CD_TERM) / 365)) : cd.amount;
}
export function cashCD(game, i) {
	const p = currentPlayer(game);
	const cd = p.cds[i];
	if (!cd) return fail("No CD there.");
	const v = cdValue(game, cd);
	p.stats.cdEarned += v - cd.amount;
	move(p, "cd", v);
	p.cds.splice(i, 1);
	return { ok: true, early: v === cd.amount && game.day - cd.day < CD_TERM };
}

// ---------- Net worth ----------
// What the stuff would fetch if you sold it all here right now, slippage
// included. So buying never bumps your own net worth by moving the price.
export function inventoryValue(game, p, at = p.at) {
	let v = 0;
	for (const g in p.inv) v += quoteSell(game, at, g, p.inv[g], p);
	return v;
}
export function stockValue(game, p) {
	let v = 0;
	for (const s in p.stocks) {
		const c = companyBySymbol(game, s);
		if (c) v += c.price * p.stocks[s];
	}
	return v;
}
export function netWorth(game, p) {
	let nw = p.cash + p.bank - p.debt + inventoryValue(game, p);
	for (const b of p.businesses) nw += businessValue(b);
	nw += stockValue(game, p) + indexValue(game, p);
	for (const cd of p.cds) nw += cd.amount;
	return nw;
}
function checkUnlocks(game, p) {
	const nw = netWorth(game, p);
	if (!p.tier2 && nw >= ECON.tier2NetWorth) {
		p.tier2 = true;
		note(p, `Your net worth passed ${fmt(ECON.tier2NetWorth)}. Business owners are calling: you can buy a business now.`, "unlock");
	}
	if (p.tier2 && !p.tier3 && (p.ownedBusiness || nw >= ECON.tier3NetWorth)) {
		p.tier3 = true;
		note(p, "A broker hands you a card. The stock market is open to you.", "unlock");
	}
}

// ---------- Turn flow ----------
// End the current player's turn, optionally traveling. Returns the next state tag.
export function endTurn(game, travelTo = null) {
	const p = currentPlayer(game);
	if (game.over) return fail("Game over.");
	if (travelTo && travelTo !== p.at) {
		if (!MARKET[travelTo]) return fail("Unknown place.");
		const f = fare(p.at, travelTo);
		if (f > p.cash) return fail(`Bus fare is ${fmt(f)}. Not enough cash.`);
		move(p, "fares", -f);
		p.stats.fares += f;
		p.travelTo = travelTo;
	} else p.travelTo = null;
	checkUnlocks(game, p);
	game.turn++;
	if (game.turn >= game.order.length) advanceDay(game);
	return { ok: true };
}

function advanceDay(game) {
	const day = game.day;
	// Travelers arrive, with whatever happens on the way.
	for (const p of game.players) {
		if (p.travelTo) {
			p.at = p.travelTo;
			p.travelTo = null;
			travelHazard(game, p, day);
		}
	}
	if (day >= game.days) {
		game.over = true;
		for (const p of game.players) recordPlayer(game, p);
		return;
	}
	game.day = day + 1;
	stepMarkets(game);
	stepStocks(game);
	for (const p of game.players) dailyMoney(game, p);
	for (const p of game.players) checkUnlocks(game, p);
	game.turn = 0;
	game.order = turnOrder(game);
	recordHistory(game);
}

function stepMarkets(game) {
	const day = game.day;
	const r = stream(game.seed, "market", day);
	for (const m of MARKETS) {
		for (const g of GOODS) {
			const s = game.markets[m.id][g.id];
			s.prev = price(game, m.id, g.id);
			s.x = s.x * (1 - THETA) + g.vol * r.normal();
			s.impact *= IMPACT_DECAY;
			s.shock *= SHOCK_DECAY;
		}
	}
	// Rumors maturing today.
	const still = [];
	for (const ev of game.pending) {
		if (ev.day === day) {
			game.rumors[ev.real ? "real" : "fake"]++;
			if (ev.real) {
				applyShock(game, ev.m, ev.g, ev.size);
				post(game, ev.hit, ev.size > 0 ? "up" : "down");
			} else post(game, ev.miss, "info");
		} else still.push(ev);
	}
	game.pending = still;
	// New event, at most one or two a day.
	const roll = r.next();
	const m = r.pick(MARKETS), g = r.pick(GOODS);
	const city = cityName(m.id);
	if (roll < 0.22) {
		// Rumor: lands in 2-4 days, 65% real.
		const up = r.chance(0.6);
		const real = r.chance(0.65);
		const lag = r.int(2, 4);
		const size = up ? r.range(0.45, 0.9) : -r.range(0.4, 0.7);
		const text = up ? pickText(r, RUMOR_UP, g, city) : pickText(r, RUMOR_DOWN, g, city);
		post(game, text, "rumor");
		game.rumors.heard++;
		game.pending.push({
			day: day + lag, m: m.id, g: g.id, size, real,
			hit: up ? `It's true: ${g.name.toLowerCase()} are flying off the shelves in ${city}.` : `It happened: ${g.name.toLowerCase()} are dirt cheap in ${city} now.`,
			miss: `That ${g.name.toLowerCase()} rumor about ${city}? Nothing happened. Just talk.`,
			rumor: text,
		});
	} else if (roll < 0.32) {
		const size = r.range(0.5, 1.0);
		applyShock(game, m.id, g.id, size);
		post(game, pickText(r, SHORTAGE, g, city), "up");
	} else if (roll < 0.42) {
		const size = -r.range(0.45, 0.75);
		applyShock(game, m.id, g.id, size);
		post(game, pickText(r, GLUT, g, city), "down");
	} else if (roll < 0.47) {
		const size = r.chance(0.5) ? r.range(0.25, 0.45) : -r.range(0.25, 0.4);
		for (const mk of MARKETS) applyShock(game, mk.id, g.id, size);
		post(game, size > 0 ? `${g.name} are the hot thing everywhere this week.` : `Nobody wants ${g.name.toLowerCase()} right now, anywhere.`, size > 0 ? "up" : "down");
	}
	if (r.chance(0.12)) game.rain = day;
	if (game.rain === day) post(game, "Rain all day across town. Keep your boxes dry.", "info");
	// Keep news short.
	if (game.news.length > 60) game.news.splice(0, game.news.length - 60);
}
function cityName(id) {
	return MARKET[id].name;
}
function applyShock(game, m, g, size) {
	game.markets[m][g].shock += size;
}
function post(game, text, kind) {
	game.news.push({ day: game.day, text, kind });
}
function pickText(r, list, g, city) {
	return r.pick(list).replaceAll("{g}", g.name.toLowerCase()).replaceAll("{G}", g.name).replaceAll("{m}", city);
}
const RUMOR_UP = [
	"Rumor: a big {g} drop is coming to {m} in a few days.",
	"Overheard at the bus stop: collectors in {m} are about to go nuts for {g}.",
	"A kid with a megaphone swears {g} are about to get scarce in {m}.",
];
const RUMOR_DOWN = [
	"Rumor: a truckload of {g} is headed to {m}.",
	"Word is a warehouse in {m} is about to dump its {g}.",
	"Someone online says {g} in {m} are about to crash.",
];
const SHORTAGE = [
	"Shortage! Stores in {m} are sold out of {g}. Buyers are paying way up.",
	"A famous streamer showed off {g} from {m}. Prices jumped.",
	"{G} in {m} are suddenly hard to find.",
];
const GLUT = [
	"A closing-down sale in {m} flooded the street with cheap {g}.",
	"Too many {g} in {m}. Sellers are desperate.",
	"Someone's grandpa sold a garage full of {g} in {m}. Prices tanked.",
];

function travelHazard(game, p, day) {
	const r = stream(game.seed, "hazard", day, p.id);
	const roll = r.next();
	const frac = r.range(0.25, 0.6);
	const cash = r.range(0.05, 0.15);
	const goodHeld = Object.keys(p.inv);
	const held = goodHeld.length ? goodHeld[Math.floor(r.next() * goodHeld.length)] : null;
	if (roll < 0.06 && held) {
		lose(game, p, held, frac, `A box of your ${GOOD[held].name.toLowerCase()} got lost on the bus.`);
	} else if (roll < 0.1 && game.rain === day) {
		const wet = goodHeld.filter((x) => GOOD[x].cardboard);
		if (wet.length) lose(game, p, wet[Math.floor(r.next() * wet.length)], frac, "The rain soaked through your cardboard boxes.");
	} else if (roll < 0.13 && p.cash > 20000) {
		const amt = Math.floor((p.cash * cash) / 100) * 100;
		if (insured(game, p)) {
			p.stats.insurancePaidOut += amt;
			note(p, `A scam buyer tried a fake payment app on you, but your insurance caught it. You kept your ${fmt(amt)}.`, "good");
		} else {
			move(p, "hazard", -amt);
			p.stats.hazardLoss += amt;
			note(p, `A buyer paid with a fake payment app. You're out ${fmt(amt)}.`, "bad");
		}
	} else if (roll < 0.17 && !p.simple || roll < 0.2 && p.simple) {
		const goods = goodsFor(p);
		const gift = goods[Math.floor(r.next() * goods.length)];
		const room = Math.floor((capacity(p) - used(p)) / gift.size);
		const n = Math.min(room, 1 + Math.floor(r.next() * 4));
		if (n > 0) {
			p.inv[gift.id] = (p.inv[gift.id] || 0) + n;
			p.cost[gift.id] = p.cost[gift.id] || 0;
			note(p, `A neighbor was clearing out the attic and gave you ${n} ${gift.name.toLowerCase()} for free.`, "good");
		}
	}
}
function lose(game, p, g, frac, why) {
	const have = p.inv[g];
	const n = Math.max(1, Math.floor(have * frac));
	const value = n * price(game, p.at, g);
	takeGoods(p, g, n);
	if (insured(game, p)) {
		move(p, "insurance", value);
		p.stats.insurancePaidOut += value;
		note(p, `${why} You lost ${n}. Insurance paid you ${fmt(value)}.`, "bad");
	} else {
		p.stats.hazardLoss += value;
		note(p, `${why} You lost ${n} (worth about ${fmt(value)}).`, "bad");
	}
}

function dailyMoney(game, p) {
	const day = game.day;
	// Fast Eddie compounds daily.
	if (p.debt > 0) {
		const i = Math.ceil(p.debt * LOAN_RATE);
		p.debt += i;
		p.stats.interestPaid += i;
		if (day > p.dueDay) {
			p.debt += LATE_FEE;
			p.stats.lateFees += LATE_FEE;
			const r = stream(game.seed, "lou", day, p.id);
			if (r.chance(0.35)) louVisit(game, p);
			else note(p, `You're late. Eddie added a ${fmt(LATE_FEE)} late fee. He says Big Lou is "in the neighborhood."`, "bad");
		} else if (day === p.dueDay) {
			note(p, `Today's the day Fast Eddie wants his ${fmt(p.debt)}. After today it gets worse.`, "bad");
		} else if (p.dueDay - day === 3) {
			note(p, `Eddie texted: "3 days, pal." You owe ${fmt(p.debt)}.`, "info");
		}
	}
	// Bank pays a little.
	if (p.bank > 0) {
		const i = Math.floor((p.bank * BANK_RATE) / 365);
		p.bank += i;
		p.stats.bankEarned += i;
	}
	// Businesses.
	const rain = game.rain === day;
	let bizNet = 0;
	for (const biz of p.businesses) {
		const b = BUSINESS[biz.type];
		const r = stream(game.seed, "biz", day, p.id, biz.uid);
		const o = biz.upgraded ? b.upgrade : { rev: 0, exp: 0 };
		let rev = (b.rev + o.rev) + r.normal() * b.sd;
		if (rain && b.rainy) rev *= 0.2;
		rev = Math.max(0, rev);
		let net = Math.round(rev - (b.exp + o.exp)) * 100;
		if (r.chance(b.repairP)) {
			net -= b.repair * 100;
			biz.repairs += b.repair * 100;
			note(p, `${b.icon} ${b.repairWhat}. Repair: ${fmt(b.repair * 100)}.`, "bad");
		}
		biz.earned += net;
		biz.days++;
		bizNet += net;
	}
	if (bizNet !== 0) move(p, "business", bizNet);
	if (p.cash < 0 && p.businesses.length) {
		// Businesses can lose money; cover it from the bank, then Eddie.
		const fromBank = Math.min(p.bank, -p.cash);
		if (fromBank > 0) {
			p.bank -= fromBank;
			move(p, "bank", fromBank);
		}
		if (p.cash < 0) {
			const short = -p.cash;
			p.debt += short;
			move(p, "loan", short);
			note(p, `Your businesses ran short. Fast Eddie covered ${fmt(short)}, at his usual rate.`, "bad");
		}
	}
	// Dividends every 10 days.
	if (day % 10 === 1 && day > 1) {
		let d = 0;
		for (const s in p.stocks) {
			const c = companyBySymbol(game, s);
			if (c && c.div) d += Math.floor((c.price * p.stocks[s] * c.div * 10) / 365);
		}
		// The index fund's dividends are already inside its price (total return).
		if (d > 0) {
			move(p, "dividends", d);
			p.stats.dividends += d;
			note(p, `Dividend day: your shares paid you ${fmt(d)}.`, "good");
		}
	}
}
function louVisit(game, p) {
	p.stats.louVisits++;
	let taken = 0;
	const items = [];
	for (const g of Object.keys(p.inv)) {
		const n = Math.ceil(p.inv[g] / 3);
		const v = Math.floor((n * price(game, p.at, g)) / 2);
		takeGoods(p, g, n);
		taken += v;
		items.push(`${n} ${GOOD[g].name.toLowerCase()}`);
	}
	const fromCash = Math.min(Math.floor(p.cash / 4 / 100) * 100, Math.max(0, p.debt - taken));
	if (fromCash > 0) move(p, "lou", -fromCash);
	taken += fromCash;
	taken = Math.min(taken, p.debt);
	p.debt -= taken;
	p.stats.louTaken += taken;
	note(p, `Big Lou showed up with a clipboard and a tow truck. He took ${items.length ? items.join(", ") + (fromCash ? " and " : "") : ""}${fromCash ? fmt(fromCash) + " cash" : ""}. At Eddie's "fire sale" prices that's only ${fmt(taken)} off your debt.`, "bad");
}

// ---------- Stocks ----------
function stepStocks(game) {
	const r = stream(game.seed, "stocks", game.day);
	const dt = 1 / TRADING_DAYS;
	const news = r.next() < 0.18 ? { sector: r.pick(Object.keys(SECTORS)), size: (r.chance(0.5) ? 1 : -1) * r.range(0.04, 0.12) } : null;
	const earnings = r.next() < 0.1 ? { i: Math.floor(r.next() * game.companies.length), size: (r.chance(0.55) ? 1 : -1) * r.range(0.06, 0.18) } : null;
	const rets = stepCompanies(game.companies, r, dt, news, earnings);
	if (news) post(game, news.size > 0 ? `${SECTORS[news.sector]} stocks rallied on strong sales.` : `${SECTORS[news.sector]} stocks slumped after a gloomy report.`, news.size > 0 ? "up" : "down");
	if (earnings) {
		const c = game.companies[earnings.i];
		post(game, earnings.size > 0 ? `${c.name} beat its sales forecast. ${c.id} jumped.` : `${c.name} missed its forecast. ${c.id} dropped.`, earnings.size > 0 ? "up" : "down");
	}
	game.index.nav *= 1 + rets.index;
	game.index.hist.push(game.index.nav);
	for (const c of game.companies) {
		c.hist.push(c.price);
		if (c.hist.length > 31) c.hist.shift();
	}
	// Bust and replace.
	for (let i = 0; i < game.companies.length; i++) {
		const c = game.companies[i];
		if (c.price < 100) {
			post(game, `${c.name} went bust. ${c.id} shares are now worth nothing.`, "down");
			for (const p of game.players) {
				if (p.stocks[c.id]) {
					note(p, `${c.name} went bust. Your ${p.stocks[c.id]} shares are gone.`, "bad");
					delete p.stocks[c.id];
					delete p.stockCost[c.id];
				}
			}
			const nc = replacementCompany(game.seed, game.nextCompany++, game.day);
			game.companies[i] = nc;
			post(game, `${nc.name} (${nc.id}) is new on the market.`, "info");
		}
	}
}
// Shared by the game and fast-forward. Mutates prices; returns the index
// return. The index holds an equal slice of every company, rebalanced each
// step, so no single company can take it over.
export function stepCompanies(companies, r, dt, news = null, earnings = null) {
	const zm = r.normal();
	const zs = {};
	for (const s in SECTORS) zs[s] = r.normal();
	let idx = 0;
	companies.forEach((c, i) => {
		const sig2 = c.sigma * c.sigma + SECTOR_VOL * SECTOR_VOL + c.beta * c.beta * MARKET_VOL * MARKET_VOL;
		let lr = (c.mu - c.div - sig2 / 2) * dt + Math.sqrt(dt) * (c.beta * MARKET_VOL * zm + SECTOR_VOL * zs[c.sector] + c.sigma * r.normal());
		if (news && news.sector === c.sector) lr += Math.log(1 + news.size);
		if (earnings && earnings.i === i) lr += Math.log(1 + earnings.size);
		const ret = Math.exp(lr) - 1;
		idx += (ret + c.div * dt) / companies.length;
		c.price = Math.max(1, Math.round(c.price * (1 + ret)));
	});
	return { index: idx };
}

// ---------- History ----------
function recordHistory(game) {
	for (const m of MARKETS) for (const g of GOODS) {
		const s = game.markets[m.id][g.id];
		s.hist.push(price(game, m.id, g.id));
		if (s.hist.length > 30) s.hist.shift();
	}
	for (const p of game.players) recordPlayer(game, p);
}
function recordPlayer(game, p) {
	const nw = netWorth(game, p);
	const h = p.history;
	if (h.length && h[h.length - 1].day === game.day) h[h.length - 1].nw = nw;
	else h.push({ day: game.day, nw });
}

// ---------- Debrief ----------
export function standings(game) {
	return game.players.map((p) => ({ p, nw: netWorth(game, p) })).sort((a, b) => b.nw - a.nw);
}
export function debrief(game, p) {
	const s = p.stats;
	const lines = [];
	const nw = netWorth(game, p);
	const growth = nw - p.ownMoney;
	lines.push({ kind: growth >= 0 ? "good" : "bad", text: `You started with ${fmt(p.ownMoney)} of your own${p.startCash > p.ownMoney ? ` and ${fmt(p.startCash - p.ownMoney)} borrowed from Fast Eddie` : ""}. You finished worth ${fmt(nw)}.` });
	if (s.interestPaid > 0) lines.push({ kind: "bad", text: `You paid ${fmt(s.interestPaid)} in interest to Fast Eddie${s.lateFees ? `, plus ${fmt(s.lateFees)} in late fees` : ""}.` });
	if (p.debt > 0) lines.push({ kind: "bad", text: `You still owe Eddie ${fmt(p.debt)}. It came off your final score.` });
	if (s.louVisits) lines.push({ kind: "bad", text: `Big Lou visited ${s.louVisits} time${s.louVisits > 1 ? "s" : ""}. His "fire sale" took stuff worth a lot more than the ${fmt(s.louTaken)} he knocked off.` });
	const flips = s.flips.filter((f) => f.basis > 0);
	if (flips.length) {
		const best = flips.reduce((a, b) => (b.profit > a.profit ? b : a));
		const worst = flips.reduce((a, b) => (b.profit < a.profit ? b : a));
		const total = flips.reduce((a, f) => a + f.profit, 0);
		lines.push({ kind: "good", text: `Best flip: ${best.q} ${GOOD[best.g].name.toLowerCase()} sold in ${cityName(best.at)} on day ${best.day} for ${fmt(best.profit)} more than you paid.` });
		if (worst.profit < 0) lines.push({ kind: "bad", text: `Worst flip: ${worst.q} ${GOOD[worst.g].name.toLowerCase()} in ${cityName(worst.at)}, a ${fmt(-worst.profit)} loss.` });
		lines.push({ kind: total >= 0 ? "good" : "bad", text: `All your flips together: ${total >= 0 ? "+" : ""}${fmt(total)} across ${flips.length} sales.` });
	}
	if (s.bigMove && Math.abs(s.bigMove.pct) >= 0.08) {
		lines.push({ kind: "info", text: `Your ${s.bigMove.how} moved ${GOOD[s.bigMove.g].name.toLowerCase()} in ${cityName(s.bigMove.at)} ${s.bigMove.pct > 0 ? "up" : "down"} ${Math.round(Math.abs(s.bigMove.pct) * 100)}% in one go on day ${s.bigMove.day}.` });
	}
	if (s.insurancePaid) lines.push({ kind: s.insurancePaidOut >= s.insurancePaid ? "good" : "info", text: `Insurance cost you ${fmt(s.insurancePaid)} and paid you back ${fmt(s.insurancePaidOut)}.` });
	if (s.hazardLoss) lines.push({ kind: "bad", text: `Lost boxes, rain and scammers cost you ${fmt(s.hazardLoss)}.` });
	if (s.fares) lines.push({ kind: "info", text: `Bus fares: ${fmt(s.fares)}.` });
	if (s.bankEarned) lines.push({ kind: "good", text: `The bank paid you ${fmt(s.bankEarned)} for keeping money there.` });
	const bizAll = [...p.businesses, ...(s.soldBusinesses || [])];
	for (const b of bizAll) {
		const B = BUSINESS[b.type];
		const pct = Math.round((b.earned / b.paid) * 100);
		lines.push({ kind: b.earned >= 0 ? "good" : "bad", text: `${B.icon} Your ${B.name.toLowerCase()} earned ${fmt(b.earned)} in ${b.days} days: ${pct}% of the ${fmt(b.paid)} you put in.${b.repairs ? ` Repairs ate ${fmt(b.repairs)}.` : ""}` });
	}
	if (s.dividends) lines.push({ kind: "good", text: `Dividends paid you ${fmt(s.dividends)} for just holding shares.` });
	const rm = game.rumors;
	if (rm.real + rm.fake > 0) lines.push({ kind: "info", text: `Rumors around town: ${rm.real + rm.fake} played out, and ${rm.real} ${rm.real === 1 ? "was" : "were"} true.` });
	// What-if: own money into the index on day 1, or the bank.
	const ixGrowth = game.index.hist[game.index.hist.length - 1] / game.index.hist[0];
	const ix = Math.round(p.ownMoney * ixGrowth);
	const bank = Math.round(p.ownMoney * Math.pow(1 + BANK_RATE / 365, game.days - 1));
	lines.push({ kind: "info", text: `If you'd put your first ${fmt(p.ownMoney)} in the index fund on day 1 and done nothing, you'd have ${fmt(ix)}. In the bank: ${fmt(bank)}.` });
	return { nw, lines };
}

// ---------- Fast-forward ----------
// Simulates the player's investments forward `years` with monthly steps.
// Returns yearly series for: their picks, all-in index, bank, cash jar.
export function fastForward(game, p, years) {
	const r = stream(game.seed, "ff", p.id, years);
	const companies = game.companies.map((c) => ({ ...c, hist: undefined }));
	const holdings = {};
	for (const s in p.stocks) holdings[s] = p.stocks[s];
	let indexUnits = p.indexUnits;
	let nav = game.index.nav;
	let cd = p.cds.reduce((a, c) => a + c.amount, 0);
	// Everything that isn't invested (cash, bank, stuff, businesses, minus debt)
	// is sold off and parked in the bank.
	let bank = Math.max(0, netWorth(game, p) - stockValue(game, p) - indexValue(game, p) - cd);
	const startTotal = stockValue(game, p) + indexValue(game, p) + cd + bank;
	let allIndex = startTotal;
	let allBank = startTotal;
	const jar = startTotal;
	const yours = [], idx = [], bnk = [], jars = [];
	const busts = [];
	const pushYear = () => {
		let v = bank + cd + indexUnits * nav * 100;
		for (const c of companies) v += (holdings[c.id] || 0) * c.price;
		yours.push(Math.round(v));
		idx.push(Math.round(allIndex));
		bnk.push(Math.round(allBank));
		jars.push(jar);
	};
	pushYear();
	const dt = 1 / 12;
	let next = game.nextCompany;
	for (let m = 1; m <= years * 12; m++) {
		const ret = stepCompanies(companies, r, dt);
		nav *= 1 + ret.index;
		allIndex *= 1 + ret.index;
		bank *= 1 + BANK_RATE * dt;
		allBank *= 1 + BANK_RATE * dt;
		cd *= 1 + CD_RATE * dt;
		// Dividends from single stocks are reinvested into the same stock.
		for (const c of companies) if (holdings[c.id] && c.div) holdings[c.id] *= 1 + c.div * dt;
		for (let i = 0; i < companies.length; i++) {
			const c = companies[i];
			if (c.price < 100) {
				if (holdings[c.id]) busts.push({ name: c.name, year: Math.ceil(m / 12) });
				delete holdings[c.id];
				// Fast-forward ids get a "+" so they never match a held in-game symbol.
				const nc = replacementCompany(game.seed, next++, 1000 + m);
				companies[i] = { ...nc, id: nc.id + "+" + m, hist: undefined };
			}
		}
		if (m % 12 === 0) pushYear();
	}
	return { yours, index: idx, bank: bnk, jar: jars, busts, start: startTotal };
}

// ---------- Save ----------
export function serialize(game) {
	return JSON.stringify(game);
}
export function deserialize(json) {
	const g = JSON.parse(json);
	if (!g || g.v !== 1 || !Array.isArray(g.players)) throw new Error("bad save");
	return g;
}
