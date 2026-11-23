// node tools/retarget.js <level> --to <easier | harder | Easy..Insane | 1-10 stars | a score> [--max N] [--spots K]
//                        [--no-shots] [--dry] [--session s] [--json]
//
// MAKE IT EASIER / HARDER (USE_CASES 13, EDITING.md "Retarget"). Uses the difficulty model (lib/difficulty.js: each
// input's timing window -> a hit chance; the score = log10 of the attempts a player needs, DIFFICULTY.md) on the
// level's human route, and changes the hardest spots first (easier) or the most generous ones (harder), one small
// edit at a time through tools/edit.js's ops, on a COPY:
//   easier  at the costliest inputs: shrink a hazard row by one, move it a block later (more run-up), lower a step
//           ahead by a row, widen the landing by a block, move an orb half a block either way
//   harder  at the widest cube/robot inputs: lengthen a hazard row by one, move it a block earlier
// Each candidate is re-solved (the old route if it still clears, else lib/incsolve.js; never a full solve per
// candidate), scored on the inputs within 8 blocks of it (their windows measured again), and the best one is kept
// only if the level still beats and the quick checks (tools/edit.js) get no new issue. After each kept edit the
// whole level is scored again; it stops at the target, after --max edits (default 8) or when nothing helps.
// Untouched: portals (so the song sync stays), decoration, colours, triggers. The route stays the human route.
//   --to     easier / harder (lowercase): one tier (DIFFICULTY.md cuts: Easy < 0.3 < Normal < 0.8 < Hard < 1.5 < Harder < 2.5
//            < Insane < 4); a tier name; stars 1-10 (2 Easy, 3 Normal, 4-5 Hard, 6-7 Harder, 8-9 Insane, 10 Demon);
//            or a number with a point (a score, e.g. 0.5)
//   --spots  how many inputs to try per round (default 4)
// Prints the score and tier before -> after, every edit kept, a per-section curve (mode, inputs, tightest window,
// score share) before and after, a before/after picture at the biggest change. Writes local/edits/<slug>.<dir><N>.gdlvl
// + .json. Heavy (difficulty windows, re-solves): the one-heavy-job slot.
if (require.main === module && !process.argv.includes("--dry")) require("./heavy.js").claim();   // one heavy job at a time (tools/heavy.js)
"use strict";
const fs = require("fs"), path = require("path");
const { GD, readGdlvl } = require("./io.js");
Object.assign(GD, require("../lib/difficulty.js"));
const E = require("./edit.js");
const ROOT = path.join(__dirname, ".."), OUT = path.join(ROOT, "local", "edits"), TPS = GD.PHYS.TPS;
const rel = f => path.relative(ROOT, f).replace(/\\/g, "/");
const slug = s => String(s || "level").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
const kindOf = o => (GD.objInfo(o.id) || {}).kind || "deco";
const CUTS = [["Easy", 0, 0.3], ["Normal", 0.3, 0.8], ["Hard", 0.8, 1.5], ["Harder", 1.5, 2.5], ["Insane", 2.5, 4], ["Demon", 4, 6]];
const STARS = { 1: "Easy", 2: "Easy", 3: "Normal", 4: "Hard", 5: "Hard", 6: "Harder", 7: "Harder", 8: "Insane", 9: "Insane", 10: "Demon" };
const tierOf = s => (CUTS.find(([, a, b]) => s >= a && s < b) || CUTS[CUTS.length - 1])[0];

// the target as a score range [lo, hi]
function target(to, now) {
  const t = String(to || "").toLowerCase(), i = CUTS.findIndex(c => c[0] === tierOf(now));
  let c;
  // lowercase easier / harder = one tier that way; "Harder" (capital) = the tier Harder
  if (to === "easier") c = CUTS[Math.max(0, i - 1)];
  else if (to === "harder") c = CUTS[Math.min(CUTS.length - 1, i + 1)];
  else if (/^\d+$/.test(t) && +t >= 1 && +t <= 10) c = CUTS.find(x => x[0] === STARS[+t]);
  else if (/^\d*\.\d+$/.test(t)) return { lo: +t - 0.05, hi: +t + 0.05, name: "score " + t };
  else c = CUTS.find(x => x[0].toLowerCase() === t);
  if (!c) throw new Error(`--to ${to}: easier, harder, a tier (Easy..Demon), stars 1-10 or a score like 0.5`);
  // aim inside the tier, not on its edge
  return { lo: c[1] + (c[2] - c[1]) * 0.15, hi: c[2] - (c[2] - c[1]) * 0.15, name: c[0] };
}

const sig = () => (GD.DIFF && GD.DIFF.SIGMA) || undefined;
const cost = a => -Math.log10(Math.max(GD.hitChance(a.ms, sig()), 1e-9));
// the whole level's score and its actions (the model's own number)
function scoreOf(level, sol) {
  const w = GD.makeWorld(level.objects, level.header), d = GD.difficulty(w, { ok: true, events: sol.events }, { route: false });
  return { score: d.logAttempts, tier: tierOf(d.logAttempts), actions: d.actions, tightest: d.tightest, seconds: d.seconds, w };
}
// the windows of the inputs between two x on a route (a local re-measure: the rest of the level is unchanged)
function localActions(level, events, x0, x1) {
  const w = GD.makeWorld(level.objects, level.header), p = GD.run(w, events).path;
  const t0 = Math.max(0, p.findIndex(q => q.x >= x0)), t1i = p.findIndex(q => q.x >= x1), t1 = t1i < 0 ? p.length - 1 : t1i;
  return GD.measureWindows(w, events, { range: [t0, t1] });
}
// sections: the route cut at mode / speed / gravity changes; per section its inputs, tightest window, score
function sections(sc, events) {
  const p = GD.run(sc.w, events).path, cuts = [0];
  for (let i = 1; i < p.length; i++) if (p[i].mode !== p[i - 1].mode || p[i].sp !== p[i - 1].sp) cuts.push(i);
  cuts.push(p.length - 1);
  const out = [];
  for (let k = 0; k + 1 < cuts.length; k++) {
    const a = cuts[k], b = cuts[k + 1]; if (b - a < TPS * 0.5 && out.length) { out[out.length - 1].b = b; continue; }
    out.push({ a, b, mode: p[a + 1 < p.length ? a + 1 : a].mode, x0: p[a].x });
  }
  for (const s of out) {
    let up = 0; for (let t = s.a; t < s.b; t++) if (p[t].grav === -1) up++;
    if (up > (s.b - s.a) * 0.25) s.mode += up > (s.b - s.a) * 0.75 ? " (up)" : " (flips)";
    const acts = sc.actions.filter(x => x.tick >= s.a && x.tick < s.b);
    s.inputs = acts.length; s.tightest = acts.length ? Math.round(Math.min(...acts.map(x => x.ms))) : null;
    s.score = +acts.reduce((t, x) => t + (x.p ? -Math.log10(x.p) : cost(x)), 0).toFixed(3); s.t0 = +(s.a / TPS).toFixed(1); s.t1 = +(s.b / TPS).toFixed(1);
    s.block0 = Math.round(s.x0 / 30);
  }
  return out;
}

// candidate edits at one input (a = {x, y, tick, mode}), as tools/edit.js ops
function candidates(objs, a, dir, pathArr) {
  const out = [], col = x => (x - 15) / 30;
  const haz = objs.filter(o => kindOf(o) === "hazard" && o.x >= a.x - 20 && o.x <= a.x + 6 * 30 && Math.abs(o.y - a.y) < 100).sort((p, q) => p.x - q.x);
  if (haz.length) {
    const h = haz[0], row = objs.filter(o => kindOf(o) === "hazard" && Math.abs(o.y - h.y) < 8 && (o.rot || 0) === (h.rot || 0)).sort((p, q) => p.x - q.x);
    let i = row.indexOf(h), j = i; while (i > 0 && row[i].x - row[i - 1].x <= 46) i--; while (j < row.length - 1 && row[j + 1].x - row[j].x <= 46) j++;
    const first = row[i], last = row[j], n = j - i + 1;
    if (dir < 0) {
      if (n >= 2) out.push({ why: `a ${n}-hazard row one shorter`, ops: [{ op: "remove", what: "id " + last.id, at: col(last.x), exact: true }] });
      out.push({ why: "the hazard row a block later (more run-up)", ops: [{ op: "move", what: "hazard", group: true, dx: 1, dy: 0, at: col(h.x), exact: true }] });
    } else {
      out.push({ why: `a ${n}-hazard row one longer`, ops: [{ op: "add", type: last.id, col: Math.floor(last.x / 30) + 1, row: (last.y - 15) / 30, rot: last.rot || 0 }] });
      out.push({ why: "the hazard row a block earlier (less run-up)", ops: [{ op: "move", what: "hazard", group: true, dx: -1, dy: 0, at: col(h.x), exact: true }] });
    }
  }
  if (dir < 0) {
    // a step ahead (a solid whose top is above the take-off) that is not on the ground: one row lower
    const step = objs.filter(o => kindOf(o) === "solid" && o.x > a.x && o.x <= a.x + 6 * 30 && o.y - 15 > a.y - 15 + 10 && o.y > 40).sort((p, q) => p.x - q.x)[0];
    if (step) out.push({ why: "the step ahead a row lower", ops: [{ op: "move", what: "block", group: true, dx: 0, dy: -1, at: col(step.x), exact: true }] });
    // the landing after the input: a block a column wider on its near side
    const land = pathArr ? pathArr.slice(a.tick + 2).find(q => q.grounded) : null;
    if (land && land.y > 20) { const under = objs.filter(o => kindOf(o) === "solid" && Math.abs(o.x - land.x) <= 15 && o.y < land.y && o.y > land.y - 31)[0];
      if (under) out.push({ why: "the landing a block wider", ops: [{ op: "extend", what: "block", n: 1, side: "left", at: col(under.x) }] }); }
    const orb = objs.filter(o => kindOf(o) === "orb" && Math.abs(o.x - a.x) <= 45).sort((p, q) => Math.abs(p.x - a.x) - Math.abs(q.x - a.x))[0];
    if (orb) for (const dx of [0.5, -0.5]) out.push({ why: `the orb half a block ${dx > 0 ? "later" : "earlier"}`, ops: [{ op: "move", what: "orb", dx, dy: 0, at: col(orb.x), exact: true }] });
  }
  return out;
}

function retarget(spec, o = {}) {
  const L = E.loadLevel(spec), route0 = E.routeOf(L);
  if (!route0 || !route0.beaten) throw new Error("the level needs a saved route that beats it: node tools/solutions.js " + (L.file ? rel(L.file) : spec));
  const s0 = scoreOf(L.level, route0.sol), T = target(o.to, s0.score), dir = s0.score > T.hi ? -1 : s0.score < T.lo ? 1 : 0;
  const rep = { level: L.name, src: L.src, to: T.name, target: [+T.lo.toFixed(2), +T.hi.toFixed(2)], before: { score: +s0.score.toFixed(3), tier: s0.tier, tightest: Math.round(s0.tightest) }, kept: [], tried: 0 };
  rep.curveBefore = sections(s0, route0.sol.events);
  if (!dir) { rep.note = "already in the target range"; return rep; }
  rep.direction = dir < 0 ? "easier" : "harder";
  fs.mkdirSync(OUT, { recursive: true });
  let n = 1; while (fs.existsSync(path.join(OUT, `${slug(L.name)}.${rep.direction}${n}.gdlvl`))) n++;
  const out = o.out || path.join(OUT, `${slug(L.name)}.${rep.direction}${n}.gdlvl`), tmp = out.replace(/\.gdlvl$/, ".try.gdlvl");
  let cur = { level: L.level, sol: route0.sol, sc: s0 }, checks = null, biggest = null;
  if (!o.dry) { E.writeCopy(tmp, L, L.level.objects); checks = E.quickChecks(tmp, { fast: true }).filter(q => !q.info); }
  const bad = new Set();   // spots that gave nothing (tick-free key: rounded x)
  for (let round = 0; round < (o.max || 8); round++) {
    const sc = cur.sc;
    if (sc.score >= T.lo && sc.score <= T.hi) break;
    const pth = GD.run(sc.w, cur.sol.events).path;
    const acts = sc.actions.filter(a => !bad.has(Math.round(a.x / 30)) && (dir < 0 || /^(cube|robot)$/.test(a.mode)))
      .map(a => Object.assign({}, a, { y: (pth[Math.min(a.tick, pth.length - 1)] || {}).y || 15 }))
      .sort((p, q) => dir < 0 ? cost(q) - cost(p) : q.ms - p.ms).slice(0, o.spots || 4);
    let best = null;
    for (const a of acts) {
      const cands = candidates(cur.level.objects, a, dir, pth);
      if (!cands.length) { bad.add(Math.round(a.x / 30)); continue; }
      const before = localActions(cur.level, cur.sol.events, a.x - 240, a.x + 240).reduce((t, x) => t + cost(x), 0);
      let any = false;
      for (const c of cands) {
        rep.tried++;
        let res; try { res = E.apply(cur.level, c.ops, { x: a.x, col: Math.floor(a.x / 30), block: a.x / 30, y: null, playerY: a.y }); } catch (e) { continue; }
        if (o.dry) { if (!best) best = { a, c, gain: 0, res }; continue; }
        const A = E.writeCopy(tmp, L, res.objects), rs = E.resolve(A.level, A.levelStr, cur.sol, { x: a.x, oldLevel: cur.level, noSolve: true, raw: true });
        if (!rs.sol || !rs.sol.ok) continue;
        const run = GD.run(GD.makeWorld(A.level.objects, A.level.header), rs.sol.events); if (run.dead) continue;
        const after = localActions(A.level, rs.sol.events, a.x - 240, a.x + 240).reduce((t, x) => t + cost(x), 0), gain = (after - before) * dir;
        if (gain <= 0.005) continue;
        any = true;
        if (!best || gain > best.gain) best = { a, c, gain, A, sol: rs.sol, how: rs.how, before, after };
      }
      if (!any) bad.add(Math.round(a.x / 30));
    }
    if (!best) break;
    if (o.dry) { rep.kept.push({ block: +(best.a.x / 30).toFixed(1), why: best.c.why, ops: best.c.ops, dry: true }); break; }
    // the quick checks must not get worse
    E.writeCopy(tmp, L, best.A.level.objects);
    const qa = E.quickChecks(tmp, { fast: true }).filter(q => !q.info);
    if (checks && qa.length > checks.length) { bad.add(Math.round(best.a.x / 30)); rep.kept.push({ block: +(best.a.x / 30).toFixed(1), why: best.c.why, rejected: "new issues: " + qa.length + " vs " + checks.length }); round--; if (bad.size > 40) break; continue; }
    const sol = require("./solutions.js").fromRun(best.A.level, best.A.levelStr, { ok: true, events: best.sol.events });
    const s1 = scoreOf(best.A.level, sol);
    rep.kept.push({ block: +(best.a.x / 30).toFixed(1), t: +(best.a.tick / TPS).toFixed(2), why: best.c.why, ops: best.c.ops, local: [+best.before.toFixed(3), +best.after.toFixed(3)], score: +s1.score.toFixed(3), solve: best.how });
    if (!biggest || best.gain > biggest.gain) biggest = { gain: best.gain, t: best.a.tick / TPS };
    cur = { level: best.A.level, sol, sc: s1 }; checks = qa;
  }
  try { fs.unlinkSync(tmp); } catch (e) {}
  if (o.dry) return rep;
  const kept = rep.kept.filter(k => !k.rejected);
  rep.after = { score: +cur.sc.score.toFixed(3), tier: cur.sc.tier, tightest: Math.round(cur.sc.tightest) };
  rep.reached = cur.sc.score >= T.lo && cur.sc.score <= T.hi;
  if (!kept.length) { rep.file = null; return rep; }
  const A = E.writeCopy(out, L, cur.level.objects);
  if (!require("./solutions.js").get(A.levelStr, true)) require("./solutions.js").put(A.levelStr, cur.sol, A.level);
  rep.file = rel(out); rep.curveAfter = sections(cur.sc, cur.sol.events);
  const d = E.diff(L.level.objects, A.level.objects); rep.objects = { added: d.added.length, removed: d.removed.length };
  rep.portalsTouched = d.added.concat(d.removed).filter(x => ["mode", "speed", "gravity", "size"].includes(kindOf(x))).length;
  if (!o.noShots && biggest) rep.picture = E.shots(L.file || out, out, Math.max(0, biggest.t - 0.8), out.replace(/\.gdlvl$/, "_before_after.png"));
  if (o.session) { const r = require("child_process").spawnSync(process.execPath, [path.join(__dirname, "wip.js"), "put", out, "--session", o.session, "--note", `retarget ${rep.direction}: ${rep.before.score} -> ${rep.after.score}`], { encoding: "utf8", windowsHide: true }); rep.wip = (r.stdout || "").trim().split("\n").pop(); }
  fs.writeFileSync(out.replace(/\.gdlvl$/, ".json"), JSON.stringify(rep, null, 1));
  return rep;
}

function curve(list) {
  const mx = Math.max(...list.map(s => s.score), 0.01);
  return list.map(s => `     ${(s.t0 + "-" + s.t1 + " s").padEnd(12)} ${("b" + s.block0).padEnd(6)} ${s.mode.padEnd(11)} ${String(s.inputs).padStart(3)} inputs  tightest ${String(s.tightest ?? "-").padStart(4)} ms  ${s.score.toFixed(2).padStart(5)} ${"#".repeat(Math.round(s.score / mx * 20))}`).join("\n");
}
function print(r) {
  console.log(`== retarget ${r.level} -> ${r.to} (score ${r.target[0]}-${r.target[1]})`);
  console.log(`   before: score ${r.before.score} (${r.before.tier}), tightest ${r.before.tightest} ms` + (r.after ? `   after: score ${r.after.score} (${r.after.tier}), tightest ${r.after.tightest} ms${r.reached ? "  -- target reached" : "  -- target NOT reached"}` : ""));
  if (r.note) console.log("   " + r.note);
  for (const k of r.kept) console.log(`   ${k.rejected ? "rejected" : k.dry ? "would try" : "kept"}  block ${k.block}${k.t != null ? ` (${k.t} s)` : ""}: ${k.why}${k.local ? `  local ${k.local[0]} -> ${k.local[1]}, level ${k.score}` : ""}${k.rejected ? " -- " + k.rejected : ""}`);
  console.log(`   candidates tried: ${r.tried}`);
  console.log("   sections before:\n" + curve(r.curveBefore));
  if (r.curveAfter) console.log("   sections after:\n" + curve(r.curveAfter));
  if (r.file) console.log(`   copy: ${r.file} (objects +${r.objects.added} -${r.objects.removed}; portals touched: ${r.portalsTouched})`);
  if (r.picture) console.log(`   picture: ${r.picture.png ? rel(r.picture.png) : "failed: " + r.picture.error}`);
}

module.exports = { retarget, target, tierOf, candidates, sections };

if (require.main === module) {
  const a = process.argv.slice(2), opt = k => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : undefined; };
  const takes = new Set(["--to", "--max", "--spots", "--session", "--out"]);
  const lv = a.find((x, i) => !x.startsWith("--") && !takes.has(a[i - 1]));
  if (!lv || !opt("--to")) { console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n")); process.exit(1); }
  const r = retarget(lv, { to: opt("--to"), max: opt("--max") ? +opt("--max") : 8, spots: opt("--spots") ? +opt("--spots") : 4, noShots: a.includes("--no-shots"), dry: a.includes("--dry"), session: opt("--session"), out: opt("--out") });
  if (a.includes("--json")) console.log(JSON.stringify(r, null, 1)); else print(r);
}
