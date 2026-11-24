// node tools/vibediff.js <real level> <rebuild level> <sheet.vibe.json> [--md out.md] [--pictures]
//   -- the benchmark of the whole creation process (USE_CASES 31, VIBES.md "Decompile, recompile, diff"): a real level,
//      its vibe sheet (written from it), and the level our pipeline rebuilt from the sheet ALONE, compared beat by beat of
//      the sheet on five axes -- energy (hazards + gameplay per block, and the curve's correlation over the level),
//      density (hazards / gameplay / deco per block), variety (modes, kinds of gameplay object), look (background
//      colour, palette switches), sync (portals on a beat / on a bar start) -- each row with a verdict: close, or what
//      differs. A difference is either a layer the sheet does not carry, or something the pipeline cannot build yet;
//      the report's last column says which, where it can tell.
//   Levels: a .gdlvl, "official:N", or a community id (as tools/storyboard.js). --pictures: side-by-side frames of the
//   two at each beat's middle (tools/compare_frames.js; local only, RobTop's art).
"use strict";
const fs = require("fs"), path = require("path"), cp = require("child_process");
const ROOT = path.join(__dirname, "..");
const SB = require("./storyboard.js"), V = require("./vibe.js");
const { readGdlvl, GD } = require("./io.js");

function load(w) {
  let m;
  if ((m = /^official:(\d+)$/.exec(w))) { const j = JSON.parse(fs.readFileSync(path.join(ROOT, "local", `official_${String(+m[1]).padStart(2, "0")}.json`), "utf8")); return { name: j.name, levelStr: j.level }; }
  if (/^\d+$/.test(w)) w = path.join(ROOT, "local", "community", w + ".gdlvl");
  return readGdlvl(w);
}
const offsetOf = lv => { const m = /kA13,([\d.]+)/.exec(String(GD.parseLevel(lv.levelStr).header)); return m ? +m[1] : 0; };
const rgb = h => { const n = parseInt(String(h).slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const colDist = (a, b) => { const p = rgb(a), q = rgb(b); return Math.sqrt(p.reduce((s, v, i) => s + (v - q[i]) ** 2, 0)) / 441; };
function pearson(a, b) { const n = Math.min(a.length, b.length); if (n < 3) return 0; const A = a.slice(0, n), B = b.slice(0, n), ma = A.reduce((s, v) => s + v, 0) / n, mb = B.reduce((s, v) => s + v, 0) / n;
  let num = 0, da = 0, db = 0; for (let i = 0; i < n; i++) { num += (A[i] - ma) * (B[i] - mb); da += (A[i] - ma) ** 2; db += (B[i] - mb) ** 2; } return da && db ? num / Math.sqrt(da * db) : 0; }

// one level over a window of SONG seconds
function windowStats(a, off, t0, t1) {
  const w0 = t0 - off, w1 = t1 - off, secs = a.sections.filter(s => s.t1 > w0 && s.t0 < w1);
  let tot = 0; const acc = { hazards: 0, gameplay: 0, deco: 0, kinds: 0 }, modes = {};
  for (const s of secs) { const d = Math.min(s.t1, w1) - Math.max(s.t0, w0); if (d <= 0) continue; tot += d; for (const k in acc) acc[k] += s[k] * d; modes[s.mode] = (modes[s.mode] || 0) + d; }
  for (const k in acc) acc[k] = tot ? acc[k] / tot : 0;
  const modeList = Object.entries(modes).sort((p, q) => q[1] - p[1]).filter(([, d]) => d > 0.8).map(([m]) => m);
  return { ...acc, modes: modeList, bg: a.bgAtT((w0 + w1) / 2), switches: a.bgSwitches.filter(t => t >= w0 && t < w1).length,
    energy: (() => { const st = a.strip.filter(s => s.t >= w0 - 1e-6 && s.t < w1); return st.length ? st.reduce((s, v) => s + v.play, 0) / st.length : 0; })() };
}
function sync(a, off, grid) {
  const ps = a.portalTimes.filter(p => p.t > 0.5); if (!ps.length) return { n: 0, beat: 0, bar: 0 };
  const per = grid.period, db = grid.downbeat || 0;
  let beat = 0, bar = 0;
  for (const p of ps) { const st = p.t + off, k = Math.round((st - grid.t0) / per), d = Math.abs(st - (grid.t0 + k * per));
    if (d < 0.07) { beat++; if (((k - db) % 4 + 4) % 4 === 0) bar++; } }
  return { n: ps.length, beat: beat / ps.length, bar: bar / ps.length };
}

function diff(realLv, rebLv, sheet) {
  const ra = SB.analyse(realLv, { every: 1 }), ba = SB.analyse(rebLv, { every: 1 });
  const ro = offsetOf(realLv), bo = offsetOf(rebLv);
  const grid = (() => { try { const s = sheet.song; const f = s.official ? path.join(ROOT, "local", "beats", "official_" + ["StereoMadness", "BackOnTrack", "Polargeist", "DryOut", "BaseAfterBase", "CantLetGo", "Jumper", "TimeMachine", "Cycles", "xStep", "Clutterfunk", "TheoryOfEverything", "ElectromanAdventures", "Clubstep", "Electrodynamix", "HexagonForce", "BlastProcessing", "TheoryOfEverything2", "GeometricalDominator", "Deadlocked", "Fingerdash", "Dash"][s.official - 1] + ".json") : path.join(ROOT, "local", "beats", "custom_" + s.custom + ".json"); return JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { return null; } })();
  const from = (sheet.song && sheet.song.from) || 0;
  const rows = (sheet.beats || []).map(b => {
    const t0 = b.t[0] + from, t1 = b.t[1] + from, r = windowStats(ra, ro, t0, t1), q = windowStats(ba, bo, t0, t1);
    const v = [];
    const rel = (x, y) => Math.abs(x - y) / Math.max(0.3, (x + y) / 2);
    if (rel(r.energy, q.energy) > 0.4) v.push(`energy ${q.energy > r.energy ? "higher" : "lower"} (${q.energy.toFixed(1)} vs ${r.energy.toFixed(1)})`);
    if (rel(r.deco, q.deco) > 0.6 && Math.max(r.deco, q.deco) > 1) v.push(`deco ${q.deco.toFixed(1)} vs ${r.deco.toFixed(1)}/block`);
    const norm = ms => [...new Set(ms.map(m => m.replace(/ mirrored/, "")))].sort().join("+");
    if (norm(r.modes) !== norm(q.modes)) v.push(`modes ${q.modes.join("+") || "-"} vs ${r.modes.join("+") || "-"}`);
    if (r.modes.some(m => /mirrored/.test(m)) && !q.modes.some(m => /mirrored/.test(m))) v.push("mirror missing (not simulated: pipeline)");
    if (colDist(r.bg, q.bg) > 0.25) v.push(`colour ${q.bg} vs ${r.bg}`);
    if (r.switches !== q.switches && Math.abs(r.switches - q.switches) > 1) v.push(`palette switches ${q.switches} vs ${r.switches}`);
    if (Math.abs(r.kinds - q.kinds) > 3) v.push(`kinds of object ${q.kinds.toFixed(0)} vs ${r.kinds.toFixed(0)}`);
    return { id: b.id, t: [t0, t1], real: r, rebuild: q, verdict: v.length ? v : ["close"] };
  });
  const len = Math.min(ra.strip.length, ba.strip.length);
  const curve = pearson(ra.strip.slice(0, len).map(s => s.play), ba.strip.slice(0, len).map(s => s.play));
  return { real: ra.name, rebuild: ba.name, rows, level: { seconds: [ra.seconds, ba.seconds], energyCorr: +curve.toFixed(2),
    modeChanges: [ra.sections.length, ba.sections.length], bgSwitches: [ra.bgSwitches.length, ba.bgSwitches.length],
    sync: grid ? [sync(ra, ro, grid), sync(ba, bo, grid)] : null } };
}

function md(d) {
  const L = [], f = x => x.toFixed(1);
  L.push(`# ${d.rebuild} vs ${d.real} (decompile -> recompile -> diff)`, "");
  L.push(`| beat | t (song s) | modes rebuild / real | energy | haz/b | deco/b | colour | verdict |`, `|---|---|---|---|---|---|---|---|`);
  for (const r of d.rows) L.push(`| ${r.id} | ${r.t[0]}-${r.t[1]} | ${r.rebuild.modes.join("+") || "-"} / ${r.real.modes.join("+") || "-"} | ${f(r.rebuild.energy)} / ${f(r.real.energy)} | ${r.rebuild.hazards.toFixed(2)} / ${r.real.hazards.toFixed(2)} | ${f(r.rebuild.deco)} / ${f(r.real.deco)} | ${r.rebuild.bg} / ${r.real.bg} | ${r.verdict.join("; ")} |`);
  const l = d.level;
  L.push("", `Level: ${l.seconds[1]} s vs ${l.seconds[0]} s; energy curve correlation ${l.energyCorr} (1 = the same shape); sections ${l.modeChanges[1]} vs ${l.modeChanges[0]}; palette switches ${l.bgSwitches[1]} vs ${l.bgSwitches[0]}` +
    (l.sync ? `; portals on a beat ${Math.round(l.sync[1].beat * 100)}% vs ${Math.round(l.sync[0].beat * 100)}%, on a bar start ${Math.round(l.sync[1].bar * 100)}% vs ${Math.round(l.sync[0].bar * 100)}%` : ""));
  return L.join("\n");
}
module.exports = { diff, md };

if (require.main === module) {
  const a = process.argv.slice(2), opt = k => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : null; };
  if (a.length < 3) { console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n")); process.exit(1); }
  const sheet = JSON.parse(fs.readFileSync(a[2], "utf8"));
  const d = diff(load(a[0]), load(a[1]), sheet), text = md(d);
  console.log(text);
  if (opt("--md")) fs.writeFileSync(opt("--md"), text + "\n");
  if (a.includes("--pictures")) {
    const at = d.rows.map(r => ((r.t[0] + r.t[1]) / 2).toFixed(1)).join(",");
    cp.spawnSync(process.execPath, [path.join(__dirname, "compare_frames.js"), a[1], a[0], "--at", "s:" + at], { stdio: "inherit", windowsHide: true });
  }
}
