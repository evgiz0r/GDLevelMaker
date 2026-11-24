// node tools/edit.js <level> --at <spot> "<change in words>" [--do '<ops json>'] [--out f.gdlvl] [--dry]
//                    [--no-shots] [--full] [--session <name>] [--json]
// node tools/edit.js <level> --at <spot> --show        -- what is at the spot (objects, route, time), no edit
// node tools/edit.js --vocab                           -- the words and ops it understands
//
// EDIT BY PROMPT (USE_CASES 16, EDITING.md): one change at one spot of a level, on a COPY (never the
// original), re-solved, every quick check re-run before and after, and a before/after picture.
//   <level>   a .gdlvl, save:<name> (the user's save, read only), official:N, local/official_NN.json,
//             a community ID (local/community/<id>.gdlvl), or a viewer link ".../viewer/#lv=<file>&t=<s>"
//             (the link also gives the spot)
//   --at      x1234 | x=1234 (units) · b45 | block 45 (the viewer's "block": player x / 30) · t=12.3 | 12.3s
//             (level seconds) · beat 32 (needs the level's spec with a song) · a viewer #lv= link.
//             Add a height with ",r2" / " row 2" (rows above the ground) or ",y=75" (units).
//   change    words, parsed by a small vocabulary (--vocab): "add a yellow orb here", "add a spike 2 blocks
//             right", "remove these spikes", "remove this orb", "lower this block by 1", "raise this block by 2",
//             "move this orb left by 0.5", "extend this block 2 right", "replace this yellow orb with a pink
//             orb", "make this section a wave". Anything the words don't cover: pass the ops yourself with
//             --do (a session reads the user's note and writes them; EDITING.md "Ops"). The parsed ops are
//             printed, so a wrong reading shows before anything is trusted.
//   --dry     parse and select only: print what would change, write nothing, no solve
//   --show    print the objects around the spot and the route there (for writing --do by hand)
//   --no-shots  no before/after picture (shoot.js, ~10-20 s); --full also runs every score.js gate on the copy
//   --session <name>  put the copy in the viewer's "in progress" list (tools/wip.js put)
// Writes local/edits/<slug>.e<N>.gdlvl (+ .json report, + _before_after.png), prints what changed, the route
// (still beaten? presses, tightest window near the spot), the checks that got better or worse, and a viewer link.
// Re-solve: the old route if it still clears (seconds), else lib/incsolve.js when present, else a full solve.
// Heavy (it may solve): takes the one-heavy-job slot.
// (--show, --dry and --vocab are light: no slot)
if (require.main === module && !process.argv.some(a => /^--(show|dry|vocab)$/.test(a))) require("./heavy.js").claim();   // one heavy job at a time (tools/heavy.js)
"use strict";
const fs = require("fs"), path = require("path"), cp = require("child_process");
const { GD, readGdlvl, writeGdlvl, pack, unpack } = require("./io.js");
const SY = require("../lib/sync.js").SYNC;
const ROOT = path.join(__dirname, ".."), OUT = path.join(ROOT, "local", "edits");
const rel = f => path.relative(ROOT, f).replace(/\\/g, "/");
const clone = o => JSON.parse(JSON.stringify(o));
const kindOf = o => (GD.objInfo(o.id) || {}).kind || "deco";
const blk = x => +(x / 30).toFixed(1);                  // the viewer's block (player x / 30)

// ---------- names: words -> object ids / kinds ----------
const TYPES = { block: 1, spike: 8, slope: 1338, "small spike": 39, slab: 40, "yellow orb": 36, "blue orb": 84, "yellow pad": 35, "blue pad": 67,
  "pink orb": 141, "red orb": 1333, "pink pad": 140, "red pad": 1332, "green orb": 1022, "black orb": 1330, "spider orb": 3004, "spider pad": 3005,
  "dash orb": 1704, "green dash orb": 1704, "pink dash orb": 1751,
  "cube portal": 12, "ship portal": 13, "ball portal": 47, "ufo portal": 111, "wave portal": 660, "robot portal": 745,
  "spider portal": 1331, "swing portal": 1933, "gravity portal": 11, "upside down": 11, "gravity down": 11, "normal gravity": 10, "gravity up": 10,
  "0.5x speed": 200, "1x speed": 201, "2x speed": 202, "3x speed": 203, "4x speed": 1334, saw: 88 };
const MODES = { cube: 12, ship: 13, ball: 47, ufo: 111, wave: 660, robot: 745, spider: 1331, swing: 1933 };
const ARROW = new Set([132, 460, 494, 3630, 3631, 3632]);
// a word for a class of objects -> a test (plural or not)
const CLASSES = {
  block: o => kindOf(o) === "solid", solid: o => kindOf(o) === "solid", platform: o => kindOf(o) === "solid", ledge: o => kindOf(o) === "solid",
  pillar: o => kindOf(o) === "solid", step: o => kindOf(o) === "solid", wall: o => kindOf(o) === "solid", slab: o => kindOf(o) === "solid",
  spike: o => kindOf(o) === "hazard", hazard: o => kindOf(o) === "hazard", saw: o => kindOf(o) === "hazard", thorn: o => kindOf(o) === "hazard",
  slope: o => kindOf(o) === "slope", ramp: o => kindOf(o) === "slope",
  orb: o => kindOf(o) === "orb", ring: o => kindOf(o) === "orb", pad: o => kindOf(o) === "pad",
  portal: o => ["mode", "gravity", "speed", "size", "teleport"].includes(kindOf(o)),
  arrow: o => ARROW.has(o.id), indicator: o => ARROW.has(o.id), mark: o => ARROW.has(o.id), chevron: o => ARROW.has(o.id),
  deco: o => !GAMEPLAY.has(kindOf(o)) && kindOf(o) !== "trigger" && !ARROW.has(o.id),
};
const GAMEPLAY = new Set(["solid", "hazard", "slope", "orb", "pad", "mode", "gravity", "speed", "size", "teleport"]);
function classOf(words) {
  let w = String(words || "").toLowerCase().replace(/\b(the|this|these|that|those|a|an|one|all|here|there)\b/g, " ").replace(/\s+/g, " ").trim();
  const sing = w.replace(/(?<=\w)(es|s)$/, m => (/(spike|orb|pad|block|portal|slope|saw|slab|step|wall|arrow|mark|ledge|pillar|ring|ramp|chevron)e?s$/.test(w) ? "" : m));
  // a generic word (block, spike, slab, slope, saw) selects every object of its class (block skins 2-7,
  // pit spikes 9...) and adds the plain one; a named kind (yellow orb, small spike) selects only that id
  for (const t of [w, sing, w.replace(/s$/, "")]) if (TYPES[t]) { const id = TYPES[t]; return { name: t, id, test: CLASSES[t] || (o => o.id === id) }; }
  const last = sing.split(" ").pop().replace(/s$/, "");
  for (const k of [sing, last]) if (CLASSES[k]) return { name: k, test: CLASSES[k] };
  const n = +w.replace(/^id\s*/, ""); if (n > 0) return { name: "id " + n, id: n, test: o => o.id === n };
  return null;
}

// ---------- loading any level ----------
function loadLevel(spec) {
  let m, t = null;
  if ((m = /#lv=([^&]+)(?:&t=([\d.]+))?/.exec(spec))) { spec = decodeURIComponent(m[1]).replace(/^\.\.\//, ""); t = m[2] != null ? +m[2] : null; }
  if (/^\d{5,}$/.test(spec)) { const f = path.join(ROOT, "local", "community", spec + ".gdlvl"); if (!fs.existsSync(f)) throw new Error(`no ${rel(f)}: fetch it first (node tools/fetch_level.js ${spec})`); spec = f; }
  if (!/^(save|official):/.test(spec) && !fs.existsSync(spec) && fs.existsSync(path.join(ROOT, spec))) spec = path.join(ROOT, spec);
  let L;
  if (/\.gdlvl$/.test(spec)) { const r = readGdlvl(spec); L = { name: r.name, levelStr: r.levelStr, level: r.level, rec: r.rec, file: spec, src: rel(spec) }; }
  else { const lv = require("./shoot.js").levelOf(spec); L = { name: lv.name, levelStr: lv.levelStr, level: GD.parseLevel(lv.levelStr), rec: null, file: null, src: spec, solution: lv.solution }; }
  L.linkT = t;
  return L;
}
function specOf(name) {   // our level's spec, by its name (for beats)
  for (const f of fs.readdirSync(path.join(ROOT, "specs")).filter(f => f.endsWith(".json"))) {
    try { const s = JSON.parse(fs.readFileSync(path.join(ROOT, "specs", f), "utf8")); if (s.name && name && name.replace(/^GDLM /, "") === String(s.name).replace(/^GDLM /, "")) return s; } catch (e) {}
  }
  return null;
}

// ---------- the route (saved solution) ----------
function routeOf(L) {
  let sol = L.solution || null;
  if (!sol) try { sol = require("./solutions.js").get(L.levelStr, true); } catch (e) {}
  if (!sol || !sol.events) return null;
  const w = GD.makeWorld(L.level.objects, L.level.header), r = GD.run(w, sol.events);
  return { sol, w, path: r.path, beaten: !r.dead && (r.done || r.end.x >= w.endX), end: r.end };
}

// ---------- the spot ----------
// returns {x, y|null, t}: x in units (player centre), y in units when given, t in level seconds
function parseSpot(at, L, route) {
  const w = route ? route.w : GD.makeWorld(L.level.objects, L.level.header), tl = SY.timeline(w);
  let s = String(at || "").trim(), x = null, y = null, m;
  // a time: where the route is then (the viewer's clock), else the speed timeline
  const xAtT = tt => { const p = route && route.path[Math.round(tt * GD.PHYS.TPS)]; return p ? p.x : SY.xOfT(tl, tt); };
  if ((m = /#lv=[^&]+&t=([\d.]+)/.exec(s))) s = "t=" + m[1];
  const yPart = /(?:,|\s)\s*(?:r|row)\s*=?\s*(-?[\d.]+)|(?:,|\s)\s*y\s*=?\s*(-?[\d.]+)/i.exec(s);
  if (yPart) { y = yPart[1] != null ? +yPart[1] * 30 + 15 : +yPart[2]; s = s.slice(0, yPart.index).trim(); }
  if ((m = /^x\s*=?\s*(-?[\d.]+)$/i.exec(s))) x = +m[1];
  else if ((m = /^(?:b|block|blk)\s*=?\s*(-?[\d.]+)$/i.exec(s))) x = +m[1] * 30;
  else if ((m = /^(?:t\s*=?\s*([\d.]+)|([\d.]+)\s*s)$/i.exec(s))) x = xAtT(+(m[1] || m[2]));
  else if ((m = /^beat\s*=?\s*([\d.]+)$/i.exec(s))) {
    const sp = specOf(L.name); if (!sp || !sp.song) throw new Error("beat spots need the level's spec with a song (specs/*.json)");
    const mk = require("./make.js"), grid = mk.gridOf ? mk.gridOf(sp, mk.songOf(sp)) : null;
    x = SY.xOfT(tl, SY.beatToTime(grid, sp.offset || 0, +m[1]));
  } else if (L.linkT != null && !s) x = xAtT(L.linkT);
  else throw new Error(`can't read the spot "${at}": use x1234, b45, t=12.3, beat 32 or a viewer link (+ ",r2" for a row)`);
  let t = SY.tOfX(tl, x), py = null;
  if (route) { const p = route.path.find(q => q.x >= x); if (p) { py = p.y; t = route.path.indexOf(p) / GD.PHYS.TPS; } }
  return { x, y, t: +t.toFixed(2), playerY: py, block: blk(x), col: Math.floor(x / 30) };
}

// ---------- words -> ops ----------
// An op is one of (units are blocks; at = {col, row} in grid squares: x = col*30+15, y = row*30+15):
//   {op:"add", type:"yellow orb"|id, col, row, props?}
//   {op:"remove", what:"spikes", near?:true, from?:col, to?:col, group?:true}
//   {op:"move", what:"block", dx:blocks, dy:blocks, group?:true}       (a block takes what sits on it along)
//   {op:"extend", what:"block", n:blocks, side:"right"|"left"}          (copies its edge column)
//   {op:"replace", what:"yellow orb", with:"pink orb", group?:true}
//   {op:"mode", mode:"wave"}                                            (the portal that starts this section)
//   {op:"set", what:"orb", props:{"32":"1.2"}}                           (raw keys on the selected objects)
// Selection: "this"/single = the nearest match to the spot (within 4 blocks), "these"/plural = that one's
// group (a hazard row on one surface, a connected block structure), from/to = every match in that range.
const NUM = { one: 1, two: 2, three: 3, four: 4, five: 5, half: 0.5, a: 1, an: 1 };
const num = s => s == null ? null : (NUM[s] != null ? NUM[s] : +s);
function parse(words, spot) {
  const s = String(words || "").toLowerCase().replace(/[.!]+$/, "").trim(), ops = [];
  if (!s) return ops;
  for (const part of s.split(/\s*(?:;|\band then\b|\bthen\b)\s*/)) { const op = parseOne(part, spot); if (op) ops.push(op); else return { error: `don't understand "${part}" -- pass --do '<ops json>' (EDITING.md "Ops")` }; }
  return ops;
}
function parseOne(s, spot) {
  let m;
  const plural = w => /\b(these|those|all)\b/.test(w) || /s$/.test(w.trim().split(" ").pop());
  const range = /\bfrom (?:b|block )?([\d.]+) to (?:b|block )?([\d.]+)/.exec(s);
  const R = range ? { from: Math.floor(+range[1]), to: Math.floor(+range[2]) } : {};
  const body = range ? s.replace(range[0], "").trim() : s;
  // add
  if ((m = /^(?:add|put|place|insert)\s+(?:(a|an|one|two|three|\d+)\s+)?(.+?)(?:\s+(here|there))?(?:\s+([\d.]+|a|one|two|half a)\s*blocks?\s+(up|down|left|right|above|below|higher|lower|ahead|before|after|back))?(?:\s+(?:at\s+)?(?:row|r)\s*([\d.]+))?$/.exec(body))) {
    const c = classOf(m[2]); if (!c || !c.id) return null;
    const n = num(m[1]) || 1, d = m[4] ? num(m[4].replace(/^half a$/, "half")) : 0, dir = m[5] || "";
    let col = spot.col, row = m[6] != null ? +m[6] : spot.y != null ? Math.floor(spot.y / 30) : (c.id && kindOf({ id: c.id }) === "orb" ? Math.max(1, Math.round(((spot.playerY || 15) - 15) / 30) + 1) : 0);
    if (/up|above|higher/.test(dir)) row += d; if (/down|below|lower/.test(dir)) row -= d;
    if (/right|ahead|after/.test(dir)) col += d; if (/left|before|back/.test(dir)) col -= d;
    const out = []; for (let i = 0; i < n; i++) out.push({ op: "add", type: c.name, col: col + i, row });
    return out.length === 1 ? out[0] : { op: "batch", ops: out };
  }
  // remove
  if ((m = /^(?:remove|delete|take out|clear|get rid of|drop)\s+(.+?)(?:\s+here)?$/.exec(body))) {
    const c = classOf(m[1]); if (!c) return null;
    return Object.assign({ op: "remove", what: c.name, group: plural(m[1]) }, R);
  }
  // lower / raise / move
  if ((m = /^(lower|raise|move|shift|nudge|push)\s+(.+?)\s*(?:(up|down|left|right|back|forward|ahead|higher|lower)\s*)?(?:by\s+)?([\d.]+|a|one|two|three|half a|half)?\s*(?:blocks?|rows?|columns?|squares?)?\s*(up|down|left|right|back|forward|ahead|higher|lower)?$/.exec(body))) {
    const c = classOf(m[2]); if (!c) return null;
    const n = m[4] ? num(m[4].replace(/^half a$/, "half")) : 1, dir = m[1] === "lower" ? "down" : m[1] === "raise" ? "up" : (m[3] || m[5] || "");
    const dx = /right|forward|ahead/.test(dir) ? n : /left|back/.test(dir) ? -n : 0, dy = /up|higher/.test(dir) ? n : /down|lower/.test(dir) ? -n : 0;
    if (!dx && !dy) return null;
    return Object.assign({ op: "move", what: c.name, dx, dy, group: c.name === "block" || plural(m[2]) }, R);
  }
  // extend / widen / lengthen
  if ((m = /^(?:extend|widen|lengthen|stretch)\s+(.+?)\s*(?:by\s+)?([\d.]+|one|two|three|a)?\s*(?:blocks?|columns?)?\s*(?:to the\s+)?(left|right)?$/.exec(body))) {
    const c = classOf(m[1]); if (!c) return null;
    return { op: "extend", what: c.name, n: num(m[2]) || 1, side: m[3] || "right" };
  }
  // replace / change / swap / turn ... into
  if ((m = /^(?:replace|swap)\s+(.+?)\s+(?:with|for|by)\s+(?:a |an )?(.+)$/.exec(body)) || (m = /^(?:change|turn|make)\s+(.+?)\s+(?:to|into)\s+(?:a |an )?(.+)$/.exec(body))) {
    const mode = /^(?:this |the )?(?:section|part|bit)$/.test(m[1].trim()) ? m[2].replace(/ (mode|section|part)$/, "").trim() : null;
    if (mode && MODES[mode]) return { op: "mode", mode };
    const c = classOf(m[1]), d = classOf(m[2]); if (!c || !d || !d.id) return null;
    return Object.assign({ op: "replace", what: c.name, with: d.name, group: plural(m[1]) }, R);
  }
  if ((m = /^make\s+(?:this|the)\s+(?:section|part|bit)\s+(?:a |an )?(\w+)(?: mode| section| part)?$/.exec(body)) && MODES[m[1]]) return { op: "mode", mode: m[1] };
  return null;
}

// ---------- selection ----------
function nearest(objs, test, spot, maxBlocks = 4) {
  let best = null, bd = Infinity;
  for (const o of objs) {
    if (!test(o)) continue;
    const dx = Math.abs(o.x - spot.x), dy = spot.y != null ? Math.abs(o.y - spot.y) : (spot.playerY != null ? Math.abs(o.y - spot.playerY) * 0.3 : 0);
    if (dx > maxBlocks * 30 + 15) continue;
    const d = dx + dy; if (d < bd) { bd = d; best = o; }
  }
  return best;
}
// a block structure: solids touching each other (cells next to each other), at most 60 pieces
function structure(objs, seed) {
  const solid = objs.filter(o => ["solid", "slope"].includes(kindOf(o))), set = new Set([seed]), q = [seed];
  while (q.length && set.size < 60) {
    const a = q.shift();
    for (const b of solid) if (!set.has(b) && Math.abs(b.x - a.x) <= 31 && Math.abs(b.y - a.y) <= 31 && (Math.abs(b.x - a.x) < 1 || Math.abs(b.y - a.y) < 1)) { set.add(b); q.push(b); }
  }
  return [...set];
}
// a hazard (or orb) row: same kind, same height and turn, neighbours at most 1.5 blocks apart
function row(objs, seed, test) {
  const same = objs.filter(o => test(o) && Math.abs(o.y - seed.y) < 8 && (o.rot || 0) === (seed.rot || 0)).sort((a, b) => a.x - b.x);
  const i = same.indexOf(seed); let a = i, b = i;
  while (a > 0 && same[a].x - same[a - 1].x <= 46) a--;
  while (b < same.length - 1 && same[b + 1].x - same[b].x <= 46) b++;
  return same.slice(a, b + 1);
}
// what sits on / hangs off / is attached to a structure (deco, hazards, orbs on it), moved with it
function riders(objs, group) {
  const g = new Set(group), out = [];
  for (const o of objs) {
    if (g.has(o) || kindOf(o) === "trigger") continue;
    if (["solid", "slope"].includes(kindOf(o)) && !ARROW.has(o.id)) continue;
    if (group.some(b => Math.abs(o.x - b.x) <= 16 && Math.abs(o.y - b.y) <= 31)) out.push(o);
  }
  return out;
}
function select(objs, op, spot) {
  const c = classOf(op.what); if (!c) throw new Error(`unknown thing "${op.what}"`);
  if (op.from != null || op.to != null) {
    const a = (op.from != null ? op.from : -1e9) * 30, b = ((op.to != null ? op.to : 1e9) + 1) * 30;
    return objs.filter(o => c.test(o) && o.x >= a && o.x < b);
  }
  const seed = nearest(objs, c.test, spot, op.exact ? 0.6 : op.within || 4);
  if (!seed) return [];
  if (!op.group) return [seed];
  return ["solid", "slope"].includes(kindOf(seed)) ? structure(objs, seed) : row(objs, seed, c.test);
}

// ---------- applying ----------
function newObj(type, col, row, props) {
  const id = typeof type === "number" ? type : (classOf(type) || {}).id;
  if (!id) throw new Error(`can't add "${type}": not an object name (--vocab)`);
  return { id, x: +(col * 30 + 15).toFixed(3), y: row * 30 + 15, rot: 0, flipX: false, flipY: false, props: Object.assign({ 155: "1" }, props || {}) };
}
// -> {objects, changes:[{what, ids, from, to}], touched:Set of x}
function apply(level, ops, spot0) {
  const objs = level.objects.map(o => Object.assign({}, o, { props: Object.assign({}, o.props) }));
  const changes = [], xs = [];
  const say = (what, list) => { changes.push({ what, n: list.length, blocks: [...new Set(list.map(o => blk(o.x)))].slice(0, 12) }); for (const o of list) xs.push(o.x); };
  const flat = []; for (const op of [].concat(ops)) if (op.op === "batch") flat.push(...op.ops); else flat.push(op);
  for (const op0 of flat) {
    // an op may carry its own spot: "at" = a column (x = at*30+15, as the checks print "block N")
    const op = op0, spot = op0.at != null ? Object.assign({}, spot0, { x: op0.at * 30 + 15, col: Math.floor(op0.at), block: blk(op0.at * 30 + 15), y: op0.row != null && op0.op !== "add" ? op0.row * 30 + 15 : null }) : spot0;
    if (op.op === "add") {
      const o = newObj(op.type, op.col != null ? op.col : spot.col, op.row != null ? op.row : 0, op.props);
      if (op.dy) o.y += op.dy; if (op.rot) o.rot = op.rot;
      objs.push(o); say(`added ${op.type} at block ${blk(o.x)}, row ${(o.y - 15) / 30}`, [o]);
    } else if (op.op === "remove") {
      const sel = new Set(select(objs, op, spot)); if (!sel.size) throw new Error(`no ${op.what} near block ${spot.block}`);
      const gone = objs.filter(o => sel.has(o)); for (let i = objs.length - 1; i >= 0; i--) if (sel.has(objs[i])) objs.splice(i, 1);
      say(`removed ${gone.length} ${op.what}${gone.length > 1 ? "s" : ""}`, gone);
    } else if (op.op === "move") {
      const sel = select(objs, op, spot); if (!sel.length) throw new Error(`no ${op.what} near block ${spot.block}`);
      const carry = op.alone ? [] : ["solid", "slope"].includes(kindOf(sel[0])) ? riders(objs, sel) : [];
      for (const o of sel.concat(carry)) { o.x += (op.dx || 0) * 30; o.y += (op.dy || 0) * 30; }
      const under = sel.filter(o => o.y < 0 && ["solid", "slope"].includes(kindOf(o))).length;
      if (under) changes.push({ what: `WARNING: ${under} piece(s) now under the ground (they vanish in play): did you mean "remove"?`, n: 0, blocks: [] });
      say(`moved ${sel.length} ${op.what}${sel.length > 1 ? "s" : ""}${carry.length ? ` (+${carry.length} on it)` : ""} by ${op.dx || 0} right, ${op.dy || 0} up`, sel);
    } else if (op.op === "extend") {
      const sel = select(objs, Object.assign({ group: true }, op), spot); if (!sel.length) throw new Error(`no ${op.what} near block ${spot.block}`);
      const edgeX = op.side === "left" ? Math.min(...sel.map(o => o.x)) : Math.max(...sel.map(o => o.x));
      const edge = sel.filter(o => Math.abs(o.x - edgeX) < 1 && kindOf(o) === "solid"), added = [];
      // what stands on the edge's top that would now sit in the middle (a hazard on the far end) moves out with it
      const top = Math.max(...edge.map(o => o.y)), dir = op.side === "left" ? -1 : 1;
      const onEdge = objs.filter(o => !sel.includes(o) && Math.abs(o.x - edgeX) < 16 && o.y > top && o.y <= top + 31 && kindOf(o) !== "trigger");
      for (let i = 1; i <= op.n; i++) for (const e of edge) { const o = clone(e); o.x = e.x + dir * 30 * i; objs.push(o); added.push(o); }
      for (const o of onEdge) o.x += dir * 30 * op.n;
      say(`extended the ${op.what} by ${op.n} to the ${op.side} (${added.length} pieces${onEdge.length ? `, ${onEdge.length} on its edge moved out` : ""})`, added);
    } else if (op.op === "replace") {
      const sel = select(objs, op, spot); if (!sel.length) throw new Error(`no ${op.what} near block ${spot.block}`);
      const id = typeof op.with === "number" ? op.with : classOf(op.with).id;
      for (const o of sel) { o.id = id; o.props[1] = String(id); }
      say(`replaced ${sel.length} ${op.what} with ${op.with}`, sel);
    } else if (op.op === "centre") {
      // an orb (or pad) over the centre of the hazard row under it (the symmetry rule)
      const sel = select(objs, op, spot); if (!sel.length) throw new Error(`no ${op.what} near block ${spot.block}`);
      const o = sel[0], haz = objs.filter(h => kindOf(h) === "hazard" && h.y < o.y && Math.abs(h.x - o.x) <= 120);
      if (!haz.length) throw new Error(`no hazard row under the ${op.what} at block ${blk(o.x)}`);
      const seed = haz.sort((a, b) => Math.abs(a.x - o.x) - Math.abs(b.x - o.x))[0], r = row(objs, seed, h => kindOf(h) === "hazard");
      const x0 = Math.min(...r.map(h => h.x)), x1 = Math.max(...r.map(h => h.x)), mid = (x0 + x1) / 2;
      // every orb over the same row moves as one (a pair mirrors itself about the centre; GDLM 47's orb pairs)
      const over = objs.filter(q => kindOf(q) === kindOf(o) && q.y > seed.y && Math.abs(q.y - o.y) <= 60 && q.x >= x0 - 15 && q.x <= x1 + 15);
      const set = over.includes(o) ? over : [o], c = (Math.min(...set.map(q => q.x)) + Math.max(...set.map(q => q.x))) / 2, d = mid - c;
      for (const q of set) q.x += d;
      say(`moved ${set.length > 1 ? `the ${set.length} ${op.what}s` : `the ${op.what}`} by ${blk(d)} block(s) so ${set.length > 1 ? "they sit" : "it sits"} centred over the ${r.length}-hazard row (centre block ${blk(mid)})`, set);
    } else if (op.op === "clearmark") {
      // a jump mark moved back (left, along its surface) to the nearest spot clear of hazards (tools/indicators.js --fix)
      const sel = select(objs, Object.assign({ what: "mark" }, op), spot); if (!sel.length) throw new Error(`no jump mark near block ${spot.block}`);
      const D = require("./decorate.js"), w = GD.makeWorld(objs, level.header), o = sel[0], from = o.x;
      let moved = false;
      for (let dx = 15; dx <= 120 && !moved; dx += 15) { const t = Object.assign({}, o, { x: from - dx }); if (!D.indicatorIssues([t], w, D.INDICATOR.clear).length) { o.x = t.x; moved = true; } }
      if (!moved) throw new Error(`no clear spot for the mark at block ${blk(from)} within 4 blocks`);
      say(`moved the jump mark from block ${blk(from)} back to block ${blk(o.x)} (clear of the hazard)`, [o]);
    } else if (op.op === "set") {
      const sel = select(objs, op, spot); if (!sel.length) throw new Error(`no ${op.what} near block ${spot.block}`);
      for (const o of sel) { Object.assign(o.props, op.props || {}); if (op.rot != null) o.rot = op.rot; }
      say(`set ${JSON.stringify(op.props || { rot: op.rot })} on ${sel.length} ${op.what}`, sel);
    } else if (op.op === "mode") {
      const id = MODES[op.mode]; if (!id) throw new Error("unknown mode " + op.mode);
      const portals = objs.filter(o => kindOf(o) === "mode").sort((a, b) => a.x - b.x);
      const before = portals.filter(o => o.x <= spot.x).pop();
      if (before) { const was = (GD.objInfo(before.id) || {}).name; before.id = id; before.props[1] = String(id); say(`the ${was} at block ${blk(before.x)} is now a ${op.mode} portal (section to block ${blk((portals.find(o => o.x > spot.x) || { x: 1e9 }).x)})`, [before]); }
      else { const o = newObj(id, spot.col, Math.max(1, Math.round(((spot.playerY || 15) - 15) / 30))); objs.push(o); say(`added a ${op.mode} portal at block ${blk(o.x)}`, [o]); }
    } else throw new Error("unknown op " + JSON.stringify(op));
  }
  return { objects: objs, changes, xs };
}

// what changed, object by object: added, removed (a moved object counts as removed + added)
function diff(a, b) {
  const key = o => [o.id, Math.round(o.x * 10), Math.round(o.y * 10), o.rot || 0, o.flipX ? 1 : 0, o.flipY ? 1 : 0, JSON.stringify(Object.keys(o.props || {}).filter(k => !"123456".includes(k) || k.length > 1).sort().map(k => k + "=" + o.props[k]))].join("|");
  const count = list => { const m = new Map(); for (const o of list) { const k = key(o); m.set(k, (m.get(k) || []).concat([o])); } return m; };
  const A = count(a), B = count(b), added = [], removed = [];
  for (const [k, l] of B) { const n = (A.get(k) || []).length; if (l.length > n) added.push(...l.slice(n)); }
  for (const [k, l] of A) { const n = (B.get(k) || []).length; if (l.length > n) removed.push(...l.slice(n)); }
  return { added, removed };
}

// ---------- re-solve: old route if it still clears, then incsolve, then a full solve ----------
function resolve(level, levelStr, oldSol, opts = {}) {
  const S = require("./solutions.js"), w = GD.makeWorld(level.objects, level.header);
  const cached = S.get(levelStr, true);
  if (cached && S.fresh(cached) && cached.events) return { sol: cached, how: "cached" };
  // opts.raw: the events only, nothing saved (tools/retarget.js tries many candidates; fromRun re-plans and measures
  // every window of the level, which is the slow part)
  if (oldSol && oldSol.events && oldSol.events.length) {
    const q = GD.run(w, oldSol.events);
    if (!q.dead && (q.done || q.end.x >= w.endX) && !GD.skipCheck(w, q.path, oldSol.events)) return opts.raw ? { sol: { ok: true, events: oldSol.events }, how: "the old route still clears" } : { sol: S.fromRun(level, levelStr, { ok: true, events: oldSol.events }), how: "the old route still clears (re-planned)" };
  }
  // lib/incsolve.js (gd-incsolve): keep the route up to a calm point before the change, search from there until the
  // run is back in the old route's exact state, splice the old rest back in (seconds instead of a whole solve)
  let INC = null; try { INC = require("../lib/incsolve.js").incsolve; } catch (e) {}
  if (INC && opts.oldLevel && oldSol && oldSol.events && oldSol.events.length) {
    try {
      const r = INC.fromBase(opts.oldLevel, oldSol.events, level, {});
      if (r && r.ok) return { sol: opts.raw ? { ok: true, events: r.events } : S.fromRun(level, levelStr, { ok: true, events: r.events, inc: { from: r.from, to: r.to, rejoined: r.rejoined, reused: r.reused || null }, world: r.w }), how: `lib/incsolve.js (re-solved ${r.from != null ? "from tick " + r.from : "the changed stretch"}${r.ms != null ? ", " + (r.ms / 1000).toFixed(1) + " s" : ""})` };
      if (r && r.fallback) opts.why = "incsolve: " + r.fallback;
    } catch (e) { opts.why = "incsolve failed: " + e.message; }
  }
  if (opts.noSolve) return { sol: null, how: "not solved (--no-solve)" };
  const t0 = Date.now(), r = GD.solveAny(w);
  return { sol: S.fromRun(level, levelStr, r), how: `full solve (${((Date.now() - t0) / 1000).toFixed(0)} s)${opts.why ? "; " + opts.why : ""}` };
}

// ---------- quick checks (no solve): soft rules on a saved route ----------
// -> [{rule, text, block|null}] -- the same lists tools/rules.js and tools/softrules.js print
function quickChecks(file, opts = {}) {
  const out = [];
  const blockOf = t => { const m = /blocks? (-?[\d.]+)/.exec(t); return m ? +m[1] : null; };
  try {
    const r = require("./rules.js").rulesOf(file, { fast: !!opts.fast });
    for (const [k, v] of Object.entries(r.rules)) for (const t of v) out.push({ rule: k, text: t, block: blockOf(t) });
    if (r.note) out.push({ rule: "note", text: r.note, block: null, info: true });
  } catch (e) { out.push({ rule: "rules.js", text: "failed: " + e.message, block: null, info: true }); }
  try {
    const s = require("./softrules.js").check(file);
    // one issue per spot: softrules prints "over a hazard at 36.5, 62.5" / "within a block of a hazard at ..." /
    // "roof notch at block 12"; flash is level-wide
    for (const k of ["arrows", "stubs", "flash"]) {
      if (s[k].status === "PASS") continue;
      if (k === "flash") { out.push({ rule: k, text: s[k].text, block: null }); continue; }
      for (const part of s[k].text.split("; ")) {
        const m = /^(.*?) at ([\d., ]+)$/.exec(part);
        if (k === "arrows" && m) for (const b of m[2].split(/,\s*/)) out.push({ rule: k, text: `${m[1]} at ${b}`, block: +b });
        else if (/block/.test(part)) out.push({ rule: k, text: part, block: blockOf(part) });
      }
    }
  } catch (e) {}
  try {
    const L = readGdlvl(file), w = GD.makeWorld(L.level.objects, L.level.header);
    for (const b of require("./decorate.js").indicatorIssues(L.level.objects, w)) out.push({ rule: "indicators", text: `mark at block ${(b.x / 30 - 0.5).toFixed(1)}, ${b.gap} units from a hazard`, block: +(b.x / 30 - 0.5).toFixed(1) });
  } catch (e) {}
  return out;
}
// windows of the route's inputs between two x (the saved windows, ms)
function windowsNear(sol, pathArr, x0, x1) {
  if (!sol || !sol.windows) return [];
  return sol.windows.map(([rel, tick, lo, hi]) => ({ type: rel ? "release" : "press", tick, x: (pathArr[tick] || {}).x || 0, ms: Math.round((hi - lo + 1) / GD.PHYS.TPS * 1000) })).filter(w => w.x >= x0 && w.x <= x1);
}

// ---------- writing a copy ----------
function nextOut(name) {
  fs.mkdirSync(OUT, { recursive: true });
  const slug = String(name || "level").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  let n = 1; while (fs.existsSync(path.join(OUT, `${slug}.e${n}.gdlvl`))) n++;
  return path.join(OUT, `${slug}.e${n}.gdlvl`);
}
function writeCopy(file, L, objects) {
  const rec = L.rec ? clone(L.rec) : GD.newRecord(L.name || "edited level", "");
  const level = { header: L.level.header, objects };
  writeGdlvl(file, rec, level);
  return readGdlvl(file);
}

// ---------- the picture: before | after at the spot, side by side ----------
function shots(beforeFile, afterFile, t, outPng) {
  const sh = path.join(__dirname, "shoot.js"), dir = path.join(ROOT, "local", "shots", "edit_" + path.basename(outPng, ".png"));
  const pics = [];
  for (const [f, tag] of [[beforeFile, "before"], [afterFile, "after"]]) {
    const d = path.join(dir, tag);
    const r = cp.spawnSync(process.execPath, [sh, f, "--at", String(Math.max(0, t)), "--out", d], { windowsHide: true, encoding: "utf8", timeout: 180000 });
    const png = fs.existsSync(d) ? fs.readdirSync(d).filter(x => x.endsWith(".png")).map(x => path.join(d, x))[0] : null;
    if (!png) return { error: (r.stderr || r.stdout || "shoot.js gave no picture").split("\n").slice(-3).join(" ") };
    pics.push(png);
  }
  const r = cp.spawnSync("ffmpeg", ["-v", "error", "-y", "-i", pics[0], "-i", pics[1], "-filter_complex", "[0]scale=960:-1[a];[1]scale=960:-1[b];[a][b]hstack", outPng], { windowsHide: true, encoding: "utf8" });
  return r.status === 0 ? { png: outPng, before: pics[0], after: pics[1] } : { error: "ffmpeg: " + r.stderr, before: pics[0], after: pics[1] };
}

// ---------- the whole edit ----------
// edit({level, at, words, ops, out, dry, noShots, full, noSolve, session}) -> report
function edit(o) {
  const L = loadLevel(o.level), route = routeOf(L);
  const spot = parseSpot(o.at != null ? o.at : "", L, route);
  let ops = o.ops ? [].concat(o.ops) : parse(o.words, spot);
  if (ops && ops.error) return { ok: false, error: ops.error, spot };
  if (!ops.length) return { ok: false, error: "nothing to do: give the change in words or --do", spot };
  const res = apply(L.level, ops, spot);
  const d = diff(L.level.objects, res.objects);
  const rep = { ok: true, level: L.name, src: L.src, spot, ops, changes: res.changes, added: d.added.length, removed: d.removed.length };
  // nothing else changed: every object added or removed lies at the spot's changes (within 2 blocks of a touched x)
  const near = ob => res.xs.some(x => Math.abs(ob.x - x) <= 31 * 3) || d.added.concat(d.removed).length <= 2;
  rep.elsewhere = d.added.concat(d.removed).filter(ob => !near(ob)).length;
  if (o.dry) return rep;
  // the original is never written: a before copy (for checks and the picture) and the after copy
  const out = o.out || nextOut(L.name), before = out.replace(/\.gdlvl$/, ".before.gdlvl");
  const B = L.file ? readGdlvl(L.file) : writeCopy(before, L, L.level.objects);
  const beforeFile = L.file || before;
  if (route && route.sol && !require("./solutions.js").get(B.levelStr, true)) try { require("./solutions.js").put(B.levelStr, clone(route.sol), B.level); } catch (e) {}
  const A = writeCopy(out, L, res.objects);
  const t0 = Date.now(), rs = resolve(A.level, A.levelStr, route && route.sol, { x: spot.x, noSolve: o.noSolve, oldLevel: L.level });
  rep.file = rel(out); rep.solve = rs.how; rep.solveS = +((Date.now() - t0) / 1000).toFixed(1);
  const wA = GD.makeWorld(A.level.objects, A.level.header);
  const runA = rs.sol && rs.sol.events ? GD.run(wA, rs.sol.events) : null;
  rep.beaten = !!(rs.sol && rs.sol.ok && runA && !runA.dead);
  rep.route = rs.sol ? { kind: rs.sol.kind, presses: (rs.sol.events || []).filter(e => e.type === "press").length } : null;
  if (!rep.beaten && runA) rep.dies = { block: blk(runA.end.x), why: runA.why || (rs.sol && rs.sol.why) };
  rep.beforeRoute = route ? { beaten: route.beaten, presses: route.sol.events.filter(e => e.type === "press").length } : null;
  // windows near the spot, before vs after (6 blocks each side of the change)
  const x0 = Math.min(...res.xs, spot.x) - 180, x1 = Math.max(...res.xs, spot.x) + 180;
  const wb = route ? windowsNear(route.sol, route.path, x0, x1) : [], wa = runA ? windowsNear(rs.sol, runA.path, x0, x1) : [];
  const tight = l => l.length ? Math.min(...l.map(w => w.ms)) : null;
  rep.windows = { before: tight(wb), after: tight(wa), inputsBefore: wb.length, inputsAfter: wa.length };
  // the checks before and after: what got better, what got worse (by rule and block)
  const qb = quickChecks(beforeFile, { fast: true }).filter(q => !q.info), qa = quickChecks(out, { fast: true }).filter(q => !q.info);
  const k = q => q.rule + "|" + q.text.replace(/[\d.]+ ms/g, "").replace(/\d+%/g, "");
  const sb = new Set(qb.map(k)), sa = new Set(qa.map(k));
  rep.checks = { before: qb.length, after: qa.length, fixed: qb.filter(q => !sa.has(k(q))), added: qa.filter(q => !sb.has(k(q))) };
  // the fix against the level's MODEL (tools/model.js; the user: a fix should "match the level anyway"): its size, and
  // whether the touched sections keep their role, energy, look and vehicle (BUILDING.md 1 "Fixes through the model")
  try { rep.model = require("./model.js").checkFix(beforeFile, out); } catch (e) { rep.model = { error: e.message }; }
  if (o.full) {
    const r = cp.spawnSync(process.execPath, [path.join(__dirname, "score.js"), out, "--json"], { windowsHide: true, encoding: "utf8", timeout: 3600000 });
    try { const j = JSON.parse(r.stdout.trim().split("\n").pop()); rep.gates = { ok: j.ok, fails: j.gates.filter(g => g.status === "FAIL").map(g => g.name + ": " + g.value) }; } catch (e) { rep.gates = { error: (r.stderr || "").slice(-300) }; }
  }
  rep.viewer = `http://localhost:8765/viewer/#lv=${encodeURIComponent("../" + rep.file)}&t=${spot.t}`;
  if (!o.noShots) rep.picture = shots(beforeFile, out, Math.max(0, spot.t - 0.6), out.replace(/\.gdlvl$/, "_before_after.png"));
  if (o.session) { const r = cp.spawnSync(process.execPath, [path.join(__dirname, "wip.js"), "put", out, "--session", o.session, "--note", "edit: " + (o.words || JSON.stringify(ops))], { windowsHide: true, encoding: "utf8" }); rep.wip = (r.stdout || "").trim().split("\n").slice(-2).join(" "); }
  fs.writeFileSync(out.replace(/\.gdlvl$/, ".json"), JSON.stringify(Object.assign({ words: o.words || null, at: o.at, made: new Date().toISOString() }, rep), null, 1));
  return rep;
}

function show(levelSpec, at) {
  const L = loadLevel(levelSpec), route = routeOf(L), spot = parseSpot(at || "", L, route);
  const near = L.level.objects.filter(o => Math.abs(o.x - spot.x) <= 150 && kindOf(o) !== "trigger" && (GAMEPLAY.has(kindOf(o)) || ARROW.has(o.id))).sort((a, b) => a.x - b.x || a.y - b.y);
  console.log(`${L.name}: spot block ${spot.block} (x ${Math.round(spot.x)}, col ${spot.col}), t ${spot.t} s` + (spot.playerY != null ? `, the player at row ${((spot.playerY - 15) / 30).toFixed(1)}` : "") + (route ? `, route ${route.beaten ? "beaten" : "dies at block " + blk(route.end.x)}` : ", no saved route"));
  for (const o of near) console.log(`   ${String((GD.objInfo(o.id) || {}).name || o.id).padEnd(14)} id ${String(o.id).padEnd(5)} col ${((o.x - 15) / 30).toFixed(1).padStart(6)} row ${((o.y - 15) / 30).toFixed(1).padStart(5)}${o.rot ? " rot " + o.rot : ""}${ARROW.has(o.id) ? " (jump mark)" : ""}`);
  // a text picture of the 11 columns around the spot (textmap.js style)
  console.log(textPicture(L.level.objects, spot, route));
}
function textPicture(objs, spot, route, half = 8) {
  const c0 = spot.col - half, c1 = spot.col + half, rows = [];
  const ch = o => { const k = kindOf(o); return ARROW.has(o.id) ? "v" : k === "solid" ? "#" : k === "slope" ? "/" : k === "hazard" ? ((o.rot || 0) % 360 === 180 ? "V" : "^") : k === "orb" ? "o" : k === "pad" ? "_" : ["mode", "gravity", "speed", "size"].includes(k) ? "|" : null; };
  const grid = new Map();
  for (const o of objs) { const c = ch(o); if (!c) continue; const col = Math.floor(o.x / 30), r = Math.floor(o.y / 30); if (col >= c0 && col <= c1 && r >= 0 && r < 10) grid.set(col + "," + r, c); }
  if (route) for (const p of route.path) { const col = Math.floor(p.x / 30), r = Math.floor(p.y / 30); if (col >= c0 && col <= c1 && r >= 0 && r < 10 && !grid.has(col + "," + r)) grid.set(col + "," + r, "."); }
  let top = 0; for (const k of grid.keys()) top = Math.max(top, +k.split(",")[1]);
  for (let r = top; r >= 0; r--) { let s = String(r).padStart(3) + " "; for (let c = c0; c <= c1; c++) s += grid.get(c + "," + r) || " "; rows.push(s); }
  rows.push("    " + "=".repeat(c1 - c0 + 1) + `   (cols ${c0}-${c1}; spot col ${spot.col} = the ${half + 1}th; # block / slope ^ spike o orb _ pad | portal v mark . route)`);
  return rows.join("\n");
}

function print(rep) {
  if (!rep.ok) { console.log("edit: " + rep.error); return; }
  console.log(`== ${rep.level}: edit at block ${rep.spot.block} (t ${rep.spot.t} s)`);
  console.log("   ops: " + JSON.stringify(rep.ops));
  for (const c of rep.changes) console.log(`   ${c.what}  [blocks ${c.blocks.join(", ")}]`);
  console.log(`   objects: +${rep.added} -${rep.removed}` + (rep.elsewhere ? `, ${rep.elsewhere} AWAY from the spot (check!)` : ", nothing else changed"));
  if (!rep.file) { console.log("   (dry run: nothing written)"); return; }
  console.log(`   copy: ${rep.file}  (the original is untouched)`);
  console.log(`   route: ${rep.beaten ? "BEATEN" : "NOT BEATEN" + (rep.dies ? ` -- dies at block ${rep.dies.block} (${rep.dies.why})` : "")}, ${rep.route ? rep.route.presses + " presses, " + rep.route.kind : "no route"}; ${rep.solve} in ${rep.solveS} s` + (rep.beforeRoute ? `  (before: ${rep.beforeRoute.presses} presses)` : ""));
  if (rep.windows.before != null || rep.windows.after != null) console.log(`   tightest window near the spot: ${rep.windows.before ?? "-"} ms -> ${rep.windows.after ?? "-"} ms`);
  console.log(`   checks: ${rep.checks.before} -> ${rep.checks.after}` + (rep.checks.fixed.length ? `; gone: ${rep.checks.fixed.map(q => q.rule + " (" + q.text + ")").join("; ")}` : "") + (rep.checks.added.length ? `; NEW: ${rep.checks.added.map(q => q.rule + " (" + q.text + ")").join("; ")}` : ""));
  if (rep.model && !rep.model.error) console.log(`   model: a ${rep.model.size} fix -- ${rep.model.ok ? "keeps the level's model" : rep.model.next}` + (rep.model.notes.length ? "; " + rep.model.notes.join("; ") : ""));
  if (rep.gates) console.log(`   score.js: ${rep.gates.ok ? "READY" : "NOT READY"}${rep.gates.fails && rep.gates.fails.length ? " -- " + rep.gates.fails.join("; ") : ""}${rep.gates.error ? rep.gates.error : ""}`);
  if (rep.picture) console.log(`   picture: ${rep.picture.png ? rel(rep.picture.png) : "failed: " + rep.picture.error}`);
  console.log(`   viewer: ${rep.viewer}`);
  if (rep.wip) console.log(`   wip: ${rep.wip}`);
}

const VOCAB = `words it reads (one change, or several joined by "then" / ";"):
  add [a|2] <thing> [here] [N blocks up|down|left|right] [row R]     add a yellow orb 2 blocks up
  remove|delete this <thing> / these <things> [from b40 to b50]      remove these spikes
  lower|raise this <thing> [by N]; move this <thing> left|right|up|down [by N]   lower this block by 1
  extend|widen this <thing> [by N] [left|right]                      extend this block 2 right
  replace this <thing> with <thing>; change these <things> to <thing>  replace this yellow orb with a pink orb
  make this section a <mode>                                          make this section a wave
things: ${Object.keys(TYPES).join(", ")}; classes: ${Object.keys(CLASSES).join(", ")}; or an object id.
"this" = the nearest one to the spot (4 blocks at most); "these" = its row (hazards, orbs) or its structure
(touching blocks); a block moves with what stands on it. Ops JSON (--do): see the top of tools/edit.js.`;

module.exports = { edit, loadLevel, routeOf, parseSpot, parse, apply, diff, select, quickChecks, windowsNear, resolve, writeCopy, nextOut, shots, textPicture, classOf, print };

if (require.main === module) {
  const a = process.argv.slice(2), opt = k => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : undefined; };
  if (a.includes("--vocab")) { console.log(VOCAB); process.exit(0); }
  const takes = new Set(["--at", "--do", "--out", "--session"]);
  const free = a.filter((x, i) => !x.startsWith("--") && !takes.has(a[i - 1]));
  if (!free.length) { console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n")); process.exit(1); }
  const [level, ...rest] = free;
  if (a.includes("--show")) { show(level, opt("--at")); process.exit(0); }
  let rep;
  try {
    rep = edit({ level, at: opt("--at"), words: rest.join(" "), ops: opt("--do") ? JSON.parse(opt("--do")) : null, out: opt("--out"),
      dry: a.includes("--dry"), noShots: a.includes("--no-shots"), full: a.includes("--full"), noSolve: a.includes("--no-solve"), session: opt("--session") });
  } catch (e) { rep = { ok: false, error: e.message }; }
  if (a.includes("--json")) console.log(JSON.stringify(rep, null, 1)); else print(rep);
  process.exit(rep.ok ? (rep.file && !rep.beaten ? 2 : 0) : 1);
}
