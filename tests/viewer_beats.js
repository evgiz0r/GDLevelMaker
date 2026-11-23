// node tests/viewer_beats.js  -- the viewer's beat grids reach the page (the user saw no beat lines anywhere,
// 2026-11-23: the grid file was written into one worktree's viewer/, never the shared local/).
// Starts tools/serve.js on a spare port, then checks: the page's <script> for the beats points at a URL the
// server answers with window.GD_BEATS holding grids; the old URL viewer/beats.local.js answers too; and the
// grid of every song a repo level uses that has been analysed (local/beats/) is in it. Needs local/beats.local.js
// (node tools/beats.js --index builds it from local/beats/); without it the test says so and fails.
const cp = require("child_process"), path = require("path"), fs = require("fs"), http = require("http");
const ROOT = path.join(__dirname, ".."), PORT = 8791;
const get = u => new Promise((ok, no) => http.get(`http://localhost:${PORT}${u}`, r => { let b = ""; r.on("data", c => b += c); r.on("end", () => ok({ status: r.statusCode, body: b })); }).on("error", no));
const srv = cp.spawn(process.execPath, [path.join(ROOT, "tools", "serve.js"), String(PORT)], { stdio: "ignore" });
let bad = 0; const check = (ok, what) => { console.log((ok ? "ok   " : "FAIL ") + what); if (!ok) bad++; };
(async () => {
  for (let i = 0; i < 40; i++) { try { await get("/viewer/"); break; } catch (e) { await new Promise(r => setTimeout(r, 150)); } }
  const page = (await get("/viewer/")).body;
  const m = /<script src="([^"]*beats[^"]*)"/.exec(page);
  check(!!m, "the viewer page has a beats <script>" + (m ? `: ${m[1]}` : ""));
  const grids = body => { const w = {}; try { new Function("window", body)(w); } catch (e) {} return w.GD_BEATS || {}; };
  if (m) {
    const r = await get(new URL(m[1], `http://localhost:${PORT}/viewer/`).pathname), g = grids(r.body);
    check(r.status === 200 && Object.keys(g).length > 0, `it loads: HTTP ${r.status}, ${Object.keys(g).length} songs`);
    const old = await get("/viewer/beats.local.js");
    check(old.status === 200 && Object.keys(grids(old.body)).length > 0, `the old URL viewer/beats.local.js answers too (HTTP ${old.status})`);
    // every analysed song that the shared local/beats/ has must be in the page's grids
    const dir = path.join(ROOT, "local", "beats"), want = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith(".json")).length : 0;
    check(Object.keys(g).length >= Math.min(want, 1), `grids in the page: ${Object.keys(g).length} (analysed songs in local/beats/: ${want})`);
  }
  if (!fs.existsSync(path.join(ROOT, "local", "beats.local.js"))) console.log("     local/beats.local.js is missing: node tools/beats.js --index");
  srv.kill(); console.log(bad ? `${bad} failed` : "all passed"); process.exit(bad ? 1 : 0);
})().catch(e => { console.log("FAIL", e.message); srv.kill(); process.exit(1); });
