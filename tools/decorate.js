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

// --- jump indicators: a small "^" just above the surface where a jump starts (modern levels use
// them; the user asked for them, also to read Claude's intent). Placed from the solver's run: one
// per cube/robot takeoff from a surface (a held button re-jumps on landing, so a press can mean
// several jumps). Orb and pad launches get none (the orb or pad is the cue). Upside down, the mark hangs under the ceiling and points down.
// The chevron's object id is not confirmed yet: INDICATOR.id, overridable per spec.
const INDICATOR = { id: null, lift: 12 }; // lift: units from the surface to the mark's centre
function jumpIndicators(w, r, id, GD) {
  if (!id) throw new Error("jump indicators need the chevron's object id: spec \"indicators\": {\"id\": N}");
  // every takeoff, not every press: a held button re-jumps on each landing
  const path = GD.run(w, r.events).path, out = [];
  for (let t = 1; t < path.length; t++) {
    const a = path[t - 1], s = path[t];
    if (!a.grounded || s.grounded || !(a.mode === "cube" || a.mode === "robot")) continue;
    if (s.act !== "jump" || s.vy * (s.grav || 1) <= 0) continue;
    const up = (a.grav || 1) > 0;
    const surface = up ? a.y - 15 : a.y + 15;
    out.push({ id, x: +a.x.toFixed(1), y: up ? surface + INDICATOR.lift : surface - INDICATOR.lift, rot: up ? 0 : 180, flipX: false, flipY: false, props: { 155: "1" } });
  }
  return out;
}

module.exports = { INDICATOR, jumpIndicators, CH, SKIN, skinBlocks, groundDeco, colourTrigger, fadeTrigger, zoomTrigger, setHeaderColours, setHeaderArt };
