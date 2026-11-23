// node tools/props.js list | show <name> | sheet [--theme spooky] [--out f.png] | level [--out f.gdlvl]
// The prop library (lib/props.js; ART.md): illustrated scenery placed by name.
//   list    every prop: attach point, size in blocks, object count, colour names
//   show    one prop as text pixels + its objects per colour
//   sheet   contact sheet of every prop (art-free drawing of the objects) -> local/props/props_<theme>.png
//   level   "GDLM prop test": every prop on a flat floor, spaced out, the player runs past them
//           (levels/gdlm_prop_test.gdlvl; to check in the real game; installing is the coordinator's job)
// In a spec: "props": [{"prop": "pumpkin", "col": 30}, {"prop": "dead tree", "from": 40, "to": 80, "density": 2}]
// (tools/make.js; col / from / to in columns, row = the block row it stands on, default the ground).
"use strict";
const fs = require("fs"), path = require("path"), cp = require("child_process");
const ROOT = path.join(__dirname, ".."), P = require("../lib/props.js");
const args = process.argv.slice(2), opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };

function sheet(theme, out, title) {
  const alloc = P.allocator(600), cells = [];
  for (const it of P.list()) {
    const r = P.put(it.name, 0, 0, { alloc, theme });
    const colours = {}; for (const [ch, rgb] of Object.entries(r.colours)) colours[ch] = rgb;
    cells.push({ name: it.name, objects: r.objects, colours, count: r.count, w: it.size.w, h: it.size.h, attach: it.attach, ncol: it.colours.length });
  }
  const dir = path.join(ROOT, "local", "props"); fs.mkdirSync(dir, { recursive: true });
  const job = path.join(dir, "sheet_job.json");
  fs.writeFileSync(job, JSON.stringify({ cells, title: title || `GDLM props (${theme || "day"}) -- lib/props.js, ${cells.length} props, ${cells.reduce((a, c) => a + c.count, 0)} objects in all`, bg: theme === "spooky" || theme === "night" ? [26, 22, 36] : [70, 110, 160] }));
  out = out || path.join(dir, `props_${theme || "day"}.png`);
  cp.execFileSync("python", [path.join(__dirname, "props_sheet.py"), job, out], { stdio: "inherit" });
  return out;
}

// the test level: a flat run, each prop on its own stretch, ground ones on the floor, hanging ones from a
// ceiling row of blocks above, background ones up in the sky. No gameplay: the player just runs.
function level(out) {
  const { GD, writeGdlvl } = require("./io.js"), K = require("./scenekit.js");
  const alloc = P.allocator(600), objects = [], colours = {};
  let x = 300; const marks = [];
  // colour check first (ART.md "Colour"): the same pumpkin four ways -- which ones show orange in the game?
  //   A keys 21+22, ch 6xx (what every prop uses)   B key 21 only   C key 22 only   D keys 21+22 on low channels 40+
  const low = P.allocator(40);
  [["A", {}], ["B", { chKeys: "main" }], ["C", { chKeys: "detail" }], ["D", { alloc: low }]].forEach(([lab, extra], i) => {
    const r = P.put("pumpkin", x + i * 90, 0, Object.assign({ alloc, theme: "spooky" }, extra));
    objects.push(...r.objects); Object.assign(colours, r.colours);
    objects.push(K.obj(914, x + i * 90, 90, { s: 0.6, props: { 31: Buffer.from(lab).toString("base64") } }));
  });
  objects.push(K.obj(914, x + 135, 135, { s: 0.4, props: { 31: Buffer.from("which pumpkins are orange?").toString("base64") } }));
  x += 4 * 90 + 150;
  for (const it of P.list()) {
    const w = Math.max(it.size.w, 2) * 30;
    x += w / 2;
    const y = it.attach === "ground" ? 0 : it.attach === "hang" ? 285 : 200;
    const r = P.put(it.name, x, y, { alloc, theme: "spooky" });
    objects.push(...r.objects); Object.assign(colours, r.colours);
    marks.push([x, it.name, r.count]);
    // a label above each prop (GD text 914, plain white channel 1011)
    objects.push(K.obj(914, x, it.attach === "hang" ? 330 : 270 + (it.attach === "bg" ? 60 : 0) - (it.attach === "ground" ? 90 - it.size.h * 30 : 0) + (it.attach === "ground" ? 60 : 0), { s: 0.4, props: { 31: Buffer.from(`${it.name} (${r.count})`).toString("base64") } }));
    if (it.attach === "hang") for (let bx = x - 60; bx <= x + 60; bx += 30) objects.push({ id: 1, x: bx, y: 315, rot: 0, flipX: false, flipY: false, props: { 155: "1" } });
    x += w / 2 + 120;
  }
  // a floor so the level has an end, and the signature off (no "GDLM" auto-signature here: make.js is not used)
  let header = GD.DEFAULT_HEADER;
  header = K.channels(header, { 1000: { rgb: [40, 30, 64] }, 1001: { rgb: [30, 24, 44] } });
  header = P.header(header, colours);
  const rec = GD.newRecord("GDLM prop test", "Every prop of lib/props.js once (ART.md), spooky colours. No gameplay. Safe to delete.");
  out = out || path.join(ROOT, "levels", "gdlm_prop_test.gdlvl");
  writeGdlvl(out, rec, { header, objects: objects.concat([{ id: 1, x: x + 300, y: 15, rot: 0, flipX: false, flipY: false, props: { 155: "1" } }]) });
  console.log(`wrote ${path.relative(ROOT, out)}: ${objects.length} objects, ${Object.keys(colours).length} channels (${Object.keys(colours).join(",")}), ${(x / 30).toFixed(0)} blocks`);
  for (const [mx, n, c] of marks) console.log(`  x ${String(Math.round(mx)).padStart(5)}  ${n} (${c})`);
  return out;
}

if (require.main === module) {
  const cmd = args[0];
  if (cmd === "list") console.table(P.list().map(r => ({ name: r.name, attach: r.attach, layer: r.layer, w: r.size.w, h: r.size.h, objects: r.count, colours: r.colours.join(" ") })));
  else if (cmd === "show") { const g = P.gridOf((P.ALIAS[args[1]] || args[1]), 0); console.log(g.text()); const r = P.put(args[1], 0, 0, {}); console.log(r.count, "objects", JSON.stringify(require("../lib/pixelart.js").toObjects(g, {}).byColour)); }
  else if (cmd === "sheet") console.log(sheet(opt("--theme"), opt("--out")));
  else if (cmd === "level") level(opt("--out"));
  else console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n"));
}
module.exports = { sheet, level };
