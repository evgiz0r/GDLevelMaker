// node tests/presslib.js  -- the press library (tools/presslib.js): learns from two solved cube levels, predicts the
// third's presses, plays it by the library with local repairs, and reads a start position as a creator hint.
// Solves its three small levels itself (a few seconds), so it needs nothing in local/.
"use strict";
const path = require("path");
const { GD, readGdlvl } = require("../tools/io.js");
const P = require("../tools/presslib.js"), NAT = require("../lib/natural.js");
let fail = 0;
const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) fail++; };

const lv = ["gdlm_02_on_the_beat", "gdlm_42_seen_then_gone", "gdlm_41_classic"].map(n => {
  const r = readGdlvl(path.join(__dirname, "..", "levels", n + ".gdlvl")), w = GD.makeWorld(r.level.objects, r.level.header);
  const s = GD.solveSweep(w), nat = s.ok ? NAT.naturalPlan(w, s, r.level.objects) : null;   // the human route: one tap per jump
  return { n, w, objects: r.level.objects, header: r.level.header, events: nat ? nat.events : s.events, ok: s.ok };
});
ok(lv.every(l => l.ok), "the three levels solve");
const lib = P.emptyLib();
for (const l of lv.slice(0, 2)) { const f = P.framesOf(l.w, l.events); ok(f.done, `${l.n}: its route replays to the end`); P.add(lib, l.w, f.frames); }
const t = lv[2], F = P.framesOf(t.w, t.events).frames, r = P.predictAlong(lib, t.w, F, 0.3);
console.log(`     ${t.n}: ${r.truth} presses, library pressed ${r.fired}, ${r.hit3} within 3 frames`);
ok(r.hit3 / r.truth >= 0.3, "recall on an unseen level >= 30% (learned from two levels)");
ok(r.fired && r.hit3 / r.fired >= 0.6, "precision >= 60%");
const sv = P.solveWithLib(lib, t.w, 0.3);
ok(sv.ok, `played by the library with local repairs, it clears (${sv.repairs} repairs)`);
if (sv.ok) { const q = GD.run(t.w, sv.events); ok(q.done || q.path[q.path.length - 1].done, "the route is a plain replay that finishes"); }
// a start position is the creator saying "here the player is a <mode>": a cube route agrees with a cube one, not a ship one
const mk = mode => { const o = t.objects.concat([{ id: 31, x: 600, y: 15, rot: 0, flipX: false, flipY: false, props: { 1: "31", 2: "600", 3: "15", kA2: String(mode) } }]);
  return { objects: o, w: GD.makeWorld(o, t.header) }; };
const a = P.agreeStartPos(mk(0), t.events, P.hints(mk(0))), b = P.agreeStartPos(mk(1), t.events, P.hints(mk(1)));
ok(a.length === 1 && a[0].ok, "a cube start position agrees with the cube route");
ok(b.length === 1 && !b[0].ok && /mode/.test(b[0].bad[0]), "a ship start position does not");
console.log(fail ? `${fail} FAILED` : "all ok");
process.exit(fail ? 1 : 0);
