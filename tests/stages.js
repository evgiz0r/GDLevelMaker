// node tests/stages.js  -- build stages (tools/stages.js) reach the viewer: put song / layout / path into a temp wip
// folder (GDLM_WIP_DIR), check the index (order, a repeated stage replaced, the level files), then start tools/serve.js
// on that folder and check /wip/list lists the build at its latest stage (before it has a wip level) and /wip/stages
// gives every stage with its level (the song stage: an empty level) and the path stage's planned presses.
const fs = require("fs"), path = require("path"), os = require("os"), cp = require("child_process"), http = require("http");
const ROOT = path.join(__dirname, ".."), tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gdlm-stages-"));
process.env.GDLM_WIP_DIR = tmp;
const ST = require("../tools/stages.js"), { readGdlvl } = require("../tools/io.js");
let bad = 0; const check = (ok, what) => { console.log((ok ? "ok   " : "FAIL ") + what); if (!ok) bad++; };
const lv = readGdlvl(path.join(ROOT, "levels", "archive", "gdlm_01_one_jump.gdlvl"));
ST.put({ session: "test", base: "gdlm_99_stagetest", name: "GDLM 99 stage test", stage: "layout", levelStr: lv.levelStr, note: "first" });
ST.put({ session: "test", base: "gdlm_99_stagetest", stage: "song", data: { song: { url: "/song/official/StereoMadness.mp3", offset: 0 }, sections: [{ name: "intro", from: 0, to: 4 }] } });
ST.put({ session: "test", base: "gdlm_99_stagetest", stage: "path", levelStr: lv.levelStr, data: { planned: [{ t: 1.2, what: "jump" }] } });
ST.put({ session: "test", base: "gdlm_99_stagetest", stage: "layout", levelStr: lv.levelStr, note: "second" });
const idx = JSON.parse(fs.readFileSync(path.join(tmp, "test", "gdlm_99_stagetest.stages", "index.json"), "utf8"));
check(idx.stages.map(s => s.stage).join(">") === "song>layout>path", "stages in order: " + idx.stages.map(s => s.stage).join(" > "));
check(idx.stages.find(s => s.stage === "layout").note === "second", "a repeated stage replaces the old one");
check(fs.existsSync(path.join(tmp, "test", "gdlm_99_stagetest.stages", "layout.gdlvl")) && readGdlvl(path.join(tmp, "test", "gdlm_99_stagetest.stages", "path.gdlvl")).levelStr === lv.levelStr, "the stage levels are written and read back");
const PORT = 8792, srv = cp.spawn(process.execPath, [path.join(ROOT, "tools", "serve.js"), String(PORT), "--no-update"], { stdio: "ignore", windowsHide: true, env: Object.assign({}, process.env) });
const get = u => new Promise((ok, no) => http.get(`http://localhost:${PORT}${u}`, r => { let b = ""; r.on("data", c => b += c); r.on("end", () => ok(b)); }).on("error", no));
(async () => {
  for (let i = 0; i < 40; i++) { try { await get("/version"); break; } catch (e) { await new Promise(r => setTimeout(r, 150)); } }
  const list = JSON.parse(await get("/wip/list")), b = list.find(x => x.file === "local/wip/test/gdlm_99_stagetest.gdlvl");
  check(!!b && b.stagesOnly && b.stage === "path" && !!b.level, "/wip/list: the build before its first wip put, at stage " + (b && b.stage));
  const st = JSON.parse(await get("/wip/stages?file=" + encodeURIComponent("local/wip/test/gdlm_99_stagetest.gdlvl")));
  const song = st.stages.find(s => s.stage === "song"), pth = st.stages.find(s => s.stage === "path");
  check(st.stages.length === 3 && !!song.level && song.solution && song.solution.ok, "/wip/stages: 3 stages, the song stage an empty level that replays");
  check(pth.data && pth.data.planned && pth.data.planned[0].t === 1.2 && pth.level === lv.levelStr, "/wip/stages: the path stage's level and planned presses");
  srv.kill(); fs.rmSync(tmp, { recursive: true, force: true });
  console.log(bad ? `${bad} failed` : "all passed"); process.exit(bad ? 1 : 0);
})().catch(e => { console.log("FAIL", e.message); srv.kill(); process.exit(1); });
