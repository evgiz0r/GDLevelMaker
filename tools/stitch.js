#!/usr/bin/env node
// A full run from practice attempts: the GDLM Probe mod's logs (v0.4.0+, GEODE.md "Practice -> full run") of the user's
// practice-mode attempts at a level are cut at their checkpoints and joined into one start-to-end input route.
// usage: node tools/stitch.js [<level name>] [--dir <attempts folder>] [--since <ISO time | ms>] [--level <what>] [--save] [--partial]
//   <level name>: as GD shows it (default: the level of the newest practice attempt in the folder)
//   --level: the level for our sim's check (save:<name> | official:N | file.gdlvl | c<id>; default from the log's name / id)
//   --save:  also add the run to local/attempts/ (source "stitch"), so the viewer shows it as a ghost and
//            `node tools/video.js <level> --run <id>` films it
//   --partial: stitch even when no practice attempt reached the end (the chain to the furthest attempt)
// Writes local/stitched/<level>_<time>.json: {level, events [{tick, type}], segments, seams, sim}.
//
// How: every practice respawn restores a checkpoint, and the attempt that stored that checkpoint holds the presses that
// led there from ITS checkpoint. So from the final attempt (the newest one that reached the end) walk back: its start
// checkpoint -> the attempt that stored it -> that attempt's start checkpoint ... -> the level's start; each attempt
// gives its presses from its own start up to the next one's checkpoint. Ticks are absolute: an attempt starts at
// round(level time * 240) (the checkpoint's level time, logged by the mod), a press logged after n ticks is at start + n
// (the probe's convention: it acts in the step n -> n+1, like our sim's event tick). At a seam the button is set to the
// state the next attempt began with (a hold carried through a respawn, or a press the respawn dropped).
// Limits: one player, the jump button (button 1), no time warp (a level-time drift is reported); GD restores a checkpoint
// from its saved state, so a run that only works because of a respawn's small differences may not clear unbroken -- the
// sim check below, and a real-game playback (probe.js play, GDLM levels only, with the user's go) settle it.
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const TPS = 240;

// attempts (probe.js read() objects) -> the stitched run, or { error }
function stitch(attempts, opts = {}) {
  const prac = attempts.filter((a) => a.start && a.start.practice);
  if (!prac.length) return { error: "no practice attempts" };
  const old = prac.filter((a) => a.start.lt == null);
  if (old.length === prac.length) return { error: "these logs are from probe v0.3 or older: no checkpoint data (install v0.4.0, then play practice again)" };
  const atts = prac.filter((a) => a.start.lt != null);
  const baseOf = (a) => Math.round(a.start.lt * TPS);
  // checkpoint id -> the attempt that stored it and its tick
  const cpBy = new Map();
  atts.forEach((a, i) => { for (const c of a.cps || []) cpBy.set(c.id, { att: i, tick: Math.round(c.lt * TPS), x: c.x, y: c.y, n: c.n }); });
  // the final attempt: the newest that completed (else, with partial, the one that got furthest)
  let fin = -1;
  for (let i = atts.length - 1; i >= 0; i--) if (atts[i].end && atts[i].end.result === "complete") { fin = i; break; }
  let complete = fin >= 0;
  if (!complete) {
    if (!opts.partial) return { error: `no practice attempt reached the end (${atts.length} attempts); --partial stitches to the furthest one` };
    let best = -Infinity;
    atts.forEach((a, i) => { const t = baseOf(a) + lastN(a); if (t > best) { best = t; fin = i; } });
  }
  // walk back
  const chain = [];   // { att, from (tick), cp (the id it started from) }
  let i = fin, guard = 0;
  while (true) {
    const a = atts[i];
    chain.unshift({ att: i, from: baseOf(a), cp: a.start.from });
    if (a.start.from == null || a.start.from < 0) break;
    const c = cpBy.get(a.start.from);
    if (!c) return { error: `attempt ${path.basename(a.file || "?")} starts at checkpoint ${a.start.from}, but no logged attempt stored it (was the mod off then, or are older logs missing?)` };
    if (c.tick !== baseOf(a)) chain[0].tickMismatch = { cp: c.tick, start: baseOf(a) };
    i = c.att;
    if (++guard > 100000) return { error: "checkpoint loop" };
  }
  if (chain[0].from !== 0) return { error: `the chain's first attempt starts at tick ${chain[0].from}, not at the level's start (a start position?)` };
  // events, segment by segment
  const events = [], segments = [], seams = [];
  let held = false;
  const push = (tick, type) => {
    if ((type === "press") === held) return false;   // already in that state
    held = type === "press";
    events.push({ tick, type });
    return true;
  };
  chain.forEach((s, k) => {
    const a = atts[s.att];
    const to = k + 1 < chain.length ? chain[k + 1].from : Infinity;
    // the button as the attempt began (logged by v0.4.0: hold); at a seam, make the run match it
    const want = !!a.start.hold;
    if (want !== held) {
      push(s.from, want ? "press" : "release");
      if (k > 0) seams.push({ tick: s.from, fix: want ? "press added (held through the respawn)" : "release added (the respawn let go)" });
    }
    let n = 0, drift = 0;
    for (const b of a.btn) {
      if (b.button !== 1 || !b.p1) continue;
      const t = s.from + b.n;
      if (t >= to) break;
      if (push(t, b.down ? "press" : "release")) n++;
    }
    for (const t of a.ticks) if (t.lt != null && !(s.from + t.n >= to)) drift = Math.max(drift, Math.abs(t.lt * TPS - (s.from + t.n)));
    const end = Math.min(to, s.from + lastN(a));
    segments.push({ file: a.file ? path.basename(a.file) : null, attempt: a.start.attempt, from: s.from, to: isFinite(to) ? to : end,
      inputs: n, result: a.end ? a.end.result : "cut", checkpoint: s.cp, drift: +drift.toFixed(2), tickMismatch: s.tickMismatch });
    if (k + 1 < chain.length) {
      const c = cpBy.get(chain[k + 1].cp);
      const near = a.btn.filter((b) => b.button === 1 && b.p1 && Math.abs(s.from + b.n - to) <= 2).map((b) => s.from + b.n - to);
      seams.push({ tick: to, cp: chain[k + 1].cp, gx: c.x, gy: c.y, pressNear: near.length ? near : undefined });
    }
  });
  return { level: atts[fin].start.level, id: atts[fin].start.id, complete, events, segments,
    seams: seams.sort((p, q) => p.tick - q.tick), attempts: atts.length, endTick: segments[segments.length - 1].to };
}

function lastN(a) { return a.ticks.length ? a.ticks[a.ticks.length - 1].n : (a.end ? a.end.n : 0); }

// what to load for our sim, from the log's level name and id
function levelWhat(name, id) {
  if (/^GDLM/.test(name || "")) {
    try {
      const io = require("./io.js");
      for (const f of fs.readdirSync(path.join(ROOT, "levels")).filter((f) => f.endsWith(".gdlvl"))) {
        const L = io.readGdlvl(path.join(ROOT, "levels", f));
        if ((L.name || "").toLowerCase() === name.toLowerCase()) return path.join("levels", f);
      }
    } catch {}
    return "save:" + name;
  }
  if (id >= 1 && id <= 22) return "official:" + id;
  if (id > 22 && fs.existsSync(path.join(ROOT, "local", "community", id + ".gdlvl"))) return path.join("local", "community", id + ".gdlvl");
  return null;
}

// our sim plays the stitched run: cleared or where it dies, and where it is at each seam vs the game's checkpoint
function simCheck(S, what) {
  const { levelOf } = require("./shoot.js");
  const { GD } = require("./io.js");
  const L = levelOf(what);
  const lv = GD.parseLevel(L.levelStr);
  const w = GD.makeWorld(lv.objects, lv.header);
  const run = GD.run(w, S.events);
  const P = run.path;
  const endX = lv.objects.reduce((m, o) => (o.x > m ? o.x : m), 0) || 1;
  const prog = (s) => (GD.progressX ? GD.progressX(s) : s.x);
  const last = run.done ? null : (run.end || P[P.length - 1]);
  const sim = { level: L.name, what, result: run.done ? "clear" : "died", tick: P.length - 1,
    x: last ? +prog(last).toFixed(1) : undefined, pct: last ? +Math.min(100, (100 * prog(last)) / endX).toFixed(1) : 100,
    why: last ? last.why || null : null };
  for (const s of S.seams) if (s.cp != null && P[s.tick]) {
    const q = P[s.tick];
    s.sim = { x: +q.x.toFixed(2), y: +q.y.toFixed(2), dx: +(s.gx - q.x).toFixed(2), dy: +(s.gy - q.y).toFixed(2) };
  }
  return { sim, levelStr: L.levelStr, name: L.name };
}

function main() {
  const a = process.argv.slice(2);
  const opt = (k, d) => { const i = a.indexOf(k); if (i < 0) return d; const v = a[i + 1]; a.splice(i, 2); return v; };
  const probe = require("./probe.js");
  const dir = opt("--dir", probe.defaultDir());
  const since = opt("--since", null), what0 = opt("--level", null);
  const save = a.includes("--save"), partial = a.includes("--partial");
  const name = a.filter((x) => !x.startsWith("--")).join(" ") || null;
  const sinceMs = since == null ? 0 : /^\d+$/.test(since) ? Number(since) : Date.parse(since);
  let all = probe.files(dir).map(probe.read).filter((r) => r.start && (r.start.wall_ms || 0) >= sinceMs);
  if (!all.length) { console.error(`no attempts in ${dir}${since ? " since " + since : ""}`); process.exit(1); }
  let want = name;
  if (!want) { const p = all.filter((r) => r.start.practice); if (!p.length) { console.error("no practice attempts in " + dir); process.exit(1); } want = p[p.length - 1].start.level; }
  const mine = all.filter((r) => (r.start.level || "").toLowerCase() === want.toLowerCase());
  if (!mine.length) { console.error(`no attempts at '${want}'; levels there: ` + [...new Set(all.map((r) => r.start.level))].slice(-12).join(", ")); process.exit(1); }
  const S = stitch(mine, { partial });
  if (S.error) { console.error(`${want}: ${S.error}`); process.exit(1); }
  console.log(`${S.level}: ${S.complete ? "a full run" : "a PARTIAL run (no practice clear yet)"} from ${S.segments.length} practice attempt(s) of ${S.attempts}, ` +
    `${S.events.filter((e) => e.type === "press").length} presses, ${(S.endTick / TPS).toFixed(2)} s`);
  for (const g of S.segments) console.log(`  ${(g.from / TPS).toFixed(2)}-${(g.to / TPS).toFixed(2)} s  attempt #${g.attempt} (${g.result})  ${g.inputs} inputs` +
    `${g.drift > 1 ? `  !! level time drifts ${g.drift} ticks (time warp?)` : ""}${g.tickMismatch ? `  !! starts at ${g.tickMismatch.start}, checkpoint says ${g.tickMismatch.cp}` : ""}`);
  for (const s of S.seams) if (s.fix || s.pressNear) console.log(`  seam ${(s.tick / TPS).toFixed(2)} s: ${s.fix || ""}${s.pressNear ? ` input ${s.pressNear.join(",")} tick(s) from the seam (+-1 tick is unsure)` : ""}`);
  const what = what0 || levelWhat(S.level, S.id);
  let sim = null, levelStr = null;
  if (what) {
    try {
      const r = simCheck(S, what); sim = r.sim; levelStr = r.levelStr;
      console.log(`our sim: ${sim.result === "clear" ? "CLEARS the stitched run" : `dies at x ${sim.x} (${sim.pct}%, ${(sim.tick / TPS).toFixed(2)} s)${sim.why ? ": " + sim.why : ""}`}`);
      const off = S.seams.filter((s) => s.sim);
      if (off.length) {
        const dy0 = off[0].sim.dy;
        for (const s of off) console.log(`  checkpoint at ${(s.tick / TPS).toFixed(2)} s: game x ${s.gx.toFixed(1)} vs sim ${s.sim.x} (dx ${s.sim.dx}), height gap ${(s.sim.dy - dy0).toFixed(2)} (relative to the first)`);
      }
    } catch (e) { console.log("no sim check: " + e.message + " (--level <what> names the level)"); }
  } else console.log("no sim check: level not on this PC (--level <what>)");
  const out = path.join(ROOT, "local", "stitched");
  fs.mkdirSync(out, { recursive: true });
  const file = path.join(out, `${S.level.replace(/[^\w.-]+/g, "_")}_${Date.now()}.json`);
  fs.writeFileSync(file, JSON.stringify(Object.assign({ made: new Date().toISOString(), what, sim }, S), null, 1));
  console.log("wrote " + path.relative(ROOT, file));
  if (save) {
    if (!what) { console.log("not saved to attempts: no level (--level)"); return; }
    const A = require("./attempts.js");
    let hash; try { const LP = require("../lib/liveplay.js"); hash = levelStr && (LP.levelHash ? LP.levelHash(levelStr) : undefined); } catch {}
    const line = A.append({ id: "stitch" + Date.now().toString(36), source: "stitch", level: S.level, file: what, hash,
      events: S.events, result: S.complete ? "clear" : "died", practice: false, from: null,
      stitched: { segments: S.segments.length, file: path.relative(ROOT, file) },
      sim: sim || undefined, agree: sim && S.complete ? A.agreeOf({ result: "clear", sim }) : null });
    console.log(`saved as attempt ${line.id}: the viewer shows it on ${what}; video: node tools/video.js ${what} --run ${line.id}`);
  }
}

if (require.main === module) main();
module.exports = { stitch, levelWhat };
