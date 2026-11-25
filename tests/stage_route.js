// node tests/stage_route.js -- tools/stages.js route() puts a build's checked route on each stage it clears, drop()
// removes a stage left from an earlier build (FROSTBITE 2026-11-25: the path stage's plan died at the second spike,
// deco had no route, and final was the level of a build 15 hours older). Fixture local/wip/test-stageroute/, removed.
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, ".."), SESSION = "test-stageroute", WIPD = path.join(ROOT, "local", "wip", SESSION);
const { GD, readGdlvl } = require("../tools/io.js"), ST = require("../tools/stages.js");
let fails = 0; const check = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) fails++; };
try {
  const L = readGdlvl(path.join(ROOT, "levels/gdlm_02_on_the_beat.gdlvl")), sol = GD.solveAny(GD.makeWorld(L.level.objects, L.level.header));
  const other = readGdlvl(path.join(ROOT, "levels/gdlm_01_one_jump.gdlvl")).levelStr;
  ST.put({ session: SESSION, base: "b", name: "t", stage: "final", levelStr: other, note: "old build" });
  ST.put({ session: SESSION, base: "b", name: "t", stage: "layout", levelStr: L.levelStr, data: { planned: [{ t: 0.2, what: "jump" }] } });
  ST.put({ session: SESSION, base: "b", name: "t", stage: "deco", levelStr: L.levelStr + "1,211,2,300,3,150;" });
  ST.drop(SESSION, "b", "final");
  let idx = JSON.parse(fs.readFileSync(path.join(WIPD, "b.stages", "index.json"), "utf8"));
  check(!idx.stages.some(s => s.stage === "final") && !fs.existsSync(path.join(WIPD, "b.stages", "final.gdlvl")), "drop: the old build's final is gone");
  const got = ST.route(SESSION, "b", sol.events, GD);
  idx = JSON.parse(fs.readFileSync(path.join(WIPD, "b.stages", "index.json"), "utf8"));
  const lay = idx.stages.find(s => s.stage === "layout");
  check(got.join() === "layout,deco", "route: on layout and deco (" + got.join() + ")");
  check(lay.data.events.length === sol.events.length && lay.data.planned.length === 1, "route: events added, the plan kept");
  const none = ST.route(SESSION, "b", [{ tick: 1, type: "press" }, { tick: 2, type: "release" }], GD);
  check(none.length === 0, "a route that dies goes on no stage");
} finally { fs.rmSync(WIPD, { recursive: true, force: true }); }
console.log(fails ? fails + " failed" : "all ok"); process.exit(fails ? 1 : 0);
