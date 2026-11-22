// node tools/style.js [what] [--detail] [--patterns] [--json out.json]
//   what = official | mine | all | <n> (an official level) | "<name of one of my levels>" | file.gdlvl
//
// Measures the "style" of levels: how much is decoration vs gameplay, which triggers and colours
// they use, how the gameplay is cut into sections (mode/speed portals), how dense each section is,
// where the rest spots are, and which gameplay chunks repeat. Reads the game install and the
// user's save but writes nothing except --json (put that in local/: it holds other people's work).
const fs = require("fs"), path = require("path");
const { GD } = require("./io.js");
const corpus = require("./corpus.js");

// ---------- what an object is, for style purposes ----------
// lib/objects.js wins; then lib/objects_extra.js (OpenGD's 2.1 data, if present); anything else
// with an id the 2.1 data covers is decoration (no hitbox). Ids past 2.1 are "new" (unknown).
let EXTRA = {};
for (const p of [path.join(__dirname, "../lib/objects_extra.js"), process.env.GD_EXTRA].filter(Boolean)) {
  try { EXTRA = require(p).EXTRA || EXTRA; if (Object.keys(EXTRA).length) break; } catch (e) { /* not there yet */ }
}
// Trigger and special ids by name. sure:false throughout: names from memory of the editor.
const TRIG = {
  29: "bg colour", 30: "ground colour", 104: "line colour", 105: "obj colour", 221: "col 1", 717: "col 2",
  718: "col 3", 743: "col 4", 744: "3DL colour", 899: "colour", 900: "ground 2 colour", 915: "line? colour",
  901: "move", 1006: "pulse", 1007: "alpha", 1049: "toggle", 1268: "spawn", 1346: "rotate", 1347: "follow",
  1520: "shake", 1585: "animate", 1595: "touch", 1611: "count", 1612: "hide player", 1616: "stop",
  1811: "instant count", 1812: "on death", 1814: "follow player y", 1815: "collision", 1817: "pickup",
  1818: "bg effect on", 1819: "bg effect off", 1912: "random", 1913: "camera zoom", 1914: "static camera",
  1916: "camera offset", 1917: "reverse", 1931: "end", 1932: "player control", 1934: "song", 1935: "time warp",
  2015: "camera rotate", 2016: "camera guide", 2062: "camera edge", 2067: "scale", 2068: "adv random",
  2899: "options", 2903: "gradient", 3006: "area move", 3007: "area rotate", 3008: "area scale",
  3009: "area fade", 3010: "area tint", 3600: "end", 3602: "sfx", 3604: "event", 3613: "ui", 3615: "time",
  3618: "reset", 3619: "item edit", 3620: "item compare", 3640: "link visible", 3641: "persistent item",
  22: "enter fx", 23: "enter fx", 24: "enter fx", 25: "enter fx", 26: "enter fx", 27: "enter fx", 28: "enter fx",
  55: "enter fx", 56: "enter fx", 57: "enter fx", 58: "enter fx", 59: "enter fx", 1915: "enter fx (dont)",
  32: "trail on", 33: "trail off", 31: "start pos",
};
const COLOUR_TRIGGERS = new Set([29, 30, 104, 105, 221, 717, 718, 743, 744, 899, 900, 915, 1006]);
const PORTALS = { 45: "mirror", 46: "mirror off", 99: "mini", 101: "big", 286: "dual", 287: "dual off", 747: "teleport", 2902: "teleport" };
// ids the user's game knows that 2.1 did not have (2.2 objects)
const NEW_AFTER = 1950;

function classify(id) {
  const d = GD.objInfo(id);
  if (d.kind && d.kind !== "unknown") {
    if (d.kind === "mode" || d.kind === "speed" || d.kind === "gravity") return { cat: "portal", name: d.name };
    if (d.kind === "slope") return { cat: "solid", name: d.name };
    return { cat: d.kind, name: d.name }; // solid hazard orb pad
  }
  if (PORTALS[id]) return { cat: "portal", name: PORTALS[id] };
  if (TRIG[id]) return { cat: "trigger", name: TRIG[id] };
  const e = EXTRA[id];
  if (e) {
    if (e[0] === "trigger") return { cat: "trigger", name: "trigger " + id };
    // OpenGD files orbs/pads/portals under "hazard"; real hazards are the rest
    return { cat: e[0], name: (e[0] === "solid" ? "solid " : "hazard ") + id };
  }
  if (id >= NEW_AFTER && !Object.keys(EXTRA).length) return { cat: "unknown", name: "object " + id };
  if (id >= NEW_AFTER) return { cat: "new", name: "object " + id }; // 2.2: unknown, often deco or triggers
  return { cat: "deco", name: "deco " + id };
}
const GAMEPLAY = new Set(["solid", "hazard", "orb", "pad", "portal"]);

// ---------- header ----------
function headerInfo(h) {
  const kv = {};
  const parts = h.split(",");
  for (let i = 0; i + 1 < parts.length; i += 2) kv[parts[i]] = parts[i + 1];
  const chans = {};
  for (const c of (kv.kS38 || "").split("|")) {
    if (!c) continue;
    const f = c.split("_"), o = {};
    for (let i = 0; i + 1 < f.length; i += 2) o[f[i]] = f[i + 1];
    if (o[6]) chans[o[6]] = [+o[1], +o[2], +o[3]];
  }
  const rgb = a => a ? "#" + a.map(v => v.toString(16).padStart(2, "0")).join("") : "-";
  return {
    bg: +(kv.kA6 || 0), ground: +(kv.kA7 || 0), line: +(kv.kA17 || 0), font: +(kv.kA18 || 0),
    mg: +(kv.kA25 || 0), startMode: +(kv.kA2 || 0), startSpeed: +(kv.kA4 || 0), startMini: kv.kA3 === "1",
    colours: { bg: rgb(chans[1000]), g1: rgb(chans[1001]), line: rgb(chans[1002]), obj: rgb(chans[1004]), g2: rgb(chans[1009]) },
    userChannels: Object.keys(chans).filter(k => +k < 1000).length,
  };
}

// ---------- one level ----------
const SPEED_IX = { 200: 0, 201: 1, 202: 2, 203: 3, 1334: 4 };
const KA4 = { 0: 1, 1: 0, 2: 2, 3: 3, 4: 4 };
const MODE_NAMES = ["cube", "ship", "ball", "ufo", "wave", "robot", "spider", "swing"];

const LEVELS = new Map();
function analyse(L) {
  LEVELS.set(L.name, L);
  const objs = L.objects;
  const by = { solid: 0, hazard: 0, orb: 0, pad: 0, portal: 0, trigger: 0, deco: 0, new: 0, unknown: 0 };
  const trig = {}, ids = {};
  let maxX = 0, colourTrig = 0, hidden = 0, groups = 0, alphaZero = 0, glow = 0;
  const chUse = {};
  for (const o of objs) {
    const c = classify(o.id);
    by[c.cat] = (by[c.cat] || 0) + 1;
    ids[o.id] = (ids[o.id] || 0) + 1;
    if (c.cat === "trigger" || (c.cat === "new" && TRIG[o.id])) { trig[c.name] = (trig[c.name] || 0) + 1; if (COLOUR_TRIGGERS.has(o.id)) colourTrig++; }
    if (GAMEPLAY.has(c.cat)) maxX = Math.max(maxX, o.x);
    const p = o.props;
    if (p[135] === "1") hidden++;            // "hide" checkbox (unconfirmed key)
    if (p[57]) groups++;                     // in a group: something can move / fade / toggle it
    if (o.id === 1007 && +p[35] === 0) alphaZero++; // alpha trigger to 0 opacity (unconfirmed keys)
    if (p[96] === "1") glow++;               // "no glow" (unconfirmed key)
    for (const k of [21, 22]) if (p[k]) chUse[p[k]] = (chUse[p[k]] || 0) + 1;
  }
  const total = objs.length || 1;
  const hd = headerInfo(L.header);

  // sections: split at mode and speed portals, in x order
  const marks = objs.filter(o => { const d = GD.objInfo(o.id); return d.kind === "mode" || d.kind === "speed"; })
    .sort((a, b) => a.x - b.x);
  let mode = MODE_NAMES[hd.startMode] || "cube", sp = KA4[hd.startSpeed] ?? 1, x0 = 0, t = 0;
  const sections = [];
  const push = (x1) => {
    if (x1 - x0 < 30) return;
    const ups = GD.SPEEDS[sp].x * 60;
    const inside = objs.filter(o => o.x >= x0 && o.x < x1);
    const haz = inside.filter(o => classify(o.id).cat === "hazard").length;
    const act = inside.filter(o => { const c = classify(o.id).cat; return c === "orb" || c === "pad"; }).length;
    const prev = sections[sections.length - 1];
    if (prev && prev.mode === mode && prev.speed === GD.SPEEDS[sp].name) {
      prev.blocks += (x1 - x0) / 30; prev.secs += (x1 - x0) / ups; prev.hazards += haz; prev.orbsPads += act; return;
    }
    sections.push({ from: x0 / 30, mode, speed: GD.SPEEDS[sp].name, blocks: (x1 - x0) / 30, secs: (x1 - x0) / ups, start: t, hazards: haz, orbsPads: act });
  };
  for (const m of marks) {
    const d = GD.objInfo(m.id);
    const nm = d.kind === "mode" ? d.mode : mode, ns = d.kind === "speed" ? d.speed : sp;
    if (nm === mode && ns === sp) continue;
    push(m.x);
    t += (m.x - x0) / (GD.SPEEDS[sp].x * 60);
    x0 = m.x; mode = nm; sp = ns;
  }
  push(maxX + 30);
  let secs = 0;
  for (const s of sections) { s.start = secs; secs += s.secs; s.hazards = +(s.hazards / s.blocks * 10).toFixed(1); }

  // rests: runs of 6+ columns with no hazard anywhere in the column (a breather on the path)
  const hazCols = new Set();
  for (const o of objs) if (classify(o.id).cat === "hazard") hazCols.add(Math.floor(o.x / 30));
  const rests = [];
  let run = 0;
  for (let c = 0; c <= maxX / 30 + 1; c++) {
    if (!hazCols.has(c)) run++;
    else { if (run >= 6) rests.push({ at: c - run, len: run }); run = 0; }
  }

  return {
    name: L.name, short: L.short, source: L.source, objects: objs.length, blocks: Math.round(maxX / 30), secs: +secs.toFixed(1),
    by, decoShare: +((by.deco + by.trigger + (by.new || 0)) / total).toFixed(2), gameplayShare: +((by.solid + by.hazard + by.orb + by.pad + by.portal) / total).toFixed(2),
    triggers: trig, colourTriggers: colourTrig, hidden, grouped: groups, alphaZero, noGlow: glow,
    channels: Object.keys(chUse).length, header: hd, sections, rests, ids,
  };
}

// ---------- recurring gameplay chunks ----------
// A chunk = gameplay objects between two empty columns, at most 12 columns wide, rebased to its
// first column and the lowest row. Same picture = same chunk. Rendered as text, rows top first:
//   ^ spike  v hanging spike  , small spike  # block  - slab  / slope  o orb  _ pad  | portal
function glyph(o) {
  const d = GD.objInfo(o.id), c = classify(o.id).cat;
  if (c === "hazard") {
    if (d.shape === "smallspike" || d.shape === "midspike") return ",";
    const up = ((Math.round((o.rot || 0) / 90) % 4) + 4) % 4 === 2 || o.flipY;
    return d.shape === "spike" ? (up ? "v" : "^") : "x";
  }
  if (c === "solid") return d.kind === "slope" ? "/" : (d.hit && d.hit.h < 20 ? "-" : "#");
  if (c === "orb") return "o";
  if (c === "pad") return "_";
  if (c === "portal") return "|";
  return null;
}
function chunks(L, maxW = 12) {
  const cells = new Map();
  for (const o of L.objects) {
    const g = glyph(o);
    if (!g) continue;
    const col = Math.floor(o.x / 30), row = Math.floor(o.y / 30);
    if (row < -1 || row > 30) continue;
    const k = col + "," + row;
    if (!cells.has(k) || g !== "#") cells.set(k, g); // a hazard on a block wins the cell
  }
  const cols = new Map();
  for (const [k, g] of cells) { const [c, r] = k.split(",").map(Number); if (!cols.has(c)) cols.set(c, []); cols.get(c).push([r, g]); }
  const sorted = [...cols.keys()].sort((a, b) => a - b);
  const out = [];
  let cur = [];
  const flush = () => {
    if (!cur.length) return;
    const c0 = cur[0], c1 = cur[cur.length - 1];
    if (c1 - c0 + 1 <= maxW) {
      let rmin = 99, rmax = -99;
      for (const c of cur) for (const [r] of cols.get(c)) { rmin = Math.min(rmin, r); rmax = Math.max(rmax, r); }
      if (rmax - rmin < 10) {
        const grid = [];
        for (let r = rmax; r >= rmin; r--) {
          let s = "";
          for (let c = c0; c <= c1; c++) { const e = (cols.get(c) || []).find(([rr]) => rr === r); s += e ? e[1] : "."; }
          grid.push(s);
        }
        const hasHaz = grid.some(s => /[\^v,xo_|]/.test(s));
        if (hasHaz) out.push({ at: c0, ground: rmin <= 0, pic: grid.join("\n") });
      }
    }
    cur = [];
  };
  for (const c of sorted) { if (cur.length && c - cur[cur.length - 1] > 1) flush(); cur.push(c); }
  flush();
  return out;
}

// ---------- motifs: small counts that say how a level's gameplay is put together ----------
// spikeRuns: upright spikes side by side on one row -> how many runs of 1, 2, 3, 4+
// gaps: empty columns between two hazard groups -> histogram (the breathing rhythm)
// rows: rows the upright spikes sit on (0 = ground; higher = on platforms)
function motifs(L) {
  const spikes = L.objects.filter(o => GD.objInfo(o.id).shape === "spike" && !(o.flipY || Math.round((o.rot || 0) / 90) % 4 === 2))
    .map(o => [Math.round((o.x - 15) / 30), Math.round((o.y - 15) / 30)]);
  const byRow = new Map();
  for (const [c, r] of spikes) { if (!byRow.has(r)) byRow.set(r, new Set()); byRow.get(r).add(c); }
  const runs = { 1: 0, 2: 0, 3: 0, "4+": 0 }, rows = {};
  for (const [r, set] of byRow) {
    const cs = [...set].sort((a, b) => a - b);
    let n = 1;
    for (let i = 1; i <= cs.length; i++) {
      if (i < cs.length && cs[i] === cs[i - 1] + 1) { n++; continue; }
      runs[n >= 4 ? "4+" : n]++; n = 1;
    }
    rows[r] = cs.length;
  }
  const hc = [...new Set(L.objects.filter(o => classify(o.id).cat === "hazard").map(o => Math.floor(o.x / 30)))].sort((a, b) => a - b);
  const gaps = {};
  for (let i = 1; i < hc.length; i++) { const g = hc[i] - hc[i - 1] - 1; if (g > 0) { const k = g >= 12 ? "12+" : g; gaps[k] = (gaps[k] || 0) + 1; } }
  return { spikeRuns: runs, gaps, spikeRows: rows };
}

// ---------- printing ----------
function pct(x) { return Math.round(x * 100) + "%"; }
function line(a) {
  const top = Object.entries(a.triggers).sort((x, y) => y[1] - x[1]).slice(0, 4).map(([k, v]) => `${k} ${v}`).join(", ");
  const modes = [...new Set(a.sections.map(s => s.mode))].join("/");
  return `${a.short.slice(0, 24).padEnd(24)} ${String(a.objects).padStart(6)} ${String(a.blocks).padStart(5)} ${String(a.secs).padStart(6)}  ` +
    `${pct(a.gameplayShare).padStart(4)} ${pct(a.decoShare).padStart(4)}  ${String(a.colourTriggers).padStart(4)} ${String(a.sections.length).padStart(3)} ${String(a.rests.length).padStart(3)}  bg${a.header.bg} g${a.header.ground}  ${modes}  ${top}`;
}
const HEAD = "level                    objects blocks   secs  play deco  colT sec rst  bg/gnd  modes  top triggers";

function detail(a) {
  console.log(`\n== ${a.name}: ${a.objects} objects, ${a.blocks} blocks, ${a.secs} s`);
  console.log("   kinds: " + Object.entries(a.by).filter(([, v]) => v).map(([k, v]) => `${k} ${v}`).join(", "));
  console.log(`   header: bg ${a.header.bg}, ground ${a.header.ground}, line ${a.header.line}, colours ${JSON.stringify(a.header.colours)}`);
  console.log(`   colour channels used by objects: ${a.channels}; grouped objects: ${a.grouped}; hide flag: ${a.hidden}; alpha-to-0 triggers: ${a.alphaZero}`);
  console.log("   triggers: " + (Object.entries(a.triggers).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k} ${v}`).join(", ") || "none"));
  console.log("   sections (from block, mode, speed, length, start s, hazards per 10 blocks, orbs+pads):");
  for (const s of a.sections) console.log(`     ${String(Math.round(s.from)).padStart(5)}  ${s.mode.padEnd(6)} ${s.speed.padEnd(4)} ${String(Math.round(s.blocks)).padStart(4)} blocks  ${s.start.toFixed(1).padStart(5)} s  ${String(s.hazards).padStart(4)}  ${s.orbsPads}`);
  console.log("   rests (6+ columns with no hazard): " + a.rests.map(r => `${r.at}+${r.len}`).join(" "));
  const m = motifs(LEVELS.get(a.name));
  console.log(`   spike runs ${JSON.stringify(m.spikeRuns)}  gaps between hazards ${JSON.stringify(m.gaps)}  spike rows ${JSON.stringify(m.spikeRows)}`);
  const topIds =Object.entries(a.ids).sort((x, y) => y[1] - x[1]).slice(0, 12).map(([id, n]) => `${id}(${classify(+id).cat}) ${n}`).join(", ");
  console.log("   most used ids: " + topIds);
}

function patternTable(levels, top = 25) {
  const tally = new Map();
  for (const L of levels) {
    const seen = new Set();
    for (const ch of chunks(L)) {
      const t = tally.get(ch.pic) || { pic: ch.pic, n: 0, levels: 0, where: [] };
      t.n++;
      if (!seen.has(ch.pic)) { t.levels++; seen.add(ch.pic); t.where.push(`${L.short}@${ch.at}`); }
      tally.set(ch.pic, t);
    }
  }
  return [...tally.values()].filter(t => t.pic.length > 1).sort((a, b) => b.levels - a.levels || b.n - a.n).slice(0, top);
}

function load(what) {
  if (what === "official") return corpus.officialAll();
  if (what === "mine") return corpus.mine();
  if (what === "all") return corpus.officialAll().concat(corpus.mine());
  if (/^\d+$/.test(what)) return [corpus.official(+what)];
  if (what.endsWith(".gdlvl")) return [corpus.file(what)];
  return corpus.mine().filter(l => l.short === what);
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const flags = new Set(args.filter(a => a.startsWith("--")));
  const ji = args.indexOf("--json");
  const what = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--json")[0] || "all";
  const levels = load(what);
  const res = levels.map(analyse);
  console.log(HEAD);
  for (const a of res) console.log(line(a));
  if (flags.has("--detail")) for (const a of res) detail(a);
  if (flags.has("--patterns")) {
    console.log("\nrecurring gameplay chunks (levels using it, times used, first places):");
    for (const t of patternTable(levels)) {
      console.log(`\n  in ${t.levels} levels, ${t.n} times: ${t.where.slice(0, 4).join(", ")}`);
      console.log(t.pic.split("\n").map(s => "    " + s).join("\n"));
    }
  }
  if (ji >= 0) fs.writeFileSync(args[ji + 1], JSON.stringify(res, null, 1));
}
module.exports = { analyse, classify, chunks, motifs, patternTable, headerInfo, load };
