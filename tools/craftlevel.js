// node tools/craftlevel.js briefs/<craft brief>.json [--out specs/NN_name.json]   -> a make.js spec
//
// The craft composer (CRAFT.md "Generator"): a level as sections on the song's bars, each section a list of
// craft chunks (structures from tools/structures.js, mostly over pit floors, or raw objects), laid end to
// end with short calm floors between them, one saturated hue per section (background + darker ground,
// switched instantly on the section's first bar), the mode portal at the section start, and the craft
// pass on ("craft": true: rods on pillar tops, chains holding floating pieces and orbs). Constant speed
// (the column of a bar is computed from the speed), so sections land on bars within a block.
//
// Brief:
// { "name": "GDLM NN words", "desc": "...", "song": {"custom": id}, "offset": s, "grid": {"bpm", "t0"},
//   "speed": "1x", "seed": n, "lead": 10 (calm blocks before the first chunk),
//   "sections": [ { "bars": 4, "mode": "cube"|"ship"|"ball", "hue": [r,g,b],
//                   "build": [n bars of xStep-style hue flashes before the NEXT section, 0 = none],
//                   "chunks": [ "pillar-hop", {"s": "capped-hop", "args": {...}}, {"raw": [[type,col,row,extra]...], "w": n},
//                               {"rest": n} ] } ... ] }
// A chunk's columns are relative to its start; "rest" is n blocks of calm floor. Between chunks the composer
// adds `gap` (default 4: the 4+ column run-up between groups of the reactive rule) calm blocks. A section shorter than its bars is padded with calm floor (the lead-in
// to the next portal) after its chunks are cycled into the space ("fill": false: a deliberate calm); a longer
// one is reported (the next section starts late).
const fs = require("fs"), path = require("path");
const { GD } = require("./io.js");
const ST = require("./structures.js");

const MODE_PORTAL = { cube: "cube portal", ship: "ship portal", ball: "ball portal", ufo: "ufo portal", wave: "wave portal", robot: "robot portal" };
const SPEED_X = { "0.5x": 4.1860014, "1x": 5.193001701, "2x": 6.4570022, "3x": 7.8000026, "4x": 9.6000032 }; // units per 1/60 s (lib/physics.js SPEEDS)

function shift(objs, dc) {
  return objs.filter(o => Array.isArray(o)).map(o => {
    if (o[0] === "pattern") return [o[0], o[1], o[2] + dc, ...o.slice(3)];
    return [o[0], o[1] + dc, ...o.slice(2)];
  });
}
function chunkOf(c) {
  if (typeof c === "string") c = { s: c };
  if (c.rest != null) return { objects: [], width: c.rest };
  if (c.raw) return { objects: c.raw, width: c.w };
  const st = ST.byId(c.s);
  if (!st) throw new Error("no structure " + c.s);
  const r = st.build(Object.assign({}, st.args, c.args || {}));
  return { objects: r.objects, width: r.width, exitRow: r.exitRow };
}
// the portal into mode m at column c: from the cube (on the floor) on row 1, so the cube walks into it; from a
// flying mode a wall of three (rows 1, 4, 7), so it is taken at any height (tools/structures.js harness)
const LEAD_AFTER = { cube: 6, ship: 8, ball: 5, ufo: 4, wave: 4, robot: 4 };
const FLY = new Set(["ship", "ufo", "wave", "swing"]);
// Out of a flying mode: ONE portal on the last chunk's exit row, in a funnel of blocks (a 3-row gap), so
// the player cannot miss it -- a wall of three left two untouched, which score.js "skips" fails (GDLM 61 v2).
// Out of the ball: one portal on row 1 (the craft ball parts end on the floor: no roof to stay on).
const portalAt = (m, c, from, exitRow) => {
  if (!FLY.has(from)) return [[MODE_PORTAL[m], c, 1]];
  const r = Math.max(2, Math.min(8, exitRow ?? 4)), o = [[MODE_PORTAL[m], c, r]];
  for (let y = 0; y <= r - 2; y++) o.push(["block", c, y]);
  for (let y = r + 2; y <= 11; y++) o.push(["block", c, y]);
  return o;
};
const dark = (rgb, k) => rgb.map(v => Math.round(v * k));
const light = (rgb, k) => rgb.map(v => Math.round(v + (255 - v) * k));

function compose(brief) {
  const blocksPerSec = SPEED_X[brief.speed || "1x"] * 60 / 30;
  const period = 60 / brief.grid.bpm, barSec = 4 * period;
  // the first bar start at or after the level start (song second `offset`)
  let k = Math.ceil((brief.offset - brief.grid.t0) / barSec - 1e-6);
  const bar0 = brief.grid.t0 + k * barSec - brief.offset;  // level seconds of bar 0
  const colOfBar = b => Math.round((bar0 + b * barSec) * blocksPerSec);
  const objects = [], notes = [];
  let col = brief.lead || 10, bar = 0, mode = "cube", lastEnd = 0, exitRow = null;
  const lead = brief.lead || 10;
  if (colOfBar(0) < lead) bar = Math.ceil((lead / blocksPerSec - bar0) / barSec);
  brief.sections.forEach((sec, si) => {
    const start = colOfBar(bar), end = colOfBar(bar + sec.bars);
    if (start < col) notes.push(`section ${si} (${sec.mode}) starts ${col - start} blocks late`);
    col = Math.max(col, start);
    // colours: instant switch on the section's first bar
    objects.push(["colour", col, { ch: "bg", rgb: sec.hue, secs: 0 }], ["colour", col, { ch: "ground", rgb: dark(sec.hue, 0.45), secs: 0 }]);
    const m = sec.mode || "cube";
    if (m !== mode) {
      // a calm floor before the portal (the natural route jumped over a portal 3 blocks after a tower), and
      // the rated lead-in after it (tools/score.js lead-in: cube 6, ship 8, ball 5)
      col = Math.max(col, lastEnd + 6);
      objects.push(...portalAt(m, col, mode, exitRow)); mode = m; col += LEAD_AFTER[m] || 4;
    }
    sec.chunks.forEach((c, i) => {
      const ch = chunkOf(c);
      objects.push(...shift(ch.objects, col));
      col += ch.width; lastEnd = col; exitRow = ch.exitRow ?? null; col += i < sec.chunks.length - 1 ? (sec.gap ?? 4) : 0;
    });
    // fill: a section shorter than its bars was padded with flat floor -- the user on GDLM 61 v3, 38-46 s:
    // "very big breaks with nothing". Cycle the section's own chunks into the space (leaving the next
    // portal's calm floor); "fill": false keeps a deliberate calm (then accept "dead air" with the reason).
    if (sec.fill !== false) {
      const room = () => end - 8 - (col + (sec.gap ?? 4));
      for (let i = 0, tries = 0; tries < sec.chunks.length * 3; i++, tries++) {
        const c = sec.chunks[i % sec.chunks.length]; if (c && c.rest != null) continue;
        const ch = chunkOf(c); if (ch.width > room()) continue;
        col += sec.gap ?? 4; objects.push(...shift(ch.objects, col)); col += ch.width; lastEnd = col; exitRow = ch.exitRow ?? null; tries = 0;
      }
      if (end - col > 30) notes.push(`section ${si} (${m}) leaves ${end - col} blocks of flat floor: add chunks or mark it "fill": false`);
    }
    if (col > end) notes.push(`section ${si} (${m}) runs ${col - end} blocks past its ${sec.bars} bars`);
    // xStep's build-up: hue flashes (a lighter tint and back) on beats, closer together, into the next section
    if (sec.build) {
      const bStart = bar + sec.bars - sec.build;
      for (let beat = 0; beat < sec.build * 4; beat += beat < sec.build * 2 ? 2 : 1) {
        const c = Math.round((bar0 + (bStart * 4 + beat) * period) * blocksPerSec);
        objects.push(["colour", c, { ch: "bg", rgb: light(sec.hue, 0.35), secs: 0 }], ["colour", c + 1, { ch: "bg", rgb: sec.hue, secs: period * 0.8 }]);
      }
    }
    bar += sec.bars;
    col = Math.max(col + 3, colOfBar(bar) - 0);
  });
  if (mode !== "cube") { col = Math.max(col, lastEnd + 6); objects.push(...portalAt("cube", col, mode, exitRow)); col += 8; }
  const spec = {
    name: brief.name, desc: brief.desc, song: brief.song, offset: brief.offset, grid: brief.grid, seed: brief.seed || 1,
    style: "classic", craft: brief.craft ?? true, colours: { bg: brief.sections[0].hue, ground: dark(brief.sections[0].hue, 0.45) },
    decoDensity: [[0, brief.decoDensity ?? 0.2]], indicators: brief.indicators ?? { all: false },
    // the 1.x look (CRAFT.md 4): the plain squares background, the plain ground, NO middleground hills (the
    // template's bg 57 and hill band hid the black pit spikes and fought the black-and-white playfield)
    art: Object.assign({ bg: 1, ground: 1, mg: 0 }, brief.art || {}),
    notes: (brief.notes || "") + " | composed by tools/craftlevel.js from " + (brief.file || "a brief"),
    objects: [...objects, ...(brief.extra || [])],
  };
  if (brief.accept) spec.accept = brief.accept;   // gates the level breaks on purpose, each with its reason (score.js)
  if (brief.speed && brief.speed !== "1x") spec.speed = brief.speed;
  return { spec, notes, endCol: col };
}

if (require.main === module) {
  const args = process.argv.slice(2), file = args[0];
  if (!file) { console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n")); process.exit(1); }
  const brief = JSON.parse(fs.readFileSync(file, "utf8")); brief.file = file.replace(/\\/g, "/");
  const oi = args.indexOf("--out");
  const out = oi >= 0 ? args[oi + 1] : path.join("specs", path.basename(file).replace(/^craft_/, ""));
  const { spec, notes, endCol } = compose(brief);
  fs.writeFileSync(out, JSON.stringify(spec, null, 1));
  console.log(`${out}: ${spec.objects.length} entries, ends at column ${endCol} (~${(endCol / (SPEED_X[brief.speed || "1x"] * 2)).toFixed(1)} s)`);
  for (const n of notes) console.log("  NOTE " + n);
}
module.exports = { compose };
