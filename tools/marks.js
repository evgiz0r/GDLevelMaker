// node tools/marks.js [level-name-part]      -- the open marks (the user's notes from the viewer)
// node tools/marks.js all [level-name-part]  -- every mark, done ones too
// node tools/marks.js done <id> "reply"      -- close a mark, saying what was changed
// Marks live in local/marks.jsonl -- the shared folder every session sees (tools/link_local.js; see marks/README.md).
const fs = require("fs"), path = require("path");
const F = path.join(__dirname, "..", "local", "marks.jsonl");
const lines = fs.existsSync(F) ? fs.readFileSync(F, "utf8").split("\n").filter(Boolean).map(l => JSON.parse(l)) : [];
// Marks made on the phone page live in its database. A session saves them with ArtifactData
// {action: "list", collection: "marks", out_dir: "local/phone"} (PHONE.md), one JSON file per mark
// in local/phone/marks/. They fold in like lines of marks.jsonl, before it, so a `done` line still
// closes a phone mark.
const PHONE = path.join(__dirname, "..", "local", "phone", "marks");
// Since 2026-11-28 the page writes each save as its own doc (<id>-<time>, field rev): they are folded oldest first.
if (fs.existsSync(PHONE)) { const ph = [];
  for (const f of fs.readdirSync(PHONE).filter(f => f.endsWith(".json"))) {
    try { const j = JSON.parse(fs.readFileSync(path.join(PHONE, f), "utf8")); const m = j && (j.data && typeof j.data === "object" ? j.data : j);
          if (m && m.id) ph.push(Object.assign({ from: "phone" }, m)); } catch (e) {} }
  ph.sort((a, b) => String(a.rev || a.made || "").localeCompare(String(b.rev || b.made || "")));
  lines.unshift(...ph);
}
const by = new Map();
for (const m of lines) by.set(m.id, Object.assign(by.get(m.id) || {}, m));
const marks = [...by.values()].filter(m => m.note != null && !m.deleted);
const [a, b, c] = process.argv.slice(2);
if (a === "done") {
  if (!by.has(b)) { console.error("no mark " + b); process.exit(1); }
  fs.appendFileSync(F, JSON.stringify({ id: b, done: true, reply: c || "", at: new Date().toISOString() }) + "\n");
  console.log("closed " + b);
} else {
  const all = a === "all", q = ((all ? b : a) || "").toLowerCase();
  const list = marks.filter(m => (all || !m.done) && (!q || m.level.toLowerCase().includes(q)));
  if (!list.length) console.log("no " + (all ? "" : "open ") + "marks");
  for (const m of list) console.log(`${m.id}  ${m.done ? "[done] " : ""}${m.level}  t=${m.t}s  block ${(m.x / 30).toFixed(1)}, row ${(m.y / 30).toFixed(1)}  (${m.view}, zoom ${m.zoom}${m.from === "phone" ? ", from the phone" : ""})\n    ${m.kind ? "(" + m.kind + ") " : ""}${m.note || "(no note)"}${m.stroke ? "\n    drawn line: " + m.stroke.map(p => "(" + (p[0] / 30).toFixed(1) + "," + (p[1] / 30).toFixed(1) + ")").join(" ") + " (block, row)" : ""}${m.reply ? "\n    -> " + m.reply : ""}`);
}
