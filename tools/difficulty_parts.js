// node tools/difficulty_parts.js
//
// How much of the official star ratings simple measures explain, one at a time and together: clicks per
// second, the tightest window, the share of tight inputs, the windows alone (summed miss chance), windows
// per minute (windows + CPS), and the full model (+ settling after portals). Spearman rank agreement over
// the official levels with a cached report (local/difficulty/scored_NN.json, from tools/difficulty.js),
// Fingerdash left out (the sim stops at 6%). Unbeaten levels count only the part the sim covers.
// Answers "do frame windows and CPS decide difficulty?" (DIFFICULTY.md "What windows and CPS explain").
const fs = require("fs"), path = require("path");
const DF = require("../lib/difficulty.js"), OUT = path.join(__dirname, "..", "local", "difficulty");
const { RATED, spearman } = require("./difficulty.js");
const user = (() => { try { return JSON.parse(fs.readFileSync(path.join(OUT, "user_stats.json"), "utf8")); } catch (e) { return null; } })();
const SIG = DF.DIFF.SIGMA, SET = DF.DIFF.SETTLE, TIGHT = DF.DIFF.TIGHT;
const rows = [];
for (const n of Object.keys(RATED).map(Number)) {
  if (n === 21) continue;
  const f = path.join(OUT, `scored_${String(n).padStart(2, "0")}.json`);
  if (!fs.existsSync(f)) continue;
  const c = JSON.parse(fs.readFileSync(f, "utf8")), A = c.actions, sec = Math.max(c.seconds, 1e-9);
  const miss = (a, settle) => {
    const k = settle && a.afterSwitchMs != null && a.afterSwitchMs < SET ? Math.max(0.02, a.afterSwitchMs / SET) : 1;
    return -Math.log10(Math.max(DF.hitChance(a.ms, SIG) * k, 1e-9));
  };
  const win = A.reduce((s, a) => s + miss(a, false), 0), full = A.reduce((s, a) => s + miss(a, true), 0);
  rows.push({ n, stars: RATED[n][2], att: user && user[n] ? user[n].attempts : null,
    cps: A.length / sec, minW: -Math.min(...A.map(a => a.ms)), tight: A.filter(a => a.ms < TIGHT).length / A.length,
    win, winPm: win / sec * 60, full, fullPm: full / sec * 60 });
}
const cols = [["clicks per second", "cps"], ["tightest window (smaller = harder)", "minW"], ["share of inputs under " + TIGHT + " ms", "tight"],
  ["windows alone, whole level", "win"], ["windows per minute (windows + CPS)", "winPm"], ["full model, whole level", "full"], ["full model per minute", "fullPm"]];
console.log(`${rows.length} official levels (Fingerdash out)\n${"measure".padEnd(40)} vs stars  vs your attempts`);
for (const [label, k] of cols) {
  const s = spearman(rows.map(r => r[k]), rows.map(r => r.stars));
  const u = rows.every(r => r.att) ? spearman(rows.map(r => r[k]), rows.map(r => r.att)).toFixed(2) : "-";
  console.log(`${label.padEnd(40)} ${s.toFixed(2).padStart(8)}  ${u.padStart(15)}`);
}
