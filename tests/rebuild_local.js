// node tests/rebuild_local.js   -- tools/rebuild_local.js: every local-only item has an id, a source, a check that runs on an
// empty local/, and a rebuild command whose tool exists (or is marked personal). CLAUDE.md "anything local-only has an easy
// local rebuild": a new local-only kind of data gets a row there, and this test keeps the rows honest.
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const { ITEMS, table } = require("../tools/rebuild_local.js");
let fails = 0; const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) fails++; };
const ids = ITEMS.map(i => i.id);
ok(new Set(ids).size === ids.length, "ids are unique: " + ids.join(" "));
for (const it of ITEMS) {
  ok(it.what && ["game", "public", "network", "personal"].includes(it.source), it.id + ": says what it is and where it comes from");
  ok(it.source === "personal" ? !it.run : !!it.run, it.id + (it.source === "personal" ? ": personal, no rebuild" : ": has a rebuild command"));
  if (it.run && it.run.args) { const tool = it.run.args.find(a => a.endsWith(".js"));
    ok(tool && fs.existsSync(tool), it.id + ": its tool exists (" + path.relative(ROOT, tool || "") + ")"); }
  if (it.run && it.source !== "personal") ok(it.time && !/MEASURE_ME/.test(it.time), it.id + ": says how long it takes (or 'not measured')");
  for (const a of it.after || []) ok(ids.indexOf(a) >= 0 && ids.indexOf(a) < ids.indexOf(it.id), it.id + ": comes after " + a);
  let c = null; try { c = it.check(); } catch (e) {}
  ok(c && typeof c.ok === "boolean", it.id + ": its check runs");
}
ok(table().length === ITEMS.length, "the table has a row per item");
console.log(fails ? fails + " failed" : "all ok");
process.exit(fails ? 1 : 0);
