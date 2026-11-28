// node tools/sectiongen.js show <key> [--cols 40] [--rows R] [--seed 1] [--tier easy|normal|hard|harder] [--bpm B]
// node tools/sectiongen.js check [key ...] [--cols 30,60,120] [--seeds 1,2] [--tiers easy,hard] [--bpm B] [--show]
//                                                         -- does every generated section solve (tools/layoutcheck.js),
//                                                            and does its difficulty follow the tier asked for
//
// SECTION TYPES AS GENERATORS (Evgeni, 2026-11-27: "each section we are adding is not just a collection of possible this
// specific layout strcutures, its a complete possible section of any length, adjustable. with a 'clearer' concept";
// "the template is not building one or two blocks right and left, but lets have a more abstrct concept that might create
// it in various difficulty and length"; "use one of such possible sections, as a template ( not copy this exactly ), and
// create somewhat approriate layout for the specific beat and difficulty needed"; "i need also reverse gravity portals").
// So nothing here starts from his drawing (knowledge/layout_sections.json): each type is its CONCEPT in code -- the idea,
// the motif, and the parameters the motif may change (knowledge/section_types.md, the table) -- built fresh:
//   entry -> body: the motif repeated, its parameters changed each repeat -> exit.
// Knobs, the same for every type:
//   cols, rows   any length; rows = the band height (each type has its own default)
//   seed         another layout of the same concept
//   tier         easy | normal | hard | harder (or 0..1): one number d that moves every parameter of the type toward
//                its hard end (shorter runs, narrower gaps, more hazards, faster motifs)
//   bpm / beatCols  motif lengths snap to half beats (columns per beat at 1x = 311.58 / 30 * 60 / bpm), so each motif --
//                and the press it asks for -- falls on the song's beat grid (loosely: the press inside a motif is not
//                placed on its beat yet)
// GEN[key](opts) -> { map: rows top first in the board's letters, mode }. Letters (tools/layoutsections.js):
//   # block, / \ floor slopes, 7 r ceiling slopes, ^ spike, v hanging spike, o saw, q / s small saws, G gravity upside
//   down (id 11), N gravity back (id 10). The board (tools/designs_tab.js, the board thread) calls these for its length
//   control; tools/layoutcheck.js solves whatever they return.
"use strict";
const LS = require("./layoutsections.js");

function rng(seed) { let s = ((seed >>> 0) * 2654435761) >>> 0 || 1; const f = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  f.int = (a, b) => a + Math.floor(f() * (b - a + 1)); f.pick = a => a[Math.floor(f() * a.length)]; f.chance = p => f() < p; return f; }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// extreme (Evgeni 2026-11-27: "lets increase the cps of harder ... or add 1 more level"; and "the wave seems a bit too hard
// for harder, too tight"): past harder only the pace grows (shorter runs, more presses a second); room -- corridor gaps,
// platform sizes -- stops at harder's, through room() below
const TIERS = { easy: 0, normal: 0.35, hard: 0.7, harder: 1, extreme: 1.4 };
const COLS_PER_SEC = 311.58 / 30;

// the shared context every generator gets: the random, d (0 easy .. 1 harder), mix(easy, hard) -> the value at this tier,
// len(lo, hi) -> a motif length snapped to half beats when a tempo is given, chance(easyP, hardP)
function ctx(o, defRows) {
  const R = rng(o.seed ?? 1), d = typeof o.tier === "number" ? clamp(o.tier, 0, 1.4) : (TIERS[o.tier] ?? 0.2);
  const beatCols = o.beatCols || (o.bpm ? COLS_PER_SEC * 60 / o.bpm : 0);
  const mix = (a, b) => a + (b - a) * d, imix = (a, b) => Math.round(mix(a, b)), room = (a, b) => Math.round(a + (b - a) * Math.min(1, d));
  const len = (lo, hi) => { let n = R.int(Math.min(lo, hi), Math.max(lo, hi)); if (beatCols) { const h = beatCols / 2; n = Math.max(2, Math.round(Math.round(n / h) * h)); } return n; };
  const W = o.cols || 32, H = o.rows || defRows;
  // THE GENERATION'S CLICK STYLE (Evgeni 2026-11-27: "the click pattern/holds/cps differs between generations. not
  // consistent across the whole section, some have bit more cps, some have bit less. some hold more some hold less"):
  // each generation draws its own density and hold length, and inside the section they only drift a little (a slow
  // wave, +-~10% over 25-45 columns), never jumping around. Drawn from its own stream, so R's draws stay as they were.
  // pace(c): press density at column c (x1 = the tier's own); hold(c): hold length factor. Press planners divide their
  // gaps by pace(c) and multiply holds by hold(c).
  const Rs = rng(((o.seed ?? 1) * 7919 + 13) >>> 0), dens = 0.82 + Rs() * 0.4, holdF = 0.7 + Rs() * 0.7;
  const amp = 0.06 + Rs() * 0.06, per = 25 + Rs() * 20, ph = Rs() * 6.283, drift = c => 1 + amp * Math.sin(6.283 * c / per + ph);
  const style = { dens: +dens.toFixed(2), hold: +holdF.toFixed(2), pace: c => dens * drift(c), holdAt: c => holdF * drift(c + per / 3) };
  // BEATS (Evgeni 2026-11-27: "i want to be able to generate according to a beat as well, so its not just random stats,
  // should be applicable in a level ... in the long run much more efficient than solving"): o.beats = the song's beats in
  // the section (seconds from its start: numbers, or {t, s} with s = strength 0..1, e.g. from tools/hits.js or
  // tools/impacts.js), or o.bpm / o.beatCols = a plain grid of half beats (a bar's first beat 1, the other beats 0.7, the
  // half beats 0.35). onBeat(want, min): the column for a press the style wants near `want`, no sooner than `min`: the
  // nearest beat, a strong one counted up to half a beat nearer; no beats -> want. The style's density decides how far
  // apart the wants are, so it decides the share of beats taken; holds end on beats too.
  let beats = null;
  if (Array.isArray(o.beats) && o.beats.length) beats = o.beats.map(b => typeof b === "number" ? { c: b * COLS_PER_SEC, s: 0.7 } : { c: b.t * COLS_PER_SEC, s: b.s ?? 0.7 });
  else if (beatCols) { beats = []; for (let i = 0; i * beatCols / 2 < W + beatCols; i++) beats.push({ c: i * beatCols / 2, s: i % 8 === 0 ? 1 : i % 2 === 0 ? 0.7 : 0.35 }); }
  if (beats) beats.sort((a, b) => a.c - b.c);
  // hb: the strength bonus's reach, at least 2 columns (~0.2 s): a song's notes can come ~10 a second, and with the mean
  // spacing as the reach the nearest weak note always won; now a strong one up to a column nearer wins
  const hb = Math.max(2, beats && beats.length > 1 ? (beats[beats.length - 1].c - beats[0].c) / (beats.length - 1) : 2);
  const onBeat = (want, min = -1e9) => { if (!beats) return Math.max(want, min);
    let best = null, bs = 1e9; for (const b of beats) { if (b.c < min - 1e-6) continue; if (b.c > want + 3 * hb) break;
      const sc = Math.abs(b.c - want) - b.s * hb * 0.5; if (sc < bs) { bs = sc; best = b.c; } }
    return best == null ? Math.max(want, min) : best; };
  // THE ENTRY HEIGHT (Evgeni 2026-11-28: "lets make the initial spot in the generation random, so that the entrance is not
  // always at the same place. could be at any height (for the non starting cube)"): entry(lo, hi) = the row the player
  // comes in at, drawn evenly in [lo, hi] from its own stream (R's draws stay as they were); o.entry sets it. Every type
  // but the entrance starts from it; the section's first column has its floor run up from the ground to there, so the
  // join before it (lib/scenejoin.js) ramps to it.
  const Re = rng(((o.seed ?? 1) * 104729 + 7) >>> 0), entry = (lo, hi) => o.entry != null ? clamp(Math.round(o.entry), lo, Math.max(lo, hi)) : lo + Math.floor(Re() * (Math.max(lo, hi) - lo + 1));
  return { R, d, mix, imix, room, len, chance: (a, b) => R.chance(Math.min(0.95, mix(a, b))), W, H, G: LS.grid(W, H), beatCols, style, onBeat, beats, entry };
}
// a gravity pair (G upside down, N back) in sections long enough to show it: G at ~1/3, N at ~2/3
const gravPair = (W, min = 24) => W >= min ? [Math.round(W * 0.3), Math.round(W * 0.7)] : null;
// a tunnel from one floor line e(x) (heights at column edges, steps of 0 or 1 a column), its ceiling the floor lifted
// `gap` rows; `thick` = wall thickness (0 = solid to the band's edge)
function tunnel(G, W, e, gap, top, thick = 0) {
  for (let c = 0; c < W; c++) { const a = e(c), b = e(c + 1), lo = Math.min(a, b), hi = Math.max(a, b);
    if (lo > 0) G.box(c, c, thick ? Math.max(0, lo - thick) : 0, lo - 1); if (b > a) G.put(c, a, "/"); if (b < a) G.put(c, b, "\\");
    G.box(c, c, hi + gap, thick ? Math.min(top, hi + gap + thick - 1) : top); if (b > a) G.put(c, a + gap, "r"); if (b < a) G.put(c, b + gap, "7"); } }
// a line of heights at column edges, built by a step(api, x) that adds runs (flat) and 45-degree legs -> e(x)
function line(W, h0, step) { const e = [h0]; let h = h0;
  const api = { h: () => h, run: n => { for (let k = 0; k < n; k++) e.push(h); }, leg: to => { while (h !== to) { h += Math.sign(to - h); e.push(h); } } };
  while (e.length <= W + 1) { const n = e.length; step(api, n); if (e.length === n) e.push(h); }
  return x => e[Math.min(Math.max(0, x), e.length - 1)]; }

// a height wander (Evgeni 2026-11-27: "can we try 100% spread or close in all generations if possible", then, on the ship
// corridor: "trying to spread in a too forced way. making the gameplay really long to create those patterns ... we should
// start from the middle, if we want to have chances to cover more ground. it doesnt have to be good every generation"):
// the path starts in the middle; each next target is a move of 2 to ~half the room either way (toward the far side more
// often), and only now and then (15%) the very edge. Coverage comes by chance, not by forced climbs.
const tour = (R, lo, hi) => h => { const m = (lo + hi) / 2, span = hi - lo;
  if (R.chance(0.15)) return h < m ? hi : lo;
  const dir = R.chance(h < m ? 0.7 : 0.3) ? 1 : -1, n = R.int(2, Math.max(2, Math.round(span / 2)));
  return clamp(h + dir * n, lo, hi); };
// CLIMB TARGETS for the band-bound jumping modes (ball, ball portals, spider) in maps taller than their band (Evgeni
// 2026-11-27: "make the height of the ball/spider ( or others with the same ) to be able and have increased height"). A
// hidden same-mode portal re-bands around the player (physics: the band is centred on the portal, so it can't be put
// anywhere else), and the floor / ceiling flips alternate up and down, so the band only random-walked: 5-9 of 20 rows
// used. Now the band has a target (drawn as tour() does: from the middle, moves of 2 to half the map, the edge now and
// then -- by chance, not forced); while the band's centre is 2+ rows off it, flips toward it step 3-4 rows and flips away
// 2, and a band portal is put only when it moves the band toward it. A new target when it is reached. Its own random
// stream, and only in tall maps, so default-height layouts stay as they were. climber(...).drift(O) = -1, 0 or +1;
// .step(side, base, drift, minAway) = the row step of a flip to `side` (-1 = up to a ceiling, 1 = down to a floor).
function climber(seed, H, BT, tall) { if (!tall) return { drift: () => 0, step: (side, base) => base };
  const Rt = rng(((seed ?? 1) * 104729 + 71) >>> 0), lo = Math.floor(BT / 2), hi = H - 1 - BT + Math.floor(BT / 2), next = tour(Rt, lo, hi);
  let T = next(lo);
  return { drift: O => { const m = O + Math.floor(BT / 2); if (Math.abs(T - m) < 2) { T = next(m); if (Math.abs(T - m) < 2) return 0; } return Math.sign(T - m); },
    step: (side, base, dr, minAway = 2) => !dr ? base : (side < 0) === (dr > 0) ? Rt.int(3, 4) : minAway }; }
// BAND MOVERS for a flying corridor taller than the mode's 10-row band (Evgeni 2026-11-27: "even if i make height x2 some
// of the modes stay on their height like hardcoded"; "swing/ship/ufo portals in the middle of the gameplay recenter the
// screen. people put invisible ones to move further in the screens"): a hidden portal of the mode (`ch`: H ship, U ufo,
// A wave) at the corridor's middle each time that middle has moved 3 rows from the band's centre; physics re-bands on it
// (lib/physics.js: floor = the portal's y - 150, down to 30 units). Soft blocks beside it (Evgeni: "should be softly blocked
// along both sides ... if there is no room in the corridor no need to block"): a spike on the floor and one hanging from
// the ceiling in its column when the corridor is 6 rows or more. mid(x) = the corridor's middle row, lo(x) / hi(x) its
// floor row and ceiling row (hi = H: no ceiling there).
function bandMovers(G, W, H, ch, mid, lo, hi) { if (H <= 10) return;
  let bc = 5;
  for (let x = 3; x < W - 3; x++) { const m = mid(x); if (Math.abs(m - bc) < 3) continue;
    const r = Math.round(m); G.put(x, r, ch); bc = Math.max(0, Math.floor((r * 30 + 15 - 150) / 30)) + 5;
    if (hi(x) - lo(x) >= 6) { G.put(x, lo(x), "^"); if (hi(x) < H) G.put(x, hi(x) - 1, "v"); } } }
// the join nearest c0 where one movement of the path ends and the next starts (the line changes direction, or a slope
// meets a flat); with `minLeg`, only joins between two movements at least that long ("exactly at the connecting point of
// longer sweeps", Evgeni 2026-11-27 on fly portals). A portal goes there, at the corridor's middle height.
function joinNear(e, W, c0, minLeg = 1) {
  const dir = c => Math.sign(e(c + 1) - e(c)), legLen = (c, step) => { let n = 0; const d = dir(step > 0 ? c : c - 1);
    for (let x = c; x > 0 && x < W - 1 && dir(step > 0 ? x : x - 1) === d && n < 40; x += step) n++; return n; };
  const isJoin = c => c > 2 && c < W - 3 && dir(c - 1) !== dir(c) && legLen(c, -1) >= minLeg && legLen(c, 1) >= minLeg;
  for (let d = 0; d < W; d++) for (const c of [c0 + d, c0 - d]) if (isJoin(c)) return c;
  return minLeg > 1 ? joinNear(e, W, c0, 1) : c0; }

const GEN = {}, CONCEPT = {};

// ENTRANCE (cube). Idea: up a ramp onto the level's blocks, then a first hazard. Motif: a flat run + one hazard (a spike,
// a pit, a step). Varies: run length, which hazard, the floor's height. Harder: shorter runs, wider pits, double spikes.
CONCEPT.entrance = "up a ramp onto blocks, then flat runs each with one hazard (spike, pit, step)";
// ENTRANCE, CLICKS FIRST (Evgeni 2026-11-28: "all generations should be somewhat based on clicks"): up the ramp, then the
// taps come first (0.3-0.55 s after the last landing by tier and the click style, on a beat when there is one, the first after the
// ramp's launch has settled), and each tap's obstacle is built from its arc: a spike (two at harder, now and then) under
// the arc's middle on a flat run, a pit as wide as the arc leaves room for, or a step up a row where it comes down. Every
// hop is run in the page's cube physics (cubeTry) and kept only with a window of `minWin` ticks each side; a run with no
// obstacle that fits stays flat (a rest). The shape-first entrance is entranceShape (o.shape).
function entrancePlan(o) { const { R, mix, chance, W, H, G, style, onBeat } = ctx(o, 7), T = Array(W + 12).fill(3), haz = [], taps = [], minWin = Math.round(mix(10, 4));
  for (let k = 0; k < 3; k++) { G.put(k, k, "/"); G.box(k + 1, k + 1, 0, k); T[k] = k; }
  let h = 3, land = 8, next = 9;
  while (true) { const want = next + mix(0.55, 0.3) * (0.85 + R() * 0.3) / style.pace(next) * COLS_PER_SEC, p = onBeat(want, land + 0.8);
    if (p > W - 9) break;
    const kinds = R.chance(0.08) ? ["rest"] : [R.pick(["spike", "spike", "pit", "step"]), "spike", "pit", "step"];
    let done = null;
    for (const kind of kinds) { if (kind === "rest") break;
      const T2 = T.slice(), haz2 = haz.slice(), h2 = kind === "step" ? Math.min(H - 3, h + 1) : h; if (h2 === h && kind === "step") continue;
      const arc = cubeArc(p * 30, h * 30, h2); if (!arc) continue; const L = arc.land;
      if (kind === "spike") { const mid = Math.floor((p + L) / 2 + 0.5), two = chance(0, 0.4) && L - p > 3.5;
        for (const c of two ? [mid - 1, mid] : [mid]) haz2.push(Object.assign(spikeBox(c, h), { c, r: h })); }
      else if (kind === "pit") { const a = Math.ceil(p + 0.7), b = Math.floor(L - 0.7); if (b < a) continue; for (let c = a; c <= b; c++) T2[c] = -9; }
      else { const s0 = Math.floor(L - 0.2); if (arc.up == null || arc.up + 0.55 > s0) continue; for (let c = s0; c < T2.length; c++) T2[c] = h2; }
      const r = cubeTry(T2, haz2, land, p, Math.min(W, L + 3)); if (!r.ok) continue;
      const w = cubeWin(T2, haz2, land, p, Math.min(W, L + 3), minWin); if (!w || w.e < minWin || w.l < minWin) continue;
      done = { T2, haz2, h2, land: r.land }; break; }
    if (done) { T.splice(0, T.length, ...done.T2); haz.splice(0, haz.length, ...done.haz2); h = done.h2; land = done.land; taps.push(+p.toFixed(4)); next = land; }
    else next = p + 2; }
  for (let c = 3; c < W; c++) if (T[c] > 0) G.box(c, c, 0, T[c] - 1); else if (T[c] === -9) G.put(c, 0, "^");
  for (const z of haz) G.put(z.c, z.r, "^");
  return { map: G.rows(), mode: "cube", presses: taps }; }
GEN.entrance = o => o.shape ? entranceShape(o) : entrancePlan(o);
function entranceShape(o) { const { R, imix, len, chance, W, H, G } = ctx(o, 7); let h = 3;
  for (let k = 0; k < 3; k++) { G.put(k, k, "/"); G.box(k + 1, k + 1, 0, k); }
  let c = 3;
  while (c < W) { const run = len(imix(8, 5), imix(10, 6)), end = Math.min(W - 1, c + run - 1); G.box(c, end, 0, h - 1);
    if (end - c >= 4 && c > 3) { const kind = R.pick(["spike", "pit", "step", "spike"]), x = c + 2;
      if (kind === "spike") { G.put(x, h, "^"); if (chance(0, 0.6)) G.put(x + 1, h, "^"); }
      else if (kind === "pit") { const pw = imix(2, 3); G.box(x, x + pw - 1, 0, h - 1, "."); G.box(x, x + pw - 1, 0, 0, "^"); }
      else { h = clamp(h + R.pick([-1, 1]), 2, H - 3); G.box(x, end, 0, h - 1); } }
    c = end + 1; }
  return { map: G.rows(), mode: "cube" }; };

// STAIRCASE (cube). Idea: climb, a landing, step down. Motif: a step of one row. Varies: step width, hazards on some
// landings, a saw at a step's edge (hard), climb height. Harder: narrower steps, more hazards, two rows a step sometimes.
// (the shape-first staircase it replaced is in git history before 2026-11-27's presses-first commit)

// OPEN CUBE (cube). Idea: a floor with pits, nothing overhead, platforms floating in the middle. Motif: a floor run + a
// spike pit. Varies: pit width, run length, a platform after the pit at one of two heights, a spike on it.
CONCEPT.opencube = "a floor with spike pits and open sky; platforms float at two heights";
const opencubeShape = o => { const { R, imix, len, chance, W, H, G } = ctx(o, 8);
  // the whole sky (Evgeni 2026-11-27: "100% spread or close in all generations"): the floor is one row (the cube runs at
  // row 1), and after some pits a climb of floating platforms 2 rows apart (a cube jump's comfortable height) up to the
  // top of the section, then the drop back to the floor
  G.box(0, W - 1, 0, 0); let c = len(5, 7), k = 0;
  while (c < W - 6) {
    if ((k++ % 2 === 1 || chance(0.2, 0.4)) && c + 14 < W) {   // a climb: 2-3 platforms, each 2 rows over the last, spikes under
      let px = c, py = 2; const n = Math.min(R.int(2, Math.max(3, Math.floor((H - 2) / 2))), Math.floor((H - 2) / 2)); let end = px;   // taller maps: longer climbs
      for (let q = 0; q < n && px + 4 < W - 4; q++) { const pl = R.int(imix(4, 3), 4); G.box(px, px + pl - 1, py, py);
        if (q === n - 1 && pl >= 4 && chance(0.2, 0.6)) G.put(px + 1, py + 1, "^"); end = px + pl; px += pl + R.int(0, 1); py += 2; }
      G.box(c + 1, end + 1, 0, 0, "^");   // the floor under the climb is spikes: the way is over the top
      c = end + 2 + len(imix(6, 4), imix(8, 5)); continue; }
    const pw = imix(2, 4); G.box(c, c + pw - 1, 0, 0, "^");
    if (chance(0.3, 0.7)) G.put(c + pw + 3, 1, "^");
    c += pw + len(imix(9, 5), imix(10, 7)); }
  return { map: G.rows(), mode: "cube" }; };

// ---------------------------------------------------------------------------------------------------------------------
// PRESSES FIRST (Evgeni 2026-11-27: "our generating solves by design and we just patch the timings and search secret ways
// with the solver?", "shape first is not great"). A type picks its clicks and their windows first (rhythm by tier and the
// beat), a small copy of the game's cube physics (the same numbers as lib/physics.js at 1x: no sim needed, so it runs in
// the page too) plays them, and the shape is built around that path: the surface a click leaves ends a little after it
// (the late edge of the window), the one it lands on starts a little before the landing (the early edge). The planned
// presses clear the piece by construction; the solver then only looks for secret ways. Returned as `presses` (columns).
const CUBE = { X: 5.77000189 * 0.9 * 0.25, DTS: 0.225, g: 0.958199024, J: 11.1800318 };
// a cube jump from (x, y) in units: the first column (in cols, fractional) where it comes down to row `r` (its bottom at
// r * 30), the column where it first rises past r (null if never), and its highest row
function cubeArc(x0, y0, r) { let x = x0, y = y0, vy = CUBE.J, up = null, n = 0, top = y0;
  while (n++ < 2000) { vy -= CUBE.g * CUBE.DTS; if (vy < -15) vy = -15; x += CUBE.X; y += vy * CUBE.DTS; top = Math.max(top, y);
    if (up == null && vy > 0 && y >= r * 30) up = x / 30; if (vy < 0 && y <= r * 30) return { land: x / 30, up, top: top / 30 }; }
  return null; }
// a cube walking off an edge at x0: the column where it falls to row r
function cubeFall(x0, y0, r) { let x = x0, y = y0, vy = 0, n = 0;
  while (n++ < 2000) { vy -= CUBE.g * CUBE.DTS; if (vy < -15) vy = -15; x += CUBE.X; y += vy * CUBE.DTS; if (y <= r * 30) return x / 30; } return null; }

// a cube run through a stretch, in the page's own physics: floor tops T[c] (rows; -9 = a pit), hazard boxes haz (units:
// {x0, x1, y0, y1}); walks from column c0, presses at column p (null = never), stops at column c1. -> {ok, land} (land:
// the column where it is back on a floor after the jump)
// GD 2.2's jump snap (lib/physics.js applySnap; 1x: max 1, near 90, far 150, side 120): each grounded tick the cube
// takes the block it stands on as its reference (several: the lowest 100-unit section, then the leftmost); landing on a
// new block that sits a stair step from the reference (90 on and 2 up, 120 on and 1 up, 150 on and 1 down) moves x by up
// to 1 unit so the cube keeps its offset from the block. A stair path of 1-wide blocks snaps on most hops, so over a long
// section the cube runs a few ticks ahead of its time (the real sim, 2026-11-27: 0.3 columns after 25 hops, a press then
// came before the landing). With `sn` ({ref, d, off}: the reference block {c, top}, the offset, actual minus timed x)
// cubeTry follows it and p is the press's TIME as a column (as the plan's presses are played: tick = column * 30 / dx).
const SNAP1 = { max: 1, near: 90, far: 150, side: 120 };
function snapStep(sn, T, x, y) { const on = []; for (let c = Math.ceil((x - 45) / 30); c <= Math.floor((x + 15) / 30); c++) if (T[c] != null && T[c] > -9 && Math.abs(T[c] * 30 - y) < 1e-6) on.push(c);
  if (!on.length) return x; on.sort((a, b) => Math.floor((b * 30 + 15) / 100) - Math.floor((a * 30 + 15) / 100) || b - a);
  for (const c of on) { const cx = c * 30 + 15;
    if (sn.ref && sn.ref.c !== c) { const P = SNAP1, dx = cx - (sn.ref.c * 30 + 15), dy = (T[c] - sn.ref.top) * 30, mx = P.max;
      if ((Math.abs(dx - P.side) <= mx && Math.abs(dy - 30) <= mx) || (Math.abs(dx - P.far) <= mx && Math.abs(dy + 30) <= mx) || (Math.abs(dx - P.near) <= mx && Math.abs(dy - 60) <= mx)) {
        const tx = cx + sn.d, nx = Math.abs(tx - x) > mx ? x + Math.sign(tx - x) * mx : tx; sn.off += nx - x; x = nx; } }
    sn.ref = { c, top: T[c] }; sn.d = x - cx; }
  return x; }
function cubeTry(T, haz, c0, p, c1, sn0) { const sn = sn0 ? { ref: sn0.ref, d: sn0.d, off: sn0.off } : null, off0 = sn ? sn.off : 0;
  if (p != null && p * 30 + off0 < c0 * 30 - 1e-6) return { ok: false, why: "in the air" };   // c0: where it last landed
  let x = c0 * 30, y = 0, vy = 0, on = true, jumped = false, land = null, n = 0, snL = null;
  const sup = () => { let t = -99; for (let c = Math.floor((x - 15) / 30); c <= Math.floor((x + 14.9) / 30); c++) t = Math.max(t, T[c] ?? -99); return t; };
  y = sup() * 30;   // standing on whatever its box is over (a 1-wide block it has just landed on the edge of)
  while (x < c1 * 30 && n++ < 3000) {
    let jt = false;   // the jump's own tick moves x only (the real sim's arc, 2026-11-27: 2.4 units lower at the top otherwise)
    if (on && p != null && !jumped && x - (sn ? sn.off : 0) >= p * 30 - 1e-6) { vy = CUBE.J; on = false; jumped = true; jt = !!sn; }
    else if (!on) { vy -= CUBE.g * CUBE.DTS; if (vy < -15) vy = -15; }
    x += CUBE.X; y += on || jt ? 0 : vy * CUBE.DTS; const t = sup() * 30;
    if (on && t < y) on = false; if (y < t - 10) return { ok: false, why: "wall" };
    if (!on && vy <= 0 && y <= t) { y = t; on = true; vy = 0; }
    if (on && sn) x = snapStep(sn, T, x, y);
    if (on && jumped && land == null) { land = x / 30; if (sn) snL = { ref: sn.ref, d: sn.d, off: sn.off }; }
    if (y < -60) return { ok: false, why: "pit" };
    for (const h of haz) if (h.r ? (x - h.cx) ** 2 + (y + 15 - h.cy) ** 2 < (15 + h.r) ** 2 : x + 15 > h.x0 && x - 15 < h.x1 && y + 30 > h.y0 && y < h.y1) return { ok: false, why: "hazard" }; }
  if (p != null && !jumped) return { ok: false, why: "no jump" };
  return { ok: true, land, sn: snL, end: sn }; }
// the timing window of a press at p: the run of ticks around it that still clears [c0, c1] -> {e, l} ticks early / late
function cubeWin(T, haz, c0, p, c1, max = 60) { const t = CUBE.X / 30; if (!cubeTry(T, haz, c0, p, c1).ok) return null;
  let e = 0, l = 0; while (e < max && cubeTry(T, haz, c0, p - (e + 1) * t, c1).ok) e++; while (l < max && cubeTry(T, haz, c0, p + (l + 1) * t, c1).ok) l++;
  return { e, l }; }

// OPEN CUBE, presses first. The idea stays: open sky, platforms at changing heights over spike pits. Now: each click is a
// jump whose landing height is drawn first (up 1-2 rows, the same, down 1-3), the arc found, the platform put where it comes
// down. Same-height jumps with no gap get a spike to jump (so the click is needed); drops a walk-off would also reach get a
// spike where the walk-off lands. Rhythm: a gap of 0.45-1 s between clicks (shorter at harder), on half beats with a bpm.
// Window: the late and early edges, ~1.6 columns each at easy (~150 ms), ~0.6 at harder.
CONCEPT.opencube = "open sky: jumps from platform to platform at changing heights over spike pits, built from the clicks";
GEN.opencube = o => { const { R, mix, W, H, G, beatCols, style, onBeat, entry } = ctx(o, 8), half = 0;   // beats: onBeat picks each press
  const late = mix(1.6, 0.6), early = mix(1.6, 0.6), hiRow = H - 2;   // the player's row: 1 (on the ground) .. H - 2
  // one base gap per generation (its click style), each click +-15% around it, a rest (x1.6-2) one click in 8
  const gap0 = R.pick([0.5, 0.6, 0.7, 0.8, 1.0].map(v => v - mix(0, 0.15)));
  const gapS = c => { let g = gap0 * (0.85 + R() * 0.3) * (R.chance(0.12) ? 1.6 + R() * 0.4 : 1) / style.pace(c); if (half) g = Math.max(1, Math.round(g * COLS_PER_SEC / half)) * half / COLS_PER_SEC; return g; };
  const surf = [{ r: entry(1, H - 3), c0: 0, c1: null }], presses = [];   // r: the row the player runs in (block under it at r - 1)
  let x = onBeat(R.int(4, 6) + 0.5, 3.5), tgt = null;   // the first click's column; tgt: tall maps head for it
  while (x < W - 8) { const s = surf[surf.length - 1];
    // where it lands: a height step drawn first, toward the middle more often, the edges now and then
    // tall maps: head for a far target row (up in 1-2 row steps, down in drops), a new one once reached
    let dh = R.pick([2, 1, 1, 0, -1, -1, -2, -3]);
    if (H > 10) { if (tgt == null || Math.abs(tgt - s.r) < 2) tgt = s.r < H / 2 ? R.int(Math.ceil(H * 0.6), hiRow) : R.int(1, Math.floor(H * 0.35));
      if (R.chance(0.8)) dh = tgt > s.r ? R.pick([1, 2, 2]) : -R.pick([1, 2, 3]); } if (s.r + dh < 1 || s.r + dh > hiRow) dh = clamp(-dh, -3, 2); const r = clamp(s.r + dh, 1, hiRow);
    const arc = cubeArc(x * 30, (s.r) * 30, r); if (!arc || arc.land > W - 3) break;
    if (r > s.r && (arc.up == null || arc.top < r + 0.1)) { x += 1; continue; }   // out of a jump's reach: draw again
    let e = early; if (arc.up != null) e = Math.min(e, arc.land - arc.up - 0.6);   // an up-landing: the platform's side must be under the arc
    s.c1 = Math.floor(x + late); presses.push(+x.toFixed(2));
    const c0 = Math.ceil(arc.land - Math.max(0.3, e));
    if (r === s.r && c0 <= s.c1 + 1) {   // no gap: one floor, a spike to jump where the arc is high
      const sp = Math.round(x + 2); G.put(sp, r, "^"); s.c1 = null; }
    else { surf.push({ r, c0: Math.max(c0, s.c1 + 1), c1: null });
      // a drop a walk-off would also make: a spike where the walk-off lands, if the jump lands further on
      if (r < s.r) { const f = cubeFall((s.c1 + 1) * 30, s.r * 30, r); if (f != null && f >= c0 && f < arc.land - 1.2) G.put(Math.floor(f), r, "^"); } }
    x = onBeat(arc.land + gapS(arc.land) * COLS_PER_SEC - 4.46, arc.land + 1);   // the next click: the rhythm's gap after this one
  }
  surf[surf.length - 1].c1 = W - 1;
  // draw: the ground is blocks where the path runs on it, spikes in groups (a saw now and then) where it doesn't
  const onGround = Array(W).fill(false);
  surf.forEach((t, i) => { const c1 = t.c1 == null ? (surf[i + 1] ? surf[i + 1].c0 - 1 : W - 1) : t.c1;
    if (t.r <= 1) for (let c = t.c0; c <= c1; c++) onGround[c] = true;
    else if (t.r <= 3 || i === 0 || R.chance(0.4)) G.box(t.c0, c1, 0, t.r - 1); else G.box(t.c0, c1, t.r - 1, t.r - 1); });   // the entry stands on the ground
  for (let c = 0; c < W; c++) if (onGround[c]) G.put(c, 0, G.rows()[H - 1][c] === "." ? "#" : G.rows()[H - 1][c]);
  for (let c = 0; c < W; c++) if (!onGround[c] && G.rows()[H - 1][c] === ".") G.put(c, 0, R.chance(0.08) ? "o" : "^");
  return { map: G.rows(), mode: "cube", presses }; };

// CLOSER CUBE, presses first. The idea stays: a low corridor (the ceiling 5 rows over the floor), floor hazards to jump and
// hanging spikes out of step with them. Now the clicks come first: a press on the rhythm (or the beat), its jump played in
// the page's cube physics (cubeTry), and the hazard under it -- 1-3 spikes or a 2-3 wide pit -- picked and placed so the
// press's timing window is near the tier's size and about centred on it. Between jumps a hanging spike comes down a row
// (a block at f+4, the spike at f+3): walking passes under it, a jump there (a stray press, or a held button) hits it.
// Taller than 8 rows the corridor climbs and comes back: a press lands on a floor a row up, a walk-off takes it a row down
// (Evgeni: the whole height). A gravity pair flips play onto the ceiling for the middle third: the same plan, mirrored.
CONCEPT.closecube = "a low ceiling with hanging spikes out of step with floor hazards; a gravity pair flips play onto the ceiling";
const spikeBox = (c, r) => ({ x0: c * 30 + 12, x1: c * 30 + 18, y0: r * 30 + 9, y1: r * 30 + 21 });
GEN.closecube = o => { const { R, mix, W, H, G, style, onBeat, entry } = ctx(o, 8), TPC = 30 / CUBE.X;
  // the gravity pair: the middle third; in tall maps a short one (12 columns) late, so the climb has the rest of the room
  // (the corridor can't step while upside down: the plan runs upright and is drawn mirrored)
  const gp = H > 10 ? (W >= 40 ? [Math.round(W * 0.62), Math.round(W * 0.62) + 12] : null) : gravPair(W);
  const fl = c => gp && c > gp[0] - 1 && c < gp[1] + 1;   // in the flipped span (planned as if upright, drawn mirrored)
  const target = mix(64, 24), hi = H - 6;   // the window to aim for (ticks, early + late); the floor's top row
  const f = Array(W + 12).fill(0), T = Array(W + 12).fill(1), haz = [], draw = [], presses = [], wins = [];
  const setF = (c, h) => { for (let x = c; x < f.length; x++) { f[x] = h; T[x] = h + 1; } };
  setF(0, entry(0, hi));   // the corridor comes in at a random height (its floor's top row)
  const gap0 = R.pick([0.4, 0.5, 0.6, 0.7].map(v => v - mix(0, 0.15)));
  const gapS = c => gap0 * (0.85 + R() * 0.3) * (R.chance(0.12) ? 1.6 + R() * 0.4 : 1) / style.pace(c);
  const portals = gp ? [gp[0], gp[1]] : [];
  const nearP = (a, b) => portals.some(g => b > g - 1.5 && a < g + 3.5);   // a jump or hazard across a portal's flip
  let x = onBeat(R.int(4, 6) + 0.5, 3.5), tgt = null, lastStep = -9, settle = 0;
  while (x < W - 7) {
    if (nearP(x - 1, x + 5)) { const g = portals.find(g => x + 5 > g - 1.5 && x - 1 < g + 3.5); x = onBeat(g + 4.6 + R() * 1.5, g + 4.51); continue; }
    const h = f[Math.floor(x)];
    // tall maps: head for a far target height; a jump up a row now and then, a walk-off a row down
    let up = false;
    // (over 12 rows the steps come quicker, so a minute-long corridor reaches the far rows: 2026-11-28, Evgeni "try to extend
    // the generators to use full height when possible"; at 20 rows the floor stayed in rows 2-13)
    const tallC = H > 12, stepGap = tallC ? 4 : 6, stepP = tallC ? 0.8 : 0.6;
    if (H > 8 && !fl(x) && x - lastStep > stepGap) { if (tgt == null || tgt === h) tgt = h < hi / 2 ? R.int(Math.ceil(hi / 2), hi) : R.int(0, Math.floor(hi / 2));
      if (tgt > h && R.chance(stepP)) up = true;
      else if (tgt < h && R.chance(stepP) && x - settle > 3.5) {   // a walk-off between two presses: the floor drops a row
        const m = Math.ceil(x - 2.2); if (m > settle + 1) { setF(m, h - 1); lastStep = m; const fc = cubeFall((m + 0.5) * 30, 30, 0);
          settle = fc ?? m + 2; x = onBeat(Math.max(x, settle + 1.2), settle + 1); continue; } } }
    // candidates: (kind, size, where), each scored by how far its window is from the target and how off-centre it is
    const base = { T: T.slice(), haz: haz.slice() }, cands = [];
    const arc = cubeArc(x * 30, 0, 0); if (!arc || arc.land > W - 3) break;
    const opts = up ? [["up", 1]] : [["sp", 1], ["sp", 2], ["sp", 3], ["pit", 2], ["pit", 3]], a1 = up ? cubeArc(x * 30, 0, 1) : null;
    for (const [k, n] of opts) for (let off = -1.5; off <= 1.5; off += 0.5) {
      const T2 = base.T.slice(), H2 = base.haz.slice(), mid = (x + arc.land) / 2 + off; let s = Math.round(mid - n / 2), keep;
      if (k === "sp") { for (let i = 0; i < n; i++) H2.push(spikeBox(s + i, h + 1)); keep = () => { for (let i = 0; i < n; i++) draw.push([s + i, h + 1, "^"]); }; }
      else if (k === "pit") { for (let i = 0; i < n; i++) { T2[s + i] = -9; H2.push(spikeBox(s + i, h)); } keep = () => { for (let i = 0; i < n; i++) { T[s + i] = -9; draw.push([s + i, h, "^"]); } }; }
      else { // a floor a row up: it starts under the arc's way down (past where the arc rises over that row)
        if (!a1 || a1.up == null) continue; s = Math.ceil(a1.land - 1 + off * 0.4); if (s <= a1.up + 0.6 || s <= x + 1 || h + 1 > hi) continue; for (let c = s; c < T2.length; c++) T2[c] = h + 2; keep = () => { setF(s, h + 1); lastStep = s; }; }
      const L = cubeTry(T2, H2, x - 2, x, arc.land + 2.5); if (!L.ok) continue;
      const w = cubeWin(T2, H2, x - 2, x, Math.max(arc.land + 2.5, L.land + 1.5)); if (!w) continue;
      const tot = w.e + w.l, cen = Math.abs(w.e - w.l) / Math.max(1, tot);
      cands.push({ sc: Math.abs(tot - target) / target + cen * 0.8 + R() * 0.15, w, keep, k, n, s, land: L.land, T2, H2 }); }
    if (!cands.length) { x = onBeat(x + 1, x + 0.5); continue; }
    cands.sort((a, b) => a.sc - b.sc); const c = cands[0];
    c.keep(); haz.splice(0, haz.length, ...c.H2);
    presses.push(+x.toFixed(4)); wins.push(c.w); settle = c.land;
    x = onBeat(x + gapS(x) * COLS_PER_SEC, c.land + 0.6);
  }
  // hanging spikes come down between jumps (out of step with the floor's): a block at f+4, the spike at f+3. Kept only if
  // every planned press still clears and keeps most of its window
  const runs = presses.map((p, i) => [p, wins[i]]);
  for (let i = 0; i + 1 < presses.length; i++) { const a = presses[i], b = presses[i + 1];
    const la = cubeTry(T, haz, a - 2, a, b - 0.2).land; if (la == null || b - la < 3.2 || !R.chance(mix(0.6, 0.9))) continue;
    const g = Math.round((la + b) / 2 - 0.5); if (portals.some(q => Math.abs(q - g) < 4)) continue;
    const hh = f[g]; if (f[g - 1] !== hh || f[g + 1] !== hh || T[g] < 0) continue;
    const H2 = haz.concat([spikeBox(g, hh + 3), { x0: g * 30, x1: g * 30 + 30, y0: (hh + 4) * 30, y1: (hh + 5) * 30 }]);
    const okAll = [i, i + 1].every(j => { const p = presses[j], w0 = wins[j], w = cubeWin(T, H2, p - 2, p, (presses[j + 1] ?? W) - 0.3);
      return w && w.e + w.l >= 0.7 * (w0.e + w0.l); });
    if (okAll) { haz.push(...H2.slice(-2)); draw.push([g, hh + 3, "v"], [g, hh + 4, "#"]); } }
  // draw: the floor up to f, the ceiling from f+5; in the flipped span every row mirrors about the corridor's middle
  const mir = (c, r, ch) => fl(c) ? [2 * f[c] + 5 - r, ch === "^" ? "v" : ch === "v" ? "^" : ch] : [r, ch];
  for (let c = 0; c < W; c++) { if (fl(c)) { G.box(c, c, 0, f[c] + 0); if (T[c] >= 0) G.box(c, c, f[c] + 5, H - 1); else { G.box(c, c, f[c] + 6, H - 1); } }
    else { if (T[c] >= 0) G.box(c, c, 0, f[c]); else if (f[c] > 0) G.box(c, c, 0, f[c] - 1); G.box(c, c, f[c] + 5, H - 1); } }
  for (const [c, r, ch] of draw) { const [rr, cc] = mir(c, r, ch); G.put(c, rr, cc); }
  if (gp) { G.put(gp[0], f[gp[0]] + 2, "G"); G.put(gp[1], f[gp[1]] + 3, "N"); }
  return { map: G.rows(), mode: "cube", presses }; };

// STAIRCASE, PRESSES FIRST (2026-11-27). The idea stays: climb a row a jump to a top landing, a G portal drops the cube
// onto a bar along the top, it goes down a staircase hanging from the top (each step a row nearer the floor), an N at
// its last step drops it to the floor, and the climb starts again; with no room for that, it walks back down. Now the
// presses come first, on the rhythm or the beat: each one a jump onto a step a row up whose edge is placed where the
// press's measured window (cubeWin) is near the tier's and about centred -- an early press lands short and walks into
// the step, a late one hits its side -- or, now and then, a jump over a spike or a pit on a landing. The hanging part is
// planned the same way, upright, and drawn mirrored (a row up there is a row down in the map).
CONCEPT.staircase = "climb a step at a time to a landing, then a gravity portal: down the steps hanging from the top, upside down, and back; hazards on some landings";
GEN.staircase = o => { const { R, mix, W, H, G, style, onBeat, entry } = ctx(o, 9);
  // the window to aim for; the top level upright / hanging (the hanging stairs come down 4-6 rows: in tall maps the climb
  // covers the height, and the way down still fits the section)
  const target = mix(64, 24), topU = H - 4, topM = Math.min(H - 6, R.int(4, 6));
  const N = W + 12, f = Array(N).fill(0), T = Array(N).fill(1), mir = Array(N).fill(false), haz = [], draw = [], presses = [], wins = [], portals = [];
  const setF = (c, h) => { for (let x = c; x < N; x++) { f[x] = h; T[x] = h + 1; } };
  setF(0, entry(0, Math.max(0, topU - 3)));   // it comes in at a random height, with a climb still ahead
  const gap0 = R.pick([0.4, 0.5, 0.6, 0.7].map(v => v - mix(0, 0.15)));
  const gapS = c => gap0 * (0.85 + R() * 0.3) * (R.chance(0.12) ? 1.6 + R() * 0.4 : 1) / style.pace(c);
  let x = onBeat(R.int(4, 6) + 0.5, 3.5), dir = 1, flips = 0, settle = 0, lastStep = -9, hangFrom = null, chain = 0, chainN = 2;
  while (x < W - 6) { const h = f[Math.floor(x)], m = mir[Math.floor(x)], top = m ? topM : topU;
    // the turn at the top: upright -> G and the hanging staircase (if there is room), hanging -> N back to the floor
    // (hanging near the section's end: back down now, whatever the level, so the section ends upright on the floor)
    if ((h >= top && dir > 0) || (m && x > W - 12)) {
      if (!m && (flips === 0 || R.chance(0.5)) && x + (topM + 1) * 5.5 + 10 < W) { const g = Math.ceil(Math.max(x - 1.5, settle + 1));
        flips++; portals.push([g, H - 3, "G"]); for (let c = g; c < N; c++) mir[c] = true; setF(g, 0); hangFrom = g;
        settle = (cubeFall(0, 30, 0) ?? 1.5) + g; dir = 1; x = onBeat(settle + 1.2, settle + 1); continue; }
      if (m) { const g = Math.ceil(Math.max(x - 1.5, settle + 1)); portals.push([g, H - 3 - h, "N"]);
        for (let c = g; c < N; c++) mir[c] = false; setF(g, 0); draw.push(["floor", hangFrom, g]);
        settle = (cubeFall(0, (H - 3 - h) * 30 - 30, 0) ?? 3) + g; dir = 1; x = onBeat(settle + 1.2, settle + 1); continue; }
      dir = -1; }
    if (dir < 0 && h <= 0) dir = 1;
    // going down (upright, no room to flip): a walk-off a row down between presses
    if (dir < 0 && x - settle > 3.5) { const c = Math.ceil(x - 2.2); if (c > settle + 1) { setF(c, h - 1); lastStep = c;
        settle = cubeFall((c + 0.5) * 30, 30, 0) ?? c + 2; x = onBeat(Math.max(x, settle + 1.2), settle + 1); continue; } }
    const up = dir > 0 && h < top && (chain > 0 || R.chance(mix(0.85, 0.75))), arc = cubeArc(x * 30, 0, 0), a1 = cubeArc(x * 30, 0, 1);
    if (!arc || arc.land > W - 3) break;
    const opts = up ? [["up", 1]] : [["sp", 1], ["sp", 2], ["pit", 1], ["pit", 2]], cands = [];
    for (const [k, n] of opts) for (let off = -1.5; off <= 1.5; off += 0.5) {
      const T2 = T.slice(), H2 = haz.slice(); let s = Math.round((x + arc.land) / 2 + off - n / 2), keep;
      if (k === "sp") { for (let i = 0; i < n; i++) H2.push(spikeBox(s + i, h + 1)); keep = () => { for (let i = 0; i < n; i++) draw.push([s + i, h + 1, "^"]); }; }
      else if (k === "pit") { if (h < 1 && !m) continue; for (let i = 0; i < n; i++) { T2[s + i] = -9; H2.push(spikeBox(s + i, h)); } keep = () => { for (let i = 0; i < n; i++) { T[s + i] = -9; draw.push([s + i, h, "^"]); } }; }
      else { if (!a1 || a1.up == null) continue; s = Math.ceil(a1.land - 1 + off * 0.4); if (s <= a1.up + 0.6 || s <= x + 1) continue;
        for (let c = s; c < N; c++) T2[c] = h + 2; keep = () => { setF(s, h + 1); lastStep = s; }; }
      const c0 = Math.max(x - 2, settle), L = cubeTry(T2, H2, c0, x, arc.land + 2.5); if (!L.ok) continue;
      const w = cubeWin(T2, H2, c0, x, Math.max(arc.land + 2.5, L.land + 1.5)); if (!w) continue;
      const tot = w.e + w.l, cen = Math.abs(w.e - w.l) / Math.max(1, tot);
      cands.push({ sc: Math.abs(tot - target) / target + cen * 0.8 + R() * 0.15, w, keep, land: L.land, H2, up: k === "up" }); }
    if (!cands.length) { x = onBeat(x + 1, x + 0.5); continue; }
    cands.sort((a, b) => a.sc - b.sc); const c = cands[0]; c.keep(); haz.splice(0, haz.length, ...c.H2);
    presses.push(+x.toFixed(4)); wins.push(c.w); settle = c.land;
    // up-jumps chain (1-3 in a row, a jump right off each landing), then a landing walked on the rhythm's gap
    if (c.up && chain < chainN) { chain++; x = onBeat(c.land + 0.25 + R() * 0.5, c.land + 0.2); }
    else { chain = 0; chainN = R.int(1, 3); x = onBeat(x + gapS(x) * COLS_PER_SEC, c.land + 0.6); } }
  // draw: upright columns blocks from the ground to f (a pit: its spike row on the blocks under it); hanging columns the
  // same mirrored from the top, over a low floor with spikes where an early fall would land
  const wr = (c, r) => mir[c] ? H - 1 - r : r, wch = (c, ch) => mir[c] ? (ch === "^" ? "v" : ch === "v" ? "^" : ch) : ch;
  for (let c = 0; c < W; c++) { const lo = T[c] >= 0 ? f[c] : f[c] - 1; if (lo >= 0) { const a = wr(c, 0), b = wr(c, lo); G.box(c, c, Math.min(a, b), Math.max(a, b)); } }
  for (const d of draw) if (d[0] === "floor") { const [, a, b] = d; G.box(a, b + 6, 0, 0); for (let q = a + 2; q < b - 1; q += R.int(3, 5)) G.put(q, 1, "^"); }
  for (const d of draw) if (d[0] !== "floor") { const [c, r, ch] = d; G.put(c, wr(c, r), wch(c, ch)); }
  for (const [c, r, ch] of portals) G.put(c, r, ch);
  // hazards on the roof where the upright play is well below it (5 rows or more): a bar with spikes hanging in groups
  for (let c = 0; c < W; c++) if (!mir[c] && f[c] + 1 <= H - 6 && !portals.some(p => Math.abs(p[0] - c) < 3)) { G.put(c, H - 1, "#"); if (R.chance(0.35)) G.put(c, H - 2, "v"); }
  return { map: G.rows(), mode: "cube", presses }; };

// HANGING (cube). Idea: masses hang from the top over a spiked floor; jump between and under them. Motif: one hanging
// mass + a pit. Varies: mass width, how low it hangs, its hanging spikes, the gap to the next.
CONCEPT.hanging = "masses hang from the top over a floor with spike pits; their width and depth change";
GEN.hanging = o => { const { R, imix, room, len, chance, W, H, G } = ctx(o, 12); let c = 2;
  G.box(0, W - 1, 0, 1);
  while (c < W - 4) { const w = R.int(3, 7), low = R.int(imix(8, 6), imix(9, 7)), e = Math.min(W - 2, c + w - 1);
    G.box(c, e, low, H - 1); if (w >= 5) G.box(c + 1, e - 1, low - 1, low - 1);
    if (chance(0.5, 0.9)) G.put(c, low - 1, "v"); if (e - c >= 3 && chance(0.4, 0.9)) G.put(e, low - 1, "v");
    // never three spikes in a row (Evgeni 2026-11-27 on a generated one: "i dont like triple spikes ... pretty bland"):
    // one or two spikes on the floor's top, or an open pit with a saw in it
    const pit = c + w + 1, n = R.int(1, room(1, 2));
    if (pit < W - 3) { if (R.chance(0.4)) { for (let x = pit; x < pit + n + 1; x++) { G.put(x, 0, "."); G.put(x, 1, "."); } G.put(pit, 0, "o"); }
      else G.box(pit, pit + n - 1, 2, 2, "^"); }
    c += w + len(room(5, 3), room(6, 4)); }
  return { map: G.rows(), mode: "cube" }; };

// FLYING (ship). Idea: a floor and a ceiling that rise and fall together. Motif: a hill (leg up, flat, leg down). Varies:
// hill height and flat length, spikes in valleys and hanging at the crests, a saw in the open gap. Harder: a narrower gap,
// shorter flats, more hazards. A gravity pair: the held button now flies down.
CONCEPT.fly = "floor and ceiling rise and fall together in hills; spikes in valleys, saws in the gap; a gravity pair";
// FLY, PRESSES FIRST (Evgeni 2026-11-27: "our generating solves by design and we just patch the timings ... shape first
// is not great"): the plan is holds and releases (lengths from the tier and the generation's click style: style.holdAt /
// pace), steered loosely toward height targets that tour the room (tour()); shipPath() steps the ship tick by tick as
// lib/physics.js does; the corridor is fitted around that path: each column edge's floor height lies between the path's
// lowest bottom and highest top (a margin each side) over the two columns it touches, slopes of at most a row a column
// (a forward and a backward pass narrow each edge's range, then a greedy pick near the middle); the ground and the roof
// are kept where the path slides on them. Hazards on the sides only where the path passes them with room. Taller than the
// band (10 rows): a hidden ship portal re-bands where the path heads out of the band. Returns presses as [press, release]
// column pairs (layoutcheck planCheck plays them).
const SHIP = { X: CUBE.X, g: 0.958199, DTS: 0.225, UP: 8, DOWN: -6.4 };
// one tick of the ship (upright, released ship falling rule of the world frame: same thing upright)
function shipStep(st, held) { const falling = st.vy <= 2 * SHIP.g, a = held ? -1 : (falling ? 0.8 : 1.2), bb = held ? (falling ? 0.5 : 0.4) : 0.4;
  st.vy = Math.round((st.vy - a * SHIP.g * SHIP.DTS * bb) * 1000) / 1000; st.vy = clamp(st.vy, SHIP.DOWN, SHIP.UP); st.y += st.vy * SHIP.DTS; }
// THE CORRIDOR FITTED AROUND A PLANNED PATH (fly, wave): ys = the player's centre per tick from the section's start,
// bands = the band's floor row per tick; returns the floor height at each column edge (rows, steps of at most 1), or null
// when no corridor of `gap` rows holds the path. Each edge's floor lies between the path's lowest bottom and highest top
// (half = the player's half size, m = margin) over the two columns it touches; a forward and a backward pass narrow each
// edge's range to slopes of a row a column, then a greedy pick near the middle. Where the path rests on the ground (or
// the map's roof) the floor is the ground (the ceiling the roof): rest = how far the centre sits above a surface.
function fitCorridor(ys, bands, W, H, gap, TPC, { m = 6, half = 15, rest = half, bandSafe = true, run = 1, g0 = null } = {}) { const top = H * 30;
  // g0: the entry's floor row (the player comes in on it): the first edges are a floor there, where the path rests on it
  const N = W + 1, lo = Array(N).fill(0), hi = Array(N).fill(H - gap), ground = Array(N).fill(null), roof = Array(N).fill(false);
  for (let t = 0; t < ys.length; t++) { const c = Math.floor(t / TPC), y = ys[t];
    for (const k of [c, c + 1]) { if (k >= N) continue;
      // the band's floor and roof are safe surfaces too (the ship slides on them), so the corridor never has to go past
      // them: a floor at or below the band's floor, a ceiling at or above its roof, is always far enough
      const bf = bandSafe ? bands[t] : 0, br = bandSafe ? Math.min(H, bf + 10) : H;
      if (g0 != null && k <= 1 && y - rest <= g0 * 30 + 0.5) ground[k] = g0;
      else if (y - rest <= bf * 30 + 0.5) ground[k] = Math.min(ground[k] ?? bf, bf); else hi[k] = Math.min(hi[k], Math.max(g0 != null && k <= 1 ? Math.max(bf, g0) : bf, Math.floor((y - half - m) / 30)));
      if (y + rest >= top - 0.5) roof[k] = true; else lo[k] = Math.max(lo[k], Math.min(br, Math.ceil((y + half + m) / 30)) - gap); } }
  for (let k = 0; k < N; k++) { if (ground[k] != null) hi[k] = Math.min(hi[k], ground[k]); if (roof[k]) lo[k] = H - gap; }
  for (let k = 1; k < N; k++) { lo[k] = Math.max(lo[k], lo[k - 1] - 1); hi[k] = Math.min(hi[k], hi[k - 1] + 1); }
  for (let k = N - 2; k >= 0; k--) { lo[k] = Math.max(lo[k], lo[k + 1] - 1); hi[k] = Math.min(hi[k], hi[k + 1] + 1); }
  // run > 1: gentler slopes, a row every `run` columns at most (Evgeni 2026-11-27 on fly: "a bit too wavy, flying should
  // have some kind of a smaller degree in the general flight"): the same passes over `run` columns
  if (run > 1) { for (let k = run; k < N; k++) { lo[k] = Math.max(lo[k], lo[k - run] - 1); hi[k] = Math.min(hi[k], hi[k - run] + 1); }
    for (let k = N - 1 - run; k >= 0; k--) { lo[k] = Math.max(lo[k], lo[k + run] - 1); hi[k] = Math.min(hi[k], hi[k + run] + 1); } }
  if (lo.some((v, k) => v > hi[k])) return null;   // too steep for the grid: the caller draws again
  // the pick follows the path: the floor half a gap under the path's mean height at that edge, so the tunnel zigzags
  // with the flight instead of running straight around it
  const sum = Array(N).fill(0), cnt = Array(N).fill(0);
  for (let t = 0; t < ys.length; t++) { const c = Math.floor(t / TPC); for (const k of [c, c + 1]) if (k < N) { sum[k] += ys[t]; cnt[k]++; } }
  const e = []; let last = -99;
  for (let k = 0; k < N; k++) { const want = cnt[k] ? Math.round(sum[k] / cnt[k] / 30 - gap / 2) : Math.round((lo[k] + hi[k]) / 2);
    if (!k) { e.push(clamp(g0 ?? 0, lo[0], hi[0])); continue; }
    const a = Math.max(lo[k], e[k - 1] - 1), b = Math.min(hi[k], e[k - 1] + 1); if (a > b) return null;
    // a step only `run` columns after the last one, unless the path forces it
    let v = k - last < run && e[k - 1] >= a && e[k - 1] <= b ? e[k - 1] : clamp(want, a, b);
    if (k === 1 && g0 != null && g0 >= a && g0 <= b) v = g0;   // the entry floor is flat for its first column (a wave sliding off its end dies)
    if (v !== e[k - 1]) last = k; e.push(v); }
  return e; }
function flyPlan(o, W, H, R, mix, style, gap, cap = 3.2, onBeat = w => w, run = 2, b0 = 0) {
  const TPC = 30 / SHIP.X, T = Math.floor(W * TPC), m = 6, top = H * 30;
  const h0 = mix(60, 32), r0 = mix(70, 36);   // base hold and release, ticks (easy: long and slow; harder: quick)
  // b0: the entry, the floor's top row at column 0 (the ship comes in on it; the join's ship portal a row over it sets the
  // band 4 rows under it, lib/physics.js)
  const next = tour(R, 1, H - 2); let tgt = next(Math.round(H / 2)), band0 = clamp(b0 - 4, 0, Math.max(0, H - 10)), lastMover = -99;
  const st = { y: b0 * 30 + 15, vy: 0 }, ys = [], bands = [], ev = [], movers = []; let held = false, left = 0;
  for (let t = 0; t < T; t++) { const c = t / TPC, row = st.y / 30;
    if (left <= 0) { // the next hold or release: its length from the style, longer toward the target, shorter away
      const toward = (tgt > row + 0.7) === !held;   // the coming state (not held -> press) moves toward the target
      held = !held; const base = (held ? h0 * style.holdAt(c) : r0) / style.pace(c);
      left = Math.round(base * (0.75 + R() * 0.5) * (toward ? 1.3 : 0.7));
      // on a beat: this state lasts until the beat nearest its wanted end (at least 8 ticks)
      left = Math.max(8, Math.round(onBeat(c + left / TPC, c + 8 / TPC) * TPC) - t); 
      // the cap ahead (gentle flight): the tick this state would pass the steepness cap, played forward; the state ends on
      // the last beat before it (a little past is fine), so the turns the cap makes fall on beats too
      { const q = { ...st }; let k = 0; while (k < left && !((held && q.vy > cap) || (!held && q.vy < -cap))) { shipStep(q, held); k++; }
        if (k < left) { left = k; for (const back of [0, 15, 30, 45, 60]) { const b = Math.round(onBeat(c + (k - back) / TPC, c + 8 / TPC) * TPC) - t;
          if (b <= k + 14) { left = Math.max(8, b); break; } } } }
      ev.push([+c.toFixed(4), held ? "press" : "release"]);   // 4 places: planCheck turns it back into the exact tick
      if (Math.abs(tgt - row) < 1) tgt = next(Math.round(row)); }
    // steepness: the corridor's slopes are at most a row a column, so cap the climb and the dive (a forced turn)
    // (with beats: a forced turn waits for a beat if one comes within 6 ticks)
    if (left > 15 && ((held && st.vy > cap) || (!held && st.vy < -cap))) left = Math.min(left, Math.max(0, Math.round(onBeat(c, c) * TPC) - t > 6 ? 0 : Math.round(onBeat(c, c) * TPC) - t));
    shipStep(st, held); left--;
    // the floor and the roof of the band are surfaces: slide along them
    // (the entry floor b0 holds it for its first column and a half, as the corridor's first edges are drawn there, then
    // comes down as steeply as the corridor may, a row every `run` columns, so a ship that falls rides it)
    const vf = c < 1.5 ? b0 : b0 - 1 - Math.floor((c - 1.5) / Math.max(1, run));
    const lo = Math.max(band0, vf) * 30 + 15, hi = Math.min(top, band0 * 30 + 300) - 15;
    if (st.y < lo) { st.y = lo; st.vy = 0; } if (st.y > hi) { st.y = hi; st.vy = 0; }
    // taller than the band: a mover re-bands around the ship where it heads out (its column clear of the last one by 4)
    if (H > 10 && c - lastMover > 4 && c > 3 && c < W - 3) { const r = Math.floor(st.y / 30), nb = clamp(r - 5, 0, H - 10);
      if (nb !== band0 && ((st.vy > 0 && st.y > hi - 75) || (st.vy < 0 && st.y < lo + 75))) { movers.push([Math.floor(c), r]); band0 = nb; lastMover = c; } }
    ys.push(st.y); bands.push(band0); }
  // a tall map's plan that slides the map's top is drawn again: the roof slopes there caught a ship in a 4-row gap (2026-11-28)
  if (H > 10 && ys.some(y => y >= top - 16)) return null;
  const e = fitCorridor(ys, bands, W, H, gap, TPC, { m, half: 15, run, g0: b0 }); if (!e) return null;
  // presses as [press, release] column pairs
  const presses = []; for (let i = 0; i < ev.length; i++) if (ev[i][1] === "press") presses.push([ev[i][0], ev[i + 1] ? ev[i + 1][0] : W]);
  return { e, ys, TPC, presses, movers }; }
CONCEPT.fly = "a ship corridor fitted around a planned flight of holds and releases: it tours the room, slides the ground and the roof now and then, hazards on the sides";
GEN.fly = o => { const { R, room, chance, W, H, G, mix, style, onBeat, entry } = ctx(o, 10), gap = o.gap ?? room(6, 4);
  // it comes in at a random height (Evgeni 2026-11-28): the corridor's floor at column 0 (short maps up to row 4, so the
  // band stays at the ground); a draw whose corridor doesn't start there is drawn again
  const b0 = entry(0, H > 10 ? H - gap - 2 : Math.min(4, H - gap - 2));
  // a draw that doesn't fit the grid is drawn again, a little flatter each time (the hardest tier's quick holds need it)
  // the general flight is gentle (Evgeni 2026-11-27: "too wavy ... a smaller degree in the general flight"): climbs and
  // dives capped at vy 3.2 (was 4.6), the corridor stepping a row every 2 columns at most; the last draws fall back to the
  // old 1-a-column fit. Measured on 64 draws (60 cols, 10 / 20 rows): mean path angle 19-21 -> 15 degrees, steeper than 30
  // degrees 20-25% -> 0%, clicks the same, height used 90 -> 79% (10 rows), 70% (20 rows). Feathering at the cap (short
  // opposite states) kept the height but doubled the clicks: not taken.
  let P = null; for (let k = 0; k < 14 && !P; k++) { P = flyPlan(o, W, H, R, mix, style, gap, (k < 10 ? 3.2 : 4.6) - 0.15 * (k % 10), onBeat, k < 10 ? 2 : 1, b0); if (P && P.e[0] !== b0) P = null; }
  if (!P) return flyShape(o);
  const { e, ys, TPC } = P, E = x => e[clamp(x, 0, e.length - 1)];
  tunnel(G, W, E, gap, H - 1);
  // the path's lowest bottom and highest top in a column (units)
  const yb = Array(W).fill(1e9), yt = Array(W).fill(-1e9);
  for (let t = 0; t < ys.length; t++) { const c = Math.floor(t / TPC); if (c < W) { yb[c] = Math.min(yb[c], ys[t] - 15); yt[c] = Math.max(yt[c], ys[t] + 15); } }
  // a spike stands in its cell's lower half (hitbox 6 x 12 at the cell's centre): it clears the path when the path's
  // bottom is 8 above that box (and the mirror for a hanging one); checked on the column and both its neighbours
  const clearF = (c, r) => [c - 1, c, c + 1].every(x => x < 0 || x >= W || yb[x] > r * 30 + 21 + 8);
  const clearR = (c, r) => [c - 1, c, c + 1].every(x => x < 0 || x >= W || yt[x] < r * 30 + 9 - 8);
  let side = R.chance(0.5) ? 1 : -1;
  for (let c = 3; c < W - 2; c++) { const a = E(c), b = E(c + 1), p = E(c - 1); if (a !== b) continue;
    let n = 0; while (c + n + 1 < W - 2 && E(c + n + 1) === a && E(c + n + 2) === a) n++;
    if (n >= 2 && chance(0.5, 0.85)) { const rf = side < 0 && a + gap < H, rr = rf ? a + gap - 1 : a;
      for (let x = c + 1; x <= c + n - 1; x++) if (rf ? clearR(x, rr) : clearF(x, rr)) G.put(x, rr, rf ? "v" : "^");
      if (R.chance(0.6)) side = -side; c += n; continue; }
    if (p > a && chance(0.5, 0.9) && clearF(c, a)) G.put(c, a, "^");
    else if (p < a && a + gap < H && chance(0.3, 0.8) && clearR(c, a + gap - 1)) G.put(c, a + gap - 1, "v"); }
  for (const [c, r] of P.movers) { for (let q = E(c); q < E(c) + gap && q < H; q++) if ("^vo".includes(G.rows()[H - 1 - q][c])) G.put(c, q, ".");
    G.put(c, r, "H"); }
  // the planned path for the board (as layoutcheck's route: [col, row of the centre - 0.5] every 8 ticks)
  const path = []; for (let t = 0; t < ys.length; t += 8) path.push([+(t / TPC).toFixed(2), +(ys[t] / 30 - 0.5).toFixed(2)]);
  return { map: G.rows(), mode: "ship", presses: P.presses, path }; };
// the shape-first fly (before 2026-11-27), kept as the fallback when no plan fits the grid
const flyShape = o => { const { R, imix, room, len, chance, W, H, G } = ctx(o, 10), gap = room(6, 5), hiMax = H - gap;   // taller than 10: band movers
  // the valleys go down to the ground now and then (Evgeni 2026-11-27: "the flying should also be able and hit the
  // ground/floor as part of the path. keeping more distribution over the heights"): the ship slides along it there
  // and the whole band (10 rows, the map's height): the corridor tours from the ground to the band's roof (hiMax = no
  // ceiling blocks there, the roof is the ceiling), a gap of 6 (5 harder) rows
  const next = tour(R, 0, hiMax);
  const e = line(W, Math.round(hiMax / 2), L => { L.run(len(imix(3, 1), imix(4, 2)) + (L.h() === 0 || L.h() === hiMax ? 2 : 0)); L.leg(next(L.h())); });
  tunnel(G, W, e, gap, H - 1);
  const gp = gravPair(W, 30);
  bandMovers(G, W, H, "H", x => e(x) + gap / 2, x => Math.max(e(x), e(x + 1)), x => Math.min(e(x), e(x + 1)) + gap);
  // hazards on the sides, never floating in the middle (Evgeni 2026-11-27 on 🎲 fly 53193: "the placing of the hazards is
  // too random and unbalanced/unmatched, they should not be so much in the middle, somewhat more to the sides. for ship we
  // need to cover some of the corridor in spikes otherwise i can just slide"): along each flat stretch, the floor or the
  // ceiling (taking turns, by chance) spiked for most of its length, so neither can be slid the whole way; a spike in
  // each valley's floor, one hanging at each crest
  let side = R.chance(0.5) ? 1 : -1;
  const near = c => gp && (Math.abs(c - gp[0]) < 3 || Math.abs(c - gp[1]) < 3);
  for (let c = 3; c < W - 2; c++) { const a = e(c), b = e(c + 1), p = e(c - 1); if (a !== b || near(c)) continue;
    let n = 0; while (c + n + 1 < W - 2 && e(c + n + 1) === a && e(c + n + 2) === a) n++;   // flat from c to c + n
    if (n >= 2 && chance(0.5, 0.85)) {   // a spiked stretch on one side, a column or two left clear at its ends
      const roof = side < 0 && a + gap < H, k0 = c + 1, k1 = c + n - 1;
      for (let x = k0; x <= k1; x++) if (!near(x)) G.put(x, roof ? a + gap - 1 : a, roof ? "v" : "^");
      if (R.chance(0.6)) side = -side; c += n; continue; }
    if (p > a && chance(0.5, 0.9)) G.put(c, a, "^");
    else if (p < a && a + gap < H && chance(0.3, 0.8)) G.put(c, a + gap - 1, "v"); }
  if (gp) { const a = joinNear(e, W, gp[0], 3); let b = joinNear(e, W, gp[1], 3); if (b <= a + 4) b = joinNear(e, W, a + 10, 3);
    for (const [c, t] of [[a, "G"], [b, "N"]]) { for (let r = e(c); r < e(c) + gap; r++) if ("^vo".includes(G.rows()[H - 1 - r][c])) G.put(c, r, ".");
      G.put(c, e(c) + Math.floor(gap / 2), t); } }
  return { map: G.rows(), mode: "ship" }; };

// WAVE. Idea: a 45-degree zigzag tunnel, its ceiling the floor lifted. Motif: one leg up + one down. Varies: leg length;
// slow legs, a quick zigzag in the middle (more clicks a second), slow again. Harder: a narrower tunnel, a longer quick
// part. A gravity pair in the quick part.
CONCEPT.wave = "a 45-degree zigzag tunnel; slow legs, a quick middle, slow again; a gravity pair";
// WAVE, PRESSES FIRST: the legs are planned (each a length from the tier and the click style, a quick middle, one ground
// slide, every turn on a beat when there is one), the wave's exact 45-degree path is stepped from them, and the tunnel is
// fitted around it (fitCorridor). The gravity pair makes two of the turns itself (Evgeni: "portals in waves should usually
// be on connecting points of clicks or holds"): the portal stands where the wave touches it at that turn. Taller than the
// band: a hidden A portal re-bands as in fly. Presses as [press, release] column pairs, plus the planned path.
function wavePlan(W, H, R, mix, style, gap, onBeat, q0, q1, b0 = 0) {   // b0: the entry floor's row (as flyPlan)
  const hiNear = y => y > Math.min(H * 30, band0 * 30 + 300) - 10 - 45 && Math.min(H * 30, band0 * 30 + 300) < H * 30;   // a portal turn there would overshoot the band
  const TPC = 30 / CUBE.X, T = Math.floor(W * TPC), DY = CUBE.X, top = H * 30, GR = 10, RF = 10;   // the wave rests 10 above the ground
  const gp = gravPair(W, 30), slideAt = W >= 30 ? R.int(Math.round(W * 0.3), Math.round(W * 0.6)) : -1;
  const next = tour(R, 1, H - 2); let tgt = next(Math.round(H / 2)), band0 = clamp(b0 - 4, 0, Math.max(0, H - 10)), lastMover = -99, slid = false, sliding = 0;
  let y = b0 * 30 + GR, held = false, grav = 1, left = 0, gpi = 0; const ys = [], bands = [], ev = [], movers = [], portals = [];
  for (let t = 0; t < T; t++) { const c = t / TPC, row = y / 30;
    // the way out: down to the ground and along it to the end, as it came in (a wave sliding off a floor block's end at
    // the exit dies: CLAUDE.md Calibration), with no portal still to come
    if (!pend && c >= W - ((y / 30 - band0) * (grav > 0 ? 1 : 0) + (band0 ? 99 : 0) + 3) && grav > 0 && band0 === 0) { if (held) { held = false; ev.push([+c.toFixed(4), "release"]); } left = 1e9; }
    if (left <= 0) {
      if (!slid && slideAt >= 0 && c >= slideAt && !sliding) { // the ground slide: down to the ground, along it a while
        if (held) { held = false; ev.push([+c.toFixed(4), "release"]); }
        sliding = 1; left = Math.round((row + R.int(4, 7)) * TPC); }
      else { if (sliding) { sliding = 0; slid = true; }
        const mid = c > W * q0 && c < W * q1;
        let amp = (mid ? R.pick([1, 1, 2, 2, 3]) : R.pick([1, 2, 3, 3, 4, 5])) / style.pace(c);
        const up = (held ? 1 : -1) * grav < 0;   // after this turn the wave goes up
        if (Math.abs(tgt - row) < 1) tgt = next(Math.round(row));
        if (H > 13 && c > W * 0.65) tgt = 1;   // tall: back down to the first band for the way out
        if (up !== tgt > row && R.chance(0.6)) amp *= 0.5;   // legs away from the target are short
        // a gravity portal makes this turn when it is the first turn past its spot
        if (gp && gpi < 2 && c >= gp[gpi] && !(hiNear(y))) { const pc = Math.round((c * 30 + 17.5 - 15) / 30), xt = pc * 30 + 15 - 12.5 - 5;
          if (pc < W - 2 && xt >= c * 30) { const wait = Math.ceil((xt - c * 30) / DY); left = wait; pend = { tick: t + wait, pc }; gpi++; } }
        if (!pend) { held = !held; ev.push([+c.toFixed(4), held ? "press" : "release"]);
          left = Math.max(4, Math.round(onBeat(c + amp, c + 4 / TPC) * TPC) - t); } } }
    if (pend && t === pend.tick) { grav = -grav; portals.push([pend.pc, Math.floor(y / 30), grav < 0 ? "G" : "N"]); pend = null;
      left = Math.max(4, Math.round(onBeat(c + R.pick([1, 2, 2, 3]), c + 4 / TPC) * TPC) - t); }
    y += (held ? 1 : -1) * grav * DY; left--;
    const vf = c < 1.5 ? b0 : b0 - 1 - Math.floor(c - 1.5);   // the entry floor, then down at the corridor's slope
    const lo = Math.max(band0, vf) * 30 + GR, hi = Math.min(top, band0 * 30 + 300) - RF; if (y < lo) y = lo; if (y > hi) y = hi;
    // never ride an invisible band edge (it looks like flying straight in the open, and GD 2.2091 may hold no band for the
    // wave at all: PHYSICS.md): turn a row before it; the ground and the map's own roof are real surfaces
    const dirNow = (held ? 1 : -1) * grav; if (!pend && left > 1 && ((dirNow > 0 && hi < top - RF && y > hi - 30) || (dirNow < 0 && band0 > 0 && y < lo + 30))) left = 0;
    if (H > 13 && c - lastMover > 4 && c > 3 && c < W - 3 && !pend) { const r = Math.floor(y / 30), nb = clamp(r - 5, 0, H - 10);
      if (nb !== band0 && ((y > hi - 75) || (y < lo + 75))) { movers.push([Math.floor(c), r]); band0 = nb; lastMover = c; } }
    ys.push(y); bands.push(band0); }
  if (band0 !== 0 || ys[ys.length - 1] > GR + 0.5) return null;   // didn't get back down to the ground: draw again
  const e = fitCorridor(ys, bands, W, H, gap, TPC, { m: 8, half: 5, rest: GR, bandSafe: false, g0: b0 }); if (!e) return null;
  if (e[0] !== b0 || e[1] !== b0) return null;   // (a slope at column 0 kills the wave as it comes in: "block edge")
  const presses = []; for (let i = 0; i < ev.length; i++) if (ev[i][1] === "press") presses.push([ev[i][0], ev[i + 1] ? ev[i + 1][0] : W]);
  return { e, ys, TPC, presses, movers, portals }; }
let pend = null;
CONCEPT.wave = "a 45-degree zigzag tunnel fitted around a planned flight: legs of every size, a quick middle, a ground slide, two turns made by gravity portals";
GEN.wave = o => { const { R, mix, room, W, H, G, style, onBeat, entry } = ctx(o, 13), gap = o.gap ?? room(6, 4), q0 = mix(0.35, 0.2), q1 = mix(0.65, 0.8);
  // it comes in at a random height (Evgeni 2026-11-28): the corridor's floor at column 0 (short maps up to row 4)
  const b0 = entry(0, H > 13 ? H - gap - 2 : Math.min(4, H - gap - 2));
  let P = null; for (let k = 0; k < 12 && !P; k++) { pend = null; P = wavePlan(W, H, R, mix, style, gap, onBeat, q0, q1, b0); }
  if (!P) return waveShape(o);
  const E = x => P.e[clamp(x, 0, P.e.length - 1)]; tunnel(G, W, E, gap, H - 1);
  for (const [c, r] of P.movers) G.put(c, r, "A");
  for (const [c, r, t] of P.portals) G.put(c, clamp(r, E(c), E(c) + gap - 1), t);
  const path = []; for (let t = 0; t < P.ys.length; t += 8) path.push([+(t / P.TPC).toFixed(2), +(P.ys[t] / 30 - 0.5).toFixed(2)]);
  return { map: G.rows(), mode: "wave", presses: P.presses, path }; };
// the shape-first wave (before 2026-11-27), the fallback
const waveShape = o => { const { R, mix, imix, room, W, H, G } = ctx(o, 13), gap = room(6, 5), q0 = mix(0.35, 0.2), q1 = mix(0.65, 0.8);
  // more variety on one screen, legs of every size, short flats between some, and one ground slide (Evgeni 2026-11-27: "wave
  // corridors should have a bit more veriaty on the screen, again a bit more split. and we can add 1 ground slide (where
  // the corridor passes through the ground/floor)"): the floor drops to the ground and the wave slides along it a while
  const top = H - gap - 1, slideAt = W >= 30 ? R.int(Math.round(W * 0.3), Math.round(W * 0.6)) : -1; let slid = false, k = 0, dir = -1;
  const e = line(W, 1, (L, x) => { const mid = x > W * q0 && x < W * q1;
    if (!slid && slideAt >= 0 && x >= slideAt) { slid = true; L.leg(0); L.run(R.int(4, 7)); return; }
    if (k++ % 2 === 0 && R.chance(0.25)) { L.run(R.int(1, 3)); return; }
    const amp = mid ? R.pick([1, 1, 2, 2, 3]) : R.pick([1, 2, 3, 3, 4, 5]);
    dir = -dir; let to = clamp(L.h() + dir * amp, 1, top); if (to === L.h()) { dir = -dir; to = clamp(L.h() + dir * amp, 1, top); }
    L.leg(to); });
  tunnel(G, W, e, gap, H - 1);
  // taller than 13 rows the corridor leaves the 10-row band, so there the wave gets hidden A portals after all (only then:
  // inside one band they did nothing but shift the screen, his note below)
  if (H > 13) bandMovers(G, W, H, "A", x => e(x) + gap / 2, x => Math.max(e(x), e(x + 1)), x => Math.min(e(x), e(x + 1)) + gap);
  // no hidden band movers inside a wave (Evgeni 2026-11-27: "no need portals inside the wave sections if they reach, it will
  // make the screen go bad"; his room-mover lab run showed GD 2.2091 holding no band at all, PHYSICS.md)
  const gp = gravPair(W, 30);
  // portals on a TURN (the join of two inputs), never mid-leg (Evgeni 2026-11-27 on a generated wave: "portals in waves
  // should usually be on connecting points of clicks or holds, putting them in the middle of a corridor is big difficulty
  // spike"): the nearest column where the line changes direction, at the corridor's middle height there
  if (gp) { const a = joinNear(e, W, gp[0]), b = joinNear(e, W, gp[1]); G.put(a, e(a) + Math.floor(gap / 2), "G"); if (b !== a) G.put(b, e(b) + Math.floor(gap / 2), "N"); }
  return { map: G.rows(), mode: "wave" }; };

// FLAPPY (ufo). Idea: pipes from the floor and the ceiling with a gap at changing heights. Motif: one pipe pair. Varies:
// the gap's height (walks up and down), the spacing, spike tips. Harder: a narrower gap, closer pipes, bigger jumps.
CONCEPT.flappy = "pipe pairs from floor and ceiling; the gap's height walks up and down";
// Evgeni 2026-11-27: "flappy bird generates too much of the same poles there should be some variation in width of
// structures in the gameplays as well, and here as well we want to try and use the extremes": poles 1 to 4 wide, and the
// gap tours the whole 10-row band (the ufo's), from just over the ground (no lower pole) to the band's roof (no upper one)
// FLAPPY, PRESSES FIRST (2026-11-27): the taps come first, on the style's rhythm (on a beat when there is one), skipped
// while the ufo is above its height target (tour(): the target walks over the band); the ufo is stepped as lib/physics.js
// does (a tap sets 7 up, gravity 0.4 x 0.958 falling or slow, 0.6 rising fast, fall capped at 6.4); then the poles: 1-4
// wide at changing spacing, each pair's gap fitted around the path over the pole's columns (a margin of 8; the gap at
// least the tier's room), the lower pole left out when the gap reaches the ground, the upper when it reaches the roof.
// Up to the band's 10 rows; taller maps use the shape-first version (its hidden U portals).
function ufoStep(st, tap) { if (tap && st.vy < 7) st.vy = 7; const falling = st.vy <= 2 * SHIP.g;
  st.vy = Math.round((st.vy - (falling ? 0.4 : 0.6) * SHIP.g * SHIP.DTS) * 1000) / 1000; st.vy = clamp(st.vy, SHIP.DOWN, SHIP.UP); st.y += st.vy * SHIP.DTS; }
GEN.flappy = o => { const { R, imix, room, len, chance, W, H, G, mix, style, onBeat, entry } = ctx(o, 10), gh = room(5, 3);
  // taller than the band (Evgeni 2026-11-28: "try to extend the generators to use full height when possible"): GD keeps a
  // ufo in a 10-row band, so where the planned path comes within 2 rows of the band's edge a U (a ufo portal in a ufo: the
  // band set again around it, lib/physics.js) goes on the path itself, in the gap the poles are fitted around
  if (H > 10 && o.shape) return flappyShape(o);
  const movers = []; let bandLo = 0;
  // it comes in at a random height (Evgeni 2026-11-28): on a pillar b0 rows high over the first 3 columns (up to row 4,
  // so the ufo's band stays at the ground)
  const b0 = entry(0, Math.min(4, H - 6)); if (b0 > 0) G.box(0, 2, 0, b0 - 1);
  const TPC = 30 / SHIP.X, T = Math.floor(W * TPC), top = H * 30, m = 8, next = tour(R, 1, H - 2);
  const gap0 = mix(0.55, 0.32) * COLS_PER_SEC;   // columns between taps: easy slow, harder quick
  let tgt = next(Math.round(H / 2)), nextTap = onBeat(R.int(2, 3), 1.5); const st = { y: b0 * 30 + 15, vy: 0 }, ys = [], taps = [];
  for (let t = 0; t < T; t++) { const c = t / TPC; let tap = false;
    if (c >= nextTap - 1e-6) { const row = st.y / 30;
      if (Math.abs(tgt - row) < 1) tgt = next(Math.round(row));
      if (row < tgt + 0.6 && st.y < top - 75) { tap = true; taps.push(+c.toFixed(4)); }   // above the target: let it fall a beat
      // climbing to a higher target takes quicker taps (one every 0.55 s can't hold a ufo up)
      nextTap = onBeat(c + gap0 * (row < tgt - 0.5 ? 0.55 : 1) * (0.8 + R() * 0.4) / style.pace(c), c + 6 / TPC); }
    if (H > 10) { const row = st.y / 30 - 0.5, lastM = movers.length ? movers[movers.length - 1].c : -9;
      if (c > 3 && c < W - 3 && c - lastM >= 3 && ((row > bandLo + 8 && bandLo + 10 < H) || (row < bandLo + 2 && bandLo > 0))) {
        const r = Math.round(st.y / 30 - 0.5), cc = Math.round(c); movers.push({ c: cc, r }); bandLo = Math.max(0, Math.floor((r * 30 + 15 - 150) / 30)); } }
    ufoStep(st, tap); if (H > 10 && st.y > (bandLo + 10) * 30 - 15) { st.y = (bandLo + 10) * 30 - 15; st.vy = 0; } if (H > 10 && bandLo > 0 && st.y < bandLo * 30 + 15) { st.y = bandLo * 30 + 15; st.vy = 0; } const fl = (c + 0.5 < 3 ? b0 : 0) * 30 + 15; if (st.y < fl) { st.y = fl; st.vy = 0; }   // (on the pillar while over it) if (st.y > top - 15) { st.y = top - 15; st.vy = 0; }
    ys.push(st.y); }
  const yb = Array(W).fill(1e9), yt = Array(W).fill(-1e9);
  for (let t = 0; t < ys.length; t++) { const c = Math.floor(t / TPC); if (c < W) { yb[c] = Math.min(yb[c], ys[t] - 15); yt[c] = Math.max(yt[c], ys[t] + 15); } }
  for (let c = 3; c < W - 2;) { const pw = Math.min(W - 2 - c, R.pick([1, 2, 2, 3, 4]));
    let lo = 1e9, hi = -1e9; for (let x = c - 1; x <= c + pw; x++) { lo = Math.min(lo, yb[x]); hi = Math.max(hi, yt[x]); }
    let g0 = Math.floor((lo - m) / 30), g1 = Math.ceil((hi + m) / 30);   // the gap's rows [g0, g1)
    while (g1 - g0 < gh) { if (R.chance(0.5) && g0 > 0) g0--; else if (g1 < H) g1++; else g0--; }
    g0 = Math.max(0, g0); g1 = Math.min(H, g1);
    if (g0 > 0) { G.box(c, c + pw - 1, 0, g0 - 1); if (g0 > 1 && yb[c] > (g0 - 1) * 30 + 30 + 8 && chance(0.4, 0.7)) { /* the pole's top is the hazard's place: a spike tip */ G.put(c, g0 - 1, "^"); } }
    if (g1 < H) G.box(c, c + pw - 1, g1, H - 1);
    c += pw + len(room(5, 3), room(7, 4)); }
  for (const v of movers) G.put(v.c, v.r, "U");
  // a spike tip replaces the pole's top block, so the gap stays as fitted (the block under it carries it)
  return { map: G.rows(), mode: "ufo", presses: taps, path: (() => { const p = []; for (let t = 0; t < ys.length; t += 8) p.push([+(t / TPC).toFixed(2), +(ys[t] / 30 - 0.5).toFixed(2)]); return p; })() }; };
// the shape-first flappy (taller than the band: its hidden U portals)
const flappyShape = o => { const { R, imix, room, len, chance, W, H, G } = ctx(o, 10), gh = room(5, 3), next = tour(R, 1, H - gh); let g = R.int(2, 4);
  G.box(0, W - 1, 0, 0);
  let bc = 5;   // the band's centre row (taller than 10 rows: hidden ufo portals in the pole gaps move it, bandMovers)
  for (let c = 3; c < W - 2;) { const pw = Math.min(W - 2 - c, R.pick([1, 2, 2, 3, 4]));
    if (g > 1) { G.box(c, c + pw - 1, 0, g - 1); G.put(c, g - 1, "^"); }
    if (g + gh < H) { G.box(c, c + pw - 1, g + gh, H - 1); G.put(c + pw - 1, g + gh, "v"); }
    if (c + pw + 2 < W - 2 && g > 2 && chance(0.3, 0.6)) G.put(c + pw + 2, 1, "^");
    // the next gap: toward the other half of the band, but a ufo climbs only so fast, so far gaps get more room between
    let g2 = next(g); if (H > 10) g2 = clamp(g2, g - 5, g + 5);
    // a band mover in this gap (the ufo can't go round it: the poles hold it) set between this gap and the next
    if (H > 10) { const t = (g + gh / 2 + g2 + gh / 2) / 2; if (Math.abs(t - bc) >= 2) { const r = clamp(Math.round(t), g, g + gh - 1);
      G.put(c + Math.floor((pw - 1) / 2), r, "U"); bc = Math.max(0, Math.floor((r * 30 + 15 - 150) / 30)) + 5; } }
    const far = Math.abs(g2 - g);
    c += pw + len(room(6, 4), room(7, 5)) + Math.max(0, far - imix(3, 4)); g = g2; }
  return { map: G.rows(), mode: "ufo" }; };

// BALL (v2, rebuilt 2026-11-27 after Evgeni: "the generator is bad, i compare the cps, the variaty, height changes, blocks
// in the middle"; measured against his drawing by tools/sectionstats.js). How his ball corridor works: the ball rolls on a
// SURFACE, flips, flies across to the next surface on the other side, and so on; every surface is either a mass (a floor
// mass up from the ground, a ceiling mass down from the top) or a PIECE FLOATING IN THE MIDDLE, landed on from above or from
// below; spike pits under everything, hanging spikes and spikes at surface ends. Built by construction, not by the solver:
// each surface starts where a flip in the last `win` columns of the one before lands (the ball's travel time across the
// height difference), so the flip window is the overlap; early flips fly into open space, late ones roll off into a pit.
// Varies: surface width, kind (mass / middle piece), height step (big and small), a hazard at a surface's end.
CONCEPT.ball = "flip from surface to surface on the other side: floor and ceiling masses and pieces floating in the middle, at big and small height steps, over saw pits";
const BALL_G = 1670;   // ball gravity, units/s^2 (Clutterfunk recording: 0.464 units/frame^2 at 60 fps)
// columns the ball flies to cross `rows` after a tap, stepped tick by tick as lib/physics.js does: the tap sets 3.354
// towards the new side (jump speed, halved by the flip, x 0.6), then 0.6 x 0.958 gravity, fall capped at 15
// (the old closed form sqrt(2h/g) left out the 3.354 and was ~30% long on a 3-row cross)
const ballTravel = (rows, v0 = 3.354) => { let y = 0, vy = v0, n = 0; const h = Math.max(0.5, rows) * 30;
  while (y < h && n < 2000) { vy = Math.min(15, vy + 0.958199 * 0.6 * 0.225); y += vy * 0.225; n++; } return n * CUBE.X / 30; };
GEN.ball = o => rollers(o, { mode: "ball", band: 8, travel: ballTravel });
// the ball's body, shared with the spider (a 9-row band, and it crosses instantly: the spider teleports to the other side)
// and with "ball portals" (some flips made by a gravity portal at the surface's end instead of a click)
function rollers(o, { mode, band, travel, portals = 0, overlap = null }) { const { R, mix, imix, chance, W, H, G, style, onBeat, entry } = ctx(o, 10), BT = Math.min(H, band);   // the band: rows 0..band-1
  const rollBase = R.pick([R.int(2, 3), R.int(imix(4, 3), imix(6, 5)), R.int(imix(4, 3), imix(6, 5))]);   // the ball's roll between presses for this generation
  const win = mix(2.6, 1.4), late = win / 2, early = win / 2;   // flip window, columns: half of it after the planned press, half before
  // THE ENTRY (Evgeni 2026-11-28, random): the row it comes in at (a mass from the ground), and the band the mode portal
  // in the join's last column sets from there (lib/physics.js: floor = the portal's y - half the band, so 3 rows under the
  // entry for the ball and the spider): taller maps any height, short ones 2-3 (the band stays at the ground)
  const tall = H > BT + 2, aE = entry(2, tall ? H - BT + 2 : 3), O0 = clamp(aE - 3, 0, Math.max(0, H - 1 - BT));
  const S = [{ side: 1, kind: "mass", y: aE - O0, c0: 0, c1: R.int(5, 7), O: O0 }]; if (travel === ballTravel) { S[0].press = onBeat(S[0].c1 - late, 3); S[0].c1 = Math.max(S[0].c1, Math.ceil(S[0].press + late)); } else S[0].press = S[0].c1 - late;   // y: the surface's row (floor side: the row the ball rolls on; ceiling side: the row it hangs in), in its band (O = the band's floor row)
  // TALLER THAN THE BAND (Evgeni 2026-11-27: "spider and ball still dont generate more than the original height regardless
  // if i am in height x100"): a hidden portal of the mode on a surface (L ball, P spider: the roller runs through it, so it
  // can't be skipped) re-bands around it (lib/physics.js: floor = its y - band/2), so the band wanders up and down the map;
  // the next surfaces are built in the new band. The ground spikes and the ceiling bar follow the band.
  const moverCh = mode === "spider" ? "P" : "L", CL = climber(o.seed, H, BT, tall); let O = O0, dr = 0;
  while (S[S.length - 1].c1 < W) {
    { const p = S[S.length - 1];
      if (tall && S.length > 1 && p.c1 - p.c0 >= 4 && p.c1 < W - 4 && (R.chance(0.6) || dr)) {
        const abs = p.y + O, O2 = clamp(abs - Math.floor(BT / 2), 0, H - 1 - BT), rel = abs - O2;
        const ok = p.side > 0 ? rel >= 0 && rel <= BT - 4 : rel >= 3 && rel <= BT - 1;
        if (ok && O2 !== O && (!dr || Math.sign(O2 - O) === dr)) { p.mover = { c: Math.min(p.c1 - 1, p.c0 + Math.ceil(win) + 1), O: O2 }; p.y = rel; O = O2; } } }
    dr = CL.drift(O);
    // moves of 2-4 rows, under half the band on average (Evgeni 2026-11-27: "in the jumping modes, that the average length
    // of movement is below the half of the full length, just to have less updown from ground to floor"), and the play
    // height wandering over the whole band both ways ("the height of the gameplay is too similar ... more balanced across
    // the y axis, in both directions"): pieces in the middle, a floor or ceiling mass only at the band's edges
    const p = S[S.length - 1], side = -p.side, step = CL.step(side, R.int(2, o.maxStep ?? 4), dr);
    // a floor-side surface sits low enough to flip up from (row <= BT - 4), a ceiling-side one high enough to drop from
    // and now and then the very edges (Evgeni 2026-11-27: "all our sections should involve the ground/floor at some of the
    // play. even those fully blocked (ball / spider...)"): a stretch rolled on the ground itself (row 0, its spikes taken
    // away there) or under the ceiling bar (row BT - 1)
    const edge = R.chance(0.3) || (dr && (side < 0) === (dr > 0));   // climbing: the flip toward the target may reach the band's edge, so the next band portal moves it 3 rows
    const y = side < 0 ? clamp(p.y + step, Math.max(3, p.y + 2), edge ? BT - 1 : BT - 2) : clamp(p.y - step, edge ? 0 : 1, Math.min(BT - 4, p.y - 2));
    const kind = side < 0 ? (y >= BT - 2 ? "mass" : "mid") : (y <= 1 ? "mass" : "mid");
    // a portal flip happens exactly at the surface's end (no window to leave); travel 0 = the spider's instant crossing
    const byPortal = portals && p.c1 + 2 < W && R.chance(portals);
    // PRESSES FIRST (Evgeni 2026-11-27: "our generating solves by design and we just patch the timings"): every surface
    // carries its planned press (p.press, a column); the next surface starts where a press `early` columns before it lands
    // (the sim's arc, ballTravel) and runs past where the latest press lands; the next press comes after a roll on it, its
    // gap to this press snapped to the song's half beats when there is a beat
    let d = Math.abs(p.y - y), flip = p.c1 - (p.end ? 1 : 0), roll = R.pick([R.int(2, 3), R.int(imix(4, 3), imix(6, 5)), R.int(imix(4, 3), imix(6, 5)), R.int(imix(9, 7), imix(12, 9))]);   // short, medium, long: his rests vary a lot (CV ~1)
    // the ball (presses first): the generation's own roll, +-1 column, a long rest one surface in 7 (Evgeni: one click style per generation)
    if (travel === ballTravel) roll = R.chance(0.14) ? R.int(imix(9, 7), imix(12, 9)) : rollBase + R.int(-1, 1);
    if (travel === ballTravel) roll = Math.max(2, Math.round(roll / style.pace(p.c1)));   // the generation's click style
    const tv = travel === ballTravel && byPortal ? ballTravel(d, 0) : travel(d), pr = p.press ?? flip - win / 2;   // a portal flips the ball from rest
    let c0 = travel === ballTravel && !byPortal ? Math.floor(pr - early + tv) : Math.round(flip + tv - (byPortal ? 0 : tv ? win : -1));
    c0 = Math.max(p.c0 + 2, c0);
    let nextPress = (byPortal ? p.c1 + 1 : pr) + tv + roll;
    if (travel === ballTravel) nextPress = onBeat(nextPress, (byPortal ? p.c1 + 1 : pr) + tv + 2);   // on a beat, after the landing and a roll of 2
    const w = travel !== ballTravel ? roll : Math.max(Math.ceil(nextPress + late) - c0, Math.ceil((byPortal ? p.c1 + 1 : flip) + tv) + 1 - c0, 2);   // the spider: its overlap is the window, width as drawn
    // a portal is the way past an obstacle (Evgeni: "a portals just flip you arround instead of being a way to pass an
    // obsicle like in the layout i drew"): the surface goes on 4 columns past it with spikes on it, so a player who doesn't
    // flip there runs into them; the flip is the portal's, and the clicks stay on the other transitions
    if (byPortal) { p.end = false; p.portal = p.c1 + 1; p.c1 += 4; }
    // the spider: the next piece overlaps this one by `overlap` columns, and that overlap is the click's window
    const c0b = overlap && !byPortal ? Math.max(p.c0 + 2, flip + 1 - overlap()) : c0;
    const nw = { O, side, kind, y, c0: c0b, c1: c0b + w, thick: kind === "mid" ? (R.chance(0.7) ? 1 : 2) : 0, end: chance(0.25, 0.5) };
    if (travel === ballTravel) { nw.press = +nextPress.toFixed(2); if (nw.end) nw.c1++; }   // the end spike sits past the latest press
    S.push(nw);
  }
  // draw: ground spikes and a row of hanging spikes along the top (the ball band's ceiling holds the ball otherwise, so
  // an early flip must die there, not ride the band edge), then each surface
  // no walls of spikes and no floating spikes (Evgeni 2026-11-27 on 🎲 ball: "just blocking like that with a wall of spike
  // is rough, lets place proper hazards, spikes not on the ground is bad"): saws along the pits and under the band's
  // ceiling, a saw every 2 columns (their round edge covers the gap), short spike groups only on blocks
  // and then (Evgeni, on 🎲 ball seed 52432: "still the blockers of spikes not on correct height, either spikes are on the
  // ground (or top), or there are hazards (on both sides)"): spikes stand on the ground, and hang from a ceiling bar laid at
  // the band's top (row BT), in groups of 2-3 with a column between (a ball that lands in the gap rolls into the next
  // group), a saw now and then in place of a group
  // the band's floor row per column (it moves at each mover)
  const Oc = Array(W).fill(0); { let o = S[0].O, i = 0; const ms = S.filter(t => t.mover).map(t => t.mover);
    for (let c = 0; c < W; c++) { while (i < ms.length && ms[i].c <= c) o = ms[i++].O; Oc[c] = o; } }
  // tall: the map outside the band is solid (2026-11-27: a player who skipped a band portal stayed in the old band and
  // rolled the open ground under the raised one, 2 presses for a 17-press plan); default height: the bar and one row
  for (let c = 0; c < W; c++) { if (Oc[c] + BT < H) G.box(c, c, Oc[c] + BT, tall ? H - 1 : Oc[c] + BT); if (Oc[c] > 0) G.box(c, c, tall ? 0 : Oc[c] - 1, Oc[c] - 1); }
  for (const [d, t] of [[0, "^"], [BT - 1, "v"]]) for (let c = 0; c < W;) {
    if (R.chance(0.2)) { G.put(c, Oc[c] + d, "o"); c += 2; continue; }
    // the column between two groups holds a half-buried saw (2026-11-28, tools/secretways.js: a spider landed in that
    // gap on the bare ground and tapped up from it, 5 presses for a 9-press plan; a ball can flip off it the same way)
    const n = R.int(2, 3); for (let k = 0; k < n && c + k < W; k++) G.put(c + k, Oc[c + k] + d, t);
    if (c + n < W) G.put(c + n, Oc[c + n] + d, "o"); c += n + 1; }
  for (const s of S) { const c1 = Math.min(W - 1, s.c1), y = s.y + (s.mover ? s.mover.O : s.O);   // its row on the map
    // a surface on the band's edge rolls where the edge hazards are: clear them under it, by its row on the map against
    // each column's band (a surface with a mover spans two bands; its s.y is in the new one)
    for (let c = s.c0; c <= c1; c++) { if (s.side > 0 && y === Oc[c]) G.put(c, Oc[c], "."); if (s.side < 0 && y === Oc[c] + BT - 1) G.put(c, Oc[c] + BT - 1, "."); }
    // a saw in the two columns before a surface at the edges reaches the ball flying onto its first column: cleared
    if (s.side > 0 ? y - Oc[Math.max(0, s.c0 - 1)] <= 1 : y - Oc[Math.max(0, s.c0 - 1)] >= BT - 2) for (let c = Math.max(0, s.c0 - 2); c < s.c0; c++) for (const d of [0, BT - 1])
      if (G.rows()[H - 1 - (Oc[c] + d)][c] === "o") G.put(c, Oc[c] + d, ".");
    // and the two columns past a surface at the edges stay clear: a saw there reaches the player rolling off its end
    if (s.side > 0 ? y - Oc[c1] <= 1 : y - Oc[c1] >= BT - 2) for (let c = c1 + 1; c <= Math.min(W - 1, c1 + 2); c++) for (const d of [0, BT - 1])
      G.put(c, Oc[c] + d, ".");
    s.y = y;
    if (s.side > 0) { if (s.kind === "mass") G.box(s.c0, c1, 0, s.y - 1); else G.box(s.c0, c1, s.y - s.thick, s.y - 1);
      if (s.end && s.c1 < W) G.put(c1, s.y, "^"); }
    else { if (s.kind === "mass") G.box(s.c0, c1, s.y + 1, H - 1); else { G.box(s.c0, c1, s.y + 1, s.y + s.thick); if (chance(0.3, 0.6)) G.put(s.c0 + 1, s.y + s.thick + 1, "^"); }
      if (s.end && s.c1 < W) G.put(c1, s.y, "v"); }
    // the portal stands one column past the surface's end at the player's height: G sends a floor roller up, N brings a
    // ceiling roller down (the hazards under / over it cleared so the player meets the portal, not a spike)
    if (s.mover) { for (let r = s.y - 1; r <= s.y + 1; r++) if (r >= 0 && r < H && G.rows()[H - 1 - r][s.mover.c] !== "#") G.put(s.mover.c, r, "."); G.put(s.mover.c, s.y, moverCh); }
    if (s.portal && s.portal < W) { const c = s.portal, row = s.y; for (let r = Math.max(0, row - 1); r <= Math.min(H - 1, row + 1); r++) if (G.rows()[H - 1 - r][c] !== "#") G.put(c, r, ".");
      G.put(c, row, s.side > 0 ? "G" : "N");
      // two columns on, not one: the portal flips the ball from rest, and a spike right after it still reaches the ball
      // that took the portal (planCheck, 2026-11-27: 6 of 6 plans died there)
      for (const x of [c + 2, c + 3]) if (x < W) G.put(x, row, s.side > 0 ? "^" : "v"); } }
  // the planned presses (ball only): each surface's own, but not where a gravity portal makes the flip
  const presses = travel === ballTravel ? S.filter((t, i) => i < S.length - 1 && t.press != null && !t.portal && t.press < W - 1).map(t => t.press) : undefined;
  return presses ? { map: G.rows(), mode, presses } : { map: G.rows(), mode }; }

// STAIR PATH (cube, his "strairpath", my-mwz1637w). Idea: a lattice of single blocks a column every 3; many ways in theory,
// every wrong one closed by a hazard. Motif: the next column's way block a hop up. His drawing and notes: a reverse and a
// normal portal ("still no reverse portals on generation"), a bit taller, saws instead of spikes in the middle, no long
// runs at one height ("sometimes we have too many in a row of the same height"). So the way CLIMBS (a hop of +1, +2 at
// the hard end) to near the top, a G there flips the player onto the blocks' undersides, the way climbs again (mirrored:
// towards the ground), an N near the bottom flips back; repeat. A cube can't step DOWN a lattice (a jump hits the block
// above, a walk-off falls short of the next column), which is why the flat runs came: the flips are the way down.
// Harder: lower turn points (more flips per length), more +2 hops, saws everywhere.
CONCEPT["my-mwz1637w"] = "a lattice of single blocks 3 apart; the way climbs, a gravity portal flips play onto the undersides and it climbs back down, then flips back; wrong blocks carry hazards";
// The turn (Evgeni: "still no reverse portals on generation" -- the pair is part of the stair path): the top step is a
// 2-wide block, the gravity portal stands right after it at the player's height, and the next step hangs 3 rows up so the
// flipped cube meets its underside a block later; the way back down mirrors it with the normal portal.
function stairPath(o) { const { R, mix, imix, chance, W, H, G, onBeat, entry } = ctx(o, 13), ways = [{ c: 0, e: 3, h: 1, up: false }], DU = o.du ?? 5, top = H - 2 - DU, low = DU + 1;
  // THE FIRST JUMP IS FROM THE PLATFORM (Evgeni 2026-11-28, GDLM 78: "in the stairpath first jump, there is an akward
  // whole, the first jump should be from the platform"): the entry platform is 4 wide (cols 0-3, no 1-column hole after
  // it that the cube rolled over onto a first block at its own height), and the first way column is a real hop from its end
  G.box(0, 3, 0, 1); for (let c = 5; c < W - 3; c += 2) G.put(c, 0, "o");   // saws in the pit, not a spike wall
  let h = 1, up = false, k = 0, run = 0, turn = false, turnHi = R.int(Math.max(2, top - imix(0, 2)), top), turnLo = R.int(low, low + imix(0, 2));
  const lastC = 4 + 3 * Math.floor((W - 7 - 4) / 3);
  // a tall map in a short section: turn lower, so at least one flip and back fits (about half the columns for the climb)
  turnHi = Math.max(2, Math.min(turnHi, 1 + Math.round((lastC - 4) / 3 * 0.5)));
  // it comes in at a random height, below the first turn so a climb still comes first
  { const h0 = entry(1, Math.max(1, turnHi - 2)); h = h0; ways[0].h = h0; G.box(0, 3, 0, h0); }
  // runs of jumps: about 3 at most, softly (Evgeni 2026-11-27: "stairpath has still like 9 jumps in a row sometimes. max 3
  // jumps in a row", "when i say max, i mean distribute so that anything more much lower chances ... dont want to set hard
  // limits"): after n hops a REST comes with chance 0 / 0 / 0.25 / 0.6 / 0.85 (n = 0..4+): the way block is 3 wide and
  // the next column comes 5 on, not 3 (a run, then the same jump), so the rhythm breaks
  let hops = 0, step = 3, lastWay = lastC;
  // where the cube lands on each way block (ell: its centre's column from the block's own, -0.5 .. 1.5 is on it) and the
  // spacing that hop needs: a 1-wide block 3 on is in reach only if the press can come early enough (Evgeni chose to keep
  // the lattice 3 apart: a column goes 1-2 further only where the cube can't land on it otherwise, e.g. after a +2 or on a
  // -1). Air time of a hop by its height change (columns, GD's arc at 1x, +0.2 for the landing tick):
  const AIR = { "-2": 5.32, "-1": 4.93, "0": 4.46, "1": 3.85, "2": 2.81 }; let prevC = 3, prevW = 2;
  // PD: the press comes at least this long after the landing (columns; 0.25 = 6 ticks; by tier, 0.4 easy to 0.2 harder), so every hop has a window to press
  // in and the plan has room for the real game's landing tick (the page lands within ~2 ticks of the sim)
  const PD = o.pd ?? mix(0.4, 0.2);   // easy waits longer: a wider window
  let ell = -PD;   // on the platform the cube can press anywhere: the plan presses at its last column
  for (let c = 6; c <= lastC + 2; c += step, k++) { step = 3;
    {
      if (turn) { turn = false; h = up ? Math.min(H - 2, h + DU) : Math.max(1, h - DU); ell = (ways[ways.length - 1].e - prevC) + (o.gOff ?? 1) - 0.41 + 2.9 - (c - prevC); }
      else { // a hop toward the turn: +1 at most 3 times running (measured: a 4th +1 from a 1-wide block lands past the
        // next one), +2 or a step back -1 between, never a flat run
        let hop = run >= 3 || chance(0.15, 0.4) ? (R.chance(0.6) ? 2 : -1) : 1;
        if (hop === -1 && (up ? h + 1 > H - 2 : h - 1 < 1)) hop = 2;
        run = hop === 1 ? run + 1 : 0;
        const h0 = h; h = up ? Math.max(turnLo, h - hop) : Math.min(turnHi, h + hop);
        const L = (AIR[String(clamp(Math.abs(h - h0) * Math.sign(up ? h0 - h : h - h0), -2, 2))] ?? 4.46) + 0.2;
        while (ell + PD + L - (c - prevC) > 1.3) c++;   // out of reach 3 on: the column goes on until a press PD after the landing lands on it
        ell = Math.max(-0.3, ell + PD + L - (c - prevC)); } }
    if (c > lastC + 2) break;
    lastWay = c;
    const mid = c > W / 4 && c < 3 * W / 4, way = { c, e: c, h, up }; ways.push(way); prevC = c; prevW = 0;
    // the lattice; the block right over the way block is left out (head room: a jump from a 1-wide block hits it), the
    // others carry a hazard on the face the player would land on
    for (let r = (h % 3) || 3; r < H - 1; r += 3) { if (r === (up ? h - 3 : h + 3)) continue; G.put(c, r, "#"); if (r === h || o.clean) continue;
      const face = up ? r - 1 : r + 1; if (face <= 0 || face >= H - 1) continue;
      G.put(c, face, mid || chance(0.3, 0.7) ? (R.chance(0.6) ? "s" : "q") : (up ? "v" : "^")); }
    // the last chance to turn back to normal gravity is forced, so the run ends on its feet
    let turned = false;
    if ((up && (h <= turnLo || c >= lastC - 5)) || (!up && h >= turnHi && c <= lastC - 6)) { turned = true; hops = 0; way.turn = true;
      // the cube must be on its feet on the block when it meets the portal: if it lands there late (ell), the block is 2
      // wide and the portal and the next column come a column later
      const wideT = o.wide || ell > 0.4; if (wideT) { way.e = c + 1; G.put(c + 1, h, "#"); if (!o.wide) step = 4; }
      G.put(way.e + (o.gOff ?? 1), up ? h - 1 : h + 1, up ? "N" : "G"); turn = true; up = !up; run = o.turnRun ?? 2;
      if (up) turnLo = R.int(low, Math.min(h + DU - 1, low + imix(0, 2))); else turnHi = R.int(Math.max(h - DU + 1, top - imix(0, 2)), top); }
    if (!turned && !turn && k > 0 && c + 5 <= lastC - 6 && R.chance([0, 0, 0.25, 0.6, 0.85][Math.min(4, hops)])) {
      G.put(c + 1, h, "#"); G.put(c + 2, h, "#"); way.e = c + 2; step = 5; hops = 0; prevW = 2; }
    else if (!turned) hops++; }
  G.box(Math.min(W - 3, lastWay + 5), W - 1, 0, 1);   // the end platform, 5 on from the last way column (rests shift it)
  ways.push({ c: Math.min(W - 3, lastWay + 5), e: W + 6, h: 1, up: false });
  return { map: G.rows(), mode: "cube", presses: latticePresses(G.rows(), ways, W, H, onBeat, o.gOff ?? 1) }; }
// a lattice whose presses can't all be planned (rare: 1 in ~12 at 200 columns) is drawn again with a shorter wait, then
// with the next seeds
GEN["my-mwz1637w"] = o => { let z; for (let k = 0; k < 6; k++) { const pd = o.pd ?? (k === 1 ? 0.2 : undefined);
    z = stairPath(Object.assign({}, o, { pd, seed: (o.seed ?? 1) + (k < 2 ? 0 : 1000 * k) })); if (z.presses) return z; }
  return z; };
// THE STAIR PATH'S PRESSES (Evgeni 2026-11-27, on how its jumps should follow the beat: "B, but if possible somewhere close
// to the beats"): the lattice stays 3 apart and its presses are planned from it, one hop at a time in the page's cube run
// (cubeTry): the cube is on way block A from where the last hop landed, the run from there to the next way block B with
// every other block and hazard near them as a hazard box (upside down: the stretch mirrored); the press's window is every
// tick that lands it on B, and the press goes on the beat in there (a sixth of a column in from either end), else its
// middle. A gravity portal turn needs no press: it flips the cube onto the next block's underside (its landing found by
// cubeFall over the rows between).
function latticePresses(map, ways, W, H, onBeat, gOff) { const cell = (c, r) => c < 0 || c >= W || r < 0 || r >= H ? "." : map[H - 1 - r][c];
  const dt = CUBE.X / 30, N = W + 12;
  // each hop's stretch, once: floor tops of A and B (local rows), the other blocks and hazards near them as boxes
  const hop = ways.slice(0, -1).map((A, i) => { const B = ways[i + 1]; if (A.turn) return { A, B };
    const lr = r => A.up ? H - 1 - r : r, T = Array(N).fill(-9), haz = [], c0 = Math.max(0, A.c - 1), c1 = Math.min(W - 1, B.e + 1);
    for (let c = A.c; c <= Math.min(A.e, N - 1); c++) T[c] = lr(A.h) + 1; for (let c = B.c; c <= Math.min(B.e, N - 1); c++) T[c] = lr(B.h) + 1;
    for (let c = c0; c <= c1; c++) for (let r = 0; r < H; r++) { const ch = cell(c, r), q = lr(r);
      if (ch === "#" && !((c >= A.c && c <= A.e && r === A.h) || (c >= B.c && c <= B.e && r === B.h) || (B.e > W && r <= 1))) haz.push({ x0: c * 30, x1: c * 30 + 30, y0: q * 30, y1: q * 30 + 30 });
      else if ("^v".includes(ch)) haz.push(spikeBox(c, q)); else if ("sqo".includes(ch)) { const dy = ch === "s" ? -8 : -15;   // as tools/designthemes.js sampleOf: o 1706 r 21.6, q / s 1707 r 12
        haz.push({ cx: c * 30 + 15, cy: q * 30 + 15 + (A.up ? -dy : dy), r: ch === "o" ? 21.6 : 12 }); } }
    return { A, B, T, haz, same: lr(B.h) === lr(A.h), end: Math.min(B.e + 1.45, W - 0.5) }; });
  // a search over the hops: at each, the presses that land on B, the beat in the window first (a sixth of a column in
  // from its ends), then from its middle outwards; a landing that leaves the next hop no press is undone (a 1-wide
  // block leaves little time, so where the cube lands decides the next window)
  const seen = new Set(); let budget = 4000 + 200 * ways.length;
  // sn: GD's jump snap state (cubeTry): the cube's x runs ahead of the press times by sn.off units, so a press is a time
  const at = (B, l, T) => { const c = Math.max(B.c, Math.min(B.e, Math.floor(l))); return { c, top: T ? T[c] : 0 }; };
  const go = (i, land, sn) => { if (i >= hop.length) return []; if (budget-- <= 0) return null;
    const key = i + ":" + Math.round(land * 20) + ":" + Math.round(sn.off * 2); if (seen.has(key)) return null; seen.add(key);
    const { A, B, T, haz, same, end } = hop[i];
    if (A.turn) { const g = A.e + gOff; if (land > g - 0.95) return null;   // it must be on its feet on A when it meets the portal
      // (the real sim, 2026-11-27: the flip at the portal's column - 0.41, the landing ~0.12 columns after the page's fall)
      const f0 = cubeFall((g - 0.41) * 30, (Math.abs(B.h - A.h) - 2) * 30, 0), f = f0 == null ? null : f0 + 0.12;
      return f != null && f >= B.c - 0.5 && f <= B.e + 1.4 ? go(i + 1, f, { ref: at(B, f), d: 0, off: sn.off }) : null; }
    const s0 = { ref: sn.ref && sn.ref.c >= A.c && sn.ref.c <= A.e ? { c: sn.ref.c, top: T[sn.ref.c] } : at(A, land, T), d: sn.d, off: sn.off }, o30 = sn.off / 30;
    // a gap of one column at the same height is walked over (the cube's box touches B before it falls): no press
    if (same && B.c - A.e <= 2 && cubeTry(T, haz, land, null, Math.min(B.c + 0.6, W - 0.5), s0).ok) { const r = go(i + 1, B.c - 0.45, { ref: at(B, B.c), d: 0, off: sn.off }); if (r) return r; }
    // the end platform (B runs past the section): the jump, or a walk off A, may come down past the section's last column
    if (B.e > W) { const wk = cubeTry(T, haz, land, null, B.c + 8, s0); if (wk.ok) return [];
      for (let x = land - o30 + 0.1; x < A.e + 1.5 - o30; x += dt) { const r = cubeTry(T, haz, land, x, B.c + 8, s0); if (r.ok && r.land != null && r.land >= B.c - 0.6) return [+x.toFixed(4)]; } return null; }
    const ok = []; for (let x = land - o30 + 0.1; x < A.e + 1.5 - o30; x += dt) { const r = cubeTry(T, haz, land, x, end, s0); if (r.ok && r.land != null && r.land >= B.c - 0.4 && r.land <= B.e + 1.3) ok.push([x, r.land, r.sn]); }
    if (!ok.length) return null;
    // the order tried: the beat in the window (a sixth of a column in from its ends), then the earliest landings first (a
    // chain of 1-wide blocks runs out of room when it lands late), the window's middle as the last resort
    const x0 = ok[0][0], x1 = ok[ok.length - 1][0], mid = (x0 + x1) / 2, bc = onBeat(mid, x0 + 0.16), hasB = bc >= x0 + 0.16 && bc <= x1 - 0.16;
    const near = w => ok.reduce((a, b) => Math.abs(b[0] - w) < Math.abs(a[0] - w) ? b : a);
    // near the beat even when it is outside the window (Evgeni: "if possible somewhere close to the beats"): the press
    // nearest the beat comes first, then the earliest landings
    const bn = onBeat(mid, x0 - 1), byB = near(hasB ? bc : bn);
    const order = [byB, ...ok.slice().sort((a, b) => a[1] - b[1]), near(mid)], tried = [];
    for (const [x, l, s1] of order) { if (tried.some(t => Math.abs(t - l) < 0.08)) continue; tried.push(l); if (tried.length > 6) break;
      const r = go(i + 1, l, s1); if (r) return [+x.toFixed(4), ...r]; }
    return null; };
  return go(0, 0.5, { ref: null, d: 0, off: 0 }) || undefined; }

// SWING (his, my-mwz1890c). Idea: round movement, a big up-and-down corridor whose sides are curves of saws, not blocks.
// Motif: one wave of the path. Varies: amplitude, period, the corridor's width. Harder: tighter waves, a narrower corridor.
CONCEPT["my-mwz1890c"] = "a sine-shaped corridor drawn by two chains of saws; amplitude, period and width change wave to wave";
// Evgeni 2026-11-27 on a generated one: "swing should swing more, like double the height possible", and on his drawing
// "exntend the pattern a bit longer", then "swing still not high enough". GD bounds a swing to a 10-block band (lib/physics.js
// BAND: 300 units, set by the portal), so the height comes from filling the band: the corridor's middle swings from one band
// edge to the other (the edge is the far wall at a peak), saw chains on the open side only, longer waves.
// SWING, CLICKS FIRST (Evgeni 2026-11-28 on GDLM 78: "the swing is way too hard, too tight, way much higher cps needed",
// "many wierd dual portals, that dont do much besides confusing", and "all generations should be somewhat based on
// clicks"). The flips come first: a flip at most every `gMax` and at least every `gMin` (by tier: easy 0.46-0.92 s apart,
// harder 0.29-0.58 s; the generation's click style stretches them), steered loosely toward height targets that tour the
// band (tour()), each one on a beat when there is one; the swing is stepped tick by tick as lib/physics.js does (a press
// flips gravity the tick after, keeping 80% of the speed; gravity 0.4 x 0.958; |vy| <= 8). One band, no movers: the map is
// the 10 rows the entry portal's band gives. Then the corridor is drawn around that path: a saw every column, under the
// path's lowest point near the column and over its highest by the saw's reach plus a margin, at least `gap` rows apart,
// smoothed to a row a column (only ever widened); a curtain every 8 columns closes the room under and over the corridor.
const SWING = { g: 0.958199 * 0.4, DTS: 0.225, MAX: 8 };
function swingPlan(o, C) { const { R, mix, room, W, G, style, onBeat, entry } = C, TPC = 30 / CUBE.X, T = Math.floor(W * TPC);
  const e = entry(0, 3), bandLo = Math.max(0, Math.floor(((e + 1) * 30 + 15 - 150) / 30)), H = bandLo + 10;
  const gMin = mix(110, 70), gMax = mix(220, 140), gap = o.gap ?? room(6, 5), m = 7, RK = 15 + 21.6;
  const next = tour(R, bandLo + 2, H - 3); let tgt = next(e + 3);
  const st = { y: e * 30 + 15, vy: 0, grav: 1, pend: false }, ys = [], taps = []; let last = -1e9, want = null;
  const lo = bandLo * 30 + 15, hi = H * 30 - 15;
  for (let t = 0; t < T; t++) { const c = t / TPC, row = (st.y - 15) / 30, since = t - last, k = 1 / style.pace(c);
    if (want == null && c > 1.5 && c < W - 3) { const up = st.grav === -1;
      if ((since >= gMin * k && (up ? row > tgt : row < tgt)) || since >= gMax * k || (since >= gMin * k * 0.5 && (up ? st.y > hi - 40 : st.y < lo + 40))) {
        want = Math.round(onBeat(c, c) * TPC); } }   // the next beat (no beats: now)
    let press = false; if (want != null && t >= want) { press = true; want = null; last = t; taps.push(+c.toFixed(4)); if (Math.abs(tgt - row) < 1.5 || R.chance(0.3)) tgt = next(Math.round(row)); }
    if (st.pend) { st.pend = false; st.grav = -st.grav; st.vy *= 0.8; } if (press) st.pend = true;
    st.vy = clamp(Math.round((st.vy - SWING.g * SWING.DTS * st.grav) * 1000) / 1000, -SWING.MAX, SWING.MAX); st.y += st.vy * SWING.DTS;
    const fl = c < 2 ? e * 30 + 15 : lo; if (st.y < fl) { st.y = fl; st.vy = 0; } if (st.y > hi) { st.y = hi; st.vy = 0; }
    ys.push(st.y); }
  // the corridor around the path: per column, the lowest and highest centre within the saw's reach of its centre
  const loR = [], hiR = []; for (let c = 0; c < W; c++) { let a = 1e9, b = -1e9; const cx = c * 30 + 15;
    for (let t = Math.max(0, Math.floor((cx - RK - 15) / 30 * TPC)); t < Math.min(T, Math.ceil((cx + RK + 15) / 30 * TPC)); t++) { a = Math.min(a, ys[t]); b = Math.max(b, ys[t]); }
    if (a > b) { a = b = ys[Math.min(T - 1, Math.round(c * TPC))]; }
    let l = Math.floor((a - RK - m) / 30), h = Math.ceil((b + RK + m) / 30); while (h - l - 1 < gap) { if (l > bandLo - 1) l--; else h++; if (h - l - 1 < gap && h < H) h++; }
    loR.push(l); hiR.push(h); }
  for (let it = 0; it < 3; it++) for (let c = 1; c < W; c++) { loR[c] = Math.min(loR[c], loR[c - 1] + 1); loR[c - 1] = Math.min(loR[c - 1], loR[c] + 1); hiR[c] = Math.max(hiR[c], hiR[c - 1] - 1); hiR[c - 1] = Math.max(hiR[c - 1], hiR[c] - 1); }
  G.box(0, 1, 0, e - 1);   // the entry floor (the join ramps to it)
  for (let c = 0; c < W; c++) { const ch = c % 2 ? "q" : "o", l = loR[c], h = hiR[c];
    if (c >= 2 && l >= bandLo) G.put(c, l, ch); if (h < H) G.put(c, h, ch);
    if (c >= 12 && c < W - 2 && c % 8 === 0) { for (let r = l - 1; r >= bandLo; r--) G.put(c, r, "q"); for (let r = h + 1; r < H; r++) G.put(c, r, "q"); } }
  return { map: G.rows(), mode: "swing", presses: taps, path: ys.filter((_, t) => t % 8 === 0).map((y, i) => [+(i * 8 / TPC).toFixed(2), +(y / 30 - 0.5).toFixed(2)]) }; }
GEN["my-mwz1890c"] = o => { if (o.shape) return swingShape(o);
  for (let k = 0; k < 6; k++) {
    const pre = ctx(Object.assign({ cols: 48 }, o, { seed: (o.seed ?? 1) + 1000 * k }), 10), e = pre.entry(0, 3), H = Math.max(0, Math.floor(((e + 1) * 30 + 15 - 150) / 30)) + 10;
    const z = swingPlan(o, Object.assign({}, pre, { G: LS.grid(pre.W, H) })); if (z && (!o.verify || o.verify(z))) return z; }
  return swingShape(o); };
// the shape-first swing (before 2026-11-28), kept for o.shape and as the last fallback
function swingShape(o) { const { R, imix, room, len, W, H: HH, G } = ctx(Object.assign({ cols: 48 }, o), 20);
  // the tall swell from 24 columns on (was 40: GDLM 78's 36-47 column hard swing fell to the plain sine below, which died on
  // its first descent at 1x and 2x every seed; the swell solves there)
  if (HH >= 16 && W >= 24) return swingTall(o, { R, imix, room, len, W, H: HH, G });
  const H = Math.min(10, HH); let c = 0;
  while (c < W) { const gap = R.int(room(5, 4), room(6, 5)), A = (H - 2) / 2 * (o.amp ?? R.pick([0.8, 1, 1])), mid = H / 2,   // the path's middle reaches the ground and the roof (the walls leave the map there)
      P = len(room(26, 20), room(34, 26));
    for (let x = 0; x < P && c + x < W; x++) { const y = mid + A * Math.sin(2 * Math.PI * x / P), lo = Math.round(y - gap / 2) - 1, hi = Math.round(y + gap / 2), ch = (c + x) % 2 ? "q" : "o";
      if (lo >= 0) G.put(c + x, lo, ch); if (hi < H) G.put(c + x, hi, ch); }
    c += P; }
  return { map: G.rows(), mode: "swing" }; };
// The tall swing (Evgeni: "even taller swing structures, swing can go even higher than screen", then "swing/ship/ufo
// portals in the middle of the gameplay recenter the screen. people put invisible ones to move further in the screens"):
// the corridor rides a slow swell from the bottom of the map to its top and back, the quick swing waves on top of it, and
// an R pair (ship + swing portal, invisible) sets the 10-block band again around the player each time the swell has moved
// 3 rows from the band's middle. In the sim (lib/physics.js) a climb over 20 rows through three pairs solves; in the game
// UNCHECKED (the ship tick between the two portals, and that the pair re-bands like a mode change).
function swingTall(o, { R, imix, room, len, W, H, G }) {
  // INSIDE THE BAND, NO BAND MOVERS (Evgeni on GDLM 78, 2026-11-28: the R pairs show in GD as a pink + yellow portal pair --
  // "many wierd dual portals, that dont do much besides confusing and making the game too hard", "many portals where we dont
  // really need to change the view"; and "the swing is way too hard, too tight, way much higher cps needed"): the corridor
  // stays in the 10-row band the swing portal sets (rows 0-9), 6-7 rows wide, on long gentle waves; both saw chains inside
  // the band, saw curtains every 8 columns from the 16th so it can't be flown under or over (GDLM 78's swing rode the
  // ground under its lower chain); it starts and ends low (whole waves), where the player comes in.
  const BAND = 10, gap = R.int(6, 7), P = len(room(40, 34), room(52, 42)), mid = BAND / 2,
    A = Math.max(0.8, (BAND - gap - 1) / 2), n = Math.max(1, Math.round(W / P)), Pw = W / n,
    Y = x => mid - A * Math.cos(2 * Math.PI * x / Pw);   // starts at its lowest, ends there too
  for (let x = 0; x < W; x++) { const y = Y(x), lo = Math.round(y - gap / 2) - 1, hi = Math.round(y + gap / 2), ch = x % 2 ? "q" : "o";
    if (lo >= 0) G.put(x, lo, ch); if (hi < BAND) G.put(x, hi, ch);
    if (x >= 16 && x < W - 2 && x % 8 === 0) { for (let r = lo - 1; r >= 0; r--) G.put(x, r, "q"); for (let r = hi + 1; r < BAND; r++) G.put(x, r, "q"); } }
  return { map: G.rows(), mode: "swing" }; }

// FLYING ON THE GROUNDS (ship, his my-mwz1s7po). Idea: a narrow corridor between two thin bars: "you need to either fully
// hold or release on the obsicles, and the corridor may change height". Motif: a flat run with obstacle runs on the floor
// (hold: ride the ceiling) or the ceiling (release: ride the floor), then a 45-degree climb or drop of both bars. Varies:
// run length, which side, the height step. Closed above and below (bars), so the ship can't go round it.
CONCEPT["my-mwz1s7po"] = "a narrow corridor of two thin bars; obstacle runs on the floor (hold) or the ceiling (release); the bars climb and drop together";
// PRESSES FIRST (2026-11-27): the corridor is the room; the gameplay is the side ridden, so the plan is the side switches
// (a hold rides the roof, a release the floor; each ride's length from the tier and the click style, each switch on a
// beat when there is one); the ship is stepped through the corridor (its floor and roof are surfaces it slides on, slopes
// included), and the spikes go on the side NOT ridden, only where the planned path clears them by 8: so riding the wrong
// side, or switching late, runs into them. Taller than the band: hidden H portals as before (bandMovers).
// NOT REGISTERED YET (2026-11-27): the plan doesn't clear every piece. After riding a sloped roof the real ship stays
// pinned up there ~50 ticks past the release (cmp: plan 120 vs real 124 three columns on, then 20-30 units apart), which
// this stepper doesn't copy, so spikes it thinks are clear are not (4-6 of 6 plans clear). Needs lib/physics.js's ship
// slope contact in shipStep; until then GEN["my-mwz1s7po"] is the shape-first version below, checked by the solver.
const groundsPlan = o => { const C = ctx(Object.assign({ cols: 56 }, o), 10), { R, imix, room, len, W, H, G, mix, style, onBeat } = C, gap = room(5, 3);
  // it comes in on the ground (the player enters a section there), so the corridor starts at the ground too
  const next = tour(R, 0, H - gap);
  const e = line(W, 0, L => { L.run(len(imix(10, 6), imix(12, 8))); L.leg(next(L.h())); });
  const fl = x => { const c = Math.floor(x), f = x - c; return (e(c) + (e(c + 1) - e(c)) * f) * 30; };   // the floor's height at column x
  const TPC = 30 / SHIP.X, T = Math.floor(W * TPC), st = { y: e(0) * 30 + 15, vy: 0 }, ys = [], ev = [], tr = []; let trusted = true;
  // the climbs and drops: riding the floor into a rising slope (or the roof into a falling one) is a crash, so from ~3.5
  // columns before each climb to its end the ship rides the roof (held), and the floor (released) for a drop
  const need = Array(W + 6).fill(0);
  for (let c = 0; c < W; c++) { const d = Math.sign(e(c + 1) - e(c)); if (!d) continue;
    for (let x = Math.max(0, c - 4); x <= c + 1; x++) if (!need[x]) need[x] = d; }
  let held = false, left = Math.round(onBeat(R.int(2, 4), 1.5) * TPC);
  for (let t = 0; t < T; t++) { const c = t / TPC, nd = need[Math.floor(c + 0.5)];
    if (nd && (nd > 0) !== held) left = 0;   // a climb or a drop ahead wants the other side now
    else if (nd && left <= 0) left = 1;      // and holds the side it needs until it is past
    else if (!nd && left > 1) { // a need coming: switch on the last beat before it (its window has ~2 columns to spare)
      let ns = -1; for (let x = Math.floor(c + 1); x < Math.min(W, c + left / TPC + 1); x++) if (need[x] && (need[x] > 0) !== held) { ns = x; break; }
      if (ns >= 0) { const b = onBeat(ns - 0.3, c + 1 / TPC); left = Math.min(left, Math.max(1, Math.round((b <= ns + 1.2 ? b : ns - 0.3) * TPC) - t)); } }
    if (left <= 0) { held = !held; ev.push([+c.toFixed(4), held ? "press" : "release"]);
      const ride = mix(3.5, 1.5) * (held ? style.holdAt(c) : 1) / style.pace(c) * (0.7 + R() * 0.6);
      left = Math.max(30, Math.round(onBeat(c + ride + 2, c + 30 / TPC) * TPC) - t); }   // + the ~2 columns the crossing takes
    shipStep(st, held); left--;
    const f = fl(c + 1 / TPC) + 15, r = fl(c + 1 / TPC) + gap * 30 - 15, cc = Math.floor(c + 1 / TPC), flat = e(cc) === e(cc + 1) && e(cc - 1) === e(cc);
    if (st.y < f || st.y > r) { st.y = clamp(st.y, f, r); st.vy = 0; trusted = flat; }   // touching: on a flat stretch the real ship is here too
    ys.push(st.y); tr.push(trusted); }
  // a column is trusted when, at every tick in it, the ship's last surface contact was on a flat stretch (after it rides
  // a slope the real ship is off the stepper's until it next rests on a flat floor or roof)
  const yb = Array(W).fill(1e9), yt = Array(W).fill(-1e9), ok = Array(W).fill(true);
  for (let t = 0; t < ys.length; t++) { const c = Math.floor(t / TPC); if (c < W) { yb[c] = Math.min(yb[c], ys[t] - 15); yt[c] = Math.max(yt[c], ys[t] + 15); if (!tr[t]) ok[c] = false; } }
  tunnel(G, W, e, gap, H - 1, 2);
  bandMovers(G, W, H, "H", x => e(x) + gap / 2, x => Math.max(e(x), e(x + 1)), x => Math.min(e(x), e(x + 1)) + gap);
  // spikes on the side not ridden, in runs, a column clear now and then (flat columns only: a spike never on a slope)
  // the stepper doesn't copy the ship riding a sloped floor or roof (it drifts up to 25 units off the real one there), so
  // no spike from a climb's or drop's start to 4 columns past its end, and a 12-unit margin elsewhere
  const nearSlope = c => { for (let x = c - 4; x <= c; x++) if (x >= 0 && e(x) !== e(x + 1)) return true; return false; };
  for (let c = 3; c < W - 2; c++) { const b = e(c); if (e(c - 1) !== b || e(c + 1) !== b || nearSlope(c) || !ok[c - 1] || !ok[c] || !ok[c + 1]) continue;
    const okF = [c - 1, c, c + 1].every(x => yb[x] > b * 30 + 21 + 12), okR = [c - 1, c, c + 1].every(x => yt[x] < (b + gap - 1) * 30 + 9 - 12);
    if (R.chance(0.15)) continue;
    if (okF && !okR) G.put(c, b, "^"); else if (okR && !okF) G.put(c, b + gap - 1, "v"); else if (okF && okR && R.chance(0.5)) G.put(c, R.chance(0.5) ? b : b + gap - 1, R.chance(0.5) ? "^" : "v"); }
  const presses = []; for (let i = 0; i < ev.length; i++) if (ev[i][1] === "press") presses.push([ev[i][0], ev[i + 1] ? ev[i + 1][0] : W]);
  const path = []; for (let t = 0; t < ys.length; t += 8) path.push([+(t / TPC).toFixed(2), +(ys[t] / 30 - 0.5).toFixed(2)]);
  return { map: G.rows(), mode: "ship", presses, path }; };
// the shape-first version (the one in use)
GEN["my-mwz1s7po"] = o => { const { R, imix, room, len, chance, W, H, G } = ctx(Object.assign({ cols: 56 }, o), 10), gap = room(5, 3);
  // the ship's band is 10 rows: the corridor tours all of it, down to the ground (no lower bar there) and up to the roof
  const next = tour(R, 0, H - gap);
  const e = line(W, Math.round((H - gap) / 2), L => { L.run(len(imix(10, 6), imix(12, 8))); L.leg(next(L.h())); });
  tunnel(G, W, e, gap, H - 1, 2);
  bandMovers(G, W, H, "H", x => e(x) + gap / 2, x => Math.max(e(x), e(x + 1)), x => Math.min(e(x), e(x + 1)) + gap);
  let side = R.chance(0.5) ? 1 : -1;
  for (let c = 4; c < W - 2; c++) { const b = e(c); if (!(e(c - 1) === b && e(c + 1) === b && e(c + 2) === b)) continue;
    if (chance(0.3, 0.55)) { const n = R.int(1, imix(2, 4)); let k = 0;
      for (; k < n && e(c + k + 1) === b && c + k < W - 2; k++) G.put(c + k, side > 0 ? b : b + gap - 1, side > 0 ? "^" : "v");
      c += k + 1; if (R.chance(0.4)) side = -side; } }
  return { map: G.rows(), mode: "ship" }; };

// SPIDER CORRIDORS (his my-mwz7nxue). Idea: the ball's surfaces, but the spider teleports across at once, so the next
// surface may start right where the last one ends; a 9-row band (270 units).
CONCEPT["my-mwz7nxue"] = "floor and ceiling pieces the spider teleports between; the next one starts right where the last ends, at changing heights";
// Evgeni 2026-11-27: "in spider we need alignment of top and bottom, that alignment decides the difficulty in a way as a
// timing and cps", then "the platforms you jump still dont overlap in possible gameplay": each piece starts before the
// last one ends, the overlap (3 columns easy, 1 at harder, now and then one more or less) is the window to teleport in
// SPIDER, PRESSES FIRST (2026-11-27). The taps come first: one on the rhythm (or the beat), the window `win` columns around
// it (2.4 easy -> 1.0 harder), and each tap's two surfaces built from it: the one the spider leaves ends where a late tap
// would walk it off (its box past the last block), the one it teleports to starts where an early tap would find nothing
// above it and flip into the band's spikes. A surface runs from one tap to the next, on the other side each time, 2-4
// rows from the last (under half the band on average), now and then on the band's very floor or roof (their hazards
// cleared there). Taller than the band: a hidden spider portal (P) on a long surface re-bands around it, as in rollers.
GEN["my-mwz7nxue"] = o => { const { R, mix, W, H, G, style, onBeat, entry } = ctx(o, 10), BT = Math.min(H, 9), tall = H > BT + 2, CL = climber(o.seed, H, BT, tall); let dr = 0;
  const win = mix(2.4, 1.0), e = win / 2, l = win / 2;
  const gap0 = R.pick([0.35, 0.45, 0.55, 0.7].map(v => v - mix(0, 0.1)));
  const gapS = c => Math.max(win + 1.6, gap0 * (0.85 + R() * 0.3) * (R.chance(0.12) ? 1.6 + R() * 0.4 : 1) / style.pace(c) * COLS_PER_SEC);
  // a surface: side 1 = floor (y: the row the spider runs in, blocks under it), -1 = ceiling (y: the row it hangs in,
  // blocks over it); rows in its band (O = the band's floor row); [a, b] its columns
  // it comes in on a mass of random height from the ground (taller maps any height, short ones 2-3), in the band the
  // join's spider portal sets from there (3 rows under it: lib/physics.js)
  const aE = entry(2, tall ? H - BT + 2 : 3); let O = clamp(aE - 3, 0, Math.max(0, H - 1 - BT));
  const S = [{ side: 1, y: aE - O, O, a: 0, b: null, mass: true, first: true }], presses = []; let p = onBeat(R.int(4, 6) + 0.5, 3.5);
  while (p < W - 3) { const q = S[S.length - 1];
    q.b = Math.ceil(p + l - 1.5);
    // tall: a portal on a long surface re-bands around the spider (between its landing window and its leaving one)
    if (tall && S.length > 1 && q.b - q.a >= 5 && (R.chance(0.6) || dr)) { const abs = q.y + q.O, O2 = clamp(abs - Math.floor(BT / 2), 0, H - 1 - BT), rel = abs - O2;
      if (O2 !== O && (!dr || Math.sign(O2 - O) === dr) && (q.side > 0 ? rel <= BT - 4 : rel >= 3)) { q.mover = { c: q.a + Math.ceil(e) + 1, O: O2, rel }; O = O2; } }
    dr = CL.drift(O);
    const qy = q.mover ? q.mover.rel : q.y, side = -q.side, step = CL.step(side, R.int(2, 4), dr, 1), edge = R.chance(0.3) || (dr && (side < 0) === (dr > 0));
    const y = side < 0 ? clamp(qy + step, Math.max(3, qy + 1), edge ? BT - 1 : BT - 2) : clamp(qy - step, edge ? 0 : 1, Math.min(BT - 4, qy - 1));
    S.push({ side, y, O, a: Math.floor(p - e + 0.5), b: null, mass: side > 0 ? y <= 1 : y >= BT - 2, thick: R.chance(0.7) ? 1 : 2 });
    presses.push(+p.toFixed(4));
    p = onBeat(p + gapS(p), p + win + 1.6); }
  S[S.length - 1].b = W - 1;
  // the band's floor per column (it moves at each portal); its bar on top, the ground under it; saws and spike groups
  // along its floor and roof
  const Oc = Array(W).fill(0); { let o = S[0].O, i = 0; const ms = S.filter(t => t.mover).map(t => t.mover);
    for (let c = 0; c < W; c++) { while (i < ms.length && ms[i].c <= c) o = ms[i++].O; Oc[c] = o; } }
  // tall: the map outside the band is solid (2026-11-27: a player who skipped a band portal stayed in the old band and
  // rolled the open ground under the raised one, 2 presses for a 17-press plan); default height: the bar and one row
  for (let c = 0; c < W; c++) { if (Oc[c] + BT < H) G.box(c, c, Oc[c] + BT, tall ? H - 1 : Oc[c] + BT); if (Oc[c] > 0) G.box(c, c, tall ? 0 : Oc[c] - 1, Oc[c] - 1); }
  for (const [d, t] of [[0, "^"], [BT - 1, "v"]]) for (let c = 0; c < W;) {
    if (R.chance(0.2)) { G.put(c, Oc[c] + d, "o"); c += 2; continue; }
    // the column between two groups holds a half-buried saw (2026-11-28, tools/secretways.js: a spider landed in that
    // gap on the bare ground and tapped up from it, 5 presses for a 9-press plan; a ball can flip off it the same way)
    const n = R.int(2, 3); for (let k = 0; k < n && c + k < W; k++) G.put(c + k, Oc[c + k] + d, t);
    if (c + n < W) G.put(c + n, Oc[c + n] + d, "o"); c += n + 1; }
  for (const t of S) { const b = Math.min(W - 1, t.b);
    for (let c = t.a; c <= b; c++) { const y = (t.mover && c >= t.mover.c ? t.mover.rel + t.mover.O : t.y + t.O);
      // its blocks, and the band's hazard where it runs on the band's edge (and the two columns past an edge's end)
      if (t.side > 0) { if (t.mass || y - Oc[c] <= 1) G.box(c, c, t.first ? 0 : Math.min(y - 1, Oc[c]), y - 1); else G.box(c, c, y - t.thick, y - 1); if (y === Oc[c]) G.put(c, y, "."); }
      else { if (t.mass || Oc[c] + BT - 1 - y <= 1) G.box(c, c, y + 1, Math.max(y + 1, Oc[c] + BT)); else G.box(c, c, y + 1, y + t.thick); if (y === Oc[c] + BT - 1) G.put(c, y, "."); } }
    const y1 = t.mover ? t.mover.rel + t.mover.O : t.y + t.O, y0 = t.y + t.O;
    // and the column before one: a saw there reaches the spider teleported onto the surface's first column
    if (t.a > 0 && (t.side > 0 ? y0 - Oc[t.a] <= 1 : Oc[t.a] + BT - 1 - y0 <= 1)) { const c = t.a - 1; for (const d of [0, BT - 1]) if (G.rows()[H - 1 - (Oc[c] + d)][c] === "o") G.put(c, Oc[c] + d, "."); }
    if (t.side > 0 ? y1 - Oc[b] <= 1 : Oc[b] + BT - 1 - y1 <= 1) for (let c = b + 1; c <= Math.min(W - 1, b + 2); c++) for (const d of [0, BT - 1]) if (G.rows()[H - 1 - (Oc[c] + d)][c] !== "#") G.put(c, Oc[c] + d, ".");
    if (t.mover) { const c = t.mover.c, r = t.mover.rel + t.mover.O; for (let rr = r - 1; rr <= r + 1; rr++) if (rr >= 0 && rr < H && G.rows()[H - 1 - rr][c] !== "#") G.put(c, rr, "."); G.put(c, r, "P"); } }
  return { map: G.rows(), mode: "spider", presses }; };

// BALL PORTALS (his my-mwz8kaem). Idea: the ball corridor, but some flips are made for the player by a gravity portal
// standing at a surface's end (G up, N down), between the clicked ones.
CONCEPT["my-mwz8kaem"] = "ball surfaces on both sides; some flips are gravity portals at a surface's end, the rest are clicks";
GEN["my-mwz8kaem"] = o => rollers(o, { mode: "ball", band: 8, travel: ballTravel, portals: 0.3 });

// ORB GAMEPLAY (cube, his my-mwz2haf0). Idea: over a spike floor, the cube goes from orb to orb; sets of one kind (yellow:
// up, blue: flip and fly the other way, green: flip and launch forward) and mixes. The page can't run the sim, so the
// orbs go on the cube's own arc, computed here with GD's numbers (lib/physics.js: 1x speed 5.193 u a tick at 240 Hz, the
// 0.9 slow factor on vertical motion, g 0.958, jump 11.18, blue x0.8 then a flip, a flip halves vy): each orb at least
// ~3.5 columns after the last press, in the middle rows, so the route takes every one (tools/orbfit.js is the sim's own
// placer for his drawn one). A ceiling bar with hanging spikes catches a missed blue / green.
CONCEPT["my-mwz2haf0"] = "over a spike floor the cube flies from orb to orb, each on the arc of the last: sets of yellow, of blue (zigzag), of green (forward, reversed), and mixes";
GEN["my-mwz2haf0"] = o => { const { R, imix, room, chance, W, H, G, beats, onBeat, entry } = ctx(o, 14);
  const X = 5.77000189 * 0.9 * 0.25, DTS = 0.225, g = 0.958199024, J = 11.1800318, top = H - 2;
  // the cube jumping off the start platform's end (hP high, a random height, was 4; to column 6, or to the beat near there)
  const hP = entry(2, Math.max(2, H - 8));
  const b0 = beats ? Math.min(onBeat(6.5, 5.6), 12.5) : 6.5, e0 = Math.ceil(b0) - 1, st = { x: b0 * 30, y: hP * 30 + 15, vy: J, grav: 1 };
  for (let c = 0; c < W; c++) G.put(c, 0, "^"); G.box(0, e0, 0, hP - 1);
  G.box(0, W - 1, H - 1, H - 1); for (let c = 0; c < W; c += 1) if (R.chance(0.85)) G.put(c, H - 2, "v");
  const step = q => { q.vy -= g * DTS * q.grav; if (q.vy * q.grav < -15) q.vy = -15 * q.grav; q.x += X; q.y += q.vy * DTS; };
  const row = q => (q.y - 15) / 30, col = q => (q.x - 15) / 30;
  // the spots on the arc from q where an orb of `kind` can go: past the gap (shorter right after a flip: a flipped cube
  // crosses the band in ~3 columns), in the middle rows, not in the last 8 columns; a flip orb on the side it flips away
  // from (normal -> reversed in the lower part, reversed -> normal in the upper part), so the flipped arc has room
  const candsOf = (q0, kind, lastC) => { const flips = kind !== "Y", gapC = q0.flipped ? 1.5 : room(3.5, 3), out = []; let q = { ...q0 }, n = 0;
    while (col(q) < W - 9 && n++ < 2000) { step(q); const r = row(q), c = col(q);
      if (r < 1.2 || r > top - 0.5) break;
      const side = !flips || (q.grav > 0 ? r <= H / 2 - 2 : r >= H / 2 + 1);
      if ((beats || n % 6 === 0) && c - lastC >= gapC && r >= 3 && r <= top - 3 && side) out.push({ ...q }); if (out.length > (beats ? 240 : 40)) break; }
    return out; };
  // the orb's effect, pressed as the cube is at its centre
  // (no snap to the orb's centre: the plan flies on from where the cube really is, the orb in the nearest cell touches it)
  const apply = (sp, kind) => { const q = { ...sp };
    if (kind === "Y") q.vy = q.grav * J;
    else if (kind === "B") { q.vy = q.grav * J * 0.8; q.grav = -q.grav; q.vy *= 0.5; }
    else { q.grav = -q.grav; q.vy = q.grav * J; }
    q.flipped = kind !== "Y"; return q; };
  // the kinds: sets of 2-4 of one kind; blue and green only past easy; the gravity at the end must be normal
  const pool = o.tier === "easy" || ctx(o, 14).d < 0.2 ? ["Y"] : ["Y", "Y", "B", "E"];
  // a run of orbs is 2-4 long, 5 now and then, never more (Evgeni 2026-11-27: "some sequences seem too long (8 orbs i see),
  // i think lets max it to 5 (very rare)"): then a landing, or the chain ends
  const runLen = () => R.chance(0.08) ? 5 : R.int(2, 4);
  let set = R.pick(pool), left = runLen(), lastC = e0 - 1, cur = { ...st }, guard = 0, since = 0;
  // PRESSES FIRST: the plan is the presses the arcs were built from: the jump off the start platform, a tap at each orb
  // as the cube passes its centre, the jump off each landing's end (columns of the player's centre)
  const presses = [st.x / 30];
  // the landing goes anywhere in the height (Evgeni: "100% spread or close"): on the ground itself (blocks in place of
  // the spike floor), low or middle, and with the gravity reversed on a ceiling platform up to the top bar; the cube
  // runs along it and jumps off its end. want: the row to come down to (or up to, reversed)
  const landAt = want => { const up = cur.grav < 0; let q = { ...cur }, n = 0, at = null; const hist = [{ ...cur }];
    while (n++ < 1500 && col(q) < W - 16) { step(q); const rq = row(q); if (rq > top + 0.5 || rq < 0.5) break;
      hist.push({ ...q });
      if (col(q) - lastC >= 2 && (up ? q.vy > 0 && rq >= want - 0.5 : q.vy < 0 && rq <= want + 0.5)) {
        // the platform's side must not catch the cube: where its front edge reaches the platform's first column, its foot
        // is clear of the platform's top by 5 (a rising arc coming in from the side can't land there)
        const c0 = Math.floor(col(q)), rr = up ? Math.min(top, Math.ceil(rq)) : Math.max(1, Math.floor(rq)), side = hist.filter(h => h.x <= c0 * 30 - 15).pop();
        if (!side || (up ? side.y + 15 <= (rr + 1) * 30 - 5 : side.y - 15 >= rr * 30 + 5)) { at = q; break; } } }
    if (!at) return false;
    const rr = up ? Math.min(top, Math.ceil(row(at))) : Math.max(1, Math.floor(row(at))), c0 = Math.floor(col(at)); let len = R.int(room(5, 3), room(7, 4)), bx = null;
    // with beats the jump off its end goes on a beat: the platform runs to the column that beat is in
    // (not past W - 12: the jump off it must still come down before the end platform; sparse hits fall back to `len`)
    if (beats) { bx = onBeat(c0 + len + 0.5, c0 + room(4, 2.5) + 0.5); if (bx > W - 12 || bx - c0 > 14) bx = null; else len = Math.ceil(bx) - 1 - c0; }
    // reversed: the jump off its end must reach a flip orb, or the cube rides the ceiling into the spikes (Evgeni
    // 2026-11-28: "some of the orb generations end on the floor death")
    if (up) { const nx = { x: bx != null ? bx * 30 : (c0 + len) * 30 + 15, y: rr * 30 + 15, vy: -J, grav: -1, flipped: false };
      if (!candsOf(nx, "B", c0 + len - 1).some(sp => candsOf(apply(sp, "B"), "Y", Math.round(col(sp))).length)) return false; }
    G.box(c0, c0 + len, up ? rr + 1 : rr - 1, up ? rr + 1 : rr - 1); for (let x = c0; x <= c0 + len; x++) G.put(x, rr, ".");
    cur = { x: bx != null ? bx * 30 : (c0 + len) * 30 + 15, y: rr * 30 + 15, vy: up ? -J : J, grav: up ? -1 : 1, flipped: false }; lastC = c0 + len - 1; since = 0;
    presses.push(cur.x / 30);
    // a ceiling landing: the hanging spikes just past its end sit where the jump off it still passes (the cube leaves at
    // the top row and drops ~0.3 of a row in its first column), so the spikes under that first stretch of the arc go
    if (up) { let q = { ...cur }; for (let k = 0; k < 400 && row(q) > top - 1.6; k++) { step(q); const cc = Math.floor(col(q) + 0.5); for (let x = cc - 1; x <= cc + 1; x++) if (x > c0 + len && x < W) G.put(x, H - 2, "."); } }
    return true; };
  const wantRow = () => cur.grav < 0 ? top - R.pick([0, 1, 3, 5]) : R.pick([1, 1, 3, 5, 6]);
  const orbs = [];
  while (guard++ < 200) {
    // fly on until a good spot: past the gap (shorter right after a flip: a flipped cube crosses the band in ~3 columns),
    // in the middle rows, not in the last 8 columns. A flip orb goes on the side it flips away from (normal -> reversed in
    // the lower half, reversed -> normal in the upper half), so the flipped arc has the whole band to cross
    let kind = set; if (cur.grav < 0 && lastC > W - 24 && kind === "Y") kind = R.pick(["B", "E"]);
    const cands = candsOf(cur, kind, lastC).filter(sp => kind === "Y" && sp.grav > 0 || candsOf(apply(sp, kind), kind === "Y" ? "Y" : "B", Math.round(col(sp))).length);
    if (!cands.length) { if (since && landAt(cur.grav < 0 ? top - 1 : 1)) continue;   // nowhere for an orb: land first
      if (kind !== "Y" || cur.grav < 0) { if (cur.grav < 0) break; set = "Y"; continue; } break; }
    // which spot on the arc: drawn among the first few; with beats the one nearest a beat among the first few more
    let spot = cands[R.int(0, Math.min(cands.length - 1, imix(6, 3)))];
    // (every tick is a candidate then: the press goes on the beat itself, the tick nearest it; the orb's cell touches it)
    let pressAt = null;
    if (beats) { let bs = 1e9; const near = (imix(6, 3) + 4) * 6;
      cands.forEach((sp, i) => { if (i >= near && bs <= 0.05) return; const bc = onBeat(sp.x / 30), d = Math.abs(bc - sp.x / 30); if (d < bs) { bs = d; spot = sp; pressAt = bc; } });
      // none on a beat: the orb goes where the arc is (an orb rides its arc: a beat is taken only where the arc can carry
      // one; a cube orb jump lasts ~0.43 s, two half beats at 140 bpm, so 140 fits best)
      if (bs > 0.05) pressAt = null; }
    const c = Math.round(col(spot)), r = Math.round(row(spot));
    if (orbs.some(b => Math.abs(b.c - c) < 3 && Math.abs(b.r - r) < 2)) break;
    orbs.push({ c, r, kind }); cur = apply(spot, kind); since++; presses.push(pressAt ?? spot.x / 30);
    lastC = c; if (--left <= 0 || since >= 5) { set = R.pick(pool); left = runLen();
      // a landing after every set (Evgeni 2026-11-27: "the orb gameplay has only orbs, we want it to land at some parts,
      // every 2-4 orbs"): a platform where the arc comes down through rows 3-6, the cube runs along it and jumps off its end
      if (!landAt(wantRow()) && since >= 5) break; }
  }
  // back to normal gravity at the end: a blue orb on the arc if the last one left it reversed
  if (cur.grav < 0) { const cs = candsOf(cur, "B", lastC); if (cs.length) { const sp = cs[0], c = Math.round(col(sp)), r = Math.round(row(sp));
    orbs.push({ c, r, kind: "B" }); cur = apply(sp, "B"); lastC = c; presses.push(sp.x / 30); } }
  for (const b of orbs) G.put(b.c, b.r, b.kind);
  // land: the end platform from where the last arc comes down to a row it can stand on, to the map's end
  let q = { ...cur }, n = 0, land = W - 4, lr = 2;
  const hist = [{ ...q }];
  while (n++ < 3000) { step(q); hist.push({ ...q }); if (q.vy < 0 && row(q) <= 3.6) { const l0 = Math.max(lastC + 2, Math.floor(col(q))), r0 = Math.max(1, Math.min(3, Math.round(row(q) - 0.5)));
      const side = hist.filter(h => h.x <= l0 * 30 - 15).pop(); if (side && side.y - 15 < r0 * 30 + 5) continue;   // its side would catch the cube
      land = l0; lr = r0; break; } if (col(q) > W) break; }
  land = Math.min(land, W - 3); G.box(land, W - 1, 0, lr - 1); for (let c = land; c < W; c++) G.put(c, lr, ".");
  return { map: G.rows(), mode: "cube", presses: presses.map(v => +v.toFixed(4)).sort((a, b) => a - b) }; };

const KEYS = Object.keys(GEN);
// THE PLANNED PATH FOR THE TAP TYPES (the board thread, 2026-11-27, on Evgeni's "can we draw the path? now we dont need to
// solve it right?"): fly, wave and flappy return `path` from their own planner; the cube, ball and spider types return
// only presses, so their path is traced here from the map and the presses in the page's physics: [column of the
// player's centre, its bottom row] every 8 ticks, as the others sample it. Blocks (# and the slope tiles as blocks), the
// gravity portals G / N, the orbs Y / B / E; hazards are not looked at (the plan misses them by construction) and the
// band movers L / P change nothing the path shows. The trace stops where the player would hit a block's side or fall
// out. Not the solver: a check against the real sim is in tests/sectiongen.js ("path").
function tracePath(z) { const map = z.map, H = map.length, W = map[0].length, mode = z.mode;
  // the ball's and the spider's band: its floor and roof hold them like blocks (lib/physics.js BAND: 8 / 9 rows; the join's
  // portal sets it 3 rows under the entry, a mover L / P 4 rows under itself)
  const BR = { ball: 8, spider: 9 }[mode]; let bLo = null;
  const cell = (c, r) => c < 0 || c >= W || r < 0 || r >= H ? "." : map[H - 1 - r][c];
  const solid = (c, r) => ("#:/\\7r".includes(cell(c, r)) && cell(c, r) !== ".") || (bLo != null && (r === bLo - 1 || r === bLo + BR));
  const orbs = [], portals = []; for (let c = 0; c < W; c++) for (let r = 0; r < H; r++) { const ch = cell(c, r);
    if ("YBE".includes(ch)) orbs.push({ c, r, ch, used: false }); else if (ch === "G" || ch === "N" || (BR && (ch === "L" || ch === "P"))) portals.push({ c, r, ch, done: false }); }
  const TPC = 30 / CUBE.X, taps = new Set((z.presses || []).map(q => Math.round((Array.isArray(q) ? q[0] : q) * TPC)));
  const gAcc = mode === "cube" ? CUBE.g : 0.958199 * 0.6;
  let x = 0, g = 1, vy = 0, on = true, y = 15; { let r = 0; while (r < H && !solid(0, r)) r++; if (r >= H) r = 0; while (r < H && solid(0, r)) r++; y = r * 30 + 15; if (BR) bLo = Math.max(0, r - 3); }   // on the lowest block at the start
  const span = () => [Math.floor((x - 14.9) / 30), Math.floor((x + 14.9) / 30)];
  const out = []; let ref = null;
  for (let t = 0; t < W * TPC + 2; t++) { let still = false;
    if (taps.has(t)) { const orb = orbs.find(o => !o.used && Math.abs(o.c * 30 + 15 - x) < 33 && Math.abs(o.r * 30 + 15 - y) < 33);
      if (orb) { orb.used = true; on = false;
        if (orb.ch === "Y") vy = g * CUBE.J; else if (orb.ch === "B") { vy = g * CUBE.J * 0.8; g = -g; vy *= 0.5; } else { g = -g; vy = g * CUBE.J; } }
      else if (on && mode === "cube") { vy = g * CUBE.J; on = false; still = true; }
      else if (on && mode === "ball") { g = -g; vy = -g * 3.354; on = false; }   // towards the new side
      else if (on && mode === "spider") { const [a, b] = span(); let r = Math.floor((y - 15) / 30) + (g > 0 ? 1 : -1), hit = null;   // to the first surface the other way
        for (; r >= 0 && r < H; r += g > 0 ? 1 : -1) { let s = false; for (let c = a; c <= b; c++) if (solid(c, r)) s = true; if (s) { hit = r; break; } }
        if (hit != null) { g = -g; y = g > 0 ? (hit + 1) * 30 + 15 : hit * 30 - 15; vy = 0; } } }
    if (!on) { vy -= g * gAcc * CUBE.DTS; if (Math.abs(vy) > 15) vy = 15 * Math.sign(vy); }
    x += CUBE.X; if (!still && !on) y += vy * CUBE.DTS;
    for (const p of portals) if (!p.done && x / 30 >= p.c - 0.41 && Math.abs(p.r * 30 + 15 - y) < 60) { p.done = true;
      if (p.ch === "L" || p.ch === "P") { bLo = Math.max(0, p.r - 4); continue; }
      const ng = p.ch === "G" ? -1 : 1; if (ng !== g) { g = ng; vy *= 0.5; on = false; } }
    // support under the feet (over the head upside down): land on it falling, walk off it when it ends
    const [a, b] = span(); let sup = null; const feet = y - g * 15;
    for (let c = a; c <= b; c++) for (let r = 0; r < H; r++) if (solid(c, r)) { const top = g > 0 ? (r + 1) * 30 : r * 30;
      if (g > 0 ? top <= feet + 10 && top >= feet - 0.01 : top >= feet - 10 && top <= feet + 0.01) sup = sup == null ? top : g > 0 ? Math.max(sup, top) : Math.min(sup, top); }
    // (rising into a block's top corner with the feet under 10 below its top lands on it too, as in the real sim)
    if (sup != null && (on || vy * g <= 0 || (sup - feet) * g > 0.01)) { y = sup + g * 15; vy = 0; on = true;
      // GD's jump snap (cubeTry's snapStep, here on the map): a block a stair step from the last one moves x by up to 1
      if (mode === "cube") { const f = y - g * 15, rr = g > 0 ? f / 30 - 1 : f / 30, on2 = [];
        for (let c = Math.ceil((x - 45) / 30); c <= Math.floor((x + 15) / 30); c++) if (Number.isInteger(Math.round(rr)) && solid(c, Math.round(rr))) on2.push(c);
        on2.sort((p, q) => Math.floor((q * 30 + 15) / 100) - Math.floor((p * 30 + 15) / 100) || q - p);
        for (const c of on2) { const cx = c * 30 + 15, r0 = Math.round(rr);
          if (ref && (ref.c !== c || ref.r !== r0)) { const P = SNAP1, ddx = cx - (ref.c * 30 + 15), ddy = (r0 - ref.r) * 30 * g, mx = P.max;
            if ((Math.abs(ddx - P.side) <= mx && Math.abs(ddy - 30) <= mx) || (Math.abs(ddx - P.far) <= mx && Math.abs(ddy + 30) <= mx) || (Math.abs(ddx - P.near) <= mx && Math.abs(ddy - 60) <= mx)) {
              const tx = cx + ref.d; x = Math.abs(tx - x) > mx ? x + Math.sign(tx - x) * mx : tx; } }
          ref = { c, r: r0, d: x - cx }; } } }
    else if (on) on = false;
    // a block's side or a head hit: the run ends there
    let bump = false; for (let c = a; c <= b; c++) for (let r = Math.floor((y - 14) / 30); r <= Math.floor((y + 14) / 30); r++) if (solid(c, r)) bump = true;
    if (t % 8 === 0) out.push([+(x / 30).toFixed(2), +(y / 30 - 0.5).toFixed(2)]);
    if (bump || y < -60 || y > H * 30 + 60) break; }
  return out; }
function make(key, opts = {}) { const g = GEN[key]; if (!g) throw new Error("no generator for " + key + " (have " + KEYS.join(", ") + ")");
  const o = {}; for (const k of ["cols", "rows", "seed", "bpm", "beatCols", "speed", "entry", "gap"]) if (opts[k] != null) o[k] = +opts[k];
  if (Array.isArray(opts.beats)) o.beats = opts.beats;   // a song's beats in the section (seconds, or {t, s})
  if (opts.tier != null) o.tier = isNaN(+opts.tier) ? opts.tier : +opts.tier;
  const r = g(o), z = (LS.SECTIONS || []).find(s => s.key === key);
  // a section taller than 12 rows asks the builder to zoom out (Evgeni 2026-11-27: "maybe we need to zoom out a bit to allow
  // bigger gameplay"): camera zoom trigger 1913 at 0.85 over it, back to 1 after
  if (r.map.length > 12 && r.zoom == null) r.zoom = 0.85;
  // the drawn path: opts.replay (the catalogue) = the REAL replay of the planned presses in lib/physics.js
  // (layoutcheck planCheck: the type in a level's join, ~1 s), else the planner's own (fast, up to ~1 row off the real one
  // in ball / spider / flappy). The entrance always replays: its ramp launch is not in tracePath.
  if (r.presses && (opts.replay || key === "entrance")) { const LC = require("./layoutcheck.js"), log = console.log; console.log = () => {};
    try { const c = LC.planCheck(Object.assign({ key }, r)); if (c.path && c.path.length) { r.path = c.path; r.pathFrom = "replay"; r.planOk = c.ok; } } finally { console.log = log; } }
  if (!r.path && r.presses && ["cube", "ball", "spider"].includes(r.mode)) r.path = tracePath(r);
  return Object.assign({ key, name: (z && z.name) || key, concept: CONCEPT[key], opts: o }, r); }

// how often a level builder should pick a type (1 = as often as any): Evgeni 2026-11-27 on hanging: "low priority on using
// such ... considering removing as others contain these feates"
const PRIORITY = { hanging: 0.2 };
module.exports = { PRIORITY, GEN, CONCEPT, KEYS, TIERS, make, rng, tunnel, flyPlan, shipStep, ctx };

if (require.main === module) {
  const a = process.argv.slice(2), arg = k => { const i = a.indexOf("--" + k); return i >= 0 ? a[i + 1] : null; }, cmd = a[0];
  const pos = []; for (let i = 1; i < a.length; i++) { if (a[i].startsWith("--")) { if (a[i] !== "--show") i++; continue; } pos.push(a[i]); }
  // --song <key> --from <s>: the section follows that song's real hits from that second on (tools/sectionbeats.js)
  const songB = cols => arg("song") ? require("./sectionbeats.js").songBeats(arg("song"), +(arg("from") || 0), +(arg("from") || 0) + (+cols || 32) / COLS_PER_SEC + 1) : undefined;
  if (cmd === "show") { const z = make(pos[0], { cols: arg("cols"), rows: arg("rows"), seed: arg("seed"), tier: arg("tier"), bpm: arg("bpm"), beats: songB(arg("cols")) });
    console.log(z.key + " (" + z.mode + ", " + z.map[0].length + " x " + z.map.length + "): " + z.concept + "\n" + z.map.join("\n")); }
  else if (cmd === "check") {
    require("./heavy.js").claim();
    const LC = require("./layoutcheck.js"), cols = (arg("cols") || "30,60,120").split(",").map(Number), seeds = (arg("seeds") || "1,2").split(",").map(Number), tiers = (arg("tiers") || "normal").split(",");
    let ok = 0, n = 0;
    for (const key of pos.length ? pos : KEYS) for (const tier of tiers) for (const W of cols) for (const seed of seeds) {
      const z = make(key, { cols: W, seed, tier, bpm: arg("bpm"), beats: songB(W) }); n++;
      const c = LC.check(z); if (c.ok) ok++;
      console.log(`${key.padEnd(13)} ${tier.padEnd(6)} ${String(W).padStart(4)} cols seed ${seed}: ` + (c.ok ? `solves, ${c.presses} presses, ${c.label} (~${c.attempts})${c.tight[0] ? ", tightest " + c.tight[0].ms + " ms" : ""}` : `NO: dies at col ${c.dieCol} row ${c.dieRow}: ${c.why}`) + `  [${(c.ms / 1000).toFixed(0)} s]`);
      if (!c.ok && a.includes("--show")) console.log(z.map.map(l => "   " + l).join("\n"));
    }
    console.log(`${ok} of ${n} solve`);
  } else console.log("usage: node tools/sectiongen.js show <key> [--cols N] [--tier easy|normal|hard|harder] [--bpm B | --song <key> --from <s>] | check [key ...] [--cols 30,60,120] [--seeds 1,2] [--tiers easy,hard]\nkeys: " + KEYS.join(", "));
}
