// node tests/incsolve.js [--quick]  -- incremental solving (lib/incsolve.js, PHYSICS.md "Incremental solving")
//   quick part (no search): states compare equal across a reordered object list, checkpoints are small and
//     replay exactly, an edit's x range is found, a decoration-only edit keeps the route, a level re-solves
//     entirely from its own cached sections, a cut level reuses its cached sections up to the cut
//   full part (claims the heavy-job slot, ~1-2 min): one-spot edits of GDLM 41 re-solved incrementally
//     finish the level, skip nothing, and cost what a full solve costs (humanCost within EPS)
if (!process.argv.includes("--quick")) require("../tools/heavy.js").claim();
const path = require("path");
const { GD, readGdlvl } = require("../tools/io.js");
const I = require("../lib/incsolve.js").incsolve;
let fail = 0;
const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) fail++; };
const lvl = f => readGdlvl(path.join(__dirname, "..", "levels", f));
const memStore = () => { const m = new Map(); return { get: k => m.get(k), put: r => { if (!m.has(r.key)) m.set(r.key, []); m.get(r.key).push(r); } }; };
const noSearch = () => ({ ok: false, why: "no search in the quick test" });
// a route for a level: the saved one when it still finishes, else a solve (only cube levels here: seconds)
function route(L) {
  const w = GD.makeWorld(L.level.objects, L.level.header);
  let s = null; try { s = require("../tools/solutions.js").get(L.levelStr, true); } catch (e) { /* none */ }
  if (s && s.ok && I.finishes(w, GD.run(w, s.events))) return s.events;
  const r = GD.solveAny(w); return r.ok ? r.events : null;
}

const L = lvl("gdlm_41_classic.gdlvl"), w = GD.makeWorld(L.level.objects, L.level.header), ev = route(L);
ok(!!ev, "GDLM 41 has a route");
const p = GD.run(w, ev).path;
// states across a reordered object list
const w2 = GD.makeWorld(L.level.objects.slice().reverse(), L.level.header), p2 = GD.run(w2, ev).path;
const ck = I.checkpoints(w, ev, p);
ok(ck.length >= 10 && ck.every(([t, h, c]) => I.sameState(I.canon(w2, p2[t]), c)), "checkpoints (" + ck.length + ", " + JSON.stringify(ck).length + " bytes) equal on a reordered copy");
ok(!I.sameState(I.canon(w, p[ck[3][0]]), ck[4][2]), "different ticks are different states");
// a checkpoint state restores exactly: replaying the rest from it gives the same end
const [tc] = ck[5], rest = I.runFrom(w, p[tc], I.heldBefore(ev, tc), ev.filter(e => e.tick >= tc));
ok(rest.end.done && rest.end.tick === p[p.length - 1].tick, "replaying from a checkpoint ends where the whole run does");
// an edit's range
const objs = L.level.objects.map(o => Object.assign({}, o, { props: Object.assign({}, o.props) }));
const k = objs.findIndex(o => GD.objInfo(o.id).kind === "hazard" && o.x > 1500);
objs[k].x += 30; objs[k].props["2"] = String(objs[k].x);
const wE = GD.makeWorld(objs, L.level.header), d = I.diffObjects(L.level.objects, objs), inf = I.influence(w, wE, d, L.level.header, L.level.header);
ok(d.removed.length === 1 && d.added.length === 1 && inf.xa <= objs[k].x - 30 && inf.xb >= objs[k].x + 30, "moved spike: range " + inf.xa + ".." + inf.xb);
// decoration only
const decoId = Object.keys(GD.OBJECTS || {}).map(Number).find(id => GD.objInfo(id).kind === "decoration");
if (decoId) {
  const o2 = L.level.objects.concat([{ id: decoId, x: 905, y: 400, rot: 0, flipX: false, flipY: false, props: { 1: String(decoId), 2: "905", 3: "400" } }]);
  const wd = GD.makeWorld(o2, L.level.header), inf2 = I.influence(w, wd, I.diffObjects(L.level.objects, o2), L.level.header, L.level.header);
  const r = I.resolve(wd, { events: ev, checkpoints: ck }, inf2);
  ok(inf2.none && r.ok && r.reused === "whole", "decoration-only edit keeps the whole route (" + r.ms + " ms)");
}
// sections: the same level again comes entirely from the cache
const st = memStore(), recs = I.cacheRoute(w, ev, p, st);
const again = I.solveWithCache(GD.makeWorld(L.level.objects, L.level.header), st, { solve: noSearch });
ok(again.ok && again.reused === recs.length && I.finishes(w, GD.run(w, again.events)), "re-solve from " + recs.length + " cached sections, no search (" + again.ms + " ms)");
// a cut: the level up to a section boundary + its end; sections before the cut come from the cache
const secs = I.sectionsOf(w, ev, p), cutX = p[secs[Math.floor(secs.length / 2)].from].x;
const cutObjs = L.level.objects.filter(o => o.x < cutX - 60 || GD.objInfo(o.id).kind === "decoration");
const wc = GD.makeWorld(cutObjs, L.level.header), cr = I.solveWithCache(wc, st, { solve: noSearch });
ok(cr.reused >= Math.floor(recs.length / 2) - 1, "cut level: " + cr.reused + " of " + Math.floor(recs.length / 2) + " sections before the cut reused before the first search");

if (!process.argv.includes("--quick")) {
  const T = require("../tools/incsolve.js"), EPS = 0.02;
  const rand = T.rng(7);
  for (let n = 0; n < 3; n++) {
    const e = T.randomEdit(L.level, rand);
    const inc = T.incremental(L.level, ev, e.level), fu = T.full(e.level);
    const we = GD.makeWorld(e.level.objects, e.level.header);
    const good = inc.ok === fu.ok && (!inc.ok || (I.finishes(we, GD.run(we, inc.events)) && !GD.skipCheck(we, GD.run(we, inc.events).path, inc.events) && inc.cost <= fu.cost + EPS));
    ok(good, `edit ${e.what}: incremental ${inc.ok ? inc.cost.toFixed(3) : "unbeaten"} in ${inc.ms} ms${inc.fallback ? " (fallback: " + inc.fallback + ")" : ""}, full ${fu.ok ? fu.cost.toFixed(3) : "unbeaten"} in ${fu.ms} ms`);
  }
}
console.log(fail ? fail + " failed" : "all ok");
process.exit(fail ? 1 : 0);
