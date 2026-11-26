// node tools/hazards_try.js <level.gdlvl> [--tier easy|normal|hard] [--keep] [--out local/tmp/x.gdlvl]
//   lib/hazards.js's hazardsAlongPath on a level whose path is known: strips the level's own hazards (unless --keep),
//   places new ones along its path (saved solution, or no presses for an auto level), replays to check it still clears,
//   and prints the hazard measures before and after against the rated reference (knowledge/hazards_ref.json).
//   --out writes the result as a .gdlvl (default local/tmp/<name>_hazards.gdlvl) for the viewer. HAZARDS.md "Generator".
if (require.main === module) require("./heavy.js").claim();
const fs = require("fs"), path = require("path");
const { GD, readGdlvl } = require("./io.js");
Object.assign(GD, require("../lib/hazards.js"));
const H = require("./hazards.js");
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const file = args[0]; if (!file) { console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n")); process.exit(0); }
const lv = H.load(file);
if (!lv.run || !lv.run.done) { console.log("the level's path does not clear (" + (lv.run ? lv.run.src + " " + lv.run.pct + "%" : "none") + "): nothing to place along"); process.exit(1); }
const before = H.flat(H.measure(lv));
const keep = args.includes("--keep");
const base = keep ? lv.objects : lv.objects.filter(o => GD.objInfo(o.id).kind !== "hazard");
const t0 = Date.now();
// the replay check needs today's sim to clear the level; a path from an older physics commit (tools/hazards.js) skips it
const oldPhys = /physics /.test(lv.run.src || "");
const res = GD.hazardsAlongPath(lv.run.path, base, { tier: opt("--tier", "normal"), seed: +opt("--seed", 1),
  verify: oldPhys ? null : { header: lv.L.header, events: lv.run.events || [] } });
const objs = base.concat(res.objects.map(o => ({ rot: 0, flipX: false, flipY: false, props: {}, ...o })));
const after = { ...lv, objects: objs, run: null };
let q;
// the path again, with the new hazards in
if (oldPhys) after.run = { ...lv.run, src: lv.run.src + ", not replayed" };
else { const w = GD.makeWorld(objs, lv.L.header), q = GD.run(w, lv.run.events || []), e = q.path[q.path.length - 1];
  after.run = { path: q.path, done: !!(q.done || (!q.dead && GD.worldXY(e)[0] >= w.endX)), pct: +(GD.worldXY(e)[0] / w.endX * 100).toFixed(1), endX: w.endX, src: "same presses" }; }
const af = H.flat(H.measure(after)), ref = JSON.parse(fs.readFileSync(H.REF, "utf8")).groups.official.median;
console.log(`${lv.name}: placed ${res.objects.length} (${JSON.stringify(res.notes)}) in ${Date.now() - t0} ms; replay ${after.run.done ? "clears" : "DIES at " + after.run.pct + "%"}`);
const show = ["per100", "nearPerSec", "role.threat", "role.guard", "role.fill", "arcs.withHazard", "arcs.underPerJump", "guardAbove", "guardBelow", "lane.fly.aboveHaz", "lane.fly.belowHaz", "runs1"];
console.log("measure".padEnd(20) + "before".padStart(9) + "after".padStart(9) + "  official median");
for (const k of show) console.log(k.padEnd(20) + String(before[k] ?? "-").padStart(9) + String(af[k] ?? "-").padStart(9) + "  " + (ref[k] ?? "-"));
const out = opt("--out", path.join(__dirname, "..", "local", "tmp", path.basename(file, ".gdlvl") + "_hazards.gdlvl"));
fs.mkdirSync(path.dirname(out), { recursive: true });
if (file.endsWith(".gdlvl")) {   // official / community levels are not ours: measured, never written
  const r = readGdlvl(file);
  if (args.includes("--name")) GD.setField(r.rec, "k2", "s", opt("--name"));
  require("./io.js").writeGdlvl(out, r.rec, { header: lv.L.header, objects: objs });
  console.log("wrote " + path.relative(path.join(__dirname, ".."), out));
}
// --map FROM TO: a text picture of that stretch (columns in blocks) after placing: # block  ^ v spike  , pit  * saw  . path
if (args.includes("--map")) {
  const c0 = +opt("--map", 0), c1 = +args[args.indexOf("--map") + 2] || c0 + 100;
  const P = after.run.path.map(s => GD.worldXY(s));
  const ys = P.filter(p => p[0] >= c0 * 30 && p[0] < c1 * 30).map(p => p[1]);
  const r0 = Math.max(0, Math.floor(Math.min(...ys) / 30) - 4), r1 = Math.floor(Math.max(...ys) / 30) + 5;
  const G = {};
  const put = (cx, cy, ch, pri) => { const k = cx + "," + cy; if (!G[k] || G[k][1] < pri) G[k] = [ch, pri]; };
  for (const o of objs) { const d = GD.objInfo(o.id), cx = Math.floor(o.x / 30), cy = Math.floor(o.y / 30);
    if (cx < c0 || cx >= c1) continue;
    if (d.kind === "solid" || d.kind === "slope") put(cx, cy, "#", 2);
    else if (d.kind === "hazard") put(cx, cy, d.shape === "saw" ? "*" : o.id === 9 || o.id === 61 ? "," : o.flipY ? "v" : "^", 3);
    else if (d.kind === "orb" || d.kind === "pad") put(cx, cy, "o", 3); }
  for (const p of P) { const cx = Math.floor(p[0] / 30), cy = Math.floor(p[1] / 30); if (cx >= c0 && cx < c1) put(cx, cy, ".", 1); }
  for (let cy = r1; cy >= r0; cy--) { let line = String(cy).padStart(3) + " "; for (let cx = c0; cx < c1; cx++) line += (G[cx + "," + cy] || [" "])[0]; console.log(line); }
}
