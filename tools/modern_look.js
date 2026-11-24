// node tools/modern_look.js [played | legendary | featured | gdlm | <id or file.gdlvl> ...] [--sections] [--json out]
//
// What makes a modern (2.1/2.2) rated level LOOK the way it does, in numbers a composer can use.
// Per level (and per section with --sections; sections are cut at mode/speed portals, tools/style.js):
//   objects / s, objects per block, share by catalogue group (knowledge/objects/catalogue.tsv: blocks,
//   deco-blocks, deco-shapes, deco-scenery, deco-spikes, pixel, effects, triggers...)
//   layers      z-layer of every object: key 24 when set, else the id's default layer from the catalogue
//               (B5 -5, B4 -3, B3 -1, B2 1, B1 3, T1 5, T2 7, T3 9, T4 11: as lib/art.js; -3..9 from
//               OpenGD's renderer, B5/T4 from memory of 2.2; none checked in the game)
//   colour      distinct colour channels objects use (keys 21/22), header channels (kS38), how many
//               blend (field 5), have opacity < 1 (field 7) or copy another channel (field 9); share of
//               objects with HSV on (keys 41/42)
//   structure   share of objects in a group (key 57), rotated (key 6), scaled (keys 32/128/129), with
//               key 96 = 1 (taken as "no glow", unconfirmed), z-order set (key 25)
//   triggers    per minute, by name (the editor button frame name from the catalogue, e.g. Pulse,
//               AreaMove, Sh_Glitch)
//   families    the deco families with the most objects
// Groups: played = the 2.2 levels the user played (local/recordings.md, 2026-11-23): Spire, Harpuia,
// Dash Tower, CHAOTIC, Sunset Aurorae; legendary = the 2.2 Legendary levels in local/community/list.json;
// featured = rated 2.0-2.1 Featured Easy/Normal; gdlm = levels/gdlm_4*.gdlvl. Levels are read from
// local/community/ (tools/fetch_level.js; never committed), one child process each (big 2.2 levels).
// Static layout: 2.2 levels move objects with triggers, so positions are where the editor has them.
// The write-up is knowledge/levels/modern_look.md.
const fs = require("fs"), path = require("path"), { execFileSync } = require("child_process");
const style = require("./style.js");
const corpus = require("./corpus.js");

const ROOT = path.join(__dirname, ".."), COMM = path.join(ROOT, "local", "community");
const PLAYED = [["128630430", "Spire"], ["128657650", "Harpuia"], ["128619650", "Dash Tower"], ["151677971", "CHAOTIC"], ["152663636", "Sunset Aurorae"]];
const med = a => { a = a.filter(Number.isFinite); if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const f = (v, d = 1) => Number.isFinite(v) ? (+v).toFixed(d) : "-";
const pc = x => Number.isFinite(x) ? Math.round(100 * x) + "%" : "-";

// catalogue: id -> group, family, frame, default layer
const CAT = {};
for (const line of fs.readFileSync(path.join(ROOT, "knowledge", "objects", "catalogue.tsv"), "utf8").split("\n").slice(1)) {
  const c = line.split("\t"); if (c.length < 8) continue;
  CAT[c[0]] = { group: c[1], family: c[2], frame: c[3], layer: c[7] };
}
const Z = { "-5": "B5", "-3": "B4", "-1": "B3", "1": "B2", "3": "B1", "5": "T1", "7": "T2", "9": "T3", "11": "T4" };
const ZORDER = ["B5", "B4", "B3", "B2", "B1", "T1", "T2", "T3", "T4"];
const trigName = id => { const c = CAT[id]; if (!c || c.group !== "triggers") return null; const m = /^edit_e(.+?)(Btn)?_001\.png$/.exec(c.frame || ""); return m ? m[1] : "trigger " + id; };
function headerMap(h) { const p = String(h || "").split(","), o = {}; for (let i = 0; i + 1 < p.length; i += 2) o[p[i]] = p[i + 1]; return o; }
const fieldsOf = c => { const p = String(c).split("_"), o = {}; for (let i = 0; i + 1 < p.length; i += 2) o[p[i]] = p[i + 1]; return o; };

function measureObjects(objs, secs, blocks) {
  const r = { n: objs.length, perSec: objs.length / Math.max(1, secs), perBlock: objs.length / Math.max(1, blocks), groups: {}, layers: {}, trig: {}, fam: {} };
  let hsv = 0, grouped = 0, rot = 0, scaled = 0, noGlow = 0, zo = 0, nonTrig = 0;
  const chans = new Set();
  for (const o of objs) {
    const p = o.props || {}, c = CAT[o.id] || { group: "?", family: "?", layer: "?" };
    r.groups[c.group] = (r.groups[c.group] || 0) + 1;
    const tn = trigName(o.id);
    if (tn) { r.trig[tn] = (r.trig[tn] || 0) + 1; continue; }
    nonTrig++;
    const z = p[24] && Z[p[24]] ? Z[p[24]] : (c.layer && c.layer !== "?" ? c.layer : "T1?");
    r.layers[z] = (r.layers[z] || 0) + 1;
    if (/^deco|^pixel|^effects/.test(c.group)) r.fam[c.group + ":" + c.family] = (r.fam[c.group + ":" + c.family] || 0) + 1;
    if (p[21]) chans.add(+p[21]); if (p[22]) chans.add(+p[22]);
    if (p[41] === "1" || p[42] === "1") hsv++;
    if (p[57]) grouped++;
    if (+p[6]) rot++;
    if ((p[32] && +p[32] !== 1) || (p[128] && +p[128] !== 1) || (p[129] && +p[129] !== 1)) scaled++;
    if (p[96] === "1") noGlow++;
    if (p[25] != null && p[25] !== "") zo++;
  }
  const d = Math.max(1, nonTrig);
  Object.assign(r, { chansUsed: chans.size, hsv: hsv / d, grouped: grouped / d, rotated: rot / d, scaled: scaled / d, noGlow: noGlow / d, zOrder: zo / d });
  return r;
}
function one(L) {
  const a = style.analyse(L);
  const h = headerMap(L.header);
  const ch = String(h.kS38 || "").split("|").filter(Boolean).map(fieldsOf);
  const lvl = measureObjects(L.objects, a.secs, a.blocks);
  lvl.secs = a.secs; lvl.blocks = a.blocks;
  lvl.header = { channels: ch.length, blending: ch.filter(c => c[5] === "1").length, opacity: ch.filter(c => c[7] != null && +c[7] < 1).length,
    copies: ch.filter(c => c[9] && c[9] !== "0").length, bg: h.kA6, ground: h.kA7, mg: h.kA25, font: h.kA18 };
  lvl.sections = a.sections.filter(s => s.blocks >= 8).map(s => {
    const x0 = s.from * 30, x1 = x0 + s.blocks * 30;
    const m = measureObjects(L.objects.filter(o => o.x >= x0 && o.x < x1), s.secs, s.blocks);
    return { from: s.from, mode: s.mode, speed: s.speed, start: s.start, secs: s.secs, blocks: s.blocks, n: m.n, perBlock: m.perBlock, perSec: m.perSec,
      layers: m.layers, trig: m.trig, fam: Object.entries(m.fam).sort((p, q) => q[1] - p[1]).slice(0, 4), hsv: m.hsv, chansUsed: m.chansUsed };
  });
  return lvl;
}

function load(spec) {
  if (spec.endsWith(".gdlvl")) return [{ name: path.basename(spec), file: spec }];
  if (spec === "played") return PLAYED.map(([id, name]) => ({ name, file: path.join(COMM, id + ".gdlvl") }));
  if (spec === "gdlm") return fs.readdirSync(path.join(ROOT, "levels")).filter(x => /^gdlm_4\d.*\.gdlvl$/.test(x)).sort().map(x => ({ name: x, file: path.join(ROOT, "levels", x) }));
  const list = fs.existsSync(path.join(COMM, "list.json")) ? JSON.parse(fs.readFileSync(path.join(COMM, "list.json"), "utf8")) : [];
  if (spec === "legendary") return list.filter(l => l.rating === "legendary" && l.era === "2.2").map(l => ({ name: l.name, file: path.join(COMM, l.id + ".gdlvl") }));
  if (spec === "featured") return list.filter(l => l.rating === "featured" && l.era === "2.0-2.1" && (l.tier === "Easy" || l.tier === "Normal")).map(l => ({ name: l.name, file: path.join(COMM, l.id + ".gdlvl") }));
  return [{ name: spec, file: path.join(COMM, spec + ".gdlvl") }];
}

const args = process.argv.slice(2);
if (args[0] === "one") { process.stdout.write(JSON.stringify(one(corpus.file(args[1])))); return; }
if (!args.length) { console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n")); return; }
const SECT = args.includes("--sections"), ji = args.indexOf("--json"), JSON_OUT = ji >= 0 ? args[ji + 1] : null;
const specs = args.filter((a, i) => !a.startsWith("--") && !(ji >= 0 && i === ji + 1));
const all = {};
for (const spec of specs) {
  const R = [];
  for (const l of load(spec)) {
    if (!fs.existsSync(l.file)) { console.error("missing", l.file); continue; }
    try { R.push({ name: l.name, ...JSON.parse(execFileSync(process.execPath, ["--max-old-space-size=2500", __filename, "one", l.file], { windowsHide: true, encoding: "utf8", maxBuffer: 1 << 26 })) }); }
    catch (e) { console.error("skip", l.name, String(e.message).split("\n")[0]); }
  }
  all[spec] = R;
  const share = (r, k) => (r.groups[k] || 0) / r.n;
  const layerShare = (r, zs) => { const t = Object.values(r.layers).reduce((a, b) => a + b, 0) || 1; return zs.reduce((s, z) => s + (r.layers[z] || 0), 0) / t; };
  const trigMin = (r, re) => Object.entries(r.trig).filter(([k]) => re.test(k)).reduce((s, [, v]) => s + v, 0) / (r.secs / 60);
  console.log(`\n## ${spec} (${R.length} levels)\n`);
  console.log("| level | s | objects | /s | /block | deco-blocks | deco-shapes | scenery+spikes | pixel | effects | triggers | B layers | T2+ | channels | blend | HSV | grouped | rotated | scaled |");
  console.log("|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|");
  const rowOf = (name, r) => `| ${name} | ${f(r.secs, 0)} | ${f(r.n, 0)} | ${f(r.perSec, 0)} | ${f(r.perBlock, 0)} | ${pc(share(r, "deco-blocks"))} | ${pc(share(r, "deco-shapes"))} | ${pc(share(r, "deco-scenery") + share(r, "deco-spikes"))} | ${pc(share(r, "pixel"))} | ${pc(share(r, "effects"))} | ${pc(share(r, "triggers"))} | ` +
    `${pc(layerShare(r, ["B5", "B4", "B3", "B2", "B1"]))} | ${pc(layerShare(r, ["T2", "T3", "T4"]))} | ${f(r.header.channels, 0)} | ${f(r.header.blending, 0)} | ${pc(r.hsv)} | ${pc(r.grouped)} | ${pc(r.rotated)} | ${pc(r.scaled)} |`;
  for (const r of R) console.log(rowOf(r.name, r));
  if (R.length > 1) {
    const m = k => med(R.map(k));
    console.log(`| **median** | ${f(m(r => r.secs), 0)} | ${f(m(r => r.n), 0)} | ${f(m(r => r.perSec), 0)} | ${f(m(r => r.perBlock), 0)} | ${pc(m(r => share(r, "deco-blocks")))} | ${pc(m(r => share(r, "deco-shapes")))} | ${pc(m(r => share(r, "deco-scenery") + share(r, "deco-spikes")))} | ${pc(m(r => share(r, "pixel")))} | ${pc(m(r => share(r, "effects")))} | ${pc(m(r => share(r, "triggers")))} | ` +
      `${pc(m(r => layerShare(r, ["B5", "B4", "B3", "B2", "B1"])))} | ${pc(m(r => layerShare(r, ["T2", "T3", "T4"])))} | ${f(m(r => r.header.channels), 0)} | ${f(m(r => r.header.blending), 0)} | ${pc(m(r => r.hsv))} | ${pc(m(r => r.grouped))} | ${pc(m(r => r.rotated))} | ${pc(m(r => r.scaled))} |`);
  }
  // layer split and triggers per minute
  console.log("\nlayers (share of non-trigger objects):");
  for (const r of R) { const t = Object.values(r.layers).reduce((a, b) => a + b, 0) || 1; console.log(`  ${r.name}: ` + ZORDER.concat(["T1?", "?"]).filter(z => r.layers[z]).map(z => `${z} ${pc(r.layers[z] / t)}`).join(", ")); }
  const T = {};
  for (const r of R) for (const [k, v] of Object.entries(r.trig)) (T[k] ||= []).push(v / (r.secs / 60));
  console.log("\ntriggers per minute (median over the levels that use it; levels using it):");
  console.log("  " + Object.entries(T).sort((p, q) => q[1].length - p[1].length || med(q[1]) - med(p[1])).slice(0, 30).map(([k, v]) => `${k} ${f(med(v))} (${v.length})`).join("; "));
  const F = {};
  for (const r of R) { const tot = Object.values(r.fam).reduce((a, b) => a + b, 0) || 1; for (const [k, v] of Object.entries(r.fam)) (F[k] ||= []).push(v / tot); }
  console.log("\ndeco families (median share of the deco in levels that use it; levels using it):");
  console.log("  " + Object.entries(F).sort((p, q) => q[1].length - p[1].length || med(q[1]) - med(p[1])).slice(0, 30).map(([k, v]) => `${k.split(":")[1]} ${pc(med(v))} (${v.length})`).join("; "));
  console.log("\nheader: " + R.map(r => `${r.name}: bg ${r.header.bg} ground ${r.header.ground} mg ${r.header.mg}, ${r.header.channels} channels, ${r.header.blending} blending, ${r.header.opacity} with opacity < 1, ${r.header.copies} copies, ${r.chansUsed} used by objects`).join("; "));
  if (SECT) for (const r of R) {
    console.log(`\n### ${r.name} by section\n`);
    console.log("| from block | s | mode | speed | blocks | objects/block | objects/s | B layers | top families | triggers |\n|---|---|---|---|---|---|---|---|---|---|");
    for (const s of r.sections) {
      const t = Object.values(s.layers).reduce((a, b) => a + b, 0) || 1, b = ["B5", "B4", "B3", "B2", "B1"].reduce((x, z) => x + (s.layers[z] || 0), 0) / t;
      console.log(`| ${Math.round(s.from)} | ${f(s.start)} | ${s.mode} | ${s.speed} | ${Math.round(s.blocks)} | ${f(s.perBlock, 0)} | ${f(s.perSec, 0)} | ${pc(b)} | ${s.fam.map(([k, v]) => k.split(":")[1] + " " + v).join(", ")} | ${Object.entries(s.trig).sort((p, q) => q[1] - p[1]).slice(0, 4).map(([k, v]) => k + " " + v).join(", ")} |`);
    }
  }
}
if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify(all, null, 1));
