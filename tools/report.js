// node tools/report.js <level.gdlvl> [--json] [--out report.json] [--geo <map>.geo.json] [--no-fair]
//   -- the judge report: one short card per level with scores and the top notes (Evgeni, 2026-11-26: "lets add a judge
//      report - not too big, with scores. over layout if exists, and over the deco later"). On the level's saved route
//      (tools/solutions.js; none -> run node tools/solutions.js <level> first), no solve:
//   Difficulty   lib/difficulty.js on the route: ~attempts and the tier word
//   Fairness     tools/fairness.js flags on the route (deaths that are not the player's fault); --no-fair skips it (~1 min)
//   Taste        tools/taste.js: 0-100 against featured levels of the band (static measures)
//   Layout       five 0-10 sub-scores from tools/judge.js's notes, and their mean:
//                  balance  how close the sections' clicks per second are (10 * (1 - coefficient of variation))
//                  flow     10 - 3 per second of gap past judge.js GAP
//                  variety  10 - 2.5 per "no variety" / "same corridor" note
//                  pacing   10 - 2 per "long corridor" note
//                  clarity  10 - 3 per "pointless orb" note
//   Deco         not judged yet (a second section, to come: the deco thread's checks)
//   Top notes    judge.js's five worst, each with its time and block (the marks page pins them).
//   The scores go into knowledge/measurements.jsonl (tools/measures.js: "layout"), stamped with the level's version.
if (require.main === module) require("./heavy.js").claim();   // fairness replays the route: one heavy-job slot
"use strict";
const fs = require("fs"), path = require("path");
const RANK = { "pointless orb": 0, "few clicks": 1, "gap": 2, "long corridor": 3, "same corridor": 4, "no variety": 5, "too easy": 6 };

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
  const gapS = n("gap").reduce((a, g) => a + Math.max(0, (+(/([\d.]+) s with/.exec(g.note) || [0, 0])[1]) - J.GAP), 0);
  const sub = { balance: cl(10 * (1 - Math.min(1, cv))), flow: cl(10 - 3 * gapS), variety: cl(10 - 2.5 * (n("no variety").length + n("same corridor").length)),
    pacing: cl(10 - 2 * n("long corridor").length), clarity: cl(10 - 3 * n("pointless orb").length) };
  out.layout = Object.assign({ score: +(Object.values(sub).reduce((a, b) => a + b, 0) / 5).toFixed(1) }, sub);
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

function text(r) {
  const f = (k, v) => `${k.padEnd(11)}${v}`, d = r.difficulty || {}, fa = r.fairness;
  const L = [`${r.level}: ${r.seconds} s, ${r.presses} presses, ${r.modes.length} modes${r.beaten ? "" : ", NOT beaten on its route"}${r.stale ? " (route from older physics)" : ""}`,
    f("Layout", `${r.layout.score}/10  balance ${r.layout.balance} · flow ${r.layout.flow} · variety ${r.layout.variety} · pacing ${r.layout.pacing} · clarity ${r.layout.clarity}`),
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
