import * as E from "./engine.js";

const { fmt } = E;
const app = document.getElementById("app");
const modalEl = document.getElementById("modal");

const SAVE_KEY = "flipside.save.v1";
const PROFILE_KEY = "flipside.profiles.v1";
const EMOJIS = ["😎", "🦊", "🐯", "🦈", "🐸", "🤖", "🦖", "🐼", "🦉", "👽", "🐙", "🦁"];
const COLORS = ["#ff6b2c", "#1fb5a8", "#7a5cff", "#f2b705", "#e8467c", "#2f8cff"];

const ui = {
	screen: "title",
	tab: "market",
	game: null,
	setup: null,
	endTab: 0,
	ff: {},
	toast: null,
};

// ---------- Storage (never required) ----------
function load(key, fallback) {
	try {
		const v = localStorage.getItem(key);
		return v ? JSON.parse(v) : fallback;
	} catch {
		return fallback;
	}
}
function store(key, v) {
	try {
		if (v === null) localStorage.removeItem(key);
		else localStorage.setItem(key, JSON.stringify(v));
	} catch {
		/* saves are a convenience */
	}
}
function save() {
	if (!ui.game) return;
	try {
		localStorage.setItem(SAVE_KEY, E.serialize(ui.game));
	} catch {
		/* ignore */
	}
}
function loadSave() {
	try {
		const s = localStorage.getItem(SAVE_KEY);
		return s ? E.deserialize(s) : null;
	} catch {
		return null;
	}
}

// ---------- Helpers ----------
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const pct = (x) => (x > 0 ? "+" : "") + Math.round(x * 100) + "%";
function spark(values, w = 90, h = 26, cls = "spark") {
	if (!values || values.length < 2) return `<svg class="${cls}" width="${w}" height="${h}"></svg>`;
	const lo = Math.min(...values), hi = Math.max(...values);
	const span = hi - lo || 1;
	const pts = values.map((v, i) => `${((i / (values.length - 1)) * (w - 4) + 2).toFixed(1)},${(h - 3 - ((v - lo) / span) * (h - 6)).toFixed(1)}`).join(" ");
	const up = values[values.length - 1] >= values[0];
	return `<svg class="${cls} ${up ? "up" : "down"}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline points="${pts}" fill="none" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}
function avatar(p, size = "") {
	return `<span class="avatar ${size}" style="--c:${esc(p.color)}">${esc(p.emoji)}</span>`;
}
function me() {
	return E.currentPlayer(ui.game);
}
function act(result, okMsg) {
	if (result && result.ok === false) {
		showToast(result.msg, "bad");
		return false;
	}
	if (okMsg) showToast(okMsg, "good");
	save();
	render();
	return true;
}
function showToast(text, kind = "info") {
	ui.toast = { text, kind, t: Date.now() };
	renderToast();
	clearTimeout(showToast.timer);
	showToast.timer = setTimeout(() => {
		ui.toast = null;
		renderToast();
	}, 3200);
}
function renderToast() {
	let el = document.getElementById("toast");
	if (!el) {
		el = document.createElement("div");
		el.id = "toast";
		el.setAttribute("role", "status");
		document.body.appendChild(el);
	}
	el.className = ui.toast ? `show ${ui.toast.kind}` : "";
	el.textContent = ui.toast ? ui.toast.text : "";
}

// ---------- Modal ----------
let modalHandlers = {};
function openModal(html, handlers = {}) {
	modalHandlers = handlers;
	modalEl.innerHTML = `<div class="scrim" data-m="close"></div><div class="dialog" role="dialog" aria-modal="true">${html}</div>`;
	modalEl.hidden = false;
	const f = modalEl.querySelector("[data-autofocus]");
	if (f) f.focus();
}
function closeModal() {
	modalEl.hidden = true;
	modalEl.innerHTML = "";
	modalHandlers = {};
}
modalEl.addEventListener("click", (e) => {
	const b = e.target.closest("[data-m]");
	if (!b) return;
	const k = b.dataset.m;
	if (k === "close") return closeModal();
	if (modalHandlers[k]) modalHandlers[k](b);
});
// Enter never confirms anything: every confirm is a visible button.
modalEl.addEventListener("keydown", (e) => {
	if (e.key === "Enter" && e.target.tagName === "INPUT") e.preventDefault();
	if (e.key === "Escape") closeModal();
});

// Quantity / amount picker. opts: title, sub, max, step (unit), money (bool),
// quote(n) -> {line, ok}, confirm label, onConfirm(n).
function picker(opts) {
	let n = Math.min(opts.start ?? (opts.max > 0 ? 1 : 0), opts.max);
	const unit = opts.money ? 100 : 1;
	const steps = opts.money ? [10000, 50000, 100000] : [1, 5, 10];
	const draw = () => {
		const q = opts.quote(n);
		const label = opts.money ? fmt(n) : n.toLocaleString();
		openModal(
			`<h2>${opts.title}</h2>${opts.sub ? `<p class="sub">${opts.sub}</p>` : ""}
			<div class="qty">
				<button class="btn ghost" data-m="min">${opts.money ? "$0" : "0"}</button>
				${steps.map((s) => `<button class="btn ghost" data-m="d" data-v="${-s}">−${opts.money ? fmt(s) : s}</button>`).join("")}
				<output class="qty-num" aria-live="polite">${label}</output>
				${steps.map((s) => `<button class="btn ghost" data-m="d" data-v="${s}">+${opts.money ? fmt(s) : s}</button>`).join("")}
				<button class="btn ghost" data-m="max">Max</button>
			</div>
			<p class="quote ${q.ok ? "" : "warn"}">${q.line}</p>
			<div class="row end">
				<button class="btn ghost" data-m="close">Cancel</button>
				<button class="btn ${opts.danger ? "warn" : "go"}" data-m="ok" ${q.ok && n > 0 ? "" : "disabled"}>${opts.confirm}</button>
			</div>`,
			{
				min: () => { n = 0; draw(); },
				max: () => { n = opts.max; draw(); },
				d: (b) => { n = Math.max(0, Math.min(opts.max, n + Number(b.dataset.v))); if (opts.money) n = Math.floor(n / unit) * unit; draw(); },
				ok: () => { closeModal(); opts.onConfirm(n); },
			},
		);
	};
	draw();
}

// ---------- Screens ----------
function render() {
	const keep = {};
	app.querySelectorAll("[data-scroll]").forEach((el) => (keep[el.dataset.scroll] = el.scrollTop));
	if (ui.screen === "title") app.innerHTML = titleScreen();
	else if (ui.screen === "setup") app.innerHTML = setupScreen();
	else if (ui.screen === "handoff") app.innerHTML = handoffScreen();
	else if (ui.screen === "game") app.innerHTML = gameScreen();
	else if (ui.screen === "end") app.innerHTML = endScreen();
	app.querySelectorAll("[data-scroll]").forEach((el) => {
		if (keep[el.dataset.scroll] != null) el.scrollTop = keep[el.dataset.scroll];
	});
	window.__fs.game = ui.game;
}

function titleScreen() {
	const saved = loadSave();
	return `<section class="title">
		<div class="logo"><span>FLIP</span><span>SIDE</span></div>
		<p class="tag">Buy low. Sell high. Don't let Fast Eddie catch you broke.</p>
		<div class="title-goods" aria-hidden="true">${E.GOODS.map((g) => `<span>${g.icon}</span>`).join("")}</div>
		<div class="col">
			${saved && !saved.over ? `<button class="btn big go" data-act="continue">Keep playing <small>Day ${saved.day} of ${saved.days} · ${saved.players.map((p) => esc(p.name)).join(", ")}</small></button>` : ""}
			<button class="btn big ${saved && !saved.over ? "ghost" : "go"}" data-act="new">New game</button>
		</div>
	</section>`;
}

function defaultSetup(seed) {
	const profiles = load(PROFILE_KEY, []);
	return { profiles, picked: profiles.length ? [profiles[0].id] : [], days: 30, seed: seed || "", adding: profiles.length === 0 };
}

function setupScreen() {
	const s = ui.setup;
	const cards = s.profiles
		.map((p) => {
			const on = s.picked.includes(p.id);
			const order = s.picked.indexOf(p.id) + 1;
			return `<div class="who ${on ? "on" : ""}" style="--c:${esc(p.color)}">
				<button class="who-pick" data-act="pick" data-id="${p.id}" aria-pressed="${on}">
					<span class="who-emoji">${esc(p.emoji)}</span>
					<span class="who-name">${esc(p.name)}</span>
					${on ? `<span class="who-order">Player ${order}</span>` : `<span class="who-order off">Tap to play</span>`}
				</button>
				<button class="chip ${p.simple ? "on" : ""}" data-act="simple" data-id="${p.id}" aria-pressed="${p.simple}">${p.simple ? "✔ Simple mode" : "Simple mode"}</button>
				<button class="chip ghost" data-act="forget" data-id="${p.id}" aria-label="Remove ${esc(p.name)}">Remove</button>
			</div>`;
		})
		.join("");
	const add = s.adding
		? `<form class="add" data-form="add" autocomplete="off">
			<label>Name <input name="name" maxlength="14" placeholder="Your name" data-autofocus></label>
			<div class="emoji-row" role="radiogroup" aria-label="Pick a face">${EMOJIS.map((e, i) => `<button type="button" class="emoji ${i === (s.emoji ?? 0) ? "on" : ""}" data-act="emoji" data-i="${i}" aria-pressed="${i === (s.emoji ?? 0)}">${e}</button>`).join("")}</div>
			<label class="check"><input type="checkbox" name="simple"> Simple mode (fewer things to buy, round prices, no loan)</label>
			<div class="row"><button type="button" class="btn go" data-act="addsave">Add player</button>${s.profiles.length ? `<button type="button" class="btn ghost" data-act="addcancel">Cancel</button>` : ""}</div>
		</form>`
		: `<button class="who add-btn" data-act="add"><span class="who-emoji">＋</span><span class="who-name">New player</span></button>`;
	return `<section class="setup">
		<header class="setup-head"><button class="btn ghost" data-act="home">← Back</button><h1>Who am I?</h1><p>Tap everyone who's playing. Up to 4 share one keyboard and one market.</p></header>
		<div class="who-grid">${cards}${s.profiles.length < 8 ? add : ""}</div>
		<div class="setup-opts">
			<div class="opt"><span class="opt-label">How long?</span>
				<div class="seg">${[30, 60, 90].map((d) => `<button class="${s.days === d ? "on" : ""}" data-act="days" data-d="${d}" aria-pressed="${s.days === d}">${d} days</button>`).join("")}</div>
			</div>
			<div class="opt"><span class="opt-label">Seed</span>
				<form data-form="seed" class="seed" autocomplete="off"><input name="seed" value="${esc(s.seed)}" placeholder="Random" maxlength="24" aria-label="Seed"><button type="button" class="btn ghost" data-act="dice" aria-label="Random seed">🎲</button></form>
				<small>Same seed, same town: share it to race on the same market.</small>
			</div>
			<button class="btn big go" data-act="start" ${s.picked.length ? "" : "disabled"}>Start${s.picked.length > 1 ? ` with ${s.picked.length} players` : ""}</button>
		</div>
	</section>`;
}

function handoffScreen() {
	const g = ui.game;
	const p = me();
	const st = E.standings(g);
	return `<section class="handoff" style="--c:${esc(p.color)}">
		<p class="day-big">Day ${g.day} of ${g.days}</p>
		<h1>${avatar(p, "xl")} ${esc(p.name)}, you're up</h1>
		<p class="sub">Everyone else, eyes off the screen.</p>
		<button class="btn big go" data-act="ready">I'm ${esc(p.name)}. Start my turn</button>
		<ol class="mini-board">${st.map((x) => `<li>${avatar(x.p)} <span>${esc(x.p.name)}</span> <b>${fmt(x.nw)}</b></li>`).join("")}</ol>
	</section>`;
}

// ---------- Game screen ----------
function gameScreen() {
	const g = ui.game;
	const p = me();
	const nw = E.netWorth(g, p);
	const tabs = [
		{ id: "market", label: "🛒 Market" },
		{ id: "money", label: "💵 Money" },
		{ id: "biz", label: p.tier2 ? "🏪 Businesses" : "🔒 Businesses" },
		{ id: "invest", label: p.tier3 ? "📈 Stocks" : "🔒 Stocks" },
	];
	let body = "";
	if (ui.tab === "market") body = marketTab(g, p);
	else if (ui.tab === "money") body = moneyTab(g, p);
	else if (ui.tab === "biz") body = bizTab(g, p);
	else body = investTab(g, p);
	const dueSoon = p.debt > 0 && p.dueDay - g.day <= 3;
	return `<section class="game" style="--c:${esc(p.color)}">
		<header class="hud">
			<div class="hud-day"><b>Day ${g.day}</b><span>of ${g.days}</span></div>
			<div class="hud-who">${avatar(p)} <b>${esc(p.name)}</b>${p.simple ? `<span class="pill">Simple</span>` : ""}</div>
			<div class="hud-stat"><span>Cash</span><b>${fmt(p.cash)}</b></div>
			<div class="hud-stat"><span>Bank</span><b>${fmt(p.bank)}</b></div>
			<div class="hud-stat ${p.debt ? "bad" : ""} ${dueSoon ? "pulse" : ""}"><span>Owe Eddie</span><b>${fmt(p.debt)}</b>${p.debt ? `<small>${g.day > p.dueDay ? "LATE" : `due day ${p.dueDay}`}</small>` : ""}</div>
			<div class="hud-stat"><span>${E.STORAGE[p.storage].icon} Space</span><b>${E.used(p)}/${E.capacity(p)}</b></div>
			<div class="hud-stat nw"><span>Net worth</span><b>${fmt(nw)}</b></div>
			<button class="btn ghost small" data-act="menu">Menu</button>
		</header>
		<aside class="map-col">
			${mapPanel(g, p)}
		</aside>
		<div class="center">
			<nav class="tabs" role="tablist">${tabs.map((t) => `<button role="tab" class="${ui.tab === t.id ? "on" : ""}" aria-selected="${ui.tab === t.id}" data-act="tab" data-tab="${t.id}">${t.label}</button>`).join("")}</nav>
			<div class="tab-body" data-scroll="tab-${ui.tab}">${body}</div>
		</div>
		<aside class="side-col">
			${sidePanel(g, p)}
		</aside>
	</section>`;
}

function mapPanel(g, p) {
	const here = E.MARKET[p.at];
	const pins = E.MARKETS.map((m) => {
		const isHere = m.id === p.at;
		const others = g.players.filter((o) => o !== p && o.at === m.id);
		return `<button class="pin ${isHere ? "here" : ""}" style="left:clamp(3.3rem, ${m.x}%, calc(100% - 3.3rem));top:clamp(2.2rem, ${m.y}%, calc(100% - 2.2rem))" data-act="${isHere ? "stay" : "travel"}" data-to="${m.id}">
			<span class="pin-icon">${m.icon}</span><span class="pin-name">${esc(m.name)}</span>
			<span class="pin-fare">${isHere ? "You are here" : fmt(E.fare(p.at, m.id))}</span>
			${others.length ? `<span class="pin-others">${others.map((o) => esc(o.emoji)).join("")}</span>` : ""}
		</button>`;
	}).join("");
	const roads = E.MARKETS.map((m) => `<line x1="${here.x}" y1="${here.y}" x2="${m.x}" y2="${m.y}"/>`).join("");
	return `<div class="panel map-panel">
		<h3>${here.icon} ${esc(here.name)}</h3>
		<p class="muted">${esc(here.blurb)}</p>
		<div class="map">
			<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path class="river" d="M0,58 C20,50 30,66 50,60 S80,48 100,56"/><g class="roads">${roads}</g></svg>
			${pins}
		</div>
		<p class="muted small">Tap a place to ride the bus there. Every move takes a day.</p>
		<button class="btn go wide" data-act="stay">Stay in ${esc(here.name)} and end the day</button>
	</div>`;
}

function sidePanel(g, p) {
	const news = g.news.slice(-24).reverse();
	const icon = { rumor: "🗣️", up: "📈", down: "📉", info: "📰" };
	const multi = g.players.length > 1;
	const st = E.standings(g);
	return `<div class="panel news" data-scroll="news">
		<h3>Around town</h3>
		<ul>${news.map((n) => `<li class="${n.kind} ${n.day === g.day ? "today" : ""}"><span class="n-ico">${icon[n.kind] || "📰"}</span><span><small>Day ${n.day}</small> ${esc(n.text)}</span></li>`).join("")}</ul>
	</div>
	<div class="panel">
		<h3>${multi ? "Standings" : "Your net worth"}</h3>
		${multi ? `<ol class="board">${st.map((x) => `<li class="${x.p === p ? "me" : ""}">${avatar(x.p)} <span class="nm">${esc(x.p.name)}</span> <b>${fmt(x.nw)}</b></li>`).join("")}</ol>` : ""}
		<div class="nw-chart">${spark(p.history.map((h) => h.nw), 300, 60, "spark big")}</div>
		<p class="muted small">Seed <b>${esc(g.seed)}</b></p>
	</div>`;
}

function marketTab(g, p) {
	const goods = E.goodsFor(p);
	const rows = goods.map((gd) => {
		const buyAt = E.quoteBuy(g, p.at, gd.id, 1, p);
		const sellFor = E.quoteSell(g, p.at, gd.id, 1, p);
		const now = E.price(g, p.at, gd.id);
		const prev = E.prevPrice(g, p.at, gd.id);
		const ch = prev ? (now - prev) / prev : 0;
		const have = p.inv[gd.id] || 0;
		const avg = have ? Math.round(p.cost[gd.id] / have / 100) * 100 : 0;
		const hist = g.markets[p.at][gd.id].hist;
		const canBuy = E.canBuy(g, p, gd.id);
		return `<tr>
			<td class="item"><span class="g-ico">${gd.icon}</span><span><b>${gd.name}</b>${gd.size > 1 ? `<small>takes ${gd.size} spaces</small>` : ""}</span></td>
			<td class="num"><b>${fmt(buyAt)}</b></td>
			<td class="num">${fmt(sellFor)}</td>
			<td class="num ch ${ch > 0.005 ? "up" : ch < -0.005 ? "down" : ""}">${Math.abs(ch) < 0.005 ? "–" : (ch > 0 ? "▲ " : "▼ ") + Math.abs(Math.round(ch * 100)) + "%"}</td>
			<td>${hist.length > 1 ? spark(hist) : `<span class="muted small">new in town</span>`}</td>
			<td class="num">${have ? `<b>${have}</b><small>paid ~${fmt(avg)}</small>` : `<span class="muted">–</span>`}</td>
			<td class="acts"><button class="btn go small" data-act="buy" data-g="${gd.id}" ${canBuy ? "" : "disabled"}>Buy</button><button class="btn sell small" data-act="sell" data-g="${gd.id}" ${have ? "" : "disabled"}>Sell</button></td>
		</tr>`;
	}).join("");
	const free = E.capacity(p) - E.used(p);
	return `<div class="market">
		<table class="mkt">
			<thead><tr><th>Item</th><th class="num">Buy at</th><th class="num">Sell for</th><th class="num">Today</th><th>Last days here</th><th class="num">You have</th><th></th></tr></thead>
			<tbody>${rows}</tbody>
		</table>
		<p class="muted small">${free} space${free === 1 ? "" : "s"} free in your ${E.STORAGE[p.storage].name.toLowerCase()}. Big orders push the price as you go.</p>
	</div>`;
}

function moneyTab(g, p) {
	const downtown = p.at === "downtown";
	const tomorrow = Math.ceil(p.debt * E.LOAN_RATE);
	const apr = Math.round(E.LOAN_RATE * 365 * 100);
	const next = E.STORAGE[p.storage + 1];
	const ins = E.insured(g, p);
	return `<div class="cards">
		<div class="card eddie">
			<h3>💸 Fast Eddie's Cash Shack</h3>
			<p class="big-num ${p.debt ? "bad" : ""}">${fmt(p.debt)}</p>
			<p>Interest: <b>${E.LOAN_RATE * 100}% a day</b> (that's <b>${apr}% a year</b>)</p>
			${p.debt ? `<p>Tomorrow you'll owe <b class="bad">${fmt(p.debt + tomorrow)}</b>. ${g.day > p.dueDay ? `<b class="bad">You're late.</b> Big Lou is looking for you.` : `Pay it all by <b>day ${p.dueDay}</b>.`}</p>` : `<p>You don't owe Eddie a thing.</p>`}
			${downtown ? `<div class="row"><button class="btn warn" data-act="borrow">Borrow</button><button class="btn go" data-act="repay" ${p.debt && p.cash ? "" : "disabled"}>Pay back</button></div>` : `<p class="muted">Eddie only does business Downtown.</p>`}
		</div>
		<div class="card bank">
			<h3>🏦 Steady Savings Bank</h3>
			<p class="big-num">${fmt(p.bank)}</p>
			<p>Pays <b>${E.BANK_RATE * 100}% a year</b>${p.bank ? `: about ${fmt(Math.floor((p.bank * E.BANK_RATE) / 365))} a day on yours` : ""}. Safe from scammers and Big Lou.</p>
			<div class="row"><button class="btn go" data-act="deposit" ${p.cash ? "" : "disabled"}>Put in</button><button class="btn ghost" data-act="withdraw" ${p.bank ? "" : "disabled"}>Take out</button></div>
		</div>
		<div class="card">
			<h3>${E.STORAGE[p.storage].icon} ${E.STORAGE[p.storage].name}: ${E.capacity(p)} spaces</h3>
			${next ? `<p>Upgrade to a <b>${next.icon} ${next.name}</b>: ${next.cap} spaces for <b>${fmt(next.price * 100)}</b>.</p><button class="btn go" data-act="storage" ${p.cash >= next.price * 100 ? "" : "disabled"}>Buy the ${next.name.toLowerCase()}</button>` : `<p>The biggest storage there is.</p>`}
		</div>
		<div class="card">
			<h3>🛡️ Stuff Insurance</h3>
			<p>${ins ? `<b class="good">Covered through day ${p.insuredUntil}.</b>` : "Not covered."} Pays you back if boxes get lost, soaked or scammed.</p>
			<p>${fmt(E.insuranceCost(p))} for 7 days (costs more with bigger storage).</p>
			<button class="btn go" data-act="insure" ${p.cash >= E.insuranceCost(p) ? "" : "disabled"}>${ins ? "Add 7 more days" : "Buy 7 days"}</button>
		</div>
	</div>`;
}

function bizTab(g, p) {
	if (!p.tier2) {
		const nw = E.netWorth(g, p);
		return lockedPanel("🏪", `Business owners only talk to people worth ${fmt(E.TIER2_AT)} or more.`, nw, E.TIER2_AT);
	}
	const owned = p.businesses.map((b) => {
		const B = E.BUSINESS[b.type];
		const prog = Math.max(0, Math.min(1, b.earned / b.paid));
		const perDay = b.days ? Math.round(b.earned / b.days) : 0;
		return `<div class="card biz owned">
			<h3>${B.icon} ${B.name}${b.upgraded ? ` <span class="pill">${B.upgrade.name}</span>` : ""}</h3>
			<dl class="stats">
				<div><dt>You put in</dt><dd>${fmt(b.paid)}</dd></div>
				<div><dt>Earned so far</dt><dd class="${b.earned >= 0 ? "good" : "bad"}">${fmt(b.earned)}</dd></div>
				<div><dt>Per day (real)</dt><dd>${b.days ? fmt(perDay) : "–"}</dd></div>
				<div><dt>Days owned</dt><dd>${b.days}</dd></div>
			</dl>
			<div class="bar" title="Paid back"><span style="width:${(prog * 100).toFixed(0)}%"></span></div>
			<p class="small">${Math.round(prog * 100)}% paid back${b.days && perDay > 0 && prog < 1 ? `, about ${Math.ceil((b.paid - b.earned) / perDay)} more days at this pace` : ""}.</p>
			<div class="row">
				${b.upgraded ? "" : `<button class="btn go small" data-act="bizup" data-id="${b.uid}" ${p.cash >= B.upgrade.price * 100 ? "" : "disabled"}>${B.upgrade.name}: ${fmt(B.upgrade.price * 100)} (+${fmt((B.upgrade.rev - B.upgrade.exp) * 100)}/day)</button>`}
				<button class="btn sell small" data-act="bizsell" data-id="${b.uid}">Sell for ${fmt(E.businessValue(b))}</button>
			</div>
		</div>`;
	}).join("");
	const shop = E.BUSINESSES.map((B) => {
		const o = E.businessOutlook(B.id, false);
		return `<div class="card biz">
			<h3>${B.icon} ${B.name}</h3>
			<p class="big-num">${fmt(B.price * 100)}</p>
			<dl class="stats">
				<div><dt>Brings in</dt><dd>~${fmt(o.rev * 100)}/day</dd></div>
				<div><dt>Costs to run</dt><dd>~${fmt(o.exp * 100)}/day</dd></div>
				<div><dt>Pays for itself</dt><dd>~${o.payback} days</dd></div>
				<div><dt>Earns back per month</dt><dd>~${Math.round(o.roi * 100)}%</dd></div>
			</dl>
			<p class="small muted">${B.rainy ? "Slow on rainy days. " : ""}Repairs happen. Sells back for ${Math.round(E.BUSINESS_RESALE * 100)}% of what you put in.</p>
			<button class="btn go" data-act="bizbuy" data-id="${B.id}" ${p.cash >= B.price * 100 ? "" : "disabled"}>Buy it</button>
		</div>`;
	}).join("");
	return `${owned ? `<h3 class="section">Yours</h3><div class="cards">${owned}</div>` : ""}<h3 class="section">For sale</h3><div class="cards">${shop}</div>`;
}

function lockedPanel(icon, text, now, need) {
	const prog = Math.max(0, Math.min(1, now / need));
	return `<div class="locked"><span class="lock-ico">${icon}</span><p>${text}</p><div class="bar big"><span style="width:${(prog * 100).toFixed(0)}%"></span></div><p class="muted">${fmt(now)} of ${fmt(need)}</p></div>`;
}

function investTab(g, p) {
	if (!p.tier3) {
		const nw = E.netWorth(g, p);
		return p.tier2
			? lockedPanel("📈", `Buy a business, or reach ${fmt(E.TIER3_AT)}, and a broker will open an account for you.`, nw, E.TIER3_AT)
			: lockedPanel("📈", "The stock market opens up after you've made it in business.", nw, E.TIER2_AT);
	}
	const rows = g.companies.map((c) => {
		const prev = c.hist[c.hist.length - 2] || c.price;
		const ch = (c.price - prev) / prev;
		const have = p.stocks[c.id] || 0;
		return `<tr>
			<td><b>${esc(c.id)}</b><small>${esc(c.name)}</small></td>
			<td>${E.SECTORS[c.sector]}</td>
			<td class="num"><b>$${(c.price / 100).toFixed(2)}</b></td>
			<td class="num ch ${ch > 0 ? "up" : ch < 0 ? "down" : ""}">${ch === 0 ? "–" : pct(ch)}</td>
			<td>${spark(c.hist.slice(-30))}</td>
			<td class="num">${c.div ? (c.div * 100).toFixed(1) + "%" : "–"}</td>
			<td class="num">${have ? `<b>${have}</b><small>${fmt(have * c.price)}</small>` : `<span class="muted">–</span>`}</td>
			<td class="acts"><button class="btn go small" data-act="stockbuy" data-s="${esc(c.id)}" ${p.cash >= c.price ? "" : "disabled"}>Buy</button><button class="btn sell small" data-act="stocksell" data-s="${esc(c.id)}" ${have ? "" : "disabled"}>Sell</button></td>
		</tr>`;
	}).join("");
	const iv = E.indexValue(g, p);
	const ih = g.index.hist;
	const ich = ih.length > 1 ? (ih[ih.length - 1] - ih[ih.length - 2]) / ih[ih.length - 2] : 0;
	const cds = p.cds.map((cd, i) => {
		const left = E.CD_TERM - (g.day - cd.day);
		return `<li>${fmt(cd.amount)} from day ${cd.day}: ${left > 0 ? `${left} days to go` : `<b class="good">ready: ${fmt(E.cdValue(g, cd))}</b>`} <button class="btn ghost small" data-act="cashcd" data-i="${i}">Cash out${left > 0 ? " early" : ""}</button></li>`;
	}).join("");
	return `<div class="cards two">
		<div class="card">
			<h3>🧺 Everything Index Fund</h3>
			<p>Owns the same-size slice of every company on the board. If one goes bust, it's only a small piece.</p>
			<p class="big-num">$${(E.indexPrice(g) / 100).toFixed(2)} <small class="ch ${ich >= 0 ? "up" : "down"}">${pct(ich)} today</small></p>
			${spark(ih.slice(-30), 260, 40)}
			<p>Yours: <b>${fmt(iv)}</b>${p.indexCost ? ` (you put in ${fmt(p.indexCost)})` : ""}</p>
			<div class="row"><button class="btn go" data-act="indexbuy" ${p.cash >= 100 ? "" : "disabled"}>Buy</button><button class="btn sell" data-act="indexsell" ${iv ? "" : "disabled"}>Sell</button></div>
		</div>
		<div class="card">
			<h3>🔒 Certificate of Deposit</h3>
			<p>Lock money away for ${E.CD_TERM} days at <b>${(E.CD_RATE * 100).toFixed(1)}% a year</b>. Cash out early and you get no interest.</p>
			${cds ? `<ul class="cds">${cds}</ul>` : ""}
			<button class="btn go" data-act="cdbuy" ${p.cash >= 10000 ? "" : "disabled"}>Open a CD</button>
		</div>
	</div>
	<table class="mkt stocks">
		<thead><tr><th>Company</th><th>Sector</th><th class="num">Price</th><th class="num">Today</th><th>Last 30 days</th><th class="num">Dividend</th><th class="num">You own</th><th></th></tr></thead>
		<tbody>${rows}</tbody>
	</table>`;
}

// ---------- End screen ----------
function endScreen() {
	const g = ui.game;
	const st = E.standings(g);
	const p = g.players[ui.endTab] || g.players[0];
	const d = E.debrief(g, p);
	const multi = g.players.length > 1;
	const ff = ui.ff[p.id];
	return `<section class="end">
		<header class="end-head">
			<h1>${multi ? `${esc(st[0].p.name)} wins!` : "Time's up!"}</h1>
			<p>${g.days} days are over. Everything you're holding counts at today's ${esc(E.MARKET[p.at].name)} prices.</p>
		</header>
		<div class="end-grid">
			<div class="panel">
				<h3>Final net worth</h3>
				<ol class="board big">${st.map((x, i) => `<li>${["🥇", "🥈", "🥉", "4️⃣"][i]} ${avatar(x.p)} <span class="nm">${esc(x.p.name)}</span> <b>${fmt(x.nw)}</b></li>`).join("")}</ol>
				${netWorthChart(g)}
			</div>
			<div class="panel debrief">
				${multi ? `<nav class="tabs small">${g.players.map((x, i) => `<button class="${ui.endTab === i ? "on" : ""}" data-act="endtab" data-i="${i}">${esc(x.emoji)} ${esc(x.name)}</button>`).join("")}</nav>` : ""}
				<h3>${esc(p.name)}'s ${g.days} days</h3>
				<ul class="lines">${d.lines.map((l) => `<li class="${l.kind}">${esc(l.text)}</li>`).join("")}</ul>
				<div class="ff">
					<h3>⏩ Fast-forward</h3>
					<p>Leave it all alone and skip ahead. Investments stay put; everything else gets sold and sits in the bank.</p>
					<div class="row">${[10, 20, 30].map((y) => `<button class="btn ghost" data-act="ff" data-y="${y}">${y} years</button>`).join("")}</div>
					${ff ? ffView(ff) : ""}
				</div>
			</div>
		</div>
		<div class="row center">
			<button class="btn big go" data-act="replay">Play seed ${esc(g.seed)} again</button>
			<button class="btn big ghost" data-act="new">New game</button>
		</div>
	</section>`;
}

function netWorthChart(g) {
	const w = 520, h = 200;
	const all = g.players.flatMap((p) => p.history.map((x) => x.nw));
	const lo = Math.min(0, ...all), hi = Math.max(...all, 1);
	const x = (d) => ((d - 1) / Math.max(1, g.days - 1)) * (w - 20) + 10;
	const y = (v) => h - 14 - ((v - lo) / (hi - lo || 1)) * (h - 28);
	const lines = g.players.map((p) => `<polyline points="${p.history.map((pt) => `${x(pt.day).toFixed(1)},${y(pt.nw).toFixed(1)}`).join(" ")}" stroke="${esc(p.color)}" fill="none" stroke-width="3" stroke-linejoin="round"/>`).join("");
	return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Net worth by day"><line x1="10" x2="${w - 10}" y1="${y(0)}" y2="${y(0)}" class="zero"/>${lines}</svg>`;
}

function ffView(ff) {
	const r = ff.result;
	const w = 520, h = 180;
	const series = [
		{ k: "yours", label: "Left as it is", c: "var(--accent)" },
		{ k: "index", label: "All in the index fund", c: "var(--teal)" },
		{ k: "bank", label: "All in the bank", c: "var(--violet)" },
		{ k: "jar", label: "Cash in a jar", c: "var(--muted)" },
	];
	const all = series.flatMap((s) => r[s.k]);
	const hi = Math.max(...all, 1);
	const n = r.yours.length;
	const x = (i) => (i / (n - 1)) * (w - 20) + 10;
	const y = (v) => h - 12 - (v / hi) * (h - 24);
	const lines = series.map((s) => `<polyline points="${r[s.k].map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ")}" stroke="${s.c}" fill="none" stroke-width="3"/>`).join("");
	const last = (k) => r[k][n - 1];
	if (r.start <= 0) return `<p class="bad">You'd have nothing to fast-forward: Eddie gets paid first.</p>`;
	return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Fast-forward ${ff.years} years">${lines}</svg>
		<ul class="ff-legend">${series.map((s) => `<li><span class="sw" style="background:${s.c}"></span>${s.label}: <b>${fmt(last(s.k))}</b></li>`).join("")}</ul>
		${r.busts.length ? `<p class="bad small">${r.busts.map((b) => `${esc(b.name)} went bust in year ${b.year}.`).join(" ")}</p>` : ""}
		<p class="small muted">Starting from ${fmt(r.start)}, ${ff.years} years later.</p>`;
}

// ---------- Turn start ----------
function beginTurn() {
	const g = ui.game;
	// Don't show the next player what the last one just did.
	clearTimeout(showToast.timer);
	ui.toast = null;
	renderToast();
	if (g.over) {
		ui.screen = "end";
		ui.endTab = 0;
		store(SAVE_KEY, null);
		save();
		render();
		return;
	}
	ui.tab = "market";
	ui.screen = g.players.length > 1 ? "handoff" : "game";
	render();
	if (ui.screen === "game") showInbox();
}
function showInbox() {
	const p = me();
	if (!p.inbox.length) return;
	const items = p.inbox.splice(0);
	save();
	openModal(`<h2>While you were out…</h2><ul class="inbox">${items.map((m) => `<li class="${m.kind}">${esc(m.text)}</li>`).join("")}</ul><div class="row end"><button class="btn go" data-m="close" data-autofocus>Got it</button></div>`);
}

// ---------- Actions ----------
const actions = {
	new() { ui.setup = defaultSetup(); ui.screen = "setup"; render(); },
	home() { ui.screen = "title"; render(); },
	continue() {
		const s = loadSave();
		if (!s) return;
		ui.game = s;
		ui.ff = {};
		beginTurn();
	},
	pick(b) {
		const s = ui.setup;
		const id = b.dataset.id;
		if (s.picked.includes(id)) s.picked = s.picked.filter((x) => x !== id);
		else if (s.picked.length < 4) s.picked.push(id);
		else showToast("Four players max.", "bad");
		render();
	},
	simple(b) {
		const pr = ui.setup.profiles.find((x) => x.id === b.dataset.id);
		pr.simple = !pr.simple;
		store(PROFILE_KEY, ui.setup.profiles);
		render();
	},
	forget(b) {
		const s = ui.setup;
		const pr = s.profiles.find((x) => x.id === b.dataset.id);
		openModal(`<h2>Remove ${esc(pr.name)}?</h2><p>This only removes the name from this computer.</p><div class="row end"><button class="btn ghost" data-m="close">Keep</button><button class="btn warn" data-m="ok">Remove</button></div>`, {
			ok: () => {
				s.profiles = s.profiles.filter((x) => x.id !== pr.id);
				s.picked = s.picked.filter((x) => x !== pr.id);
				store(PROFILE_KEY, s.profiles);
				closeModal();
				render();
			},
		});
	},
	add() { ui.setup.adding = true; render(); app.querySelector("[data-autofocus]")?.focus(); },
	addcancel() { ui.setup.adding = false; render(); },
	emoji(b) {
		const form = app.querySelector('[data-form="add"]');
		const name = form?.name.value;
		const simple = form?.simple.checked;
		ui.setup.emoji = Number(b.dataset.i);
		render();
		const f = app.querySelector('[data-form="add"]');
		if (f) { f.name.value = name || ""; f.simple.checked = !!simple; }
	},
	addsave() {
		const s = ui.setup;
		const form = app.querySelector('[data-form="add"]');
		const name = form.name.value.trim();
		if (!name) return showToast("Type a name first.", "bad");
		const used = new Set(s.profiles.map((p) => p.color));
		const color = COLORS.find((c) => !used.has(c)) || COLORS[s.profiles.length % COLORS.length];
		const pr = { id: "p" + Date.now().toString(36), name, emoji: EMOJIS[s.emoji ?? 0], color, simple: form.simple.checked };
		s.profiles.push(pr);
		if (s.picked.length < 4) s.picked.push(pr.id);
		s.adding = false;
		s.emoji = ((s.emoji ?? 0) + 1) % EMOJIS.length;
		store(PROFILE_KEY, s.profiles);
		render();
	},
	days(b) { ui.setup.days = Number(b.dataset.d); render(); },
	dice() { readSeed(); ui.setup.seed = E.randomSeed(); render(); },
	start() {
		readSeed();
		const s = ui.setup;
		const players = s.picked.map((id) => s.profiles.find((p) => p.id === id)).filter(Boolean);
		if (!players.length) return;
		ui.game = E.createGame({ seed: s.seed || E.randomSeed(), days: s.days, players });
		ui.ff = {};
		save();
		beginTurn();
	},
	ready() { ui.screen = "game"; render(); showInbox(); },
	tab(b) { ui.tab = b.dataset.tab; render(); },
	menu() {
		openModal(`<h2>Paused</h2><p>Your game saves after every move.</p><div class="col"><button class="btn go" data-m="close">Back to the game</button><button class="btn ghost" data-m="quit">Quit to title (keeps the save)</button></div>`, {
			quit: () => { closeModal(); ui.screen = "title"; render(); },
		});
	},
	buy(b) {
		const g = ui.game, p = me(), id = b.dataset.g, gd = E.GOOD[id];
		const max = E.maxBuy(g, p, id);
		picker({
			title: `Buy ${gd.icon} ${gd.name}`,
			sub: `${fmt(E.quoteBuy(g, p.at, id, 1, p))} each to start. You can afford ${max}${gd.size > 1 ? ` (each takes ${gd.size} spaces)` : ""}.`,
			max,
			quote: (n) => {
				const c = E.quoteBuy(g, p.at, id, n, p);
				return { ok: c <= p.cash, line: n ? `${n} for <b>${fmt(c)}</b> (about ${fmt(Math.round(c / n))} each). Cash left: ${fmt(p.cash - c)}.` : "Pick how many." };
			},
			confirm: "Buy",
			onConfirm: (n) => act(E.buy(g, id, n), `Bought ${n} ${gd.name.toLowerCase()}.`),
		});
	},
	sell(b) {
		const g = ui.game, p = me(), id = b.dataset.g, gd = E.GOOD[id];
		const have = p.inv[id] || 0;
		picker({
			title: `Sell ${gd.icon} ${gd.name}`,
			sub: `You have ${have}. You paid about ${fmt(Math.round(p.cost[id] / have))} each.`,
			max: have,
			start: have,
			quote: (n) => {
				if (!n) return { ok: false, line: "Pick how many." };
				const c = E.quoteSell(g, p.at, id, n, p);
				const basis = E.costBasis(p, id, n);
				const prof = c - basis;
				return { ok: true, line: `${n} for <b>${fmt(c)}</b> (about ${fmt(Math.round(c / n))} each). That's <b class="${prof >= 0 ? "good" : "bad"}">${prof >= 0 ? "+" : ""}${fmt(prof)}</b> vs. what you paid.` };
			},
			confirm: "Sell",
			onConfirm: (n) => act(E.sell(g, id, n), `Sold ${n} ${gd.name.toLowerCase()}.`),
		});
	},
	travel(b) {
		const g = ui.game, p = me(), to = b.dataset.to, m = E.MARKET[to];
		const f = E.fare(p.at, to);
		openModal(`<h2>${m.icon} Go to ${esc(m.name)}?</h2><p>${esc(m.blurb)}</p><p>Bus fare <b>${fmt(f)}</b>. The ride takes the rest of the day${g.players.length > 1 ? " and ends your turn" : ""}.</p>
			<div class="row end"><button class="btn ghost" data-m="close">Not yet</button><button class="btn go" data-m="ok" ${p.cash >= f ? "" : "disabled"}>Ride the bus</button></div>`, {
			ok: () => { closeModal(); doEndTurn(to); },
		});
	},
	stay() {
		const g = ui.game, p = me();
		openModal(`<h2>End the day in ${esc(E.MARKET[p.at].name)}?</h2><p>${g.day === g.days ? "This is the last day. The game ends after this." : "Prices will move overnight."}</p>
			<div class="row end"><button class="btn ghost" data-m="close">Not yet</button><button class="btn go" data-m="ok">End the day</button></div>`, {
			ok: () => { closeModal(); doEndTurn(null); },
		});
	},
	borrow() {
		const g = ui.game, p = me();
		const max = E.borrowLimit(g, p);
		picker({
			title: "Borrow from Fast Eddie",
			sub: `He'll lend you up to ${fmt(max)}. ${E.LOAN_RATE * 100}% interest every single day.`,
			money: true, max, start: Math.min(50000, max), danger: true,
			quote: (n) => ({ ok: true, line: n ? `Borrow ${fmt(n)}. In 10 days that's <b class="bad">${fmt(Math.round(n * Math.pow(1 + E.LOAN_RATE, 10)))}</b> if you don't pay.` : "Pick an amount." }),
			confirm: "Take the money",
			onConfirm: (n) => act(E.borrow(g, n), `Eddie counts out ${fmt(n)}.`),
		});
	},
	repay() {
		const g = ui.game, p = me();
		const max = Math.min(p.debt, p.cash);
		picker({
			title: "Pay Fast Eddie", sub: `You owe ${fmt(p.debt)}.`, money: true, max, start: max,
			quote: (n) => ({ ok: true, line: n ? `Pay ${fmt(n)}. You'd still owe ${fmt(p.debt - n)}.` : "Pick an amount." }),
			confirm: "Pay", onConfirm: (n) => {
				const paidOff = n >= p.debt;
				act(E.repay(g, n), paidOff ? "Paid off! Eddie looks disappointed." : `Paid ${fmt(n)}.`);
			},
		});
	},
	deposit() {
		const g = ui.game, p = me();
		picker({
			title: "Put money in the bank", money: true, max: p.cash, start: p.cash,
			quote: (n) => ({ ok: true, line: n ? `Deposit ${fmt(n)}. Cash left: ${fmt(p.cash - n)}.` : "Pick an amount." }),
			confirm: "Deposit", onConfirm: (n) => act(E.deposit(g, n), `Deposited ${fmt(n)}.`),
		});
	},
	withdraw() {
		const g = ui.game, p = me();
		picker({
			title: "Take money out", money: true, max: p.bank, start: p.bank,
			quote: (n) => ({ ok: true, line: n ? `Withdraw ${fmt(n)}.` : "Pick an amount." }),
			confirm: "Withdraw", onConfirm: (n) => act(E.withdraw(g, n), `Took out ${fmt(n)}.`),
		});
	},
	storage() {
		const g = ui.game, p = me(), next = E.STORAGE[p.storage + 1];
		confirmBox(`Buy the ${next.name.toLowerCase()}?`, `${next.cap} spaces for ${fmt(next.price * 100)}.`, "Buy it", () => act(E.upgradeStorage(g), `You've got a ${next.name.toLowerCase()} now.`));
	},
	insure() {
		const g = ui.game, p = me();
		confirmBox("Buy 7 days of insurance?", `${fmt(E.insuranceCost(p))}. Covers lost boxes, rain damage and scams.`, "Buy", () => act(E.buyInsurance(g), "You're covered."));
	},
	bizbuy(b) {
		const g = ui.game, B = E.BUSINESS[b.dataset.id];
		const o = E.businessOutlook(B.id, false);
		confirmBox(`Buy the ${B.name.toLowerCase()}?`, `${fmt(B.price * 100)}. Expect about ${fmt(o.profit * 100)} a day after costs, some days more, some less.`, "Buy it", () => act(E.buyBusiness(g, B.id), `${B.icon} The ${B.name.toLowerCase()} is yours.`));
	},
	bizup(b) {
		const g = ui.game, p = me(), biz = p.businesses.find((x) => x.uid === b.dataset.id), B = E.BUSINESS[biz.type];
		confirmBox(`${B.upgrade.name}?`, `${fmt(B.upgrade.price * 100)} for about ${fmt((B.upgrade.rev - B.upgrade.exp) * 100)} more a day.`, "Do it", () => act(E.upgradeBusiness(g, biz.uid), "Upgraded."));
	},
	bizsell(b) {
		const g = ui.game, p = me(), biz = p.businesses.find((x) => x.uid === b.dataset.id), B = E.BUSINESS[biz.type];
		confirmBox(`Sell the ${B.name.toLowerCase()}?`, `A buyer offers ${fmt(E.businessValue(biz))}. It has earned you ${fmt(biz.earned)} so far.`, "Sell it", () => act(E.sellBusiness(g, biz.uid), "Sold."), true);
	},
	stockbuy(b) {
		const g = ui.game, p = me(), c = E.companyBySymbol(g, b.dataset.s);
		const max = Math.floor(p.cash / c.price);
		picker({
			title: `Buy ${esc(c.name)} (${esc(c.id)})`, sub: `$${(c.price / 100).toFixed(2)} a share.`, max,
			quote: (n) => ({ ok: n * c.price <= p.cash, line: n ? `${n} shares for <b>${fmt(n * c.price)}</b>.` : "Pick how many." }),
			confirm: "Buy shares", onConfirm: (n) => act(E.buyStock(g, c.id, n), `Bought ${n} ${c.id}.`),
		});
	},
	stocksell(b) {
		const g = ui.game, p = me(), c = E.companyBySymbol(g, b.dataset.s), have = p.stocks[c.id];
		picker({
			title: `Sell ${esc(c.name)} (${esc(c.id)})`, sub: `You have ${have} shares; you paid ${fmt(p.stockCost[c.id])}.`, max: have, start: have,
			quote: (n) => ({ ok: true, line: n ? `${n} shares for <b>${fmt(n * c.price)}</b>.` : "Pick how many." }),
			confirm: "Sell shares", onConfirm: (n) => act(E.sellStock(g, c.id, n), `Sold ${n} ${c.id}.`),
		});
	},
	indexbuy() {
		const g = ui.game, p = me();
		picker({
			title: "Buy the Everything Index", money: true, max: Math.floor(p.cash / 100) * 100, start: Math.floor(p.cash / 200) * 100,
			quote: (n) => ({ ok: true, line: n ? `Put ${fmt(n)} into every company at once.` : "Pick an amount." }),
			confirm: "Buy", onConfirm: (n) => act(E.buyIndex(g, n), `Put ${fmt(n)} in the index.`),
		});
	},
	indexsell() {
		const g = ui.game, p = me(), v = E.indexValue(g, p);
		picker({
			title: "Sell index fund", money: true, max: v, start: v,
			quote: (n) => ({ ok: true, line: n ? `Sell ${fmt(n)} worth.` : "Pick an amount." }),
			confirm: "Sell", onConfirm: (n) => act(E.sellIndex(g, n), `Sold ${fmt(n)} of the index.`),
		});
	},
	cdbuy() {
		const g = ui.game, p = me();
		picker({
			title: "Open a CD", sub: `${(E.CD_RATE * 100).toFixed(1)}% a year, locked for ${E.CD_TERM} days. $100 minimum.`, money: true, max: Math.floor(p.cash / 100) * 100, start: Math.min(100000, Math.floor(p.cash / 100) * 100),
			quote: (n) => ({ ok: n >= 10000, line: n >= 10000 ? `Lock ${fmt(n)}. After ${E.CD_TERM} days it's ${fmt(Math.floor(n * (1 + (E.CD_RATE * E.CD_TERM) / 365)))}.` : "At least $100." }),
			confirm: "Lock it in", onConfirm: (n) => act(E.buyCD(g, n), "CD opened."),
		});
	},
	cashcd(b) {
		const g = ui.game, p = me(), cd = p.cds[Number(b.dataset.i)];
		const early = g.day - cd.day < E.CD_TERM;
		confirmBox(early ? "Cash out early?" : "Cash out the CD?", early ? `You'd get your ${fmt(cd.amount)} back with no interest.` : `You get ${fmt(E.cdValue(g, cd))}.`, "Cash out", () => act(E.cashCD(g, Number(b.dataset.i)), "CD cashed."), early);
	},
	endtab(b) { ui.endTab = Number(b.dataset.i); render(); },
	ff(b) {
		const g = ui.game, p = g.players[ui.endTab] || g.players[0], years = Number(b.dataset.y);
		ui.ff[p.id] = { years, result: E.fastForward(g, p, years) };
		render();
	},
	replay() {
		const g = ui.game;
		const profiles = load(PROFILE_KEY, []);
		ui.setup = defaultSetup(g.seed);
		ui.setup.days = g.days;
		ui.setup.picked = g.players.map((pl) => profiles.find((x) => x.id === pl.profile)?.id).filter(Boolean);
		if (!ui.setup.picked.length) ui.setup.picked = profiles.length ? [profiles[0].id] : [];
		ui.screen = "setup";
		render();
	},
};

function readSeed() {
	const f = app.querySelector('[data-form="seed"]');
	if (f) ui.setup.seed = f.seed.value.trim().toUpperCase();
}
function confirmBox(title, text, label, onOk, danger = false) {
	openModal(`<h2>${esc(title)}</h2><p>${esc(text)}</p><div class="row end"><button class="btn ghost" data-m="close">Cancel</button><button class="btn ${danger ? "warn" : "go"}" data-m="ok">${esc(label)}</button></div>`, {
		ok: () => { closeModal(); onOk(); },
	});
}
function doEndTurn(to) {
	const g = ui.game;
	const res = E.endTurn(g, to);
	if (res.ok === false) return showToast(res.msg, "bad");
	save();
	beginTurn();
}

app.addEventListener("click", (e) => {
	const b = e.target.closest("[data-act]");
	if (!b || b.disabled) return;
	const fn = actions[b.dataset.act];
	if (fn) fn(b);
});
app.addEventListener("submit", (e) => e.preventDefault());
app.addEventListener("keydown", (e) => {
	if (e.key === "Enter" && e.target.tagName === "INPUT") e.preventDefault();
});

// Debug/test handle (used by scripts/smoke.mjs).
window.__fs = { E, ui, render, actions, game: null };

// Boot: ?seed=XYZ jumps straight to setup with that seed.
const qs = new URLSearchParams(location.search);
if (qs.get("seed")) {
	ui.setup = defaultSetup(qs.get("seed").toUpperCase());
	ui.screen = "setup";
}
render();
