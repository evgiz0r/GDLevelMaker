// node tools/lab.js round <brief> --beats <b0>-<b1> [--name "drop"] [--hooks a,b,...]  -- a new round: one MOMENT of a song
//                                     (10-20 s), one variant brief per hook -> local/lab/<round>/v<k>.json; prints the round
// node tools/lab.js build <round> <k>                -- build variant k alone (compose + make + its own route + checks + pace),
//                                                       its viewer card; ~seconds to a minute
// node tools/lab.js ask <round>                      -- the decision card for the user: which variant, and why
// node tools/lab.js collect <round>                  -- the user's pick and reason -> local/reviews.jsonl, the picked variant
//                                                       into the approved library (local/lab/library.json), hook weights
// node tools/lab.js status [<round>]                 -- the rounds / a round's variants with their pace and checks
//
// SECTION LAB (the user, 2026-11-24: the levels feel "pretty dim. Slow, too low CPS, nothing interesting. Iterating on them like
// this feels too slow." -> yes to "Smaller sections. With reviews."). A round is ONE moment (a drop, an intro, a ship part,
// a build-up) of a real song, 10-20 s, built as 5-6 VARIANTS at once, each with its own HOOK (no two share one), each a
// small level of its own (like a collab part: no whole-level solve). The user reviews them in the viewer (each variant a
// card: watch it, play it), picks one and says why; every pick is data (local/reviews.jsonl): targets move toward what
// they pick, the hooks they like are weighted up (knowledge/lab_prefs.json), and the picked section joins the library of
// approved sections whole levels are later assembled from (tools/collab.js). Pace targets come from real levels
// (tools/pace.js: Jumper, xStep, Clutterfunk, Electroman), each variant is measured against them.
"use strict";
if (require.main === module && /^(build)$/.test(process.argv[2] || "")) require("./heavy.js").claim();
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, ".."), LAB = path.join(ROOT, "local", "lab");
const readJ = f => JSON.parse(fs.readFileSync(f, "utf8")), writeJ = (f, o) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(o, null, 1)); };
const SESSION = "style";

// the hooks: each turns the moment's beats into sections with one gimmick (a variant = one hook). drop pace: gaps 2-3.
const PACE = { gaps: [2, 3] };
const HOOKS = {
  "speed-up": { why: "a speed change halfway: the run gets faster on the phrase", make: (b, col) => [Object.assign({ name: "run 1x", beats: Math.floor(b / 2), speed: "1x", use: ["double", "spike-block", "s:pit-run-armed", "single"] }, PACE, col), Object.assign({ name: "run 2x", beats: b - Math.floor(b / 2), speed: "2x", use: ["s:pit-run-2x-armed", "double", "s:pit-spike-mix-2x", "single"] }, PACE, col)] },
  "mode-switch": { why: "cube into ship on the phrase", make: (b, col) => [Object.assign({ name: "cube", beats: Math.floor(b / 2), use: ["s:pit-spike-mix-armed", "double", "spike-block"] }, PACE, col), Object.assign({ name: "ship", beats: b - Math.floor(b / 2), mode: "ship", args: { "ship-tunnel": { pit: true, teethEvery: 6, gap: 4 } } }, col)] },
  "orb-trick": { why: "orbs that launch the cube over pits: pink, dash and yellow", make: (b, col) => [Object.assign({ name: "orbs", beats: b, use: ["s:pink-orb-pit", "s:dash-orb-pit", "orb-pit", "double", "s:pink-pad-step"] }, PACE, col)] },
  "gravity-play": { why: "gravity flips: a blue pad, a ceiling run, flips and back", make: (b, col) => [Object.assign({ name: "gravity", beats: b, use: ["s:gravity-pad-gap", "s:ceiling-hop", "s:upside-hops", "s:blue-pad-ceiling", "s:gravity-tunnel", "double"] }, PACE, col)] },
  "set-piece": { why: "one dense armed chain: hanging columns over spike pits", make: (b, col) => [Object.assign({ name: "chain", beats: b, use: ["s:pit-run-armed", "s:pit-spike-mix-armed", "s:pit-run-high-armed", "double"], args: { "s:pit-run-armed": { n: 4 }, "s:pit-spike-mix-armed": { n: 3 } } }, PACE, col)] },
  "wave-drop": { why: "the drop as a wave corridor with teeth", make: (b, col) => [Object.assign({ name: "wave", beats: b, mode: "wave", args: { "wave-zigzag": { seg: 3, flat: 1, gap: 4, teeth: true } } }, col)] },
};
const prefs = () => { try { return readJ(path.join(ROOT, "knowledge", "lab_prefs.json")); } catch (e) { return { hooks: {}, picks: 0 }; } };

function round(briefFile, opts) {
  const brief = readJ(briefFile), [b0, b1] = String(opts.beats).split("-").map(Number), beats = b1 - b0;
  const { gridOf, songOf } = require("./make.js"), SY = require("../lib/sync.js").SYNC, grid = brief.grid ? gridOf(brief) : gridOf(brief, songOf(brief));
  const t0 = SY.beatToTime(grid, brief.offset || 0, b0), t1 = SY.beatToTime(grid, brief.offset || 0, b1);
  if (t1 - t0 < 8 || t1 - t0 > 22) throw new Error(`the moment is ${(t1 - t0).toFixed(1)} s: want 10-20 s`);
  // the hooks: the asked ones, else all six, the user's favourites first
  const P = prefs(), names = (opts.hooks ? opts.hooks.split(",") : Object.keys(HOOKS)).sort((a, b) => (P.hooks[b] || 0) - (P.hooks[a] || 0)).slice(0, opts.n || 6);
  fs.mkdirSync(LAB, { recursive: true });
  const n = fs.readdirSync(LAB).filter(f => /^r\d+$/.test(f)).length + 1, id = "r" + n, dir = path.join(LAB, id);
  // the moment's colours: the brief's section there (the look stays the song's)
  let b = 1, col = {}; for (const s of brief.sections) { if (b <= b0 && b + (s.beats || 0) > b0) col = { bg: s.bg, ground: s.ground, line: s.line, obj: s.obj }; b += s.beats || 0; }
  const variants = names.map((h, k) => {
    const v = { name: `LAB ${id} v${k + 1} ${h}`, desc: `Section lab ${id}: ${opts.name || "a moment"}, hook: ${h}`, song: brief.song, grid: brief.grid, offset: (brief.offset || 0) + t0,
      seed: (brief.seed || 1) * 100 + k, difficulty: brief.difficulty || { label: "Normal" }, terrain: true, structures: false, modern: true, signature: false, leadIn: 4, flips: false,
      sections: HOOKS[h].make(beats, col), _hook: h };
    writeJ(path.join(dir, `v${k + 1}.json`), v);
    return { k: k + 1, hook: h, why: HOOKS[h].why };
  });
  const R = { id, song: brief.song, from: path.relative(ROOT, briefFile).split(path.sep).join("/"), moment: opts.name || "moment", beats: [b0, b1], t: [+t0.toFixed(2), +t1.toFixed(2)], variants, at: new Date().toISOString() };
  writeJ(path.join(dir, "round.json"), R);
  return R;
}

function build(id, k) {
  const t0 = Date.now(), dir = path.join(LAB, id), R = readJ(path.join(dir, "round.json")), vf = path.join(dir, `v${k}.json`), v = readJ(vf);
  const C = require("./compose.js"), { build: mk, slug } = require("./make.js"), { scoreLevel } = require("./score.js"), { GD, writeGdlvl } = require("./io.js");
  const log0 = console.log; let built, placed = []; console.log = () => {};
  try { const cr = C.compose(v); placed = cr.placed.map(q => q.name); built = mk(cr.spec, vf); } finally { console.log = log0; }
  const level = built.level, levelStr = GD.serializeLevel(level), out = path.join(dir, `v${k}.gdlvl`);
  writeGdlvl(out, built.rec, level);
  const sol = require("./solutions.js").solve(level, levelStr, { name: v.name });
  const sc = scoreLevel(level, v, { fairness: false, levelStr });
  const PART = ["beatable", "prejumps", "timing", "recovery", "skips", "reactive", "fairness", "climbs"];
  const fails = sc.gates.filter(g => g.status === "FAIL" && PART.includes(g.name)).map(g => g.name), warns = sc.gates.filter(g => g.status === "WARN" && PART.includes(g.name)).map(g => g.name);
  let pace = null; try { const PA = require("./pace.js"), B = require("./beats.js"); pace = PA.paceOf(level, sol && sol.ok ? sol.events : null, B.loadBeats("custom_" + (v.song.custom || v.song))); } catch (e) { pace = { error: e.message }; }
  const res = { round: id, k, hook: v._hook, name: v.name, ok: !!(sol && sol.ok) && !fails.length, fails, warns, patterns: placed, pace, secs: (Date.now() - t0) / 1000, at: new Date().toISOString() };
  writeJ(path.join(dir, `v${k}.result.json`), res);
  // its viewer card (watch it, play it: "you play")
  try {
    const ST = require("./stages.js"), T = require("./pace.js").load().target;
    ST.put({ session: SESSION, base: `lab_${id}_v${k}`, name: v.name, stage: "layout", levelStr, data: { events: sol && sol.ok ? sol.events : [], kind: "planned" },
      note: `${v._hook}: ${HOOKS[v._hook].why}. Pace ${pace && pace.cps != null ? pace.cps + " cps" : "-"} (real ${T.cps}), ${pace && pace.obsPerBar != null ? pace.obsPerBar + " obstacles/bar" : "-"} (real ${T.obsPerBar}), ${pace && pace.changesPer10s != null ? pace.changesPer10s + " changes/10 s" : "-"} (real ${T.changesPer10s})${res.ok ? "" : " -- NOT OK: " + fails.join(", ")}` });
  } catch (e) {}
  try { fs.appendFileSync(path.join(ROOT, "local", "timings.jsonl"), JSON.stringify({ at: res.at, tool: "lab.js", step: "lab-build", level: v.name, secs: res.secs }) + "\n"); } catch (e) {}
  return res;
}

function ask(id) {
  const dir = path.join(LAB, id), R = readJ(path.join(dir, "round.json"));
  const res = R.variants.map(x => { try { return readJ(path.join(dir, `v${x.k}.result.json`)); } catch (e) { return null; } });
  const options = R.variants.filter((x, i) => res[i]).map(x => `v${x.k} ${x.hook}`).concat(["none: all dull"]);
  const card = require("./ask.js").put({ session: SESSION, question: `Section lab ${id} -- ${R.moment} of the song (${R.t[0]}-${R.t[1]} s): which variant do you like best, and why? (each is a card "LAB ${id} v..." in the in-progress list: watch it or press P to play)`, options, level: `LAB ${id}` });
  R.ask = card.id || card; writeJ(path.join(dir, "round.json"), R);
  return { card: R.ask, options };
}

function collect(id) {
  const dir = path.join(LAB, id), R = readJ(path.join(dir, "round.json"));
  const a = R.ask ? require("./ask.js").get(R.ask) : null;
  if (!a || !a.answer) return { waiting: true, card: R.ask };
  const m = /^v(\d+)/.exec(a.answer), k = m ? +m[1] : null, pick = k ? R.variants.find(x => x.k === k) : null;
  const rows = R.variants.map(x => { try { return readJ(path.join(dir, `v${x.k}.result.json`)); } catch (e) { return { k: x.k, hook: x.hook }; } });
  const review = { at: new Date().toISOString(), round: id, moment: R.moment, song: R.song, t: R.t, pick: k, hook: pick && pick.hook, reason: a.note || null, answer: a.answer,
    variants: rows.map(r => ({ k: r.k, hook: r.hook, ok: r.ok, pace: r.pace, patterns: r.patterns })) };
  fs.appendFileSync(path.join(ROOT, "local", "reviews.jsonl"), JSON.stringify(review) + "\n");
  // the user's taste as data: the picked hook weighted up; the picked section into the approved library
  const P = prefs(); P.picks = (P.picks || 0) + 1; if (pick) P.hooks[pick.hook] = (P.hooks[pick.hook] || 0) + 1;
  writeJ(path.join(ROOT, "knowledge", "lab_prefs.json"), P);
  if (pick) { const libF = path.join(LAB, "library.json"); let lib = []; try { lib = readJ(libF); } catch (e) {}
    lib.push({ round: id, moment: R.moment, song: R.song, t: R.t, beats: R.beats, hook: pick.hook, brief: `local/lab/${id}/v${k}.json`, level: `local/lab/${id}/v${k}.gdlvl`, reason: a.note || null, at: review.at }); writeJ(libF, lib); }
  return review;
}

function status(id) {
  if (!id) { for (const f of fs.existsSync(LAB) ? fs.readdirSync(LAB).filter(f => /^r\d+$/.test(f)) : []) { const R = readJ(path.join(LAB, f, "round.json")); console.log(`${f}: ${R.moment} ${R.t[0]}-${R.t[1]} s, ${R.variants.length} variants${R.ask ? ", card " + R.ask : ""}`); } return; }
  const dir = path.join(LAB, id), R = readJ(path.join(dir, "round.json")), T = require("./pace.js").load().target;
  console.log(`${id}: ${R.moment} (${R.t[0]}-${R.t[1]} s); real pace ${T.cps} cps, ${T.obsPerBar} obstacles/bar, ${T.changesPer10s} changes/10 s`);
  for (const x of R.variants) { let r = null; try { r = readJ(path.join(dir, `v${x.k}.result.json`)); } catch (e) {}
    console.log(`  v${x.k} ${x.hook.padEnd(13)} ${r ? (r.ok ? "ok  " : "FAIL") + ` ${r.secs.toFixed(0)} s  ${r.pace && r.pace.cps != null ? r.pace.cps + " cps " : ""}${r.pace && r.pace.obsPerBar != null ? r.pace.obsPerBar + " obs/bar " : ""}${r.pace && r.pace.changesPer10s != null ? r.pace.changesPer10s + " ch/10s" : ""}${r.fails.length ? "  fails " + r.fails.join(",") : ""}` : "not built"}`); }
}

module.exports = { round, build, ask, collect, status, HOOKS };

if (require.main === module) {
  const [cmd, a, b, ...rest] = process.argv.slice(2), all = [a, b, ...rest], opt = k => { const i = all.indexOf(k); return i >= 0 ? all[i + 1] : null; };
  if (cmd === "round") { const R = round(a, { beats: opt("--beats"), name: opt("--name"), hooks: opt("--hooks"), n: +(opt("--n") || 6) }); console.log(`${R.id}: ${R.moment} ${R.t[0]}-${R.t[1]} s; variants: ${R.variants.map(v => "v" + v.k + " " + v.hook).join(", ")}`); }
  else if (cmd === "build") { const r = build(a, +b); console.log(`${r.name}: ${r.ok ? "OK" : "NOT OK " + r.fails.join(",")} in ${r.secs.toFixed(0)} s; pace ${JSON.stringify(r.pace)}`); }
  else if (cmd === "ask") { const r = ask(a); console.log(`decision card ${r.card}: ${r.options.join(" | ")}`); }
  else if (cmd === "collect") { const r = collect(a); console.log(r.waiting ? `waiting for the user's answer (card ${r.card})` : `picked v${r.pick} ${r.hook}${r.reason ? ' -- "' + r.reason + '"' : ""} -> local/reviews.jsonl, library, prefs`); }
  else if (cmd === "status") status(a);
  else console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("// node")).join("\n"));
}
