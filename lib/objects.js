// Object IDs -> what they are, how to draw them, how they collide.
// One grid square is 30 units. x,y in a level are the object's CENTRE; ground top is y=0,
// so a block sitting on the ground is at y=15.
//
// sure:false = not yet confirmed (named from a 2.1-era object list or memory). Confirm by
// seeing it in the user's game (a hitbox-on recording does this best) and flip it to true.
// hit = hitbox {w,h,ox,oy} around the centre, before the object's rotation.
// Sources for numbers: see CLAUDE.md "Physics sources".
(function (GD) {
  "use strict";
  const X = (typeof module !== "undefined" && typeof require !== "undefined") ? require("./objects_extra.js").EXTRA : (GD.EXTRA || {});
  const DECO = (typeof module !== "undefined" && typeof require !== "undefined") ? require("./objects_gd22.js").DECO22 : (GD.DECO22 || []);
  const T = {};
  function def(ids, d) { for (const id of [].concat(ids)) T[id] = Object.assign({ id }, d); }

  // solid blocks (the editor's many block skins share one behaviour)
  def(1, { name: "block", kind: "solid", hit: { w: 30, h: 30 }, sure: true });
  // other block skins come from the OpenGD table (objects_extra.js). Not every block-looking id is
  // solid: 5, 73, 80 have no hitbox there, and Polargeist runs straight through a column of 5s
  // (gdsolver's real-game plan, block 589.5) -- so no blanket "all skins are solid" list here.
  def(40, { name: "slab", kind: "solid", hit: { w: 30, h: 14 }, sure: true }); // centred: Back On Track puts it at y=23, top flush with blocks (gdsolver plan clears only so)
  def(468, { name: "thin line", kind: "solid", hit: { w: 30, h: 1.5 }, sure: false });
  // 45-degree slope, one square, rising to the right before rotation/flip
  def(1338, { name: "slope 45", kind: "slope", hit: { w: 30, h: 30 }, rise: 1, sure: true });
  def(1339, { name: "slope 22", kind: "slope", hit: { w: 60, h: 30 }, rise: 0.5, sure: false });
  // the other slope skins: GD's slopes come in pairs, a 30x30 (45 degrees) and a 60x30 (22.5).
  // OpenGD's table calls them solid or (like 1338 itself) hazard; Blast Processing's wave rides
  // up 309 in its real-game plan. sure:false until each skin is seen in the game.
  [289, 294, 299, 305, 309, 315, 321, 326, 331, 337, 343, 349, 353, 363, 366, 371, 483, 492, 651, 665,
   673, 709, 711, 726, 728, 886, 1341, 1344, 1717, 1723, 1743, 1745, 1747, 1749, 1906].forEach(id => {
    def(id, { name: "slope 45", kind: "slope", hit: { w: 30, h: 30 }, rise: 1, sure: false });
  });
  [291, 295, 301, 307, 311, 317, 323, 327, 333, 339, 345, 351, 355, 364, 367, 372, 484, 493, 652, 666,
   674, 710, 712, 727, 729, 887, 1342, 1345, 1718, 1724, 1744, 1746, 1748, 1750, 1907].forEach(id => {
    def(id, { name: "slope 22", kind: "slope", hit: { w: 60, h: 30 }, rise: 0.5, sure: false });
  });

  // hazards: GD's hitbox is 0.2 x sprite width, 0.4 x sprite height (boxes, not triangles)
  def(8, { name: "spike", kind: "hazard", shape: "spike", hit: { w: 6, h: 12 }, sure: true });
  def(39, { name: "small spike", kind: "hazard", shape: "smallspike", hit: { w: 6, h: 5.6, oy: -4 }, sure: false });
  def(103, { name: "medium spike", kind: "hazard", shape: "midspike", hit: { w: 4, h: 7.6, oy: -2 }, sure: false });

  // orbs: 36x36 square activation box. Cube velocities in GD units per 1/60 s "frame",
  // as multiples of the speed's jump velocity (yStart).
  const ORB = { w: 36, h: 36 };
  def(36, { name: "yellow orb", kind: "orb", act: "jump", mul: 1, shipMul: 1, color: "#ffe000", hit: ORB, sure: true });
  def(141, { name: "pink orb", kind: "orb", act: "jump", mul: 0.72, shipMul: 0.37, ballMul: 0.77, color: "#ff5ad2", hit: ORB, sure: false });
  def(1333, { name: "red orb", kind: "orb", act: "jump", mul: 1.38, shipMul: 1, color: "#ff3030", hit: ORB, sure: true });
  def(84, { name: "blue orb", kind: "orb", act: "blue", mul: 0.8, shipMul: 0.8, color: "#38c8ff", hit: ORB, sure: true });
  def(1022, { name: "green orb", kind: "orb", act: "green", mul: 1, shipMul: 0.7, color: "#40ff60", hit: ORB, sure: false });
  def(1330, { name: "black orb", kind: "orb", act: "black", color: "#555", hit: ORB, sure: false });
  def(1704, { name: "green dash orb", kind: "orb", act: "dash", color: "#40ff60", hit: ORB, sure: true });
  def(1751, { name: "pink dash orb", kind: "orb", act: "dash", flip: true, color: "#ff5ad2", hit: ORB, sure: false });
  def(3004, { name: "spider orb", kind: "orb", act: "spider", color: "#c050ff", hit: ORB, sure: true });

  // pads: touch to fire. Velocity = bump x 16 (per frame).
  def(35, { name: "yellow pad", kind: "pad", act: "jump", bump: 1, shipBump: 1, color: "#ffe000", hit: { w: 25, h: 4 }, sure: false });
  def(140, { name: "pink pad", kind: "pad", act: "jump", bump: 0.65, shipBump: 0.35, color: "#ff5ad2", hit: { w: 25, h: 5 }, sure: false });
  def(1332, { name: "red pad", kind: "pad", act: "jump", bump: 1.25, shipBump: 0.63, color: "#ff3030", hit: { w: 29, h: 7 }, sure: true });
  def(67, { name: "blue pad", kind: "pad", act: "blue", bump: 0.8, color: "#38c8ff", hit: { w: 25, h: 6 }, sure: true });
  def(3005, { name: "spider pad", kind: "pad", act: "spider", color: "#c050ff", hit: { w: 25, h: 6 }, sure: true });

  // speed portals (touch): 0.5x 1x 2x 3x 4x
  const SP = { w: 34, h: 44 };
  def(200, { name: "0.5x speed", kind: "speed", speed: 0, color: "#ffb020", hit: SP, sure: false });
  def(201, { name: "1x speed", kind: "speed", speed: 1, color: "#30c0ff", hit: SP, sure: false });
  def(202, { name: "2x speed", kind: "speed", speed: 2, color: "#40ff60", hit: SP, sure: false });
  def(203, { name: "3x speed", kind: "speed", speed: 3, color: "#ff5ad2", hit: SP, sure: false });
  def(1334, { name: "4x speed", kind: "speed", speed: 4, color: "#ff3030", hit: SP, sure: false });

  // gravity portals (touch). Flipping halves vertical speed.
  const GP = { w: 25, h: 75 };
  def(10, { name: "gravity portal (normal)", kind: "gravity", grav: 1, color: "#38c8ff", hit: GP, sure: true });
  def(11, { name: "gravity portal (upside down)", kind: "gravity", grav: -1, color: "#ffe000", hit: GP, sure: true });
  def(2926, { name: "gravity portal (toggle)", kind: "gravity", grav: 0, color: "#40ff60", hit: GP, sure: false });

  // game mode portals. Only cube and ship are simulated; the others stop the run with a note.
  const MP = { w: 34, h: 86 };
  def(12, { name: "cube portal", kind: "mode", mode: "cube", color: "#40ff60", hit: MP, sure: true });
  def(13, { name: "ship portal", kind: "mode", mode: "ship", color: "#ff5ad2", hit: MP, sure: false });
  def(47, { name: "ball portal", kind: "mode", mode: "ball", color: "#ff3030", hit: MP, sure: false });
  def(111, { name: "ufo portal", kind: "mode", mode: "ufo", color: "#ffb020", hit: MP, sure: false });
  def(660, { name: "wave portal", kind: "mode", mode: "wave", color: "#38c8ff", hit: MP, sure: false });
  def(745, { name: "robot portal", kind: "mode", mode: "robot", color: "#e8e4ff", hit: MP, sure: false });
  def(1331, { name: "spider portal", kind: "mode", mode: "spider", color: "#c050ff", hit: MP, sure: false });
  def(1933, { name: "swing portal", kind: "mode", mode: "swing", color: "#ffe000", hit: MP, sure: false });

  // things with hitboxes that are NOT hazards, so the extra table's "anything else is a hazard"
  // rule must not catch them. Not simulated yet: they either do nothing here or stop the run.
  def([45, 46], { name: "mirror portal", kind: "special", color: "#ffb020", sure: true });       // screen flip only
  def([99, 101], { name: "size portal", kind: "unsupported", what: "mini size", color: "#ff5ad2", sure: true });
  def([286, 287], { name: "dual portal", kind: "unsupported", what: "dual mode", color: "#ffb020", sure: true });
  def([747, 749], { name: "teleport portal", kind: "unsupported", what: "teleport portals", color: "#38c8ff", sure: false });
  def(1594, { name: "toggle orb", kind: "special", color: "#e8e4ff", sure: false });
  // 1327 / 1328 are NOT coins: OpenGD has them as 8x8 / 8x15 hazards and the official levels place
  // them small, scaled and off-grid, often with No Touch (style session, 2026-11-22). sure:false.
  def([1327, 1328], { name: "small hazard", kind: "hazard", shape: "box", hit: { w: 8, h: 8 }, sure: false });
  T[1328].hit = { w: 8, h: 15 };
  def([142, 1329, 1275, 1584, 1614], { name: "coin / key", kind: "special", color: "#ffe000", sure: false });

  // Our own entries first; then the extra table (GD 2.1 object data): solid / hazard with its
  // hitbox (saws are circles), trigger. Ids in neither have no hitbox: decoration.
  function info(id) {
    if (T[id]) return T[id];
    // GD 2.2's own list of decoration ids beats the 2.1-era table (lib/objects_gd22.js)
    if (DECO.some(r => id >= r[0] && id <= r[1])) return T[id] = { id, name: "decoration " + id, kind: "decoration", sure: true };
    const e = X[id];
    if (!e) return { id, name: "decoration " + id, kind: "decoration", sure: true };
    if (e[0] === "trigger") return T[id] = { id, name: "trigger " + id, kind: "trigger", sure: true };
    const d = { id, name: (e[0] === "solid" ? "block " : e[5] ? "saw " : "hazard ") + id, kind: e[0], sure: true, extra: true };
    if (e[5]) { d.r = e[5]; d.hit = { w: 2 * e[5], h: 2 * e[5] }; d.shape = "saw"; }
    else d.hit = { w: e[1], h: e[2], ox: e[3], oy: e[4] };
    if (e[0] === "hazard" && !e[5]) d.shape = "box";
    return T[id] = d;
  }

  function quarter(o) { return ((Math.round((o.rot || 0) / 90) % 4) + 4) % 4; } // clockwise quarter turns

  // World-space hitbox of an object (rotation snapped to 90 degrees, which is what levels use).
  function hitbox(o) {
    const d = info(o.id);
    if (!d.hit) return null;
    let w = d.hit.w, h = d.hit.h, ox = d.hit.ox || 0, oy = d.hit.oy || 0;
    if (o.flipX) ox = -ox;
    if (o.flipY) oy = -oy;
    const q = quarter(o);
    for (let i = 0; i < q; i++) { const t = ox; ox = oy; oy = -t; const s = w; w = h; h = s; }
    return { x0: o.x + ox - w / 2, x1: o.x + ox + w / 2, y0: o.y + oy - h / 2, y1: o.y + oy + h / 2 };
  }

  Object.assign(GD, { OBJECTS: T, objInfo: info, hitbox, quarter });
})(typeof module !== "undefined" ? module.exports : (window.GD = window.GD || {}));
