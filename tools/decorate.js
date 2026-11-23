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
//   far cue   the hazard or block it is for is more than 2 blocks ahead of the takeoff (the jump
//             looks early: the GDLM 45 v4 death spot, a jump off a 3-high stair over a spike past
//             the landing, died there 3 times in a row)
//   ledge     the takeoff is the last column of a raised surface (jumping off an edge)
//   portal    the first jump within 12 blocks after a mode / gravity change
//   new       the first jump at or after a column in opts.at (compose.js: a pattern's first use)
// Placed from the NATURAL plan (lib/natural.js: one tap per jump, no empty jumps; the solver's held
// button re-jumps on landings, and the user: "the second indicator is wrong, dont need to jump there").
// Every real jump gets one (the user, GDLM 46 v2: "no indicator in some of the jumps" -- a filter for
// only the unreadable ones dropped 10 of 13); `why` says what makes it hard to read; opts.only keeps
// just those. No two within 2 blocks; orb and pad launches get none (the orb or pad is the cue). Upside down
// the arrow hangs under the ceiling and points up at it. opts.all: every takeoff (the old rule).
// What the mark is: anything small and softer than the level, never like a hazard (the user: "dont
// have to be arrows but thats the usual usage, something small bit softer than the level so not to
// confuse with real spikes ... people put anything, from circles to smileys"). Default: deco 460
// (d_arrow_02, the classic chevron ">", knowledge/objects/catalogue.tsv) turned 90 degrees clockwise
// to point at the ground, scale 0.7, on white (1011: its own channel 1006 is the player's colour) in
// its own group, faded to `alpha` by an alpha trigger at the start. Any id works per spec:
// "indicators": {"id": N, "rot": n, "ch": n}; id 914 = a text object showing `text` (e.g. "v").
const INDICATOR = { id: 460, rot: 90, ch: 1011, scale: 0.7, text: "v", group: 990, alpha: 0.45, lift: 30 }; // lift: surface -> mark centre (45 read 'a bit too high', GDLM 44 v8; rated median 30)
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
    if (cue > 60 && cue !== Infinity) why.push("far cue");
    const under = up ? surface - 5 : surface + 5;
    if (Math.abs(surface) > 2 && solidAt(a.x, under) && !solidAt(a.x + 30, under)) why.push("ledge");
    if (a.x - lastChange < 360) { why.push("portal"); lastChange = -1e9; }
    while (atI < at.length && at[atI] <= a.x + 90) { atI++; if (at[atI - 1] > a.x - 60) why.push("new"); } // the jump for a chunk starts ~1-3 blocks before it
    if (opts.only && !why.length) continue;   // opts.only: just the jumps that cannot be read in time
    if (marks.length && a.x - marks[marks.length - 1] < 60) continue;
    marks.push(a.x);
    const x = Math.round((a.x + 15) / 15) * 15;  // loosely: the area, half a block past the press (rated: ~0.5 block before the hazard)
    out.push({ id, x, y: up ? surface + INDICATOR.lift : surface - INDICATOR.lift,
      rot: ((opts.rot ?? INDICATOR.rot) + (up ? 0 : 180)) % 360, flipX: false, flipY: false, props: markProps(id, opts), why: why.join(",") });
  }
  return out;
}
function markProps(id, opts) {
  const p = { 155: "1", 57: String(opts.group ?? INDICATOR.group) };
  p[32] = String(opts.scale ?? INDICATOR.scale);
  if (id === 914) p[31] = Buffer.from(opts.text ?? INDICATOR.text).toString("base64");
  else p[21] = String(opts.ch ?? INDICATOR.ch);
  return p;
}
// the alpha trigger that makes the marks soft, at the level's start
function indicatorFade(opts = {}) { return fadeTrigger(0, opts.group ?? INDICATOR.group, opts.alpha ?? INDICATOR.alpha, 0, 11); }

// --- the modern pass (knowledge/levels/modern_look.md; ids from knowledge/objects/catalogue.tsv) ---
// The user: GDLM looks "like 1.0 graphics". 2.0+ levels decorate every block (the designed-block kit:
// a lit fill behind the outline, a soft gradient on its lit side), put a backdrop shape set per section,
// a motif that runs through every section, frames of clouds around the play, a title and an end card,
// every deco object on its own colour channel and z-layer (key 24: B5..B1 = -5,-3,-1,1,3; T1..T4 =
// 5,7,9,11). The example the user picked (Fall Out) does it with ~13 objects per block; this pass
// stays near 5-6 (the phone page carries a level in one 250 KB database row). Hazards keep their
// own white look; nothing solid goes in front of the play.
// sections: [{from, to, kind: "cube"|"ship"|"wave"|"ball"|"upside"|"rest"|"break", fill:[r,g,b], light:[r,g,b]}]
const LAYER = { B5: -5, B4: -3, B3: -1, B2: 1, B1: 3, T1: 5, T2: 7, T3: 9, T4: 11 };
const KITS = {   // backdrop shapes per kind of section: [id, scale]
  cube: [[997, 1.2], [999, 1.6], [1000, 2]],          // ring segments
  upside: [[180, 1.4], [181, 1.8], [182, 2.2]],      // cartwheels
  ship: [[936, 1.6], [937, 1.4], [938, 2]],          // art clouds
  ball: [[1058, 2], [1059, 2.4], [1060, 2.8]],       // spirals
  wave: [[394, 1.2], [395, 1.6], [396, 2.2]],        // geometric hexagons
};
// where GD's "Attempt N" text shows at the level start (units; x from the level start, y from the
// ground), with room for 3-digit counts: no text object may overlap it (make.js warns)
const ATTEMPT_ZONE = { x0: -30, x1: 360, y0: 105, y1: 195 };
// a text object's half width in units (GD's big font: ~20 units per character at scale 1; approximate)
const textHalfWidth = (t, sc) => String(t).length * 20 * sc / 2;
function modernPass(objects, sections, opts = {}) {
  let sd = opts.seed || 3;
  const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  const out = [], CH0 = opts.ch0 || 20;
  const o = (id, x, y, ch, z, extra = {}) => ({ id, x, y, rot: extra.rot || 0, flipX: !!extra.flipX, flipY: false,
    props: Object.assign({ 155: "1", 21: String(ch), 24: String(z) }, extra.scale ? { 32: String(extra.scale) } : {}) });
  const blocks = objects.filter(b => b.id >= 1 && b.id <= 7);
  const solidAt = new Set(blocks.map(b => Math.round((b.x - 15) / 30) + "," + Math.round((b.y - 15) / 30)));
  sections.forEach((sec, i) => {
    const fill = CH0 + 2 * i, light = fill + 1, x0 = sec.from * 30, x1 = sec.to * 30;
    out.push(colourTrigger(0, fill, sec.fill, 0, 12), colourTrigger(0, light, sec.light, 0, 13));
    const calm = sec.kind === "rest" || sec.kind === "break";
    // designed blocks: a lit fill behind every block, a soft light on the ones with open tops
    for (const b of blocks) {
      if (b.x < x0 || b.x >= x1) continue;
      out.push(o(207, b.x, b.y, fill, LAYER.B1));
      const c = Math.round((b.x - 15) / 30), r = Math.round((b.y - 15) / 30);
      if (!solidAt.has(c + "," + (r + 1))) out.push(o(505, b.x, b.y, light, LAYER.B1, { rot: 0 }));
    }
    if (calm) return;   // breaks stay bare: the sparse part is the striking one
    // backdrop shapes, every 6-10 columns, high and faint
    const kit = KITS[sec.kind] || KITS.cube;
    for (let x = x0 + 60; x < x1 - 60; x += 180 + rnd() * 120) {
      const [id, sc] = kit[Math.floor(rnd() * kit.length)];
      out.push(o(id, x, 150 + rnd() * 150, light, LAYER.B3, { scale: sc, rot: Math.round(rnd() * 360) }));
    }
    // open stretches (cube on the floor, upside down, ball) have few blocks to decorate, so they read as
    // empty next to the corridors (the user on GDLM 45 v6 at ~24.7 s: "some places are very empty in
    // deco"; score.js "deco coverage"). A calm, dim back row: the kit's shapes small and low, far back
    // (B4) on the section's darker fill channel, every 2.5-4.5 blocks, and a second pass of dots.
    if (["cube", "upside", "ball"].includes(sec.kind)) {
      for (let x = x0 + 45; x < x1 - 45; x += 75 + rnd() * 60) {
        const [id, sc] = kit[Math.floor(rnd() * kit.length)];
        out.push(o(id, x, 60 + rnd() * 90, fill, LAYER.B4, { scale: +(sc * 0.55).toFixed(2), rot: Math.round(rnd() * 360) }));
      }
      for (let x = x0 + 30; x < x1 - 30; x += 50 + rnd() * 50) out.push(o(725, x, 40 + rnd() * 250, light, LAYER.B2, { scale: +(0.4 + rnd() * 0.5).toFixed(2) }));
    }
  });
  // the motif through every section: small dots drifting at all heights, behind the play
  const endX = Math.max(...sections.map(s => s.to)) * 30;
  for (let x = 45; x < endX; x += 45 + rnd() * 60) {
    const sec = sections.find(s => x >= s.from * 30 && x < s.to * 30);
    if (!sec || sec.kind === "break") continue;
    const i = sections.indexOf(sec);
    // 725: a plain small circle (the d_small_ball ids 1764-1766 draw as crosses and little triangles:
    // spike-like next to the play, seen in a shoot.js render)
    out.push(o(725, x, 40 + rnd() * 250, CH0 + 2 * i + 1, LAYER.B2, { scale: 0.5 + rnd() * 0.7 }));
  }
  // cloud bands framing the top of the play
  for (let x = 30; x < endX; x += 70 + rnd() * 40) {
    const sec = sections.find(s => x >= s.from * 30 && x < s.to * 30); if (!sec) continue;
    out.push(o([936, 937, 938][Math.floor(rnd() * 3)], x, 390 + rnd() * 30, CH0 + 2 * sections.indexOf(sec) + 1, LAYER.B2, { scale: 1.2 + rnd() * 0.6 }));
  }
  // a title at the start and an end card
  const text = (t, x, y, sc) => ({ id: 914, x, y, rot: 0, flipX: false, flipY: false, props: { 155: "1", 31: Buffer.from(t).toString("base64"), 32: String(sc), 24: String(LAYER.B1) } });
  // the title starts after GD's "Attempt N" counter: it sits ~5 rows up from the start position to ~6
  // blocks ahead (more with 3 digits), measured on the user's recording 2026-11-23_02-51-50.mkv (11 s,
  // "Attempt 2"); the title at block 10 was covered (GDLM 47, the user). Left edge at block 12 or later.
  if (opts.title) { const sc = 0.9, half = textHalfWidth(opts.title, sc); out.push(text(opts.title, Math.max(600, ATTEMPT_ZONE.x1 + half), 150, sc)); }
  if (opts.end) out.push(text(opts.end, endX - 240, 150, 0.8));
  return out;
}

module.exports = { ATTEMPT_ZONE, textHalfWidth, INDICATOR, jumpIndicators, markProps, indicatorFade, modernPass, LAYER, KITS, CH, SKIN, skinBlocks, groundDeco, colourTrigger, fadeTrigger, zoomTrigger, setHeaderColours, setHeaderArt };
