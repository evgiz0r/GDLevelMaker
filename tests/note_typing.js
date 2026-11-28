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
  // the marks bar (CALM MARKS, 2026-11-28: no mark mode, no box over the level): a tap on the level pins a note, the note is
  // typed in the bar above the level; the replay keys typed there do nothing, the level does not move, Enter closes it
  await p.route("**/marks", r => r.request().method() === "POST" ? r.fulfill({ status: 200, body: "{}" }) : r.continue());
  const bb = await (await p.$("#cv")).boundingBox();
  await p.evaluate(() => { playing = true; setPlay(); }); await p.waitForTimeout(300);
  await p.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2); await p.waitForTimeout(100);
  const m0 = await p.evaluate(() => ({ t, playing, edit: !!MK.edit, focus: document.activeElement && document.activeElement.id, top: document.getElementById("cv").getBoundingClientRect().top }));
  check(m0.edit && !m0.playing && m0.focus === "mkNote", "a tap on the level pauses where it is and opens the note in the marks bar");
  await p.keyboard.type("test-note r m p d l f 1 2 "); await p.waitForTimeout(900);
  const m1 = await p.evaluate(() => ({ t, playing, draw: !!(typeof DRAWM !== "undefined" && DRAWM.on), picker: document.getElementById("picker").hidden, note: MK.edit && MK.edit.note, st: document.getElementById("mkSt").textContent, top: document.getElementById("cv").getBoundingClientRect().top }));
  check(Math.abs(m1.t - m0.t) < 1e-6 && !m1.playing && !m1.draw && m1.picker, "typing the note leaves the replay, draw mode and the picker alone");
  check(m1.top === m0.top, `the level does not move while a note is typed (top ${m0.top} -> ${m1.top})`);
  check(/^test-note r m/.test(m1.note || "") && /saved/.test(m1.st), "the note is kept and saved as it is typed: " + JSON.stringify(m1.st));
  await p.keyboard.press("Enter"); await p.waitForTimeout(100);
  check(await p.evaluate(() => !MK.edit && levelMarks().some(m => m.note.startsWith("test-note"))), "Enter closes the note, the mark stays");
  const n0 = await p.evaluate(() => levelMarks().length);
  await p.mouse.click(bb.x + bb.width / 3, bb.y + bb.height / 3); await p.keyboard.press("Escape"); await p.waitForTimeout(100);
  check(await p.evaluate(n => !MK.edit && levelMarks().length === n, n0), "an empty pin closed with Escape is dropped");
  await b.close(); srv.kill();
  console.log(fails ? fails + " failed" : "all ok"); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); srv.kill(); process.exit(1); });
