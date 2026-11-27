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
      tiles0: tiles0(),
      // the board's parts (designs_tab.js): [key, name, w, h, mode, note] -- the pieces, the scene as built, and the layout
      // sections (tools/layoutsections.js)
      lparts: [["kit", "pieces", q.scene - 1 - q.c0, THEME_ROWS, "hanging", "every piece once"], ["play", "current scene", q.c1 - q.scene + 1, THEME_ROWS, "cube", "the scene the cards show"]]
        .concat(require("./layoutsections.js").SECTIONS.map(z => ["sec:" + z.key, z.name, z.map[0].length, z.map.length, z.mode, z.note])),
      partGeo: { kit: { c0: q.c0, c1: q.scene - 1 }, play: { c0: q.scene - 1, c1: q.c1 }, hU: THEME_ROWS * 30 + THEME_GROUND, ground: THEME_GROUND, sc: q.scene },
      geo: { c0: q.c0, c1: q.c1, sc: q.c0 + 4, hU: THEME_ROWS * 30 + THEME_GROUND, ground: THEME_GROUND },
      anim: animOf(q.c0, q.c1), cells: cellsOf(q.c0, q.c1), fxcols: fxColsOf(t),
      note: `${t.mood} · ${t.design}, ${[].concat(t.effects).join(", ")} · spikes ${t.spikes}, saws ${t.saws} · ${t.holders} · ${t.indicator}` }); }
  return out;
}
const THEME_ROWS = 13, THEME_GROUND = 45;
// the colours of a theme card's animation styles: the theme's own light roles (Evgeni 2026-11-27: "the colors of the
// effect should match the vibe of the level"), so fire flows in embers, ice in cold blues
function fxColsOf(t) { try { const P = typeof t.pal === "object" ? t.pal : require("./blockdesigns.js").PAL[t.pal];
  return ["glow", "inner", "hi", "core"].map(k => P[k]).filter(Boolean); } catch (e) { return null; } }
// the play blocks of a theme's scene, for the page's "nine circles" style (Evgeni 2026-11-27: "nine circles is when our
// structure has 4 channels and it does waves, not the background ... some kind of flow on the structures"): one
// [x, y, column] per block in card units (as animOf), column = its level column, so the page can light them band by band
let LVL = null;
function cellsOf(c0, c1) {
  try {
    if (!LVL) LVL = require("./io.js").readGdlvl(path.join(ROOT, "levels", "gdlm_design_themes.gdlvl")).level.objects;
    const SC = 0.75, out = [];
    for (const b of LVL) { if (!((b.id >= 1 && b.id <= 7) || b.id === 1338)) continue; if (b.x < c0 * 30 || b.x > c1 * 30 || b.y > THEME_ROWS * 30) continue;
      // 4th: 0 a square; a slope 1338 (unflipped: rises to the right) 1 + flipX + 2 flipY + 4 * quarter turns, so the page
      // fills the slope's triangle, not its square (Evgeni 2026-11-27: "they are bad on the slopes")
      const sh = b.id === 1338 ? 1 + (b.flipX ? 1 : 0) + (b.flipY ? 2 : 0) + 4 * ((Math.round((b.rot || 0) / 90) % 4 + 4) % 4) : 0;
      out.push([+((b.x - c0 * 30) * SC).toFixed(1), +((THEME_ROWS * 30 - b.y) * SC).toFixed(1), Math.floor(b.x / 30), sh]); }
    return out.length ? out : null;
  } catch (e) { return null; }
}
// ▶ PLAY on a theme card (Evgeni 2026-11-27: "theme animations, so we might see how it looks in the game if we press
// play (either playing the whole section/scene or static)"): the gallery level's saved route, 60 points a second, in the
// card's own units (card units = level units x 0.75 from the card's left edge and from the top of its 13 rows), with the
// player's turn and mode, so the page moves the camera and draws the player at game speed over the picture
let RUN = null;
function animOf(c0, c1) {
  try {
    if (!RUN) { const io = require("./io.js"), S = require("./solutions.js"), R = io.readGdlvl(path.join(ROOT, "levels", "gdlm_design_themes.gdlvl"));
      const sol = S.get(R.levelStr, true); RUN = io.GD.run(io.GD.makeWorld(R.level.objects, R.level.header), sol ? sol.events : []).path;
      RUN.presses = new Set((sol ? sol.events : []).filter(e => e.type === "press").map(e => e.tick)); }
    const SC = 0.75, pts = [], taps = [];
    for (let i = 0; i < RUN.length; i += 4) { const s = RUN[i]; if (s.x < c0 * 30 || s.x > c1 * 30) continue;
      // the frames with a press in them (for the "on the jumps" style: the structures light up where he has to click)
      for (let k = i; k < i + 4; k++) if (RUN.presses.has(k)) { taps.push(pts.length); break; }
      pts.push([+((s.x - c0 * 30) * SC).toFixed(1), +((THEME_ROWS * 30 - s.y) * SC).toFixed(1), Math.round(s.rot || 0), s.mode === "cube" ? 0 : s.mode === "ship" ? 1 : 2]); }
    return pts.length ? { fps: 60, s: SC, pts, taps } : null;
  } catch (e) { return null; }
}   // a theme card shows the scene's bottom 13 rows and the ground under them
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
// the shared layout as editable tiles for the Themes tab board (designs_tab.js): t = the text map's character
// (# block, / \\ slopes, 7 r ceiling slopes, ^ spike, v hanging spike, o q s saws), c from the part's left edge, r rows up
function tiles0() {
  const DT = require("./designthemes.js"), out = { kit: [], play: [] };
  DT.KIT_MAP.forEach((l, i) => [...l].forEach((ch, c) => { if (ch !== ".") out.kit.push({ t: ch, c: c + 2, r: 7 - i }); }));
  DT.SCENE.forEach((l, i) => [...l].forEach((ch, c) => { if (ch !== ".") out.play.push({ t: ch, c: c + 1, r: DT.SCENE.length - 1 - i }); }));
  const LS = require("./layoutsections.js"); for (const z of LS.SECTIONS) out["sec:" + z.key] = LS.tiles(z);
  return out;
}
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
  // the same gameplay, so the same route: copy the main level's saved solution to the copy's key, else the map page solves
  // the copy itself and times out (2026-11-27: 15 min, no cards)
  { const SO = require("./solutions.js"), copyStr = io.readGdlvl(lay).levelStr, src = SO.get(L.levelStr, true);
    if (src && copyStr) { const D = path.join(ROOT, "local", "solutions"); fs.mkdirSync(D, { recursive: true }); fs.writeFileSync(path.join(D, SO.keyOf(copyStr) + ".json"), JSON.stringify(src)); } }
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
  // the layout sections' solver check (tools/layoutcheck.js): the board draws each route over its section
  try { fs.copyFileSync(path.join(ROOT, "knowledge", "layout_check.json"), path.join(out, "layout_check.json")); } catch (e) {}
  // the tab, with the scene join in front of it (lib/scenejoin.js: the same code node's layoutsections.joined() uses)
  // + the section generators (tools/sectiongen.js) for the board's 🎲, run in the page: its one need from
  // layoutsections.js is grid(), shimmed here; the node-only parts sit behind require.main
  const LSsrc = fs.readFileSync(path.join(__dirname, "layoutsections.js"), "utf8").replace(/\r\n/g, "\n"),   // CRLF checkouts (the PC) too
    gridSrc = LSsrc.slice(LSsrc.indexOf("function grid("), LSsrc.indexOf("\n}\n", LSsrc.indexOf("function grid(")) + 3);
  const SG = "window.SectionGen = (function () { const module = { exports: {} }; " + gridSrc + "\n const require = n => n === './layoutsections.js' || n === \"./layoutsections.js\" ? { grid, SECTIONS: [] } : {};\n"
    + fs.readFileSync(path.join(__dirname, "sectiongen.js"), "utf8").replace(/^"use strict";/m, "") + "\n return module.exports; })();\n";
  fs.writeFileSync(path.join(out, "designs.js"), fs.readFileSync(path.join(__dirname, "..", "lib", "scenejoin.js"), "utf8") + "\n" + SG + fs.readFileSync(path.join(__dirname, "designs_tab.js"), "utf8"));
  console.log(`${L.length} designs -> ${out} (designs.json, designs.js, cards/)`);
  return { out, files: ["designs.json", "designs.js", "layout_check.json"].concat(L.flatMap(d => [d.card, d.layout, ...Object.values(d.parts || {})].filter(Boolean))) };
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
// Evgeni's edited theme layout (the Themes tab board, collection "designdraw": per part the newest revision's tiles) back
// into text maps: `node tools/designs.js layout` prints them (fetch the collection first: ArtifactData list designdraw
// out_dir local/designs/db; his added sections: list designsecs into the same out_dir). --apply writes them into tools/designthemes.js (SCENE / KIT_MAP), then rebuild:
// node tools/designthemes.js spec && node tools/make.js specs/lab_design_themes.json && node tools/designs.js cards --themes
// a revision's time: the page writes ms numbers, Claude's revisions ISO strings -- compared as strings an ISO date always
// beat a number, so an old Claude revision hid his newer edits (2026-11-27)
const atMs = v => typeof v === "number" ? v : /^\d+$/.test(String(v)) ? +v : (Date.parse(v) || 0);
function layoutBack() {
  const dir = path.join(DIR, "db", "designdraw"), DT = require("./designthemes.js"), newest = {};
  for (const f of fs.existsSync(dir) ? fs.readdirSync(dir) : []) { const d = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")), x = d.data || d;
    if (x && /^layout:/.test(x.design) && (!newest[x.design] || atMs(x.at) > atMs(newest[x.design].at))) newest[x.design] = x; }
  // spikes point away from what holds them (the board's orient() in designs_tab.js, same rule)
  const orient = T => { const at = new Map(T.map(q => [q.c + "," + q.r, q.t])), solid = (c, r) => r < 0 || /[#7r\/\\]/.test(at.get(c + "," + r) || "");
    return T.map(q => q.t === "^" && !solid(q.c, q.r - 1) && solid(q.c, q.r + 1) ? { ...q, t: "v" } : q.t === "v" && solid(q.c, q.r - 1) && !solid(q.c, q.r + 1) ? { ...q, t: "^" } : q); };
  for (const k in newest) if (newest[k].tiles) newest[k] = { ...newest[k], tiles: orient(newest[k].tiles) };
  const toMap = (tiles, rows, width, dc) => { const g = Array.from({ length: rows }, () => Array(width).fill("."));
    for (const q of tiles) { const r = rows - 1 - q.r, c = q.c - dc; if (r >= 0 && r < rows && c >= 0 && c < width) g[r][c] = q.t; } return g.map(l => l.join("")); };
  const out = {};
  const kit = newest["layout:kit"], play = newest["layout:play"];
  // KIT_MAP's first row is r 7 (designthemes.js: r = 7 - i): keep rows from 7 down to his lowest piece (was .slice(4),
  // which kept r 3..0 -- the wrong end -- so the kit edit came out empty)
  if (kit && kit.tiles) { const lo = Math.min(7 - (DT.KIT_MAP.length - 1), ...kit.tiles.map(q => q.r));
    out.KIT_MAP = toMap(kit.tiles, 8, Math.max(DT.KIT_MAP[0].length, ...kit.tiles.map(q => q.c - 1)), 2).slice(0, 8 - lo); }
  // the current scene is built from the sections now (designs_tab.js sceneTiles), so an old saved "play" edit is not applied
  if (play && play.tiles && process.argv.includes("--scene")) out.SCENE = toMap(play.tiles, Math.max(DT.SCENE.length, ...play.tiles.map(q => q.r + 1)), Math.max(DT.SCENE[0].length, ...play.tiles.map(q => q.c)), 1);
  // the sections: his map per key -> knowledge/layout_sections.json (tools/layoutsections.js takes it over its draft)
  // his added sections (collection "designsecs", newest revision per key) -> knowledge/layout_sections_added.json first, so
  // layoutsections.js knows them before their drawings are read back below
  const sdir = path.join(DIR, "db", "designsecs"), added = {};
  for (const f of fs.existsSync(sdir) ? fs.readdirSync(sdir) : []) { const d = JSON.parse(fs.readFileSync(path.join(sdir, f), "utf8")), x = d.data || d;
    if (x && x.key && (!added[x.key] || atMs(x.at) > atMs(added[x.key].at))) added[x.key] = x; }
  if (Object.keys(added).length) { const list = Object.values(added).sort((a, b) => a.key < b.key ? -1 : 1).map(({ key, name, mode, w, h, after, deleted }) => ({ key, name, mode, w, h, after, ...(deleted ? { deleted } : {}) }));
    console.log("added sections: " + list.map(z => `${z.name} (${z.mode}${z.deleted ? ", removed" : ""})`).join(", "));
    if (process.argv.includes("--apply")) { fs.writeFileSync(path.join(ROOT, "knowledge", "layout_sections_added.json"), JSON.stringify(list, null, 1) + "\n"); delete require.cache[require.resolve("./layoutsections.js")]; } }
  // sizes he set on the board (collection "designsize", newest per part; his added sections carry theirs)
  const zdir = path.join(DIR, "db", "designsize"), size = {};
  for (const f of fs.existsSync(zdir) ? fs.readdirSync(zdir) : []) { const d = JSON.parse(fs.readFileSync(path.join(zdir, f), "utf8")), x = d.data || d;
    if (x && x.part && (!size[x.part] || atMs(x.at) > atMs(size[x.part].at))) size[x.part] = x; }
  for (const z of Object.values(added)) size["sec:" + z.key] = z;
  const LS = require("./layoutsections.js"), secs = {};
  for (const z of LS.SECTIONS) { const e = newest["layout:sec:" + z.key], sz = size["sec:" + z.key]; if ((!e || !e.tiles) && !sz) continue;
    const T = (e && e.tiles) || LS.tiles(z), W = sz ? sz.w : Math.max(z.map[0].length, ...T.map(q => q.c + 1)), H = sz ? sz.h : Math.max(z.map.length, ...T.map(q => q.r + 1));
    secs[z.key] = toMap(T, H, W, 0); console.log(`section ${z.key}:\n` + secs[z.key].map(l => "  " + l).join("\n")); }
  if (Object.keys(secs).length && process.argv.includes("--apply")) { const f = path.join(ROOT, "knowledge", "layout_sections.json");
    const old = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : {}; fs.writeFileSync(f, JSON.stringify(Object.assign(old, secs), null, 1) + "\n"); console.log("-> knowledge/layout_sections.json"); }
  if (!Object.keys(out).length) { if (!Object.keys(secs).length) console.log("no edited layout (parts still as ours)"); return; }
  for (const [k, v] of Object.entries(out)) console.log(k + ":\n" + v.map(l => "  " + JSON.stringify(l)).join("\n"));
  if (process.argv.includes("--apply")) { const f = path.join(__dirname, "designthemes.js"); let src = fs.readFileSync(f, "utf8");
    for (const [k, v] of Object.entries(out)) src = src.replace(new RegExp(`const ${k} = \\[[\\s\\S]*?\\];`), `const ${k} = [\n${v.map(l => "  " + JSON.stringify(l) + ",").join("\n")}\n];`);
    fs.writeFileSync(f, src); console.log("written into tools/designthemes.js"); }
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
  else if (cmd === "layout") layoutBack();
  else if (cmd === "list") for (const d of list()) console.log(d.id.padEnd(26), d.card);
  else console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n"));
}
