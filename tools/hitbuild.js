// node tools/hitbuild.js briefs/<NN>.hits.json   -> specs/<NN>.json + local/hitroutes/<NN>.json
//   -- BEAT-FIRST build of an ultra-synced level (the user on GDLM 62 v2, 2026-11-24: "the whole point of
//      ultra sync is the clicks to match the beat. so you need to make the layout with the beats, see it
//      works"). The presses come first and never move: one tap EXACTLY on each planned hit (tools/hits.js).
//      1. ship sections: a press / release schedule on the section's hits, flown in open air, and the
//         corridor built around that path (2 blocks of air above and below) -- the path is the design;
//      2. cube and ball cells: each obstacle is placed, then moved (never the tap) until its hit sits in the
//         middle of its timing window -- window found by replaying the planned taps in the sim (one run
//         each, ~70 ms; no solving), the other taps fixed; orb cells also centre the orb's own tap on its
//         half-beat hit;
//      3. the planned taps replayed: the level must clear with them and nothing else (no extra presses).
//   Then build and check-solve it as usual (node tools/loop.js specs/<NN>.json), and put the planned route
//   as the level's route: node tools/hitroute.js <plan> <level> --save (taps on the hits in the viewer).
//   Takes the heavy slot (a few hundred replays, ~1-3 min for a 60 s level).
if (require.main === module) require("./heavy.js").claim();
const fs = require("fs"), path = require("path");
const { GD } = require("./io.js");
const HL = require("./hitlevel.js");
const make = require("./make.js");

const TPS = 240, TAP = Math.round(0.06 * TPS);
const PH = require("../lib/physics.js"), UPS = PH.SPEEDS[1].x * 60;

function gameplayWorld(plan, opts) {
  const { spec } = HL.build(plan, Object.assign({ numeric: true }, opts));
  const g = Object.assign({}, spec, { objects: spec.objects.filter(e => Array.isArray(e) && !["colour", "fade", "zoom"].includes(e[0])), modern: null, style: "none", signature: false, colours: null, art: null });
  const log = console.log; console.log = () => {};
  try { const b = make.build(g, "hitbuild"); return GD.makeWorld(b.level.objects, b.level.header); }
  finally { console.log = log; }
}
const evOf = (taps, extra) => {
  const ev = [];
  for (const t of taps) { ev.push({ tick: t, type: "press" }); ev.push({ tick: t + TAP, type: "release" }); }
  return ev.concat(extra || []).sort((a, b) => a.tick - b.tick || (a.type === "release" ? -1 : 1));
};
const lastOf = r => r.path[r.path.length - 1];

// a ship section: schedule on the hits, flown in open air; corridor around the path
function shipSection(plan, si, hits, tOf, col) {
  const s = plan.sections[si], next = plan.sections[si + 1];
  const t0 = tOf(s.from), t1 = tOf(next.from);
  const slots = hits.slots.filter(h => "KSA".includes(h.kind) && h.t > t0 + 0.3 && h.t < t1 - 0.3);
  const portalX = col(s.from) * 30 + 15, endX = col(next.from) * 30 + 15;
  // a far, high block only marks the world's end (a run stops a little after the last object)
  const open = [{ id: 13, x: portalX, y: 45, rot: 0, props: {} }, { id: 1, x: endX + 900, y: 600, rot: 0, props: {} }];
  const w = GD.makeWorld(open, GD.DEFAULT_HEADER);
  const sched = [];   // {tick, type}
  let holding = false;
  const target = t => (t > t1 - 2.2 * 60 / plan.grid.bpm ? 50 : 150);   // mid band, low before the exit
  const yAt = (ev, tick) => { const r = GD.run(w, ev); const q = r.path[Math.min(tick, r.path.length - 1)]; return q; };
  for (let k = 0; k < slots.length; k++) {
    const tick = Math.round(slots[k].t * TPS), nextTick = k + 1 < slots.length ? Math.round(slots[k + 1].t * TPS) : Math.round(t1 * TPS);
    const look = Math.min(nextTick + 60, Math.round(t1 * TPS));
    const cost = ev => { const q = yAt(ev, look), m = yAt(ev, nextTick); return Math.abs(m.y - target(nextTick / TPS)) + 0.5 * Math.abs(q.y - target(look / TPS)) + (q.y < 20 || q.y > 280 ? 500 : 0); };
    const keep = sched.slice(), flip = sched.concat([{ tick, type: holding ? "release" : "press" }]);
    if (cost(flip) < cost(keep) - 4) { sched.push(flip[flip.length - 1]); holding = !holding; }
  }
  if (holding) sched.push({ tick: Math.round((t1 - 0.25) * TPS), type: "release" });
  const run = GD.run(w, sched).path;
  // corridor: per column, the path's lowest / highest centre in it, 2 blocks of air each side
  const c0 = Math.ceil(col(s.from) + 1), c1 = Math.floor(col(next.from));
  const lo = {}, hi = {};
  for (const q of run) { const c = Math.floor(q.x / 30); if (c < c0 - 1 || c > c1 + 1) continue; lo[c] = Math.min(lo[c] ?? 1e9, q.y); hi[c] = Math.max(hi[c] ?? -1e9, q.y); }
  const o = [["ship portal", +col(s.from).toFixed(3), 1]];
  const fr = {}, rr = {};
  for (let c = c0; c <= c1; c++) {
    const l = Math.min(lo[c - 1] ?? 1e9, lo[c] ?? 1e9, lo[c + 1] ?? 1e9), h = Math.max(hi[c - 1] ?? -1e9, hi[c] ?? -1e9, hi[c + 1] ?? -1e9);
    if (!(l < 1e8 && h > -1e8)) throw new Error(`ship path does not reach column ${c} (the open-air run ended early)`);
    fr[c] = Math.max(0, Math.floor((l - 60) / 30)); rr[c] = Math.min(10, Math.ceil((h + 60) / 30));
  }
  for (let c = c0; c < c1; c++) {
    for (let r = 0; r < fr[c]; r++) o.push(["block", c, r]);
    for (let r = rr[c]; r < 10; r++) o.push(["block", c, r]);
  }
  // the exit: a cube portal where the path crosses the section's last beat, framed above and below
  const ex = run.find(q => q.x >= endX - 15) || run[run.length - 1];
  const er = Math.max(1, Math.round((ex.y - 15) / 30));
  o.push(["cube portal", +col(next.from).toFixed(3), er]);
  for (let r = 0; r < 10; r++) if (r < er - 1 || r > er + 1) o.push(["block", +col(next.from).toFixed(3), r]);
  return { objects: o, sched: sched.map(e => ({ tick: e.tick, type: e.type })), presses: sched.filter(e => e.type === "press").length };
}

function main() {
  const planFile = process.argv[2];
  if (!planFile) { console.log("usage: node tools/hitbuild.js briefs/<NN>.hits.json"); process.exit(1); }
  const plan = JSON.parse(fs.readFileSync(planFile, "utf8"));
  const hits = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "local", "hits", plan.song.custom + ".json"), "utf8"));
  const { tOf, col } = HL.build(plan, { numeric: true });
  const opts = { numeric: true, shift: [], orbShift: [], ship: {} };
  // 1. ship sections
  let shipEv = [];
  plan.sections.forEach((s, i) => {
    if (s.kind !== "ship") return;
    const r = shipSection(plan, i, hits, tOf, col);
    opts.ship[i] = r.objects; shipEv = shipEv.concat(r.sched);
    console.log(`ship b${s.from}-b${plan.sections[i + 1].from}: ${r.presses} presses + releases, every one on a hit; corridor built around the path`);
  });
  // 2. the taps: one per cell on its hit (pads are no press); orb cells get a second tap on the half-beat
  const cells = plan.cells.map(([b, kind], i) => ({ i, b, kind, tick: Math.round(tOf(b) * TPS) })).filter(c => c.kind !== "pad");
  const orbTap = c => Math.round(tOf(c.b + 0.5) * TPS);
  const allTaps = () => cells.flatMap(c => c.kind === "orb" ? [c.tick, orbTap(c)] : [c.tick]).sort((a, b) => a - b);
  // does the run get past `until` with tap `which` moved by d ticks?
  const survives = (w, which, d, until) => {
    const taps = allTaps().map(t => t === which ? t + d : t);
    const q = lastOf(GD.run(w, evOf(taps, shipEv)));
    return !q.dead || q.tick > until;
  };
  const windowOf = (w, which, until) => {
    let start = null;
    for (const d of [0, -8, 8, -16, 16, -24, 24, -32, 32, -40, 40, -48, 48, -60, 60]) if (survives(w, which, d, until)) { start = d; break; }
    if (start === null) return null;
    let lo = start, hi = start;
    while (lo > -100 && survives(w, which, lo - 1, until)) lo--;
    while (hi < 100 && survives(w, which, hi + 1, until)) hi++;
    return { lo, hi };
  };
  for (let k = 0; k < cells.length; k++) {
    const c = cells[k], until = k + 1 < cells.length ? cells[k + 1].tick + 4 : Infinity;
    for (let round = 0; round < 4; round++) {
      const w = gameplayWorld(plan, opts), win = windowOf(w, c.tick, c.kind === "orb" ? orbTap(c) - 2 : until);
      if (!win) { console.log(`   b${c.b} ${c.kind}: no tap near the hit clears it -- check the cell`); break; }
      const mid = (win.lo + win.hi) / 2;
      c.win = win;
      if (Math.abs(mid) <= 1.5) break;
      opts.shift[c.i] = (opts.shift[c.i] || 0) + mid * UPS / TPS / 30;   // window centre later -> obstacle later
    }
    if (c.kind === "orb") for (let round = 0; round < 4; round++) {
      const w = gameplayWorld(plan, opts), win = windowOf(w, orbTap(c), until);
      if (!win) { console.log(`   b${c.b + 0.5} orb tap: no tap near the hit takes the orb`); break; }
      const mid = (win.lo + win.hi) / 2; c.orbWin = win;
      if (Math.abs(mid) <= 1.5) break;
      opts.orbShift[c.i] = (opts.orbShift[c.i] || 0) + mid * UPS / TPS / 30;
    }
    const ms = v => (v / TPS * 1000).toFixed(0);
    if (c.win) console.log(`   b${String(c.b).padEnd(5)} ${c.kind.padEnd(6)} window ${ms(c.win.hi - c.win.lo + 1).padStart(4)} ms, hit ${ms(-c.win.lo)} ms after its start${c.orbWin ? `; orb tap b${c.b + 0.5} window ${ms(c.orbWin.hi - c.orbWin.lo + 1)} ms` : ""}`);
  }
  // 3. the planned taps, nothing else
  const w = gameplayWorld(plan, opts), ev = evOf(allTaps(), shipEv), q = lastOf(GD.run(w, ev));
  const nTaps = allTaps().length, nShip = shipEv.length;
  console.log(q.dead ? `NOT CLEARED: the planned taps die at t=${(q.tick / TPS).toFixed(2)} s, block ${(q.x / 30).toFixed(1)} (${q.why || "?"})`
    : `CLEARED by the planned inputs alone: ${nTaps} taps exactly on hits + ${nShip} ship press/release events on hits; no other input`);
  const wins = cells.flatMap(c => [c.win, c.orbWin]).filter(Boolean).map(v => (v.hi - v.lo + 1) / TPS * 1000);
  if (wins.length) console.log(`tightest window ${Math.min(...wins).toFixed(0)} ms; ${wins.filter(x => x >= 150).length}/${wins.length} windows >= 150 ms`);
  // write the spec (with the look) and the planned route
  const { spec } = HL.build(plan, opts);
  spec.notes = (spec.notes || "") + " Beat-first build (tools/hitbuild.js): the taps are fixed on the hits, obstacles placed around them.";
  const base = path.basename(planFile).replace(/\.hits\.json$/, "");
  fs.writeFileSync(path.join("specs", base + ".json"), JSON.stringify(spec, null, 1));
  const rdir = path.join(__dirname, "..", "local", "hitroutes"); fs.mkdirSync(rdir, { recursive: true });
  fs.writeFileSync(path.join(rdir, base + ".json"), JSON.stringify({ events: ev, taps: allTaps(), cleared: !q.dead, opts: { shift: opts.shift, orbShift: opts.orbShift } }));
  console.log(`-> specs/${base}.json, local/hitroutes/${base}.json`);
  if (q.dead) process.exit(2);
}
if (require.main === module) main();
