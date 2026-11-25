// node tests/stage_borrow.js -- a build stage without a route of its own borrows one (the user, 2026-11-25, on FROSTBITE's
// stage bar: "path deco ... if i click them then it either dies and doesnt jump or not shown at all"): the layout stage
// carries its route (data.events), the path stage the same level with a plan that dies, the deco stage the level plus
// deco and no data at all. Each stage must open and replay a route that clears it (path: the layout's route, not its own
// dying plan; deco: the layout's route on the decorated level). Fixture local/wip/test-stageborrow/ (removed after).
const fs = require("fs"), path = require("path"), { spawn } = require("child_process"), http = require("http");
const { chromium } = require("playwright");
const ROOT = path.join(__dirname, ".."), SESSION = "test-stageborrow", WIPD = path.join(ROOT, "local", "wip", SESSION), BASE = "gdlm_99_borrow";
const { GD, readGdlvl } = require("../tools/io.js"), ST = require("../tools/stages.js");
const port = 8790 + Math.floor(Math.random() * 90);
let fails = 0; const check = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) fails++; };
const L = readGdlvl(path.join(ROOT, "levels/archive/gdlm_02_on_the_beat.gdlvl")), lv = GD.parseLevel(L.levelStr), sol = GD.solveAny(GD.makeWorld(lv.objects, lv.header));
if (!sol.ok) throw new Error("gdlm 02 is not beaten in the sim");
const deco = L.levelStr + "1,211,2,300,3,150;";
ST.put({ session: SESSION, base: BASE, name: "GDLM 99 borrow test", stage: "layout", levelStr: L.levelStr, data: { events: sol.events }, note: "test" });
ST.put({ session: SESSION, base: BASE, name: "GDLM 99 borrow test", stage: "path", levelStr: L.levelStr, data: { planned: [{ t: 0.2, what: "jump" }] }, note: "test" });
ST.put({ session: SESSION, base: BASE, name: "GDLM 99 borrow test", stage: "deco", levelStr: deco, note: "test" });
const srv = spawn(process.execPath, [path.join(ROOT, "tools", "serve.js"), String(port), "--no-update", "--local-only"], { windowsHide: true, stdio: "ignore" });
const up = () => new Promise(ok => http.get({ host: "127.0.0.1", port, path: "/wip/list" }, r => { r.resume(); ok(true); }).on("error", () => ok(false)));
const clean = () => { try { srv.kill(); } catch (e) {} fs.rmSync(WIPD, { recursive: true, force: true }); };
(async () => {
  for (let i = 0; i < 50 && !(await up()); i++) await new Promise(r => setTimeout(r, 200));
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1000, height: 700 }, deviceScaleFactor: 1 });
  p.on("pageerror", e => { console.log("page error: " + e.message); fails++; });
  await p.goto(`http://127.0.0.1:${port}/viewer/?mute=1`);
  const file = `local/wip/${SESSION}/${BASE}.gdlvl`;
  let idx = -1; for (let i = 0; i < 75 && idx < 0; i++) { idx = await p.evaluate(f => ALL.findIndex(l => l.file === f), file); if (idx < 0) await p.waitForTimeout(200); }
  check(idx >= 0, "the build shows in the in-progress list");
  await p.evaluate(i => { pick.value = i; pick.dispatchEvent(new Event("change")); }, idx);
  for (let i = 0; i < 50; i++) { if (await p.evaluate(() => !!(STG.data && STG.data.stages && STG.data.stages.length >= 3))) break; await p.waitForTimeout(200); }
  const st = () => p.evaluate(() => ({ name: L && L.name, ok: !!(L && L.sol && L.sol.ok), noRoute: !!(L && L.noRoute), from: L && L.sol && L.sol.from, n: L && L.path.length }));
  const open = async name => { await p.evaluate(n => stageOpen(n), name); let s; for (let i = 0; i < 75; i++) { s = await st(); if (s.name && s.name.endsWith("· " + name) && s.ok) return s; await p.waitForTimeout(200); } return s; };
  for (const name of ["layout", "path", "deco"]) { const s = await open(name); check(s.ok && !s.noRoute, `stage ${name} replays a route that clears it (${JSON.stringify(s)})`); }
  await b.close(); clean();
  console.log(fails ? fails + " failed" : "all ok"); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); clean(); process.exit(1); });
