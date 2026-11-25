// node tools/measures.js [latest] [level substring] [--all]   the newest value of every measure per level, STALE marked
// node tools/measures.js history <level> [measure]             every value ever recorded for one level, oldest first
// node tools/measures.js add '<json>' [...]                    record by hand (fields below; stamps filled in for you)
// node tools/measures.js stale                                 only what is stale now, with why and the command to redo it
//
// The measurements store (the user, 2026-11-24: "for every level we go through, save some data somewhere about
// measurements. With the version as it may change"). One JSON line per measurement in knowledge/measurements.jsonl,
// COMMITTED (git is the source of truth; numbers about RobTop's levels are ours to publish, their level data is not:
// never put level strings, objects or routes' events here -- those stay in local/).
//
// Line: { level, ver, measure, value, unit?, detail?, stamps: { <group>: <commit> }, tool, at, by?, note? }
//   level   "official:16" | "GDLM 44 hellgate" | "community:12345"
//   ver     the level's version: sha1 (10 hex) of its level string, or a wip version ("v3"), or "?" when unknown
//   measure "solved" (value true/false, detail {pct, dieBlock, route}) | "difficulty" (log10 attempts, detail
//           {perMin, inputs, tight, minMs, cover}) | "taste" (0-100, detail {band}) | anything else a tool measures
//   stamps  a commit per code group the value depends on, when it was measured (GROUPS below). A value is STALE
//           when a file of any of its groups changed since that commit (git diff), or a newer version was measured.
// Tools record with require("./measures.js").record({...}) -- difficulty_solve.js, difficulty.js and taste.js do.
// The file is appended by many sessions: .gitattributes gives it merge=union, so two appends never conflict.
const fs = require("fs"), path = require("path"), cp = require("child_process"), crypto = require("crypto");
const ROOT = path.join(__dirname, "..");
const FILE = process.env.GDLM_MEASURES_FILE || path.join(ROOT, "knowledge", "measurements.jsonl");   // env: tests only

// what each kind of measure depends on (paths for `git log -1 -- <paths>`)
const GROUPS = {
  physics: ["lib/physics.js", "lib/dual.js", "lib/objects.js", "lib/objects_extra.js"],
  route: ["lib/natural.js"],
  difficulty: ["lib/difficulty.js", "lib/windows.js"],
  taste: ["knowledge/taste_model.json"],   // the learned model; a change to the features in tools/taste.js shows in it at the next learn
};
const DEPENDS = { solved: ["physics", "route"], difficulty: ["physics", "route", "difficulty"], taste: ["taste"] };

const commitCache = {};
function commitOf(group) {
  if (group in commitCache) return commitCache[group];
  let c = null;
  try { c = cp.execFileSync("git", ["log", "-1", "--format=%h", "--", ...GROUPS[group]], { cwd: ROOT, windowsHide: true, encoding: "utf8" }).trim() || null; } catch (e) { }
  return (commitCache[group] = c);
}
const stampsFor = measure => Object.fromEntries((DEPENDS[measure] || []).map(g => [g, commitOf(g)]));
const verOf = levelStr => crypto.createHash("sha1").update(String(levelStr)).digest("hex").slice(0, 10);

function read() {
  if (!fs.existsSync(FILE)) return [];
  return fs.readFileSync(FILE, "utf8").split("\n").filter(l => l.trim()).map((l, i) => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean);
}
// record one measurement; stamps default to today's commits of the measure's groups. Never throws (a tool's real
// work must not fail on bookkeeping).
function record(m) {
  try {
    const o = Object.assign({ ver: "?", at: new Date().toISOString() }, m);
    o.stamps = Object.assign(stampsFor(o.measure), m.stamps || {});
    if (o.levelStr) { o.ver = verOf(o.levelStr); delete o.levelStr; }
    if (!o.level || !o.measure) throw new Error("level and measure are required");
    fs.appendFileSync(FILE, JSON.stringify(o) + "\n");
    return o;
  } catch (e) { console.error("measures: not recorded: " + e.message); return null; }
}
// why a record is stale now ([] = current); `newer` = a later version of the same level has this measure.
// A group is stale when any of its files differs between the stamped commit and HEAD (git diff, so merge commits
// and stamps written by other tools -- difficulty_solve's physicsCommit -- compare the same way).
const changedCache = {};
function changedSince(c, g) {
  const k = c + " " + g; if (k in changedCache) return changedCache[k];
  let r;
  try { cp.execFileSync("git", ["diff", "--quiet", c, "HEAD", "--", ...GROUPS[g]], { cwd: ROOT, windowsHide: true, stdio: "ignore" }); r = false; }
  catch (e) { r = e.status === 1 ? true : null; }   // 1 = differs; anything else = the commit is unknown here
  return (changedCache[k] = r);
}
function staleWhy(r, newestVer) {
  const why = [];
  for (const [g, c] of Object.entries(r.stamps || {})) {
    if (!GROUPS[g]) continue;
    const ch = c ? changedSince(c, g) : null;
    if (ch === null) why.push(`${g}: stamp ${c || "missing"} unknown here`); else if (ch) why.push(`${g} changed since ${c}`);
  }
  if (newestVer && r.ver !== "?" && newestVer !== r.ver) why.push(`level changed (${r.ver} -> ${newestVer})`);
  return why;
}
// the newest record per level x measure
function latest(rows) {
  const by = new Map(), verNow = new Map();
  for (const r of rows) {
    by.set(r.level + "\u0000" + r.measure, r);
    if (r.ver && r.ver !== "?") verNow.set(r.level, r.ver);
  }
  return [...by.values()].map(r => Object.assign({}, r, { stale: staleWhy(r, verNow.get(r.level)) }));
}
const redo = r => {
  const n = /^official:(\d+)$/.exec(r.level);
  if (r.measure === "solved") return n ? `node tools/difficulty_solve.js ${n[1]} --resume` : `node tools/solutions.js <file>`;
  if (r.measure === "difficulty") return n ? `node tools/difficulty.js ${n[1]}` : `node tools/difficulty.js <file>`;
  if (r.measure === "taste") return `node tools/taste.js score ${n ? r.level : "<file>"}`;
  return "";
};
const show = v => v === true ? "yes" : v === false ? "no" : v == null ? "-" : typeof v === "number" ? String(+v.toFixed(2)) : String(v);

module.exports = { record, read, latest, staleWhy, stampsFor, commitOf, verOf, GROUPS, DEPENDS, FILE };

if (require.main === module) {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === "add") {
    for (const r of rest) { const o = record(JSON.parse(r)); if (o) console.log(`recorded ${o.level} ${o.measure} = ${show(o.value)}`); }
  } else if (cmd === "history") {
    for (const r of read().filter(r => r.level.includes(rest[0] || "") && (!rest[1] || r.measure === rest[1])))
      console.log(`${r.at.slice(0, 16)}  ${r.level}  ${r.measure} = ${show(r.value)}  ver ${r.ver}  ${Object.entries(r.stamps || {}).map(([g, c]) => g + " " + c).join(", ")}${r.note ? "  -- " + r.note : ""}`);
  } else {
    const want = cmd && cmd !== "latest" && cmd !== "stale" ? cmd : rest.find(a => !a.startsWith("--")) || "";
    const all = latest(read()), exact = all.some(r => r.level === want);
    let rows = all.filter(r => exact ? r.level === want : r.level.includes(want));
    if (cmd === "stale") rows = rows.filter(r => r.stale.length);
    const levels = [...new Set(rows.map(r => r.level))];
    const measures = [...new Set(rows.map(r => r.measure))];
    if (cmd === "stale") {
      for (const r of rows) console.log(`${r.level.padEnd(14)} ${r.measure.padEnd(10)} ${show(r.value).padEnd(6)} STALE (${r.stale.join("; ")})  redo: ${redo(r)}`);
      console.log(`${rows.length} stale`);
    } else {
      console.log("level".padEnd(24) + measures.map(m => m.slice(0, 19).padEnd(20)).join(""));
      for (const lv of levels) {
        const cells = measures.map(m => { const r = rows.find(r => r.level === lv && r.measure === m); if (!r) return "".padEnd(20);
          return (show(r.value) + (r.stale.length ? " STALE" : "")).padEnd(20); });
        const name = (rows.find(r => r.level === lv && r.name) || {}).name;
        console.log((lv + (name ? " " + name : "")).slice(0, 23).padEnd(24) + cells.join(""));
      }
      console.log(`STALE = measured on older code or an older version of the level (node tools/measures.js stale: why, and how to redo it)`);
    }
  }
}
