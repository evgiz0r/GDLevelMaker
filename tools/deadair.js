// node tools/deadair.js <level.gdlvl ...> [--gap 3] [--tail 2] [--gate]
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
  const L = readGdlvl(file), objs = L.level.objects;
  const sol = require("./solutions.js").get(L.levelStr, true);
  if (!sol || !sol.events) return { name: L.name, error: "no saved solution (node tools/solutions.js <level>)" };
  const w = GD.makeWorld(objs, L.level.header), path = GD.run(w, sol.events).path;
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
  return { name: L.name, gaps, last, end, sign, tail: sign - last, after: end - sign };
}

if (require.main === module) {
  if (!args.length) { console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n")); process.exit(1); }
  let bad = 0;
  for (const f of args) {
    const r = check(f);
    if (r.error) { console.log(`${r.name}: ${r.error}`); continue; }
    const flags = r.gaps.map(([a, b]) => `nothing for ${(b - a).toFixed(1)} s (${a.toFixed(1)}-${b.toFixed(1)} s)`);
    if (r.tail > TAIL) flags.push(`the last gameplay at ${r.last.toFixed(1)} s, the sign at ${r.sign.toFixed(1)} s: ${r.tail.toFixed(1)} s of run-out`);
    if (r.after > AFTER) flags.push(`the level runs on ${r.after.toFixed(1)} s past the sign (its furthest object at ${r.end.toFixed(1)} s)`);
    bad += flags.length;
    console.log(`${r.name}: ${flags.length ? flags.length + " dead stretch(es)" : "clean"} (last gameplay ${r.last.toFixed(1)} s, sign ${r.sign.toFixed(1)} s, end ${r.end.toFixed(1)} s)`);
    for (const s of flags) console.log("   " + s);
  }
  process.exit(argv.includes("--gate") && bad ? 1 : 0);
}
module.exports = { check };
