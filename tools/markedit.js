// node tools/markedit.js list [level part]                    -- open marks, each with its family and how it reads
// node tools/markedit.js <mark id> [--do '<ops>'] [--words "..."] [--dry] [--no-shots] [--no-sweep] [--done] [--session s]
// node tools/markedit.js --level <lvl> --at <spot> --note "<what the user said>" [same options]
//                                                             -- an annotated screenshot: the spot from the viewer's
//                                                                header (t s / block N) or its #lv= link
// node tools/markedit.js --new-family <id> --words "kw1|kw2" --line "<checklist line>" [--effect flow] [--effort local]
//
// EDIT BY MARK OR PICTURE (USE_CASES 17, EDITING.md). A user's mark (the viewer's ✎: local/marks.jsonl, phone marks
// in local/phone/marks/) or a note on a screenshot becomes:
//   1. the spot: the mark's x/y (or --at), the level: the mark's file (a copy is edited, never the file itself)
//   2. its FAMILY (tools/families.js: the note's words) -- every note is a soft rule (CLAUDE.md)
//   3. the change: the note read as edit words (tools/edit.js vocabulary); else --words / --do from the session;
//      else the family's own fix for the issue the checks find at that spot (e.g. a mark too close to a spike)
//   4. tools/edit.js on a copy: re-solved, checks before/after, a before/after picture
//   5. the sweep: the family's check over every levels/gdlm_*.gdlvl -- "the rule, and how many other spots it found"
//   6. --done closes the mark (tools/marks.js done) with what changed and the sweep count
// A note no family covers: say so, and record it with --new-family (knowledge/families.json + a checklist line
// under "From the user's marks"); its scored check is then the session's to write (rules.js / softrules.js).
// Heavy (edit.js may solve; the sweep reads every level's route): takes the one-heavy-job slot.
if (require.main === module && !process.argv.includes("list") && !process.argv.includes("--new-family") && !process.argv.includes("--dry")) require("./heavy.js").claim();
"use strict";
const fs = require("fs"), path = require("path");
const E = require("./edit.js"), FAM = require("./families.js");
const ROOT = path.join(__dirname, ".."), MARKS = path.join(ROOT, "local", "marks.jsonl"), PHONE = path.join(ROOT, "local", "phone", "marks");

function marks() {
  const lines = fs.existsSync(MARKS) ? fs.readFileSync(MARKS, "utf8").split("\n").filter(Boolean).map(l => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean) : [];
  if (fs.existsSync(PHONE)) for (const f of fs.readdirSync(PHONE).filter(f => f.endsWith(".json"))) {
    try { const j = JSON.parse(fs.readFileSync(path.join(PHONE, f), "utf8")), m = j && (j.data && typeof j.data === "object" ? j.data : j); if (m && m.id) lines.unshift(Object.assign({ from: "phone" }, m)); } catch (e) {}
  }
  const by = new Map(); for (const m of lines) by.set(m.id, Object.assign(by.get(m.id) || {}, m));
  return [...by.values()].filter(m => m.note != null);
}
function levelFileOf(m) {
  for (const f of [m.file, m.file && path.join(ROOT, m.file)]) if (f && fs.existsSync(f)) return f;
  const want = String(m.level || "").toLowerCase();
  for (const d of ["levels", path.join("local", "wip", m.session || "_")]) {
    const dir = path.join(ROOT, d); if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter(f => f.endsWith(".gdlvl"))) try { if (E.loadLevel(path.join(dir, f)).name.toLowerCase() === want) return path.join(dir, f); } catch (e) {}
  }
  throw new Error(`can't find the level of mark ${m.id} (${m.level}, ${m.file})`);
}
// the note without what is not an instruction ("this", "here", "pls", "i think")
const clean = s => String(s || "").toLowerCase().replace(/\b(please|pls|plz|i think|maybe|imo|just|here|bit|a bit|kinda)\b/g, " ").replace(/[,!?]+/g, " ").replace(/\s+/g, " ").trim();

// issues of these families within `blocks` of the spot (the checks as tools/edit.js runs them)
function issuesNear(file, fams, spot, blocks = 3) {
  const rules = new Set(fams.flatMap(f => f.rules)), col = (spot.x - 15) / 30;
  return E.quickChecks(file, { fast: true }).filter(q => !q.info && rules.has(q.rule) && q.block != null && Math.abs(q.block - col) <= blocks);
}
// the family's check over every GDLM level: how many spots, in how many levels
function sweep(fams) {
  const rules = new Set(fams.flatMap(f => f.rules)), dir = path.join(ROOT, "levels"), per = [];
  for (const f of fs.readdirSync(dir).filter(f => /^gdlm_\d+.*\.gdlvl$/.test(f))) {
    try { const n = E.quickChecks(path.join(dir, f), { fast: true }).filter(q => !q.info && rules.has(q.rule)).length; if (n) per.push({ level: f, n }); } catch (e) {}
  }
  return { spots: per.reduce((a, b) => a + b.n, 0), levels: per };
}

function run(o) {
  const out = { mark: o.mark ? o.mark.id : null, note: o.note };
  const fams = FAM.classify(o.note);
  out.families = fams.map(f => f.id);
  const L = E.loadLevel(o.level), route = E.routeOf(L), spot = E.parseSpot(o.at, L, route);
  out.level = L.name; out.spot = spot;
  // the change: the session's words or ops first, then the note itself, then the family's fix at that spot
  let ops = null, how;
  if (o.ops) { ops = o.ops; how = "ops from the session (--do)"; }
  else if (o.words) { const p = E.parse(o.words, spot); if (p.error) return Object.assign(out, { ok: false, error: p.error }); ops = p; how = `the session's words: "${o.words}"`; }
  else {
    const p = E.parse(clean(o.note), spot);
    if (!p.error && p.length) { ops = p; how = "the note read as an edit"; }
    else if (fams.length && L.file) {
      const near = issuesNear(L.file, fams, spot);
      out.found = near.map(q => `${q.rule}: ${q.text}`);
      for (const q of near) { const f = FAM.of(q.rule), a = f && f.auto && f.auto(q); if (a) { ops = a; how = `the ${f.id} family's fix for "${q.text}"`; break; } }
    }
  }
  out.how = how || null;
  if (!ops) {
    out.ok = false;
    out.error = (fams.length ? `family ${fams.map(f => f.id).join(", ")}: no automatic fix at this spot` : "no family matches this note") + ` -- read the picture below and pass --words "<change>" or --do '<ops>'`;
    out.picture = E.textPicture(L.level.objects, spot, route);
  } else {
    const rep = E.edit({ level: o.level, at: o.at, ops, noShots: o.noShots, dry: o.dry, session: o.session, words: o.words || o.note });
    out.edit = rep; out.ok = rep.ok && (o.dry || rep.beaten);
  }
  if (!o.noSweep && fams.length) out.sweep = sweep(fams);
  if (o.done && out.ok && o.mark && !o.dry) {
    const fx = out.edit, reply = `${fx.changes.map(c => c.what).join("; ")} -> ${fx.file}` + (fams.length ? `; family ${fams[0].id}` : "") + (out.sweep ? `, ${out.sweep.spots} other spot(s) in ${out.sweep.levels.length} level(s)` : "");
    fs.appendFileSync(MARKS, JSON.stringify({ id: o.mark.id, done: true, reply, at: new Date().toISOString() }) + "\n");
    out.closed = reply;
  }
  return out;
}

function print(r) {
  console.log(`== mark ${r.mark || "(screenshot note)"} on ${r.level} at block ${r.spot && r.spot.block} (t ${r.spot && r.spot.t} s): "${r.note}"`);
  console.log(`   family: ${r.families.length ? r.families.map(id => { const f = FAM.of(id) || FAM.FAMILIES.find(x => x.id === id); return `${id} (${f.effect}, ${f.effort}; ${f.check})`; }).join(" | ") : r.how && /the note read/.test(r.how) ? "none named (an instruction; if it is a rule, record it: --new-family)" : "NONE -- a new family: --new-family"}`);
  if (r.found && r.found.length) console.log(`   the checks at the spot: ${r.found.join("; ")}`);
  if (r.how) console.log(`   change from: ${r.how}`);
  if (r.edit) E.print(r.edit); else if (r.error) { console.log("   " + r.error); if (r.picture) console.log(r.picture); }
  if (r.sweep) console.log(`   sweep: the family's check finds ${r.sweep.spots} spot(s) in ${r.sweep.levels.length} GDLM level(s)` + (r.sweep.levels.length ? ": " + r.sweep.levels.map(l => `${l.level.replace(/^gdlm_|\.gdlvl$/g, "")} ${l.n}`).join(", ") : ""));
  if (r.closed) console.log(`   closed the mark: ${r.closed}`);
}

function newFamily(id, words, line, effect, effort) {
  const f = path.join(ROOT, "knowledge", "families.json");
  let list = []; try { list = JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) {}
  if (list.some(x => x.id === id) || FAM.FAMILIES.some(x => x.id === id)) throw new Error("family " + id + " exists");
  list.push({ id, words: words.split("|").map(s => s.trim()).filter(Boolean), effect: effect || "flow", effort: effort || "local", fix: line, checklist: line.slice(0, 40), added: new Date().toISOString().slice(0, 10) });
  fs.writeFileSync(f, JSON.stringify(list, null, 1) + "\n");
  const cl = path.join(ROOT, "knowledge", "checklist.md"); let s = fs.readFileSync(cl, "utf8");
  const H = "## From the user's marks (families with no scored check yet)";
  if (!s.includes(H)) s = s.replace(/\n## Then\b/, `\n${H}\n\nAdded by tools/markedit.js --new-family; each still needs its check in tools/rules.js or softrules.js (then move the line\nto its section above and give the family its rule name in tools/families.js).\n\n## Then`);
  s = s.replace(H + "\n\n" + s.split(H + "\n\n")[1].split("\n\n")[0], m => m + `\n- [ ] **${id}**: ${line} (knowledge/families.json, ${new Date().toISOString().slice(0, 10)})`);
  fs.writeFileSync(cl, s);
  return { family: id, file: "knowledge/families.json", checklist: "knowledge/checklist.md" };
}

module.exports = { run, marks, sweep, issuesNear, newFamily, clean };

if (require.main === module) {
  const a = process.argv.slice(2), opt = k => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : undefined; };
  if (a[0] === "list") {
    const q = (a[1] || "").toLowerCase(), list = marks().filter(m => !m.done && (!q || String(m.level).toLowerCase().includes(q)));
    if (!list.length) console.log("no open marks");
    for (const m of list) { const f = FAM.classify(m.note).map(x => x.id); console.log(`${m.id}  ${m.level}  block ${(m.x / 30).toFixed(1)}  "${m.note}"  -> ${f.length ? f.join(", ") : "no family"}`); }
    process.exit(0);
  }
  if (a.includes("--new-family")) { console.log(JSON.stringify(newFamily(opt("--new-family"), opt("--words") || "", opt("--line") || "", opt("--effect"), opt("--effort")))); process.exit(0); }
  let o;
  const common = { ops: opt("--do") ? JSON.parse(opt("--do")) : null, words: opt("--words"), dry: a.includes("--dry"), noShots: a.includes("--no-shots"), noSweep: a.includes("--no-sweep"), done: a.includes("--done"), session: opt("--session") };
  if (opt("--level")) o = Object.assign({ level: opt("--level"), at: opt("--at") || "", note: opt("--note") || "" }, common);
  else {
    const m = marks().find(x => x.id === a[0]);
    if (!m) { console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n")); process.exit(1); }
    o = Object.assign({ mark: m, level: levelFileOf(m), at: `x=${m.x}` + (m.y != null ? `,y=${m.y}` : ""), note: m.note }, common);
  }
  let r; try { r = run(o); } catch (e) { r = { ok: false, error: e.message, families: FAM.classify(o.note).map(f => f.id), note: o.note }; }
  if (a.includes("--json")) console.log(JSON.stringify(r, null, 1)); else print(r);
  process.exit(r.ok ? 0 : 1);
}
