// node tools/designs.js cards                -- shoot the block design gallery with each third design centred, then cut one
//                                              picture card per design (tools/design_cards.py) -> local/designs/cards/
// node tools/designs.js cards --more          -- the wide cards: every structure design / 3D effect on the whole connector
//                                              sheet (stitched frames of the structure gallery) and each indicator style
//                                              (tools/design_strips.py) -> local/designs/cards/
// node tools/designs.js cards --themes                -- the design theme cards (tools/designthemes.js gallery shots)
// node tools/designs.js page [--out <dir>]   -- the "Designs" tab of the lego catalogue: designs.json + designs.js + cards/
//                                              into the catalogue's page folder (default local/lego/page_private); the
//                                              catalogue loads it only when the tab is opened (tools/lego_page.html)
// node tools/designs.js marks                -- Evgeni's 📍 spots on the theme scenes (db collection "designmarks" -> local/designs/
//                                              marks_phone.json) with the scene column / row and what is there -> knowledge/design_marks.json
// node tools/designs.js votes                -- Evgeni's 👍 / 👎 / comments on designs (the page's database, collection
//                                              "designvotes": fetch with one ArtifactData list into local/designs/votes_phone.json)
//                                              -> knowledge/design_votes.json; weight(kind, name) for the generators
//
// The designs: tools/blockdesigns.js (22 single blocks, fire + ice) and tools/spikedesign.js (10 spikes, 4 saws).
// Cards carry GD art (shoot.js frames): local and Evgeni's PRIVATE catalogue page only, never git.
"use strict";
const fs = require("fs"), path = require("path"), cp = require("child_process");
const ROOT = path.join(__dirname, ".."), DIR = path.join(ROOT, "local", "designs");
const VOTESK = path.join(ROOT, "knowledge", "design_votes.json");
const keyOf = s => String(s).replace(/\W+/g, "-");
const short = s => String(s || "").split(/[:(;]/)[0].trim().slice(0, 90);   // a short line per card (Evgeni: the catalogue is "heavy with long info")

function list() {
  const B = require("./blockdesigns.js"), S = require("./spikedesign.js"), out = [];
  B.DESIGNS.forEach((d, i) => out.push({ id: "block:" + d.name, kind: "block", name: d.name, n: i + 1, card: `cards/block-${keyOf(d.name)}.jpg`,
    drawn: /^drawn/.test(d.name), note: short(d.note) }));
  out.push({ id: "spike:plain", kind: "spike", name: "plain", n: 0, card: "cards/spike-plain.jpg", note: "no dressing, for comparison" });
  for (const [name, d] of Object.entries(S.DESIGNS)) {
    const kind = d.kind || (/^(cog|saw)/.test(name) ? "saw" : "spike");
    out.push({ id: kind + ":" + name, kind, name, card: `cards/${kind}-${keyOf(name)}.jpg`, note: short(d.src) });
  }
  const SD = require("./structdesign.js"), IS = require("./indstyles.js");
  for (const c of structCopies()) out.push({ id: "structure:" + c.label, kind: "structure", name: c.label, card: `cards/structure-${keyOf(c.label)}.jpg`,
    note: c.label === "extend" ? "a T, a ring and a frame, each beside its extended copy" : short((c.label.startsWith("3D: ") ? SD.EFFECTS[c.label.slice(4)] : SD.DESIGNS[c.design]).note) + (c.pal ? " · " + c.pal : "") });
  for (const [name, st] of Object.entries(IS.STYLES)) out.push({ id: "indicator:" + name, kind: "indicator", name, card: `cards/indicator-${keyOf(name)}.jpg`, note: short(st.note) });
  // design themes (tools/designthemes.js): one card each, its blocks beside its sample segment
  // geo: where the card sits in the gallery level, so a spot marked on it (designs_tab.js 📍) maps back to a column / row
  const DT = require("./designthemes.js"), scenes = DT.spec().scenes;
  for (const [name, t] of Object.entries(DT.THEMES)) { const q = scenes.find(z => z.name === name) || {};
    out.push({ id: "theme:" + name, kind: "theme", name, card: `cards/theme-${keyOf(name)}.jpg`, layout: `cards/layout-${keyOf(name)}.jpg`, parts: { kit: `cards/layoutkit-${keyOf(name)}.jpg`, play: `cards/layoutplay-${keyOf(name)}.jpg` },
      geo: { c0: q.c0, c1: q.c1, sc: q.c0 + 4, hU: THEME_ROWS * 30 + THEME_GROUND, ground: THEME_GROUND },
      note: `${t.mood} · ${t.design}, ${[].concat(t.effects).join(", ")} · spikes ${t.spikes}, saws ${t.saws} · ${t.holders} · ${t.indicator}` }); }
  return out;
}
const THEME_ROWS = 13, THEME_GROUND = 45;   // a theme card shows the scene's bottom 13 rows and the ground under them
const structCopies = () => require("./structdesign.js").spec().copies;
// camera of the shots: the screen's left edge in level units at time t (measured on the gallery shots, 1x speed)
const camLeft = t => 262.6 + 311.7 * (t - 1.5), tAt = left => 1.5 + (left - 262.6) / 311.7, SCREEN = 1920 / 3.375;
function moreCards() {
  const run = (cmd, a) => { const r = cp.spawnSync(cmd, a, { cwd: ROOT, stdio: "inherit", windowsHide: true }); if (r.status) throw new Error(cmd + " failed"); };
  const strips = [], times = [];
  for (const c of structCopies()) {
    const x0 = c.c0 * 30 - 20, x1 = (c.c1 + 1) * 30 + 20, n = Math.ceil((x1 - x0) / SCREEN), ts = [];
    for (let k = 0; k < n; k++) ts.push(tAt(x0 + k * SCREEN).toFixed(3));
    times.push(...ts);
    strips.push({ card: `cards/structure-${keyOf(c.label)}.jpg`, ts, px0: 0, px1: (x1 - x0) * 3.375, y0: 120, y1: 600 });
  }
  const dir = path.join(ROOT, "local", "shots", "struct_cards");
  fs.rmSync(dir, { recursive: true, force: true });
  run(process.execPath, ["tools/shoot.js", "levels/gdlm_structure_designs.gdlvl", "--at", times.join(","), "--out", "local/shots/struct_cards"]);
  const file = t => path.join(dir, "t" + (+t).toFixed(2).padStart(6, "0") + ".png");
  for (const s of strips) s.files = s.ts.map(file);
  // indicators: a frame with the first mark of each style's stretch
  const IS = require("./indstyles.js"), spec = IS.spec(), ind = [], it = [];
  spec.labels.filter(l => l[1] !== "none").forEach(([c, name]) => { const t = 1.5 + ((c + 3 + 5) * 30 - 547) / 311.7; it.push(t.toFixed(2)); ind.push({ name, t: t.toFixed(2) }); });
  const idir = path.join(ROOT, "local", "shots", "ind_cards"); fs.rmSync(idir, { recursive: true, force: true });
  run(process.execPath, ["tools/shoot.js", "levels/gdlm_indicator_styles.gdlvl", "--at", it.join(","), "--out", "local/shots/ind_cards"]);
  const indicators = ind.map(o => ({ card: `cards/indicator-${keyOf(o.name)}.jpg`, file: path.join(idir, "t" + (+o.t).toFixed(2).padStart(6, "0") + ".png"), x0: 60 }));
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(path.join(DIR, "strips_plan.json"), JSON.stringify({ strips, indicators }, null, 1));
  run(process.platform === "win32" ? "python" : "python3", ["tools/design_strips.py"]);
}

// theme cards: two frames per theme from the design themes gallery (its blocks, its sample), side by side
function themeCards() {
  // one picture per theme: its whole scene (tools/designthemes.js SCENE) from ONE fixed camera -- levelmap.js --clean,
  // one row -- cut at the scene's ends (Evgeni 2026-11-27: "just 1 full scene with pieces"; joined shots a screen apart
  // had seams where the camera moved: "it seems like two pictures pasted wrong")
  const run = (cmd, a) => { const r = cp.spawnSync(cmd, a, { cwd: ROOT, stdio: "inherit", windowsHide: true }); if (r.status) throw new Error(cmd + " failed"); };
  const DT = require("./designthemes.js"), scenes = DT.spec().scenes, S = 0.75, ROWS = THEME_ROWS, GROUND = THEME_GROUND;
  run(process.execPath, ["tools/levelmap.js", "levels/gdlm_design_themes.gdlvl", "--clean", "--rows", "1", "--scale", String(S), "--name", "design_themes_clean"]);
  // the pure layout beside it (Evgeni 2026-11-27: "lets also put the pure layout above (also collapsible)"): the same
  // level with its decoration and triggers left out, same camera, cut the same way
  const io = require("./io.js"), L = io.readGdlvl(path.join(ROOT, "levels", "gdlm_design_themes.gdlvl"));
  const keep = L.level.objects.filter(o => !/^(decoration|trigger)$/.test(io.GD.objInfo(o.id).kind || ""));
  const lay = path.join(ROOT, "local", "designs", "design_themes_layout.gdlvl"); fs.mkdirSync(path.dirname(lay), { recursive: true });
  io.writeGdlvl(lay, L.rec, Object.assign({}, L.level, { objects: keep }));
  run(process.execPath, ["tools/levelmap.js", lay, "--clean", "--rows", "1", "--scale", String(S), "--name", "design_themes_layout"]);
  const jobs = scenes.map(q => ({ card: path.join(DIR, `cards/theme-${keyOf(q.name)}.jpg`), x0: Math.round(q.c0 * 30 * S), x1: Math.round(q.c1 * 30 * S) }));
  // two parts (Evgeni 2026-11-27: "make it two parts, that i could look both/one of them"): the kit (the pieces, hanging)
  // and the gameplay layout
  const ljobs = scenes.flatMap(q => [{ card: path.join(DIR, `cards/layout-${keyOf(q.name)}.jpg`), x0: Math.round(q.c0 * 30 * S), x1: Math.round(q.c1 * 30 * S) },
    { card: path.join(DIR, `cards/layoutkit-${keyOf(q.name)}.jpg`), x0: Math.round(q.c0 * 30 * S), x1: Math.round((q.scene - 1) * 30 * S) },
    { card: path.join(DIR, `cards/layoutplay-${keyOf(q.name)}.jpg`), x0: Math.round((q.scene - 1) * 30 * S), x1: Math.round(q.c1 * 30 * S) }]);
  fs.mkdirSync(path.join(DIR, "cards"), { recursive: true });
  run(process.platform === "win32" ? "python" : "python3", ["-c", `
import json,sys
from PIL import Image
Image.MAX_IMAGE_PIXELS=None
im=Image.open(sys.argv[2]).convert('RGB'); h=int(sys.argv[3])
for p in json.loads(sys.argv[1]):
    im.crop((p['x0'],max(0,im.size[1]-h),p['x1'],im.size[1])).save(p['card'],quality=82)
`, JSON.stringify(jobs), path.join(ROOT, "local", "maps", "design_themes_clean.png"), String(Math.round((ROWS * 30 + GROUND) * S))]);
  run(process.platform === "win32" ? "python" : "python3", ["-c", `
import json,sys
from PIL import Image
Image.MAX_IMAGE_PIXELS=None
im=Image.open(sys.argv[2]).convert('RGB'); h=int(sys.argv[3])
for p in json.loads(sys.argv[1]):
    im.crop((p['x0'],max(0,im.size[1]-h),p['x1'],im.size[1])).save(p['card'],quality=82)
`, JSON.stringify(ljobs), path.join(ROOT, "local", "maps", "design_themes_layout.png"), String(Math.round((ROWS * 30 + GROUND) * S))]);
  console.log(`${jobs.length} theme cards -> ${path.join(DIR, "cards")}`);
}

function cards() {
  if (process.argv.includes("--themes")) return themeCards();
  const B = require("./blockdesigns.js");
  const t = i => 1.5 + (((14 + 6 * i) * 30 + 15) - 547) / 311.7;   // the level second design i is at the screen's middle (measured on shots)
  const C = [], frames = [];
  for (let c = 1; c < B.DESIGNS.length + 1; c += 3) C.push(Math.min(c, B.DESIGNS.length - 1));
  for (const c of C) {
    const ds = [];
    for (const i of [c - 1, c, c + 1]) if (i >= 0 && i < B.DESIGNS.length && !frames.some(f => f.designs.some(d => d.i === i))) ds.push({ i, dx: i - c, key: keyOf(B.DESIGNS[i].name) });
    frames.push({ file: path.join(ROOT, "local", "shots", "block_cards", "t" + t(c).toFixed(2).padStart(6, "0") + ".png"), designs: ds, at: t(c).toFixed(2) });
  }
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(path.join(DIR, "cards_plan.json"), JSON.stringify({ frames, spikeSheet: "/mnt/project-files/hazards/spike_designs.jpg",
    spikes: ["plain", "glow", "halo", "inner", "nested", "core", "ring", "layers", "crown", "double", "crystals"], saws: { cog: 1, sawcore: 2, sawnest: 3, sawglow: 4 } }, null, 1));
  const run = (cmd, a) => { const r = cp.spawnSync(cmd, a, { cwd: ROOT, stdio: "inherit", windowsHide: true }); if (r.status) throw new Error(cmd + " failed"); };
  run(process.execPath, ["tools/shoot.js", "levels/gdlm_block_designs.gdlvl", "--at", frames.map(f => f.at).join(","), "--out", "local/shots/block_cards"]);
  run(process.platform === "win32" ? "python" : "python3", ["tools/design_cards.py"].concat(process.argv.includes("--spikes") ? ["--spikes", process.argv[process.argv.indexOf("--spikes") + 1]] : []));
}

function page(out) {
  out = out || path.join(ROOT, "local", "lego", "page_private");
  fs.mkdirSync(path.join(out, "cards"), { recursive: true });
  const L = list().filter(d => fs.existsSync(path.join(DIR, d.card)));
  for (const d of L) for (const f of [d.card, d.layout, ...Object.values(d.parts || {})]) if (f && fs.existsSync(path.join(DIR, f))) fs.copyFileSync(path.join(DIR, f), path.join(out, f));
  fs.writeFileSync(path.join(out, "designs.json"), JSON.stringify(L));
  fs.copyFileSync(path.join(__dirname, "designs_tab.js"), path.join(out, "designs.js"));
  console.log(`${L.length} designs -> ${out} (designs.json, designs.js, cards/)`);
  return { out, files: ["designs.json", "designs.js"].concat(L.flatMap(d => [d.card, d.layout, ...Object.values(d.parts || {})].filter(Boolean))) };
}

function load() { try { return JSON.parse(fs.readFileSync(VOTESK, "utf8")).votes || []; } catch (e) { return []; } }
function votes() {
  const by = {};
  const put = v => { if (v && v.id && (!by[v.id] || String(v.at || "") >= String(by[v.id].at || ""))) by[v.id] = v; };
  for (const v of load()) put(v);
  try { const d = JSON.parse(fs.readFileSync(path.join(DIR, "votes_phone.json"), "utf8")); for (const r of Array.isArray(d) ? d : d.docs || d.documents || []) put(r.data || r); } catch (e) {}
  const list = Object.values(by).map(({ id, kind, name, vote, comment, at }) => ({ id, kind, name, vote, comment, at }));
  fs.writeFileSync(VOTESK, JSON.stringify({ note: "Evgeni's votes on block / spike / saw designs (tools/designs.js votes). A vote is a weight, never a ban.", votes: list }, null, 1));
  console.log(`${list.length} votes (${list.filter(v => v.vote > 0).length} up, ${list.filter(v => v.vote < 0).length} down, ${list.filter(v => v.comment).length} comments) -> ${path.relative(ROOT, VOTESK)}`);
  for (const v of list) console.log(`  ${v.vote > 0 ? "👍" : v.vote < 0 ? "👎" : "  "} ${v.id}${v.comment ? "  -- " + v.comment : ""}`);
}
// Evgeni's spots marked on the theme scenes (designs_tab.js 📍: the page's database, collection "designmarks"; fetch with
// one ArtifactData list into local/designs/marks_phone.json): each with its theme, the scene's column / row (0 = the scene's
// first column, row 0 = on the ground) and what the gallery level has there
function marks() {
  let rows = [];
  try { const d = JSON.parse(fs.readFileSync(path.join(DIR, "marks_phone.json"), "utf8")); rows = (Array.isArray(d) ? d : d.docs || d.documents || []).map(r => r.data || r);
    // revisions (designs_tab.js): each mark's newest by `at`; a deleted one is gone from the page (fixed or removed)
    const by = new Map(); for (const d of rows) { if (!d || !d.mid) continue; const o = by.get(d.mid); if (!o || String(d.at) >= String(o.at)) by.set(d.mid, d); }
    rows = [...by.values()].filter(d => !d.deleted); }
  catch (e) { console.log("no local/designs/marks_phone.json: fetch the page's db collection designmarks with ArtifactData list first"); return; }
  const lvl = require("./io.js").readGdlvl(path.join(ROOT, "levels", "gdlm_design_themes.gdlvl")).level.objects, GD = require("./io.js").GD;
  rows.sort((a, b) => String(a.design).localeCompare(String(b.design)) || a.x - b.x);
  for (const m of rows) {
    const near = lvl.filter(o => Math.abs(o.x - m.x) <= 30 && Math.abs(o.y - m.y) <= 30 && GD.objInfo(o.id).kind !== "trigger");
    const kinds = {}; for (const o of near) { const k = GD.objInfo(o.id).kind || "?"; kinds[k] = (kinds[k] || 0) + 1; }
    console.log(`${m.design}  scene col ${m.col}, row ${m.row}  (x ${Math.round(m.x)}, y ${Math.round(m.y)})  ${m.note ? "\"" + m.note + "\"" : "(no note)"}  near: ${Object.entries(kinds).map(([k, n]) => n + " " + k).join(", ") || "nothing"}`);
  }
  // the log keeps every mark ever made: a mark gone from the page was fixed (Claude deletes a mark once it is done, so the
  // page's list never just grows; Evgeni 2026-11-27), so it stays here with fixed: true
  const KF = path.join(ROOT, "knowledge", "design_marks.json"); let old = [];
  try { old = JSON.parse(fs.readFileSync(KF, "utf8")).marks || []; } catch (e) {}
  const byId = new Map(old.map(m => [m.mid, m]));
  for (const m of rows) byId.set(m.mid, Object.assign({}, byId.get(m.mid), m));
  for (const m of byId.values()) if (!rows.some(r => r.mid === m.mid) && !m.fixed) m.fixed = new Date().toISOString().slice(0, 10);
  const all = [...byId.values()];
  fs.writeFileSync(KF, JSON.stringify({ note: "Evgeni's spots on the design theme scenes (tools/designs.js marks); fixed = gone from the page", marks: all }, null, 1));
  console.log(`${rows.length} on the page (${rows.filter(m => m.seen).length} seen), ${all.filter(m => m.fixed).length} fixed -> knowledge/design_marks.json`);
}
// a design's pick weight for the generators: 1 unvoted, 3 liked, 0.25 disliked (never 0: a vote is not a ban)
function weight(kind, name) { const v = load().find(x => x.id === kind + ":" + name); return !v || !v.vote ? 1 : v.vote > 0 ? 3 : 0.25; }

module.exports = { list, weight, page, keyOf };
if (require.main === module) {
  const [cmd] = process.argv.slice(2), opt = n => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
  if (cmd === "cards") process.argv.includes("--more") ? moreCards() : cards();
  else if (cmd === "page") page(opt("--out"));
  else if (cmd === "votes") votes();
  else if (cmd === "marks") marks();
  else if (cmd === "list") for (const d of list()) console.log(d.id.padEnd(26), d.card);
  else console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n"));
}
