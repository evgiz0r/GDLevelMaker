// node tests/runcache.js  -- lib/runcache.js gives exactly GD.run's answer (~30 s; no solving, replays only)
// On repo levels with a saved route (tools/solutions.js cache: cube, ship/wave, dual GDLM 63), runs the route and
// many edits of it (a press dropped, a tap moved a few ticks, a tap added, a hold cut), in an order that keeps the
// cache warm, cached and plain, and compares end, death, killer and every state of the path.
const assert = require("assert"), path = require("path");
const GD = require("../lib/physics.js"), { readGdlvl } = require("../tools/io.js"), sols = require("../tools/solutions.js");
require("../lib/runcache.js").installRunCache(GD);
const plain = GD.run.plain;
const LEVELS = ["gdlm_63_dual_and_movers_lab", "gdlm_44_hellgate", "gdlm_45_first_flight", "gdlm_41_classic"];
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
let rng = 12345; const rnd = n => { rng = (rng * 1103515245 + 12345) & 0x7fffffff; return rng % n; };
let tested = 0, levels = 0, plainMs = 0, cachedMs = 0;
for (const name of LEVELS) {
  const lv = readGdlvl(path.join(__dirname, "..", "levels", name + ".gdlvl")), sol = sols.get(lv.levelStr, true);
  if (!sol || !sol.events || !sol.events.length) { console.log("skip", name, "(no saved route)"); continue; }
  levels++;
  const L = GD.parseLevel ? GD.parseLevel(lv.levelStr) : require("../lib/gd.js").parseLevel(lv.levelStr);
  const w = GD.makeWorld(L.objects, L.header), base = sol.events.map(e => ({ ...e }));
  const variants = [base];
  for (let k = 0; k < 40; k++) {
    const ev = base.map(e => ({ ...e })), i = rnd(ev.length), kind = k % 4;
    if (kind === 0) ev.splice(i, 1);
    else if (kind === 1) ev[i].tick += rnd(7) - 3;
    else if (kind === 2) { const t = ev[i].tick + 20 + rnd(30); ev.push({ tick: t, type: "press" }, { tick: t + 14, type: "release" }); ev.sort((a, b) => a.tick - b.tick); }
    else { const j = ev.findIndex((e, n) => n >= i && e.type === "release"); if (j > 0) ev[j].tick = Math.max(ev[j - 1].tick + 1, ev[j].tick - 5); }
    variants.push(ev, base);   // back to the route between edits: the cache's usual pattern
  }
  for (const ev of variants) {
    let t0 = Date.now(); const p = plain(w, ev); plainMs += Date.now() - t0;
    t0 = Date.now(); const c = GD.run(w, ev); cachedMs += Date.now() - t0;
    assert.strictEqual(c.dead, p.dead, name); assert.strictEqual(c.done, p.done, name); assert.strictEqual(c.why, p.why, name);
    assert.strictEqual(c.killer, p.killer, name + ": killer");
    assert(same(c.end, p.end), name + ": end state");
    assert.strictEqual(c.path.length, p.path.length, name + ": path length");
    for (let t = 0; t < p.path.length; t++) if (!same(c.path[t], p.path[t])) assert.fail(`${name}: state at tick ${t} differs`);
    tested++;
  }
}
assert(levels >= 1, "no level with a saved route to test on");
console.log(`runcache: ok (${tested} runs on ${levels} levels; plain ${plainMs} ms, cached ${cachedMs} ms)`);
