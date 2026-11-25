// node tests/lab_play.js -- the section lab plays each variant (the user, 2026-11-25: "running different sections is bugged
// cant see the play"): a lab round of two stage-only variants (as tools/lab.js builds them: a layout stage with the solved
// route as data.events, no wip level, no fresh solution in the cache) opens at #lab, each variant replays its route with
// the player and plays at once, switching back and forth works, and the round's 15 s poll does not reset it to the
// card's "no route yet". Fixture: local/wip/test-labplay/ (removed after) and a round in a temp GDLM_LAB_DIR. Headless, muted.
const fs = require("fs"), path = require("path"), os = require("os"), { spawn } = require("child_process"), http = require("http");
const { chromium } = require("playwright");
const ROOT = path.join(__dirname, ".."), SESSION = "test-labplay", WIPD = path.join(ROOT, "local", "wip", SESSION);
const { GD, readGdlvl } = require("../tools/io.js"), ST = require("../tools/stages.js");
const lab = fs.mkdtempSync(path.join(os.tmpdir(), "gdlm-labplay-")), port = 8890 + Math.floor(Math.random() * 100);
let fails = 0; const check = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) fails++; };
// two variants from two small repo levels, each with its route as the builder's planned events
const src = ["levels/archive/gdlm_01_one_jump.gdlvl", "levels/archive/gdlm_02_on_the_beat.gdlvl"].map((f, i) => {
  const L = readGdlvl(path.join(ROOT, f)), lv = GD.parseLevel(L.levelStr), sol = GD.solveAny(GD.makeWorld(lv.objects, lv.header));
  if (!sol.ok) throw new Error(f + " is not beaten in the sim");
  ST.put({ session: SESSION, base: `lab_r7_v${i + 1}`, name: `LAB r7 v${i + 1} test`, stage: "layout", levelStr: L.levelStr, data: { events: sol.events, kind: "planned" }, note: "test" });
  return { k: i + 1, hook: i ? "orb-trick" : "speed-up", why: "test", file: `local/wip/${SESSION}/lab_r7_v${i + 1}.gdlvl` };
});
fs.mkdirSync(path.join(lab, "r7")); fs.writeFileSync(path.join(lab, "r7", "round.json"), JSON.stringify({ id: "r7", moment: "a test", t: [0, 10], variants: src }));
const srv = spawn(process.execPath, [path.join(ROOT, "tools", "serve.js"), String(port), "--no-update", "--local-only"], { env: Object.assign({}, process.env, { GDLM_LAB_DIR: lab }), windowsHide: true, stdio: "ignore" });
const up = () => new Promise(ok => http.get({ host: "127.0.0.1", port, path: "/lab/list" }, r => { r.resume(); ok(true); }).on("error", () => ok(false)));
const clean = () => { try { srv.kill(); } catch (e) {} fs.rmSync(lab, { recursive: true, force: true }); fs.rmSync(WIPD, { recursive: true, force: true }); };
(async () => {
  for (let i = 0; i < 50 && !(await up()); i++) await new Promise(r => setTimeout(r, 200));
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1000, height: 700 }, deviceScaleFactor: 1 });
  p.on("pageerror", e => { console.log("page error: " + e.message); fails++; });
  await p.goto(`http://127.0.0.1:${port}/viewer/?mute=1#lab=r7`);
  const st = () => p.evaluate(() => ({ name: L && L.name, noRoute: !!(L && L.noRoute), ok: !!(L && L.sol.ok), playing, t }));
  const wait = async (want, ms = 15000) => { const t0 = Date.now(); let s; while (Date.now() - t0 < ms) { s = await st(); if (s.name && s.name.includes(want) && !s.noRoute && s.playing && s.t > 0.3) return s; await p.waitForTimeout(200); } return s; };
  let s = await wait("v1"); check(/v1 test · layout/.test(s.name) && s.ok && s.playing, `#lab opens v1 and plays its route (${JSON.stringify(s)})`);
  await p.evaluate(() => labGo(2)); s = await wait("v2"); check(/v2 test · layout/.test(s.name) && s.ok && s.playing, `v2: its route, playing (${s.name})`);
  await p.evaluate(() => labGo(1)); s = await wait("v1"); check(/v1 test · layout/.test(s.name) && s.ok && s.playing, `back to v1: its route again, not "no route yet" (${s.name}, noRoute ${s.noRoute})`);
  await p.evaluate(() => loadWip(true)); await p.waitForTimeout(500); s = await st();
  check(/v1 test · layout/.test(s.name) && !s.noRoute, `a refresh of the in-progress list keeps the variant's replay (${s.name})`);
  await b.close(); clean();
  console.log(fails ? fails + " failed" : "all ok"); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); clean(); process.exit(1); });
