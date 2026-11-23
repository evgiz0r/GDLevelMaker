// node tests/art_tables.js  -- the GD-art tables (lib/objects_art.js, lib/objects_frames.js, lib/art.js)
// hold together: plist parsing, sprite trees, and (when the game is installed) that every frame the
// tables name exists in the user's sheets. Prints ok or what is wrong. VISUALS.md.
const fs = require("fs"), path = require("path");
const ART = require("../lib/art.js").ART_LIB, { ART: OG, ART_GLOW } = require("../lib/objects_art.js"), { FRAMES } = require("../lib/objects_frames.js");
let bad = 0;
const check = (ok, msg) => { if (!ok) { bad++; console.log("FAIL", msg); } };

// a hand-made TexturePacker format-3 plist
const xml = `<plist><dict><key>frames</key><dict>
<key>a_001.png</key><dict><key>aliases</key><array/><key>spriteOffset</key><string>{-2,3}</string><key>spriteSize</key><string>{10,20}</string>
<key>spriteSourceSize</key><string>{16,24}</string><key>textureRect</key><string>{{5,6},{10,20}}</string><key>textureRotated</key><true/></dict>
</dict><key>metadata</key><dict><key>format</key><integer>3</integer></dict></dict></plist>`;
const f = ART.parsePlist(xml)["a_001.png"];
check(f && f.x === 5 && f.y === 6 && f.w === 10 && f.h === 20 && f.ox === -2 && f.oy === 3 && f.sw === 16 && f.sh === 24 && f.rot === true, "parsePlist: " + JSON.stringify(f));

// tables: the well-known ids
check(OG[1] && OG[1][5] === "square_01_001.png", "id 1 is square_01");
check(OG[8] && OG[8][5] === "spike_01_001.png", "id 8 is spike_01");
check(FRAMES[36] === "ring_01_001.png", "id 36 (yellow orb) is ring_01 in GD's own table");
check(FRAMES[1933] === "portal_18_front_001.png", "id 1933 (swing portal) is portal_18");
check(Object.keys(FRAMES).length > 4000, "GD 2.2 table has >4000 ids");
check(ART_GLOW[1] === "square_01_glow_001.png", "glow of 1");
// a tree: id 1338 (slope) has an outline child; child coordinates are relative to the parent's centre
const t = ART.tree(1338, () => [30, 30]);
check(t && t.node.kids.length === 1 && Math.abs(t.node.kids[0].x) < 1e-9 && Math.abs(t.node.kids[0].y) < 1e-9, "1338 child at the centre: " + JSON.stringify(t && t.node.kids[0]));
check(ART.info(12).kids.some(k => k[0] === "portal_03_back_001.png"), "cube portal gets its back half");

// with the game installed: every frame named exists in the sheets
const GAME = process.env.GD_GAME || "C:/Program Files (x86)/Steam/steamapps/common/Geometry Dash";
const R = path.join(GAME, "Resources");
if (fs.existsSync(path.join(R, "GJ_GameSheet-uhd.plist"))) {
  const have = {};
  for (const n of ART.SHEETS.concat(ART.ICONS)) Object.assign(have, ART.parsePlist(fs.readFileSync(path.join(R, n + "-uhd.plist"), "utf8")));
  const missing = new Set();
  for (const id in OG) for (const fr of ART.framesOf(ART.tree(id, n => have[n] ? [have[n].sw / 4, have[n].sh / 4] : null))) if (!have[fr]) missing.add(fr);
  let miss22 = 0; for (const id in FRAMES) if (!have[FRAMES[id]]) miss22++;
  // OpenGD (2.1) names a few frames GD 2.2 renamed; GD's own table misses only pixel-art ids not in this install's sheets
  check(missing.size < 40, "OpenGD frames missing from the sheets: " + missing.size + " " + [...missing].slice(0, 10).join(" "));
  check(miss22 < 30, "GD table frames missing from the sheets: " + miss22);
  for (const n of ["player_01_001.png", "ship_01_001.png", "floorLine_01_001.png", "portal_01_back_001.png"]) check(have[n], n + " in the sheets");
  console.log("(sheets checked: " + Object.keys(have).length + " frames; OpenGD frames missing " + missing.size + ", GD table " + miss22 + ")");
} else console.log("(no game install: sheet checks skipped)");
// OpenGD's object type (field 4 of ART) against the sim's kind: a type-0 (solid) object must never be a
// hazard. tools/import_opengd.js's fallback once made 37 outline/plank pieces hazards (Deadlocked's 1202
// ball lanes); lib/objects.js's SOLID0 fixes them -- a new import must keep that true.
{
  const info = require("../lib/objects.js").objInfo, wrong = [];
  for (const [id, v] of Object.entries(OG)) if (v[4] === 0 && info(+id).kind === "hazard") wrong.push(id);
  check(!wrong.length, "OpenGD type 0 (solid) but the sim calls them hazards: " + wrong.join(","));
}
console.log(bad ? bad + " failed" : "ok");
process.exit(bad ? 1 : 0);
