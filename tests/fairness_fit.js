// node tests/fairness_fit.js   -- tools/fairness.js still predicts the user's labelled deaths: every
// unfair and borderline death flagged, the fair one not (local/real_stats.jsonl, GDLM 44 v5 + 46 v2).
// Needs local/ (real_stats, the played level files); skips if absent. First run ~3 min, then cached
// in local/difficulty/fairness/ per physics commit (delete it after changing fairness.js's analyse()).
const fs = require("fs"), path = require("path"), { execFileSync } = require("child_process");
if (!fs.existsSync(path.join(__dirname, "..", "local", "real_stats.jsonl"))) { console.log("skip: no local/real_stats.jsonl"); process.exit(0); }
const out = execFileSync(process.execPath, [path.join(__dirname, "..", "tools", "fairness.js"), "fit"], { encoding: "utf8", maxBuffer: 1 << 24 });
const m = out.match(/unfair deaths flagged (\d+)\/(\d+).*?borderline flagged (\d+)\/(\d+), fair deaths not flagged (\d+)\/(\d+)/);
if (!m) { console.log(out); console.log("FAIL: no summary line"); process.exit(1); }
const [u, un, b, bn, f, fn] = m.slice(1).map(Number);
const ok = u === un && b === bn && f === fn && un >= 12; // every labelled death right (false alarms are reported, not failed)
console.log(`${ok ? "ok  " : "FAIL"} unfair ${u}/${un}, borderline ${b}/${bn}, fair left alone ${f}/${fn}`);
process.exit(ok ? 0 : 1);
