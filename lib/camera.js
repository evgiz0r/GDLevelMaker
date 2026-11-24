// The viewer's vertical camera, one copy for the viewer and the tools that check it against the game (tools/camfit.js,
// VISUALS.md "Camera"). Units are level units (a block = 30); cam = the level y at the ground line's screen row (the
// viewer's camY); the window's bottom edge is cam - below.
//   want(s, {look, viewH, below}) -> the camera the player's state s asks for; viewH = the view's height in units
//     (game look at 16:9: 10.67 blocks), below = units shown under the ground line (3.1 blocks; schematic 1.6)
//   ease(cam, want, dt, s?, look?) -> the camera after dt seconds of easing toward want
// Measured on the user's GDLM 68 camera-lab run (recording 2026-11-24_19-47-52, attempt at 22.1 s, 2399 frames; tools/camfit.js):
// - flying modes (ship, UFO, wave, ...): GD centres the camera on the portal's band and HOLDS it there -- the band's floor and
//   ceiling bars sit at the window's edges, the camera does not follow the player inside the band (was: followed within
//   40 units). Moving to a new band eases at ~4/s.
// - cube and the other ground modes: the camera follows the player, keeping it 205 units (6.8 blocks) above the window's
//   bottom, never below the ground's rest view; it eases up at 3/s and down at 10/s. Mean error 0.47 -> 0.27 blocks over
//   1800 cube frames (the old rule: 0.38 x (height - 2 blocks), fitted on 19 Hexagon Force frames).
(function (root) {
  const VIEW_H = 30 * 10.67, BELOW = 30 * 3.1;
  const FOLLOW = 205, GROUND_BELOW = 90, UP = 3, DOWN = 10, BAND_RATE = 4, OLD = 9.75;
  function flying(s) { return isFinite(s.ceilY) && s.mode !== "cube"; }
  function want(s, o = {}) {
    const vh = o.viewH || VIEW_H, below = o.below != null ? o.below : BELOW, look = o.look !== false;
    if (flying(s)) {
      const off = vh / 2 - below, mid = (s.floorY + s.ceilY) / 2 - off;
      if (look) return mid;
      // schematic view: keep the player in view inside its corridor (the corridor can be taller than the view)
      const above = vh - below, lo = s.floorY - 30 + below, hi = s.ceilY + 30 - above;
      return s.ceilY - s.floorY + 60 <= vh || lo > hi ? mid : Math.max(lo, Math.min(hi, s.y - off));
    }
    // game look: the window's bottom at the player's y - 205, never below the ground's rest view (3 blocks under the ground)
    if (look) return Math.max(0, s.y - FOLLOW + GROUND_BELOW);
    return Math.max(0, s.y - 30 * 4.5);
  }
  function ease(cam, w, dt, s, look) {
    const rate = look === false || !s ? OLD : flying(s) ? BAND_RATE : w > cam ? UP : DOWN;
    return cam + (w - cam) * (1 - Math.exp(-rate * Math.max(0, dt)));
  }
  const CAM = { want, ease, VIEW_H, BELOW, FOLLOW, UP, DOWN, BAND_RATE };
  if (typeof module !== "undefined") module.exports = CAM; else root.CAM = CAM;
})(typeof window !== "undefined" ? (window.GD = window.GD || {}) : {});
