// node tools/gencheck.js [type ...] [--seeds 8] [--cols 40] [--tier normal] [--hf 2] [--bpm 120] [--write]
//   -- the AI's own critic of the section generators: every type over many seeds, its problems found without Evgeni
//
// Evgeni (2026-11-28, after finding unneeded spider clicks, a path drawn through saws, wave corridors you can slide along
// and orb pieces ending on a deadly floor by eye): "i want to be able and catch those stuff somehow by the AI, not just by
// me". Each generated piece (tools/sectiongen.js, presses-first) is built inside its join like tools/layoutcheck.js
// planCheck and its PLANNED presses are replayed in real physics. Checks (a flag = the generator's bug, not the seed's):
//   dies      the planned presses die in real physics (the plan is not "solved by design")
//   unforced  a planned click (or hold), or two neighbouring ones (a flip and its flip back), can be left out and the
//             piece still clears: no hazard forces it
//   lazy      the piece clears with no press at all, or with the button held the whole way (skipped gameplay)
//   slideable flying: no press or held gets over 60% through before dying (most of it can be slid along floor / ceiling)
//   noplan    the generator returned no planned presses at all (a failed generation)
//   tight     a planned click's player window is under the tier's floor (TIGHT ms below)
//   slide     flying modes: share of the section's ticks spent touching the floor or ceiling (sliding) over SLIDE
//   low       a piece of 12+ rows whose route spans under 35% of them (hugs the ground or the ceiling)
//   outside   the replayed route goes around the structures (tools/outside.js outsideMap) over 10% of the time
//   short     the generator's own drawn path stops before the piece's end (shown as a failed generation on the page)
//   drawn     the generator's own drawn path is over half a row off the real replay
//   end       the last 3 columns of the route pass within a block of a hazard (an ending that lands on death)
// Prints a line per type (share of seeds with each flag, worst example: seed + column) and, with --write,
// knowledge/gencheck.json (the catalogue shows it under each generator). Measured: ~1-3 s a piece (most of it the
// unforced test, one replay per press).
if (require.main === module) require("./heavy.js").claim();
const fs = require("fs"), path = require("path");
const SG = require("./sectiongen.js"), LC = require("./layoutcheck.js"), OU = require("./outside.js");
const { GD } = require("./io.js"), { build } = require("./make.js");
const TIGHT = { easy: 90, normal: 65, hard: 50, harder: 40, extreme: 30 };   // ms: a guess from DIFFICULTY.md's tier ladder
const SLIDE = 0.35, SLIDEOK = 0.6;
const FLY = new Set(["ship", "wave", "ufo", "swing"]);
const HAZ = /[\^vosq]/;

function quiet(f) { const log = console.log, warn = console.warn; console.log = () => {}; console.warn = () => {}; try { return f(); } finally { console.log = log; console.warn = warn; } }

function checkPiece(z, tier) {
  const S = LC.specOf(z), level = quiet(() => build(S.spec, "gencheck:" + z.key, {}).level);
  const w = GD.makeWorld(level.objects, level.header), p0 = GD.run(w, []).path, dx = p0[1].x - p0[0].x;
  const T0 = Math.ceil((S.x0 * 30 - p0[0].x) / dx - 1e-9), tk = c => T0 + Math.round(c * 30 / dx);
  const acts = z.presses.map(q => Array.isArray(q) ? [{ tick: tk(q[0]), type: "press" }, { tick: Math.max(tk(q[0]) + 1, tk(q[1])), type: "release" }]
    : [{ tick: tk(q), type: "press" }, { tick: tk(q) + 1, type: "release" }]);
  const evOf = (skip, skip2 = -1) => acts.filter((a, i) => i !== skip && i !== skip2).flat().sort((a, b) => a.tick - b.tick);
  const W = z.map[0].length, H = z.map.length, ev = evOf(-1), r = GD.run(w, ev), col = s => s.x / 30 - S.x0;
  const f = {};
  if (r.dead || !r.done) { const e = r.path[r.path.length - 1]; f.dies = { col: +col(e).toFixed(1), why: r.why || "" }; return f; }
  const inSec = r.path.filter(s => col(s) >= 0 && col(s) <= W);
  // unforced: leave each click out
  const un = []; acts.forEach((a, i) => { const r2 = GD.run(w, evOf(i)); if (r2.done && !r2.dead) un.push(+(Array.isArray(z.presses[i]) ? z.presses[i][0] : z.presses[i]).toFixed(1)); });
  // ... and each PAIR of neighbouring clicks: a flip and its flip back (spider, gravity) can be both unneeded while each
  // alone is needed (Evgeni 2026-11-28: "the spides does some clicks that are not needed. no hazards are there force this")
  const cOf = i => +(Array.isArray(z.presses[i]) ? z.presses[i][0] : z.presses[i]).toFixed(1);
  for (let i = 0; i + 1 < acts.length; i++) { if (un.includes(cOf(i)) || un.includes(cOf(i + 1))) continue;
    const r2 = GD.run(w, evOf(i, i + 1)); if (r2.done && !r2.dead) un.push(cOf(i) + "+" + cOf(i + 1)); }
  if (un.length) f.unforced = { n: un.length, of: acts.length, cols: un };
  // lazy: the piece clears with NO press, or with the button held the whole way (Evgeni 2026-11-28, wave: "could
  // basically slide most the path there (either top or bot)") -- a skipped gameplay, the worst kind of unforced
  const T1 = tk(W + 2), lazy = [];
  { const r0 = GD.run(w, [{ tick: T0 - 2, type: "release" }]); if (r0.done && !r0.dead) lazy.push("no press"); }
  { const r1 = GD.run(w, [{ tick: T0, type: "press" }, { tick: T1, type: "release" }]); if (r1.done && !r1.dead) lazy.push("held all the way"); }
  if (lazy.length) f.lazy = { how: lazy.join(", ") };
  // slideable: in a flying mode, the button left alone (slide the floor) or held (slide the ceiling) still gets over SLIDEOK
  // of the way through before it dies (Evgeni 2026-11-28, wave at height x2: "could basically slide most the path there
  // (either top or bot)" -- lazy only caught a slide of the WHOLE piece)
  if (!lazy.length && FLY.has(z.mode)) { const far = ev => { const q = GD.run(w, ev), e = q.path[q.path.length - 1]; return Math.max(0, Math.min(1, col(e) / W)); };
    const bot = far([{ tick: T0 - 2, type: "release" }]), top = far([{ tick: T0, type: "press" }, { tick: T1, type: "release" }]);
    if (Math.max(bot, top) > SLIDEOK) f.slideable = { share: +Math.max(bot, top).toFixed(2), how: bot >= top ? "along the floor" : "along the ceiling" }; }
  // tight windows
  try { const win = require("../lib/windows.js").inputWindows(w, ev, r.path, {}).map(x => ({ col: +col(r.path[Math.min(x.tick, r.path.length - 1)]).toFixed(1), ms: Math.round((x.hi - x.lo + 1) / GD.PHYS.TPS * 1000) }))
      .filter(x => x.col >= -1 && x.col <= W + 1 && x.ms < (TIGHT[tier] || 60)).sort((a, b) => a.ms - b.ms);
    if (win.length) f.tight = { n: win.length, ms: win[0].ms, col: win[0].col }; } catch (e) {}
  // sliding along the floor / ceiling in a flying mode
  if (FLY.has(z.mode) && inSec.length) { const sl = inSec.filter(s => s.grounded).length / inSec.length; if (sl > SLIDE) f.slide = { share: +sl.toFixed(2) }; }
  // route around the structures
  const route = []; for (let t = 0; t < r.path.length; t += 8) { const c = col(r.path[t]); if (c >= -0.5 && c <= W + 0.5) route.push([c, r.path[t].y / 30 - 0.5]); }
  const out = OU.outsideMap(z.map, route); if (out > 0.1) f.outside = { share: +out.toFixed(2) };
  // low: the route keeps to a thin band at the bottom (or top) of a tall piece (Evgeni 2026-11-28, wave at height x2: "the
  // wave corridors now stay a bit too much on the grounds"; his rule: gameplay spreads over the whole height). Flag when the
  // piece is 12+ rows and the route spans under 35% of them
  if (H >= 12 && route.length) { const ys = route.map(q => q[1]), span = (Math.max(...ys) - Math.min(...ys) + 1) / H;
    if (span < 0.35) f.low = { share: +span.toFixed(2), rows: `${Math.max(0, Math.min(...ys)).toFixed(0)}-${Math.max(...ys).toFixed(0)} of ${H}` }; }
  // short: the generator's own drawn path stops before the piece's end (Evgeni 2026-11-28: "the path should reach till the
  // end. any failing generation of physics is obviously a bug")
  if (z.path && z.path.length && z.path[z.path.length - 1][0] < W - 1.5) f.short = { col: +z.path[z.path.length - 1][0].toFixed(1) };
  // drawn vs real
  if (z.path && z.path.length && z.pathFrom !== "replay") { let worst = 0, at = 0;
    for (const [c, row] of z.path) { const s = inSec.find(q => col(q) >= c); if (!s) continue; const d = Math.abs(s.y / 30 - 0.5 - row); if (d > worst) { worst = d; at = c; } }
    if (worst > 0.5) f.drawn = { rows: +worst.toFixed(2), col: +at.toFixed(1) }; }
  // the ending: the last 3 columns pass within a block of a hazard
  const near = (c, y) => { for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 1; dr++) { const cc = Math.floor(c) + dc, rr = Math.floor(y) + dr;
      if (cc >= 0 && cc < W && rr >= 0 && rr < H && HAZ.test(z.map[H - 1 - rr][cc])) return true; } return false; };
  const tail = inSec.filter(s => col(s) >= W - 3); if (tail.some(s => near(col(s), s.y / 30))) f.end = { col: W - 3 };
  return f;
}

function run(keys, o) {
  const res = {};
  for (const key of keys) { const rows = [];
    for (let seed = 1; seed <= o.seeds; seed++) { let z; try { z = quiet(() => { const bo = o.bpm ? { bpm: o.bpm } : {}; let q = SG.make(key, { cols: o.cols, seed, tier: o.tier, ...bo });
        // the catalogue's "height xN": the type's own rows times N (designs_tab.js generate)
        if (o.hf && o.hf !== 1) q = SG.make(key, { cols: o.cols, seed, tier: o.tier, ...bo, rows: Math.round(q.map.length * o.hf) }); return q; }); } catch (e) { rows.push({ seed, err: e.message }); continue; }
      // a presses-first type that comes back with no plan is a failed generation (Evgeni 2026-11-28: "some of the
      // generations have no paths"; "any failing generation of physics is obviously a bug"): flagged, not skipped
      if (!z.presses || !z.presses.length) { rows.push({ seed, noplan: true }); continue; }
      z.key = key; const t = Date.now(); let f; try { f = checkPiece(z, o.tier); } catch (e) { f = { error: { why: e.message } }; } rows.push({ seed, f, ms: Date.now() - t }); }
    // (a type that plans on some seeds and not on others: the others are failed generations)
    if (rows.some(x => x.f)) for (const x of rows) if (x.noplan) { delete x.noplan; x.f = { noplan: { why: "no planned presses" } }; }
    const planned = rows.filter(x => x.f), kinds = ["noplan", "dies", "short", "lazy", "slideable", "unforced", "tight", "slide", "outside", "low", "drawn", "end", "error"], sum = {};
    for (const k of kinds) { const hit = planned.filter(x => x.f[k]); if (hit.length) sum[k] = { share: +(hit.length / planned.length).toFixed(2), example: Object.assign({ seed: hit[0].seed }, hit[0].f[k]) }; }
    res[key] = { pieces: planned.length, noplan: rows.filter(x => x.noplan).length, flags: sum, at: new Date().toISOString().slice(0, 16), opts: o };
    const s = Object.entries(sum).map(([k, v]) => `${k} ${Math.round(v.share * 100)}% (seed ${v.example.seed}${v.example.col != null ? " col " + v.example.col : ""}${v.example.cols ? " cols " + v.example.cols.join(",") : ""}${v.example.ms ? " " + v.example.ms + " ms" : ""}${v.example.share != null ? " " + Math.round(v.example.share * 100) + "%" : ""}${v.example.rows ? " " + v.example.rows + " rows" : ""}${v.example.why ? " " + v.example.why : ""}${v.example.how ? ": " + v.example.how : ""}${v.example.rows && typeof v.example.rows === "string" ? "" : ""})`);
    console.log(key.padEnd(14) + (planned.length ? `${planned.length} pieces: ` + (s.length ? s.join(" · ") : "clean") : "no plan (shape first)")); }
  return res;
}

if (require.main === module) {
  const a = process.argv.slice(2), opt = (n, d) => { const i = a.indexOf("--" + n); return i >= 0 ? a[i + 1] : d; };
  const o = { seeds: +opt("seeds", 8), cols: +opt("cols", 40), tier: opt("tier", "normal"), hf: +opt("hf", 1), bpm: +opt("bpm", 0) };
  const keys = a.filter((x, i) => !x.startsWith("--") && !(i && a[i - 1].startsWith("--") && a[i - 1] !== "--write"));
  const res = run(keys.length ? keys : SG.KEYS.filter(k => k !== "hanging"), o);
  if (a.includes("--write")) { const F = path.join(__dirname, "..", "knowledge", "gencheck.json"), old = (() => { try { return JSON.parse(fs.readFileSync(F, "utf8")); } catch (e) { return {}; } })();
    fs.writeFileSync(F, JSON.stringify(Object.assign(old, res), null, 1) + "\n"); console.log("-> knowledge/gencheck.json"); }
}
module.exports = { checkPiece, run, TIGHT };
