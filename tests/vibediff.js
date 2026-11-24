// node tests/vibediff.js -- tools/vibe.js and tools/vibediff.js (VIBES.md, USE_CASES 31): the GDLM 69 vibe sheet maps to a
// compose brief on the song's bars, and a level diffed against itself is "close" in every beat with an energy correlation
// of 1. Needs local/official_08.json and local/beats (this PC); skips without them.
"use strict";
const fs = require("fs"), path = require("path"), assert = require("assert");
const ROOT = path.join(__dirname, "..");
if (!fs.existsSync(path.join(ROOT, "local", "official_08.json")) || !fs.existsSync(path.join(ROOT, "local", "beats", "official_TimeMachine.json"))) { console.log("skip: no local Time Machine"); process.exit(0); }
const sheet = JSON.parse(fs.readFileSync(path.join(ROOT, "briefs", "69_time_hop.vibe.json"), "utf8"));
const V = require("../tools/vibe.js"), D = require("../tools/vibediff.js");
assert(V.check(sheet).every(l => !/✗|!/.test(l)), "every layer filled:\n" + V.check(sheet).join("\n"));
const b = V.brief(sheet);
assert(b.sections.every(s => s.beats % 4 === 0), "sections on whole bars");
assert(b.sections.some(s => s.mode === "ship") && b.sections.some(s => s.mode === "upside"), "ship and upside from the vehicles");
assert.strictEqual(b.sections.filter(s => /era hopping/.test(s.name)).length, 5, "five eras from look.palettes");
const j = JSON.parse(fs.readFileSync(path.join(ROOT, "local", "official_08.json"), "utf8")), lv = { name: j.name, levelStr: j.level };
const d = D.diff(lv, lv, sheet);
assert(d.rows.every(r => r.verdict[0] === "close"), "a level vs itself is close everywhere: " + JSON.stringify(d.rows.map(r => r.verdict)));
assert.strictEqual(d.level.energyCorr, 1);
console.log(`ok: ${b.sections.length} sections, ${d.rows.length} beats close`);
