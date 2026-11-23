// node tools/make.js specs/<name>.json   -> levels/<name>.gdlvl, checked, and added to the viewer
//
// A spec is written in grid squares, not GD units: column 0 is where the player starts,
// row 0 is the first square above the ground.
// {
//   "name": "01 one jump",            // the name shown in GD's level list
//   "desc": "one spike",              // optional
//   "objects": [                      // [type, column, row, {extra}] -- extra: rot, flipX, flipY
//     ["spike", 12, 0],
//     ["block", 20, 0],
//     ["spike", 24, 3, {"rot": 180}]
//   ]
// }
// type is a name from TYPES below or a raw object id number.
//
// Style (see STYLE.md; tools/patterns.js, tools/decorate.js):
//   extra may also hold "group": n (fade/move target) and "ch": n (colour channel).
//   ["pattern", name, col, row, {args}, {extra for every object}]   a named chunk
//   ["colour", col, {"ch": "bg"|"ground"|"obj"|n, "rgb": [r,g,b], "secs": 0.5}]
//   ["fade", col, {"group": n, "to": 0, "secs": 0.2}]   alpha trigger: hide (or show) a group
//   ["zoom", col, {"to": 0.7}]                             camera zoom (0.7 = see more)
//   "style": "classic" -> outlined block skins + ground decoration; any other style name
//            (e.g. "hell") -> skins only, the look comes from its colours
//   "colours": {"bg": [r,g,b], "ground": [r,g,b], ...}   start colours in the header
//   "art": {"bg": n, "ground": n}                        background / ground art numbers
//   "modern": {"sections": [{from, to, kind, fill, light}], "title": "...", "end": "..."}   the modern
//                          decoration pass (tools/decorate.js modernPass; compose.js fills it in)
//   "decoDensity": [[fromCol, share], ...]   classic style: share of free columns with ground
//                          decoration from that column on (default 0.25; compose.js sets it per section)
//   "indicators": {"id": N, "rot": n, "at": [cols], "all": false}   a small arrow pointing down over
//                          the jumps a player cannot read in time (far cue, ledge, after a portal,
//                          first of a new pattern), from the solver's run (tools/decorate.js)
//
// Music (optional; see SYNC.md):
//   "song": {"custom": 233860} or {"official": 1} (1 = Stereo Madness ... 22 = Dash)
//   "offset": 120          // the song second the level starts at (GD's kA13)
//   "speed": "1x"          // start speed: 0.5x 1x 2x 3x 4x
//   "grid": {"bpm": 165.01, "t0": 0.064}  // the song's beat grid; left out = taken from
//                          // local/beats (node tools/beats.js) and printed, so it can be pinned here
//   "snap": 0              // round beat positions to this many units (0 = exact, 15 = half a block)
// With a song, any column (also a pattern's or a trigger's) can be a beat instead of a number:
//   "b12"     the column where the player's centre is on beat 12 (beat 1 = the first beat at or
//             after the level start; "b12.5" = halfway to beat 13). Orbs, pads and portals put
//             here are hit on the beat: that is how the official levels place them (SYNC.md).
//   "j12"     where a spike on the ground must go for the jump over it to be pressed on beat 12;
//             everything placed at "j12..." moves together until the press is on the beat
//   "b12+3"   three columns after that ("j12-0.5" etc. also work)
// Speed portals placed by beat change the timing of everything after them; they are placed first.
// After building, make.js prints where each press's timing window falls in beats.
const fs = require("fs");
const path = require("path");
const { GD, writeGdlvl } = require("./io.js");
Object.assign(GD, require("../lib/sync.js"));
const { report } = require("./check.js");
const { sightread } = require("./sightread.js");
const { buildIndex } = require("./index_levels.js");
const { expand } = require("./patterns.js");
const deco = require("./decorate.js");

const TYPES = { block: 1, spike: 8, slope: 1338, "small spike": 39, "yellow orb": 36, "blue orb": 84, "yellow pad": 35, "blue pad": 67,
  "pink orb": 141, "red orb": 1333, "pink pad": 140, "mirror portal": 45, "mirror off": 46,
  "red pad": 1332, "spider orb": 3004, "spider pad": 3005, "green dash orb": 1704,
  "cube portal": 12, "ship portal": 13, "ball portal": 47, "ufo portal": 111, "wave portal": 660,
  "robot portal": 745, "spider portal": 1331, "swing portal": 1933,
  "gravity down": 11, "gravity up": 10,
  "0.5x speed": 200, "1x speed": 201, "2x speed": 202, "3x speed": 203, "4x speed": 1334 };
const SPEED_NAMES = { "0.5x": 1, "1x": 0, "2x": 2, "3x": 3, "4x": 4 }; // -> kA4
const SPECIAL = ["pattern", "colour", "fade", "zoom"];

function slug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""); }

function toObj([type, col, row, extra], specFile) {
  const id = typeof type === "number" ? type : TYPES[type];
  if (!id) throw new Error(`unknown type "${type}" in ${specFile}`);
  const e = extra || {};
  const props = { 155: "1" };
  if (e.group != null) props[57] = String(e.group);
  if (e.ch != null) props[21] = String(e.ch);
  if (e.props) Object.assign(props, e.props);   // raw object keys, e.g. a text object's 31
  return { id, x: +(col * 30 + 15).toFixed(3), y: row * 30 + 15, rot: e.rot || 0, flipX: !!e.flipX, flipY: !!e.flipY, props };
}

// how far ahead of the press a lone ground spike sits when the press is in the middle of its
// window, and how long a jump stays in the air, at each speed (found by solving a one-spike level)
const jumpInfo = {};
function jumpAt(kA4) {
  if (jumpInfo[kA4]) return jumpInfo[kA4];
  const x = 900;
  const header = GD.DEFAULT_HEADER.replace(/(^|,)kA4,\d+/, "$1kA4," + kA4);
  const w = GD.makeWorld([{ id: 8, x, y: 15, rot: 0, props: {} }], header);
  const r = GD.solve(w);
  if (!r.ok || !r.clicks.length) throw new Error("cannot work out the jump lead at kA4 " + kA4);
  const path = GD.run(w, r.events).path, t = r.clicks[0].tick;
  let land = t + 2;
  while (land < path.length - 1 && !path[land].grounded) land++;
  return (jumpInfo[kA4] = { lead: x - r.clicks[0].x, air: (land - t) / GD.PHYS.TPS });
}

function songOf(spec) {
  const s = spec.song;
  if (!s) return null;
  const { OFFICIAL } = require("./beats.js");
  if (s.custom) return { url: "/song/custom/" + s.custom + ".mp3", k45: String(s.custom) };
  const n = typeof s.official === "number" ? s.official : OFFICIAL.findIndex(o => o.toLowerCase() === String(s.official).replace(/\W/g, "").toLowerCase()) + 1;
  if (!(n >= 1 && n <= 22)) throw new Error("unknown official song " + JSON.stringify(s.official));
  return { url: "/song/official/" + OFFICIAL[n - 1] + ".mp3", k8: String(n - 1) };
}
function gridOf(spec, song) {
  if (spec.grid) {
    const period = spec.grid.period || 60 / spec.grid.bpm;
    return { period, t0: spec.grid.t0 || 0, bpm: 60 / period };
  }
  const b = require("./beats.js").loadBeats(song.url);
  if (!b || !b.ok) throw new Error(`no beat grid for ${song.url}: run "node tools/beats.js" (the song must be on this PC) or put "grid": {"bpm", "t0"} in the spec`);
  console.log(`   grid from local/beats: "grid": {"bpm": ${b.bpm}, "t0": ${b.t0}}  (${b.conf} confidence; paste it into the spec to pin it)`);
  return { period: b.period, t0: b.t0, bpm: b.bpm, conf: b.conf };
}

// a spec column -> a (possibly fractional) column number. Numbers pass through; "b12", "j12.5+2"
// are beats. tl = the speed timeline so far.
function toCol(col, ctx, tl) {
  if (typeof col === "number") return col;
  const m = /^([bj])(-?\d+(?:\.\d+)?)([+-]\d+(?:\.\d+)?)?$/.exec(String(col).trim());
  if (!m) throw new Error(`bad column "${col}": use a number, "b12", "j12" or "b12+3"`);
  if (!ctx.grid) throw new Error(`column "${col}" needs a "song" in the spec`);
  const t = GD.SYNC.beatToTime(ctx.grid, ctx.offset, +m[2]);
  if (t < 0) throw new Error(`beat ${m[2]} is before the level starts`);
  let x = GD.SYNC.xOfT(tl, t);
  if (m[1] === "j") x += jumpAt(ctx.kA4).lead;
  if (m[3]) x += +m[3] * 30;
  if (ctx.snap) x = Math.round(x / ctx.snap) * ctx.snap;
  return (x - 15) / 30;
}
const colAt = entry => entry[0] === "pattern" ? 2 : 1;

// Orbs on the arc (orb-ladder, orb-pit from the ground; args "fixed": true keeps the pattern's rows).
// The user on GDLM 44's ladder: "very awkward; in lower difficulty levels there should be better space
// to click the orb, and clicking in the middle is almost the point (where you can mostly buffer)". So
// each orb goes at the TOP of the arc that reaches it -- the jump before the pit, then each orb's own
// launch: the cube passes through the orb's centre and is slowest there, so a press in the middle (or
// a held button) takes it. Simulated in an empty world (lib/physics.js) at the level's speed; the spike
// pit runs from the pattern's column to one column before the landing.
function arcOrbs(name, col, args, header, specFile) {
  const n = name === "orb-pit" ? 1 : (args.n || (args.rows || [2, 3, 4]).length);
  const orbType = args.orb || "yellow orb";
  const end = toObj(["block", col + 80, 12], specFile);   // the world's end, out of the way
  const orbs = [];
  const world = () => GD.makeWorld(orbs.concat([end]), header);
  // the takeoff: half a column before the pit
  const p0 = GD.run(world(), []).path;
  let t = p0.findIndex(p => p.x >= col * 30 - 20);
  const events = [{ tick: t, type: "press" }, { tick: t + 1, type: "release" }];
  for (let k = 0; k < n; k++) {
    const path = GD.run(world(), events).path;
    let a = t + 2;
    while (a + 1 < path.length && path[a + 1].y > path[a].y) a++;          // the apex
    const ox = Math.round(path[a].x / 7.5) * 7.5, oy = Math.round(path[a].y / 7.5) * 7.5;
    const o = toObj([orbType, (ox - 15) / 30, (oy - 15) / 30], specFile);
    o.x = ox; o.y = oy; orbs.push(o);
    // press where the cube is closest to the orb's centre
    const p2 = GD.run(world(), events).path;
    let best = a, bd = Infinity;
    for (let i = t + 1; i < p2.length && p2[i].x < ox + 40; i++) { const d = Math.hypot(p2[i].x - ox, p2[i].y - oy); if (d < bd) { bd = d; best = i; } }
    t = best;
    events.push({ tick: t, type: "press" }, { tick: t + 1, type: "release" });
  }
  // landing after the last orb: the pit ends one column before it
  const path = GD.run(world(), events).path;
  let l = t + 2;
  while (l < path.length && !(path[l].grounded && path[l].y < 20)) l++;
  const landCol = Math.floor(((path[Math.min(l, path.length - 1)].x) - 15) / 30);
  const out = orbs.slice();
  for (let c = col; c < landCol - 1; c++) out.push(toObj(["spike", c, 0], specFile));
  return out;
}

// spec (already parsed) -> { level, rec, ctx, objects, header }: everything but writing and checking
function build(spec, specFile = "spec") {
  const song = songOf(spec);
  const kA4 = spec.speed ? SPEED_NAMES[spec.speed] : 0;
  if (kA4 === undefined) throw new Error("speed must be one of " + Object.keys(SPEED_NAMES).join(" "));
  let header = GD.DEFAULT_HEADER.replace(/(^|,)kA4,\d+/, "$1kA4," + kA4);
  if (spec.offset) header = header.replace(/(^|,)kA13,[-0-9.]+/, "$1kA13," + spec.offset);
  if (spec.colours) header = deco.setHeaderColours(header, spec.colours);
  if (spec.art) header = deco.setHeaderArt(header, spec.art.bg, spec.art.ground);
  const ctx = { grid: song ? gridOf(spec, song) : null, offset: spec.offset || 0, kA4, snap: spec.snap || 0 };

  // speed portals first, in order along the level, each one updating the timeline
  const timelineOf = objs => GD.SYNC.timeline(GD.makeWorld(objs, header));
  const idOf = e => SPECIAL.includes(e[0]) ? null : typeof e[0] === "number" ? e[0] : TYPES[e[0]];
  const isSpeed = e => { const id = idOf(e); return !!id && GD.objInfo(id).kind === "speed"; };
  const speedObj = new Map(), placed = [];
  const speeds = spec.objects.filter(isSpeed);
  while (speeds.length) {
    const tl0 = timelineOf(placed);
    speeds.sort((a, b) => toCol(a[1], ctx, tl0) - toCol(b[1], ctx, tl0));
    const e = speeds.shift(), o = toObj([e[0], toCol(e[1], ctx, tl0), e[2], e[3]], specFile);
    speedObj.set(e, o); placed.push(o);
  }
  const tl = timelineOf(placed);

  const objects = [], jGroups = new Map();
  for (const entry of spec.objects) {
    const start = objects.length;
    const col = toCol(entry[colAt(entry)], ctx, tl);
    const [type, , row] = entry;
    if (speedObj.has(entry)) objects.push(speedObj.get(entry));
    else if (type === "pattern" && /^orb-(ladder|pit)$/.test(entry[1]) && !(entry[4] || {}).fixed && !entry[3]) objects.push(...arcOrbs(entry[1], col, entry[4] || {}, header, specFile));
    else if (type === "pattern") { for (const e of expand(entry[1], col, entry[3], entry[4], entry[5])) objects.push(toObj(e, specFile)); }
    else if (type === "colour") { const a = entry[2]; objects.push(deco.colourTrigger(col, a.ch, a.rgb, a.secs ?? 0.5)); }
    else if (type === "fade") { const a = entry[2]; objects.push(deco.fadeTrigger(col, a.group, a.to ?? 0, a.secs ?? 0.2)); }
    else if (type === "zoom") { const a = entry[2] || {}; objects.push(deco.zoomTrigger(col, a.to ?? 0.7, a.secs ?? 0.5)); }
    else objects.push(toObj([type, col, row, entry[3]], specFile));
    const jm = /^j(-?\d+(?:\.\d+)?)/.exec(String(entry[colAt(entry)]));
    if (jm) { if (!jGroups.has(jm[1])) jGroups.set(jm[1], []); for (let i = start; i < objects.length; i++) jGroups.get(jm[1]).push(i); }
  }

  if (ctx.grid && jGroups.size) {
    // jumps closer together than a jump lasts cannot all be pressed on their beats
    const js = [...jGroups.keys()].map(Number).sort((a, b) => a - b);
    const air = jumpAt(kA4).air, need = air / ctx.grid.period;
    for (let i = 1; i < js.length; i++) if (js[i] - js[i - 1] < need)
      console.log(`   NOTE jumps on beats ${js[i - 1]} and ${js[i]} are closer than a jump lasts (${air.toFixed(2)} s = ${need.toFixed(2)} beats here): the second cannot be on its beat`);
    nudgeJumps(jGroups, objects, header, ctx, tl);
  }

  if (spec.modern) objects.push(...deco.modernPass(objects, spec.modern.sections || [], spec.modern)); // before skins: fills follow gameplay blocks
  if (spec.style && spec.style !== "classic") deco.skinBlocks(objects); // e.g. "hell": outlined blocks, no ground decoration
  if (spec.style === "classic") {
    deco.skinBlocks(objects);
    const end = Math.max(...objects.map(o => o.x)) / 30 + 4;
    const dd = (spec.decoDensity || []).slice().sort((a, b) => a[0] - b[0]);
    const densityAt = c => { let v = 0.25; for (const [from, share] of dd) if (c >= from) v = share; return v; };
    objects.push(...deco.groundDeco(objects, end, spec.seed || 7, densityAt));
  }
  const level = { header, objects };
  const rec = GD.newRecord(spec.name, spec.desc || "made by GDLevelMaker");
  if (song && song.k45) GD.setField(rec, "k45", "i", song.k45);
  if (song && song.k8) GD.setField(rec, "k8", "i", song.k8);
  return { level, rec, ctx, objects, header };
}

// spec file (or an already parsed spec) -> levels/<name>.gdlvl, checked, added to the viewer
function make(specFile, specObj) {
  const spec = specObj || JSON.parse(fs.readFileSync(specFile, "utf8"));
  const { level, rec, ctx, objects, header } = build(spec, specFile);
  const out = path.join(__dirname, "..", "levels", slug(spec.name) + ".gdlvl");
  writeGdlvl(out, rec, level);
  let r = report(out);
  if (spec.indicators && r.ok) {
    // jump indicators come from the solved run, so they go in after the first check (no hitbox:
    // the solution does not change); then the file is written again. Without the arrow's id yet,
    // only say where they would go.
    const iid = spec.indicators.id || deco.INDICATOR.id;
    // from the natural plan (taps, no empty jumps), not the solver's held-button run
    const wI = GD.makeWorld(level.objects, header);
    let plan = r;
    try { const n = require("../lib/natural.js").naturalPlan(wI, r, level.objects); if (n && n.path[n.path.length - 1].done) plan = { ok: true, events: n.events }; } catch (e) {}
    const ind = deco.jumpIndicators(wI, plan, iid || 0, GD, spec.indicators);
    if (iid) {
      level.objects.push(...ind.map(o => { const c = Object.assign({}, o); delete c.why; return c; }));
      if (ind.length) level.objects.push(deco.indicatorFade(spec.indicators));  // soft: faded group
      writeGdlvl(out, rec, level);
      console.log(`   ${ind.length} jump indicators (object ${iid}): ` + ind.map(o => `${(o.x / 30).toFixed(0)} ${o.why}`).join("; "));
    } else console.log(`   ${ind.length} jump indicators planned (arrow object id not known yet): ` + ind.map(o => `${(o.x / 30).toFixed(0)} ${o.why}`).join("; "));
  }
  if (ctx.grid && r.ok) beatReport(objects, header, r, ctx);
  if (r.ok) { // the user's fairness rule: no prejumps (see tools/sightread.js)
    const s = sightread(level);
    const bad = s.ok ? s.presses.filter(p => p.flag) : [];
    for (const p of bad) console.log(`   PREJUMP at block ${p.from.toFixed(1)}-${p.to.toFixed(1)}: jump ${p.lead.toFixed(1)} blocks before ${p.cue} at ${p.cueAt.toFixed(1)}`);
    console.log(bad.length ? `   NOT sight-readable: ${bad.length} prejump(s)` : "   sight-readable: every press is cued by what is right in front");
  }
  // save the solution (natural replay) so the viewer and the phone replay it, not solve it again
  // r: the check's solve (indicators have no hitbox, so it still holds)
  try { const L2 = require("./io.js").readGdlvl(out); require("./solutions.js").fromRun(L2.level, L2.levelStr, r); } catch (e) { console.log("   (solution not saved: " + e.message + ")"); }
  buildIndex();
  return { out, r };
}

// "jN" is placed for a lone spike. Runs of spikes, blocks and orbs change where the press goes,
// so solve, find the press that clears each jN group (the objects placed at "jN..."), and slide
// the group until the middle of that press's window is on beat N. A few rounds settle it.
function nudgeJumps(groups, objects, header, ctx, tl) {
  const beatUnits = GD.SYNC.xOfT(tl, ctx.grid.period * 1.5) - GD.SYNC.xOfT(tl, 0);
  for (let round = 0; round < 6; round++) {
    const w = GD.makeWorld(objects, header), r = GD.solveAny(w);
    if (!r.ok) return;
    const pw = GD.SYNC.pressWindows(w, r.events);
    if (!pw) return;
    let moved = 0;
    for (const [beat, idx] of groups) {
      const x0 = Math.min(...idx.map(i => objects[i].x));
      const want = GD.SYNC.xOfT(tl, GD.SYNC.beatToTime(ctx.grid, ctx.offset, +beat));
      // the press that clears this group: the last one before it, if it is near the beat
      const before = pw.windows.filter(p => pw.path[p.tick].x < x0);
      const p = before[before.length - 1];
      if (!p) continue;
      const mid = pw.path[Math.round((p.lo + p.hi) / 2)].x;
      const d = want - mid;
      if (d > beatUnits || Math.abs(d) < 1) continue;
      for (const i of idx) objects[i].x = +(objects[i].x + d).toFixed(3);
      moved++;
    }
    if (!moved) return;
  }
}

// where each press's window lies in beats; "on beat" = the window holds a beat (or half-beat)
function beatReport(objects, header, r, ctx) {
  const w = GD.makeWorld(objects, header);
  const pw = GD.SYNC.pressWindows(w, r.events);
  if (!pw) return;
  const b = t => GD.SYNC.timeToBeat(ctx.grid, ctx.offset, t);
  console.log(`   beats (${ctx.grid.bpm.toFixed(2)} BPM, beat 1 = first beat after the start):`);
  let on = 0;
  for (const p of pw.windows) {
    const b0 = b(p.lo / GD.PHYS.TPS), b1 = b((p.hi + 1) / GD.PHYS.TPS), mid = b(p.tick / GD.PHYS.TPS);
    const hit = Math.floor(b1) >= Math.ceil(b0) ? "on beat " + Math.ceil(b0) : Math.floor(b1 * 2) >= Math.ceil(b0 * 2) ? "on half-beat " + (Math.ceil(b0 * 2) / 2) : "off the beat";
    if (/^on/.test(hit)) on++;
    console.log(`     press at beat ${mid.toFixed(2)}  window ${b0.toFixed(2)}-${b1.toFixed(2)}  ${hit}`);
  }
  console.log(`   ${on}/${pw.windows.length} presses can land on a beat or half-beat`);
  // How much is pinned. The official levels sync transitions, not clicks: portals on bar starts
  // (61-78%), orbs loosely, presses barely (pooled R 0.07; most levels' press kappa near 0). Every
  // click on the beat sounds forced (the user). SYNC.md "How much to sync".
  const n = pw.windows.length, P = ctx.grid.period;
  const pinned = pw.windows.filter(p => { const m = b(p.tick / GD.PHYS.TPS); return Math.abs(m - Math.round(m)) * P < 0.035; }).length;
  const PORTALS = new Set([12, 13, 47, 111, 660, 745, 1331, 1933, 10, 11, 200, 201, 202, 203, 1334]);
  const tl = GD.SYNC.timeline(w), ports = objects.filter(o => PORTALS.has(o.id));
  const portOn = ports.filter(o => { const m = b(GD.SYNC.tOfX(tl, o.x)); return Math.abs(m - Math.round(m)) * P < 0.035; }).length;
  console.log(`   sync: ${pinned}/${n} presses centred on a beat` + (ports.length ? `, ${portOn}/${ports.length} portals on a beat` : ""));
  if (n >= 6 && pinned / n > 0.6) console.log(`   note: most clicks are pinned to beats; that can sound forced. Official levels sync portals,
         drops and some orbs, and leave most clicks free (fine for a test of the sync itself).`);
  if (ports.length >= 2 && portOn / ports.length < 0.5) console.log(`   note: under half the portals are on a beat; official levels put them on bar starts.`);
  if (ctx.grid.conf === "low") console.log(`   note: low-confidence beat grid (no steady beat, or the tempo moves): follow the song's
         sections and loudness here, not the beat lines.`);
}

if (require.main === module) {
  const specs = process.argv.slice(2);
  if (!specs.length) { console.log("usage: node tools/make.js specs/<name>.json [...]"); process.exit(1); }
  for (const s of specs) make(s);
}
module.exports = { make, build, slug, TYPES, songOf, gridOf };
