// node tools/report.js <level.gdlvl> [--json] [--out report.json] [--geo <map>.geo.json] [--no-fair]
//   -- the judge report: one short card per level with scores and the top notes (Evgeni, 2026-11-26: "lets add a judge
//      report - not too big, with scores. over layout if exists, and over the deco later"). On the level's saved route
//      (tools/solutions.js; none -> run node tools/solutions.js <level> first), no solve:
//   Difficulty   lib/difficulty.js on the route: ~attempts and the tier word
//   Fairness     tools/fairness.js flags on the route (deaths that are not the player's fault); --no-fair skips it (~1 min)
//   Taste        tools/taste.js: 0-100 against featured levels of the band (static measures)
//   Layout       nine 0-10 sub-scores from tools/judge.js's notes and stats; the total is their mean minus 0.2 per point
//                any of them falls under 6 (GDLM 44 v7: 2.7, it was 6.6 before the v8 checks):
//                  balance  how close the sections' and the pieces' clicks a second and the pieces' tightest windows are,
//                           minus 0.75 per "uneven piece" (3 at most)
//                  modes    cube over 50% of the play, under 15% upside down
//                  transitions  10 - 2 per "walked portal" - 1.5 per "abrupt switch" - 2 for a "ground start"
//                  rests    breathers a minute against 8 (the mains ~11)
//                  flow     10 - 3 per second of gap past 2 s (a shorter one is a rest)
//                  variety  10 - 2.5 per "no variety" / "same corridor" note
//                  pacing   10 - 2 per "long corridor" note
//                  clarity  10 - 3 per "pointless orb" or "unseen roof" note
//                  ending   4 with a "flat ending" note, else 10
//                  height   the route's spread over the rows (tools/heightspread.js): cover + evenness vs 0.6, -1.5 never
//                           at the bottom / top, -1 per mode stuck in <= 3 rows
//   Deco         not judged yet (a second section, to come: the deco thread's checks)
//   Top notes    judge.js's five worst, each with its time and block (the marks page pins them).
//   The scores go into knowledge/measurements.jsonl (tools/measures.js: "layout"), stamped with the level's version.
if (require.main === module) require("./heavy.js").claim();   // fairness replays the route: one heavy-job slot
"use strict";
const fs = require("fs"), path = require("path");
const RANK = { "uneven piece": -4, "too much cube": -3, "no reverse": -3, "walked portal": -2, "abrupt switch": -2, "ground start": -2, "no rests": -2, "unseen roof": -1, "pointless orb": 0, "few clicks": 1, "gap": 2, "long corridor": 3, "same corridor": 4, "no variety": 5, "too easy": 6 };

function report(file, opt = {}) {
  const { readGdlvl, GD } = require("./io.js"), S = require("./solutions.js"), J = require("./judge.js");
  const L = readGdlvl(file), sol = S.get(L.levelStr, true);
  if (!sol || !sol.events) throw new Error("no saved route: node tools/solutions.js " + file);
  const j = J.judge(file), w = GD.makeWorld(L.level.objects, L.level.header), run = GD.run(w, sol.events);
  const last = run.path[run.path.length - 1], secs = run.path.length / 240, presses = sol.events.filter(e => e.type === "press").length;
  const out = { level: L.name, file: path.relative(path.join(__dirname, ".."), path.resolve(file)).replace(/\\/g, "/"), seconds: +secs.toFixed(1),
    presses, beaten: !!(last && last.done && !last.dead), stale: !sol.ok, modes: [...new Set(j.sections.map(s => s.mode))] };
  // difficulty
  try { const DF = GD; const d = DF.difficulty(w, sol, {}); out.difficulty = { attempts: Math.round(10 ** d.logAttempts), label: DF.difficultyLabel(d.logAttempts), tightestMs: Math.round(d.tightest) }; }
  catch (e) { out.difficulty = { error: e.message.slice(0, 80) }; }
  // fairness
  if (!out.beaten) out.fairness = { error: "its route dies at " + secs.toFixed(1) + " s on today's physics: re-solve (node tools/solutions.js " + out.file + ")" };
  else if (!opt.noFair) { try { const F = require("./fairness.js"), a = F.analyse(w, Object.assign({ ok: true }, sol, { path: run.path })), fl = F.flags(a);
      out.fairness = { flags: fl.length, worst: fl.slice().sort((a, b) => (b.severity || 0) - (a.severity || 0)).slice(0, 3).map(f => `${f.family} at block ${Math.round((f.x0 || 0) / 30)}`) }; }
    catch (e) { out.fairness = { error: e.message.slice(0, 80) }; } }
  // taste
  try { const cp = require("child_process");
    const t = JSON.parse(cp.execFileSync(process.execPath, [path.join(__dirname, "taste.js"), "score", file, "--json"], { encoding: "utf8", windowsHide: true, env: Object.assign({}, process.env, { GDLM_HEAVY_HELD: "1" }), maxBuffer: 1 << 24 }).trim().split("\n").pop());
    out.taste = { score: t.score }; } catch (e) { out.taste = { error: "taste.js failed" }; }
  // layout sub-scores from the judge
  const n = k => j.notes.filter(x => x.kind === k), cl = v => Math.max(0, Math.min(10, +v.toFixed(1)));
  const cps = j.sections.filter(s => s.dur >= 2).map(s => s.clicks / s.dur), mean = cps.reduce((a, b) => a + b, 0) / Math.max(1, cps.length);
  const cv = cps.length > 1 ? Math.sqrt(cps.reduce((a, b) => a + (b - mean) ** 2, 0) / cps.length) / Math.max(mean, 1e-9) : 0;
  // a gap up to REST_MAX s is a rest (Evgeni on v7: "some places just nothing for few seconds"), counted by the rests
  // sub-score; flow loses 3 a second past it
  const REST_MAX = 2.0, gapS = n("gap").reduce((a, g) => a + Math.max(0, (+(/([\d.]+) s with/.exec(g.note) || [0, 0])[1]) - REST_MAX), 0);
  // v8 (Evgeni, 2026-11-26, after v7 scored 6.6: "the judge seems to be too nice"): balance is the spread of the PIECES too
  // (clicks a second and tightest windows), minus 0.75 per uneven piece (3 at most); modes: cube over its share, too little upside down;
  // transitions: walked-in and abrupt portals; rests: breathers a minute. The total is the mean minus 0.2 per point any
  // sub-score falls under 6 (one bad axis pulls the level down, as it does when he plays it)
  const st = j.stats || {};
  const sub = { balance: cl(10 * (1 - Math.min(1, (cv + (st.cpsCv || 0) + 0.8 * (st.winSd || 0)) / 2)) - Math.min(3, 0.75 * n("uneven piece").length)),
    modes: cl(10 - (st.cubeShare > 0.5 ? 25 * (st.cubeShare - 0.5) + 2 : 0) - (n("no reverse").length ? 6 * (1 - Math.min(1, (st.upShare || 0) / 0.15)) + 2 : 0)),
    transitions: cl(10 - 2 * n("walked portal").length - 1.5 * n("abrupt switch").length - 2 * n("ground start").length),
    rests: cl(10 * Math.min(1, (st.restsPerMin || 0) / 8)), flow: cl(10 - 3 * gapS), variety: cl(10 - 2.5 * (n("no variety").length + n("same corridor").length)),
    pacing: cl(10 - 2 * n("long corridor").length), clarity: cl(10 - 3 * n("pointless orb").length - 3 * n("unseen roof").length), ending: n("flat ending").length ? 4 : 10,
    height: heightScore(require("./heightspread.js").spreadOf(run.path)) };
  const vals = Object.values(sub), meanSub = vals.reduce((a, b) => a + b, 0) / vals.length;
  out.layout = Object.assign({ score: cl(meanSub - 0.2 * vals.reduce((a, v) => a + Math.max(0, 6 - v), 0)) }, sub);
  out.deco = null;   // judged later
  out.notes = j.notes.slice().sort((a, b) => (RANK[a.kind] ?? 9) - (RANK[b.kind] ?? 9) || a.t - b.t).slice(0, 5);
  out.allNotes = j.notes.length;
  // pins on the level map: --geo <map>.geo.json (tools/levelmap.js writes it) -> fx, fy (0-1 on the picture) per note
  if (opt.geo) { const g = opt.geo, rowOf = x => Math.min(g.rows - 1, Math.max(0, Math.floor(x / g.rowU)));
    for (const nt of out.notes) { const x = nt.x * 30, r = rowOf(x);
      nt.fx = +((10 + (x - r * g.rowU) * g.S) / g.width).toFixed(4);
      nt.fy = +((g.HEAD + r * (g.rowH + g.GAP) + g.TOP + (g.sceneH - g.GROUND * g.S) - ((nt.y || 0) - g.camY0) * g.S) / g.height).toFixed(4); } }
  try { require("./measures.js").record({ level: path.basename(file, ".gdlvl"), name: L.name, levelStr: L.levelStr, file: out.file, measure: "layout", value: out.layout.score, unit: "0-10", detail: sub }); } catch (e) {}
  return out;
}

// height (Evgeni 2026-11-27: "distrubution of height in the gameplay will be part of the scoring"): the route's rows over
// the 0..12 band -- 10 * the mean of cover and evenness against the 0.6 target, minus 1.5 for never touching the bottom row
// (rows 0-1) or the top (row >= 9), minus 1 per mode stuck in <= 3 rows over more than 10% of the play
function heightScore(sp) {
  const v = sp.level, base = 10 * Math.min(1, (Math.min(1, v.cover / 0.6) + Math.min(1, v.even / 0.6)) / 2);
  const stuck = Object.values(sp.modes).filter(m => m.hi - m.lo <= 2 && m.share > 0.1).length;
  return Math.max(0, Math.min(10, +(base - (v.lo > 1 ? 1.5 : 0) - (v.hi < 9 ? 1.5 : 0) - stuck).toFixed(1)));
}

function text(r) {
  const f = (k, v) => `${k.padEnd(11)}${v}`, d = r.difficulty || {}, fa = r.fairness;
  const L = [`${r.level}: ${r.seconds} s, ${r.presses} presses, ${r.modes.length} modes${r.beaten ? "" : ", NOT beaten on its route"}${r.stale ? " (route from older physics)" : ""}`,
    f("Layout", `${r.layout.score}/10  balance ${r.layout.balance} · modes ${r.layout.modes} · transitions ${r.layout.transitions} · rests ${r.layout.rests} · flow ${r.layout.flow} · variety ${r.layout.variety} · pacing ${r.layout.pacing} · clarity ${r.layout.clarity} · height ${r.layout.height} · ending ${r.layout.ending}`),
    f("Difficulty", d.error ? "(error) " + d.error : `${d.label} (~${d.attempts} attempts, tightest ${d.tightestMs} ms)`),
    fa ? f("Fairness", fa.error ? "(error) " + fa.error : fa.flags ? `${fa.flags} unfair spot${fa.flags > 1 ? "s" : ""}: ${fa.worst.join(", ")}` : "no unfair spots") : null,
    f("Taste", r.taste.error ? "(error)" : `${r.taste.score}/100`),
    f("Deco", "not judged yet"),
    `Top notes (${r.notes.length} of ${r.allNotes}):`, ...r.notes.map((x, i) => `  ${i + 1}. ${x.t} s, block ${x.x}: ${x.kind}: ${x.note}`)];
  return L.filter(Boolean).join("\n");
}

if (require.main === module) {
  const a = process.argv.slice(2), oi = k => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : null; };
  if (!a[0]) { console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n")); process.exit(1); }
  const r = report(a[0], { noFair: a.includes("--no-fair"), geo: oi("--geo") ? JSON.parse(fs.readFileSync(oi("--geo"), "utf8")) : null });
  if (a.includes("--json")) console.log(JSON.stringify(r, null, 1)); else console.log(text(r));
  if (oi("--out")) fs.writeFileSync(oi("--out"), JSON.stringify(r, null, 1));
}
module.exports = { report, text };
