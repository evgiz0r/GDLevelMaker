// node tools/lego_collect.js [--max N] [--tiers Easy,Normal,Hard] [--minutes M] [--dry]
// Keeps the lego catalogue growing from community levels (Evgeni 2026-11-25: "keep collecting structures [...] part of each
// level analysis"; "start with easier levels, demons when physics gets better"). From his save's catalogue
// (local/difficulty/user_stats_online.json, tools/save_stats.js), online levels that are NOT demons, the ones he beat first,
// easiest tier first: fetch (tools/fetch_level.js) -> solve at LOW heavy priority (tools/difficulty_solve.js c<id>, which cuts
// the route into bricks by itself: lego.mineLevel) -> next. One level at a time; each solve waits for the heavy-job slot like
// any other job, so the user's game and other sessions come first. A level already solved or tried is skipped
// (local/lego/collect.jsonl: one line per try, with how long it took and how it ended). --minutes M: give up a solve after M
// minutes (default 45; its checkpoint is kept, so a later run carries on). Never launches GD; other people's levels stay in local/.
"use strict";
const fs = require("fs"), path = require("path"), { spawnSync } = require("child_process");
const ROOT = path.join(__dirname, ".."), LOCAL = path.join(ROOT, "local");
const A = process.argv.slice(2), opt = (k, d) => { const i = A.indexOf("--" + k); return i >= 0 ? A[i + 1] : d; };
const TIERS = ["Auto", "Easy", "Normal", "Hard", "Harder", "Insane", "?"];
const want = (opt("tiers") || "Auto,Easy,Normal,Hard,Harder,Insane").split(",");
const LOG = path.join(LOCAL, "lego", "collect.jsonl");

function tried() {
  const s = new Set();
  try { for (const l of fs.readFileSync(LOG, "utf8").split("\n")) if (l.trim()) try { s.add(JSON.parse(l).id); } catch (e) {} } catch (e) {}
  return s;
}
function queue() {
  const cat = JSON.parse(fs.readFileSync(path.join(LOCAL, "difficulty", "user_stats_online.json"), "utf8"));
  const T = tried();
  return cat.levels.filter(l => l.kind === "online" && !l.demon && !String(l.tier).endsWith("Demon") && want.includes(l.tier) &&
      !T.has(l.id) && !fs.existsSync(path.join(LOCAL, "difficulty", "c" + l.id + ".json")))
    .sort((a, b) => (b.done - a.done) || (TIERS.indexOf(a.tier) - TIERS.indexOf(b.tier)) || ((b.attempts || 0) - (a.attempts || 0)));
}

if (require.main === module) {
  const Q = queue(), max = +opt("max", 10), mins = +opt("minutes", 45);
  console.log(`lego collect: ${Q.length} community levels to go (not demons, ${want.join("/")}); taking ${Math.min(max, Q.length)}`);
  for (const l of Q.slice(0, max)) console.log(`  ${l.id}  ${l.tier.padEnd(7)} ${l.done ? "beaten" : "played"}  ${l.name}`);
  if (A.includes("--dry")) process.exit(0);
  fs.mkdirSync(path.dirname(LOG), { recursive: true });
  for (const l of Q.slice(0, max)) {
    const t0 = Date.now(), file = path.join(LOCAL, "community", l.id + ".gdlvl"), row = { id: l.id, name: l.name, tier: l.tier, at: new Date().toISOString() };
    if (!fs.existsSync(file)) spawnSync(process.execPath, [path.join(__dirname, "fetch_level.js"), String(l.id)], { stdio: "inherit", windowsHide: true });
    if (!fs.existsSync(file)) { row.result = "fetch failed"; fs.appendFileSync(LOG, JSON.stringify(row) + "\n"); continue; }
    const r = spawnSync(process.execPath, [path.join(__dirname, "difficulty_solve.js"), "c" + l.id, "--no-traps"], { encoding: "utf8", windowsHide: true,
      timeout: mins * 60e3, env: { ...process.env, GDLM_HEAVY_PRIORITY: "low" } });
    const out = (r.stdout || "") + (r.stderr || ""), last = out.trim().split("\n").filter(s => /^c\d+:|lego:/.test(s));
    row.result = r.error && r.error.code === "ETIMEDOUT" ? `stopped after ${mins} min (checkpoint kept)` : last.join(" | ") || "exit " + r.status;
    row.min = Math.round((Date.now() - t0) / 6000) / 10;
    fs.appendFileSync(LOG, JSON.stringify(row) + "\n");
    console.log(`${l.id} ${l.name}: ${row.result} (${row.min} min)`);
  }
}
module.exports = { queue };
