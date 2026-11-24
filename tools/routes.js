// node tools/routes.js status [--official | --gdlm]   -- every saved route at a glance (no solving: saved files
// and one replay each, seconds). For the 22 official levels (local/official_NN.json, the viewer's route, and
// local/difficulty/NN.json, the raw solve) and every GDLM level (levels/*.gdlvl, local/wip/*/*.gdlvl, the
// tools/solutions.js cache):
//   level | sim (beaten / died at %) | kind (human / limit / unbeaten / humanize = old / none) | made by (full solve,
//   resume, incsolve, re-plan, old humanize) | plan stamp, and whether it predates today's route rules (short taps
//   370a20a, holds-to-taps 892974e, planned presses ecb883d) | skips (GD.skipCheck on a replay) | queued (a
//   difficulty_solve / solutions / saved_routes process for it is running or waiting)
// PHYSICS.md "How the route is chosen".
const fs = require("fs"), path = require("path"), { execSync } = require("child_process");
const { GD, readGdlvl } = require("./io.js");
const ROOT = path.join(__dirname, ".."), sols = require("./solutions.js");
const a = process.argv.slice(2);
if (a[0] !== "status") { console.log(fs.readFileSync(__filename, "utf8").split("\n").slice(0, 2).join("\n")); process.exit(1); }
const RULES = [["370a20a", "taps"], ["892974e", "holds"], ["ecb883d", "planned"]];
const has = (commit, rule) => { if (!commit) return false; try { execSync(`git merge-base --is-ancestor ${rule} ${commit}`, { cwd: ROOT, stdio: "ignore" }); return true; } catch (e) { return false; } };
const missing = c => c ? RULES.filter(([r]) => !has(c, r)).map(([, n]) => n) : ["(no stamp)"];
let procs = "";
try { procs = execSync(`powershell -NoProfile -c "Get-CimInstance Win32_Process -Filter \\"name='node.exe'\\" | ForEach-Object { $_.CommandLine }"`, { encoding: "utf8" }); } catch (e) {}
const queued = re => procs.split("\n").some(l => re.test(l));
const pad = (s, n) => String(s).slice(0, n).padEnd(n);
const row = r => console.log([pad(r.level, 30), pad(r.sim, 16), pad(r.kind, 9), pad(r.by, 13), pad(r.plan, 9), pad(r.old, 18), pad(r.skips, 26), r.queued ? "queued" : ""].join(" "));
const head = () => row({ level: "level", sim: "sim", kind: "kind", by: "made by", plan: "plan", old: "predates rules", skips: "skips", queued: false });
const skipOf = (w, ev) => { try { const q = GD.run(w, ev); const s = GD.skipCheck(w, q.path, ev); return { sk: s ? s.skipped : "-", done: q.done || (!q.dead && q.end.x >= w.endX), pct: Math.min(100, q.end.x / w.endX * 100) }; } catch (e) { return { sk: "?", done: false, pct: 0 }; } };

if (!a.includes("--gdlm")) {
  console.log("== official levels (viewer route: local/official_NN.json; raw solve: local/difficulty/NN.json)"); head();
  for (let n = 1; n <= 22; n++) {
    const tag = String(n).padStart(2, "0");
    let v = null, d = null; try { v = JSON.parse(fs.readFileSync(path.join(ROOT, "local", `official_${tag}.json`), "utf8")); } catch (e) {}
    try { d = JSON.parse(fs.readFileSync(path.join(ROOT, "local", "difficulty", `${tag}.json`), "utf8")); } catch (e) {}
    if (!v) { row({ level: `${n} (no route)`, sim: "-", kind: "none", by: "-", plan: "-", old: "-", skips: "-", queued: queued(new RegExp(`difficulty_solve\\.js[^\\n]*\\b${n}\\b`)) }); continue; }
    const L = GD.parseLevel(v.level), w = GD.makeWorld(L.objects, L.header), sk = skipOf(w, v.solution.events);
    const kind = v.solution.kind === "human" ? (v.solution.ok ? "human" : "unbeaten") : v.solution.kind === "humanize" ? "limit" : "humanize";
    const by = v.solution.kind ? (d && d.resumedFrom != null ? "resume" : "re-plan/solve") : "old humanize";
    row({ level: `${n} ${v.name || ""}`, sim: v.solution.ok ? (sk.done ? "beaten" : `replay ${sk.pct.toFixed(0)}%`) : `died ${(d && d.dieX ? d.dieX / d.endX * 100 : 0).toFixed(1)}%`,
      kind, by, plan: (v.physics || "-"), old: v.solution.kind ? "" : "all (humanize)", skips: sk.sk, queued: queued(new RegExp(`difficulty_solve\\.js[^\\n]*(all[^\\n]*\\b${n}\\b|\\s${n}\\s--)`)) });
  }
}
if (!a.includes("--official")) {
  console.log("== GDLM levels (route: tools/solutions.js cache, local/solutions/)"); head();
  const files = [];
  for (const d of ["levels"].concat(fs.existsSync(path.join(ROOT, "local", "wip")) ? fs.readdirSync(path.join(ROOT, "local", "wip")).map(s => "local/wip/" + s) : []))
    if (fs.existsSync(path.join(ROOT, d))) for (const f of fs.readdirSync(path.join(ROOT, d)).filter(f => /^gdlm_.*\.gdlvl$/.test(f)).sort()) files.push(path.join(d, f));
  for (const f of files) {
    const L = readGdlvl(path.join(ROOT, f)), s = sols.get(L.levelStr, true), w = GD.makeWorld(L.level.objects, L.level.header);
    const label = (f.startsWith("local") ? f.split(/[\/]/)[2] + ":" : "") + L.name.replace(/^GDLM /, "");
    if (!s) { row({ level: label, sim: "-", kind: "none", by: "-", plan: "-", old: "-", skips: "-", queued: queued(/saved_routes|solutions\.js/) }); continue; }
    const sk = s.ok ? skipOf(w, s.events) : { sk: "-", done: false };
    row({ level: label, sim: s.ok ? (sk.done ? "beaten" : "replay dies") : `stuck ${s.dieX ? (s.dieX / w.endX * 100).toFixed(1) + "%" : ""}`,
      kind: s.kind || (s.ok ? "(unlabelled)" : "unbeaten"), by: s.inc ? "incsolve" : s.hitroute ? "hitroute" : s.plan ? "solve+plan" : "old",
      plan: s.plan || "-", old: missing(s.plan).join(","), skips: sk.sk, queued: queued(/saved_routes\.js --all --fix/) });
  }
}
