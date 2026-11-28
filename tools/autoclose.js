// node tools/autoclose.js <level.gdlvl> [--route <route.json>] [--out levels/lab/<name>_auto.gdlvl] [--name "..."] [--shown] [--quiet]
//   --viewer: write it as levels/gdlm_auto_<base>.gdlvl (the viewer lists top-level levels/) with its zero-press run saved as
//     its solution, so the viewer replays it at once (then node tools/index_levels.js)
//   --route: a route file ({events: [...]} or [...], e.g. levels/gdlm_77_missing_physics_lab.probe.json) instead of the saved solve
//   -> an AUTO copy of a solved level: the same level, and for every press of its saved route a HIDDEN object that makes the
//      same move with no click (alpha 0 from the first tick: collision stays, the eye sees nothing). Evgeni, 2026-11-26:
//      "once we have a solved level, we can make an 'auto' clone. without adding anything visible, if we can. with triggers
//      hidden pads clicking the player dunno whats possible".
//   GD has no trigger that presses the button, so each press becomes the object closest to it in effect (AUTO.md "Auto clone"):
//     ball / swing press, wave / ship hold and release  -> a gravity portal (flips; a released flipped wave rises like a held one,
//                                                         a ship only roughly: 0.25 vs 0.39 a tick)
//     spider press                                       -> a spider pad (the same teleport) if on a surface, else a gravity portal
//     cube / robot / UFO press                           -> a pink (10.4 up; a cube jump is 11.18), yellow (16) or red (20) pad under
//                                                         the feet, on a surface or floating in the air (hidden, a pad needs no
//                                                         ground): the arc differs a little, so the search picks pad and spot
//   Each object is tried at a range of x around where the player is on the press's tick; the one whose zero-press run stays
//   alive to the next press and keeps closest to the original path wins (backtracking a few presses when none survives). The
//   result's zero-press run must clear. --shown: leave the added objects visible (to see them in the viewer).
//   Library: clone(levelStr, events, opts) -> {objects, header, placed, unhandled, clears, why}.
if (require.main === module) require("./heavy.js").claim();   // one heavy job at a time (tools/heavy.js)
"use strict";
const fs = require("fs"), path = require("path");
const { GD, readGdlvl, writeGdlvl } = require("./io.js");
const ROOT = path.join(__dirname, "..");
const ID = { bluePad: 67, gravUp: 10, gravDown: 11, pink: 140, yellow: 35, red: 1332, spiderPad: 3005, alpha: 1007 };
const HIDE_GROUP = 9990, CK = 120;
const PADM = new Set(["cube", "robot", "ufo"]);

const snap = s => ({ tick: s.tick, x: s.x, y: s.y, vy: s.vy, grav: s.grav, mode: s.mode, g: !!s.grounded, dead: !!s.dead, done: !!s.done, mini: !!s.mini });
function half(s) { return s.mini ? 6 : (s.mode === "ball" || s.mode === "cube" || s.mode === "robot" || s.mode === "spider") ? 15 : 12; }

// the zero-press run of `objects`, resumed from `from` (an earlier run on the same objects minus ones lying ahead) at tick `at`
function runAuto(objects, header, upto, from, at) {
  const w = GD.makeWorld(objects, header);
  let s, p, cks;
  const ck = from ? Math.floor(Math.max(0, Math.min(at, from.p.length - 1)) / CK) * CK : 0;
  if (from && ck > 0 && from.cks.has(ck)) {
    s = structuredClone(from.cks.get(ck)); p = from.p.slice(0, ck + 1); cks = new Map([...from.cks].filter(([t]) => t <= ck));
  } else { s = GD.startState(w); p = [snap(s)]; cks = new Map(); }
  while (!s.dead && !s.done && s.tick < upto) {
    GD.step(w, s, { press: false, held: false }); p.push(snap(s));
    if (s.tick % CK === 0) cks.set(s.tick, structuredClone(s));
  }
  return { p, cks, dead: s.dead, done: s.done, why: s.why };
}

function obj(id, x, y, extra = {}) {
  const o = { id, x: +x.toFixed(2), y: +y.toFixed(2), rot: 0, flipX: false, flipY: !!extra.flipY, props: Object.assign({}, extra.props) };
  return o;
}

// candidates for one route event, given the auto player's state s on that tick
function candidates(e, s, wantMode, o0, o1) {
  const out = [], m = s.mode, X = s.x;
  // what the press did in the original run (o0 its tick, o1 a few ticks later): an orb press in any mode is a jump with gravity
  // kept (-> pads in the air under the player), a blue orb a flip (-> a gravity portal or blue pad)
  const orbJump = o0 && o1 && o1.grav === o0.grav && o1.mode === o0.mode && (o1.vy - o0.vy) * o0.grav > 3;
  const orbFlip = o0 && o1 && o1.grav !== o0.grav && o1.mode === o0.mode && PADM.has(m);
  const padsUnder = (ids, tag) => { const foot = s.grav > 0 ? s.y - half(s) : s.y + half(s), y = s.grav > 0 ? foot + 2 : foot - 2;
    for (const id of ids) for (let dx = -6; dx <= 30; dx += 2) out.push({ kind: ({ 140: "pink", 35: "yellow", 1332: "red", 67: "blue" })[id] + " pad" + tag, objs: [obj(id, X + dx, y, { flipY: s.grav < 0 })] }); };
  if (e.type === "press" && orbFlip) { for (let dx = -18; dx <= 30; dx += 2) out.push({ kind: "grav", objs: [obj(s.grav > 0 ? ID.gravDown : ID.gravUp, X + dx, s.y)] }); padsUnder([ID.bluePad], " (blue orb)"); return out; }
  if (e.type === "press" && orbJump && !PADM.has(m)) { padsUnder([ID.pink, ID.yellow, ID.red], " (orb, " + m + ")"); return out; }
  const grav = () => { for (let dx = -18; dx <= 30; dx += 2) out.push({ kind: "grav", objs: [obj(s.grav > 0 ? ID.gravDown : ID.gravUp, X + dx, s.y)] }); };
  if (e.type === "release") { if (m === "wave" || m === "ship") grav(); return out; }
  if (m === "wave" || m === "ship" || m === "ball" || m === "swing") {
    grav();
    // a ball press off a surface pushes away from it; a portal only flips gravity (and halves vy), too slow where the next
    // spike is close: a hidden blue pad under the ball flips it with a push (brickgen2 / clickfirst ball labs, 2026-11-28)
    // a ship press where a flip alone is too weak (it rises at 0.25 a tick, held 0.39): a hidden pink / yellow pad under it
    // kicks it up (GDLM 76's ship, 2026-11-28)
    if (m === "ship" && e.type === "press") padsUnder([ID.pink, ID.yellow], " (ship)");
    if (m === "ball" && s.g) { const foot = s.grav > 0 ? s.y - half(s) : s.y + half(s), y = s.grav > 0 ? foot + 2 : foot - 2;
      for (let dx = -10; dx <= 24; dx += 2) out.push({ kind: "blue pad", objs: [obj(ID.bluePad, X + dx, y, { flipY: s.grav < 0 })] }); }
    return out;
  }
  if (m === "spider" || m === "cube" || m === "robot" || m === "ufo") {
    // a pad under the player's feet -- on a surface, or floating in the air (hidden, it needs nothing to stand on: a pad fires
    // on touch): pink 10.4 / yellow 16 / red 20 up for a cube (a jump is 11.18; an orb press in the air takes the nearest)
    const foot = s.grav > 0 ? s.y - half(s) : s.y + half(s), y = s.grav > 0 ? foot + 2 : foot - 2;
    const ids = m === "spider" ? [ID.spiderPad] : [ID.pink, ID.yellow, ID.red];
    for (const id of ids) for (let dx = -6; dx <= 30; dx += 2) out.push({ kind: (id === ID.pink ? "pink" : id === ID.yellow ? "yellow" : id === ID.red ? "red" : "spider") + " pad" + (s.g ? "" : " (air)"), objs: [obj(id, X + dx, y, { flipY: s.grav < 0 })] });
    if (m === "spider") grav();
    return out;
  }
  return out;   // ufo, or a cube / robot press in the air (an orb): nothing hidden does it
}

function clone(levelStr, events, opts = {}) {
  const lv = GD.parseLevel(levelStr), header = lv.header, base = lv.objects;
  const wO = GD.makeWorld(base, header), orig = GD.run(wO, events);
  if (orig.dead) throw new Error("the saved route dies on today's physics: " + orig.why);
  const P = orig.path, LOOK = opts.look || 2;   // a candidate must live to the NEXT press (it may die after: the next object acts there)
  // a release matters only where holding is a move of its own (wave, ship); elsewhere a press is a tap
  const evs = events.filter(e => typeof e === "object").slice().sort((a, b) => a.tick - b.tick)
    .filter(e => e.type === "press" || (P[e.tick] && (P[e.tick].mode === "wave" || P[e.tick].mode === "ship")));
  const added = [], placed = [], unhandled = [];
  let cur = runAuto(base, header, (evs[0] ? evs[0].tick : P.length) + LOOK);
  const stack = [];   // per handled event: { i, cands, k, addedLen, cur }
  let i = 0, backs = 0;
  const closeness = (p, t0, t1) => { let d = 0, n = 0; for (let t = t0; t <= Math.min(t1, p.length - 1, P.length - 1); t++) { const a = p[t], b = P[t]; d += Math.abs(a.y - b.y) + (a.mode !== b.mode ? 60 : 0) + (a.grav !== b.grav && a.mode !== "wave" && a.mode !== "ship" ? 20 : 0); n++; } return n ? d / n : 1e9; };
  while (i < evs.length) {
    const e = evs[i], tNext = i + 1 < evs.length ? evs[i + 1].tick : P.length - 1, last = i + 1 >= evs.length, horizon = last ? P.length + 2400 : tNext + LOOK;
    if (cur.p.length <= e.tick) cur = runAuto(base.concat(added), header, horizon, cur, cur.p.length - 1);
    const s = cur.p[Math.min(e.tick, cur.p.length - 1)];
    if (s.dead || cur.p.length <= e.tick) { if (!back()) break; continue; }
    let frame = stack.length && stack[stack.length - 1].i === i ? stack.pop() : null;
    if (!frame) {
      // pad modes: also from where the player is a little before / after the press (a press that lands a jump on a ledge's
      // edge, after a few pads that each jumped a bit lower than the original, needs its pad earlier, on the last surface)
      let cands = candidates(e, s, null, P[e.tick], P[e.tick + 6]);
      if ((PADM.has(s.mode) || s.mode === "ball") && e.type === "press") for (const dt of [-24, -16, -8, 6]) {
        const q = cur.p[e.tick + dt];
        if (q && !q.dead && q.mode === s.mode) cands = cands.concat(candidates(e, q, null, P[e.tick], P[e.tick + 6]).filter((c, k) => k % 2 === 0).map(c => Object.assign(c, { kind: c.kind + (dt < 0 ? " early" : " late") })));
      }
      if (!cands.length) { if (e.type === "press") unhandled.push({ tick: e.tick, type: e.type, mode: s.mode, air: !s.g }); i++; continue; }
      const scored = [], died = [];
      const ok = r => last ? r.done : !(r.dead && r.p.length - 1 < horizon);
      for (const c of cands) {
        const objs = base.concat(added, c.objs), r = runAuto(objs, header, horizon, cur, e.tick - 30);
        if (!ok(r)) { died.push({ c, r }); continue; }
        scored.push({ c, r, score: closeness(r.p, e.tick, tNext + 20) });
      }
      // no single pad lives (a pink pad jumps 10.4, lower and shorter than a jump's 11.18; a yellow one too high): a SECOND
      // hidden pad later in the same arc gives it back the height or reach it lacks
      if (!scored.length && PADM.has(s.mode)) {
        died.sort((a, b) => b.r.p.length - a.r.p.length);
        for (const d of died.slice(0, 6)) for (let k = 10; k <= 96; k += 6) {
          const q = d.r.p[e.tick + k];
          if (!q || q.dead || q.g) continue;
          const foot = q.grav > 0 ? q.y - half(q) : q.y + half(q), y = q.grav > 0 ? foot + 2 : foot - 2;
          for (const id of [ID.pink, ID.yellow]) for (const dx of [0, 6, 12]) {
            const c2 = { kind: d.c.kind + " + " + (id === ID.pink ? "pink" : "yellow") + " pad (air)", objs: d.c.objs.concat([obj(id, q.x + dx, y, { flipY: q.grav < 0 })]) };
            const r = runAuto(base.concat(added, c2.objs), header, horizon, cur, e.tick - 30);
            if (ok(r)) scored.push({ c: c2, r, score: closeness(r.p, e.tick, tNext + 20) });
          }
        }
      }
      if (opts.debug && !scored.length) { console.log(`no survivor at ${(e.tick / 240).toFixed(2)} s, auto state x ${s.x.toFixed(0)} y ${s.y.toFixed(1)} vy ${s.vy.toFixed(2)} ${s.mode} ${s.g ? "ground" : "air"}, orig x ${P[e.tick].x.toFixed(0)} y ${P[e.tick].y.toFixed(1)}`);
        const by = {}; for (const d of died) { const k = d.c.kind, end = d.r.p.length - 1; if (!by[k] || by[k].end < end) by[k] = { end, x: d.c.objs[0].x, why: d.r.why }; }
        for (const k in by) console.log(`  ${k}: best dies at tick ${by[k].end} (next press ${tNext}) by ${by[k].why}, pad x ${by[k].x}`); }
      scored.sort((a, b) => a.score - b.score);
      scored.length = Math.min(scored.length, opts.beam || 8);   // the best few: backtracking tries these, not every x
      frame = { i, cands: scored, k: 0, addedLen: added.length, cur };
    } else { frame.k++; added.length = frame.addedLen; cur = frame.cur; }
    if (frame.k >= frame.cands.length) { if (!back()) break; continue; }
    const pick = frame.cands[frame.k];
    added.push(...pick.c.objs); cur = pick.r;
    stack.push(frame);
    placed[i] = { tick: e.tick, type: e.type, mode: s.mode, kind: pick.c.kind, x: pick.c.objs[0].x, dist: +pick.score.toFixed(1) };
    i++;
    function back() {
      // no candidate survives here: try the previous press's next-best one
      if (!stack.length || backs > (opts.maxBacks || 800)) { unhandled.push({ tick: e.tick, type: e.type, mode: s.mode, why: "nothing survives" }); return false; }
      backs++; const f = stack[stack.length - 1]; i = f.i;
      for (let k = unhandled.length - 1; k >= 0; k--) if (unhandled[k].tick >= evs[f.i].tick) unhandled.splice(k, 1);
      return true;
    }
  }
  // the whole zero-press run
  const all = base.concat(added), fin = GD.run(GD.makeWorld(all, header), []);
  // hidden: every added object in one group, alpha 0 from the first tick (collision stays: EFFECTS.md "Hidden gameplay")
  const extra = [];
  if (!opts.shown && added.length) {
    for (const o of added) o.props[57] = String(HIDE_GROUP);
    extra.push({ id: ID.alpha, x: 3, y: 1650, rot: 0, flipX: false, flipY: false, props: { 51: String(HIDE_GROUP), 35: "0", 10: "0" } });
  }
  return { header, objects: all.concat(extra), placed: placed.filter(Boolean), unhandled, clears: !fin.dead && !!fin.done, why: fin.why || "", secs: +(fin.path.length / 240).toFixed(1), backs, presses: evs.filter(e => e.type === "press").length };
}

// the saved route of a repo level: viewer/levels.js (cached solutions), else local/solutions
function routeOf(file, levelStr) {
  try { const s = require("./solutions.js").get(levelStr, true); if (s && s.ok && s.events) return s.events; } catch (e) {}
  const w = {}; new Function("window", fs.readFileSync(path.join(ROOT, "viewer", "levels.js"), "utf8"))(w);
  const all = Object.values(w).find(v => v && typeof v === "object");
  const arr = Array.isArray(all) ? all : Object.values(all || {});
  const rel = path.relative(ROOT, path.resolve(file)).replace(/\\/g, "/");
  const hit = arr.find(l => l && l.file === rel);
  return hit && hit.solution && hit.solution.ok ? hit.solution.events : null;
}

module.exports = { clone, routeOf, candidates };

if (require.main === module) {
  const a = process.argv.slice(2), opt = k => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : null; };
  const file = a.find(x => /\.gdlvl$/.test(x) && x !== opt("--out"));
  if (!file) { console.log("usage: node tools/autoclose.js <level.gdlvl> [--out file] [--name name] [--shown]"); process.exit(1); }
  const L = readGdlvl(file), rf = opt("--route");
  const events = rf ? (j => Array.isArray(j) ? j : j.events)(JSON.parse(fs.readFileSync(rf, "utf8"))) : routeOf(file, L.levelStr);
  if (!events) { console.log("no saved route for " + file + " (solve it first: node tools/solutions.js " + file + ")"); process.exit(1); }
  const t0 = Date.now();
  const r = clone(L.levelStr, events, { shown: a.includes("--shown") });
  const base = path.basename(file, ".gdlvl");
  const out = path.resolve(opt("--out") || (a.includes("--viewer") ? path.join(ROOT, "levels", "gdlm_auto_" + base.replace(/^gdlm_/, "") + ".gdlvl") : path.join(ROOT, "levels", "lab", base + "_auto.gdlvl")));
  const name = opt("--name") || (GD.getField ? null : null) || ("GDLM auto " + base.replace(/^gdlm_/, "").replace(/_/g, " "));
  const rec = GD.newRecord(name, require("./signature.js").describe("auto clone of " + base + ": every press replaced by a hidden object (tools/autoclose.js)"));
  for (const k of ["k45", "k8"]) { const m = new RegExp("<k>" + k + "</k><[is]>([^<]*)<").exec(L.record || ""); if (m) GD.setField(rec, k, "i", m[1]); }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  writeGdlvl(out, rec, { header: r.header, objects: r.objects });
  if (!r.unhandled.length) require("./planned.js").writeAuto(out, "tools/autoclose.js: an auto clone, no press");   // wip put replays it at once
  if (r.clears && a.includes("--viewer")) { const W = readGdlvl(out), sols = require("./solutions.js");
    sols.put(W.levelStr, { ok: true, events: [], kind: "auto", plan: sols.planCommit() }); }
  if (!a.includes("--quiet")) {
    const byKind = {}; for (const p of r.placed) byKind[p.kind] = (byKind[p.kind] || 0) + 1;
    console.log("placed:", JSON.stringify(byKind), "unhandled:", r.unhandled.length, r.unhandled.slice(0, 8).map(u => `${(u.tick / 240).toFixed(2)}s ${u.mode}${u.air ? " in the air" : ""}${u.why ? " " + u.why : ""}`).join("; "));
  }
  console.log(JSON.stringify({ presses: r.presses, placed: r.placed.length, unhandled: r.unhandled.length, backs: r.backs, secs: r.secs, clears: r.clears, why: r.why }));
  console.log(`${r.clears ? "CLEARS with no press" : "DIES: " + r.why} -> ${path.relative(ROOT, out)} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
}
