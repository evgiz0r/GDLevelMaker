// node tools/sketchshot.js <sketch.json> [--fit] [--out file.png] [--view sketch|level|both] [--w 2600] [--x0 a --x1 b]
// A picture of a whiteboard sketch (DRAW.md) as the board draws it: the whole sketch fitted into one wide frame, the
// strokes ("sketch") and/or what they become as GD objects ("level"). Headless, muted, the page served from disk.
// --fit: the layout fitter's result (lib/sketchfit.js): the built level, the replayed path, its changes (~ / ✕).
// Default out: local/shots/sketch_<id>_<view>.png. For looking at a sketch the user drew before building from it.
const { chromium } = require("playwright"), fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, ".."), A = process.argv.slice(2);
const opt = (k, d) => { const i = A.indexOf("--" + k); return i >= 0 ? A[i + 1] : d; };
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json" };
(async () => {
  const file = A.find(a => !a.startsWith("--") && /\.json$/.test(a)); if (!file) { console.log("usage: node tools/sketchshot.js <sketch.json> [--out f.png] [--view sketch|level|both]"); process.exit(1); }
  let sk = JSON.parse(fs.readFileSync(file, "utf8")); sk = sk.data || sk; let check = null;
  if (A.includes("--fit")) {
    const F = require("../lib/sketchfit.js"), G = Object.assign({}, require("../lib/gd.js"), require("../lib/objects.js"), require("../lib/physics.js")), SK = require("../lib/sketch.js");
    const r = F.fit(sk), lv = SK.convert(r.sketch), q = G.run(G.makeWorld(lv.play, lv.header), r.events);
    sk = JSON.parse(JSON.stringify(r.sketch, (k, v) => k === "src" ? undefined : v));
    check = { plan: { path: q.path.filter((s, i) => i % 3 === 0).map(s => ({ x: s.x, y: s.y })), dead: q.dead, why: q.why, x: q.end.x, y: q.end.y }, changes: r.changes, lines: [] };
    console.log((r.clear ? "clears" : "dies at block " + (r.dieX / 30).toFixed(1) + " (" + r.why + ")") + ", " + r.changes.length + " changes");
  }
  const views = opt("view", "both") === "both" ? ["sketch", "level"] : [opt("view")];
  let x0 = 1e9, x1 = -1e9, y1 = 60;
  for (const it of sk.items) for (const [x, y] of it.pts || [[it.x, it.y]]) { if (x == null) continue; x0 = Math.min(x0, x); x1 = Math.max(x1, it.x1 || x); if (it.k === "stroke") y1 = Math.max(y1, y); }
  for (const it of sk.items) if (it.k === "stamp" && it.y < y1 + 200) y1 = Math.max(y1, it.y);   // a stray stamp far above does not shrink the picture
  x0 = +opt("x0", Math.min(-30, x0 - 30)); x1 = +opt("x1", x1 + 60);
  const W = +opt("w", 2600), z = W / (x1 - x0), H = Math.round((y1 + 140) * z + 46 + 40);
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await p.route("http://draw.test/**", r => {
    const f = path.join(ROOT, decodeURIComponent(new URL(r.request().url()).pathname));
    if (!f.startsWith(ROOT) || !fs.existsSync(f)) return r.fulfill({ status: 404, body: "" });
    r.fulfill({ status: 200, body: fs.readFileSync(f), contentType: TYPES[path.extname(f)] || "application/octet-stream" });
  });
  await p.goto("http://draw.test/viewer/draw.html?mute=1"); await p.waitForTimeout(300);
  await p.evaluate(s => { DRAW.setItems(s.items); if (s.speed != null) DRAW.sketch.speed = s.speed; if (s.song) DRAW.sketch.song = s.song; }, sk);
  if (check) await p.evaluate(c => DRAW.setCheck(c), check);
  const out = [];
  for (const v of views) {
    await p.evaluate(([v, x0, z]) => { if (DRAW.ui.view !== v) document.getElementById("viewBtn").click(); DRAW.V.z = z; DRAW.V.x = x0; DRAW.V.y = -40 / z; }, [v, x0, z]);
    await p.waitForTimeout(200);
    const f = views.length > 1 || !opt("out") ? (opt("out") || path.join(ROOT, "local/shots", "sketch_" + (sk.id || "x"))).replace(/\.png$/, "") + "_" + v + ".png" : opt("out");
    fs.mkdirSync(path.dirname(f), { recursive: true });
    const box = await p.locator("#cv").boundingBox(); await p.screenshot({ path: f, clip: box }); out.push(f);
  }
  await b.close(); console.log(out.join("\n"));
})();
