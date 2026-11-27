// node tools/feel.js <custom id | Official> [--tier Normal] [--speed 1x] [--to <s>] [--from <s>] [--seed N]
//   [--plan out.plan.json --name "GDLM NN ..." --out specs/NN_x.json --theme <kit>]
//   -- the FEEL of each section of a level (FEEL.md): how fast it moves (speed portal), how dense it is (clicks a second),
//   how tightly its presses follow the song's hits, and its shape inside (rising, front-loaded, a dip), decided from the
//   song -- drops a bit faster, denser and more on the beat, breaks calmer and freer, big speed-ups of the music played
//   with a faster speed -- while every section stays near the level's difficulty target (a difficulty budget: a faster
//   section gets fewer clicks, never tighter windows than the tier's floor). Neighbouring sections are never the same feel
//   (the mains: two sections in a row differ by a median 21% in clicks a second; only 25% are within 10%).
//   Evgeni (2026-11-27): "if there is a drop, it might be a bit faster for example, or more beatful. not to have fully
//   symmetrical visuals/gameplay. the song might have breaks or big speedups, which will play according gameplay (but not
//   too far from the desired difficulty)".
//   Input: tools/songplan.js's sections (cut at the song's transitions, typed by tools/sections.js); targets from
//   knowledge/feel_ref.json (tools/feelstudy.js: the mains per section type) and the tier ladder (DIFFICULTY.md).
//   feel(sections, {song, tier, speed, seed}) -> each section + { feel: {speed, cps, density, hitWeight, onHitTarget, shape,
//   look, windowMin, cost, why} } and a summary; toPlanSections() turns them into tools/planbuild.js sections.
//   --plan: write a whole plan file for tools/planbuild.js (song notes -> hits on the grid if local/hits has none).
//   Light: no solve, under a second.
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const SPEEDS = ["0.5x", "1x", "2x", "3x", "4x"];
// tier -> clicks a second at 1x (DIFFICULTY.md ladder: the mains 1.4-1.9; LEGO.md: rated bricks ~2 at every tier, Evgeni
// "not so sparse") and the tightest window a section may need (the tier's floor, never tightened by the feel)
const TIER = { Easy: { cps: 1.6, win: 100, maxSpeed: 2 }, Normal: { cps: 1.9, win: 90, maxSpeed: 2 }, Hard: { cps: 2.0, win: 70, maxSpeed: 3 },
  Harder: { cps: 2.1, win: 55, maxSpeed: 3 }, Insane: { cps: 2.3, win: 35, maxSpeed: 4 } };
// density by section type: the GDLM 44 v12 vibes Evgeni okayed ("different sections will have somewhat different vibes"),
// as ratios (break 1.7 / groove 2.1 / entry 2.2 / build 2.3 / drop 2.6 clicks a second over a 2.1 mean). The mains are
// flatter (feel_ref.json: drop 1.04, break 1.0 of the level's own), so these are his taste on top of RobTop's habit.
const DENS = { break: 0.82, groove: 0.97, entry: 1.0, build: 1.06, drop: 1.18 };
// how much presses chase the song's hits (brickpick hitWeight, and the share aimed at): "more beatful" drops
const HITW = { drop: 1.6, build: 1.25, entry: 1.0, groove: 1.0, break: 0.6 };
const ONHIT = { drop: 0.8, build: 0.65, entry: 0.6, groove: 0.55, break: 0.4 };
const SHAPE = { drop: "front", build: "rise", break: "dip", entry: "flat", groove: "flat" };
// what a faster speed costs in difficulty against 1x (reading time is shorter; windows in ms stay about the same).
// A GUESS to calibrate with tools/balance.js per-section costs (FEEL.md "Open").
const SPCOST = { "0.5x": 0.9, "1x": 1, "2x": 1.12, "3x": 1.24, "4x": 1.38 };
const BUDGET = [0.75, 1.2];   // a section's cost against the level's target: within this band (a calm break may go to 0.75)
let REF = null; try { REF = JSON.parse(fs.readFileSync(path.join(ROOT, "knowledge", "feel_ref.json"), "utf8")); } catch (e) {}
const rnd = seed => () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

// the song's own speed votes (tools/impacts.js speedPlan in knowledge/song_notes: the music's notes a beat + heaviness)
function speedVotes(song) {
  try { const key = /^\d+$/.test(String(song)) ? "custom_" + song : "official_" + song;
    const j = require("./impacts.js").loadNotes(key); return (j && j.speedPlan || []).map(([t, beat, sp]) => ({ t, l: SPEEDS.indexOf(sp) })); } catch (e) { return []; }
}
const voteAt = (votes, t0, t1) => { if (!votes.length) return null; let s = 0, w = 0;
  for (let i = 0; i < votes.length; i++) { const a = Math.max(t0, votes[i].t), b = Math.min(t1, i + 1 < votes.length ? votes[i + 1].t : 1e9); if (b > a) { s += votes[i].l * (b - a); w += b - a; } }
  return w ? s / w : null; };

const BRICKS = {};
function canSpeed(mode, sp, o) {
  if (o.canSpeed) return o.canSpeed(mode, sp);
  const m = (mode || "cube").replace("-ud", "");
  if (/ship|wave|swing/.test(m)) return true;
  if (!(m + sp in BRICKS)) { try { BRICKS[m + sp] = require("./brickpick.js").bricks(m, "Hard", sp).length; } catch (e) { BRICKS[m + sp] = 0; } }
  return BRICKS[m + sp] >= 4;
}
function feel(sections, o = {}) {
  const tier = TIER[o.tier || "Normal"] || TIER.Normal, base = SPEEDS.indexOf(o.speed || "1x"), R = rnd(o.seed || 7);
  const votes = speedVotes(o.song), vMed = (() => { const v = votes.map(x => x.l).sort((a, b) => a - b); return v.length ? v[Math.floor(v.length / 2)] : base; })();
  const hs = sections.map(s => s.heavy ?? 0.5), hMean = hs.reduce((a, b) => a + b, 0) / hs.length;
  const hq = p => hs.slice().sort((a, b) => a - b)[Math.min(hs.length - 1, Math.floor(p * hs.length))];
  const total = sections.reduce((a, s) => a + (s.t1 - s.t0), 0);
  let fastT = 0, prev = null, slowUsed = false;
  const out = sections.map((s, i) => {
    const d = s.t1 - s.t0, type = s.type || "groove", why = [];
    // ---- speed: one step up for a heavy drop / a big rise in heaviness / the song's own vote; one down for a long, calm break
    let l = base;
    const vote = voteAt(votes, s.t0, s.t1), dh = prev ? (s.heavy ?? 0.5) - (prev.heavy ?? 0.5) : 0;
    const fly = /ship|wave|swing|ufo/.test(s.mode || "");
    if (type === "drop" && (s.heavy ?? 0) >= hq(0.6)) { l = base + 1; why.push("a heavy drop: a step faster"); }
    else if (dh >= 0.15 && (s.heavy ?? 0) >= hq(0.7)) { l = base + 1; why.push(`the music jumps (+${dh.toFixed(2)} heavy): a step faster`); }
    else if (vote != null && vote - vMed >= 1 && (s.heavy ?? 0) >= hMean) { l = base + 1; why.push("the song speeds up here (impacts.js)"); }
    // slower: rare in the mains (13% of their calmest quarter): one slow section a level, a long calm break the song also
    // votes slow for, never the first section and never two in a row
    else if (type === "break" && d >= 6 && (s.heavy ?? 1) <= hq(0.25) && i > 1 && base > 0 && !slowUsed && o.allowSlow !== false && (vote == null || vote - vMed <= -0.5)) { l = base - 1; slowUsed = true; why.push("a long calm break: a step slower"); }
    l = Math.max(0, Math.min(tier.maxSpeed, l));
    // no more than ~35% of the level off its base speed going faster (the mains: 11% of their heaviest quarter goes faster)
    if (l > base && (fastT + d) / total > (o.fastMax || 0.35)) { l = base; why.push("(kept at base: enough fast time already)"); }
    // the ball / spider / robot at 3x+ are "Insane" in a Hard level (GDLM 44 v5's gates): only cube / ship / wave go 3x
    if (l >= 3 && !/cube|ship|wave/.test(s.mode || "cube")) l = 2;
    // only where the builder has gameplay at that speed: our verified bricks are mostly 1x (ball / ufo / robot / spider have
    // none at 2x; GDLM 76's first cut left a 2x ball section empty); flying modes are fly-path corridors at any speed
    if (l !== base && !canSpeed(s.mode, SPEEDS[l], o)) { why.push(`(kept at ${SPEEDS[base]}: no ${s.mode} gameplay at ${SPEEDS[l]})`); l = base; }
    if (l > base) fastT += d;
    const speed = SPEEDS[l];
    // ---- density: the type's ratio, nudged by the section's heaviness against the level's mean
    let dens = (DENS[type] || 1) * (1 + 0.25 * ((s.heavy ?? hMean) - hMean));
    // ---- difficulty budget: cost = density x the speed's cost; kept in BUDGET by moving the clicks, never the windows
    const clamp = x => Math.max(BUDGET[0] / SPCOST[speed], Math.min(BUDGET[1] / SPCOST[speed], x));
    if (clamp(dens) !== dens) { why.push(dens > clamp(dens) ? `fewer clicks at ${speed} (budget)` : "a floor of clicks (budget)"); dens = clamp(dens); }
    // ---- not symmetrical: two sections in a row at the same feel get pushed apart (the mains: a median 21% step), the
    // way that stays inside the budget
    let forceShape = false;
    if (prev && Math.abs(dens - prev.feel.density) < 0.1 && speed === prev.feel.speed) {
      // the way the song says: a denser type (drop > build > entry > groove > break) goes up, a calmer one down, the same
      // type by its heaviness; when the budget blocks that way, the twin stays and only its shape changes (a drop never
      // turns calmer to be different, a break never denser)
      const dt = (DENS[type] || 1) - (DENS[prev.type] || 1), dir = dt > 0.01 ? 1 : dt < -0.01 ? -1 : (s.heavy ?? 0.5) >= (prev.heavy ?? 0.5) ? 1 : -1;
      const want = prev.feel.density + dir * (0.14 + 0.06 * R());
      if (clamp(want) === want) { dens = want; why.push(dir > 0 ? "denser than the section before (no twin)" : "calmer than the section before (no twin)"); }
      else forceShape = true; }
    const cost = dens * SPCOST[speed];
    let shape = SHAPE[type] || "flat";
    if (prev && (shape === prev.feel.shape || forceShape) && (shape === "flat" || forceShape)) { const alt = ["rise", "front", "dip"].filter(x => x !== prev.feel.shape && (type !== "drop" || x !== "dip"));
      shape = alt[Math.floor(R() * alt.length)]; why.push(`shaped ${shape}, unlike the one before`); }
    const look = type === "drop" || l > base ? "intense" : type === "break" || l < base ? "calm" : "normal";
    const f = { speed, density: +dens.toFixed(2), cps: +(tier.cps * dens).toFixed(2), hitWeight: HITW[type] ?? 1, onHitTarget: ONHIT[type] ?? 0.55,
      shape, look, windowMin: tier.win, cost: +cost.toFixed(2), why: why.join("; ") || type };
    const r = Object.assign({}, s, { feel: f }); prev = r; return r;
  });
  const costs = out.map(s => s.feel.cost), mean = costs.reduce((a, b) => a + b, 0) / costs.length;
  const steps = out.slice(1).map((s, i) => Math.abs(s.feel.density - out[i].feel.density));
  return { sections: out, summary: { tier: o.tier || "Normal", base: SPEEDS[base], meanCost: +mean.toFixed(2), maxCost: +Math.max(...costs).toFixed(2), minCost: +Math.min(...costs).toFixed(2),
    fastShare: +(fastT / total).toFixed(2), speedChanges: out.filter((s, i) => i && s.feel.speed !== out[i - 1].feel.speed).length,
    medianStep: steps.length ? +steps.slice().sort((a, b) => a - b)[Math.floor(steps.length / 2)].toFixed(2) : 0,
    twins: out.slice(1).filter((x, i) => x.feel.speed === out[i].feel.speed && x.feel.shape === out[i].feel.shape && Math.abs(x.feel.density - out[i].feel.density) < 0.1).length, ref: REF ? { mainsMedianStep: REF.neighbours.cpsStep.median, mainsFlatShare: REF.neighbours.flatShare } : null } };
}

// planbuild sections from songplan + feel (beats on the plan's grid). The feel goes along as s.feel; planbuild reads
// speed, minDensity (from cps) and hitWeight from it.
function toPlanSections(fs_) {
  return fs_.sections.map((s, i) => { const m = s.mode === "cube-ud" ? "cube" : s.mode;
    return Object.assign({ from: s.b0, to: s.b1, mode: m, speed: s.feel.speed, kind: `${s.type}${s.feel.speed !== fs_.summary.base ? " " + s.feel.speed : ""}`, feel: s.feel },
      s.rest ? { rest: s.rest } : {}); });
}

// the look per section from a theme kit's variants (tools/themes/<name>.js, each with an energy): calm -> the calmest,
// intense -> the most energetic, normal -> the ones between; ties and repeats rotate, so two sections with one feel do not
// share one look (Evgeni: "not to have fully symmetrical visuals"); a flying section prefers a variant whose piece is clouds
function themeLooks(theme, fs_) {
  const V = require(`./themes/${theme}.js`).VARIANTS, names = Object.keys(V).sort((a, b) => (V[a].energy ?? 0.7) - (V[b].energy ?? 0.7));
  const lo = names.slice(0, Math.max(1, Math.floor(names.length / 3))), hi = names.slice(-Math.max(1, Math.floor(names.length / 3))), mid = names.filter(n => !lo.includes(n) && !hi.includes(n));
  const k = { calm: 0, normal: 0, intense: 0 };
  return fs_.sections.map(s => { const pool = s.feel.look === "calm" ? lo : s.feel.look === "intense" ? hi : (mid.length ? mid : names);
    const air = pool.find(n => /cloud|sky|air/.test(V[n].piece || "")) || names.find(n => /cloud/.test(V[n].piece || ""));
    if (/ship|wave|swing/.test(s.mode) && air && s.feel.look !== "calm") return air;
    return pool[k[s.feel.look]++ % pool.length]; });
}

// a hits file (tools/hits.js's format) from the committed song notes, for a computer without the song's audio (the cloud).
// Approximate: a half-beat slot takes the strongest note within 35 ms; low >= 0.6 -> K, mid / top >= 0.6 -> S, >= 0.3 -> x,
// the bar's strongest at >= 0.9 -> A.
function slotsFromNotes(song, grid) {
  const j = require("./impacts.js").loadNotes(/^\d+$/.test(String(song)) ? "custom_" + song : "official_" + song);
  const P = 60 / grid.bpm, slots = [], end = j.notes[j.notes.length - 1][0];
  for (let k = 0; grid.t0 + k * P / 2 < end; k++) {
    const t = grid.t0 + k * P / 2; let best = null;
    for (const n of j.notes) { if (n[0] < t - 0.035) continue; if (n[0] > t + 0.035) break; if (!best || n[1] > best[1]) best = n; }
    const kind = !best ? "." : best[1] >= 0.6 ? (best[2] === "low" ? "K" : "S") : best[1] >= 0.3 ? "x" : ".";
    slots.push({ beat: +(1 + k / 2).toFixed(1), t: +t.toFixed(4), all: best ? best[1] : 0, kind });
  }
  for (let b = 0; b < slots.length; b += 8) { const bar = slots.slice(b, b + 8), m = bar.reduce((a, x) => x.all > a.all ? x : a, bar[0]); if (m && m.all >= 0.9) m.kind = "A"; }
  return { t0: grid.t0, bpm: grid.bpm, source: "song notes (tools/feel.js slotsFromNotes)", slots };
}
module.exports = { feel, toPlanSections, slotsFromNotes, themeLooks, TIER, DENS, SPCOST };

if (require.main === module) {
  const a = process.argv.slice(2), opt = k => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : undefined; };
  if (!a[0]) { console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n")); process.exit(1); }
  const SP = require("./songplan.js").plan(a[0], { to: opt("--to") ? +opt("--to") : undefined, from: opt("--from") ? +opt("--from") : undefined });
  const r = feel(SP.sections, { song: a[0], tier: opt("--tier") || "Normal", speed: opt("--speed") || "1x", seed: +(opt("--seed") || 7) });
  for (const s of r.sections) { const f = s.feel;
    console.log(`b${String(s.b0).padEnd(4)}-${String(s.b1).padEnd(4)} ${String(s.t0).padStart(5)}-${String(s.t1).padEnd(5)} ${s.type.padEnd(6)} ${s.mode.padEnd(7)} ${f.speed.padEnd(4)} ${String(f.cps).padEnd(4)} cps  hits x${f.hitWeight}  ${f.shape.padEnd(5)} ${f.look.padEnd(7)} cost ${f.cost}  ${f.why}`); }
  console.log(JSON.stringify(r.summary));
  if (opt("--plan")) {
    const j = require("./impacts.js").loadNotes(/^\d+$/.test(a[0]) ? "custom_" + a[0] : "official_" + a[0]);
    const grid = { bpm: j.bpm, t0: j.t0 }, hitsRel = path.join("local", "hits", a[0] + ".json"), hitsAbs = path.join(ROOT, hitsRel);
    if (!fs.existsSync(hitsAbs)) { fs.mkdirSync(path.dirname(hitsAbs), { recursive: true }); fs.writeFileSync(hitsAbs, JSON.stringify(slotsFromNotes(a[0], grid))); console.log("-> " + hitsRel + " (from the song notes)"); }
    const secs = toPlanSections(r), plan = { name: opt("--name") || `GDLM feel ${a[0]}`, desc: "Made by Claude.", notes: `tools/feel.js ${a.join(" ")}`,
      out: opt("--out") || `specs/feel_${a[0]}.json`, song: +a[0], offset: SP.from, bpm: grid.bpm, t0: grid.t0, end: secs[secs.length - 1].to,
      hits: hitsRel.replace(/\\/g, "/"), feelSummary: r.summary, spec: { outro: +(opt("--seed") || 7) },
      pulseZones: r.sections.filter(s => s.feel.look === "intense").map(s => [s.b0, s.b1]), sections: secs };
    if (opt("--theme")) { plan.theme = opt("--theme"); const v = themeLooks(plan.theme, r); secs.forEach((x, i) => x.variant = v[i]); }
    fs.writeFileSync(opt("--plan"), JSON.stringify(plan, null, 1) + "\n"); console.log("-> " + opt("--plan"));
  }
}
