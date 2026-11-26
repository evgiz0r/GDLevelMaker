// node tools/lego_pick.js --sections "cube:15,ship:10,cube:20,wave:15" [--song <id> | --bpm 150 --t0 0.03] [--every 1]
//                         [--diff 0.05] [--seed 1] [--name hellgate_try] [--no-solve] [--no-breathers]
// The brick picker (LEGO.md "The picker"; Evgeni's pipeline: sections -> fill each from the big lego by the section's
// beats -> filler). For each section (mode : seconds) it chains main-level bricks so their presses land on the song's
// beats, then joins the chain into one level, solves it from the first brick's real entry state and fills secret ways
// with spikes (tools/lego_join.js). Rules it follows:
//   - the seam contract (lego_join.js fits: same gravity; same mode -> same ground state and height within a block),
//     a mode change (and a gravity change) only at a section boundary, with the portals stacked over the height
//     (a connector corridor is the Hellgate thread's, in lego_join.js)
//   - beats: each press of a brick is scored by its distance to the nearest beat target (--every N: every Nth beat is a
//     target; 1 = every beat); the brick whose presses sit best on beats wins, ties broken by the seed
//   - variety: never the same signature twice in a row, and no brick twice (the officials repeat 16% of neighbours, ours 37%)
//   - difficulty near --diff (per brick, log10 attempts); votes weight a brick's family (knowledge/lego_votes.json)
//   - auto bricks (no press) as breathers: never two in a row, at most a fifth of the time
//   - no jittery or non-human routes, no empty bricks, only verified ones
// Writes local/lego/picks/<name>.gdlvl (main-level layouts: this PC and the private pages only) and <name>.json (the plan:
// bricks, x, times, presses vs beats, filler spikes). Heavy (solves).
"use strict";
if (require.main === module && !process.argv.includes("--no-solve")) require("./heavy.js").claim();
const fs = require("fs"), path = require("path");
const { GD, writeGdlvl } = require("./io.js");
const J = require("./lego_join.js"), L = require("./lego.js");
const ROOT = path.join(__dirname, ".."), B = 30;

function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function beatTargets(o) {
  let t0 = o.t0 || 0, period = 60 / (o.bpm || 120);
  if (o.song) {
    const src = fs.readFileSync(path.join(ROOT, "viewer", "song_grids.js"), "utf8"), m = new RegExp(`"[^"]*/${o.song}\\.[a-z0-9]+":(\\{[^}]*\\})`).exec(src);
    if (!m) throw new Error("no beat grid for song " + o.song + " in viewer/song_grids.js");
    const g = JSON.parse(m[1].replace(/,"sections":\[.*$/, "}")); t0 = g.t0; period = g.period;
  }
  const out = []; for (let t = t0; t < (o.len || 600) + 2; t += period * (o.every || 1)) out.push(t);
  return { targets: out, period };
}
// Evgeni's notes on the catalogue (phone + PC votes): a brick with a 👎, or a note with no 👍 (so far every note is a
// complaint: "wrong path", "too many clicks", "too close to spikes"), is left out -- also when the note sits on a longer
// piece of the same level that covers the brick. Back in once its route is re-planned and re-mined (the note is older).
function flagged() {
  const out = [];
  for (const v of Object.values(L.readVotes())) if (v.vote < 0 || (v.comment && !(v.vote > 0))) out.push(v);
  return out;
}
function isFlagged(p, F) {
  for (const v of F) {
    if (p.routeAt && String(p.routeAt) > String(v.at)) continue;   // re-planned after the note
    if (v.id === p.id) return v;
    if (v.level === p.level && v.x != null && p.x != null && v.x + 1 >= p.x && v.x <= p.x + (p.w || 0) + 1) return v;
  }
  return null;
}
function pool(src) {
  const want = new Set(String(src || "official").split(",")), F = flagged();
  return L.load().filter(p => want.has(p.src) && !isFlagged(p, F) && (p.grain === "brick" || p.src === "library") && p.verified && !p.dupOf && !p.empty && !p.jitter &&
    p.smooth !== false && (!p.routeKind || p.routeKind === "human" || p.routeKind === "ours") && J.MODE_ID[p.mode] && p.path && p.path.length > 2 && p.entry && p.exit && p.s > 0.4);
}
// how well a brick's presses sit on the beats if it starts at time T: mean distance (ms) of each press to its nearest target
function beatCost(b, T, targets) {
  const pr = (b.clicks || []).filter(c => c[2]).map(c => T + c[3]);
  if (!pr.length) return { cost: 60, n: 0, on: 0 };   // auto bricks: neutral, a little worse than a good fit
  let sum = 0, on = 0;
  for (const t of pr) { let d = Infinity; for (const g of targets) { const e = Math.abs(g - t); if (e < d) d = e; if (g > t + 1) break; } sum += Math.min(d * 1000, 250); if (d <= 0.05) on++; }
  return { cost: sum / pr.length, n: pr.length, on };
}
// rest = { prefix, banned }: carry on after the bricks already kept (a repair after the whole chain broke), never
// taking a banned brick again
const GROUND = { cube: 1, ball: 1, robot: 1, spider: 1 }, GAPS = [0, 0.25, 0.5, 0.75, 1, 1.5];
function pick(o, rest = {}) {
  const P = pool(o.src), R = rng(o.seed || 1), { targets } = o.hits ? { targets: o.hits } : beatTargets(o), W = L.sigWeights(L.readVotes());
  const chain = (rest.prefix || []).slice(), used = new Set([...(rest.banned || []), ...chain.map(c => c.b.id)]);
  const last = chain[chain.length - 1];
  let T = last ? last.T + last.b.s : 0, prev = last ? last.b : null, autoT = chain.filter(c => c.b.auto).reduce((s, c) => s + c.b.s, 0), secStart = 0;
  for (const sec of o.sections) {
    const end = secStart + sec.s; secStart = end;
    if (end - 0.4 <= T) continue;
    let first = !prev || prev.mode !== sec.mode || !chain.length || chain[chain.length - 1].section !== sec.mode;
    while (T < end - 0.4) {
      // relax step by step when nothing fits: 0 = every rule; 1 = a signature may come back after 2 others; 2 = only the
      // same gravity at the seam (the join check decides); then the section ends short
      let cand = [];
      for (let relax = 0; relax <= 2 && !cand.length; relax++) cand = P.filter(b => b.mode === sec.mode && !used.has(b.id) &&
        (!prev || (b.sig !== prev.sig && (first ? true : relax >= 2 ? b.entry.grav === prev.exit.grav : J.fits(prev, b)))) &&
        !chain.slice(relax ? -2 : -4).some(c => c.b.sig === b.sig) && T + b.s <= end + 0.6 &&
        // auto bricks (no press) are breathers: never two in a row, and at most a fifth of the time so far
        (!b.auto || (!(prev && prev.auto) && autoT + b.s <= 0.2 * (T + b.s) + 1)));
      if (!cand.length) { console.log(`  section ${sec.mode}: nothing fits at ${T.toFixed(1)} s, ends ${(end - T).toFixed(1)} s short`); break; }
      // a breather before the brick (Evgeni 2026-11-25: "if we have too much space between structures it would feel wierd,
      // we can always buffer with some auto area"): on the ground in a ground mode, a run of plain floor of 0.25-1.5 s
      // may come first when it puts the brick's presses on the beat; it costs a little per second so it is not the default
      const scored = [];
      for (const b of cand) {
        const dd = Math.abs((b.diff || 0) - (o.diff != null ? o.diff : 0.03)), vote = W[b.sig] || 1, base = dd * 300 - (vote - 1) * 20 + R() * 15;
        const canGap = prev && !b.auto && !prev.auto && GROUND[b.mode] && prev.mode === b.mode && prev.exit.ground && b.entry.ground && prev.exit.grav > 0 && b.entry.grav > 0 && Math.abs(prev.exit.y - b.entry.y) < 0.5;
        for (const gap of canGap && o.breathers !== false ? GAPS : [0]) {
          if (T + gap + b.s > end + 0.6) continue;
          const bc = beatCost(b, T + gap, targets); scored.push({ b, bc, gap, score: bc.cost + base + gap * 25 });
        }
      }
      scored.sort((a, b) => a.score - b.score);
      // with o.verify: the join with the brick before is solved (lego_join checkFilled: real entry state + filler); the
      // best few candidates are tried in order, the first clean join wins
      let c = null;
      for (const s of scored.slice(0, o.verify && prev ? 6 : 1)) { if (!o.verify || !prev || o.verify(prev, s.b)) { c = s; break; } }
      if (!c) { used.add(scored[0].b.id); continue; }
      chain.push({ b: c.b, T: Math.round((T + c.gap) * 1000) / 1000, gap: c.gap || 0, beat: c.bc, section: sec.mode });
      used.add(c.b.id); prev = c.b; if (c.b.auto) autoT += c.b.s; T += c.b.s + (c.gap || 0); if (c.gap) autoT += c.gap; first = false;
    }
  }
  return { chain, targets, len: T };
}
// the chain as one level: bricks side by side by width, a mode / speed portal at each seam that needs one
function assemble(chain, fill) {
  const lead = 6 * B, objs = []; let x = lead;
  const seams = [];
  chain.forEach((c, i) => {
    const b = c.b, p = i ? chain[i - 1].b : null;
    if (p && c.gap) {   // the breather: plain floor at the height the last brick left the player on, at its speed
      const gw = Math.round(c.gap * p.w / p.s) * B, fy = Math.round((p.exit.y - 0.5) * B / B) * B - B / 2;
      if (fy > 0) for (let gx = x + B / 2; gx < x + gw; gx += B) objs.push(Object.assign(J.portal(1, gx, fy), {}));
      x += gw;
    }
    if (p && (b.speed || 1) !== (p.speed || 1)) objs.push(J.portal(J.SPEED_ID[b.speed || 1] || 201, x - 20, Math.max(15, b.path[0][1] * B)));
    // a section boundary may change gravity too: a gravity portal stacked over the height (10 normal, 11 upside down)
    if (p && b.entry.grav !== p.exit.grav) { const top = Math.max(...p.path.map(q => q[1]), ...b.path.map(q => q[1])) * B + 120; for (let y = 45; y <= top; y += 90) objs.push(J.portal(b.entry.grav < 0 ? 11 : 10, x - 40, y)); }
    if (p && b.mode !== p.mode) { const top = Math.max(...p.path.map(q => q[1]), ...b.path.map(q => q[1])) * B + 120; for (let y = 45; y <= top; y += 90) objs.push(J.portal(J.MODE_ID[b.mode], x - 10, y)); }
    objs.push(...J.objectsOf(b, i ? x : x - 2 * B, i ? 0 : 2));
    seams.push(x); x += b.w * B;
  });
  objs.push(...(fill || []));
  const e = J.entryState(chain[0].b);
  const start = { ...e.s, used: [], x: e.s.x - chain[0].b.xa * B + lead, tick: 0 };
  return { level: { header: J.sourceOf(chain[0].b).level.header, objects: objs }, seams, end: x, lead, start, held: e.held };
}
function ownY(chain, A, xw) {
  let i = A.seams.length - 1; while (i > 0 && A.seams[i] > xw) i--;
  const P = chain[i].b.path, rx = (xw - A.seams[i]) / B;
  for (let k = 1; k < P.length; k++) if (P[k][0] >= rx) return P[k][1] * B;
  return P[P.length - 1][1] * B;
}
function solveFilled(chain, rounds = 8) {
  const fill = []; let A, r, res = {};
  for (let k = 0; k <= rounds; k++) {
    A = assemble(chain, fill);
    const w = GD.makeWorld(A.level.objects, A.level.header);
    try { r = GD.solveSweep(w, { start: A.start, held: A.held, cap: 20000 }); } catch (e) { r = { ok: false, why: e.message }; }
    res = { ok: !!(r && r.ok), rounds: k, spikes: fill.length };
    if (!res.ok) { res.why = (r && r.why) || "no clear"; const dx = r && r.dieAt ? r.dieAt.x : null; if (dx != null) { let i = A.seams.length - 1; while (i > 0 && A.seams[i] > dx) i--; res.dieBrick = i; res.dieBlock = Math.round((dx - A.seams[i]) / 3) / 10; } break; }
    const run = GD.run(w, r.events), off = [];
    for (const s of run.path) { const [wx, wy] = GD.worldXY ? GD.worldXY(s) : [s.x, s.y]; if (wx < A.lead || wx > A.end) continue; if (Math.abs(wy - ownY(chain, A, wx)) > 2.5 * B) off.push([wx, wy]); }
    res.secret = off.length > 1 && off[off.length - 1][0] - off[0][0] >= B; res.events = r.events;
    if (!res.secret || k === rounds) break;
    let lastX = -1e9; for (const [wx, wy] of off) if (wx - lastX >= B) { fill.push(J.spike(Math.round(wx / 15) * 15, Math.round(wy / 15) * 15)); lastX = wx; }
  }
  return { res, A };
}

if (require.main === module) {
  const a = process.argv.slice(2), opt = (k, d) => { const i = a.indexOf("--" + k); return i >= 0 ? a[i + 1] : d; };
  const sections = String(opt("sections", "cube:20")).split(",").map(s => { const [m, t] = s.split(":"); return { mode: m, s: +t }; });
  const len = sections.reduce((s, x) => s + x.s, 0), name = opt("name", "pick_" + (opt("seed", "1")));
  const hitsF = opt("hits"), hits = hitsF ? JSON.parse(fs.readFileSync(hitsF, "utf8")) : null;
  const o = { sections, src: opt("src", "official"), hits: hits ? (Array.isArray(hits) ? hits : hits.times || hits.hits).map(Number).sort((x, y) => x - y) : null, song: opt("song"), bpm: +opt("bpm", 0) || undefined, t0: +opt("t0", 0), every: +opt("every", 1), diff: opt("diff") != null ? +opt("diff") : undefined, seed: +opt("seed", 1), len };
  if (a.includes("--no-breathers")) o.breathers = false;
  if (!a.includes("--no-solve") && !a.includes("--no-verify")) { let nv = 0, bad = 0; o.verify = (A, Bp) => { nv++; const r = J.checkFilled(A, Bp).res; const ok = r.ok && !r.secret; if (!ok) bad++; process.stdout.write(`  join ${A.id} + ${Bp.id}: ${ok ? "ok" : "no (" + (r.why || "secret way") + ")"}\n`); return ok; }; }
  const t0 = Date.now(), Pk = pick(o);
  const on = Pk.chain.reduce((s, c) => s + c.beat.on, 0), np = Pk.chain.reduce((s, c) => s + c.beat.n, 0);
  for (const c of Pk.chain) console.log(`${c.T.toFixed(2).padStart(6)} s  ${c.section.padEnd(6)} ${c.b.id.padEnd(40)} ${c.b.sig.padEnd(34)} presses ${c.beat.n}, on a beat ${c.beat.on}, off by ${Math.round(c.beat.cost)} ms avg`);
  console.log(`${Pk.chain.length} bricks, ${Pk.len.toFixed(1)} s of ${len} s asked; ${on} of ${np} presses within 50 ms of a beat (${Math.round(on / Math.max(1, np) * 100)}%); picked in ${Date.now() - t0} ms`);
  const dir = path.join(ROOT, "local", "lego", "picks"); fs.mkdirSync(dir, { recursive: true });
  const plan = { name, sections, song: o.song || null, bpm: o.bpm || null, every: o.every, bricks: Pk.chain.map(c => ({ id: c.b.id, sig: c.b.sig, mode: c.b.mode, T: c.T, s: c.b.s, w: c.b.w, presses: c.beat.n, onBeat: c.beat.on, offMs: Math.round(c.beat.cost), gap: c.gap || 0 })) };
  if (!a.includes("--no-solve")) {
    // the whole chain: a brick entered from its neighbour is not in its own entry state, so a chain can break where every
    // pair joined cleanly; then that brick is banned and the rest re-picked from there (up to 8 repairs)
    const t1 = Date.now(); let S = solveFilled(Pk.chain), banned = [];
    for (let k = 0; k < 8 && !S.res.ok && S.res.dieBrick != null; k++) {
      const i = Math.max(1, S.res.dieBrick); banned.push(Pk.chain[i].b.id);
      console.log(`  whole chain breaks at brick ${i} (${Pk.chain[i].b.id}): ${S.res.why}; re-picking from there`);
      const P2 = pick(o, { prefix: Pk.chain.slice(0, i), banned }); Pk.chain = P2.chain; Pk.len = P2.len;
      S = solveFilled(Pk.chain);
    }
    plan.bricks = Pk.chain.map(c => ({ id: c.b.id, sig: c.b.sig, mode: c.b.mode, T: c.T, s: c.b.s, w: c.b.w, presses: c.beat.n, onBeat: c.beat.on, offMs: Math.round(c.beat.cost), gap: c.gap || 0 })); plan.repairs = banned;
    plan.solve = { ok: S.res.ok, secret: !!S.res.secret, spikes: S.res.spikes, rounds: S.res.rounds, why: S.res.why || null, dieBrick: S.res.dieBrick, dieBlock: S.res.dieBlock, s: Math.round((Date.now() - t1) / 100) / 10 };
    plan.seams = S.A.seams; plan.events = S.res.events || null; plan.start = { x: S.A.start.x, y: S.A.start.y, mode: S.A.start.mode, held: S.A.held };
    console.log(S.res.ok ? `solved from the first brick's entry state: ${S.res.secret ? "still a secret way after" : "clean after"} ${S.res.rounds} filler rounds, ${S.res.spikes} spikes, ${plan.solve.s} s`
      : `BROKEN at brick ${S.res.dieBrick} (${Pk.chain[S.res.dieBrick] ? Pk.chain[S.res.dieBrick].b.id : "?"}), block ${S.res.dieBlock}: ${S.res.why}`);
    const rec = GD.newRecord(`lego pick ${name}`, "main-level bricks chained by tools/lego_pick.js; local only");
    writeGdlvl(path.join(dir, name + ".gdlvl"), rec, S.A.level);
  }
  fs.writeFileSync(path.join(dir, name + ".json"), JSON.stringify(plan, null, 1));
  console.log(`-> local/lego/picks/${name}.json` + (a.includes("--no-solve") ? "" : ` and .gdlvl`));
}
module.exports = { pick, assemble, solveFilled, beatTargets, beatCost, pool, flagged, isFlagged };
