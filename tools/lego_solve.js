// node tools/lego_solve.js official:N [official:M ...] [--min 0.85] [--no-full]
// Does the reverse lego help the solver? (Evgeni, 2026-11-25: "do we plan to somehow use the structures and the info in
// the solver?") For each level: match the catalogue's bricks into it (tools/lego_match.js; the level's own bricks left
// out, so it is a fair test), then solve three ways and time them:
//   plain  -- tools/presslib.js solveWithLib with an empty library: no guess at all, every stretch found by local search
//   lego   -- the same, but inside each matched stretch the button follows the matched brick's own clicks
//   full   -- GD.solveSweep, the solver's normal whole-level search (--no-full skips it)
// Prints clear / stuck, presses, repairs and seconds per way. Results go to knowledge/lego_solve.json (numbers only).
"use strict";
if (require.main === module) require("./heavy.js").claim();
const fs = require("fs"), path = require("path");
const { GD } = require("./io.js");
const L = require("./lego.js"), M = require("./lego_match.js"), PL = require("./presslib.js");
const ROOT = path.join(__dirname, "..");

function levelOf(arg) {
  const n = +/^official:(\d+)$/.exec(arg)[1];
  const j = JSON.parse(fs.readFileSync(path.join(ROOT, "local", `official_${String(n).padStart(2, "0")}.json`), "utf8"));
  const level = GD.parseLevel(j.level);
  return { n, name: `${n} ${j.name}`, level, w: GD.makeWorld(level.objects, level.header) };
}

if (require.main === module) {
  const A = process.argv.slice(2), opt = (k, d) => { const i = A.indexOf("--" + k); return i >= 0 ? A[i + 1] : d; };
  const all = L.load().filter(p => p.grain === "brick" && p.verified && !p.dupOf && !p.empty && !p.auto && !p.jitter);
  const out = [];
  for (const a of A.filter(x => /^official:\d+$/.test(x))) {
    const lv = levelOf(a), bricks = all.filter(p => !p.level.startsWith(lv.n + " "));
    const hints = M.hintsFor(lv.level, bricks, { min: +opt("min", 0.85) });
    const cover = hints.reduce((s, h) => s + (h.x1 - h.x0), 0) / Math.max(1, lv.w.endX / 30);
    const row = { level: lv.name, hints: hints.length, cover: Math.round(cover * 100) };
    for (const [k, h] of [["plain", null], ["lego", hints]]) {
      const r = PL.solveWithLib(PL.emptyLib(), lv.w, 0.3, { hints: h });
      row[k] = { ok: r.ok, presses: r.events.filter(e => e.type === "press").length, repairs: r.repairs, s: Math.round(r.ms / 100) / 10, dieBlock: r.ok ? null : Math.round(r.dieX / 3) / 10 };
    }
    if (!A.includes("--no-full")) { const t0 = Date.now(), f = GD.solveSweep(lv.w); row.full = { ok: !!(f && f.ok), s: Math.round((Date.now() - t0) / 100) / 10 }; }
    const f = x => x ? `${x.ok ? "clears" : "stuck" + (x.dieBlock != null ? " at " + x.dieBlock : "")} ${x.s} s` + (x.repairs != null ? ` (${x.repairs} repairs, ${x.presses} presses)` : "") : "-";
    console.log(`${row.level}: ${row.hints} matched bricks over ${row.cover}% of the level | plain ${f(row.plain)} | lego ${f(row.lego)} | full ${f(row.full)}`);
    out.push(row);
  }
  const file = path.join(ROOT, "knowledge", "lego_solve.json");
  let old = []; try { old = JSON.parse(fs.readFileSync(file, "utf8")).rows || []; } catch (e) {}
  const rows = old.filter(r => !out.some(o => o.level === r.level)).concat(out);
  fs.writeFileSync(file, JSON.stringify({ about: "tools/lego_solve.js: solve time with and without reverse-lego hints", when: new Date().toISOString().slice(0, 10), rows }, null, 1) + "\n");
}
