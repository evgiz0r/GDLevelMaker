// node tests/clickfirst.js -- the clicks-first ball builder (tools/clickfirst.js, BRICKGEN.md "Round 3"): plans build into
// sections whose planned clicks clear; the pattern extractor reads flips, orbs and drops back from a built path; every kept
// section in knowledge/clickfirst.json still clears on today's physics (~5 s).
"use strict";
const C = require("../tools/clickfirst.js"), G = require("../tools/brickgen.js");
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log("FAIL " + m); } else console.log("ok   " + m); };
let s = 3; const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
let built = 0, tries = 0, b = null;
while (built < 3 && tries < 40) { tries++; const x = C.build(r, C.plan(r, 6)); if (!x.why) { built++; b = b || x; } }
ok(built === 3, `3 plans of 6 clicks built in ${tries} tries`);
const run = G.play("ball", b.objects, b.width, b.events);
ok(!run.r.path.some(q => q.dead && q.x < (run.h.s1 + 3) * 30), "a built section clears with its planned clicks");
const toks = C.tokensOf(b), clicks = toks.filter(t => /[FOB]/.test(t.kind)).length;
ok(clicks === 6, `the extractor finds 6 clicks in it (${C.recipe(toks)})`);
ok(C.between(toks, toks) === 0 && C.between(toks, toks.slice(0, 3)) > 0, "recipe distance: 0 to itself, more to a shorter one");
let kept = []; try { kept = require("../knowledge/clickfirst.json").sections; } catch (e) { }
let bad = 0; for (const k of kept) { const v = G.play("ball", k.objects, k.width, k.events); if (v.r.path.some(q => q.dead && q.x < (v.h.s1 + 3) * 30)) { bad++; console.log("  dies now: " + k.id); } }
ok(bad === 0, `${kept.length} kept sections clear with their planned clicks`);
console.log(fails ? `${fails} FAILED` : "all ok");
process.exit(fails ? 1 : 0);
