// node tools/theme.js list                         -- the theme kits (tools/themes/*.js) and their variants
// node tools/theme.js check <theme>                -- each variant's palette against tools/roles.js's pairs (must all pass)
// node tools/theme.js song <theme> [--n 10]        -- local songs ranked against the kit's song brief (tempo, length, pad
//                                                     stretches, loud/quiet range, title words); needs local/songmap/
// node tools/theme.js demo <theme> <level.gdlvl> [--variants dark,light,nebula] [--out f] [--shots]
//                                                  -- the level's gameplay dressed by the kit, its sections cycling the
//                                                     variants (a copy in local/themes/); --shots renders 3 frames per
//                                                     section with tools/shoot.js (heavy) and a sheet
//
// THEME KITS (ART.md "Theme kits"; the user, 2026-11-24: "Do we have some things besides colors to represent higher
// concepts like icy, hellish, forest, space, artistic, just colorful... some versions of spikes, ground and deco [...] for
// those moods. And a matching song"). A kit is a module tools/themes/<name>.js exporting:
//   name, mood            what it is
//   VARIANTS              { <variant>: { mood, energy, piece, bg, ground, line, pathEdge, blockFill, hazardEdge, ... } }
//                         one colour family across the level, a few moods of it (space: dark | light | nebula)
//   CH, G, BLEND          its colour channels, groups and which channels blend
//   channelMap(v)         channel -> rgb for a variant (1000 bg, 1001 ground, 1002 line and the kit's own)
//   palette(v)            a role palette (the keys decokit.rolePalette returns: the section lab and compose read it)
//   SONG                  the song brief: bpm [lo, hi], dur [lo, hi], mood, energy, want {beatless, dynamic}, words
//   MODES                 the mode mix it wants (space: more flying)
//   MOTION                its groups for decokit.motion {pulse, bob, sway}
//   dress(ctx, section)   the deco of one section ({x0, x1, i, variant, piece?, energy?}): returns objects; may set key
//                         21 on the play (the path's rim, the hazards' colour)
//   pieces                its set pieces and parts, for scene scripts that place them by hand
// Applied by tools/scenes/theme.js (spec "scene": "tools/scenes/theme.js", "theme": {name, variant(s) | sections}).
"use strict";
const fs = require("fs"), path = require("path"), cp = require("child_process");
const ROOT = path.join(__dirname, ".."), DIR = path.join(__dirname, "themes");

function list() { return fs.readdirSync(DIR).filter(f => /\.js$/.test(f)).map(f => f.replace(/\.js$/, "")); }
function get(name) { if (!list().includes(name)) throw new Error(`no theme kit "${name}" (tools/themes/: ${list().join(", ")})`); return require(path.join(DIR, name + ".js")); }
// spec "theme" -> {name, variant?, variants?, sections?}
function parse(t) { if (!t) throw new Error("spec has no \"theme\""); return typeof t === "string" ? { name: t } : t; }

function check(name) {
  const kit = get(name), D = require("./decokit.js"), out = {};
  for (const v of Object.keys(kit.VARIANTS)) { const P = kit.palette(v), c = D.checkRoles(P);
    out[v] = { ok: Object.values(c).every(x => !x), mixes: Object.keys(c).filter(k => c[k]), ratios: D.roleRatios(P) }; }
  return out;
}

// songs on this PC (local/songmap/<key>.json, tools/songmap.js) against a kit's SONG brief
function songs(name, n = 10) {
  const kit = get(name), B = kit.SONG, dir = path.join(ROOT, "local", "songmap"), rows = [];
  if (!fs.existsSync(dir)) throw new Error("no local/songmap: run node tools/songmap.js --songs");
  const meta = id => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, "local", "songs", id + ".json"), "utf8")); } catch (e) { return {}; } };
  for (const f of fs.readdirSync(dir).filter(f => /^custom_\d+\.json$/.test(f))) {
    let S; try { S = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); } catch (e) { continue; }
    if (!S.bpm || !S.bars) continue;
    const id = f.replace(/^custom_|\.json$/g, ""), m = meta(id), title = (m.name || m.title || "") + " " + (m.artist || "");
    const loud = S.bars.map(b => b.loud).filter(v => v != null).sort((a, b) => a - b);
    const range = loud.length ? loud[Math.floor(loud.length * 0.9)] - loud[Math.floor(loud.length * 0.1)] : 0;
    const quiet = loud.length ? S.bars.filter(b => b.clar != null && b.clar < 1.6).length / S.bars.length : 0;   // weak-beat bars ~ pads
    const inR = (v, [a, b]) => v >= a && v <= b ? 1 : Math.max(0, 1 - Math.min(Math.abs(v - a), Math.abs(v - b)) / ((b - a) / 2 || 1));
    // halve / double tempo counts too (a 75 bpm song at double time)
    const bpm = Math.max(inR(S.bpm, B.bpm), inR(S.bpm * 2, B.bpm) * 0.8, inR(S.bpm / 2, B.bpm) * 0.8);
    const words = B.words.some(w => title.toLowerCase().includes(w)) ? 1 : 0;
    const score = 2 * bpm + inR(S.dur || 0, B.dur) + Math.min(1, range / (B.want.dynamic || 8)) + inR(quiet, B.want.beatless) + 1.5 * words + (S.conf === "high" ? 0.3 : 0);
    rows.push({ id, title: title.trim() || "(no title on this PC)", bpm: +S.bpm.toFixed(1), dur: Math.round(S.dur || 0), range: +range.toFixed(1), pads: +quiet.toFixed(2), words: !!words, score: +score.toFixed(2) });
  }
  return rows.sort((a, b) => b.score - a.score).slice(0, n);
}

// the kit on an existing level's gameplay: its own deco removed, the play kept, the theme scene run
function demo(name, src, o = {}) {
  const io = require("./io.js"), O = require("../lib/objects.js"), GD = io.GD, L = io.readGdlvl(src);
  const kindOf = b => (O.objInfo(b.id) || {}).kind;
  const objects = L.level.objects.filter(b => { const k = kindOf(b); return k && k !== "decoration" && k !== "deco" && !(b.id === 899 || b.id === 1006 || b.id === 1007 || b.id === 901 || b.id === 1346); });
  for (const b of objects) if (b.props) { delete b.props[21]; delete b.props[22]; delete b.props[41]; delete b.props[43]; delete b.props[24]; delete b.props[25]; delete b.props[57]; }
  const S = require("../lib/sync.js"); Object.assign(GD, S);
  let tl = null; try { tl = GD.SYNC.timeline(GD.makeWorld(objects, L.level.header)); } catch (e) {}
  const end = Math.max(...objects.map(b => b.x)), vs = (o.variants || "dark,light,nebula").split(","), n = Math.max(vs.length, Math.round(end / 1800));
  const sections = Array.from({ length: n }, (_, i) => ({ from: Math.round(i * end / n / 30), variant: vs[i % vs.length] }));
  const scene = require("./scenes/theme.js");
  const r = scene({ objects, header: L.level.header, spec: { theme: { name, sections } }, tl, beatX: null, GD });
  const level = { header: r.header, objects: objects.concat(r.objects) };
  const out = o.out || path.join(ROOT, "local", "themes", `${name}_demo_${path.basename(src)}`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  GD.setField(L.rec, "k2", "s", `GDLM theme ${name} demo`);
  io.writeGdlvl(out, L.rec, level);
  return { out, sections: sections.map(s => ({ x: s.from * 30, t: tl ? +GD.SYNC.tOfX(tl, s.from * 30).toFixed(2) : +(s.from * 30 / 311.58).toFixed(2), variant: s.variant })), end };
}

module.exports = { list, get, parse, check, songs, demo };   // before the CLI: tools/scenes/theme.js requires this file back

if (require.main === module) {
  const a = process.argv.slice(2), opt = (k, d) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : d; };
  const cmd = a[0];
  if (cmd === "list") for (const t of list()) { const k = get(t); console.log(`${t.padEnd(10)} ${k.mood}  variants: ${Object.keys(k.VARIANTS).join(", ")}`); }
  else if (cmd === "check") { let bad = 0; for (const [v, r] of Object.entries(check(a[1]))) { if (!r.ok) bad++; console.log(`${r.ok ? "ok  " : "MIX "} ${a[1]}/${v}  ${JSON.stringify(r.ratios)}${r.ok ? "" : "  mixes: " + r.mixes.join(", ")}`); } process.exit(bad ? 1 : 0); }
  else if (cmd === "song") { const k = get(a[1]); console.log(`${a[1]}: ${k.SONG.mood}; ${k.SONG.bpm.join("-")} bpm, ${k.SONG.dur.join("-")} s`);
    for (const s of songs(a[1], +opt("--n", 10))) console.log(`  ${String(s.score).padStart(5)}  ${s.id.padEnd(10)} ${s.bpm} bpm  ${s.dur} s  range ${s.range} dB  pads ${s.pads}${s.words ? "  (title fits)" : ""}  ${s.title}`); }
  else if (cmd === "demo") {
    const r = demo(a[1], a[2], { variants: opt("--variants"), out: opt("--out") });
    console.log(`wrote ${r.out}`); for (const s of r.sections) console.log(`  ${s.variant.padEnd(7)} from ~${s.t} s (x ${s.x})`);
    try { const R = require("./roles.js").measure(require("./contrast.js").load(r.out)); console.log(`roles: ${R.ok ? "ok" : "FAIL"} ${R.failed}/${R.sections} ${JSON.stringify(R.byPair)}`); for (const s of R.worst.slice(0, 3)) console.log(`  ~${s.t} s: ${s.fails.join("; ")}`); } catch (e) { console.log("roles:", e.message); }
    if (a.includes("--shots")) {
      require("./heavy.js").claim();
      const at = []; r.sections.forEach((s, i) => { const t1 = i + 1 < r.sections.length ? r.sections[i + 1].t : s.t + 6; for (const f of [0.25, 0.5, 0.8]) at.push(+(s.t + (t1 - s.t) * f).toFixed(2)); });
      const dir = r.out.replace(/\.gdlvl$/, "_shots");
      cp.execFileSync(process.execPath, [path.join(__dirname, "shoot.js"), r.out, "--at", at.join(","), "--out", dir], { stdio: "inherit", windowsHide: true });
      console.log("frames in", dir);
    }
  } else console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n"));
}
