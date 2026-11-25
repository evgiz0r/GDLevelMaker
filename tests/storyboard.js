// node tests/storyboard.js -- tools/storyboard.js reads a level back as a timeline (VIBES.md): sections at portals,
// palette switches and speed changes as moments, an intensity strip. Runs on our own GDLM 50 eclipse (in the repo).
"use strict";
const path = require("path"), assert = require("assert");
const { readGdlvl } = require("../tools/io.js"), { analyse } = require("../tools/storyboard.js");
const a = analyse(readGdlvl(path.join(__dirname, "..", "levels", "archive", "gdlm_50_eclipse.gdlvl")), { every: 2 });
assert(a.seconds > 30 && a.seconds < 45, "eclipse is ~37 s long, got " + a.seconds);
const modes = a.sections.map(s => s.mode);
for (const m of ["ship", "wave", "robot"]) assert(modes.some(x => x.includes(m)), "a " + m + " section");
assert(a.strip.length >= 15, "an intensity mark every 2 s");
assert(a.sections.every(s => s.t1 >= s.t0), "sections in time order");
console.log(`ok: ${a.sections.length} sections, ${a.moments.length} moments, ${a.seconds} s`);
