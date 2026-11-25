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
const lv = readGdlvl(path.join(ROOT, "levels", "archive", "gdlm_01_one_jump.gdlvl"));
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
  const n0 = ACT.read().length; await req("POST", "/play", { level: "x", file, result: "clear", attempt: 1, test: true, events: [{ tick: 5, type: "press" }] });
  check(ACT.read().length === n0, "a test attempt stays out of the feed");
  // its inputs: kept per level and version (tools/attempts.js), listed without them, one fetched with them
  const evs = [{ tick: 40, type: "press" }, { tick: 41, type: "release" }, { tick: 300, type: "press" }, { tick: 330, type: "release" }];
  await req("POST", "/play", { level: "GDLM 98 gate test", file, session: "test", attempt: 4, result: "died", x: 900, pct: 30, t: 2.9, why: "spike", practice: false, fromTick: 0, events: evs, hash: "abcd1234" });
  const runs = JSON.parse((await req("GET", "/attempts?file=" + encodeURIComponent(file) + "&hash=abcd1234")).body);
  check(runs.length === 1 && runs[0].presses === 2 && !runs[0].events && runs[0].source === "viewer" && runs[0].result === "died", "GET /attempts: this version's attempts (the test one left out), without inputs");
  const one = JSON.parse((await req("GET", "/attempts?file=" + encodeURIComponent(file) + "&hash=abcd1234&id=" + runs[0].id)).body)[0];
  check(one && JSON.stringify(one.events) === JSON.stringify(evs), "GET /attempts&id=: one attempt with its inputs");
  check(JSON.parse((await req("GET", "/attempts?file=" + encodeURIComponent(file) + "&hash=other")).body).length === 0, "another version's hash: none");
  // an official level: a recording line as tools/replay_run.js writes it ("official:7") is found by the viewer's file
  // (local/official_07.json) -- one key for both (attempts.js baseOf); without &hash every version comes back
  const AT = require("../tools/attempts.js");
  AT.append({ source: "video", level: "official 7", file: "official:7", hash: "2fc1df11", events: evs, result: "died", x: 500, pct: 12, practice: false, from: null, video: { file: "v.mkv", inputs: "i.csv", res: "agree" } });
  AT.append({ source: "video", level: "official 7", file: "official:7", hash: "0ld0ld00", events: evs, result: "died", x: 300, pct: 8, practice: false, from: null });
  const off = JSON.parse((await req("GET", "/attempts?file=" + encodeURIComponent("local/official_07.json") + "&hash=2fc1df11")).body);
  check(off.length === 1 && off[0].source === "video" && off[0].presses === 2, "official: a recording's line (official:7) listed for the viewer's local/official_07.json");
  const offAll = JSON.parse((await req("GET", "/attempts?file=" + encodeURIComponent("local\\official_07.json"))).body);
  check(offAll.length === 2 && offAll.some(r => r.hash === "0ld0ld00"), "without &hash: every version (the viewer counts the older ones)");
  // community levels: listed with names and demon-list facts, no level strings (tools/community_index.js)
  fs.mkdirSync(path.join(tmp, "community"), { recursive: true });
  fs.copyFileSync(path.join(ROOT, "levels", "archive", "gdlm_01_one_jump.gdlvl"), path.join(tmp, "community", "123.gdlvl"));
  fs.copyFileSync(path.join(ROOT, "levels", "archive", "gdlm_01_one_jump.gdlvl"), path.join(tmp, "community", "456.gdlvl"));
  fs.writeFileSync(path.join(tmp, "community", "demonlist.json"), JSON.stringify({ levels: [{ id: 456, name: "Test Demon", position: 2, creator: "someone", verifier: "x", top1: { kind: "top1", for: "Incumbent" }, file: "local/community/456.gdlvl", objects: 9 }, { id: 789, name: "Not here", position: 1, missing: true }] }));
  const com = JSON.parse((await req("GET", "/community/list")).body), c123 = com.find(r => r.id === 123), c456 = com.find(r => r.id === 456);
  check(com.length === 2 && c123 && c123.file === "local/community/123.gdlvl" && c123.name === lv.name && !c123.demon && c456 && c456.name === "Test Demon" && c456.demon.position === 2 && c456.demon.creator === "someone" && !JSON.stringify(com).includes(lv.levelStr.slice(0, 40)),
    "GET /community/list: each file's name (from its record) and the demon list's facts, no level strings, missing ones left out");
  // the "my runs" tab's index: one small row per level, newest played first
  const idx = JSON.parse((await req("GET", "/attempts/index")).body), o7 = idx.find(r => r.base === "official_7"), g98 = idx.find(r => r.base === "gdlm_98_gate");
  check(o7 && o7.attempts === 2 && o7.clears === 0 && o7.best === 12 && o7.video === 2 && o7.hashes.length === 2 && g98 && g98.viewer === 1 && !("events" in o7) && idx[0].base === "official_7",
    "GET /attempts/index: per level attempts, clears, best %, sources, versions; newest played first");
  const GD = require("../lib/liveplay.js");
  check(GD.attemptsBase && GD.attemptsBase("local/official_07.json") === AT.baseOf("official:7"), "the viewer's GD.attemptsBase is the server's key");
  check(["official:7", "official_7", "official_07", "local/official_07.json", "local\\official_07.json"].every(f => AT.baseOf(f) === "official_7") && AT.baseOf("local/community/123.gdlvl") === "c123" && AT.baseOf("c123") === "c123", "baseOf: one key per official / community level");
  // the hash of an official level: the viewer hashes local/official_NN.json's level, replay_run.js the game's own
  // Resources/levels/N.txt -- the same string (checked here when both are on this PC)
  const offJson = path.join(ROOT, "local", "official_07.json"), gdTxt = (process.env.GD_LEVELS || "C:/Program Files (x86)/Steam/steamapps/common/Geometry Dash/Resources/levels/") + "7.txt";
  if (fs.existsSync(offJson) && fs.existsSync(gdTxt)) { const { levelHash } = require("../lib/liveplay.js"), { unpack } = require("../tools/io.js");
    let txt = null; try { txt = unpack(fs.readFileSync(gdTxt, "utf8")); } catch (e) {}
    check(txt != null && levelHash(JSON.parse(fs.readFileSync(offJson, "utf8")).level) === levelHash(txt), "official 7: the viewer's level and the game's file hash the same");
  } else console.log("skip official hash check (no GD install / local/official_07.json here)");
  srv.kill(); fs.rmSync(tmp, { recursive: true, force: true });
  console.log(bad ? `${bad} failed` : "all passed"); process.exit(bad ? 1 : 0);
})().catch(e => { console.log("FAIL", e.message); srv.kill(); process.exit(1); });
