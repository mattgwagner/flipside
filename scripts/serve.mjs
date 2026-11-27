// Tiny static server for public/ (local play and the smoke test).
// Usage: node scripts/serve.mjs [port]
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../public/", import.meta.url));
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml" };

export function serve(port = 0, host = "127.0.0.1") {
	const server = createServer(async (req, res) => {
		let path = decodeURIComponent(new URL(req.url, "http://x").pathname);
		if (path.endsWith("/")) path += "index.html";
		const file = normalize(join(root, path));
		if (!file.startsWith(root)) return res.writeHead(403).end();
		try {
			const body = await readFile(file);
			res.writeHead(200, { "Content-Type": types[extname(file)] || "application/octet-stream", "Cache-Control": "no-store" }).end(body);
		} catch {
			res.writeHead(404).end("Not here.");
		}
	});
	return new Promise((ok) => server.listen(port, host, () => ok(server)));
}

if (import.meta.url === `file://${process.argv[1]}`) {
	const s = await serve(Number(process.argv[2] || 4870));
	console.log(`Flipside at http://localhost:${s.address().port}`);
}
