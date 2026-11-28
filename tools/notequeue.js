// node tools/notequeue.js <dir> [--since ISO] [--all]  -- every note Evgeni typed on a workbook page that Claude has not answered yet
//   (Evgeni 2026-11-28: "its in the comments there, why didnt you get it" -- his ball / spider notes sat in the lego catalogue's
//   db for 1.5 h, typed in the 🎲 generator boxes but never 📨 sent, and no session read the db; and "bugs in those iterative ui
//   issues are not local, always a general thing"). A note is the page's to keep, not his to deliver: a session that owns a
//   workbook reads its whole queue on EVERY wake, sent or not, with this tool.
//   <dir>: an ArtifactData `list` out_dir with the page's note collections (designnotes, designmarks, designsecs, designdraw,
//   genrating ...) and its answers (claudestatus). The newest revision per part (`part`, or `design` + `mid` for marks) is the
//   note; it is OPEN when it is not empty and no claudestatus doc for that part, and no "<mid>-claudeseen" doc, is newer,
//   and it is not deleted (fixed) or seen with a reply to its own text.
//   Prints the open ones, oldest first; exit 1 when any is open. Steps: WORKBOOKS.md "Reading the queue".
"use strict";
const fs = require("fs"), path = require("path");

function load(dir) { const out = {};
  for (const c of fs.existsSync(dir) ? fs.readdirSync(dir) : []) { const d = path.join(dir, c); if (!fs.statSync(d).isDirectory()) continue;
    out[c] = fs.readdirSync(d).filter(f => f.endsWith(".json")).map(f => { try { return Object.assign({ _id: f.slice(0, -5) }, JSON.parse(fs.readFileSync(path.join(d, f), "utf8"))); } catch (e) { return null; } }).filter(Boolean); }
  return out; }
// the page's parts: designnotes "sec:<key>" / "gen:..." / "genT:<key>" / "play"; marks by their mid
const keyOf = (c, d) => d.part || (d.mid ? "mark:" + d.mid : d.key ? c + ":" + d.key : c + ":" + d._id.replace(/-[^-]*$/, ""));
// claudestatus parts are written by sessions in a few spellings: "genT:wave", "gen:wave:37901", "sec:my-mwz8kaem"
const norm = s => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, ":");
function open(db, o = {}) {
  const ans = (db.claudestatus || []), seen = new Map();
  for (const c of ["designmarks"]) for (const d of db[c] || []) if (/-claudeseen$/.test(d._id) && d.mid) seen.set(d.mid, d.at || "");
  const newest = new Map();
  for (const c of Object.keys(db)) { if (c === "claudestatus" || c === "designsend" || c === "genroute" || c === "themework") continue;
    for (const d of db[c]) { if (/-claudeseen$/.test(d._id) || d.by === "claude" || !d.at) continue; const k = keyOf(c, d), p = newest.get(k);
      if (!p || d.at > p.at) newest.set(k, Object.assign({ coll: c }, d)); } }
  const out = [];
  for (const [k, d] of newest) {
    const text = String(d.note || d.text || d.comment || "").trim(); if (!text && !o.all) continue;
    if (o.since && d.at < o.since) continue;
    if (d.mid && (seen.get(d.mid) || "") >= d.at) continue;
    // a mark answered on itself: deleted (fixed), or seen with a reply to this same text
    if (d.deleted || (d.seen && d.reply && (!d.sentNote || d.sentNote === d.note))) continue;
    const nk = norm(k), answered = ans.some(a => (a.at || "") >= d.at && a.part && (norm(a.part) === nk || nk.startsWith(norm(a.part) + ":") || norm(a.part).startsWith(nk)));
    if (answered) continue;
    out.push({ part: k, coll: d.coll, at: d.at, sent: !!(d.sentNote && d.sentNote === d.note) || !!d.sent, note: text });
  }
  return out.sort((a, b) => a.at < b.at ? -1 : 1);
}
module.exports = { load, open };
if (require.main === module) {
  const a = process.argv.slice(2), dir = a.find(x => !x.startsWith("--")), i = a.indexOf("--since");
  if (!dir) { console.error("usage: node tools/notequeue.js <dir> [--since ISO] [--all]"); process.exit(2); }
  const q = open(load(dir), { since: i >= 0 ? a[i + 1] : null, all: a.includes("--all") });
  for (const n of q) console.log(`${n.at}  ${n.part}${n.sent ? "" : "  (never sent)"}  ${n.note}`);
  console.log(q.length ? `${q.length} open note(s)` : "queue empty");
  process.exit(q.length ? 1 : 0);
}
