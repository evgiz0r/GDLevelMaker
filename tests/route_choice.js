// node tests/route_choice.js   -- lib/difficulty.js easierRoute: a player takes the easier way
// through when the level has one, and fake "easier" routes are refused. Small built levels, ~15 s.
const { GD } = require("../tools/io.js");
const DF = require("../lib/difficulty.js");

function level(extra) {
  let s = "kA4,0;";
  for (const c of [23, 24, 25]) s += `1,8,2,${c * 30 + 15},3,15;`; // a triple spike: a 46 ms jump
  s += extra + `1,1,2,${44 * 30 + 15},3,-15;`;
  const L = GD.parseLevel(s);
  return GD.makeWorld(L.objects, L.header);
}
let fails = 0;
const check = (name, ok, info) => { console.log(`${ok ? "ok  " : "FAIL"} ${name}: ${info}`); if (!ok) fails++; };

{ // 1. nothing else in the level: the tight jump stays
  const w = level(""), d = DF.difficulty(w, GD.solveAny(w));
  check("lone triple spike keeps its jump", d.rerouted.length === 0 && d.tight === 1, `score ${d.logAttempts.toFixed(3)}, ${d.rerouted.length} swaps`);
}
{ // 2. a jump + a yellow orb onto a platform above the spikes: two easy taps beat one tight jump
  let plat = ""; for (let c = 16; c <= 30; c++) plat += `1,1,2,${c * 30 + 15},3,105;`;
  const w = level(plat + `1,36,2,${13 * 30 + 15},3,75;`), sol = GD.solveAny(w);
  const raw = DF.difficulty(w, sol, { route: false }), d = DF.difficulty(w, sol);
  check("orb route over the spikes is taken", d.rerouted.length === 1 && d.tight === 0 && d.logAttempts < raw.logAttempts - 0.02 && GD.run(w, d.events).done,
    `${raw.logAttempts.toFixed(3)} -> ${d.logAttempts.toFixed(3)}, ${d.rerouted.map(r => r.why).join("; ")}`);
}
{ // 3. jump early, then hold so the cube jumps again on landing: each input alone has a wide window,
  //    but the landing spot hangs on the first jump, so together they are as tight as the old jump
  const w = level(`1,36,2,${16 * 30 + 15},3,45;`), d = DF.difficulty(w, GD.solveAny(w));
  check("early jump + buffered landing jump is refused", d.rerouted.length === 0, `score ${d.logAttempts.toFixed(3)}, ${d.rerouted.map(r => r.why).join("; ") || "no swaps"}`);
}
{ // 4. joint chance of the lone jump agrees with its window (46 ms at sigma 13: p = 0.92)
  const w = level(""), cost = DF.jointCost(w, [{ tick: 515, type: "press" }, { tick: 539, type: "release" }], 0, 2000, 13);
  const want = -Math.log10(DF.hitChance(45.83, 13));
  check("joint chance matches the window", Math.abs(cost - want) < 0.015, `${cost.toFixed(3)} vs ${want.toFixed(3)}`);
}
if (fails) { console.log(`${fails} failed`); process.exit(1); }
