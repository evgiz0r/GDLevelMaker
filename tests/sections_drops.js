// node tests/sections_drops.js -- tools/sections.js cuts at the drop (a loudness jump), not only at listed impacts,
// and a weaker entry just before a drop never takes its place (Evgeni 2026-11-28, Hellgate: the drop sat mid-section).
"use strict";
const assert = require("assert"), SX = require("../tools/sections.js");
const bars = []; for (let i = 0; i < 40; i++) bars.push({ t: i * 1.6, intensity: i < 20 ? 0.2 : 0.8, heavy: 0.3 });
const music = { bars, impacts: [{ t: 28.8, kind: "entry", strength: 0.6 }, { t: 12, kind: "entry", strength: 0.7 }], notes: [] };
const c = SX.cuts(music, 64);
assert(c.some(t => Math.abs(t - 32) < 0.01), "a cut at the drop (bar 20, 32 s): " + c);
assert(!c.some(t => Math.abs(t - 28.8) < 0.01), "the entry 3 s before the drop gives way: " + c);
assert(c.includes(12), "an entry far from it stays: " + c);
console.log("sections drops: ok", c.join(" "));
