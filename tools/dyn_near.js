// node tools/dyn_near.js <level n | file.gdlvl> <x0> <x1> [y0 y1]  -- the moving objects (dyn items: a trigger moves,
//   turns or toggles their group) whose reach covers x0..x1, with the triggers on their groups (kind, where, channel,
//   touch / spawned, offset). For "the sim has no floor / ceiling here but the game does" questions: an official
//   level's object listed at its ENTRY position may be somewhere else when the player arrives (PHYSICS.md "Moving objects").
if (require.main === module) require("./heavy.js").claim();   // one heavy job at a time (tools/heavy.js)
const fs = require("fs");
const { GD, unpack, readGdlvl } = require("./io.js");
const [src, a, b, c, d] = process.argv.slice(2);
const SRC = require("./gdpaths.js").LEVELS;
const level = /^\d+$/.test(src) ? unpack(fs.readFileSync(SRC + src + ".txt", "utf8")) : readGdlvl(src).level;
const L = GD.parseLevel(level), w = GD.makeWorld(L.objects, L.header);
const x0 = +a, x1 = +b, y0 = c !== undefined ? +c : -1e9, y1 = d !== undefined ? +d : 1e9;
const near = w.dyn.filter(it => it.reach[0] < x1 && it.reach[1] > x0 && it.y1 > y0 - 300 && it.y0 < y1 + 300);
const groups = new Set();
for (const it of near) { console.log(it.i, it.kind, it.o.id, it.d.name, "at", it.o.x, it.o.y, "groups", it.groups.join("."), "reach", it.reach.map(Math.round).join("..")); it.groups.forEach(g => groups.add(g)); }
for (const t of w.trig.list) if (groups.has(t.group)) console.log("  trigger", t.kind, "obj", t.i, "at", t.x, t.y, "group", t.group, "ch", (L.objects[t.i].props || {})["170"] || 0,
  t.touch ? "touch" : "", t.spawned ? "spawned (by group " + t.groups.join(".") + ")" : "", t.kind === "move" ? `d ${t.dx},${t.dy} dur ${(t.dur / 240).toFixed(2)} s` : t.kind === "toggle" ? "on " + t.on : "");
