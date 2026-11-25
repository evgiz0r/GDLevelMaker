// node tools/restage.js <level.gdlvl> --session <name>
//
// Gives an existing build's path / deco / final stages (local/wip/<session>/<base>.stages/) their own working route as
// data.events, from the level's saved solution (tools/solutions.js): the viewer replays a stage's own route, and builds
// before 2026-11-25 stored only the patterns' intended presses on "path" (GDLM 72: the second jump 0.6 s late, dead at
// x 478) and nothing on deco / final. Each stage's level is replayed with the route before it is attached; a stage the
// route does not clear keeps what it had and is named. compose.js does this itself for new builds.
"use strict";
if (require.main === module) require("./heavy.js").claim();
const fs = require("fs"), path = require("path");
const io = require("./io.js"), GD = io.GD, ST = require("./stages.js"), SOL = require("./solutions.js");

function restage(file, session) {
  const L = io.readGdlvl(file), base = path.basename(file, ".gdlvl"), dir = ST.dirOf(session, base);
  const sol = SOL.get(L.levelStr, true);
  if (!sol || !sol.ok || !sol.events) return { ok: false, why: "no saved solution for " + file + " (run tools/solutions.js on it)" };
  const idx = JSON.parse(fs.readFileSync(path.join(dir, "index.json"), "utf8")), out = [];
  const planned = sol.events.filter(e => e.type === "press").map(e => ({ t: +(e.tick / 240).toFixed(3), what: "jump" }));
  for (const name of ["path", "deco", "final"]) {
    const s = idx.stages.find(x => x.stage === name), f = path.join(dir, name + ".gdlvl");
    if (!s || !fs.existsSync(f)) { out.push(`${name}: no stage`); continue; }
    const SL = io.readGdlvl(f), w = GD.makeWorld(SL.level.objects, SL.level.header);
    let ok = false; try { ok = !!GD.run(w, sol.events).ok; } catch (e) {}
    if (!ok) { out.push(`${name}: the route does not clear this stage's level, left as it was`); continue; }
    s.data = Object.assign({}, s.data || {}, { events: sol.events, planned }, s.data && s.data.planned && name === "path" ? { intended: s.data.intended || s.data.planned } : {});
    out.push(`${name}: route attached (${planned.length} presses)`);
  }
  fs.writeFileSync(path.join(dir, "index.json"), JSON.stringify(idx));
  return { ok: true, lines: out };
}
module.exports = { restage };

if (require.main === module) {
  const a = process.argv.slice(2), si = a.indexOf("--session"), file = a.find(x => x.endsWith(".gdlvl"));
  if (!file || si < 0) { console.log("usage: node tools/restage.js <level.gdlvl> --session <name>"); process.exit(1); }
  const r = restage(file, a[si + 1]);
  if (!r.ok) { console.log(r.why); process.exit(2); }
  for (const l of r.lines) console.log(l);
}
