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
  const T = {};
  function def(ids, d) { for (const id of [].concat(ids)) T[id] = Object.assign({ id }, d); }

  // solid blocks (the editor's many block skins share one behaviour)
  def(1, { name: "block", kind: "solid", hit: { w: 30, h: 30 }, sure: true });
  def([2, 3, 4, 5, 6, 7, 83, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 80, 81, 82, 90, 91, 92, 93, 94, 95, 96],
      { name: "block (skin)", kind: "solid", hit: { w: 30, h: 30 }, sure: false });
  def(40, { name: "slab", kind: "solid", hit: { w: 30, h: 14, oy: 8 }, sure: false });
  def(468, { name: "thin line", kind: "solid", hit: { w: 30, h: 1.5 }, sure: false });
  // 45-degree slope, one square, rising to the right before rotation/flip
  def(1338, { name: "slope 45", kind: "slope", hit: { w: 30, h: 30 }, rise: 1, sure: true });
  def(1339, { name: "slope 22", kind: "slope", hit: { w: 60, h: 30 }, rise: 0.5, sure: false });

  // hazards: GD's hitbox is 0.2 x sprite width, 0.4 x sprite height (boxes, not triangles)
  def(8, { name: "spike", kind: "hazard", shape: "spike", hit: { w: 6, h: 12 }, sure: true });
  def(39, { name: "small spike", kind: "hazard", shape: "smallspike", hit: { w: 6, h: 5.6, oy: -4 }, sure: false });
  def(103, { name: "medium spike", kind: "hazard", shape: "midspike", hit: { w: 4, h: 7.6, oy: -2 }, sure: false });

  // orbs: 36x36 square activation box. Cube velocities in GD units per 1/60 s "frame",
  // as multiples of the speed's jump velocity (yStart).
  const ORB = { w: 36, h: 36 };
  def(36, { name: "yellow orb", kind: "orb", act: "jump", mul: 1, color: "#ffe000", hit: ORB, sure: true });
  def(141, { name: "pink orb", kind: "orb", act: "jump", mul: 0.72, color: "#ff5ad2", hit: ORB, sure: false });
  def(1333, { name: "red orb", kind: "orb", act: "jump", mul: 1.38, color: "#ff3030", hit: ORB, sure: true });
  def(84, { name: "blue orb", kind: "orb", act: "blue", mul: 0.8, color: "#38c8ff", hit: ORB, sure: true });
  def(1022, { name: "green orb", kind: "orb", act: "green", mul: 1, color: "#40ff60", hit: ORB, sure: false });
  def(1330, { name: "black orb", kind: "orb", act: "black", color: "#555", hit: ORB, sure: false });
  def(1704, { name: "green dash orb", kind: "orb", act: "dash", color: "#40ff60", hit: ORB, sure: true });
  def(1751, { name: "pink dash orb", kind: "orb", act: "dash", flip: true, color: "#ff5ad2", hit: ORB, sure: false });
  def(3004, { name: "spider orb", kind: "orb", act: "spider", color: "#c050ff", hit: ORB, sure: true });

  // pads: touch to fire. Velocity = bump x 16 (per frame).
  def(35, { name: "yellow pad", kind: "pad", act: "jump", bump: 1, color: "#ffe000", hit: { w: 25, h: 4 }, sure: false });
  def(140, { name: "pink pad", kind: "pad", act: "jump", bump: 0.65, color: "#ff5ad2", hit: { w: 25, h: 5 }, sure: false });
  def(1332, { name: "red pad", kind: "pad", act: "jump", bump: 1.25, color: "#ff3030", hit: { w: 29, h: 7 }, sure: true });
  def(67, { name: "blue pad", kind: "pad", act: "blue", bump: 0.8, color: "#38c8ff", hit: { w: 25, h: 6 }, sure: true });
  def(3005, { name: "spider pad", kind: "pad", act: "spider", color: "#c050ff", hit: { w: 25, h: 6 }, sure: true });

  // speed portals (touch): 0.5x 1x 2x 3x 4x
  const SP = { w: 34, h: 44 };
  def(200, { name: "0.5x speed", kind: "speed", speed: 0, color: "#ffb020", hit: SP, sure: false });
  def(201, { name: "1x speed", kind: "speed", speed: 1, color: "#30c0ff", hit: SP, sure: false });
  def(202, { name: "2x speed", kind: "speed", speed: 2, color: "#40ff60", hit: SP, sure: false });
  def(203, { name: "3x speed", kind: "speed", speed: 3, color: "#ff5ad2", hit: SP, sure: false });
  def(1334, { name: "4x speed", kind: "speed", speed: 4, color: "#ff3030", hit: SP, sure: false });

  function info(id) { return T[id] || { id, name: "object " + id, kind: "unknown", sure: false }; }

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
