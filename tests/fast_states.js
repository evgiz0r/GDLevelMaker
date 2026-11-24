// node tests/fast_states.js  -- sim states stay "fast" objects. On V8 (node 22) Object.assign({}, state) of a 20+ field
// state makes a dictionary-mode object: 5.8 us a copy and slow field reads in every step, where { ...state } keeps the
// fast shape (64 ns). Every solver, window measure and replay copies states, so one slow copy anywhere slowed all of
// them 2-5x (GDLM 41's whole solve 9.0 s -> 1.6 s once fixed, 2026-11-23; PHYSICS.md "Incremental solving").
// Checks: (1) no `Object.assign({}, <state>)` copy in lib/ or tools/; (2) the states a replay and the copy helpers
// make are fast objects (V8's own test, so this re-runs itself with --allow-natives-syntax). A few ms.
const fs = require("fs"), path = require("path"), ROOT = path.join(__dirname, "..");
if (!process.execArgv.includes("--allow-natives-syntax")) {
  const r = require("child_process").spawnSync(process.execPath, ["--allow-natives-syntax", __filename], { stdio: "inherit", windowsHide: true });
  process.exit(r.status === null ? 1 : r.status);
}
let fail = 0;
const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) fail++; };
// (1) the pattern, on names that hold a state (s, st, s0, state, a path entry, a search node's s)
const STATE = /Object\.assign\(\{\},\s*(s|st|s0|state|n\.s|path\[[^\]]*\]|p\[[^\]]*\])\s*\)/;
for (const dir of ["lib", "tools"]) for (const f of fs.readdirSync(path.join(ROOT, dir)).filter(f => f.endsWith(".js"))) {
  fs.readFileSync(path.join(ROOT, dir, f), "utf8").split(/\r?\n/).forEach((l, i) => {
    if (STATE.test(l.replace(/\/\/.*$/, ""))) ok(false, `${dir}/${f}:${i + 1} copies a state with Object.assign({}, ...): use { ...s }`);
  });
}
// (2) V8's own verdict on real states
const isFast = new Function("o", "return %HasFastProperties(o)");
const { GD, readGdlvl } = require("../tools/io.js");
Object.assign(GD, require("../lib/difficulty.js"));
const L = readGdlvl(path.join(ROOT, "levels", "gdlm_45_first_flight.gdlvl"));   // modes and triggers: the most fields
const w = GD.makeWorld(L.level.objects, L.level.header);
const r = GD.run(w, [{ tick: 40, type: "press" }, { tick: 44, type: "release" }]);
const slow = r.path.filter(s => s && !isFast(s)).length;
ok(slow === 0, `replay states fast (${r.path.length - slow} of ${r.path.length})`);
const s = r.path[r.path.length - 1];
ok(isFast(GD.cloneState(s)), "difficulty.js cloneState keeps it fast");
console.log(fail ? fail + " failed" : "all ok");
process.exit(fail ? 1 : 0);
