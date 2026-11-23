// node tools/flow.js [official] [ours] [<level.gdlvl> ...] [--json]
//
// Height change and repetition along a level's route, in the jumping modes (cube, robot, ball, spider;
// either gravity). The user on GDLM 47's upside-down part: "some sections are somewhat boring. all in
// flat area. no change of height really. no variety. robtop levels do show decent change of height in
// their play, trying not to repeat exact gameplay for a long while". Replays a saved route (official
// levels: local/official_NN.json, the solver's inputs; GDLM levels: tools/solutions.js, the player's
// route), no solving. Per level:
//   jumpS      seconds of play in the jumping modes
//   changes/10s  how often the floor the player stands on changes by a block or more, per 10 s
//   range      median over 10 s windows of the highest minus the lowest floor stood on (blocks)
//   flat10     share of 10 s windows with no floor change at all
//   ground     share of standing time on the bare ground (the floor at 0, or the band's floor/roof)
//   repeat     share of 4-move patterns (a move = the time to the next press in 0.1 s steps + the floor
//              change it leads to: up / same / down) seen already within the previous 10 s
// STRUCTURES.md "Height and repetition" has the official vs GDLM numbers and the targets from them.
const fs = require("fs"), path = require("path");
const { GD, readGdlvl } = require("./io.js");
const ROOT = path.join(__dirname, ".."), LOCAL = path.join(ROOT, "local");
const JUMP = /^(cube|robot|ball|spider)$/;

function measure(level, events) {
  const w = GD.makeWorld(level.objects, level.header), res = GD.run(w, events), p = res.path, TPS = GD.PHYS.TPS;
  // standing spans: grounded ticks in a jumping mode; the floor = the feet's height in blocks
  const stand = [];
  for (let t = 0; t < p.length; t++) {
    const q = p[t]; if (!JUMP.test(q.mode) || !q.grounded) continue;
    const feet = q.grav === -1 ? q.y + 15 : q.y - 15, f = Math.round(feet / 30);
    const bare = q.grav === -1 ? (isFinite(q.ceilY) && Math.abs(feet - q.ceilY) < 3) : Math.abs(feet - (q.floorY || 0)) < 3;
    stand.push({ t, f, s: q.grav === -1 ? -1 : 1, bare });
  }
  let jumpTicks = 0; for (const q of p) if (JUMP.test(q.mode)) jumpTicks++;
  const jumpS = jumpTicks / TPS;
  // floor changes: between consecutive standing ticks (any gap), floor or gravity side differs
  const changes = [];
  for (let i = 1; i < stand.length; i++) if (stand[i].f !== stand[i - 1].f || stand[i].s !== stand[i - 1].s) changes.push(stand[i].t);
  // 10 s windows over the jumping-mode time only (concatenated standing ticks' clock is fine: windows
  // over real time, counted where there was standing in them)
  const win = 10 * TPS, ranges = [], flats = [];
  for (let a = 0; a < p.length; a += win / 2) {
    const s = stand.filter(x => x.t >= a && x.t < a + win);
    if (s.length < TPS * 2) continue;             // under 2 s standing: not a jumping stretch
    const fs_ = s.map(x => x.f);   // height in blocks, either gravity
    ranges.push(Math.max(...fs_) - Math.min(...fs_));
    flats.push(changes.some(c => c >= a && c < a + win) ? 0 : 1);
  }
  const med = a => { const b = a.slice().sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : null; };
  // moves: press -> next press interval (0.1 s) + the floor change after it
  const presses = events.filter(e => e.type === "press").map(e => e.tick).filter(t => p[t] && JUMP.test(p[t].mode));
  const floorAt = t => { let f = null; for (const x of stand) { if (x.t > t) break; f = x.f * x.s; } return f; };
  const moves = [];
  for (let i = 0; i + 1 < presses.length; i++) {
    const dt = Math.round((presses[i + 1] - presses[i]) / TPS * 10); if (dt > 30) { moves.push(null); continue; }
    const a = floorAt(presses[i]), b = floorAt(presses[i + 1]);
    moves.push({ t: presses[i], k: dt + (b > a ? "u" : b < a ? "d" : "s") });
  }
  let grams = 0, rep = 0;
  for (let i = 3; i < moves.length; i++) {
    const g = moves.slice(i - 3, i + 1); if (g.some(m => !m)) continue;
    const key = g.map(m => m.k).join(","), t = g[0].t; grams++;
    for (let j = i - 1; j >= 3; j--) {
      const h = moves.slice(j - 3, j + 1); if (h.some(m => !m)) continue;
      if (t - h[0].t > win) break;
      if (h.map(m => m.k).join(",") === key) { rep++; break; }
    }
  }
  return { jumpS: +jumpS.toFixed(1), changesPer10s: jumpS ? +(changes.length / jumpS * 10).toFixed(1) : null,
    range: med(ranges), flat10: flats.length ? +(flats.reduce((a, b) => a + b, 0) / flats.length).toFixed(2) : null,
    ground: stand.length ? +(stand.filter(x => x.bare).length / stand.length).toFixed(2) : null,
    repeat: grams ? +(rep / grams).toFixed(2) : null, finished: !res.dead };
}

function official() {
  const out = [];
  for (let n = 1; n <= 22; n++) {
    const f = path.join(LOCAL, `official_${String(n).padStart(2, "0")}.json`);
    if (!fs.existsSync(f)) continue;
    const j = JSON.parse(fs.readFileSync(f, "utf8"));
    if (!j.solution || !j.solution.events) continue;
    out.push(Object.assign({ name: `${n} ${j.name}` }, measure(GD.parseLevel(j.level), j.solution.events)));
  }
  return out;
}
function ours(files) {
  const out = [];
  for (const f of files) {
    const L = readGdlvl(f), s = require("./solutions.js").get(L.levelStr);
    if (!s || !s.events) { out.push({ name: L.name, note: "no saved solution" }); continue; }
    out.push(Object.assign({ name: L.name }, measure(L.level, s.events)));
  }
  return out;
}
function table(rows) {
  const cols = ["jumpS", "changesPer10s", "range", "flat10", "ground", "repeat"];
  console.log("level".padEnd(34) + cols.map(c => c.padStart(14)).join(""));
  for (const r of rows) console.log(String(r.name).slice(0, 33).padEnd(34) + (r.note ? r.note : cols.map(c => String(r[c] ?? "-").padStart(14)).join("") + (r.finished === false ? "  (route ends early)" : "")));
}
const median = (rows, k) => { const v = rows.map(r => r[k]).filter(x => x != null).sort((a, b) => a - b); return v.length ? v[Math.floor(v.length / 2)] : null; };

module.exports = { measure, official, ours, median };

if (require.main === module) {
  const args = process.argv.slice(2), files = args.filter(a => a.endsWith(".gdlvl"));
  const json = args.includes("--json"), out = {};
  if (args.includes("official")) out.official = official();
  if (args.includes("ours")) out.ours = ours(fs.readdirSync(path.join(ROOT, "levels")).filter(f => /^gdlm_\d+/.test(f)).map(f => path.join(ROOT, "levels", f)));
  if (files.length) out.files = ours(files);
  if (json) console.log(JSON.stringify(out, null, 1));
  else for (const [k, rows] of Object.entries(out)) {
    console.log(`\n== ${k}`); table(rows);
    console.log("median".padEnd(34) + ["jumpS", "changesPer10s", "range", "flat10", "ground", "repeat"].map(c => String(median(rows, c) ?? "-").padStart(14)).join(""));
  }
}
