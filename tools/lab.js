// node tools/lab.js round <brief> --beats <b0>-<b1> [--name "drop"] [--hooks a,b,...]  -- a new round: one MOMENT of a song
//                                     (10-20 s), one variant brief per hook -> local/lab/<round>/v<k>.json; prints the round
// node tools/lab.js build <round> <k>                -- build variant k alone (compose + make + its own route + checks + pace),
//                                                       its viewer card; ~seconds to a minute
// node tools/lab.js ask <round>                      -- the decision card for the user: which variant, and why
// node tools/lab.js collect <round>                  -- the user's pick and reason -> local/reviews.jsonl, the picked variant
//                                                       into the approved library (local/lab/library.json), hook weights
// node tools/lab.js sheet <round>                   -- the round's picture sheet: 4 GD-art frames per variant, labelled with
//                                                       its hook and pace -> local/lab/<round>/sheet.jpg (heavy: shoot.js)
// node tools/lab.js finish <round>                  -- when a round's builds are done: status, the sheet, the decision card
// node tools/lab.js trim <round> [<k>]              -- end built variants right after their gameplay (no solve: the route
//                                                       is replayed on the cut level); build does this itself
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
  // flying hooks (the space level, GDLM 71; the user: "Bit more flying with space")
  "ship-corridor": { why: "a ship corridor with teeth, rising and falling with the phrase", make: (b, col) => [Object.assign({ name: "ship", beats: b, mode: "ship", args: { "ship-tunnel": { waves: 2, teethEvery: 6 } } }, col)] },
  "ufo-hops": { why: "the ufo hopping over pillars and sinking under hangers", make: (b, col) => [Object.assign({ name: "ufo", beats: b, mode: "ufo" }, col)] },
  "swing-flips": { why: "the swing flipping between floor and roof spikes", make: (b, col) => [Object.assign({ name: "swing", beats: b, mode: "swing" }, col)] },
  "ship-into-wave": { why: "ship for the first phrase, wave for the second", make: (b, col) => [Object.assign({ name: "ship", beats: Math.floor(b / 2), mode: "ship", args: { "ship-tunnel": { teethEvery: 6 } } }, col), Object.assign({ name: "wave", beats: b - Math.floor(b / 2), mode: "wave", args: { "wave-zigzag": { seg: 3, flat: 1, gap: 4, teeth: true } } }, col)] },
};
// a round's palette set: "space" = near-black skies in blue to violet, a little lighter or darker per variant (the user:
// "Somewhat black background ... bit lighter bit darker"), each still separated by role (decokit.rolePalette)
// "space" now takes gd-art's space kit (tools/themes/space.js): its four variants' role palettes, cycled, and the kit's dress
// (tools/scenes/theme.js) -- near black a palette can't separate by luminance alone (round 2's first ufo variant mixed)
const SPACE = ["moon", "dark", "light", "nebula"];
const THEMED = { space: k => ({ pal: require("./themes/space.js").palette(SPACE[k % 4]), theme: { name: "space", variant: SPACE[k % 4] } }) };
const PALETTES = {};
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
  let b = 1, col = {};   // (the song's colours there: used with --palette song) for (const s of brief.sections) { if (b <= b0 && b + (s.beats || 0) > b0) col = { bg: s.bg, ground: s.ground, line: s.line, obj: s.obj }; b += s.beats || 0; }
  // colour by ROLE (gd-art's decokit.rolePalette; the user: "clear contrasts between the different things (ground, spikes,
  // deco)"): each variant its own hue (~60 degrees apart), mid-tone sky, light path rims, spikes in their own hue
  const D = require("./decokit.js");
  const variants = names.map((h, k) => {
    const th = THEMED[opts.palette] ? THEMED[opts.palette](k) : null;
    const pal = opts.palette === "song" ? null : th ? th.pal : PALETTES[opts.palette] ? D.rolePalette(...PALETTES[opts.palette](k)) : D.rolePalette((opts.hue0 ?? 30) + k * 60);
    if (pal) col = { bg: pal.bg, ground: pal.ground, line: pal.line, obj: pal.pathEdge };
    const v = { _palette: pal, name: `LAB ${id} v${k + 1} ${h}`, desc: `Section lab ${id}: ${opts.name || "a moment"}, hook: ${h}`, song: brief.song, grid: brief.grid, offset: (brief.offset || 0) + t0,
      seed: (brief.seed || 1) * 100 + k, difficulty: brief.difficulty || { label: "Normal" }, terrain: true, structures: false, modern: true, signature: false, leadIn: 4, flips: false,
      sections: HOOKS[h].make(beats, col), _hook: h };
    if (th) { v.scene = "tools/scenes/theme.js"; v.theme = th.theme; v._variant = th.theme.variant; }
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
  // the role palette's path and hazard colours: make.js puts block rims and hazards on their own channels (spec.colours)
  try { const cr = C.compose(v); placed = cr.placed.map(q => q.name); if (v._palette && !v.theme) cr.spec.colours = Object.assign({}, cr.spec.colours, { path: v._palette.pathEdge, hazard: v._palette.hazardEdge }); built = mk(cr.spec, vf); } finally { console.log = log0; }
  const level = built.level, out = path.join(dir, `v${k}.gdlvl`); let levelStr = GD.serializeLevel(level);
  writeGdlvl(out, built.rec, level);
  let sol = require("./solutions.js").solve(level, levelStr, { name: v.name });
  // end right after the gameplay (the user, 2026-11-25: "leaves way too much space ... should end almost instantly after
  // the gameplay"): the moment's beats ran ~2 s past the last obstacle; cut there, the same route replayed on the cut level
  if (sol && sol.ok) { const tr = trimEnd(level, sol.events); if (tr) { level.objects = tr.level.objects; levelStr = GD.serializeLevel(level); writeGdlvl(out, built.rec, level);
    try { sol = require("./solutions.js").fromRun(level, levelStr, { ok: true, events: tr.events }, { name: v.name }); } catch (e) { sol = { ok: true, events: tr.events }; } } }
  const sc = scoreLevel(level, v, { fairness: false, levelStr });
  const PART = ["beatable", "prejumps", "timing", "recovery", "skips", "reactive", "fairness", "climbs", "roles"];   // roles: gd-art's colour-by-role gate
  const fails = sc.gates.filter(g => g.status === "FAIL" && PART.includes(g.name)).map(g => g.name), warns = sc.gates.filter(g => g.status === "WARN" && PART.includes(g.name)).map(g => g.name);
  let pace = null; try { const PA = require("./pace.js"), B = require("./beats.js"); pace = PA.paceOf(level, sol && sol.ok ? sol.events : null, B.loadBeats("custom_" + (v.song.custom || v.song))); } catch (e) { pace = { error: e.message }; }
  const res = { round: id, k, hook: v._hook, name: v.name, ok: !!(sol && sol.ok) && !fails.length, fails, warns, patterns: placed, pace, secs: (Date.now() - t0) / 1000, at: new Date().toISOString() };
  writeJ(path.join(dir, `v${k}.result.json`), res);
  // its viewer card (watch it, play it: "you play")
  try {
    const ST = require("./stages.js"), T = require("./pace.js").load().target;
    ST.put({ session: SESSION, base: `lab_${id}_v${k}`, name: v.name, stage: "layout", levelStr, data: { events: sol && sol.ok ? sol.events : [], kind: "planned" },
      note: `${v._hook}: ${HOOKS[v._hook].why}. Pace ${pace && pace.perBeat != null ? pace.perBeat + " inputs/beat" : "-"} (real ${T.perBeat}), ${pace && pace.cps != null ? pace.cps + " cps" : "-"} (real ${T.cps}), ${pace && pace.obsPerBar != null ? pace.obsPerBar + " obstacles/bar" : "-"} (real ${T.obsPerBar}), ${pace && pace.changesPer10s != null ? pace.changesPer10s + " changes/10 s" : "-"} (real ${T.changesPer10s})${res.ok ? "" : " -- NOT OK: " + fails.join(", ")}` });
  } catch (e) {}
  try { fs.appendFileSync(path.join(ROOT, "local", "timings.jsonl"), JSON.stringify({ at: res.at, tool: "lab.js", step: "lab-build", level: v.name, secs: res.secs }) + "\n"); } catch (e) {}
  return res;
}

function ask(id) {
  const dir = path.join(LAB, id), R = readJ(path.join(dir, "round.json"));
  const res = R.variants.map(x => { try { return readJ(path.join(dir, `v${x.k}.result.json`)); } catch (e) { return null; } });
  // every variant is an option, built or not (the viewer's lab view greys the unbuilt ones and fills them in as they
  // land): the user can start with the first ones; one card per round (asked again: the same card)
  if (R.ask && require("./ask.js").get(R.ask)) return { card: R.ask, options: require("./ask.js").get(R.ask).options, again: true };
  const options = R.variants.map(x => `v${x.k} ${x.hook}`).concat(["none: all dull"]);
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
  // the viewer's lab view (#lab=<round>, VIEWER.md) already logged the pick itself ({kind: "lab"}); this adds the details
  const review = { kind: "lab-detail", at: new Date().toISOString(), round: id, moment: R.moment, song: R.song, t: R.t, pick: k, hook: pick && pick.hook, reason: a.note || null, answer: a.answer,
    variants: rows.map(r => ({ k: r.k, hook: r.hook, ok: r.ok, pace: r.pace, patterns: r.patterns })) };
  fs.appendFileSync(path.join(ROOT, "local", "reviews.jsonl"), JSON.stringify(review) + "\n");
  // the user's taste as data: the picked hook weighted up; the picked section into the approved library
  const P = prefs(); P.picks = (P.picks || 0) + 1; if (pick) P.hooks[pick.hook] = (P.hooks[pick.hook] || 0) + 1;
  writeJ(path.join(ROOT, "knowledge", "lab_prefs.json"), P);
  if (pick) { const libF = path.join(LAB, "library.json"); let lib = []; try { lib = readJ(libF); } catch (e) {}
    lib.push({ round: id, moment: R.moment, song: R.song, t: R.t, beats: R.beats, hook: pick.hook, brief: `local/lab/${id}/v${k}.json`, level: `local/lab/${id}/v${k}.gdlvl`, reason: a.note || null, at: review.at }); writeJ(libF, lib); }
  return review;
}

// the round's picture sheet (the user, on the phone: "pictures of the new sections"): per variant 4 frames across its
// moment in GD art (tools/shoot.js), labelled with its hook and pace -> local/lab/<round>/sheet.jpg
function sheet(id) {
  const cp = require("child_process"), dir = path.join(LAB, id), R = readJ(path.join(dir, "round.json")), T = require("./pace.js").load().target;
  const at = [0.15, 0.4, 0.62, 0.85].map(p => +((R.t[1] - R.t[0]) * p).toFixed(2)), rows = [];
  for (const x of R.variants) {
    const lvl = path.join(dir, `v${x.k}.gdlvl`); if (!fs.existsSync(lvl)) continue;
    const out = path.join(dir, "shots", "v" + x.k);
    cp.spawnSync(process.execPath, [path.join(__dirname, "shoot.js"), lvl, "--at", at.join(","), "--out", out], { windowsHide: true, encoding: "utf8", timeout: 900000 });
    const frames = at.map(t => path.join(out, "t" + t.toFixed(2).padStart(6, "0") + ".png")).filter(p => fs.existsSync(p));
    if (!frames.length) continue;
    let r = null; try { r = readJ(path.join(dir, `v${x.k}.result.json`)); } catch (e) {}
    const p = (r && r.pace) || {};
    const label = `v${x.k}  ${x.hook}   ${p.perBeat ?? "-"} inputs per beat   ${p.obsPerBar ?? "-"} obstacles per bar   ${p.changesPer10s ?? "-"} changes per 10 s   (real ${T.perBeat} / ${T.obsPerBar} / ${T.changesPer10s})${r && !r.ok ? "   NOT OK " + r.fails.join(" ") : ""}`;
    rows.push({ frames, label });
  }
  if (!rows.length) return null;
  const outJpg = path.join(dir, "sheet.jpg"), args = ["-y", "-loglevel", "error"], parts = []; let n = 0;
  const font = "C\\:/Windows/Fonts/arial.ttf";
  rows.forEach((row, i) => {
    const ins = row.frames.map(fr => { args.push("-i", fr); return n++; });
    while (ins.length < 4) { args.push("-f", "lavfi", "-i", "color=c=black:s=480x270"); ins.push(n++); }
    parts.push(ins.map((j, q) => `[${j}]scale=480:270[s${i}_${q}]`).join(";") + ";" + ins.map((j, q) => `[s${i}_${q}]`).join("") + `hstack=inputs=4,pad=1920:310:0:40:color=0x14182a,drawtext=fontfile='${font}':text='${row.label.replace(/[':\\]/g, " ")}':fontcolor=white:fontsize=22:x=12:y=10[r${i}]`);
  });
  const filter = parts.join(";") + ";" + rows.map((r, i) => `[r${i}]`).join("") + `vstack=inputs=${rows.length},scale=1600:-1[out]`;
  args.push("-filter_complex", filter, "-map", "[out]", "-q:v", "3", outJpg);
  const r = cp.spawnSync("ffmpeg", args, { windowsHide: true, encoding: "utf8" });
  if (r.status !== 0) throw new Error("ffmpeg: " + (r.stderr || "").slice(0, 300));
  return outJpg;
}

function status(id) {
  if (!id) { for (const f of fs.existsSync(LAB) ? fs.readdirSync(LAB).filter(f => /^r\d+$/.test(f)) : []) { const R = readJ(path.join(LAB, f, "round.json")); console.log(`${f}: ${R.moment} ${R.t[0]}-${R.t[1]} s, ${R.variants.length} variants${R.ask ? ", card " + R.ask : ""}`); } return; }
  const dir = path.join(LAB, id), R = readJ(path.join(dir, "round.json")), T = require("./pace.js").load().target;
  console.log(`${id}: ${R.moment} (${R.t[0]}-${R.t[1]} s); real pace ${T.perBeat} inputs/beat, ${T.obsPerBar} obstacles/bar, ${T.changesPer10s} changes/10 s`);
  for (const x of R.variants) { let r = null; try { r = readJ(path.join(dir, `v${x.k}.result.json`)); } catch (e) {}
    console.log(`  v${x.k} ${x.hook.padEnd(13)} ${r ? (r.ok ? "ok  " : "FAIL") + ` ${r.secs.toFixed(0)} s  ${r.pace && r.pace.perBeat != null ? r.pace.perBeat + " in/beat " : ""}${r.pace && r.pace.obsPerBar != null ? r.pace.obsPerBar + " obs/bar " : ""}${r.pace && r.pace.changesPer10s != null ? r.pace.changesPer10s + " ch/10s" : ""}${r.fails.length ? "  fails " + r.fails.join(",") : ""}` : "not built"}`); }
}

// A section ends right after its gameplay (the user, 2026-11-25, on round 2: "the sections are cut too much apart probably,
// leaves way too much space between such sections. probably should end almost instantly after the gameplay"). The cut is
// TAIL blocks after the later of the last hazard / orb / pad / portal and the route's last input (a section of blocks
// only, like ufo hops, has no hazard); everything past it goes, so the level (GD ends at its furthest object, the sim at
// that + 3 blocks) ends ~0.5 s after the last input, as official levels do (~0.8 s, tools/make.js). The route is replayed
// on the cut level and must still finish without dying; else null (nothing cut). Returns { level, events, cutX, before, after }.
const TAIL = 3;
function trimEnd(level, events) {
  const { GD } = require("./io.js"), w0 = GD.makeWorld(level.objects, level.header);
  if (!events || !events.length) return null;
  const p0 = GD.run(w0, events).path, lastIn = Math.max(...events.map(e => e.tick)), xIn = GD.progressX ? GD.progressX(p0[Math.min(lastIn, p0.length - 1)]) : p0[Math.min(lastIn, p0.length - 1)].x;
  const KEY = new Set(["hazard", "orb", "pad", "mode", "gravity", "speed", "size", "dual", "teleport", "special"]);
  const xKey = Math.max(0, ...level.objects.filter(o => KEY.has((GD.objInfo(o.id) || {}).kind)).map(o => o.x));
  const cutX = Math.max(xKey, xIn) + TAIL * 30;
  if (w0.endX - (cutX + 90) < 3 * 30) return null;   // already ends about there
  const objects = level.objects.filter(o => o.x <= cutX), lv = Object.assign({}, level, { objects }), w = GD.makeWorld(objects, level.header);
  const q = GD.run(w, events.filter(e => e.tick <= lastIn)), e = q.path[q.path.length - 1];
  if (q.dead || !(q.done || e.x >= w.endX)) return null;
  return { level: lv, events: events.filter(e => e.tick <= lastIn), cutX, before: w0.endX, after: w.endX };
}
// trim already built variants in place: v<k>.gdlvl and the viewer's stage card (no solve; the stage keeps the route)
function trim(id, only) {
  const dir = path.join(LAB, id), R = readJ(path.join(dir, "round.json")), { GD, readGdlvl, writeGdlvl } = require("./io.js"), ST = require("./stages.js"), out = [];
  for (const x of R.variants) { if (only && x.k !== only) continue;
    const base = `lab_${id}_v${x.k}`, sdir = ST.dirOf(SESSION, base); let idx = null; try { idx = readJ(path.join(sdir, "index.json")); } catch (e) {}
    const st = idx && idx.stages.find(s => s.stage === "layout"), ev = st && st.data && st.data.events;
    if (!st || !ev || !ev.length) { out.push({ k: x.k, skip: "no built route" }); continue; }
    const L = readGdlvl(path.join(sdir, "layout.gdlvl")), tr = trimEnd(L.level, ev);
    if (!tr) { out.push({ k: x.k, skip: "already ends at its gameplay, or the cut route would not finish" }); continue; }
    const levelStr = GD.serializeLevel(tr.level), vf = path.join(dir, `v${x.k}.gdlvl`);
    try { if (fs.existsSync(vf)) writeGdlvl(vf, readGdlvl(vf).rec, tr.level); } catch (e) {}
    ST.put({ session: SESSION, base, name: idx.name, stage: "layout", levelStr, data: Object.assign({}, st.data, { events: tr.events }), note: st.note });
    out.push({ k: x.k, from: +(tr.before / 30).toFixed(1), to: +(tr.after / 30).toFixed(1) });
  }
  return out;
}
module.exports = { round, build, ask, collect, status, sheet, trim, trimEnd, HOOKS };

if (require.main === module) {
  const [cmd, a, b, ...rest] = process.argv.slice(2), all = [a, b, ...rest], opt = k => { const i = all.indexOf(k); return i >= 0 ? all[i + 1] : null; };
  if (cmd === "round") { const R = round(a, { beats: opt("--beats"), name: opt("--name"), hooks: opt("--hooks"), n: +(opt("--n") || 6), palette: opt("--palette"), hue0: opt("--hue") != null ? +opt("--hue") : undefined }); console.log(`${R.id}: ${R.moment} ${R.t[0]}-${R.t[1]} s; variants: ${R.variants.map(v => "v" + v.k + " " + v.hook).join(", ")}`); }
  else if (cmd === "build") { const r = build(a, +b); console.log(`${r.name}: ${r.ok ? "OK" : "NOT OK " + r.fails.join(",")} in ${r.secs.toFixed(0)} s; pace ${JSON.stringify(r.pace)}`); }
  else if (cmd === "ask") { const r = ask(a); console.log(`decision card ${r.card}: ${r.options.join(" | ")}`); }
  else if (cmd === "collect") { const r = collect(a); console.log(r.waiting ? `waiting for the user's answer (card ${r.card})` : `picked v${r.pick} ${r.hook}${r.reason ? ' -- "' + r.reason + '"' : ""} -> local/reviews.jsonl, library, prefs`); }
  else if (cmd === "sheet") { const p = sheet(a); console.log(p ? "-> " + path.relative(ROOT, p) : "no built variants"); }
  else if (cmd === "finish") { status(a); const p = sheet(a); console.log(p ? "sheet -> " + path.relative(ROOT, p) : "no sheet"); const r = ask(a); console.log("decision card " + r.card); }
  else if (cmd === "trim") for (const r of trim(a, b ? +b : null)) console.log(`v${r.k}: ` + (r.skip ? r.skip : `ends at block ${r.to} (was ${r.from})`));
  else if (cmd === "status") status(a);
  else console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("// node")).join("\n"));
}
