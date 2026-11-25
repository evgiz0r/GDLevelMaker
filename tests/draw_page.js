// node tests/draw_page.js [--shots <dir>]  -- the whiteboard (viewer/draw.html, DRAW.md) headless at phone and PC size:
// it loads with no errors, a drawn sketch converts (ground, area, spikes, orb, deco, a prop), the "level" view and the deco
// toggle draw, ✓ check replays the jump marks and the solver (in its Worker) answers, 🎮 plays. The pages are served
// from disk by Playwright itself (a Worker cannot start from file://), muted (no song is loaded).
const { chromium } = require("playwright"), fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, ".."), si = process.argv.indexOf("--shots"), SHOTS = si > 0 ? process.argv[si + 1] : null;
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json" };
let fail = 0; const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) fail++; };

(async () => {
  const b = await chromium.launch();
  for (const [w, h, tag] of [[390, 800, "phone"], [1200, 650, "pc"]]) {
    const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    await p.route("http://draw.test/**", r => {
      const f = path.join(ROOT, decodeURIComponent(new URL(r.request().url()).pathname));
      if (!f.startsWith(ROOT) || !fs.existsSync(f)) return r.fulfill({ status: 404, body: "" });
      r.fulfill({ status: 200, body: fs.readFileSync(f), contentType: TYPES[path.extname(f)] || "application/octet-stream" });
    });
    const errs = []; p.on("pageerror", e => errs.push(e.message));
    await p.goto("http://draw.test/viewer/draw.html"); await p.waitForTimeout(300);
    // a real stroke with the pointer
    const box = await p.locator("#cv").boundingBox(), V = await p.evaluate(() => ({ x: DRAW.V.x, y: DRAW.V.y, z: DRAW.V.z }));
    const X = x => box.x + (x - V.x) * V.z, Y = y => box.y + box.height - (y - V.y) * V.z;
    await p.evaluate(() => { DRAW.ui.tool = "pen"; DRAW.ui.pen = "ground"; });
    await p.mouse.move(X(120), Y(0)); await p.mouse.down();
    for (const [x, y] of [[150, 20], [200, 50], [260, 60], [300, 20], [330, 0]]) await p.mouse.move(X(x), Y(y), { steps: 4 });
    await p.mouse.up();
    ok(await p.evaluate(() => DRAW.sketch.items.length === 1 && DRAW.sketch.items[0].pen === "ground"), tag + ": a finger stroke becomes a ground line");
    // the ✨ one pen: a line through the air becomes a corridor with its holds (lib/intent.js, DRAW.md "One pen")
    const keep = await p.evaluate(() => JSON.stringify(DRAW.sketch.items)); await p.evaluate(() => { DRAW.ui.pen = "auto"; DRAW.setItems([]); });
    const a0 = V.x + 0.05 * box.width / V.z, a1 = V.x + 0.95 * box.width / V.z, st = (a1 - a0) / 20;   // across what is on screen
    await p.mouse.move(X(a0), Y(15)); await p.mouse.down();
    for (let x = a0 + st; x <= a1; x += st) await p.mouse.move(X(x), Y(110 + 30 * Math.sin((x - a0) / 120)), { steps: 2 });
    await p.mouse.up(); await p.waitForFunction(() => DRAW.sketch.items.some(i => i.pen === "auto" && i.built), null, { timeout: 15000 }).catch(() => {});
    if (process.env.DBG) console.log(await p.evaluate(() => JSON.stringify([DRAW.V, document.getElementById("msg").textContent, DRAW.sketch.items.map(i => [i.k, i.pen, i.pts && i.pts.length, i.built && i.built.length])])));
    ok(await p.evaluate(() => DRAW.sketch.items.some(i => i.pen === "auto" && i.built && i.built.length > 20) && DRAW.sketch.items.some(i => i.k === "press")), tag + ": a ✨ line through the air becomes a corridor with presses");
    await p.evaluate(k => DRAW.setItems(JSON.parse(k)), keep);
    await p.evaluate(() => DRAW.setItems(DRAW.sketch.items.concat([
      { k: "stroke", pen: "spikes", pts: [[500, 0], [500, 30], [590, 30], [590, 0], [502, 1]] },
      { k: "stamp", what: "orb:yellow", x: 760, y: 70 }, { k: "stroke", pen: "spikes", pts: [[700, 0], [820, 0]] },
      { k: "press", x: 300, y: 80 }, { k: "press", x: 740, y: 60 },
      { k: "stroke", pen: "deco", col: [255, 90, 90], w: 7, pts: [[0, 200], [300, 260], [600, 210]] },
      { k: "stamp", what: "prop:tree", x: 420, y: 0 } ])));
    const c = await p.evaluate(() => DRAW.convert().counts);
    ok(c.solids > 3 && c.spikes >= 6 && c.deco > 30, `${tag}: converts (${JSON.stringify(c)})`);
    await p.click("#viewBtn"); await p.waitForTimeout(150); if (SHOTS) await p.screenshot({ path: path.join(SHOTS, `draw_${tag}_level.png`) });
    await p.click("#decoBtn"); await p.waitForTimeout(100);
    ok(await p.evaluate(() => !DRAW.ui.deco), tag + ": deco hidden");
    await p.click("#decoBtn");
    // the seek strip: a tap far right moves the board there, far left back to the start
    const x0 = await p.evaluate(() => DRAW.V.x);
    await p.mouse.click(box.x + box.width - 5, box.y + 10); const xr = await p.evaluate(() => DRAW.V.x);
    await p.mouse.click(box.x + 2, box.y + 10); const xl = await p.evaluate(() => DRAW.V.x);
    ok(xr > x0 + 300 && xl < xr - 300, `${tag}: the seek strip moves back and forth (${Math.round(x0)} -> ${Math.round(xr)} -> ${Math.round(xl)})`);
    // the ruler under the strip puts the song's time (the yellow marker) where it is tapped
    await p.mouse.click(box.x + box.width * 0.9, box.y + 36);
    const ph = await p.evaluate(() => ({ x: DRAW.listen.x, kept: DRAW.listen.kept, }));
    const want = await p.evaluate(w => DRAW.V.x + w * 0.9 / DRAW.V.z, box.width);
    ok(ph.kept && Math.abs(ph.x - Math.max(0, want)) < 5, `${tag}: a tap on the ruler moves the song marker (${Math.round(ph.x)} vs ${Math.round(want)})`);
    await p.click("#checkBtn");
    await p.waitForFunction(() => !/looking/.test(document.getElementById("msg").textContent), null, { timeout: 30000 }).catch(() => {});
    const m = await p.locator("#msg").textContent();
    ok(/your jumps/.test(m) && /(beatable|no way through)/.test(m), tag + ": check says " + JSON.stringify(m));
    if (SHOTS) await p.screenshot({ path: path.join(SHOTS, `draw_${tag}_check.png`) });
    // 🧩 layout: the fitter in the worker, the fitted level shown, its changes listed
    await p.click("#fitBtn");
    await p.waitForFunction(() => DRAW.fit && DRAW.fit.changes, null, { timeout: 30000 }).catch(() => {});
    const fl = await p.evaluate(() => ({ n: DRAW.fit && DRAW.fit.changes ? DRAW.fit.changes.length : -1, list: !document.getElementById("fitList").hidden, clear: DRAW.fit && DRAW.fit.clear }));
    ok(fl.n >= 0 && fl.list, `${tag}: 🧩 layout fits the drawing (${fl.clear ? "clears" : "stops"}, ${fl.n} changes listed)`);
    if (SHOTS) await p.screenshot({ path: path.join(SHOTS, `draw_${tag}_layout.png`) });
    await p.click("#fitBtn");
    await p.click("#playBtn"); await p.waitForTimeout(600);
    ok(await p.evaluate(() => /■/.test(document.getElementById("playBtn").textContent)), tag + ": 🎮 plays");
    await p.keyboard.press("Escape");
    const top = await p.evaluate(() => Math.max(...[...document.querySelectorAll("header button, header select")].filter(e => e.offsetParent).map(e => e.getBoundingClientRect().bottom)));
    ok(top <= document_h(h), `${tag}: controls stay in the top bar (lowest at ${Math.round(top)} px)`);
    ok(!errs.length, tag + ": no page errors " + (errs.length ? JSON.stringify(errs) : ""));
    await p.close();
  }
  await b.close();
  console.log(fail ? fail + " failed" : "all ok"); process.exit(fail ? 1 : 0);
})();
function document_h(h) { return h * 0.4; }
