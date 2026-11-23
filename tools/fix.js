// node tools/fix.js <level> [--top N] ["request in words"] [--at <spot>] [--no-fair] [--no-shots] [--dry] [--session s]
//
// FIX ANY LEVEL (USE_CASES 2, EDITING.md "Fix"): review -> apply the top fixes on a COPY -> review again ->
// before/after. Works on our levels, official ones (local only: never installed, never published) and community
// ones (local/community/<id>.gdlvl) -- anything tools/edit.js loads.
//   request   optional words. With --at, an edit (tools/edit.js vocabulary: "remove these spikes") applied first.
//             Without, it narrows the fixes: family words ("the arrows", "flashy", "awkward jumps") or an effect
//             ("fairer" / "fair" -> fairness, "readable" -> readability, "look" / "pretty" -> look).
//   --top N   at most N fixes (default 5), taken from tools/review.js's ranked list, auto-fixable ones only
//             (tools/families.js "auto": small, safe edits -- a jump mark moved clear of a spike, an orb centred
//             over its row, a doubled spike removed, a 1-block landing widened, spikes nobody jumps removed,
//             a title moved off the attempt counter)
// Each fix is kept only if the level is still beaten, its issue is gone and the checks do not get worse
// (tools/edit.js quickChecks); otherwise it is rolled back and listed. Writes local/edits/<slug>.fix<N>.gdlvl,
// its .json report and a before/after picture at the first fix. The rest of the list (redesigns, look passes) is
// printed with its suggested fix. Heavy (solves, fairness): the one-heavy-job slot.
if (require.main === module && !process.argv.includes("--dry")) require("./heavy.js").claim();   // one heavy job at a time (tools/heavy.js)
"use strict";
const fs = require("fs"), path = require("path");
const { GD, readGdlvl } = require("./io.js");
const E = require("./edit.js"), FAM = require("./families.js"), RV = require("./review.js");
const ROOT = path.join(__dirname, ".."), OUT = path.join(ROOT, "local", "edits");
const rel = f => path.relative(ROOT, f).replace(/\\/g, "/");
const slug = s => String(s || "level").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
const EFFECT_WORDS = { fairness: /\bfair/, readability: /readab|clear|see what/, flow: /flow|awkward|natural/, boredom: /boring|bland/, look: /\blook|pretty|deco|visual/ };

function wanted(words) {
  const s = String(words || "").toLowerCase(); if (!s.trim()) return null;
  const fams = new Set(FAM.classify(s).map(f => f.id)), effects = new Set(Object.keys(EFFECT_WORDS).filter(k => EFFECT_WORDS[k].test(s)));
  return fams.size || effects.size ? i => fams.has(i.family) || effects.has(i.effect) : null;
}
const issueKey = q => q.rule + "|" + String(q.text).replace(/[\d.]+ ms/g, "").replace(/\d+%/g, "");

function fix(spec, o = {}) {
  const before = RV.review(spec, { noFair: o.noFair || o.dry });
  const L = E.loadLevel(before.meta.file);   // the review's file: the level itself, or its local copy
  const rep = { level: before.meta.level, src: before.meta.src, before: before.meta.counts, kept: [], rejected: [], request: o.words || null };
  // a request with a spot: an edit first
  let cur = { level: L.level, levelStr: L.levelStr, sol: E.routeOf(L) && E.routeOf(L).sol }, n = 1;
  fs.mkdirSync(OUT, { recursive: true });
  while (fs.existsSync(path.join(OUT, `${slug(L.name)}.fix${n}.gdlvl`))) n++;
  const out = o.out || path.join(OUT, `${slug(L.name)}.fix${n}.gdlvl`), tmp = out.replace(/\.gdlvl$/, ".try.gdlvl");
  let firstX = null;
  const tryOps = (ops, spot, label, issue) => {
    let res; try { res = E.apply(cur.level, ops, spot); } catch (e) { rep.rejected.push({ fix: label, why: e.message }); return false; }
    if (o.dry) { rep.kept.push({ fix: label, ops, changes: res.changes.map(c => c.what), dry: true }); return true; }
    const A = E.writeCopy(tmp, L, res.objects), rs = E.resolve(A.level, A.levelStr, cur.sol, { x: spot.x });
    const run = rs.sol && rs.sol.events ? GD.run(GD.makeWorld(A.level.objects, A.level.header), rs.sol.events) : null;
    if (!(rs.sol && rs.sol.ok && run && !run.dead)) { rep.rejected.push({ fix: label, why: "the level is no longer beaten" + (run ? ` (dies at block ${(run.end.x / 30).toFixed(1)})` : "") }); return false; }
    const qa = E.quickChecks(tmp, { fast: true }).filter(q => !q.info), qb = cur.checks || [];
    if (issue && qa.some(q => issueKey(q) === issueKey(issue))) { rep.rejected.push({ fix: label, why: "the issue is still there after the edit" }); return false; }
    if (qa.length > qb.length) { const sb = new Set(qb.map(issueKey)); rep.rejected.push({ fix: label, why: "new issues: " + qa.filter(q => !sb.has(issueKey(q))).map(q => q.rule + " " + q.text).join("; ") }); return false; }
    cur = { level: A.level, levelStr: A.levelStr, sol: rs.sol, checks: qa };
    rep.kept.push({ fix: label, ops, changes: res.changes.map(c => c.what), solve: rs.how });
    if (firstX == null) firstX = spot.x;
    return true;
  };
  if (!o.dry) { const B0 = E.writeCopy(tmp, L, L.level.objects); cur.checks = E.quickChecks(tmp, { fast: true }).filter(q => !q.info); }
  const route0 = E.routeOf(L);
  if (o.words && o.at) {
    const spot = E.parseSpot(o.at, L, route0), ops = E.parse(o.words, spot);
    if (ops.error) rep.rejected.push({ fix: o.words, why: ops.error }); else tryOps(ops, spot, `request: ${o.words}`, null);
  }
  const only = o.at ? null : wanted(o.words);
  const cand = before.issues.filter(i => i.auto && (!only || only(i))).slice(0, o.top || 5);
  for (const i of cand) {
    const f = FAM.of(i.rule), ops = f.auto(i), x = i.block != null ? i.block * 30 + 15 : 0;
    tryOps(ops, { x, col: Math.floor(i.block || 0), block: +(x / 30).toFixed(1), y: null, playerY: null }, `${i.family} at block ${i.block}: ${i.text}`, i);
  }
  rep.left = before.issues.filter(i => !i.auto && (!only || only(i))).slice(0, 10).map(i => ({ family: i.family, block: i.block, effort: i.effort, text: i.text, fix: i.fix }));
  if (o.dry) return rep;
  try { fs.unlinkSync(tmp); } catch (e) {}
  if (!rep.kept.length) { rep.file = null; return rep; }
  const A = E.writeCopy(out, L, cur.level.objects);
  if (cur.sol && !require("./solutions.js").get(A.levelStr, true)) require("./solutions.js").put(A.levelStr, cur.sol, A.level);
  rep.file = rel(out);
  const after = RV.review(out, { noFair: o.noFair });
  rep.after = after.meta.counts;
  const d = E.diff(L.level.objects, A.level.objects); rep.objects = { added: d.added.length, removed: d.removed.length };
  if (!o.noShots && firstX != null) {
    const route = E.routeOf(Object.assign({}, L, { solution: null })), i = route ? route.path.findIndex(p => p.x >= firstX) : -1;
    rep.picture = E.shots(L.file, out, Math.max(0, (i < 0 ? firstX / 311.6 : i / GD.PHYS.TPS) - 0.6), out.replace(/\.gdlvl$/, "_before_after.png"));
  }
  if (o.session) { const r = require("child_process").spawnSync(process.execPath, [path.join(__dirname, "wip.js"), "put", out, "--session", o.session, "--note", `fix.js: ${rep.kept.length} fixes`], { encoding: "utf8" }); rep.wip = (r.stdout || "").trim().split("\n").pop(); }
  fs.writeFileSync(out.replace(/\.gdlvl$/, ".json"), JSON.stringify(rep, null, 1));
  return rep;
}

function print(r) {
  console.log(`== fix: ${r.level}${r.request ? ` ("${r.request}")` : ""}`);
  console.log(`   before: ${r.before.issues} issues (${r.before.fail} FAIL)` + (r.after ? `  ->  after: ${r.after.issues} issues (${r.after.fail} FAIL)` : ""));
  for (const k of r.kept) console.log(`   KEPT     ${k.fix}\n            ${k.changes.join("; ")}${k.solve ? "  [" + k.solve + "]" : ""}`);
  for (const k of r.rejected) console.log(`   ROLLED BACK ${k.fix}\n            ${k.why}`);
  if (r.file) console.log(`   copy: ${r.file}  (the original is untouched; objects +${r.objects.added} -${r.objects.removed})`);
  else if (!r.kept.some(k => k.dry)) console.log("   no fix kept: nothing written");
  if (r.picture) console.log(`   picture: ${r.picture.png ? rel(r.picture.png) : "failed: " + r.picture.error}`);
  if (r.left.length) { console.log("   left for a session (not automatic):"); for (const i of r.left) console.log(`     ${i.effort.padEnd(8)} ${i.block != null ? "block " + i.block : "level"}  ${i.family}: ${i.text}\n              -> ${i.fix}`); }
}

module.exports = { fix };

if (require.main === module) {
  const a = process.argv.slice(2), opt = k => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : undefined; };
  const takes = new Set(["--top", "--at", "--session", "--out"]);
  const free = a.filter((x, i) => !x.startsWith("--") && !takes.has(a[i - 1]));
  if (!free.length) { console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n")); process.exit(1); }
  const r = fix(free[0], { words: free.slice(1).join(" ") || null, at: opt("--at"), top: opt("--top") ? +opt("--top") : 5, noFair: a.includes("--no-fair"), noShots: a.includes("--no-shots"), dry: a.includes("--dry"), session: opt("--session"), out: opt("--out") });
  if (a.includes("--json")) console.log(JSON.stringify(r, null, 1)); else print(r);
}
