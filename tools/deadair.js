// node tools/deadair.js <level.gdlvl | official:N ...> [--gap 3] [--tail 2] [--inputgap 1.5] [--gate]
//
// Also (the user on GDLM 61 v3, 38-46 s, three ~2 s gaps in the click line: "very big breaks with
// nothing"; the 3 s rule passed them because floor spikes passed under the ball counted as "something"):
//   input gaps  -- no press or release for longer than max(--inputgap 2 s, 2.5x the level's median gap
//                  between presses): a hazard rolling by is not play when the player does nothing
//   empty screens -- 1+ s with no hazard, orb, pad or structure off the floor in view (the camera's ~6 blocks
//                  behind to ~13 ahead): an empty field
// Official levels (official:N, their solver routes): empty screens 1 in all ten (Stereo Madness 1.8 s), so an
// empty screen is a real fault; input gaps of 2-4 s show in most of them, partly because a solver route holds
// through bounces -- the input limit is a level's own rhythm, not a hard number.
// Ship and wave stretches count releases as inputs; a deliberate calm is accepted in the brief
// ("accept": {"dead air": "why"}) -- give it deco and keep it short.
//
// Stretches where nothing happens (the user on GDLM 44 hellgate polish v4: "the ending is too long where
// nothing happens. lets have the ending actually ending with gameplay. with the sign still there"). A
// soft rule: no stretch longer than ~3 s (--gap) without an input or a hazard, orb, pad or portal on the
// path, unless it is a deliberate breather; and the last gameplay ends <= ~2 s (--tail) before the level's
// end (the signature, tools/signature.js, stands right after it).
// "Something happens" = an input of the saved natural plan (tools/solutions.js), or a hazard, orb, pad or
// portal passed within 2 blocks of the path, or flying (ship / wave) with a wall within 2.5 blocks. Time from the path (240 Hz ticks). The sign = the signature's
// text (914) after the last hazard; the level's end = its furthest object (GD ends a level there, deco
// included): want <= --after 2 s past the sign. Static + one replay: ~a second a level.
// POLISH.md "Soft rules from the user's notes".
const fs = require("fs");
const { GD, readGdlvl } = require("./io.js");
const O = require("../lib/objects.js");
const argv = process.argv.slice(2), args = argv.filter((a, i) => !a.startsWith("--") && !(i > 0 && argv[i - 1].startsWith("--")));
const opt = (k, d) => { const i = argv.indexOf("--" + k); return i < 0 ? d : +argv[i + 1]; };
const GAP = opt("gap", 3), TAIL = opt("tail", 2), AFTER = opt("after", 2);

function check(file) {
  const m = /^official:(\d+)$/.exec(file);
  if (m) {   // an official level with its cached solution (tools/difficulty_solve.js): the yardstick for the limits
    const path = require("path"), nn = String(m[1]).padStart(2, "0"), root = path.join(__dirname, "..", "local");
    const off = JSON.parse(fs.readFileSync(path.join(root, "official_" + nn + ".json"), "utf8")), lv = GD.parseLevel(off.level);
    let so; try { so = JSON.parse(fs.readFileSync(path.join(root, "difficulty", nn + ".json"), "utf8")); } catch (e) {}
    if (!so || !so.events || !so.ok) return { name: off.name || file, error: "no finished solution in local/difficulty/" };
    return Object.assign({ name: off.name || file }, analyse(lv.objects, lv.header, so.events));
  }
  const L = readGdlvl(file), objs = L.level.objects;
  const sol = require("./solutions.js").get(L.levelStr, true);
  if (!sol || !sol.events) return { name: L.name, error: "no saved solution (node tools/solutions.js <level>)" };
  return Object.assign({ name: L.name }, analyse(objs, L.level.header, sol.events));
}
const INPUT_GAP = opt("inputgap", 2), EMPTY = 1;
// input gaps and empty screens on a route (events), for score.js too
function quiet(objs, header, ev, path) {
  path = path || GD.run(GD.makeWorld(objs, header), ev).path;
  const ins = ev.filter(e => e.type === "press" || e.type === "release" || e.down != null).map(e => e.tick / 240).sort((a, b) => a - b);
  const presses = ev.filter(e => e.type === "press" || e.down).map(e => e.tick / 240).sort((a, b) => a - b);
  const d = []; for (let i = 1; i < presses.length; i++) d.push(presses[i] - presses[i - 1]);
  d.sort((a, b) => a - b); const med = d.length ? d[d.length >> 1] : 1;
  const lim = Math.max(INPUT_GAP, 2.5 * med), gaps = [];
  const endT = path.length / 240;
  for (let i = 1; i < ins.length; i++) if (ins[i] - ins[i - 1] > lim) gaps.push([ins[i - 1], ins[i]]);
  // empty screens: sample every 0.25 s, the camera's view ~6 blocks behind to ~13 ahead of the player
  const things = objs.filter(o => { const k = (O.objInfo(o.id) || {}).kind;
    if (o.props && o.props[57] === "990") return false;
    return k === "hazard" || k === "orb" || k === "pad" || ((k === "solid" || k === "slope") && o.y > 20); }).map(o => o.x).sort((a, b) => a - b);
  const seen = x => { let lo = 0, hi = things.length; while (lo < hi) { const m = (lo + hi) >> 1; if (things[m] < x - 180) lo = m + 1; else hi = m; } return lo < things.length && things[lo] <= x + 390; };
  const empty = []; let run = null;
  for (let t = 0; t < endT; t += 0.25) {
    const q = path[Math.min(path.length - 1, Math.round(t * 240))];
    if (q && !seen(q.x) && t > 2 && t < endT - 1.5) { if (!run) run = [t, t]; run[1] = t; }
    else { if (run && run[1] - run[0] >= EMPTY) empty.push(run); run = null; }
  }
  if (run && run[1] - run[0] >= EMPTY) empty.push(run);
  return { inputGaps: gaps, inputLimit: lim, medianGap: med, empty };
}
function analyse(objs, header, events0) {
  const sol = { events: events0 };
  const w = GD.makeWorld(objs, header), path = GD.run(w, sol.events).path;
  const tOfX = x => { let lo = 0, hi = path.length - 1; if (path[hi].x < x) return hi / 240 + (x - path[hi].x) / 311.58; while (lo < hi) { const m = (lo + hi) >> 1; if (path[m].x >= x) hi = m; else lo = m + 1; } return lo / 240; };
  const events = [];
  for (const e of sol.events) if (e.type === "press" || e.down) events.push(e.tick / 240);
  for (const o of objs) {
    const k = (O.objInfo(o.id) || {}).kind;
    if (!(k === "hazard" || k === "orb" || k === "pad" || k === "portal" || k === "speed" || k === "gravity")) continue;
    if (o.props && o.props[57] === "990") continue;
    const t = tOfX(o.x), q = path[Math.min(path.length - 1, Math.round(t * 240))];
    if (q && Math.abs(q.y - o.y) <= 75) events.push(t);
  }
  // flying between walls is gameplay too: a wave or ship corridor's slopes and blocks within 2.5 blocks of the
  // path (GDLM 44's second wave, 4 s with 2 presses and no hazard, read as "nothing happens")
  const walls = objs.filter(o => { const k = (O.objInfo(o.id) || {}).kind; return (k === "solid" || k === "slope") && !(o.props && (o.props[121] === "1" || o.props[134] === "1")); });
  for (let i = 0; i < path.length; i += 60) {
    const q = path[i];
    if (!q || (q.mode !== "wave" && q.mode !== "ship")) continue;
    if (walls.some(o => Math.abs(o.x - q.x) <= 30 && Math.abs(o.y - q.y) <= 75)) events.push(i / 240);
  }
  events.sort((a, b) => a - b);
  // the sign: the signature's text after the last hazard (a title text at the start does not count);
  // the level's end: GD ends a level at its furthest object, decoration included
  const lastHaz = Math.max(0, ...objs.filter(o => (O.objInfo(o.id) || {}).kind === "hazard").map(o => o.x));
  const signs = objs.filter(o => o.id === 914 && o.x > lastHaz);
  const endX = Math.max(...objs.map(o => o.x)), signX = signs.length ? Math.min(...signs.map(o => o.x)) : endX;
  const end = tOfX(endX), sign = tOfX(signX), gaps = [];
  for (let i = 1; i < events.length; i++) if (events[i] - events[i - 1] > GAP) gaps.push([events[i - 1], events[i]]);
  const last = events.length ? events[events.length - 1] : 0;
  const Q = quiet(objs, header, sol.events, path);
  return { gaps, last, end, sign, tail: sign - last, after: end - sign, inputGaps: Q.inputGaps, inputLimit: Q.inputLimit, empty: Q.empty };
}

if (require.main === module) {
  if (!args.length) { console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n")); process.exit(1); }
  let bad = 0;
  for (const f of args) {
    const r = check(f);
    if (r.error) { console.log(`${r.name}: ${r.error}`); continue; }
    const flags = r.gaps.map(([a, b]) => `nothing for ${(b - a).toFixed(1)} s (${a.toFixed(1)}-${b.toFixed(1)} s)`);
    if (r.tail > TAIL) flags.push(`the last gameplay at ${r.last.toFixed(1)} s, the sign at ${r.sign.toFixed(1)} s: ${r.tail.toFixed(1)} s of run-out`);
    for (const [a, b] of r.inputGaps) flags.push(`no input for ${(b - a).toFixed(1)} s (${a.toFixed(1)}-${b.toFixed(1)} s; this level's limit ${r.inputLimit.toFixed(1)} s)`);
    for (const [a, b] of r.empty) flags.push(`an empty screen for ${(b - a + 0.25).toFixed(1)} s (${a.toFixed(1)}-${(b + 0.25).toFixed(1)} s): no hazard, orb, pad or structure in view`);
    if (r.after > AFTER) flags.push(`the level runs on ${r.after.toFixed(1)} s past the sign (its furthest object at ${r.end.toFixed(1)} s)`);
    bad += flags.length;
    console.log(`${r.name}: ${flags.length ? flags.length + " dead stretch(es)" : "clean"} (last gameplay ${r.last.toFixed(1)} s, sign ${r.sign.toFixed(1)} s, end ${r.end.toFixed(1)} s)`);
    for (const s of flags) console.log("   " + s);
  }
  process.exit(argv.includes("--gate") && bad ? 1 : 0);
}
module.exports = { check, analyse, quiet };
