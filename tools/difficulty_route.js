// node tools/difficulty_route.js <n | file.gdlvl | community-id> ...   -- the score of a level with the
// solver's route and with the player's route (lib/difficulty.js easierRoute: tight inputs swapped for
// an easier way through when the level has one), and every swap it made. Official n reads the saved
// solution local/difficulty/NN.json (tools/difficulty_solve.js); a community id reads
// local/community/<id>.gdlvl and its solution from local/difficulty/community/<id>.json if saved.
const fs = require("fs"), path = require("path");
const { GD, readGdlvl, unpack } = require("./io.js");
const DF = require("../lib/difficulty.js");
const { SRC, OUT } = require("./difficulty_solve.js");

function load(arg) {
  if (/^\d+$/.test(arg) && +arg <= 30) {
    const L = GD.parseLevel(unpack(fs.readFileSync(path.join(SRC, arg + ".txt"), "utf8")));
    const sol = JSON.parse(fs.readFileSync(path.join(OUT, arg.padStart(2, "0") + ".json"), "utf8"));
    return { name: "official " + arg, w: GD.makeWorld(L.objects, L.header), sol: sol.ok ? sol : { events: sol.events } };
  }
  const file = arg.endsWith(".gdlvl") ? arg : path.join(__dirname, "..", "local", "community", arg + ".gdlvl");
  const r = readGdlvl(file), w = GD.makeWorld(r.level.objects, r.level.header);
  const saved = path.join(OUT, "community", path.basename(file, ".gdlvl") + ".json");
  const sol = fs.existsSync(saved) ? JSON.parse(fs.readFileSync(saved, "utf8")) : GD.solveAny(w);
  return { name: path.basename(file), w, sol };
}

for (const arg of process.argv.slice(2)) {
  const { name, w, sol } = load(arg);
  const t0 = Date.now();
  const a = DF.difficulty(w, sol, { route: false });
  const t1 = Date.now();
  const b = DF.difficulty(w, sol, { debug: process.env.DEBUG ? m => console.log(m) : null });
  const t2 = Date.now();
  const f = d => `score ${d.logAttempts.toFixed(2)}, per min ${d.perMinute.toFixed(2)}, tight ${d.tight}, tightest ${Math.round(d.tightest)} ms`;
  console.log(`${name}${a.complete ? "" : " (partial: rerouting needs a finished route)"}`);
  console.log(`  solver route: ${f(a)}  (${((t1 - t0) / 1000).toFixed(0)} s)`);
  console.log(`  player route: ${f(b)}  (${((t2 - t1) / 1000).toFixed(0)} s)`);
  for (const r of b.rerouted) console.log(`    block ${(r.x / 30).toFixed(1)}: ${Math.round(r.was)} ms input -> ${r.why} (-${r.gain} in log10 attempts)`);
}
