// node tools/stop.js <level>   (level as tools/shoot.js: .gdlvl, local/official_NN.json, official:N)
//
// Where and why a level's saved solution dies in the sim: x, block, %, mode, gravity, the killing object
// (id, what the sim thinks it is, OpenGD's type for it: 2 = hazard, 0 = solid, 7 = deco, 25 = slope,
// 40 = GD's lettered helper blocks), the objects touching that spot, and the special blocks in the level.
// See the spot: tools/levelmap.js draws the level with the path and a red X there. Built 2026-11-23 to answer "do we play it wrong, or
// does some trigger not happen?" for Deadlocked / Dash / Fingerdash (DIFFICULTY.md "Where the sim stops").
if (require.main === module) require("./heavy.js").claim();   // one heavy job at a time (tools/heavy.js)
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, ".."), GD = require("../lib/gd.js"), G = require("../lib/physics.js"), O = require("../lib/objects.js");
const { levelOf } = require("./shoot.js");
const args = process.argv.slice(2);
if (!args[0]) { console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n")); process.exit(1); }
const lv = levelOf(args[0]);
if (!lv.solution) { try { const s = require("./solutions.js").get(lv.levelStr); if (s && s.events) lv.solution = s; } catch (e) {} }
if (!lv.solution) { console.log("no saved solution: run node tools/solutions.js " + args[0] + " first"); process.exit(1); }
const L = GD.parseLevel(lv.levelStr), W = G.makeWorld(L.objects, L.header), r = G.run(W, lv.solution.events), e = r.end;
const ART = Object.values(require("../lib/objects_art.js")).find(v => v && v["1"]) || {};
const type = id => ART[id] ? ART[id][4] : "?";
const desc = o => { const i = O.objInfo(o.id) || {}; return `${o.id} (${i.name || "?"}, ${i.kind || "?"}, OpenGD type ${type(o.id)}) at ${Math.round(o.x)},${Math.round(o.y)}${o.rot ? " turned " + o.rot : ""}`; };
if (r.done || (!r.dead && e.x >= W.endX)) { console.log(lv.name + ": the saved solution beats it"); process.exit(0); }
console.log(`${lv.name}: dies at x ${e.x.toFixed(1)} (block ${(e.x / 30).toFixed(1)}, ${(100 * e.x / W.endX).toFixed(1)}%), y ${e.y.toFixed(1)}, ${e.mode}${e.mini ? " mini" : ""}, gravity ${e.grav}, why: ${r.why}`);
if (r.killer) console.log("  killer: " + desc(r.killer));
// big vertical moves in the last second: teleports, mostly
const tail = r.path.slice(-240);
for (let i = 1; i < tail.length; i++) if (Math.abs(tail[i].y - tail[i - 1].y) > 20) console.log(`  moved ${tail[i - 1].y.toFixed(0)} -> ${tail[i].y.toFixed(0)} at x ${tail[i].x.toFixed(1)} (teleport?)`);
const near = L.objects.filter(o => Math.abs(o.x - e.x) < 45 && Math.abs(o.y - e.y) < 45 && (O.objInfo(o.id) || {}).kind && !/deco/.test((O.objInfo(o.id) || {}).kind));
for (const o of near) if (o !== r.killer) console.log("  near: " + desc(o));
const special = L.objects.filter(o => type(o.id) === 40);
if (special.length) console.log(`  ${special.length} lettered helper blocks (OpenGD type 40: ${[...new Set(special.map(o => o.id))].join(", ")}), the sim treats them as ${(O.objInfo(special[0].id) || {}).kind}`);
console.log(`  see it: node tools/levelmap.js ${args[0]} (red X where it stops)`);
