// node tools/decostudy.js [all | taste | gdlm | official | <id | file.gdlvl> ...] [--refs N]
// What makes a real level LOOK good, measured PER SCREEN (20 blocks, about what a 16:9 screen shows), over the local
// community / demon-list levels (local/community/, never committed), the officials and ours (ART.md "Deco study").
// The user, 2026-11-24: our levels look like "3 squares and poopy" next to real ones. Per screen:
//   n        objects that are not triggers
//   layers   z-layers holding >= 5% of the screen's objects (key 24, else the id's default; modern_look.js's table)
//   back / front   share behind (B5-B3) / in front (T2-T4)
//   dress    deco pieces within 1.5 blocks of a play object (solid / hazard), per play object: how much a block
//            or spike is dressed (trims, fills, outlines, glow around it)
//   glow     share of objects on a blending (additive) channel or from a glow / gradient / fade family (plain 211 / 693
//            squares and triangles count only when their channel blends)
//   ch       distinct colour channels used (keys 21/22); hsv share of objects with an HSV shift (41/42)
//   motion   move / rotate / scale, alpha / toggle, pulse, particle, shader, camera triggers on the screen
// Per level: the median screen (screens with play objects), plus the contrast score (tools/contrast.js).
// Results: local/decostudy/<name>.json (one per level) and local/decostudy/summary.json; printed by group
// (2.2 legendary / featured 2.0-2.1 / other rated / demon list / official / gdlm). --refs N: the N best-dressed
// readable levels (dress, layers, glow, contrast >= 70) as reference picks.
// One child process per level (big 2.2 levels); heavy (tools/heavy.js).
"use strict";
const MV = 2;   // measure version: cached results of another version are measured again (2: glow no longer counts "light" pieces)
if (require.main === module && process.argv[2] !== "one") require("./heavy.js").claim();
const fs = require("fs"), path = require("path"), cp = require("child_process");
const ROOT = path.join(__dirname, ".."), COMM = path.join(ROOT, "local", "community"), OUT = path.join(ROOT, "local", "decostudy");
const SCREEN = 600;

const CAT = {};
for (const line of fs.readFileSync(path.join(ROOT, "knowledge", "objects", "catalogue.tsv"), "utf8").split("\n").slice(1)) {
  const c = line.split("\t"); if (c.length < 8) continue; CAT[c[0]] = { group: c[1], family: c[2], frame: c[3], kind: c[4], layer: c[7] };
}
const ZN = { B5: -5, B4: -3, B3: -1, B2: 1, B1: 3, T1: 5, T2: 7, T3: 9, T4: 11 };
const trigName = id => { const c = CAT[id]; if (!c || c.group !== "triggers") return null; const m = /^edit_e(.+?)(Btn)?_001\.png$/.exec(c.frame || ""); return m ? m[1] : "trigger"; };
const MOTION = { move: /^(Move|Rotate|Scale|Follow|AreaMove|AreaRotate|AreaScale|Animate|AdvFollow|Keyframe)/, fade: /^(Alpha|Toggle|AreaFade|AreaTint)/,
  pulse: /^(Pulse|Color|Tint)/, particle: /Particle/, shader: /^Sh_/, camera: /^(Zoom|Static|Offset|CamRot|CameraGuide|Shake|EdgeCam|CamMode)/ };
const med = a => { a = a.filter(Number.isFinite).sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : null; };

function measure(L) {
  const O = require("../lib/objects.js"), LOOK = require("../lib/look.js").LOOK;
  const flags = LOOK.channelFlags(L.header);
  const isTrig = o => !!trigName(o.id) || (O.objInfo(o.id) || {}).kind === "trigger";
  const kind = o => (O.objInfo(o.id) || {}).kind;
  const isPlay = o => { const k = kind(o); return k === "solid" || k === "hazard"; };
  const layerOf = o => { const p = o.props || {}; if (p[24] != null && p[24] !== "") return +p[24]; const c = CAT[o.id]; return c && ZN[c.layer] != null ? ZN[c.layer] : 5; };
  const glowy = o => { const c = CAT[o.id], ch = +((o.props || {})[21] || 0); return !!flags.blend[ch] || (c && /glow|gradient|fade|blur/i.test((c.family || "") + " " + (c.frame || ""))); };   // not "light": lightsquare (211) / lighttriangle (693) / block0xx_light are plain pieces (style, 2026-11-24)
  const objs = L.objects.filter(o => o.x != null);
  const play = objs.filter(isPlay);
  if (!play.length) return null;
  const x1 = Math.max(...play.map(o => o.x));
  // hash play objects by 45-unit cell for the "dress" count
  const cell = 45, H = new Set();
  for (const p of play) H.add(Math.floor(p.x / cell) + "," + Math.floor(p.y / cell));
  const nearPlay = o => { const cx = Math.floor(o.x / cell), cy = Math.floor(o.y / cell); for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if (H.has((cx + dx) + "," + (cy + dy))) return true; return false; };
  const screens = [];
  for (let x0 = 0; x0 < x1; x0 += SCREEN) {
    const inS = objs.filter(o => o.x >= x0 && o.x < x0 + SCREEN);
    const vis = inS.filter(o => !isTrig(o)), P = vis.filter(isPlay), deco = vis.filter(o => !isPlay(o) && kind(o) !== "portal" && kind(o) !== "orb" && kind(o) !== "pad");
    if (!P.length) continue;
    const byL = {}; for (const o of vis) { const l = layerOf(o); byL[l] = (byL[l] || 0) + 1; }
    const T = inS.filter(isTrig), mot = {}; for (const k in MOTION) mot[k] = 0;
    for (const t of T) { const nm = trigName(t.id) || ""; for (const k in MOTION) if (MOTION[k].test(nm)) { mot[k]++; break; } }
    const chs = new Set(); for (const o of vis) { const p = o.props || {}; if (p[21]) chs.add(p[21]); if (p[22]) chs.add(p[22]); }
    screens.push({ x0, n: vis.length, play: P.length,
      layers: Object.values(byL).filter(c => c >= 0.05 * vis.length).length,
      back: vis.filter(o => layerOf(o) <= -1).length / vis.length, front: vis.filter(o => layerOf(o) >= 7).length / vis.length,
      dress: deco.filter(nearPlay).length / P.length, glow: vis.filter(glowy).length / vis.length,
      ch: chs.size, hsv: vis.filter(o => (o.props || {})[41] === "1" || (o.props || {})[42] === "1").length / vis.length,
      motion: Object.values(mot).reduce((a, b) => a + b, 0), mot });
  }
  const m = k => med(screens.map(s => s[k]));
  let contrast = null; try { contrast = require("./contrast.js").measure(L).score; } catch (e) {}
  const motK = {}; for (const k in MOTION) motK[k] = med(screens.map(s => s.mot[k]));
  return { name: L.name, screens: screens.length, n: m("n"), layers: m("layers"), back: m("back"), front: m("front"), dress: m("dress"),
    glow: m("glow"), ch: m("ch"), hsv: m("hsv"), motion: m("motion"), mot: motK, contrast,
    nP90: (() => { const a = screens.map(s => s.n).sort((p, q) => p - q); return a[Math.floor(a.length * 0.9)] || null; })() };
}

function list(spec) {
  const meta = {}; try { for (const l of JSON.parse(fs.readFileSync(path.join(COMM, "list.json"), "utf8"))) meta[l.id] = l; } catch (e) {}
  const demons = new Set(); for (const f of ["demonlist.json", "demonlist_pc.json"]) try { const d = JSON.parse(fs.readFileSync(path.join(COMM, f), "utf8")); for (const x of (Array.isArray(d) ? d : Object.values(d))) if (x && (x.id || x.levelId)) demons.add(String(x.id || x.levelId)); } catch (e) {}
  const groupOf = id => { const l = meta[id]; if (l) return l.rating === "legendary" && l.era === "2.2" ? "legendary 2.2" : l.era === "2.0-2.1" && l.rating === "featured" ? "featured 2.0-2.1" : "rated other"; return demons.has(id) ? "demon list" : "community other"; };
  const out = [];
  if (spec === "all") for (const f of fs.readdirSync(COMM).filter(f => /^\d+\.gdlvl$/.test(f))) { const id = f.replace(".gdlvl", ""); out.push({ src: path.join(COMM, f), group: groupOf(id), id, likes: (meta[id] || {}).likes }); }
  else if (spec === "taste") { // gd-taste's corpus (local/taste/corpus.json): the levels it learns from
    const c = JSON.parse(fs.readFileSync(path.join(ROOT, "local", "taste", "corpus.json"), "utf8"));
    for (const l of (Array.isArray(c) ? c : c.levels || Object.values(c))) { const f = path.join(COMM, l.id + ".gdlvl"); if (fs.existsSync(f)) out.push({ src: f, group: l.featured ? "taste featured" : "taste other", id: String(l.id), likes: l.likes }); }
  }
  else if (spec === "official") for (let n = 1; n <= 22; n++) out.push({ src: "official:" + n, group: "official", id: "official" + n });
  else if (spec === "gdlm") for (const f of fs.readdirSync(path.join(ROOT, "levels")).filter(f => /^gdlm.*\.gdlvl$/.test(f))) out.push({ src: path.join(ROOT, "levels", f), group: "gdlm", id: f.replace(".gdlvl", "") });
  else out.push({ src: /^\d+$/.test(spec) ? path.join(COMM, spec + ".gdlvl") : spec, group: "given", id: path.basename(spec).replace(".gdlvl", "") });
  return out;
}

if (process.argv[2] === "one") {
  const C = require("./contrast.js"); let L;
  try { L = C.load(process.argv[3]); } catch (e) { process.stdout.write("null"); process.exit(0); }
  process.stdout.write(JSON.stringify(measure(L)));
} else if (require.main === module) {
  const args = process.argv.slice(2), refs = args.includes("--refs") ? +args[args.indexOf("--refs") + 1] : 0;
  const specs = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--refs");
  if (!specs.length) { console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n")); process.exit(0); }
  fs.mkdirSync(OUT, { recursive: true });
  const rows = [];
  for (const sp of specs) for (const it of list(sp)) {
    const cache = path.join(OUT, it.id + ".json");
    let r = null;
    if (fs.existsSync(cache) && it.group !== "gdlm" && it.group !== "given") { r = JSON.parse(fs.readFileSync(cache, "utf8")); if (r.v !== MV) r = null; }
    if (!r) {
      try { r = JSON.parse(cp.execFileSync(process.execPath, ["--max-old-space-size=3000", __filename, "one", it.src], { windowsHide: true, maxBuffer: 1 << 26, timeout: 180000 }).toString() || "null"); } catch (e) { r = null; }
      if (r) { r.v = MV; fs.writeFileSync(cache, JSON.stringify(r)); }
    }
    if (r) rows.push(Object.assign(r, { group: it.group, id: it.id, likes: it.likes }));
  }
  fs.writeFileSync(path.join(OUT, "summary.json"), JSON.stringify(rows));
  const groups = {}; for (const r of rows) (groups[r.group] = groups[r.group] || []).push(r);
  const f = (v, d = 1) => v == null ? "-" : (+v).toFixed(d), pc = v => v == null ? "-" : Math.round(100 * v) + "%";
  console.log("group                levels | n/screen  layers  back  front  dress/play  glow  ch  hsv  motion/screen  contrast");
  for (const [g, a] of Object.entries(groups)) console.log(`${g.padEnd(20)} ${String(a.length).padStart(6)} | ${f(med(a.map(r => r.n)), 0).padStart(8)}  ${f(med(a.map(r => r.layers)), 0).padStart(6)}  ${pc(med(a.map(r => r.back))).padStart(4)}  ${pc(med(a.map(r => r.front))).padStart(5)}  ${f(med(a.map(r => r.dress))).padStart(10)}  ${pc(med(a.map(r => r.glow))).padStart(4)}  ${f(med(a.map(r => r.ch)), 0).padStart(2)}  ${pc(med(a.map(r => r.hsv))).padStart(3)}  ${f(med(a.map(r => r.motion)), 0).padStart(13)}  ${f(med(a.map(r => r.contrast)), 0).padStart(8)}`);
  if (refs) {
    const seen = new Set(), cand = rows.filter(r => !seen.has(r.id) && seen.add(r.id)).filter(r => r.group !== "gdlm" && r.group !== "official" && (r.contrast || 0) >= 70 && r.n >= 300 && r.n <= 3000);
    cand.sort((a, b) => (b.dress * Math.min(b.layers, 6) * (0.3 + b.glow)) - (a.dress * Math.min(a.layers, 6) * (0.3 + a.glow)));
    console.log(`\nreference picks (readable, dressed, layered; n 300-3000 per screen):`);
    for (const r of cand.slice(0, refs)) console.log(`  ${r.id.padEnd(10)} ${String(r.name).slice(0, 28).padEnd(28)} ${r.group.padEnd(16)} n ${f(r.n, 0)} layers ${r.layers} dress ${f(r.dress)} glow ${pc(r.glow)} ch ${r.ch} motion ${r.motion} contrast ${r.contrast}`);
  }
}
module.exports = { measure };
