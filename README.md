# Flipside

A buy-low/sell-high trading game for 1–4 players on one keyboard. Ride the bus
between six neighborhoods, flip sneakers and trading cards, dodge Fast Eddie's
interest, then buy businesses and stocks. Spec: issue #2.

Live: https://flipside.mattgwagner.workers.dev

- `public/engine.js`: the whole game as pure, seeded rules (no DOM). Money is integer cents.
- `public/ui.js` + `style.css`: the DOM front end. Every action is a button; Enter never confirms.
- `npm start`: local server on http://localhost:4870
- `npm run sim`: headless fuzz (invariants) + balance report. `--games N`, `--out report.md`
- `npm run smoke`: Playwright plays full games through the UI (needs `~/Code/readerful` Playwright and `/usr/bin/chromium`)
- `npm run deploy`: `npx wrangler deploy` (assets-only Worker; pushing does not deploy)
- `docs/balance.md`: last balance report (`npm run sim -- --games 300 --out docs/balance.md`)
