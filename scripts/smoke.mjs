// Browser smoke test: plays full games through the real UI by clicking buttons
// (3-player hot-seat at 1920×1080, solo at 1366×768), opens every tab, buys a
// business and stocks, fast-forwards, and replays the seed. Fails on any page
// or console error, or a horizontal scrollbar.
//
//   node scripts/smoke.mjs [screenshotDir]   (SMOKE_URL=<live url> to test a deploy)
// Needs Playwright (borrowed from ~/Code/readerful) and /usr/bin/chromium.
import { createRequire } from "node:module";
import { serve } from "./serve.mjs";

const require = createRequire(process.env.PLAYWRIGHT_FROM || "/home/matt/Code/readerful/");
const { chromium } = require("playwright");
const shots = process.argv[2];
// SMOKE_URL=https://flipside.mattgwagner.workers.dev/ checks the live deploy instead.
const server = process.env.SMOKE_URL ? null : await serve(0);
const url = process.env.SMOKE_URL || `http://localhost:${server.address().port}/`;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || "/usr/bin/chromium" });
const errors = [];
let failed = false;
const fail = (m) => {
	console.error("FAIL:", m);
	failed = true;
};

async function newPage(width, height) {
	const page = await browser.newPage({ viewport: { width, height } });
	page.on("pageerror", (e) => errors.push(`${width}: ${e.message}`));
	page.on("console", (m) => m.type() === "error" && errors.push(`${width}: ${m.text()}`));
	return page;
}
const snap = async (page, name) => shots && page.screenshot({ path: `${shots}/${name}.png` });
async function noSideScroll(page, where) {
	const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
	if (over > 1) fail(`${where}: page scrolls sideways by ${over}px`);
}
async function addPlayer(page, name, simple) {
	if (await page.isVisible('[data-act="add"]')) await page.click('[data-act="add"]');
	await page.fill('input[name="name"]', name);
	if (simple) await page.check('input[name="simple"]');
	await page.click('[data-act="addsave"]');
}
async function dismiss(page) {
	if (await page.isVisible("#modal .dialog")) await page.click('#modal .dialog [data-m="close"]');
}
// One turn: maybe sell, maybe buy, then travel or stay. All by clicking.
async function takeTurn(page, i) {
	if (await page.isVisible('[data-act="ready"]')) await page.click('[data-act="ready"]');
	await dismiss(page);
	const sells = await page.$$('[data-act="sell"]:not([disabled])');
	if (sells.length && i % 2 === 0) {
		await sells[i % sells.length].click();
		await page.click('#modal [data-m="ok"]');
	}
	const buys = await page.$$('[data-act="buy"]:not([disabled])');
	if (buys.length) {
		await buys[(i * 7) % buys.length].click();
		await page.click('#modal [data-m="d"][data-v="5"]');
		await page.click('#modal [data-m="ok"]');
	}
	await dismiss(page);
	if (i % 3 !== 2) {
		const pins = await page.$$('.pin:not(.here)');
		await pins[i % pins.length].click();
		const ok = await page.$('#modal [data-m="ok"]:not([disabled])');
		if (ok) await ok.click();
		else {
			await page.click('#modal .dialog [data-m="close"]');
			await page.click('.map-panel [data-act="stay"]');
			await page.click('#modal [data-m="ok"]');
		}
	} else {
		await page.click('.map-panel [data-act="stay"]');
		await page.click('#modal [data-m="ok"]');
	}
}
async function playOut(page, label) {
	for (let i = 0; i < 400; i++) {
		if (await page.isVisible(".end")) return true;
		if (i === 4) {
			if (await page.isVisible('[data-act="ready"]')) await page.click('[data-act="ready"]');
			await dismiss(page);
			await snap(page, `${label}-day`);
		}
		await takeTurn(page, i);
	}
	fail(`${label}: game never reached the end screen`);
	return false;
}
const state = (page) => page.evaluate(() => {
	const g = window.__fs.game;
	return { day: g.day, over: g.over, seed: g.seed, news: g.news.slice(0, 6).map((n) => n.text), players: g.players.map((p) => ({ name: p.name, cash: p.cash, tier2: p.tier2, tier3: p.tier3, biz: p.businesses.length, stocks: Object.keys(p.stocks).length, idx: p.indexUnits, cds: p.cds.length })) };
});

// ---- 1. Hot-seat, 3 players, 1920×1080 ----
{
	const page = await newPage(1920, 1080);
	await page.goto(url);
	await snap(page, "title");
	await page.click('[data-act="new"]');
	await addPlayer(page, "Ace", false);
	await addPlayer(page, "Bo", false);
	await addPlayer(page, "Cy", true);
	await page.fill('input[name="seed"]', "SMOKE-1");
	await snap(page, "setup");
	await page.click('[data-act="start"]');
	if (!(await page.isVisible('[data-act="ready"]'))) fail("hot-seat: no pass-the-keyboard screen");
	await snap(page, "handoff");
	const first = await state(page);
	if (first.players.length !== 3) fail(`hot-seat: ${first.players.length} players`);
	// Play 8 days, then make the current player rich to walk Tier 2 and 3 by clicks.
	for (let i = 0; i < 24; i++) await takeTurn(page, i);
	if (await page.isVisible('[data-act="ready"]')) await page.click('[data-act="ready"]');
	await dismiss(page);
	await page.evaluate(() => {
		const { E, ui, render } = window.__fs;
		const p = E.currentPlayer(ui.game);
		p.startCash += 3000000;
		p.cash += 3000000;
		render();
	});
	await page.click('[data-act="tab"][data-tab="money"]');
	await snap(page, "money");
	await page.click('[data-act="deposit"]');
	await page.click('#modal [data-m="min"]');
	await page.click('#modal [data-m="d"][data-v="100000"]');
	await page.click('#modal [data-m="ok"]');
	await page.click('[data-act="tab"][data-tab="biz"]');
	if (!(await page.isVisible(".locked"))) fail("tier 2 should still be locked before the day ends");
	// End the day so unlocks are checked, then come back to this player.
	const me = (await state(page)).players.findIndex((p) => p.cash > 2000000);
	for (let i = 0; i < 3; i++) await takeTurn(page, 100 + i);
	for (let k = 0; k < 3; k++) {
		if (await page.isVisible('[data-act="ready"]')) await page.click('[data-act="ready"]');
		await dismiss(page);
		const cur = await page.evaluate(() => window.__fs.E.currentPlayer(window.__fs.game).id);
		if (cur === me) break;
		await takeTurn(page, 200 + k);
	}
	let s = await state(page);
	if (!s.players[me].tier2) fail("tier 2 did not unlock");
	await page.click('[data-act="tab"][data-tab="biz"]');
	await snap(page, "biz-shop");
	await page.click('[data-act="bizbuy"][data-id="vending"]');
	await page.click('#modal [data-m="ok"]');
	await page.click('[data-act="bizup"]');
	await page.click('#modal [data-m="ok"]');
	await page.click('[data-act="bizbuy"][data-id="lawn"]');
	await page.click('#modal [data-m="ok"]');
	await snap(page, "biz-owned");
	s = await state(page);
	if (s.players[me].biz !== 2) fail(`expected 2 businesses, have ${s.players[me].biz}`);
	if (!s.players[me].tier3) fail("tier 3 did not unlock after buying a business");
	await page.click('[data-act="bizsell"]');
	await page.click('#modal [data-m="ok"]');
	await page.click('[data-act="tab"][data-tab="invest"]');
	await page.click('[data-act="stockbuy"]');
	await page.click('#modal [data-m="d"][data-v="10"]');
	await page.click('#modal [data-m="ok"]');
	await page.click('[data-act="indexbuy"]');
	await page.click('#modal [data-m="ok"]');
	await page.click('[data-act="cdbuy"]');
	await page.click('#modal [data-m="ok"]');
	await snap(page, "invest");
	s = await state(page);
	const P = s.players[me];
	if (!(P.stocks && P.idx > 0 && P.cds === 1 && P.biz === 1)) fail(`invest actions didn't land: ${JSON.stringify(P)}`);
	await page.click('[data-act="tab"][data-tab="market"]');
	await noSideScroll(page, "game 1920");
	await playOut(page, "hotseat");
	await snap(page, "end");
	if (!(await page.textContent(".end-head h1")).includes("wins")) fail("hot-seat end screen has no winner");
	// The player we made rich has investments to fast-forward.
	await page.click(`[data-act="endtab"][data-i="${me}"]`);
	await page.click('[data-act="ff"][data-y="30"]');
	if (!(await page.isVisible(".ff-legend"))) fail("fast-forward chart missing");
	await page.click(`[data-act="endtab"][data-i="${(me + 1) % 3}"]`);
	await page.click('[data-act="ff"][data-y="10"]');
	await snap(page, "end-ff");
	const lines = await page.$$eval(".lines li", (l) => l.map((x) => x.textContent));
	if (!lines.some((t) => t.includes("index fund on day 1"))) fail("debrief missing the index what-if line");
	if (lines.some((t) => /undefined|NaN/.test(t))) fail("debrief has undefined/NaN");
	// Seeded replay: same seed, same opening news.
	await page.click('[data-act="replay"]');
	if ((await page.inputValue('input[name="seed"]')) !== "SMOKE-1") fail("replay didn't carry the seed");
	const picked = await page.evaluate(() => window.__fs.ui.setup.picked.length);
	if (picked !== 3) fail(`replay picked ${picked} players, ${await page.evaluate(() => localStorage.getItem("flipside.profiles.v1"))}`);
	await page.click('[data-act="start"]');
	const again = await state(page);
	if (again.seed !== "SMOKE-1" || again.players.length !== 3) fail(`replay setup wrong: ${again.seed} ${again.players.length}`);
	if (JSON.stringify(again.news) !== JSON.stringify(first.news)) fail("replay news differs");
	// Save/continue survives a reload.
	await takeTurn(page, 0);
	await page.reload();
	if (!(await page.isVisible('[data-act="continue"]'))) fail("no Keep playing after reload");
	await page.click('[data-act="continue"]');
	if ((await state(page)).seed !== "SMOKE-1") fail("continue loaded the wrong game");
	await page.close();
}

// ---- 2. Solo, 1366×768, simple-mode profile off ----
{
	const page = await newPage(1366, 768);
	await page.goto(url + "?seed=solo-2");
	if ((await page.inputValue('input[name="seed"]')) !== "SOLO-2") fail("?seed= didn't prefill");
	// Fresh browser context, so no saved profiles yet.
	await addPlayer(page, "Solo", false);
	await page.click('[data-act="start"]');
	if (await page.isVisible('[data-act="ready"]')) fail("solo should skip the pass-the-keyboard screen");
	await dismiss(page);
	await noSideScroll(page, "game 1366");
	for (const t of ["money", "biz", "invest", "market"]) {
		await page.click(`[data-act="tab"][data-tab="${t}"]`);
		await noSideScroll(page, `tab ${t} 1366`);
	}
	await snap(page, "solo-1366");
	await playOut(page, "solo");
	await noSideScroll(page, "end 1366");
	await snap(page, "end-1366");
	await page.close();
}

// ---- 3. No localStorage at all ----
{
	const page = await newPage(1366, 768);
	await page.addInitScript(() => {
		Object.defineProperty(window, "localStorage", { get() { throw new Error("blocked"); } });
	});
	await page.goto(url);
	await page.click('[data-act="new"]');
	await addPlayer(page, "Dee", true);
	await page.click('[data-act="start"]');
	await dismiss(page);
	for (let i = 0; i < 3; i++) await takeTurn(page, i);
	if ((await state(page)).day < 3) fail("game didn't advance without storage");
	await page.close();
}

await browser.close();
server?.close();
const real = errors.filter((e) => !e.includes("blocked"));
if (real.length) fail(`console/page errors:\n  ${real.join("\n  ")}`);
console.log(failed ? "smoke: FAILED" : "smoke: passed (hot-seat ×3 full game, solo full game at 1366×768, tiers 2–3, fast-forward, replay, reload, no-storage)");
process.exit(failed ? 1 : 0);
