// The viewer's actions feed (VIEWER.md): every user action in the viewer -- a mark, a stage approved or sent back, a
// decision card answered, a variant picked -- is one line in local/viewer_actions.jsonl, so it reaches the session
// that owns the level at once (the coordinator runs `tail` as a monitor and forwards each line).
//   require("./actions.js").append({ type, session, level, file, stage, text, ... }) -> the stored line (id, at added)
//   node tools/actions.js tail [--since <id>] [--once]   new lines as they come, one short line each (--once: print and stop)
//   node tools/actions.js list [--session s] [--n 20]    the last ones
// A line: {id, at, type: mark | approve | redo | answer | variant-pick, session, level, file, stage?, text, ...}. ids sort
// in time order ("a" + base-36 ms + a counter), so --since <id> picks up exactly after it. GDLM_LOCAL_DIR: tests.
const fs = require("fs"), path = require("path");
const LOCAL = process.env.GDLM_LOCAL_DIR || path.join(__dirname, "..", "local"), FILE = path.join(LOCAL, "viewer_actions.jsonl");
let last = 0, n = 0;
function newId() { const t = Date.now(); if (t === last) n++; else { last = t; n = 0; } return "a" + t.toString(36) + "-" + String(n).padStart(3, "0"); }
function append(a) {
  const line = Object.assign({ id: newId(), at: new Date().toISOString() }, a);
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.appendFileSync(FILE, JSON.stringify(line) + "\n");
  return line;
}
function read() { try { return fs.readFileSync(FILE, "utf8").split(/\r?\n/).filter(Boolean).map(l => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean); } catch (e) { return []; } }
// one short line for a monitor: id, type, owner, level, stage, text
function short(a) {
  const where = [a.session || "?", a.level || a.file || "", a.stage ? "stage " + a.stage : ""].filter(Boolean).join(" · ");
  return `${a.id} ${a.type} [${where}] ${String(a.text || a.note || a.answer || "").replace(/\s+/g, " ").slice(0, 200)}`;
}
module.exports = { append, read, short, FILE };

if (require.main === module) {
  const args = process.argv.slice(2), opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
  if (args[0] === "tail") {
    let since = opt("--since") || "";
    const flush = () => { for (const a of read()) if (a.id > since) { console.log(short(a)); since = a.id; } };
    flush();
    if (args.includes("--once")) process.exit(0);
    setInterval(flush, 1000);   // follows the file: a new line is printed within a second
  } else if (args[0] === "list") {
    const s = opt("--session"), all = read().filter(a => !s || a.session === s);
    for (const a of all.slice(-(+opt("--n") || 20))) console.log(short(a));
  } else console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n"));
}
