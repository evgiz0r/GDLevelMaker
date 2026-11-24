// node tools/reactive.js <level.gdlvl> [...]   -- spots that need exact hops instead of reactions
//
// The check behind tools/score.js's "reactive" gate, run on a level's SAVED solution (tools/solutions.js:
// the natural replay, one tap per jump, as a player plays it), so it costs no solve. Flags a landing on a
// spot at most 1 block wide that forces the next press within 250 ms, and 3+ hops in a row each forced
// within 250 ms of landing. The user on GDLM 45 v6 (blocks 50-75): "such pattern is awkward, as it
// creates very specific cube jumps I need to do, instead of being able to react". knowledge/checklist.md.
if (require.main === module) require("./heavy.js").claim();   // one heavy job at a time (tools/heavy.js)
const { GD, readGdlvl } = require("./io.js");
const { reactiveSpots } = require("./score.js");
const files = process.argv.slice(2).filter(a => a.endsWith(".gdlvl"));
if (!files.length) { console.log("usage: node tools/reactive.js <level.gdlvl> [...]"); process.exit(1); }
let bad = 0;
for (const f of files) {
  const L = readGdlvl(f), sol = require("./solutions.js").get(L.levelStr);
  if (!sol || !sol.events) { console.log(`${L.name}: no saved solution (node tools/solutions.js ${f})`); continue; }
  const w = GD.makeWorld(L.level.objects, L.level.header);
  const presses = sol.events.filter(e => e.type === "press").map(e => ({ tick: e.tick }));
  const spots = reactiveSpots(L.level, w, { ok: true, events: sol.events }, presses, { natural: true });
  console.log(`${L.name}: ${spots.length ? spots.length + " spot(s) that need exact hops" : "every landing leaves room to react"}`);
  for (const s of spots) console.log(`   block ${s.block}: ${s.why}`);
  if (spots.length) bad++;
}
process.exit(bad ? 2 : 0);
