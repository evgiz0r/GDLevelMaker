// Decision cards (VIEWER.md): a session asks the user a question with options; the viewer shows it as a card (the Work
// panel, and a badge on its button) and stores the answer; the answer also goes to the actions feed (tools/actions.js).
//   node tools/ask.js put <session> "question" <option> <option> ... [--level "GDLM 64 golden hour"] [--file levels/x.gdlvl]
//        -> prints the card's id
//   node tools/ask.js wait <id> [--timeout-min 120]   blocks until answered, prints the answer (exit 2 on timeout)
//   node tools/ask.js list [--open]                   the cards (open first)
//   require("./ask.js").put({ session, question, options, level?, file? }) / .get(id) / .answer(id, answer, note?) / .list()
// Files: local/asks/<id>.json {id, at, session, question, options, level, file, answer?, note?, answeredAt?}. GDLM_LOCAL_DIR: tests.
const fs = require("fs"), path = require("path");
const DIR = () => path.join(process.env.GDLM_LOCAL_DIR || path.join(__dirname, "..", "local"), "asks");
function put(o) {
  if (!o.session || !o.question || !(o.options || []).length) throw new Error("session, question and options are needed");
  const id = "q" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const card = { id, at: new Date().toISOString(), session: o.session, question: o.question, options: o.options.map(String), level: o.level || "", file: o.file || "" };
  fs.mkdirSync(DIR(), { recursive: true }); fs.writeFileSync(path.join(DIR(), id + ".json"), JSON.stringify(card, null, 1));
  return card;
}
function get(id) { try { return JSON.parse(fs.readFileSync(path.join(DIR(), String(id).replace(/[^\w]/g, "") + ".json"), "utf8")); } catch (e) { return null; } }
function answer(id, ans, note) {
  const c = get(id); if (!c) throw new Error("no card " + id);
  Object.assign(c, { answer: String(ans), note: note || undefined, answeredAt: new Date().toISOString() });
  fs.writeFileSync(path.join(DIR(), c.id + ".json"), JSON.stringify(c, null, 1));
  return c;
}
function list() {
  let fsn = []; try { fsn = fs.readdirSync(DIR()).filter(f => f.endsWith(".json")); } catch (e) {}
  return fsn.map(f => { try { return JSON.parse(fs.readFileSync(path.join(DIR(), f), "utf8")); } catch (e) { return null; } }).filter(Boolean)
    .sort((a, b) => (!!a.answer - !!b.answer) || String(b.at).localeCompare(String(a.at)));
}
module.exports = { put, get, answer, list };

if (require.main === module) {
  const a = process.argv.slice(2), opt = k => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : null; };
  const plain = a.filter((x, i) => !x.startsWith("--") && !(i > 0 && a[i - 1].startsWith("--")));
  if (a[0] === "put") {
    const [, session, question, ...options] = plain;
    const c = put({ session, question, options, level: opt("--level"), file: opt("--file") });
    console.log(c.id);
  } else if (a[0] === "wait") {
    const id = a[1], until = Date.now() + (+opt("--timeout-min") || 120) * 60e3;
    const tick = () => { const c = get(id); if (c && c.answer) { console.log(c.answer + (c.note ? "\t" + c.note : "")); process.exit(0); }
      if (Date.now() > until) { console.error("no answer yet"); process.exit(2); } setTimeout(tick, 2000); };
    tick();
  } else if (a[0] === "list") {
    for (const c of list().filter(c => !a.includes("--open") || !c.answer)) console.log(`${c.id} ${c.answer ? "answered: " + c.answer : "OPEN"} [${c.session}] ${c.question} (${c.options.join(" / ")})`);
  } else console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n"));
}
