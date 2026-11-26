// node tools/board_docs.js [--stats local/difficulty/user_stats_online.json] [--latest local/community/latest_rated.json] [--out <dir>]
// Builds the work board's two big docs, compact ({cols, rows}: a db document must stay under 256 KB), from the PC's files:
//   <dir>/played.json, played_2.json, ...  -- board/played (+ board/played_N): every level with attempts or finished (col done), totals, a note (from save_stats.js)
//   <dir>/latest.json  -- board/latest: GD's recently rated list (from latest_rated.js), plus here[]: ids with a copy in local/community
// --out defaults to local/board/, where the local work board reads them (board/README.md). Local data only: never commit the outputs.
const fs = require("fs"), path = require("path");
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const ROOT = path.join(__dirname, "..");
const STATS = arg("--stats", path.join(ROOT, "local", "difficulty", "user_stats_online.json"));
const LATEST = arg("--latest", path.join(ROOT, "local", "community", "latest_rated.json"));
const OUT = path.resolve(arg("--out", path.join(ROOT, "local", "board")));
fs.mkdirSync(OUT, { recursive: true });

const d = JSON.parse(fs.readFileSync(STATS, "utf8"));
// here: 1 when local/community/<id>.gdlvl exists, so the board links the level to the PC viewer (else to GDBrowser)
const COMMDIR = arg("--community", path.join(ROOT, "local", "community"));
const HERE = new Set(fs.existsSync(COMMDIR) ? fs.readdirSync(COMMDIR).map(f => (/^(\d+)\.gdlvl$/.exec(f) || [])[1]).filter(Boolean).map(Number) : []);
const cols = ["id", "name", "creator", "kind", "tier", "stars", "attempts", "jumps", "best", "practice", "done", "here"];
const L = d.levels.filter(l => (l.attempts || 0) > 0 || l.done);
const rows = L.map(l => cols.map(c => c === "done" ? (l.done ? 1 : 0) : c === "here" ? (l.kind !== "main" && HERE.has(+l.id) ? 1 : 0) : (l[c] === undefined ? null : l[c])));
const t = d.totals, nd = L.filter(l => l.done).length;
const note = `Every level you've played, from your save (read only, never changed): ${nd} finished and ${L.length - nd} not finished yet. ` +
  `Your save counts ${t.officialDone + t.onlineDone} finished and ${t.demons} demons in all; some finished ones have no per-level stats in the save, so they can't be listed. ` +
  `Tries: lifetime attempts (incl. replays). Best: normal-mode best %. Practice: practice best %.`;
// split in parts of PART rows (~40 KB each): board/played = the head + the first part, board/played_2.. the rest
// (a 170 KB document didn't load in Evgeni's app; small ones do)
const PART = +arg("--part", 600), parts = Math.max(1, Math.ceil(rows.length / PART));
for (const f of fs.readdirSync(OUT)) if (/^played(_\d+)?\.json$/.test(f)) fs.unlinkSync(path.join(OUT, f));
for (let k = 1; k <= parts; k++) {
  const chunk = rows.slice((k - 1) * PART, k * PART);
  const doc = k === 1 ? { at: d.at, cols, rows: chunk, totals: t, note, parts } : { part: k, rows: chunk };
  const txt = JSON.stringify(doc);
  fs.writeFileSync(path.join(OUT, k === 1 ? "played.json" : `played_${k}.json`), txt);
  console.log(k === 1 ? "played" : `played_${k}`, chunk.length, "rows,", Math.round(txt.length / 1024), "KB");
}
console.log("played:", L.length, "levels,", nd, "finished, in", parts, "parts");

if (fs.existsSync(LATEST)) {
  const ld = JSON.parse(fs.readFileSync(LATEST, "utf8")), ic = ld.cols.indexOf("id");
  ld.here = ld.rows.map(r => +r[ic]).filter(id => HERE.has(id));
  const lr = JSON.stringify(ld);
  fs.writeFileSync(path.join(OUT, "latest.json"), lr);
  console.log("latest:", JSON.parse(lr).rows.length, "levels,", Math.round(lr.length / 1024), "KB");
}
