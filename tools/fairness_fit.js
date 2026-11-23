// node tools/fairness.js fit   -- checks tools/fairness.js against the user's labelled deaths.
// Levels: the versions the user played (git history / local/wip), deaths: local/real_stats.jsonl.
// A death counts as predicted when a flag sits at most LEAD units before it (the cause comes first).
// Rows labelled by the physics session (`fair`), plus GDLM 44 v5's deaths that the physics session
// called forced / a 75 ms zigzag (no `fair` field then; counted as unfair, marked "inferred").
// Also lists flags with no death after them in attempts that got past them (false alarms).
const fs = require("fs"), path = require("path"), { execSync } = require("child_process");
const F = require("./fairness.js");
const ROOT = path.join(__dirname, ".."), CACHE = path.join(ROOT, "local", "difficulty", "fairness");
const PLAYED = [ // level name in real_stats, version, where the played file comes from
  { level: "GDLM 44 hellgate", version: 5, git: "c9b7f88^:levels/gdlm_44_hellgate.gdlvl" },
  { level: "GDLM 46 sketch", version: 2, file: "local/wip/main/gdlm_46_sketch.gdlvl" },
];
const rows = fs.readFileSync(path.join(ROOT, "local", "real_stats.jsonl"), "utf8").trim().split("\n").map(JSON.parse);
fs.mkdirSync(CACHE, { recursive: true });
const thArg = process.argv.slice(3).reduce((o, a) => { const [k, v] = a.split("="); if (v !== undefined) o[k] = +v; return o; }, {});
let caught = 0, unfairN = 0, fairOk = 0, fairN = 0, border = 0, borderN = 0;
for (const lv of PLAYED) {
  const phys = require("./difficulty_solve.js").physicsCommit() || "nophys";
  const cf = path.join(CACHE, `${lv.level.replace(/\W+/g, "_")}_v${lv.version}_${phys}.json`); // stale after a physics change
  let A;
  if (fs.existsSync(cf)) A = JSON.parse(fs.readFileSync(cf, "utf8"));
  else {
    let file = lv.file && path.join(ROOT, lv.file);
    if (lv.git) { file = path.join(CACHE, path.basename(cf, ".json") + ".gdlvl"); fs.writeFileSync(file, execSync(`git show ${lv.git}`, { cwd: ROOT })); }
    A = F.analyseFile(file); fs.writeFileSync(cf, JSON.stringify(A));
  }
  const fl = F.flags(A, thArg);
  const deaths = rows.filter(r => r.level === lv.level && (r.version || null) === lv.version && r.result === "death" && r.x);
  console.log(`== ${lv.level} v${lv.version}: ${deaths.length} placed deaths, ${fl.length} flags`);
  for (const x of fl) console.log(`   flag ${x.severity} ${x.family.padEnd(6)} x ${Math.round(x.x0)}-${Math.round(x.x1)}: ${x.note}`);
  for (const r of deaths) {
    const label = r.fair ? (/^unfair/.test(r.fair) ? "unfair" : /^borderline/.test(r.fair) ? "borderline" : "fair") : (r.forced || /zigzag/.test(r.cause) ? "unfair" : null);
    if (!label) continue;
    const by = fl.filter(f => F.explains(f, r.x));
    const hit = by.length > 0;
    if (label === "unfair") { unfairN++; if (hit) caught++; }
    if (label === "fair") { fairN++; if (!hit) fairOk++; }
    if (label === "borderline") { borderN++; if (hit) border++; }
    const good = label === "fair" ? !hit : hit;
    console.log(`   ${good ? "ok  " : "MISS"} death x ${r.x} ${label}${r.fair ? "" : " (inferred)"}: ${by.map(f => f.family).join(", ") || "no flag"}  -- ${r.cause.slice(0, 70)}`);
  }
  // false alarms: flags no death came after, though the level was passed beyond them
  const best = Math.max(...rows.filter(r => r.level === lv.level && (r.version || null) === lv.version).map(r => r.result === "beaten" ? 1e9 : r.x || 0));
  for (const f of fl) if (!deaths.some(r => F.explains(f, r.x)) && f.x1 + F.LEAD < best)
    console.log(`   false alarm? ${f.family} at ${Math.round(f.x0)}: no death after it, though runs got past it`);
}
console.log(`\nunfair deaths flagged ${caught}/${unfairN}, borderline flagged ${border}/${borderN}, fair deaths not flagged ${fairOk}/${fairN}`);
