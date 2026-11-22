// Object IDs -> what they are, how to draw them, how they collide.
// One grid square is 30 units. x,y in a level are the object's CENTRE; ground top is y=0,
// so a block sitting on the ground is at y=15.
//
// sure:false = named from memory, not yet confirmed in the game. Confirm by placing the object
// in the editor (or reading a level that has it) and flip it to true here.
// hit = hitbox {w,h,ox,oy} around the centre, before the object's rotation.
(function (GD) {
  "use strict";
  const T = {};
  function def(ids, d) { for (const id of [].concat(ids)) T[id] = Object.assign({ id }, d); }

  // solid blocks (the editor's many block skins share one behaviour)
  def(1, { name: "block", kind: "solid", hit: { w: 30, h: 30 }, sure: true });
  def([2, 3, 4, 5, 6, 7, 83, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 80, 81, 82, 90, 91, 92, 93, 94, 95, 96],
      { name: "block (skin)", kind: "solid", hit: { w: 30, h: 30 }, sure: false });
  def(40, { name: "slab", kind: "solid", hit: { w: 30, h: 14, oy: 8 }, sure: false });

  // hazards: GD's spike hitbox is much smaller than its picture
  def(8, { name: "spike", kind: "hazard", shape: "spike", hit: { w: 6, h: 12 }, sure: true });
  def(39, { name: "small spike", kind: "hazard", shape: "smallspike", hit: { w: 6, h: 5.6, oy: -4 }, sure: false });
  def(103, { name: "medium spike", kind: "hazard", shape: "midspike", hit: { w: 4, h: 7.6, oy: -2 }, sure: false });

  // orbs (click while touching) and pads (touch). Not simulated yet: drawn only.
  def(36, { name: "yellow orb", kind: "orb", color: "#ffe000", r: 18, sure: true });
  def(141, { name: "pink orb", kind: "orb", color: "#ff5ad2", r: 18, sure: false });
  def(84, { name: "blue orb", kind: "orb", color: "#38c8ff", r: 18, sure: true });
  def(1022, { name: "green orb", kind: "orb", color: "#40ff60", r: 18, sure: false });
  def(1330, { name: "black orb", kind: "orb", color: "#555", r: 18, sure: false });
  def(1333, { name: "red orb", kind: "orb", color: "#ff3030", r: 18, sure: false });
  def(1704, { name: "green dash orb", kind: "orb", color: "#40ff60", r: 18, dash: true, sure: false });
  def(1751, { name: "pink dash orb", kind: "orb", color: "#ff5ad2", r: 18, dash: true, sure: false });
  def(3004, { name: "spider orb", kind: "orb", color: "#c050ff", r: 18, sure: false });
  def(35, { name: "yellow pad", kind: "pad", color: "#ffe000", sure: false });
  def(140, { name: "pink pad", kind: "pad", color: "#ff5ad2", sure: false });
  def(67, { name: "blue pad", kind: "pad", color: "#38c8ff", sure: true });
  def(1332, { name: "red pad", kind: "pad", color: "#ff3030", sure: false });
  def(3005, { name: "spider pad", kind: "pad", color: "#c050ff", sure: false });

  function info(id) { return T[id] || { id, name: "object " + id, kind: "unknown", sure: false }; }

  // World-space hitbox of an object (rotation snapped to 90 degrees, which is what levels use).
  function hitbox(o) {
    const d = info(o.id);
    if (!d.hit) return null;
    let w = d.hit.w, h = d.hit.h, ox = d.hit.ox || 0, oy = d.hit.oy || 0;
    if (o.flipX) ox = -ox;
    if (o.flipY) oy = -oy;
    const q = ((Math.round((o.rot || 0) / 90) % 4) + 4) % 4; // clockwise quarter turns
    for (let i = 0; i < q; i++) { const t = ox; ox = oy; oy = -t; const s = w; w = h; h = s; }
    return { x0: o.x + ox - w / 2, x1: o.x + ox + w / 2, y0: o.y + oy - h / 2, y1: o.y + oy + h / 2 };
  }

  Object.assign(GD, { OBJECTS: T, objInfo: info, hitbox });
})(typeof module !== "undefined" ? module.exports : (window.GD = window.GD || {}));
