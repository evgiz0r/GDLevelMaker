// node tools/latest_rated.js [--pages 4] [--out local/community/latest_rated.json]
// GD's "recently rated" list (the game's Awarded search: the newest star-rated online levels, newest first) via gdbrowser's
// API, 50 per page -> a compact table for the work board's "Latest rated" section (board/README.md), where Evgeni ticks
// levels to study. Metadata only (names, tiers, likes): no level data is downloaded or committed. Self-contained (node's
// https + fs only) so it runs from any checkout. Evgeni (2026-11-25): "latest rated, these are usually good levels".
// Output: {at, source, cols:[...], rows:[[...]]} -- one row per level, in the list's order (newest rated first).
const https = require("https"), fs = require("fs"), path = require("path");
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const PAGES = +arg("--pages", 4);
const OUT = arg("--out", path.join(__dirname, "..", "local", "community", "latest_rated.json"));
const COLS = ["id", "name", "creator", "tier", "stars", "rank", "likes", "downloads", "length", "song", "platformer"];

function getJSON(url) {
  return new Promise((ok, no) => {
    https.get(url, { headers: { "User-Agent": "gdlm-board" } }, r => {
      let s = ""; r.on("data", d => s += d);
      r.on("end", () => { try { ok(JSON.parse(s)); } catch (e) { no(new Error(`${url}: ${r.statusCode} ${s.slice(0, 120)}`)); } });
    }).on("error", no);
  });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rank = l => l.mythic ? "mythic" : l.legendary ? "legendary" : l.epic ? "epic" : l.featured ? "featured" : "rated";

(async () => {
  const rows = [], seen = new Set();
  for (let p = 0; p < PAGES; p++) {
    let L;
    try { L = await getJSON(`https://gdbrowser.com/api/search/*?type=awarded&count=50&page=${p}`); }
    catch (e) { console.error("page", p, e.message); break; }
    if (!Array.isArray(L) || !L.length) break;
    for (const l of L) {
      if (seen.has(String(l.id))) continue; seen.add(String(l.id));
      rows.push([String(l.id), (l.name || "").trim(), l.author || "", l.difficulty || "", +l.stars || 0, rank(l),
        +l.likes || 0, +l.downloads || 0, l.length || "", [l.songName, l.songAuthor].filter(Boolean).join(" / "), l.platformer ? 1 : 0]);
    }
    console.log("page", p, L.length, "levels");
    await sleep(1200);
  }
  if (!rows.length) { console.error("nothing fetched: file left as it was"); process.exit(1); }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const out = { at: new Date().toISOString(), source: "GD Awarded list via gdbrowser.com", cols: COLS, rows };
  fs.writeFileSync(OUT, JSON.stringify(out));
  console.log(rows.length, "levels ->", OUT, Math.round(JSON.stringify(out).length / 1024) + " KB");
})();
