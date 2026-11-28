// node tools/splice.js <A.gdlvl> <B.gdlvl> --at <song s> [--seam-b <song s>] [--lead-b <units> | all] [--out out.gdlvl]
//   -> one level: A up to song second --at, then B from there on, on one song (both levels must share it; each
//      level's kA13 says where in the song it starts). Library: splice(A, B, o) -> {level, report}.
// The general join of two levels made apart (USE_CASES "combine"): written for Hellgate's full stitch
// (tools/hellgate_full.js: gameplay -> auto -> ending), usable for any two parts of one song.
//   - x: B's objects move so that B's player at song --seam-b (default --at) lands on A's player at song --at
//     (A's player position from A's route, or from a zero-press run when A is auto). Both are taken at 1x after the
//     seam, so the parts must hand over at 1x (a portal wall makes sure, below).
//   - A keeps every object before its seam x (opts.cutA units earlier: so B's ground is clear); B keeps the objects at
//     or after its own seam x, and opts.leadB units before it (Infinity = all of B: its set-up triggers and lead-in
//     then play over A's last stretch, on the song's time when both run at 1x there). Every kept object of B moves by
//     the same dx, so B's own timing holds.
//   - groups and colour channels of B that A also uses get fresh numbers (keys 57, triggers' 51 / 71; 21 / 22,
//     colour triggers' 23 / 50), so a trigger of one part never moves the other's objects.
//   - B's header colours: the plain channels go into the joined header; the special ones (bg 1000, ground
//     1001 / 1009, middleground 1013 / 1014, line 1002) become colour triggers at the seam (opts.fade seconds).
//   - the wall (opts.wall = {mode, speed, grav, mini}): portals stacked over the whole height just before the seam,
//     so A's player enters B in B's start state whatever A ended in.
"use strict";
const fs = require("fs"), path = require("path");
const { GD, readGdlvl, writeGdlvl } = require("./io.js");
const TPS = GD.PHYS.TPS;
const MODE_ID = { cube: 12, ship: 13, ball: 47, ufo: 111, wave: 660, robot: 745, spider: 1331, swing: 1933 };
const SPEED_ID = { 0.5: 200, 1: 201, 2: 202, 3: 203, 4: 1334 };
const END = new Set([1764, 3600]);   // A's level end goes (B's stays)
const kindOf = q => (GD.objInfo(q.id) || {}).kind || "decoration";
const songStart = h => +((String(h).match(/(?:^|,)kA13,([-0-9.]+)/) || [])[1] || 0);

// groups and channels an object list uses
function usage(objs) {
  const G = new Set(), C = new Set();
  for (const q of objs) {
    const p = q.props || {};
    if (p[57] != null) String(p[57]).split(".").filter(Boolean).forEach(g => G.add(+g));
    if (kindOf(q) === "trigger") { if (q.id !== 899 && p[51] != null) G.add(+p[51]); if (p[71] != null) G.add(+p[71]); }
    if (p[21] != null) C.add(+p[21]); if (p[22] != null) C.add(+p[22]);
    if (q.id === 899) { if (p[23] != null) C.add(+p[23]); if (p[50] != null) C.add(+p[50]); }
  }
  return { G, C };
}
function headerChannels(h) {
  const m = String(h).match(/kS38,([^,]*)/), out = {};
  if (!m) return out;
  for (const e of m[1].split("|").filter(Boolean)) { const f = e.split("_"), o = {}; for (let i = 0; i + 1 < f.length; i += 2) o[f[i]] = f[i + 1]; if (o[6] != null) out[+o[6]] = { raw: e, f: o }; }
  return out;
}
function setHeaderChannels(h, entries) {   // entries: {ch: raw}; replaces or adds
  const cur = headerChannels(h);
  for (const [ch, raw] of Object.entries(entries)) cur[ch] = { raw };
  const list = Object.values(cur).map(c => c.raw).join("|") + "|";
  return /kS38,/.test(h) ? h.replace(/kS38,[^,]*/, "kS38," + list) : "kS38," + list + "," + h;
}

// the player's path of a level: its saved route, else a zero-press run
function pathOf(level, levelStr, events) {
  const w = GD.makeWorld(level.objects, level.header);
  return GD.run(w, events || []);
}

function splice(A, B, o) {
  const atSong = o.at, seamB = o.seamB ?? o.at;
  const sA = songStart(A.level.header), sB = songStart(B.level.header);
  const pA = o.pathA || pathOf(A.level, A.levelStr, o.eventsA).path, pB = o.pathB || pathOf(B.level, B.levelStr, []).path;
  const tickA = Math.round((atSong - sA) * TPS), tickB = Math.round((seamB - sB) * TPS);
  if (tickA >= pA.length) throw new Error(`A's run ends before song ${atSong} s (dies? ${pA[pA.length - 1].why || ""})`);
  if (tickB < 0 || tickB >= pB.length) throw new Error(`B's run does not reach song ${seamB} s`);
  const xA = GD.progressX ? GD.progressX(pA[tickA]) : pA[tickA].x, xB = pB[tickB].x, dx = xA - xB;
  const cutA = xA - (o.cutA ?? 0);
  // A before its seam (minus its end marker), B from its own seam (or what keepB keeps)
  const keepA = A.level.objects.filter(q => q.x < cutA && !END.has(q.id));
  const keepB = B.level.objects.filter(q => q.x >= xB - (o.leadB ?? 0));
  // fresh numbers for B's groups / channels that A uses
  const uA = usage(keepA), uB = usage(keepB), hA = headerChannels(A.level.header), hB = headerChannels(B.level.header);
  for (const ch of Object.keys(hA)) uA.C.add(+ch);
  const gMap = {}, cMap = {};
  let g = Math.max(9000, ...uA.G, ...uB.G) + 1;
  for (const x of uB.G) if (uA.G.has(x)) gMap[x] = g++;
  const usedC = new Set([...uA.C, ...uB.C, ...Object.keys(hB).map(Number)]);
  let c = o.ch0 || 600; const freeC = () => { while (usedC.has(c) || (c >= 990)) c++; usedC.add(c); return c; };
  for (const x of uB.C) if (x < 1000 && uA.C.has(x) && x !== 0) cMap[x] = freeC();
  for (const x of Object.keys(hB).map(Number)) if (x < 1000 && uA.C.has(x) && !cMap[x]) cMap[x] = freeC();
  const G_ = v => gMap[v] ?? v, C_ = v => cMap[v] ?? v;
  const moved = keepB.map(q0 => {
    const q = { ...q0, props: { ...(q0.props || {}) } }, p = q.props;
    q.x = q0.x + dx;
    if (p[57] != null) p[57] = String(p[57]).split(".").filter(Boolean).map(v => G_(+v)).join(".");
    if (kindOf(q) === "trigger") { if (q.id !== 899 && p[51] != null) p[51] = G_(+p[51]); if (p[71] != null) p[71] = G_(+p[71]); }
    if (p[21] != null) p[21] = C_(+p[21]); if (p[22] != null) p[22] = C_(+p[22]);
    if (q.id === 899) { if (p[23] != null) p[23] = C_(+p[23]); if (p[50] != null) p[50] = C_(+p[50]); }
    return q;
  });
  // B's header colours: plain channels into the header, the special ones as colour triggers at the seam
  const K = require("./scenekit.js"), add = {}, fadeTr = [];
  for (const [ch0, e] of Object.entries(hB)) {
    const ch = C_(+ch0), f = e.f;
    if (ch < 1000) { add[ch] = e.raw.replace(/(^|_)6_\d+(?=_|$)/, `$16_${ch}`); continue; }
    if (!f[1] && f[1] !== "0") continue;
    if ([1000, 1001, 1009, 1013, 1014, 1002].includes(ch)) fadeTr.push(K.colour(xA - (o.fadeLead ?? 0), ch, [+f[1], +f[2], +f[3]], o.fade ?? 0.5, f[7] != null ? +f[7] : 1));
  }
  const header = setHeaderChannels(A.level.header, add);
  // the wall: B's start state, portals stacked over the whole height just before the seam
  const wall = [];
  if (o.wall) {
    const wx = xA - (o.wallLead ?? 45), top = o.wallTop ?? 1200;
    for (let y = 15 + 30; y < top; y += 90) {
      if (o.wall.mode) wall.push({ id: MODE_ID[o.wall.mode], x: wx, y, rot: 0, props: {} });
      if (o.wall.speed) wall.push({ id: SPEED_ID[o.wall.speed], x: wx - 30, y, rot: 0, props: {} });
      if (o.wall.grav) wall.push({ id: o.wall.grav > 0 ? 10 : 11, x: wx + 30, y, rot: 0, props: {} });
      if (o.wall.mini === false) wall.push({ id: 99, x: wx + 60, y, rot: 0, props: {} });
    }
  }
  const objects = keepA.concat(wall, fadeTr, moved);
  const report = { atSong, seamB, xA: +xA.toFixed(1), xB: +xB.toFixed(1), dx: +dx.toFixed(1), keptA: keepA.length, keptB: keepB.length,
    stateA: (({ mode, sp, grav, y, grounded }) => ({ mode, sp, grav, y: +y.toFixed(1), grounded }))(pA[tickA]),
    stateB: (({ mode, sp, grav, y, grounded }) => ({ mode, sp, grav, y: +y.toFixed(1), grounded }))(pB[tickB]),
    groupsRenamed: Object.keys(gMap).length, channelsRenamed: cMap, seamColours: fadeTr.length, wall: wall.length };
  return { level: { header, objects }, report, xA, dx, tickA };
}

module.exports = { splice, usage, headerChannels, setHeaderChannels, songStart };

if (require.main === module) {
  const a = process.argv.slice(2), opt = k => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : null; };
  const A = readGdlvl(a[0]), B = readGdlvl(a[1]);
  const S = require("./solutions.js"), sol = S.get(A.levelStr, true);
  const r = splice(A, B, { leadB: opt("--lead-b") === "all" ? Infinity : +(opt("--lead-b") || 0), at: +opt("--at"), seamB: opt("--seam-b") ? +opt("--seam-b") : undefined, eventsA: sol && sol.ok ? sol.events : [] });
  const out = opt("--out") || path.join(path.dirname(a[0]), "spliced.gdlvl");
  writeGdlvl(out, A.rec, r.level);
  console.log(JSON.stringify(r.report, null, 1) + "\n-> " + out);
}
