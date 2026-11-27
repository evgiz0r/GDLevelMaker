// node tools/designs.js cards                -- shoot the block design gallery with each third design centred, then cut one
//                                              picture card per design (tools/design_cards.py) -> local/designs/cards/
// node tools/designs.js cards --more          -- the wide cards: every structure design / 3D effect on the whole connector
//                                              sheet (stitched frames of the structure gallery) and each indicator style
//                                              (tools/design_strips.py) -> local/designs/cards/
// node tools/designs.js cards --themes                -- the design theme cards (tools/designthemes.js gallery shots)
// node tools/designs.js page [--out <dir>]   -- the "Designs" tab of the lego catalogue: designs.json + designs.js + cards/
//                                              into the catalogue's page folder (default local/lego/page_private); the
//                                              catalogue loads it only when the tab is opened (tools/lego_page.html)
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
  for (const [name, t] of Object.entries(require("./designthemes.js").THEMES)) out.push({ id: "theme:" + name, kind: "theme", name, card: `cards/theme-${keyOf(name)}.jpg`,
    note: `${t.mood} · ${t.design}, ${[].concat(t.effects).join(", ")} · spikes ${t.spikes}, saws ${t.saws} · ${t.holders} · ${t.indicator}` });
  return out;
}
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
  // one picture per theme: its whole scene (tools/designthemes.js SCENE) as consecutive frames a screen apart, joined
  // into one strip (Evgeni 2026-11-27: "i dont want 2 pictures, just 1 full scene with pieces")
  const run = (cmd, a) => { const r = cp.spawnSync(cmd, a, { cwd: ROOT, stdio: "inherit", windowsHide: true }); if (r.status) throw new Error(cmd + " failed"); };
  const DT = require("./designthemes.js"), scenes = DT.spec().scenes, SCREEN = 1920 / 3.375, V = 311.7;
  const tAt = x => 1.5 + (x - 547) / V;   // the moment x is at the screen's centre (1x speed)
  const plan = scenes.map(q => { const n = Math.ceil((q.c1 - q.c0) * 30 / SCREEN), x0 = q.c0 * 30 + SCREEN / 2;
    return { name: q.name, ts: Array.from({ length: n }, (_, i) => tAt(x0 + i * SCREEN).toFixed(3)) }; });
  const dir = path.join(ROOT, "local", "shots", "theme_cards"); fs.rmSync(dir, { recursive: true, force: true });
  run(process.execPath, ["tools/shoot.js", "levels/gdlm_design_themes.gdlvl", "--at", plan.flatMap(p => p.ts).join(","), "--out", "local/shots/theme_cards"]);
  const file = t => path.join(dir, "t" + (+t).toFixed(2).padStart(6, "0") + ".png");
  const jobs = plan.map(p => ({ card: path.join(DIR, `cards/theme-${keyOf(p.name)}.jpg`), files: p.ts.map(file) }));
  fs.mkdirSync(path.join(DIR, "cards"), { recursive: true });
  run(process.platform === "win32" ? "python" : "python3", ["-c", `
import json,sys
from PIL import Image
W,H=640,360
for p in json.loads(sys.argv[1]):
    o=Image.new('RGB',(W*len(p['files']),H))
    for i,f in enumerate(p['files']): o.paste(Image.open(f).resize((W,H)),(i*W,0))
    o.save(p['card'],quality=80)
`, JSON.stringify(jobs)]);
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
  for (const d of L) fs.copyFileSync(path.join(DIR, d.card), path.join(out, d.card));
  fs.writeFileSync(path.join(out, "designs.json"), JSON.stringify(L));
  fs.copyFileSync(path.join(__dirname, "designs_tab.js"), path.join(out, "designs.js"));
  console.log(`${L.length} designs -> ${out} (designs.json, designs.js, cards/)`);
  return { out, files: ["designs.json", "designs.js"].concat(L.map(d => d.card)) };
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
// a design's pick weight for the generators: 1 unvoted, 3 liked, 0.25 disliked (never 0: a vote is not a ban)
function weight(kind, name) { const v = load().find(x => x.id === kind + ":" + name); return !v || !v.vote ? 1 : v.vote > 0 ? 3 : 0.25; }

module.exports = { list, weight, page, keyOf };
if (require.main === module) {
  const [cmd] = process.argv.slice(2), opt = n => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
  if (cmd === "cards") process.argv.includes("--more") ? moreCards() : cards();
  else if (cmd === "page") page(opt("--out"));
  else if (cmd === "votes") votes();
  else if (cmd === "list") for (const d of list()) console.log(d.id.padEnd(26), d.card);
  else console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n"));
}
