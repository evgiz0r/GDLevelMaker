// node tools/real_stats.js add '<json>' [...]  |  node tools/real_stats.js [list] [level substring]
// The user's real-game attempts on our levels, one JSON line each, in local/real_stats.jsonl (shared,
// never committed). Written by whoever analyses a recording (the physics session owns recordings);
// read by difficulty (predicted vs real deaths), style (layout fixes), polish, knowledge.
// Fields: level ("GDLM 44 hellgate"), version (wip version or null), video, t (s in the video),
// attempt (n in that video), result ("death" | "beaten"), pct (GD's %), x (units, if measured),
// mode, cause (short words), sim ("agrees" | "mismatch: ..." | "unchecked"), forced (true when the
// input was forced right after a mode change), window_ms (the human window there, if measured).
// Rule (CLAUDE.md "Shared folder"): after every analysis, add the attempts here AND send each level's
// stats straight to every owner it concerns.
const fs = require("fs"), path = require("path");
const FILE = path.join(__dirname, "..", "local", "real_stats.jsonl");
const [cmd, ...rest] = process.argv.slice(2);
if (cmd === "add") {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  for (const r of rest) { const o = JSON.parse(r); o.added = o.added || new Date().toISOString(); fs.appendFileSync(FILE, JSON.stringify(o) + "\n"); }
  console.log(`added ${rest.length} to ${FILE}`);
} else {
  const want = cmd === "list" ? rest[0] : cmd;
  const rows = fs.existsSync(FILE) ? fs.readFileSync(FILE, "utf8").split("\n").filter(Boolean).map(l => JSON.parse(l)) : [];
  const by = {};
  for (const r of rows) if (!want || r.level.toLowerCase().includes(want.toLowerCase())) (by[r.level + (r.version ? " v" + r.version : "")] ||= []).push(r);
  for (const [k, list] of Object.entries(by)) {
    const best = Math.max(...list.map(r => r.result === "beaten" ? 100 : r.pct || 0));
    console.log(`${k}: ${list.length} attempts, best ${best}%`);
    for (const r of list) console.log(`  ${r.result === "beaten" ? "BEATEN" : (r.pct ?? "?") + "%"}${r.x ? " x " + r.x : ""} ${r.mode || ""} ${r.cause || ""}${r.forced ? " [forced after mode change]" : ""}${r.window_ms ? " window " + r.window_ms + " ms" : ""} -- sim ${r.sim || "unchecked"} (${r.video || ""} ${r.t ?? ""})`);
  }
}
