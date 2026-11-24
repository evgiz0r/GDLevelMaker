// node tests/work.js  -- the viewer as the place to steer the sessions (VIEWER.md): in a temp folder (GDLM_WIP_DIR,
// GDLM_LOCAL_DIR) a build puts a gated layout stage; tools/serve.js lists it as waiting for the user; the viewer's
// POST /stages/review answers it, the stages index keeps the review and waitApproval() returns it; a decision card is
// put (tools/ask.js), listed by GET /asks, answered by POST /asks/answer and stored; every answer is a line in the
// actions feed, and `tools/actions.js tail --since <id> --once` prints exactly the lines after that id; a "you play"
// attempt (POST /play) is one "play" line.
const fs = require("fs"), path = require("path"), os = require("os"), cp = require("child_process"), http = require("http");
const ROOT = path.join(__dirname, ".."), tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gdlm-work-"));
process.env.GDLM_WIP_DIR = path.join(tmp, "wip"); process.env.GDLM_LOCAL_DIR = tmp;
const ST = require("../tools/stages.js"), ASK = require("../tools/ask.js"), ACT = require("../tools/actions.js"), { readGdlvl } = require("../tools/io.js");
let bad = 0; const check = (ok, what) => { console.log((ok ? "ok   " : "FAIL ") + what); if (!ok) bad++; };
const lv = readGdlvl(path.join(ROOT, "levels", "gdlm_01_one_jump.gdlvl"));
ST.put({ session: "test", base: "gdlm_98_gate", name: "GDLM 98 gate test", stage: "layout", levelStr: lv.levelStr, gate: true });
const PORT = 8794, srv = cp.spawn(process.execPath, [path.join(ROOT, "tools", "serve.js"), String(PORT), "--no-update"], { stdio: "ignore", windowsHide: true, env: Object.assign({}, process.env) });
const req = (method, u, body) => new Promise((ok, no) => { const r = http.request({ host: "localhost", port: PORT, path: u, method }, res => { let b = ""; res.on("data", c => b += c); res.on("end", () => ok({ status: res.statusCode, body: b })); }); r.on("error", no); if (body) r.write(JSON.stringify(body)); r.end(); });
(async () => {
  for (let i = 0; i < 40; i++) { try { await req("GET", "/version"); break; } catch (e) { await new Promise(r => setTimeout(r, 150)); } }
  const file = "local/wip/test/gdlm_98_gate.gdlvl";
  let list = JSON.parse((await req("GET", "/wip/list")).body), b = list.find(x => x.file === file);
  check(b && b.waiting === "layout", "a gated layout stage is listed as waiting for the user");
  const waiting = ST.waitApproval("test", "gdlm_98_gate", "layout", { everyMs: 100, timeoutMin: 1 });
  const before = ACT.read().length;
  const r = await req("POST", "/stages/review", { file, level: "GDLM 98 gate test", stage: "layout", verdict: "redo", note: "the gap at 40 is too tight", spot: { t: 12.5, x: 3900 } });
  check(r.status === 200, "POST /stages/review answers");
  const rev = await waiting;
  check(rev.verdict === "redo" && rev.note === "the gap at 40 is too tight" && rev.spot.x === 3900, "waitApproval returns the user's redo with its note and spot");
  list = JSON.parse((await req("GET", "/wip/list")).body); b = list.find(x => x.file === file);
  check(b && !b.waiting, "answered: no longer waiting");
  const acts = ACT.read().slice(before);
  check(acts.length === 1 && acts[0].type === "redo" && acts[0].session === "test" && acts[0].stage === "layout", "the redo is one line in the actions feed");
  // decision cards
  const card = ASK.put({ session: "test", question: "Which song?", options: ["A: calm", "B: driving"], level: "GDLM 98 gate test" });
  const asks = JSON.parse((await req("GET", "/asks")).body);
  check(asks[0] && asks[0].id === card.id && !asks[0].answer, "GET /asks lists the open card first");
  const since = ACT.read().pop().id;
  const ans = await req("POST", "/asks/answer", { id: card.id, answer: "B: driving" });
  check(ans.status === 200 && ASK.get(card.id).answer === "B: driving", "the answer is stored on the card");
  // the feed, as the coordinator's monitor reads it
  const out = cp.spawnSync(process.execPath, [path.join(ROOT, "tools", "actions.js"), "tail", "--since", since, "--once"], { encoding: "utf8", windowsHide: true, env: Object.assign({}, process.env) }).stdout.trim().split("\n").filter(Boolean);
  check(out.length === 1 && /answer \[test · GDLM 98 gate test\] Which song\? -> B: driving/.test(out[0]), "actions tail --since prints exactly the new line: " + out[0]);
  // sections (collab-style building): a section strip from the seam contract; one section sent back, its own answer
  ST.setSections("test", "gdlm_98_gate", [{ id: "s1", name: "intro", x: [0, 900], t: [0, 3], builder: { layout: "style" }, status: { layout: "built" }, in: { mode: "cube" } },
    { id: "s2", name: "drop", x: [900, 2400], t: [3, 8], builder: { layout: "style", playtest: "human" }, status: { layout: "built" } }]);
  const secWait = ST.waitApproval("test", "gdlm_98_gate", "layout", { everyMs: 100, timeoutMin: 1, section: "s2" });
  const sr = await req("POST", "/stages/review", { file, level: "GDLM 98 gate test", stage: "layout", section: "s2", sectionName: "drop", verdict: "redo", note: "the drop needs a ship", spot: { t: 5, x: 1500 } });
  const srv2 = await secWait, secs = JSON.parse((await req("GET", "/wip/stages?file=" + encodeURIComponent(file))).body).sections;
  check(sr.status === 200 && srv2.verdict === "redo" && srv2.note === "the drop needs a ship", "a section's redo: waitApproval({section}) returns it");
  check(secs && secs[1].status.layout === "redo" && secs[1].reviews.layout.note === "the drop needs a ship" && secs[0].status.layout === "built" && !secs[0].in, "the index's sections: s2 redo, s1 untouched (only the viewer's fields kept)");
  check(/section s2 drop layout: the drop needs a ship/.test(ACT.read().pop().text), "the feed line names the section and role");
  ST.setSections("test", "gdlm_98_gate", [{ id: "s2", name: "drop", x: [900, 2400], status: { layout: "built" } }]);
  check(!JSON.parse((await req("GET", "/wip/stages?file=" + encodeURIComponent(file))).body).sections[0].reviews, "a rebuilt section (status built again) clears its old review");
  // "you play": an attempt is one "play" line in the feed (a test attempt goes to the test file instead)
  const pr = await req("POST", "/play", { level: "GDLM 98 gate test", file, session: "test", stage: "layout", attempt: 3, result: "died", x: 1346, pct: 44.9, t: 4.32, why: "spike", from: 0, practice: true });
  const pa = ACT.read().pop();
  check(pr.status === 200 && pa.type === "play" && pa.result === "died" && pa.pct === 44.9 && /died at 44.9% \(block 45, 4.32 s\): spike -- attempt 3, practice/.test(pa.text), "POST /play: an attempt in the feed: " + pa.text);
  const n0 = ACT.read().length; await req("POST", "/play", { level: "x", result: "clear", attempt: 1, test: true });
  check(ACT.read().length === n0, "a test attempt stays out of the feed");
  srv.kill(); fs.rmSync(tmp, { recursive: true, force: true });
  console.log(bad ? `${bad} failed` : "all passed"); process.exit(bad ? 1 : 0);
})().catch(e => { console.log("FAIL", e.message); srv.kill(); process.exit(1); });
