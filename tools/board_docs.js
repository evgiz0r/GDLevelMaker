// node tools/board_docs.js [--stats local/difficulty/user_stats_online.json] [--latest local/community/latest_rated.json] --out <dir>
// Builds the work board's two big docs, compact ({cols, rows}: a db document must stay under 256 KB), from the PC's files:
//   <dir>/played.json  -- board/played: every level with attempts or finished (col done), totals, a note (from save_stats.js)
//   <dir>/latest.json  -- board/latest: GD's recently rated list (from latest_rated.js), as it is
// Then write them with ArtifactData set (board/README.md). Local data only: never commit the outputs.
const fs = require("fs"), path = require("path");
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const ROOT = path.join(__dirname, "..");
const STATS = arg("--stats", path.join(ROOT, "local", "difficulty", "user_stats_online.json"));
const LATEST = arg("--latest", path.join(ROOT, "local", "community", "latest_rated.json"));
const OUT = arg("--out"); if (!OUT) { console.error("--out <dir> needed"); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });

const d = JSON.parse(fs.readFileSync(STATS, "utf8"));
const cols = ["id", "name", "creator", "kind", "tier", "stars", "attempts", "jumps", "best", "practice", "done"];
const L = d.levels.filter(l => (l.attempts || 0) > 0 || l.done);
const rows = L.map(l => cols.map(c => c === "done" ? (l.done ? 1 : 0) : (l[c] === undefined ? null : l[c])));
const t = d.totals, nd = L.filter(l => l.done).length;
const note = `Every level you've played, from your save (read only, never changed): ${nd} finished and ${L.length - nd} not finished yet. ` +
  `Your save counts ${t.officialDone + t.onlineDone} finished and ${t.demons} demons in all; some finished ones have no per-level stats in the save, so they can't be listed. ` +
  `Tries: lifetime attempts (incl. replays). Best: normal-mode best %. Practice: practice best %.`;
const played = JSON.stringify({ at: d.at, cols, rows, totals: t, note });
fs.writeFileSync(path.join(OUT, "played.json"), played);
console.log("played:", L.length, "levels,", nd, "finished,", Math.round(played.length / 1024), "KB");
if (played.length > 240 * 1024) console.error("!! played.json is near the 256 KB document limit: split it");

if (fs.existsSync(LATEST)) {
  const lr = fs.readFileSync(LATEST, "utf8");
  fs.writeFileSync(path.join(OUT, "latest.json"), lr);
  console.log("latest:", JSON.parse(lr).rows.length, "levels,", Math.round(lr.length / 1024), "KB");
}
