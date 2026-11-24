// How long heavy jobs take, from measurements only (CLAUDE.md: "Estimates come from measurements, not guesses").
// tools/heavy.js records every finished heavy job here (one line in local/timings.jsonl, {by:"heavy", tool, level,
// flags, secs, ok, est}), keyed by tool + level + main flags; estimate() reads them back with their basis.
//   node tools/jobtime.js est <command line>     the estimate for a job and its basis ("last 3 make, this level: 4-6 min")
//   node tools/jobtime.js recent [n]             the last n finished heavy jobs: estimate vs actual (drift)
//   require("./jobtime.js").estimate(cmd) -> { secs, lo, hi, n, basis } | null (= "not measured")
// Keys: tool = tools/<tool>.js; level = the first .gdlvl / .json / official:N / save:x argument (file name, no
// extension; a spec specs/NN_x.json counts as the level it builds, gdlm_NN_x); flags = the --flags (names, not values),
// plus "jN" when the spec or brief has jN columns (each one is another solve: a make with jN columns is several solves);
// kb = the level file's size (levels/<level>.gdlvl), the stand-in for its length. Match order: same tool + level +
// flags (or loop.js runs of that level, which did not log flags); same tool + flags on a level of similar size (within
// 2x). Nothing else -- other flags differ too much (make --look ~1 s, make ~30 s):
// a run of another size says nothing ("score" took 11 s on a short cube level and 15 min on a 60 s level with modes).
// loop.js's own rows (step, no tool) count too, except where a heavy row logged the same run.
// GDLM_TIMINGS overrides the file (tests).
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const FILE = () => process.env.GDLM_TIMINGS || path.join(ROOT, "local", "timings.jsonl");
const STEP_TOOL = { make: "make", compose: "compose", score: "score", render: "shoot", map: "levelmap", wip: "wip", "solve-official": "difficulty_solve" };

function key(cmd) {
  const args = String(cmd || "").split(/\s+/).filter(Boolean);
  const ti = args.findIndex(a => /tools[\\/]\w+\.js$/.test(a));
  const tool = ti >= 0 ? /(\w+)\.js$/.exec(args[ti])[1] : (args[0] || "").replace(/\.js$/, "");
  const rest = args.slice(ti + 1);
  let level = "", flags = [], kb = null;
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a.startsWith("--")) { flags.push(a.replace(/=.*$/, "")); continue; }
    if (!level && /\.(gdlvl|json)$|^(official|save):/.test(a)) {
      const abs = path.isAbsolute(a) ? a : path.join(ROOT, a);
      level = /^(official|save):/.test(a) ? a : path.basename(a).replace(/\.(gdlvl|json)$/, "");
      if (/\.json$/.test(a)) {
        try { if (/"j\d+/.test(fs.readFileSync(abs, "utf8"))) flags.push("jN"); } catch (e) {}
        if (/^\d+_/.test(level) && /specs|briefs/.test(a)) level = "gdlm_" + level.replace(/\.hits$/, "");
      }
      kb = sizeOf(level, /\.gdlvl$/.test(a) ? abs : null);
    }
  }
  return { tool, level, flags: [...new Set(flags)].sort(), kb };
}
// a level's size in kB (levels/<level>.gdlvl, or the file given), null when there is no such file
function sizeOf(level, file) {
  for (const f of [file, level && path.join(ROOT, "levels", level + ".gdlvl")]) if (f) try { return Math.round(fs.statSync(f).size / 1024 * 10) / 10; } catch (e) {}
  return null;
}
function rows() {
  try { return fs.readFileSync(FILE(), "utf8").split("\n").filter(Boolean).map(l => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean); } catch (e) { return []; }
}
const fmt = s => s < 90 ? `${Math.round(s)} s` : s < 5400 ? `${Math.round(s / 60)} min` : `${(s / 3600).toFixed(1)} h`;
const range = (lo, hi) => fmt(lo) === fmt(hi) ? fmt(lo) : lo < 90 && hi >= 90 ? `${fmt(lo)}-${fmt(hi)}` : fmt(lo).replace(/ \w+$/, "") + "-" + fmt(hi);

function estimate(cmd, all) {
  const k = typeof cmd === "string" ? key(cmd) : cmd; if (!k.tool) return null;
  all = all || rows();
  const heavyRows = all.filter(r => r.by === "heavy" && r.tool === k.tool && r.ok !== false && r.secs > 0);
  // loop.js's rows too, but not the ones a heavy row already logged (the same run, both within 2 min)
  const dup = r => heavyRows.some(h => h.level === r.level && Math.abs(Date.parse(h.at) - Date.parse(r.at)) < 120e3);
  const legacy = all.filter(r => !r.by && STEP_TOOL[r.step] === k.tool && r.ok !== false && r.secs > 0)
    .concat(all.filter(r => k.tool === "make" && !r.by && r.step === "make --look" && r.ok !== false && r.secs > 0).map(r => Object.assign({}, r, { step: "make", flags: ["--look"] })))
    .filter(r => !dup(r)).map(r => Object.assign({}, r, { tool: k.tool, flags: r.flags || [], legacy: !r.flags }));   // legacy: loop.js did not log its flags
  const pool = legacy.concat(heavyRows).sort((a, b) => String(a.at).localeCompare(String(b.at)));
  const fl = k.flags.join(" "), same = r => (r.flags || []).slice().sort().join(" ") === fl;
  const kbOf = r => r.kb != null ? r.kb : (r.kb = sizeOf(r.level));
  const near = r => k.kb != null && kbOf(r) != null && Math.max(k.kb, r.kb) <= 2 * Math.max(0.1, Math.min(k.kb, r.kb));
  const tiers = [
    [k.level ? pool.filter(r => r.level === k.level && same(r)) : [], "this level"],
    // loop.js rows of this level whose flags were not logged (a loop make of a spec with jN columns is that same job)
    [k.level ? pool.filter(r => r.level === k.level && r.legacy && !k.flags.includes("--look")) : [], "this level, loop.js runs"],
    [pool.filter(r => r.level !== k.level && same(r) && near(r)), "levels of similar size"],
  ];
  if (!k.level) tiers.push([pool.filter(same), ""]);   // a job with no level (e.g. --all): same tool and flags
  for (const [rs, what] of tiers) {
    if (!rs.length) continue;
    const last = rs.slice(-3).map(r => r.secs), lo = Math.min(...last), hi = Math.max(...last);
    const s = last.slice().sort((a, b) => a - b), med = s[s.length >> 1];
    const name = k.tool + (fl ? " " + fl : "");
    const mbs = rs.slice(-3).map(r => r.mb).filter(v => v > 0);   // peak memory of the same runs (heavy.js logs it): the light lane
    return { secs: med, lo, hi, n: last.length, mb: mbs.length ? Math.max(...mbs) : null, basis: `last ${last.length === 1 ? "run" : last.length} ${name}${what ? ", " + what : ""}: ${range(lo, hi)}` };
  }
  return null;
}
function record(cmd, startMs, ok, est, extra) {
  const k = key(cmd), secs = +((Date.now() - startMs) / 1000).toFixed(1);
  const row = Object.assign({ at: new Date().toISOString(), by: "heavy", tool: k.tool, level: k.level, flags: k.flags, kb: k.kb, secs, ok, est: est ? Math.round(est.secs) : null, cmd: String(cmd).slice(0, 200) }, extra || {});
  try { fs.mkdirSync(path.dirname(FILE()), { recursive: true }); fs.appendFileSync(FILE(), JSON.stringify(row) + "\n"); } catch (e) {}
  return row;
}
// the last n finished heavy jobs with estimate vs actual
function recent(n = 10) {
  return rows().filter(r => r.by === "heavy").slice(-n).reverse().map(r => ({ at: r.at, tool: r.tool, level: r.level, flags: r.flags, secs: r.secs, ok: r.ok, est: r.est,
    drift: r.est ? +(r.secs / r.est).toFixed(2) : null }));
}
module.exports = { key, rows, estimate, record, recent, fmt, range };

if (require.main === module) {
  const a = process.argv.slice(2);
  if (a[0] === "est") { const e = estimate(a.slice(1).join(" ")); console.log(e ? `~${fmt(e.secs)} (${e.basis})` : "not measured"); }
  else if (a[0] === "recent") for (const r of recent(+a[1] || 15)) console.log(`${r.at.slice(5, 16).replace("T", " ")}  ${r.tool} ${r.level} ${(r.flags || []).join(" ")}  took ${fmt(r.secs)}${r.ok === false ? " (failed)" : ""}  estimate ${r.est ? fmt(r.est) + (r.drift >= 2 || r.drift <= 0.5 ? "  !! off " + r.drift + "x" : "") : "none"}`);
  else console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n"));
}
