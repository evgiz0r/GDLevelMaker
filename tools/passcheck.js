// node tools/passcheck.js <level: official:N | c<id> | levels/x.gdlvl> --from <block> --to <block> [--video "<rec>.mkv" --t <s>]
//        [--max 40000] [--trail] [--mini] [--set k=v,...]   (--trail: start from the official solver's saved route, local/difficulty/NN.json)
// Can ANY input get the sim through this stretch? An exhaustive held / not-held search, tick by tick, from the state the
// player is in at --from (taken from a recorded attempt's replay: local/attempts/<base>.jsonl, the line of --video/--t,
// else the first video line), merging states that agree on position, speed, mode, gravity, button, hover and orbs.
// Prints PASSES with one way's presses (and the user's own presses there, to compare), or NO WAY with the furthest
// state reached and what killed it. NO WAY where the user really got through = a physics difference right there; a
// way that needs presses the user did not make = an input the log missed, or timing. (Hexagon Force's orb chain and
// Fingerdash's robot at block 555 were checked this way, 2026-11-24.) PHYSICS.md "Fidelity".
if (require.main === module) require("./heavy.js").claim();   // one heavy job at a time (tools/heavy.js)
const fs = require("fs"), path = require("path");
const { GD, readGdlvl, unpack } = require("./io.js");
const a = process.argv.slice(2), opt = (k, d) => { const i = a.indexOf("--" + k); return i < 0 ? d : a[i + 1]; };
const lv = a.find((x, i) => !x.startsWith("--") && !(a[i - 1] || "").startsWith("--"));
if (!lv || opt("from") == null || opt("to") == null) { console.log(fs.readFileSync(__filename, "utf8").split("\n").slice(0, 2).join("\n")); process.exit(1); }
const SRC = require("./gdpaths.js").LEVELS;
const levelStr = lv.startsWith("official:") ? unpack(fs.readFileSync(SRC + lv.slice(9) + ".txt", "utf8"))
  : /^c\d+$/.test(lv) ? readGdlvl(path.join(__dirname, "..", "local", "community", lv.slice(1) + ".gdlvl")).levelStr : readGdlvl(lv).levelStr;
const L = GD.parseLevel(levelStr), w = GD.makeWorld(L.objects, L.header);
const MINI = a.includes("--mini"), FROM = +opt("from") * 30, TO = +opt("to") * 30, MAX = +opt("max", 40000);
const TRAIL = a.includes("--trail") && lv.startsWith("official:");
const lines = TRAIL ? [] : require("./attempts.js").read(lv).filter(o => o.events && o.events.length);
const line = TRAIL ? null : (opt("video") ? lines.filter(o => o.video && o.video.file === path.basename(opt("video")) && Math.abs(o.video.t - +opt("t", o.video.t)) < 1) : lines.filter(o => o.source === "video"))[0] || lines[0];
const evs = TRAIL ? (JSON.parse(fs.readFileSync(path.join(__dirname, "..", "local", "difficulty", String(lv.slice(9)).padStart(2, "0") + ".json"), "utf8")).events || []) : line ? line.events : [];
const q = GD.run(w, evs), p = q.path, k0 = p.findIndex(s => s && s.x >= FROM);
if (k0 < 0) { console.log(`the attempt's replay never reaches block ${opt("from")} (it ends at block ${(q.end.x / 30).toFixed(1)})`); process.exit(1); }
let held0 = false; for (const e of evs) { if (e.tick > k0) break; held0 = e.type === "press"; }
const clone = x => ({ ...x, used: x.used.slice(), prev: x.prev ? x.prev.slice() : x.prev });
// --set "y=165,grav=1,vy=0,grounded=1,mode=cube": overwrite the start state (a clean start where the run's own is off the play)
const s0 = clone(p[k0]); if (opt("set")) for (const kv of opt("set").split(",")) { const [k, v] = kv.split("="); s0[k] = v === "true" || v === "1" && k === "grounded" ? true : v === "false" ? false : isNaN(+v) ? v : +v; }
let front = [{ s: s0, h: held0, pr: [] }], best = { x: 0 }, won = null, peak = 0;
for (let it = 0; it < 5000 && front.length && !won; it++) {
  const nx = new Map();
  for (const n of front) for (const h of [false, true]) {
    const r = GD.step(w, clone(n.s), { press: h && !n.h, held: h });
    if (r.dead) { if (r.x > best.x && (!MINI || r.mini)) best = { x: r.x, y: r.y, vy: r.vy, mode: r.mode + (r.mini ? " mini" : ""), why: r.why, killer: r.killer }; continue; }
    const pr = h && !n.h ? n.pr.concat([k0 + it + 1]) : n.pr;
    if ((r.x >= TO || r.done) && (!MINI || r.mini)) { won = pr; break; }   // --mini: only a way that took the mini portal counts
    const key = [Math.round(r.y * 2), Math.round(r.vy * 4), r.grav, r.mode, r.mini ? 1 : 0, r.sp, h ? 1 : 0, r.grounded ? 1 : 0, r.hover || 0, r.robotLet ? 1 : 0, r.ring ? 1 : 0, r.lb > 0 ? r.lb : 0, r.used.join(".")].join(",");
    if (!nx.has(key)) nx.set(key, { s: r, h, pr });
  }
  front = [...nx.values()]; peak = Math.max(peak, front.length);
  if (front.length > MAX) { front.sort((u, v) => v.s.x - u.s.x || Math.abs(u.s.y - 0) - Math.abs(v.s.y - 0)); front.length = MAX; }
}
const user = evs.filter(e => e.type === "press" && e.tick >= k0 && e.tick <= k0 + 1200).map(e => (e.tick / 240).toFixed(3));
console.log(`${lv} blocks ${opt("from")}-${opt("to")}, from the attempt${line && line.video ? " @" + line.video.t + " s of " + line.video.file : ""} (tick ${k0}, ${(k0 / 240).toFixed(3)} s, ${p[k0].mode}, button ${held0 ? "down" : "up"}); up to ${peak} states`);
if (won) console.log(`PASSES. One way: presses at ${won.map(t => (t / 240).toFixed(3)).join(" ")} s`);
else console.log(`NO WAY through in our physics: furthest block ${(best.x / 30).toFixed(1)} y ${best.y != null ? best.y.toFixed(1) : "?"} (${best.mode}, ${best.why}${best.killer ? " on id " + best.killer.id + " at block " + (best.killer.x / 30).toFixed(1) + " y " + best.killer.y : ""})`);
console.log(`the user's presses there: ${user.join(" ")}`);
