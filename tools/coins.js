// node tools/coins.js plans [n ...]   -- gdsolver's real-game ALL-COINS plans (local/gdsolver/solution_lvN_coins.txt,
//   copied from github.com/gdsolver/gdsolver data/, MIT, never committed) played through our sim: coins collected, where
//   it dies. Where it clears with every coin, our sim agrees with GD on that route (a free coin route to plan from).
// node tools/coins.js status [n ...]  -- the saved coin routes (local/difficulty/NN.coins.json, the raw solve;
//   local/official_NN_coins.json, the viewer's human route): coins each takes on today's sim, whether it clears.
// The main levels' secret coins (id 142): lib/physics.js collects them into s.coins by touch; a world with needCoins
// makes passing a coin without it a dead end, so the solver's routes take every coin. PHYSICS.md "Coins".
// RobTop's levels: local/ only.
if (require.main === module) require("./heavy.js").claim();
const fs = require("fs"), path = require("path");
const { GD } = require("./io.js");
const ROOT = path.join(__dirname, "..");
const tag = n => String(n).padStart(2, "0");
const readJ = f => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { return null; } };

function plans(ns) {
  const { replay } = require("./tas.js");
  const out = [];
  for (const n of ns) {
    if (!fs.existsSync(path.join(ROOT, "local", "gdsolver", `solution_lv${n}_coins.txt`))) { console.log(`${n}: no coins plan`); continue; }
    const r = replay(n, 0, "coins"), e = r.r.end, total = GD.coinList(r.w).length;
    const got = GD.coinCount(e), pct = Math.min(100, GD.progressX ? GD.progressX(e) / r.w.endX * 100 : e.x / r.w.endX * 100);
    out.push({ n, total, got, done: r.done, pct: +pct.toFixed(1), why: r.why });
    console.log(`${n}: ${r.done ? "CLEARS" : `dies at ${pct.toFixed(1)}% (${r.why})`} with ${got}/${total} coins`);
  }
  return out;
}

function status(ns) {
  const ds = require("./difficulty_solve.js");
  for (const n of ns) {
    const L = GD.parseLevel(ds.levelText(n)), w = GD.makeWorld(L.objects, L.header), total = GD.coinList(w).length;
    const raw = readJ(path.join(ROOT, "local", "difficulty", tag(n) + ".coins.json")), view = readJ(path.join(ROOT, "local", `official_${tag(n)}_coins.json`));
    const play = ev => { if (!ev) return "none"; const q = GD.run(w, ev), e = q.end || q.path[q.path.length - 1];
      return `${q.done ? "clears" : "dies " + (Math.min(100, (GD.progressX ? GD.progressX(e) : e.x) / w.endX * 100)).toFixed(1) + "%"} ${GD.coinCount(e)}/${total}`; };
    console.log(`${String(n).padStart(2)} coins ${total}  raw ${play(raw && raw.events)}  route ${play(view && view.solution && view.solution.events)}`);
  }
}

module.exports = { plans, status };
if (require.main === module) {
  const a = process.argv.slice(2), ns = a.filter(x => /^\d+$/.test(x)).map(Number), list = ns.length ? ns : Array.from({ length: 22 }, (_, i) => i + 1);
  if (a[0] === "plans") plans(list);
  else if (a[0] === "status") status(list);
  else { console.log(fs.readFileSync(__filename, "utf8").split("\n").slice(0, 6).join("\n")); process.exit(1); }
}
