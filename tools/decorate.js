// Style passes for tools/make.js: block skins, ground decoration, colours, and the triggers the
// memory style uses. Works on GD objects ({id, x, y, rot, flipX, flipY, props}), in GD units.
// Rules are learnt from the official levels by tools/style.js (see STYLE.md "How the numbers
// were got"); nothing is copied from a level, only which skin goes on which kind of edge.
//
// Trigger property sets are copied from triggers the user placed in their own levels in the
// editor (memory rooms, memory cube, yet another triple), so the game reads them as it wrote them:
//   colour  899:  7 r, 8 g, 9 b, 10 seconds, 23 channel, 35 opacity, 36 1
//   alpha  1007: 10 seconds, 35 opacity, 51 target group, 36 1
//   zoom   1913: 10 seconds, 30 easing, 85 2, 371 zoom, 36 1
//   object:      57 groups (dot-separated), 21 main colour channel
// Key 36 is on every trigger the user placed; its meaning is not confirmed.

const CH = { bg: 1000, ground: 1001, line: 1002, obj: 1004, ground2: 1009 };

// --- block skins: the classic outlined set (ids 1..7), by which sides are exposed ---
// From official levels 1-8: interior = 5 (plain fill), one exposed side = 2 (edge) turned to face
// it, two adjacent sides = 3 (corner), opposite sides = 7 (strip), three sides = 6 (end cap),
// alone = 1 (full outline). Rotation is clockwise degrees, as GD stores it.
const SKIN = {
  "": [5, 0], U: [2, 0], D: [2, 0, false, true], L: [2, -90], R: [2, 90],
  UL: [3, 0], UR: [3, 0, true], DL: [3, 0, false, true], RD: [3, 0, true, true],
  RL: [7, 0], UD: [7, 90],
  URL: [6, 0], RDL: [6, 0, false, true], UDL: [6, -90], URD: [6, 90], URDL: [1, 0],
};
function skinBlocks(objects) {
  const cell = o => Math.round((o.x - 15) / 30) + "," + Math.round((o.y - 15) / 30);
  const blocks = objects.filter(o => o.id === 1 && !o.rot);
  // slopes count as neighbours too: a block under a slope has no outline on top (else a slope
  // wall shows a staircase of lines under it)
  const has = new Set(blocks.map(cell).concat(objects.filter(o => o.id === 1338 || o.id === 1339).map(cell)));
  const at = (c, r) => has.has(c + "," + r);
  for (const o of blocks) {
    const c = Math.round((o.x - 15) / 30), r = Math.round((o.y - 15) / 30);
    const m = (at(c, r + 1) ? "" : "U") + (at(c + 1, r) ? "" : "R") + (at(c, r - 1) || r === 0 ? "" : "D") + (at(c - 1, r) ? "" : "L");
    const [id, rot, fx, fy] = SKIN[m];
    o.id = id; o.rot = rot; o.flipX = !!fx; o.flipY = !!fy;
  }
}

// --- ground decoration: small plants/rocks on the floor and on platform tops, never on a
// column that has a hazard or an orb/pad near it (decoration must not hide gameplay) ---
// Official levels 1-8: 18, 19, 20, 21 sit on the ground (y offsets below); 16 sits on block tops.
// Seen in the user's game (GDLM 41): 18-21 are pale icy crystal spikes up to ~1 block tall --
// they read like hazards, so keep them sparse and 3+ squares from any real spike. 16 is a thin
// antenna with a ball on top. No hitbox either way.
const GROUND_DECO = [[18, 4], [19, 4], [20, -2], [21, -8]]; // id, y offset in units from the row centre
const TOP_DECO = [[16, -1]];
// densityAt(col): share of free columns that get one (default 0.25); compose.js sets it per section
// (calm breaks bare, busy parts fuller) through the spec's "decoDensity": [[fromCol, share], ...].
function groundDeco(objects, endCol, seed = 1, densityAt = () => 0.25) {
  let s = seed;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const busy = new Set(), solid = new Set();
  for (const o of objects) {
    const c = Math.round((o.x - 15) / 30), r = Math.round((o.y - 15) / 30);
    if ([1, 2, 3, 4, 5, 6, 7].includes(o.id)) solid.add(c + "," + r);
    else for (let d = -3; d <= 3; d++) busy.add(c + d);
  }
  const out = [];
  for (let c = 0; c < endCol; c++) {
    if (busy.has(c) || rnd() > densityAt(c)) continue;
    // the top of this column: ground or the highest block
    let top = -1;
    for (let r = 0; r < 20; r++) if (solid.has(c + "," + r)) top = r;
    const [id, dy] = top < 0 ? GROUND_DECO[Math.floor(rnd() * GROUND_DECO.length)] : TOP_DECO[0];
    out.push({ id, x: c * 30 + 15, y: (top + 1) * 30 + 15 + dy, rot: 0, flipX: rnd() < 0.5, flipY: false, props: { 155: "1" } });
  }
  return out;
}

// --- triggers ---
function colourTrigger(col, channel, rgb, secs = 0.5, row = 8) {
  const ch = typeof channel === "string" ? CH[channel] : channel;
  if (!ch) throw new Error("unknown colour channel " + channel);
  return { id: 899, x: col * 30 + 15, y: row * 30 + 15, rot: 0, props: {
    7: String(rgb[0]), 8: String(rgb[1]), 9: String(rgb[2]), 10: String(secs), 23: String(ch), 35: "1", 36: "1", 155: "1" } };
}
function fadeTrigger(col, group, to = 0, secs = 0.2, row = 9) {
  return { id: 1007, x: col * 30 + 15, y: row * 30 + 15, rot: 0, props: { 10: String(secs), 35: String(to), 36: "1", 51: String(group), 155: "1" } };
}
function zoomTrigger(col, zoom = 0.7, secs = 0.5, row = 10) {
  return { id: 1913, x: col * 30 + 15, y: row * 30 + 15, rot: 0, props: { 10: String(secs), 30: "0", 36: "1", 85: "2", 371: String(zoom), 155: "1" } };
}

// --- header colours: set the start colour of bg / ground / ground2 / line / obj ---
function setHeaderColours(header, colours) {
  return header.replace(/kS38,([^,]*)/, (all, list) => "kS38," + list.split("|").map(c => {
    if (!c) return c;
    const m = /(?:^|_)6_(\d+)/.exec(c);
    const want = m && Object.entries(colours).find(([k]) => CH[k] === +m[1]);
    if (!want) return c;
    const [r, g, b] = want[1];
    return c.replace(/^1_\d+_2_\d+_3_\d+/, `1_${r}_2_${g}_3_${b}`);
  }).join("|"));
}
// background (kA6) and ground (kA7) art: numbers as the header stores them
function setHeaderArt(header, bg, ground) {
  if (bg != null) header = header.replace(/kA6,\d+/, "kA6," + bg);
  if (ground != null) header = header.replace(/kA7,\d+/, "kA7," + ground);
  return header;
}

// --- jump indicators: a small arrow over the area where a jump starts, pointing down at it (the
// user: "a small arrow pointing to the ground, in the area vaguely you have to jump"). Modern levels
// put them where a jump cannot be read in time, not on every click (that is clutter). Placed from the
// solver's run, at cube/robot takeoffs from a surface, and kept only where the jump is NOT obvious:
//   far cue   the hazard or block it is for is more than 2.5 blocks ahead of the takeoff (the jump
//             looks early: the GDLM 45 v4 death spot, a jump off a 3-high stair over a spike past
//             the landing, died there 3 times in a row)
//   ledge     the takeoff is the last column of a raised surface (jumping off an edge)
//   portal    the first jump within 12 blocks after a mode / gravity change
//   new       the first jump at or after a column in opts.at (compose.js: a pattern's first use)
// No two within 4 blocks; orb and pad launches get none (the orb or pad is the cue). Upside down
// the arrow hangs under the ceiling and points up at it. opts.all: every takeoff (the old rule).
// What the mark is: anything small and softer than the level, never like a hazard (the user: "dont
// have to be arrows but thats the usual usage, something small bit softer than the level so not to
// confuse with real spikes ... people put anything, from circles to smileys"). Default: a GD text
// object (914, key 31 = base64 text) showing a small "v" -- an arrow pointing at the ground whose look
// is certain, no deco-id guess -- in its own group, faded to `alpha` by an alpha trigger at the start.
// A deco arrow can replace it per spec: "indicators": {"id": N, "rot": n} (no text then).
const INDICATOR = { id: 914, text: "v", scale: 0.8, group: 990, alpha: 0.45, lift: 45, rot: 0 }; // lift: surface -> mark centre
function jumpIndicators(w, r, id, GD, opts = {}) {
  const path = GD.run(w, r.events).path, out = [], marks = [];
  const boxes = w.items || [];
  const solidAt = (x, y) => boxes.some(b => (b.kind === "solid" || b.kind === "slope") && b.x0 <= x && b.x1 >= x && b.y0 <= y && b.y1 >= y);
  let lastChange = -1e9, prevMode = path[0] && path[0].mode, prevGrav = path[0] && (path[0].grav || 1);
  const at = (opts.at || []).map(c => c * 30 + 15).sort((a, b) => a - b);
  let atI = 0;
  for (let t = 1; t < path.length; t++) {
    const a = path[t - 1], s = path[t];
    if (s.mode !== prevMode || (s.grav || 1) !== prevGrav) { lastChange = s.x; prevMode = s.mode; prevGrav = s.grav || 1; }
    if (!a.grounded || s.grounded || !(a.mode === "cube" || a.mode === "robot")) continue;
    if (s.act !== "jump" || s.vy * (s.grav || 1) <= 0) continue;
    const g = a.grav || 1, up = g > 0;
    const surface = up ? a.y - 15 : a.y + 15;
    // what the jump is for: the first hazard, or a solid face, ahead on the player's level
    let cue = Infinity;
    for (const b of boxes) {
      if (!(b.kind === "hazard" || b.kind === "solid" || b.kind === "slope")) continue;
      if (b.x0 <= a.x + 15 || b.x0 > a.x + 240) continue;
      const lo = up ? surface - 5 : surface - 70, hi = up ? surface + 70 : surface + 5;
      if (b.y1 < lo || b.y0 > hi) continue;
      if (b.kind !== "hazard" && (up ? b.y1 <= surface + 2 : b.y0 >= surface - 2)) continue; // the floor it runs on
      cue = Math.min(cue, b.x0 - (a.x + 15));
    }
    const why = [];
    if (cue > 75 && cue !== Infinity) why.push("far cue");
    const under = up ? surface - 5 : surface + 5;
    if (Math.abs(surface) > 2 && solidAt(a.x, under) && !solidAt(a.x + 30, under)) why.push("ledge");
    if (a.x - lastChange < 360) { why.push("portal"); lastChange = -1e9; }
    while (atI < at.length && at[atI] <= a.x + 90) { atI++; if (at[atI - 1] > a.x - 60) why.push("new"); } // the jump for a chunk starts ~1-3 blocks before it
    if (!opts.all && !why.length) continue;
    if (marks.length && a.x - marks[marks.length - 1] < 120) continue;
    marks.push(a.x);
    const x = Math.round(a.x / 15) * 15;  // loosely: the area, not the tick
    out.push({ id, x, y: up ? surface + INDICATOR.lift : surface - INDICATOR.lift,
      rot: ((opts.rot ?? INDICATOR.rot) + (up ? 0 : 180)) % 360, flipX: false, flipY: false, props: markProps(id, opts), why: why.join(",") });
  }
  return out;
}
function markProps(id, opts) {
  const p = { 155: "1", 57: String(opts.group ?? INDICATOR.group) };
  if (id === 914) { p[31] = Buffer.from(opts.text ?? INDICATOR.text).toString("base64"); p[32] = String(opts.scale ?? INDICATOR.scale); }
  return p;
}
// the alpha trigger that makes the marks soft, at the level's start
function indicatorFade(opts = {}) { return fadeTrigger(0, opts.group ?? INDICATOR.group, opts.alpha ?? INDICATOR.alpha, 0, 11); }

module.exports = { INDICATOR, jumpIndicators, indicatorFade, CH, SKIN, skinBlocks, groundDeco, colourTrigger, fadeTrigger, zoomTrigger, setHeaderColours, setHeaderArt };
