// node tests/editing.js [--quick]
// The everyday-loop tools (EDITING.md): tools/edit.js (16), markedit.js (17), review.js (4), fix.js (2).
//   1. the words -> ops vocabulary (no level)
//   2. today's user notes -> their soft-rule family (knowledge/critiques.md, TASTE.md, checklist.md quotes)
//   3. edits on GDLM 61 without solving (--dry): exactly the right objects change, nothing else, the original untouched
//   4. (not with --quick) one real edit end to end on a copy: a jump mark moved clear of its spike (the user's
//      "arrow into the spike", GDLM 50 v2) -- still beaten, that arrows issue gone, no new issue, nothing else
//      changed, the original's bytes the same. Takes the heavy slot (a route re-plan: seconds to a minute).
"use strict";
const quick = process.argv.includes("--quick");
if (!quick) require("../tools/heavy.js").claim();
const fs = require("fs"), path = require("path"), crypto = require("crypto");
// the saved routes these tests use (local/ is not in git: a fresh checkout or a cloud session has none)
{ const fsx = require("fs"), px = require("path"), src = px.join(__dirname, "fixtures", "edit_routes"), dst = px.join(__dirname, "..", "local", "solutions");
  fsx.mkdirSync(dst, { recursive: true });
  for (const f of fsx.readdirSync(src)) if (!fsx.existsSync(px.join(dst, f))) fsx.copyFileSync(px.join(src, f), px.join(dst, f)); }

const E = require("../tools/edit.js"), FAM = require("../tools/families.js");
const ROOT = path.join(__dirname, "..");
let bad = 0, n = 0;
const ok = (c, msg) => { n++; if (!c) { bad++; console.log("FAIL " + msg); } };

// 1. vocabulary
const spot = { x: 1215, col: 40, block: 40.5, y: null, playerY: 45, t: 4 };
const P = w => E.parse(w, spot);
const one = w => { const p = P(w); return Array.isArray(p) ? p[0] : p; };
ok(one("add a yellow orb here").op === "add" && one("add a yellow orb here").type === "yellow orb", "add a yellow orb");
ok(one("add a spike 2 blocks right").col === 42 && one("add a spike 2 blocks right").row === 0, "add 2 blocks right");
ok(one("remove these spikes").op === "remove" && one("remove these spikes").group === true, "remove these spikes (group)");
ok(one("remove this orb").group === false, "remove this orb (single)");
ok(one("lower this block by 1").dy === -1 && one("lower this block by 1").group === true, "lower this block");
ok(one("raise this block by 2").dy === 2, "raise by 2");
ok(one("move this orb left by 0.5").dx === -0.5, "move left by 0.5");
ok(one("extend this block 2 right").op === "extend" && one("extend this block 2 right").n === 2, "extend 2 right");
ok(one("replace this yellow orb with a pink orb").with === "pink orb", "replace");
ok(one("make this section a wave").mode === "wave", "make this section a wave");
ok(one("change this section to ship").mode === "ship", "change this section to ship");
ok(P("remove these spikes then add a yellow pad").length === 2, "two changes joined by then");
ok(!!P("paint it red").error, "unknown words give an error, not a guess");
ok(one("remove spikes from b40 to b50").from === 40 && one("remove spikes from b40 to b50").to === 50, "a range");

// 2. today's notes -> families (the first family named)
const NOTES = [
  ["arrow into the spike", "jump marks"],                                                     // GDLM 50 v2
  ["too close to the spike, almost inside it", "jump marks"],                                 // GDLM 50 v2
  ["indicator inside spike", "jump marks"],                                                   // hellgate round 2
  ["indicator a bit too high over the ground", "jump marks"],                                 // 44 v8
  ["the second indicator is wrong, dont need to jump there", "fairness mark"],                // 44 v8
  ["waaaay too flashy. the contrast between the objects is bad, hard to tell what kills you", "contrast"], // hellgate r1
  ["this entrance is wrong in its shape", "stubs"],                                           // GDLM 50 v2
  ["such pattern is awkward, as it creates very specific cube jumps I need to do, instead of being able to react", "reactive"], // 45 v6
  ["some places are very empty in deco", "deco coverage"],                                    // 45 v6
  ["it's not pretty that the orb is over the 2nd of 5 spikes", "symmetry"],                   // 45
  ["dunno if we have to jump or not, simulation says we don't but then there is no point in those spikes", "hazards matter"], // 47
  ["some sections are somewhat boring. all in flat area. no change of height really", "height"], // 47
  ["this looks like very bad jump", "clusters"],                                              // 44 v13
  ["the triple orb in the end, feels very akward, if you just click normal you fall and die, cant adjust", "fairness chain"], // 44 v8
  ["landing just behind a block is annoying, it's hard to aim the previous orb", "player timing"], // 44 v12
  ["ending still bit too long", "ending"],                                                    // 45 v7
  ["i just die in the entrance", "fairness switch"],                                          // 44 v5
  ["these clicks very unnatural, the timings seem reallllly awkward", "reactive"],            // 61 v1
];
for (const [note, fam] of NOTES) { const c = FAM.classify(note).map(f => f.id); ok(c[0] === fam, `note "${note.slice(0, 50)}" -> ${fam} (got ${c.join(", ") || "none"})`); }
ok(FAM.classify("the colours feel off").length === 0, "no family for an unknown note");

// 3. dry edits on GDLM 61
const F61 = path.join(ROOT, "levels", "gdlm_61_lantern_towers.gdlvl");
const hash = f => crypto.createHash("sha1").update(fs.readFileSync(f)).digest("hex");
const h0 = hash(F61);
const L = E.loadLevel(F61), route = E.routeOf(L);
const sp = E.parseSpot("b40", L, route);
ok(sp.col === 40 && Math.abs(sp.x - 1200) < 1, "spot b40 = x 1200");
ok(Math.abs(E.parseSpot("x=1200", L, route).x - 1200) < 1 && Math.abs(E.parseSpot("t=" + sp.t, L, route).x - 1200) < 6, "spot by x and by time agree");
const r1 = E.apply(L.level, P("remove these spikes"), sp), d1 = E.diff(L.level.objects, r1.objects);
ok(d1.removed.length === 2 && d1.added.length === 0 && d1.removed.every(o => (require("../lib/objects.js").objInfo(o.id) || {}).kind === "hazard"), "remove these spikes at b40: exactly the 2 pit spikes");
const r2 = E.apply(L.level, P("lower this block by 1"), sp), d2 = E.diff(L.level.objects, r2.objects);
ok(d2.removed.length === d2.added.length && d2.added.every(o => d2.removed.some(q => q.id === o.id && Math.abs(q.x - o.x) < 1 && Math.abs(q.y - 30 - o.y) < 1)), "lower: same pieces, 30 units down");
ok(r2.changes.some(c => /under the ground/.test(c.what)), "lowering a ground block warns it vanishes");
const r3 = E.apply(L.level, P("extend this block 2 right"), sp), d3 = E.diff(L.level.objects, r3.objects);
ok(d3.added.length >= 2 && d3.removed.length === 0, "extend adds the edge column twice");
ok(hash(F61) === h0, "the original file is untouched by dry edits");

// 3b. retarget (13): targets, and candidate edits at an input without solving
const RT = require("../tools/retarget.js");
ok(RT.target("easier", 0.365).name === "Easy" && RT.target("harder", 0.365).name === "Hard", "easier / harder = one tier");
ok(RT.target("3", 2).name === "Normal" && RT.target("Harder", 0).name === "Harder" && RT.target("0.5", 0).lo === 0.45, "stars, tier names, a score");
ok(RT.tierOf(0.2) === "Easy" && RT.tierOf(1.0) === "Hard", "tier cuts as DIFFICULTY.md");
{ const pth = route.path, i = pth.findIndex(q => q.x >= 37 * 30), a = { x: pth[i].x - 60, y: 15, tick: i, mode: "cube" };
  const ce = RT.candidates(L.level.objects, a, -1, pth), ch = RT.candidates(L.level.objects, a, 1, pth);
  ok(ce.some(c => /shorter/.test(c.why)) && ce.some(c => /later/.test(c.why)), "easier candidates at the pit before b37: " + ce.map(c => c.why).join("; "));
  ok(ch.some(c => /longer/.test(c.why)), "harder candidates: " + ch.map(c => c.why).join("; "));
  const r = E.apply(L.level, ce.find(c => /shorter/.test(c.why)).ops, { x: a.x, col: 36, block: 36, y: null, playerY: 15 });
  ok(E.diff(L.level.objects, r.objects).removed.length === 1, "a row one shorter removes one hazard"); }

// 4. one real edit end to end (heavy: a route re-plan)
if (!quick) {
  const out = path.join(ROOT, "local", "tmp", "test_edit_61.gdlvl");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  for (const f of [out, out.replace(/\.gdlvl$/, ".json")]) try { fs.unlinkSync(f); } catch (e) {}
  const rep = E.edit({ level: F61, at: "b37", ops: [{ op: "clearmark", what: "mark", at: 36.5 }], out, noShots: true });
  ok(rep.ok && rep.file, "the edit ran: " + (rep.error || ""));
  ok(rep.beaten, "still beaten after the edit (" + rep.solve + ")");
  ok(rep.added === 1 && rep.removed === 1 && rep.elsewhere === 0, "one object moved, nothing else changed");
  ok(rep.checks.fixed.some(q => q.rule === "arrows" && q.block === 36.5), "the arrows issue at 36.5 is gone");
  ok(rep.checks.added.length === 0, "no new issue: " + rep.checks.added.map(q => q.rule + " " + q.text).join("; "));
  ok(hash(F61) === h0, "the original file is untouched by the edit");
}
console.log(`${n - bad}/${n} ok` + (quick ? " (quick: no real edit)" : ""));
process.exit(bad ? 1 : 0);
