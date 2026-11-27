// node tools/genroute.js <dir of genroute docs> [--out <dir>]
// The path of a 🎲 generated piece (Evgeni 2026-11-27: "its generated with a path? show it, or give a button to see").
// The catalogue page can't solve, so each piece he generates is queued in the artifact's db collection "genroute"
// ({gen, key, seed, cols, tier, map, mode, state: "asked"}). Fetch them (ArtifactData list genroute, out_dir), run this:
// it solves every "asked" doc with tools/layoutcheck.js check() -- the same check as the board's 〰 solver path -- and
// writes <out>/<doc id>.json ({state: "done", ok, presses, label, tight, route, taps | dieCol, why}); then ArtifactData
// update each doc from its file (file_path), and the page draws the route. WORKBOOKS.md "genroute".
if (require.main === module) require("./heavy.js").claim();
const fs = require("fs"), path = require("path");
const LC = require("./layoutcheck.js");

function solveDoc(d) {
  const z = { key: d.key, name: d.key, mode: d.mode || "cube", map: d.map };
  const c = LC.check(z), out = { state: "done", solvedAt: new Date().toISOString(), ok: !!c.ok };
  if (c.ok) Object.assign(out, { presses: c.presses, label: c.label || "", tight: c.tight || [], route: c.route || [], taps: c.taps || [] });
  else Object.assign(out, { dieCol: c.dieCol, why: c.why || "" });
  return out;
}

if (require.main === module) {
  const a = process.argv.slice(2), dir = a[0], oi = a.indexOf("--out"), out = oi >= 0 ? a[oi + 1] : path.join(dir, "..", "genroute_done");
  if (!dir) { console.log("usage: node tools/genroute.js <dir of genroute docs> [--out <dir>]"); process.exit(1); }
  fs.mkdirSync(out, { recursive: true });
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith(".json"))) {
    const d = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    if (d.state !== "asked" || !Array.isArray(d.map)) continue;
    const t = Date.now(), r = solveDoc(d);
    fs.writeFileSync(path.join(out, f), JSON.stringify(r));
    console.log(`${f.replace(/\.json$/, "")}: ${r.ok ? r.presses + " presses, " + r.label : "does not solve (col " + r.dieCol + "): " + r.why}  [${((Date.now() - t) / 1000).toFixed(0)} s]`);
  }
  console.log("-> " + out);
}
module.exports = { solveDoc };
