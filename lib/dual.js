// Dual mode: two players, one button. Used by lib/physics.js's step() whenever a level has dual
// portals (286 on, 287 off); a level without them never comes here.
//
// What GD 2.2 does (iArtie/GD-2.2081-Decompiled, GJBaseGameLayer: toggleDualMode, playerWillSwitchMode,
// flipGravity, the DualPortal / SoloPortal cases of collisionCheckObjects; PlayerObject::copyAttributes):
// - the dual portal spawns player 2 as a copy of player 1 (position, mode, size, speed, y speed) with
//   gravity flipped (spawnFromPlayer -> flipGravity, which halves y speed);
// - both players get the same input and the same x; triggers fire once; either one dying is a death;
// - mode and size portals switch ONLY the player that touches them (switchToFlyMode(player, ...));
//   a player switching into the mode the other one is in gets the other's gravity flipped
//   (playerWillSwitchMode: ship, cube, ball, UFO, robot, spider, swing -- the decompile lists no wave
//   case; UNCHECKED whether that is real or a decompiler gap);
// - a gravity flip from a portal, a blue or green orb, a gravity dash orb or a blue pad goes through
//   GJBaseGameLayer::flipGravity: while both players are in the same mode the other one is flipped the
//   opposite way, so they stay mirrored. Ball taps, swing flips and spider teleports flip only their own
//   player (PlayerObject::flipGravity);
// - the solo portal ends dual; the player that touched it is the one that goes on (player 1 copies
//   player 2's attributes when player 2 touched it);
// - in dual every mode has a floor and a roof (checkCollisions treats dual like a flying mode). Its height
//   (updateDualGround) is not in the decompile: the larger of the two players' mode bands, cube and robot
//   300 like the ship. MEASURED for the cube: the user's GDLM 63 run (2026-11-24_02-13-32.mkv, 88.0 s) shows
//   9.9 blocks floor to roof (+-2%); ball/spider/mixed-mode heights are still the assumption. Its centre is the DUAL PORTAL for the whole dual part: processCameraObject
//   hands GD's ground code the dual portal (m_lastActivatedPortal2) instead of a mode portal touched in dual.
//   (Re-centring on one player's ship portal opened a gap above Hexagon Force's corridor: the solve flew over
//   its spike ceiling at block 432 and died at 499.)
// Player 1's fields stay at the top of the state (so every tool that reads s.y still works); player 2's
// own fields live in s.p2, a fresh object every tick (states share it safely, as clone() is shallow).
(function (GD) {
  "use strict";
  // fields both players share: one x, one clock, one set of triggers, one run
  const SHARED = ["tick", "x", "sp", "fired", "tp", "off", "offDone", "stopped", "lockAt", "nfire", "pend", "tgt", "paused", "psum", "fol", "dead", "done", "why", "killer", "dualBand", "dualY", "p2"];
  const isShared = {}; for (const k of SHARED) isShared[k] = 1;
  const own = s => { const o = {}; for (const k in s) if (!isShared[k]) o[k] = s[k]; o.used = (s.used || []).slice(); return o; };
  // a player switching into the other's mode takes the opposite gravity (no wave case in the decompile)
  const MIRROR_MODES = { ship: 1, cube: 1, ball: 1, ufo: 1, robot: 1, spider: 1, swing: 1 };
  const bandOf = (api, m) => api.BAND[m] || 300;

  function setBand(api, s, y) {
    const H = Math.max(bandOf(api, s.mode), s.p2 ? bandOf(api, s.p2.mode) : 0);
    const f = Math.max(0, Math.floor((y - H / 2) / 30) * 30);
    s.floorY = f; s.ceilY = f + H;
    if (s.p2) { s.p2.floorY = f; s.p2.ceilY = f + H; }
  }

  // what the player that just stepped (a) does to the other one (b)
  function cross(api, a, b) {
    if (a.lflip && b.mode === a.mode && b.grav === a.grav) api.flip(b);
    if (a.modeIn && MIRROR_MODES[a.mode] && b.mode === a.mode && b.grav === a.grav) api.flip(a);
  }

  function dualStep(w, s, inp, stepOne, api) {
    if (s.dead || s.done) return s;
    const x0 = s.x, t0 = s.tick, p2 = s.p2;
    s.p2 = null; s.lflip = s.modeIn = false; s.dualReq = 0;
    stepOne(w, s, inp);
    let q = null;
    if (p2) {
      q = own(p2);
      for (const k of SHARED) q[k] = s[k];
      q.x = x0; q.tick = t0; q.dead = false; q.done = false; q.why = ""; q.killer = null;
      q.lflip = q.modeIn = false; q.dualReq = 0;
      cross(api, s, q);
      stepOne(w, q, inp);
      for (const k of ["sp", "fired", "tp", "off", "offDone", "stopped", "lockAt", "nfire", "pend", "tgt", "paused", "psum", "fol"]) s[k] = q[k];
      if (q.dead && !s.dead) { s.dead = true; s.why = "player 2: " + q.why; s.killer = q.killer; }
      if (q.done) s.done = s.done || !s.dead;
      cross(api, q, s);
    }
    // dual portals touched this tick
    if (!p2 && s.dualReq === 1) {
      const c = own(s);
      api.flip(c);
      s.p2 = c; s.dualBand = true; s.dualY = s.portalY; setBand(api, s, s.dualY);
      return s;
    }
    if (p2 && (s.dualReq === -1 || (q && q.dualReq === -1))) {
      const by2 = !(s.dualReq === -1);
      if (by2) { const keep = own(q); for (const k in keep) s[k] = keep[k]; }
      s.p2 = null; s.dualBand = false; s.dualY = undefined;
      const by = by2 ? q : s;
      if (api.BAND[s.mode]) { const H = api.BAND[s.mode]; s.floorY = Math.max(0, Math.floor((by.portalY - H / 2) / 30) * 30); s.ceilY = s.floorY + H; }
      return s;
    }
    if (q) {
      s.p2 = own(q);
      // a mode portal in dual changes the band's height (its mode), centred on the dual portal still
      if (q.modeIn || s.modeIn) setBand(api, s, s.dualY);
    }
    return s;
  }

  // player 2's part of a solver's state key
  function dualKey(p) {
    return p ? [Math.round(p.y), Math.round(p.vy * 2), p.grav, p.mode, p.mini ? 1 : 0, p.grounded ? 1 : 0, p.ring ? 1 : 0, p.dashing ? 1 : 0, p.swingPend ? 1 : 0, p.lb > 0 ? p.lb : 0].join(",") : "";   // lb: the landing buffer (physics fee98db)
  }

  Object.assign(GD, { dualStep, dualKey });
})(typeof module !== "undefined" ? module.exports : (window.GD = window.GD || {}));
