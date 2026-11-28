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
  // EXTRAS (pads, orbs, ...: tools/sectiongen.js opts.extras) need the sim, which the page lacks: the piece is made again
  // here with them (same key, seed, length, tier, rows, beat), and its map goes back as `xmap` for the page to draw
  let x = null;
  if (d.extras && Object.keys(d.extras).length) { const SG = require("./sectiongen.js"), log = console.log; console.log = () => {};
    try { const r = SG.make(d.key, { cols: d.cols, seed: d.seed, tier: d.tier, rows: d.rows || undefined, ...(d.beats ? { beats: d.beats } : d.bpm ? { bpm: d.bpm } : {}), extras: d.extras, replay: true });
      x = { xmap: r.map, xcount: Object.fromEntries(Object.keys(d.extras).map(k => [k, +(r[k] || 0)])) }; d = Object.assign({}, d, { map: r.map, presses: r.presses || d.presses, mode: r.mode || d.mode }); }
    catch (e) { x = { xmap: null, xerr: e.message }; } finally { console.log = log; } }
  const z = { key: d.key, name: d.key, mode: d.mode || "cube", map: d.map };
  const c = LC.check(z), out = { state: "done", solvedAt: new Date().toISOString(), ok: !!c.ok };
  if (c.ok) Object.assign(out, { presses: c.presses, label: c.label || "", tight: c.tight || [], route: c.route || [], taps: c.taps || [] });
  else Object.assign(out, { dieCol: c.dieCol, why: c.why || "" });
  // the REAL replay of the piece's planned presses (Evgeni 2026-11-28: "solver path through spikes, we dont replay once
  // with real physics?"): the page draws this line instead of the generator's own sketch of the path
  if (Array.isArray(d.presses) && d.presses.length) { try { const r = LC.planCheck(Object.assign({}, z, { presses: d.presses }));
    out.real = { ok: !!r.ok, path: r.path || [], dieCol: r.dieCol, why: r.why || "" }; } catch (e) { out.real = { ok: false, path: [], why: "replay failed: " + e.message }; } }
  return x ? Object.assign(out, x) : out;
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
