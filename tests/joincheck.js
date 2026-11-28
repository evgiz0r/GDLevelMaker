// node tests/joincheck.js -- mode changes out of a flying exit happen at the next section's way in, not on the ground
// (Evgeni 2026-11-28, the hellgate card's swing -> ship: "we should transition more around the middle if possible").
"use strict";
const assert = require("assert"), SJ = require("../lib/scenejoin.js"), JC = require("../tools/joincheck.js");
// a flying exit: a saw corridor 12-16 rows up at the end of a tall swing section, no floor, no ceiling
const sw = { mode: "swing", w: 10, h: 30, T: [] }; for (let c = 0; c < 10; c++) sw.T.push({ t: "o", c, r: 12 }, { t: "o", c, r: 17 });
// a ship tunnel whose mouth is rows 5-6 (floor 0-4, roof 7-13), from column 2
const sh = { mode: "ship", w: 12, h: 14, T: [] }; for (let c = 2; c < 12; c++) { for (let r = 0; r <= 4; r++) sh.T.push({ t: "#", c, r }); for (let r = 7; r <= 13; r++) sh.T.push({ t: "#", c, r }); }
const j = SJ.join(sw, sh);
assert(j.portal, "a mode portal");
assert(Math.abs(j.portal.r + 1 - 5.5) <= 1, "portal at the tunnel's mouth, got its middle at row " + (j.portal.r + 1));
const m = JC.measure(sw, sh); assert(!m.flags.length, "no DIP / BAND: " + m.flags);
// the portal column is walled under and over the portal: no way past it
const col = j.tiles.filter(q => q.c === j.portal.c).map(q => q.r);
for (let r = 0; r < j.portal.r; r++) assert(col.includes(r), "walled under the portal at row " + r);
for (let r = j.portal.r + 2; r < 30; r++) assert(col.includes(r), "walled over the portal at row " + r);
// a ground exit (cube) keeps its portal on the floor
const cu = { mode: "cube", w: 4, h: 14, T: [0, 1, 2, 3].map(c => ({ t: "#", c, r: 0 })) };
assert.strictEqual(SJ.join(cu, sh).portal.r, SJ.join(cu, sh).floor + 1, "ground exits unchanged");
// every join of the theme layout
const bad = JC.all().filter(x => x.flags.length); assert(!bad.length, "theme layout joins: " + bad.map(x => x.from + " -> " + x.to + " " + x.flags).join("; "));
console.log("joincheck ok");
