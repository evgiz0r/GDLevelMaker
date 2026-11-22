// node tools/inputs.js <level.gdlvl> [--natural]  -- the solved run's inputs, with where (block, row)
// and in which mode each one happens, and when the mode changes. --natural: lib/natural.js's plan.
// Use it to see how the solver plays a level (long holds, empty jumps, sliding) before judging it.
const { GD, readGdlvl } = require("./io.js");
Object.assign(GD, require("../lib/natural.js"));
const file = process.argv[2];
if (!file) { console.log("usage: node tools/inputs.js <level.gdlvl> [--natural]"); process.exit(1); }
const L = readGdlvl(file);
const w = GD.makeWorld(L.level.objects, L.level.header);
const r = GD.solveAny(w);
if (!r.ok) { console.log("not beatable: dies at block " + (r.dieAt.x / 30).toFixed(1) + " (" + r.why + ")"); process.exit(2); }
let events = r.events;
if (process.argv.includes("--natural")) events = GD.naturalPlan(w, r, L.level.objects).events;
const path = GD.run(w, events).path;
let m = null;
const marks = [];
for (let t = 0; t < path.length; t++) if (path[t].mode !== m) { m = path[t].mode; marks.push({ t, line: `-- ${m} from block ${(path[t].x / 30).toFixed(1)}` }); }
for (const e of events) { const s = path[Math.min(e.tick, path.length - 1)]; marks.push({ t: e.tick + 0.5, line: `${e.type.padEnd(8)} ${(e.tick / GD.PHYS.TPS).toFixed(3)} s  block ${(s.x / 30).toFixed(1)}  row ${(s.y / 30 - 0.5).toFixed(1)}  ${s.mode}` }); }
marks.sort((a, b) => a.t - b.t).forEach(x => console.log(x.line));
let jumps = 0; for (let t = 1; t < path.length; t++) if (path[t].mode === "cube" && path[t].act === "jump" && path[t].vy > 5 && path[t - 1].vy <= 0.5) jumps++;
console.log(`${events.filter(e => e.type === "press").length} presses, ${jumps} cube jumps, ${(path.length / GD.PHYS.TPS).toFixed(1)} s`);
