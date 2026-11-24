// node tools/habits.js [local/inputs/<log>.csv ...]   -- the user's input habits from the input logs of real GD runs
// (tools/inputlog.ps1 / inputlog_raw.ps1, written by tools/record.sh). Default: every log in local/inputs/ from the fixed
// logger on (the 02:13-02:34 logs missed clicks: PHYSICS.md "Fidelity"), merged files left out.
// Prints: presses per key, tap length (down -> up) percentiles, hold length, the gap between presses.
// Use: the human route's parameters (lib/natural.js TAP, ~60 ms from the user's own estimate) against how this player
// really plays (2026-11-24: median tap 120 ms over 3,094 presses), and difficulty's per-player timing model.
const fs = require("fs"), path = require("path");
const DIR = path.join(__dirname, "..", "local", "inputs");
const FIXED_FROM = "2026-11-24_02-34-02";   // the first log of the fixed hook logger
let files = process.argv.slice(2);
if (!files.length) files = fs.existsSync(DIR) ? fs.readdirSync(DIR).filter(f => /^GD inputs .*\.csv$/.test(f) && !/merged/.test(f))
  .filter(f => (f.match(/\d{4}-\d\d-\d\d_\d\d-\d\d-\d\d/) || [""])[0] >= FIXED_FROM).map(f => path.join(DIR, f)) : [];
if (!files.length) { console.log("no input logs (local/inputs/)"); process.exit(0); }
const holds = [], gaps = [], keys = {};
for (const f of files) {
  const ev = fs.readFileSync(f, "utf8").split(/\r?\n/).filter(l => l && !l.startsWith("#")).map(l => { const c = l.split(","); return { t: Date.parse(c[1]), ud: c[2], k: c[3] }; });
  const down = {}; let lastDown = null;
  for (const e of ev) {
    if (e.ud === "down") { keys[e.k] = (keys[e.k] || 0) + 1; if (lastDown != null && e.t - lastDown < 2000) gaps.push(e.t - lastDown); lastDown = e.t; down[e.k] = e.t; }
    else if (down[e.k] != null) { holds.push(e.t - down[e.k]); down[e.k] = null; }
  }
}
const pc = (arr, ps) => { const s = arr.slice().sort((a, b) => a - b); return ps.map(p => s[Math.min(s.length - 1, Math.floor(s.length * p))]); };
const taps = holds.filter(v => v < 200);
console.log(`${files.length} log(s): ${holds.length} presses (${Object.entries(keys).map(([k, n]) => k + " " + n).join(", ")})`);
console.log(`tap (< 200 ms, ${taps.length}): p10 / p50 / p90 = ${pc(taps, [0.1, 0.5, 0.9]).join(" / ")} ms  (= ${(pc(taps, [0.5])[0] * 0.24).toFixed(0)} ticks at the median)`);
console.log(`every press held: p25 / p50 / p75 / p90 = ${pc(holds, [0.25, 0.5, 0.75, 0.9]).join(" / ")} ms`);
console.log(`gap between presses (< 2 s): p10 / p50 / p90 = ${pc(gaps, [0.1, 0.5, 0.9]).join(" / ")} ms`);
