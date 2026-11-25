// node tests/note_typing.js -- typing a mark's note never drives the replay (the user, 2026-11-25: "when i start saying what
// to change with mark it repeats the levels and hangs the ui"): with the note box open, typing spaces, r, m, p, f, l, d and
// digits leaves the replay's play state and time, the mark mode, the picker and draw mode alone. Headless, muted.
const { chromium } = require("playwright"), path = require("path"), { spawn } = require("child_process"), http = require("http");
const port = 8990 + Math.floor(Math.random() * 9);
const srv = spawn(process.execPath, [path.join(__dirname, "..", "tools", "serve.js"), String(port), "--no-update", "--local-only"], { windowsHide: true, stdio: "ignore" });
const up = () => new Promise(ok => http.get({ host: "127.0.0.1", port, path: "/viewer/" }, r => { r.resume(); ok(true); }).on("error", () => ok(false)));
let fails = 0; const check = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) fails++; };
(async () => {
  for (let i = 0; i < 50 && !(await up()); i++) await new Promise(r => setTimeout(r, 200));
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1000, height: 700 }, deviceScaleFactor: 1 });
  p.on("pageerror", e => { console.log("page error: " + e.message); fails++; });
  await p.goto(`http://127.0.0.1:${port}/viewer/?mute=1`);
  await p.waitForFunction(() => typeof L !== "undefined" && L && L.path && L.path.length > 1, null, { timeout: 15000 });
  await p.evaluate(() => { t = 1; playing = false; setPlay(); draw(); askNote("what to change"); });
  await p.waitForSelector("#noteText", { state: "visible" });
  const before = await p.evaluate(() => ({ t, playing, marking, draw: !!(typeof DRAWM !== "undefined" && DRAWM.on), picker: document.getElementById("picker").hidden }));
  await p.type("#noteText", "move the orb 2 blocks right, more room please. dim the fog 1 more", { delay: 5 });
  await p.keyboard.type(" r m");
  const after = await p.evaluate(() => ({ t, playing, marking, draw: !!(typeof DRAWM !== "undefined" && DRAWM.on), picker: document.getElementById("picker").hidden, text: document.getElementById("noteText").value }));
  check(after.playing === before.playing && Math.abs(after.t - before.t) < 1e-6, `the replay stays put while typing (t ${before.t} -> ${after.t}, playing ${after.playing})`);
  check(after.marking === before.marking && after.draw === before.draw && after.picker === before.picker, "mark mode, draw mode and the picker stay as they were");
  check(/more room please/.test(after.text) && / r m$/.test(after.text), "the text itself is typed: " + JSON.stringify(after.text.slice(-24)));
  // cancel and Escape close the box, also while the replay plays
  await p.click("#noteCancel"); check(await p.evaluate(() => document.getElementById("noteBox").hidden), "cancel closes the note box");
  await p.evaluate(() => { playing = true; setPlay(); askNote("again"); }); await p.waitForSelector("#noteText", { state: "visible" });
  await p.keyboard.type("a b"); await p.keyboard.press("Escape"); await p.waitForTimeout(100);
  check(await p.evaluate(() => document.getElementById("noteBox").hidden), "Escape closes it while the replay plays");
  // a note pinned at a spot (the mark flow): after save the box is gone from the screen, not just flagged hidden (its
  // display:block kept it up with dead buttons: the user, 2026-11-25 "cancel doesnt work after i save mark")
  await p.route("**/marks", r => r.request().method() === "POST" ? r.fulfill({ status: 200, body: "{}" }) : r.continue());
  const gone = () => p.evaluate(() => getComputedStyle(document.getElementById("noteBox")).display === "none");
  await p.keyboard.press("m"); const bb = await (await p.$("#cv")).boundingBox(); await p.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2);
  await p.waitForSelector("#noteText", { state: "visible" }); await p.type("#noteText", "test-note"); await p.click("#noteSave"); await p.waitForTimeout(200);
  check(await gone(), "a pinned mark box is off the screen after save");
  await p.keyboard.press("m"); await p.mouse.click(bb.x + bb.width / 3, bb.y + bb.height / 2);
  check(await p.evaluate(() => !document.getElementById("noteBox").hidden), "the next mark opens its box (nothing invisible over the level)");
  await p.click("#noteCancel"); await p.waitForTimeout(100); check(await gone(), "and cancel closes it");
  await b.close(); srv.kill();
  console.log(fails ? fails + " failed" : "all ok"); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); srv.kill(); process.exit(1); });
