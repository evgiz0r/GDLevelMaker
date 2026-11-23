// node tools/obstacles.js catalogue [--tiers Easy,Normal] [--top 12] [--gdlm]
// node tools/obstacles.js intro     [--tiers Easy,Normal] [--gdlm] [--official]
// node tools/obstacles.js structure [--tiers Easy,Normal] [--gdlm] [--official]
// node tools/obstacles.js indicators [--tiers Easy,Normal,Hard,Harder] [--gdlm] [--official]   (jump arrows: height, turn, hazard ahead)
//
// What rated levels are built from, as a stock for GDLM (which mostly uses lone spikes and few kinds
// of thing; knowledge/levels/variety.md). Reads the rated 2.0-2.1 community levels in
// local/community/ (list.json from tools/community.js; 2.2 ones move their gameplay with triggers,
// so they are left out) and, with --gdlm, levels/gdlm_4*.gdlvl, with --official, official 1-8.
//   structure  per mode: share of columns with a block, of hazards off the ground row, of hazards
//              next to a block (on a ledge, in a pit). Not limited to small islands like catalogue.
//
//   catalogue  gameplay chunks (tools/style.js chunks: islands of hazards/blocks/orbs/pads up to 12
//              columns wide and 10 rows high) per game mode: how wide and tall they are, what share
//              hold a block or an orb/pad, and the pictures most levels share. Glyphs: ^ spike, v
//              hanging spike, , small spike, x other hazard (saw, block hazard), # block, - slab,
//              / slope, o orb, _ pad, | portal, . empty. Pictures are small generic shapes (counts
//              of common patterns), not anyone's level.
//   intro      when each kind of gameplay thing (hazards by shape, orbs/pads/portals by name) first
//              appears in a level, whether that first use is calm (no hazard of another kind within
//              4 blocks), how often it comes back in the next 10 s, and how fast new kinds arrive.
// The write-up is knowledge/levels/obstacles.md.
const fs = require("fs"), path = require("path");
const style = require("./style.js");
const corpus = require("./corpus.js");
const { GD } = require("./io.js");

const ROOT = path.join(__dirname, ".."), COMM = path.join(ROOT, "local", "community");
const BPS = { "0.5x": 8.4, "1x": 10.4, "2x": 12.9, "3x": 15.6, "4x": 19.2 };
const med = a => { a = a.filter(Number.isFinite); if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const f = (v, d = 1) => Number.isFinite(v) ? (+v).toFixed(d) : "-";
const pc = x => Number.isFinite(x) ? Math.round(100 * x) + "%" : "-";
const kindOf = o => { const d = GD.objInfo(o.id); return d.kind === "hazard" ? "hazard:" + (d.shape || "box") : d.name; };
const cat = o => style.classify(o.id).cat;

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const TIERS = opt("--tiers", "Easy,Normal").split(",");
const TOP = +opt("--top", 12);

function levels() {
  const out = [];
  const list = JSON.parse(fs.readFileSync(path.join(COMM, "list.json"), "utf8"));
  for (const l of list.filter(l => l.era === "2.0-2.1" && TIERS.includes(l.tier))) {
    const fp = path.join(COMM, l.id + ".gdlvl");
    if (fs.existsSync(fp)) out.push({ group: "rated " + TIERS.join("+"), name: l.name, L: corpus.file(fp) });
  }
  if (args.includes("--gdlm"))
    for (const fn of fs.readdirSync(path.join(ROOT, "levels")).filter(x => /^gdlm_4\d.*\.gdlvl$/.test(x)).sort())
      out.push({ group: "GDLM 4x", name: fn, L: corpus.file(path.join(ROOT, "levels", fn)) });
  if (args.includes("--official"))
    for (let n = 1; n <= 8; n++) out.push({ group: "official 1-8", name: corpus.NAMES[n - 1], L: corpus.official(n) });
  return out;
}
// section (mode, speed, start time) at a column; time at an x
function locator(a) {
  const at = col => { let s = a.sections[0]; for (const t of a.sections) if (t.from <= col) s = t; return s; };
  return { mode: col => (at(col) || {}).mode || "cube", time: x => { const s = at(x / 30); return s ? s.start + (x / 30 - s.from) / BPS[s.speed] : x / 30 / 10.4; } };
}

function catalogue() {
  const G = {};
  for (const { group, name, L } of levels()) {
    const loc = locator(style.analyse(L)), seen = new Set();
    for (const ch of style.chunks(L)) {
      const m = loc.mode(ch.at), rows = ch.pic.split("\n"), key = m + "\n" + ch.pic;
      const g = ((G[group] ||= {})[m] ||= { n: 0, w: [], h: [], kinds: [], block: 0, act: 0, lone: 0, pics: new Map(), ex: {} });
      g.n++; g.w.push(rows[0].length); g.h.push(rows.length);
      const glyphs = new Set(ch.pic.replace(/[.\n]/g, "")); g.kinds.push(glyphs.size);
      if (/[#\-\/]/.test(ch.pic)) g.block++;
      if (/[o_]/.test(ch.pic)) g.act++;
      if (ch.pic.replace(/[.\n]/g, "").length === 1) g.lone++;
      const p = g.pics.get(ch.pic) || { levels: 0, n: 0 };
      p.n++; if (!seen.has(key)) { p.levels++; seen.add(key); }
      g.pics.set(ch.pic, p);
      // examples: per class, the chunk of each level with the most kinds of glyph (3-10 columns wide)
      const cls = /[o_]/.test(ch.pic) ? "with orbs or pads" : /[#\-\/]/.test(ch.pic) ? "blocks and hazards" : "hazards only";
      if (rows[0].length >= 3 && rows[0].length <= 10 && glyphs.size >= 2) {
        const E = (g.ex[cls] ||= new Map()), cur = E.get(name);
        if (!cur || glyphs.size > cur.k || (glyphs.size === cur.k && ch.pic.length > cur.pic.length)) E.set(name, { k: glyphs.size, pic: ch.pic });
      }
    }
  }
  for (const [group, M] of Object.entries(G)) {
    console.log(`\n## ${group}\n`);
    console.log("| mode | chunks | median width | median height | kinds of glyph | with a block | with an orb/pad | a single object |\n|---|---|---|---|---|---|---|---|");
    for (const [m, g] of Object.entries(M).sort((p, q) => q[1].n - p[1].n))
      console.log(`| ${m} | ${g.n} | ${f(med(g.w), 0)} | ${f(med(g.h), 0)} | ${f(med(g.kinds), 0)} | ${pc(g.block / g.n)} | ${pc(g.act / g.n)} | ${pc(g.lone / g.n)} |`);
    for (const [m, g] of Object.entries(M).sort((p, q) => q[1].n - p[1].n)) {
      if (g.n < 20) continue;
      const top = [...g.pics.entries()].filter(([pic]) => pic.replace(/[.\n]/g, "").length > 1).sort((p, q) => q[1].levels - p[1].levels || q[1].n - p[1].n).slice(0, TOP);
      console.log(`\n### ${m}: the ${top.length} shapes most levels share (levels / times)\n`);
      printRow(top.map(([pic, p]) => [`${p.levels} / ${p.n}`].concat(pic.split("\n"))));
      for (const [cls, E] of Object.entries(g.ex)) {
        const pick = [...E.entries()].sort((p, q) => q[1].k - p[1].k || p[0].localeCompare(q[0])).slice(0, TOP);
        if (!pick.length) continue;
        console.log(`\n### ${m}, ${cls}: examples, one per level (${E.size} levels have one)\n`);
        printRow(pick.map(([, e]) => [""].concat(e.pic.split("\n"))));
      }
    }
  }
}
// pictures side by side, bottom-aligned under their label line
function printRow(cells) {
  const H = Math.max(...cells.map(c => c.length)), W = cells.map(c => Math.max(...c.map(s => s.length)));
  for (let r = 0; r < H; r++)
    console.log("    " + cells.map((c, i) => { const s = r === 0 ? c[0] : (c.length - 1 - (H - 1 - r) >= 1 ? c[c.length - 1 - (H - 1 - r)] : ""); return (s || "").padEnd(W[i] + 3); }).join("").trimEnd());
}

// per mode: how much is structure. Not limited to small islands like the chunks are.
//   block cols   share of the mode's columns holding a block, slab or slope
//   haz raised   share of hazards not on the ground row (on or under blocks, on platforms)
//   haz by block share of hazards with a block within 1 column and 2 rows (a spike on a ledge, a pit)
function structure() {
  const G = {};
  for (const { group, L } of levels()) {
    const a = style.analyse(L), loc = locator(a);
    const solids = L.objects.filter(o => cat(o) === "solid"), haz = L.objects.filter(o => cat(o) === "hazard");
    const solidAt = new Set(solids.map(o => Math.floor(o.x / 30) + "," + Math.floor(o.y / 30)));
    const solidCols = new Set(solids.map(o => Math.floor(o.x / 30)));
    for (const s of a.sections) {
      if (s.blocks < 8) continue;
      const g = ((G[group] ||= {})[s.mode] ||= { cols: 0, bcols: 0, haz: 0, raised: 0, byBlock: 0, lvls: new Set() });
      g.lvls.add(L.name);
      for (let c = Math.floor(s.from); c < s.from + s.blocks; c++) { g.cols++; if (solidCols.has(c)) g.bcols++; }
      for (const h of haz.filter(h => h.x >= s.from * 30 && h.x < (s.from + s.blocks) * 30)) {
        g.haz++;
        const c = Math.floor(h.x / 30), r = Math.floor(h.y / 30);
        if (r > 0) g.raised++;
        let near = false;
        for (let dc = -1; dc <= 1 && !near; dc++) for (let dr = -2; dr <= 2 && !near; dr++) if (solidAt.has((c + dc) + "," + (r + dr))) near = true;
        if (near) g.byBlock++;
      }
    }
  }
  console.log("| group | mode | levels | block cols | haz raised | haz by a block |\n|---|---|---|---|---|---|");
  for (const [group, M] of Object.entries(G)) for (const [m, g] of Object.entries(M).sort((p, q) => q[1].cols - p[1].cols)) {
    if (g.lvls.size < 3) continue;
    console.log(`| ${group} | ${m} | ${g.lvls.size} | ${pc(g.bcols / g.cols)} | ${pc(g.raised / g.haz)} | ${pc(g.byBlock / g.haz)} |`);
  }
}

function intro() {
  const per = {}, lv = {};
  for (const { group, name, L } of levels()) {
    const a = style.analyse(L), loc = locator(a);
    const game = L.objects.filter(o => ["hazard", "orb", "pad", "portal"].includes(cat(o))).sort((p, q) => p.x - q.x);
    if (!game.length) continue;
    const first = new Map();
    for (const o of game) if (!first.has(kindOf(o))) first.set(kindOf(o), o);
    const times = [];
    for (const [k, o] of first) {
      const t = loc.time(o.x);
      const near = game.filter(p => Math.abs(p.x - o.x) <= 4 * 30 && cat(p) === "hazard" && kindOf(p) !== k).length;
      const again = game.filter(p => kindOf(p) === k && p.x > o.x + 15 && loc.time(p.x) <= t + 10).length;
      ((per[group] ||= {})[k] ||= []).push({ t, share: t / a.secs, calm: near === 0, again });
      times.push(t);
    }
    times.sort((p, q) => p - q);
    const gaps = times.slice(1).map((t, i) => t - times[i]);
    (lv[group] ||= []).push({ name, kinds: first.size, perMin: first.size / (a.secs / 60), gap: med(gaps),
      firstQuarter: times.filter(t => t <= a.secs / 4).length / first.size, last: times[times.length - 1] / a.secs });
  }
  for (const group of Object.keys(per)) {
    const R = lv[group];
    console.log(`\n## ${group} (${R.length} levels)\n`);
    console.log(`per level (medians): ${f(med(R.map(r => r.kinds)), 0)} kinds, ${f(med(R.map(r => r.perMin)))} new kinds per minute, ` +
      `${f(med(R.map(r => r.gap)))} s between new kinds, ${pc(med(R.map(r => r.firstQuarter)))} of the kinds in the first quarter, last new kind at ${pc(med(R.map(r => r.last)))} of the level\n`);
    console.log("| kind | levels | first seen (median s) | first seen (% of level) | first use calm | uses in the next 10 s |\n|---|---|---|---|---|---|");
    for (const [k, S] of Object.entries(per[group]).sort((p, q) => q[1].length - p[1].length)) {
      if (S.length < Math.max(2, R.length / 5)) continue;
      console.log(`| ${k.replace(/^hazard:/, "")} | ${S.length} | ${f(med(S.map(s => s.t)))} | ${pc(med(S.map(s => s.share)))} | ${pc(S.filter(s => s.calm).length / S.length)} | ${f(med(S.map(s => s.again)), 0)} |`);
    }
  }
}

// indicators: d_arrow deco (ids 132, 460, 494, 3630-3632; knowledge/objects/) used as "jump here" hints.
// Hints only: a single arrow (no other within 3 blocks), at most 3 blocks up, a hazard within 6 ahead.
// For each: height of its centre above the surface under it (the top of the nearest solid within
// half a block sideways, else the ground), its turn (key 6), and how far the nearest hazard ahead is.
const ARROWS = new Set([132, 460, 494, 3630, 3631, 3632]);
function indicators() {
  const G = {};
  for (const { group, L } of levels()) {
    const arrows = L.objects.filter(o => ARROWS.has(o.id));
    if (!arrows.length) continue;
    const solids = L.objects.filter(o => cat(o) === "solid"), haz = L.objects.filter(o => cat(o) === "hazard");
    const g = (G[group] ||= { levels: 0, lv: new Set(), h: [], rot: {}, ahead: [], scale: [] });
    g.levels++;
    for (const a of arrows) {
      // a hint, not decoration: no other arrow within 3 blocks, at most 3 blocks above the surface,
      // with a hazard within 6 blocks ahead (the rest are arrow patterns, signs, backgrounds)
      if (arrows.some(b => b !== a && Math.abs(b.x - a.x) <= 90 && Math.abs(b.y - a.y) <= 90)) continue;
      let top = 0;
      for (const s of solids) if (Math.abs(s.x - a.x) <= 15 && s.y < a.y) top = Math.max(top, s.y + 15);
      const ys = (+(a.props && a.props[129]) || +(a.props && a.props[32]) || 1);
      g.h.push((a.y - top) / 30); g.scale.push(ys);
      const r = ((Math.round((a.rot || 0) / 90) % 4) + 4) % 4 * 90 + (a.flipY ? "f" : "");
      g.rot[r] = (g.rot[r] || 0) + 1;
      const next = haz.filter(h => h.x >= a.x - 15 && h.x <= a.x + 6 * 30).map(h => (h.x - a.x) / 30);
      const ahead = next.length ? Math.min(...next) : NaN;
      if (!Number.isFinite(ahead) || (a.y - top) / 30 > 3) { g.h.pop(); g.scale.pop(); g.rot[r]--; continue; }
      g.ahead.push(ahead); g.lv.add(L.name);
    }
  }
  console.log("| group | levels with hint arrows | hint arrows | height above surface (p25 / median / p75, blocks) | hazard ahead (median blocks; share with one within 6) | turn (deg: share) |\n|---|---|---|---|---|---|");
  const q = (a, p) => { a = a.filter(Number.isFinite).sort((x, y) => x - y); return a.length ? a[Math.floor(p * a.length)] : NaN; };
  for (const [group, g] of Object.entries(G)) {
    const n = g.h.length;
    console.log(`| ${group} | ${g.lv.size} | ${n} | ${f(q(g.h, .25))} / ${f(q(g.h, .5))} / ${f(q(g.h, .75))} | ${f(med(g.ahead))}; ${pc(g.ahead.filter(Number.isFinite).length / n)} | ` +
      Object.entries(g.rot).sort((p, q2) => q2[1] - p[1]).slice(0, 4).map(([k, v]) => `${k}: ${pc(v / n)}`).join(", ") + " |");
  }
}

if (args[0] === "catalogue") catalogue();
else if (args[0] === "intro") intro();
else if (args[0] === "structure") structure();
else if (args[0] === "indicators") indicators();
else console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n"));
