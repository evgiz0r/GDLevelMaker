// node tests/viewer_draw.js [--shots <dir>]  -- ✏ draw in the viewer (DRAW.md "In the viewer"), headless at phone and PC
// size, muted (test=1): the board opens as a see-through layer over the viewer's canvas, a drawn sketch becomes the viewer's
// level (🧩 layout on by default), the viewer's camera follows the board's (a block on the board lands on the same pixel in
// the viewer), ▶ leaves draw mode and replays it in the viewer, 🎮 plays it there, ✏ draw goes back.
const { chromium } = require("playwright"), fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, ".."), si = process.argv.indexOf("--shots"), SHOTS = si > 0 ? process.argv[si + 1] : null;
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json" };
let fail = 0; const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) fail++; };

(async () => {
  const b = await chromium.launch();
  for (const [w, h, tag] of [[390, 800, "phone"], [1280, 760, "pc"]]) {
    const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    await p.route("http://draw.test/**", r => {
      const f = path.join(ROOT, decodeURIComponent(new URL(r.request().url()).pathname));
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status: 404, body: "" });
      r.fulfill({ status: 200, body: fs.readFileSync(f), contentType: TYPES[path.extname(f)] || "application/octet-stream" });
    });
    const errs = []; p.on("pageerror", e => errs.push(e.message));
    await p.goto("http://draw.test/viewer/index.html?test=1"); await p.waitForTimeout(800);
    await p.click("#drawBtn"); await p.waitForTimeout(800);
    const fr = p.frameLocator("#drawFrame"), frame = p.frame({ url: /draw\.html/ });
    ok(!!frame && await frame.evaluate(() => !!window.DRAW && document.documentElement.classList.contains("embed")), tag + ": ✏ draw opens the board over the canvas");
    await frame.evaluate(() => DRAW.setItems([
      { k: "stroke", pen: "ground", pts: [[200, 0], [260, 30], [420, 30], [480, 0]] },
      { k: "stroke", pen: "spikes", pts: [[640, 0], [700, 0]] }, { k: "press", x: 600, y: 60 },
      { k: "stamp", what: "orb:yellow", x: 900, y: 90 }, { k: "press", x: 890, y: 90 } ]));
    await p.waitForFunction(() => typeof L !== "undefined" && L && /^✏ /.test(L.name) && L.level.objects.length > 3, null, { timeout: 30000 }).catch(() => {});
    const lv = await p.evaluate(() => typeof L !== "undefined" && L ? { name: L.name, n: L.level.objects.length, plan: !!L.sol.planReplay } : null);
    ok(lv && lv.n > 3 && lv.plan, `${tag}: the sketch is the viewer's level (${JSON.stringify(lv)})`);
    // the same world point on both canvases
    const a = await frame.evaluate(() => { const r = document.getElementById("cv").getBoundingClientRect(), q = DRAW.toScreen(600, 30); return [q[0] + r.left, q[1] + r.top]; });
    const fb = await p.locator("#drawFrame").boundingBox(), cb = await p.locator("#cv").boundingBox();
    const v = await p.evaluate(() => { const d = Math.min(2, devicePixelRatio || 1); return [sx(600) / d, sy(30) / d]; });
    const dx = a[0] + fb.x - (v[0] + cb.x), dy = a[1] + fb.y - (v[1] + cb.y);
    ok(Math.abs(dx) < 1.5 && Math.abs(dy) < 1.5, `${tag}: the viewer's camera is the board's (off by ${dx.toFixed(1)}, ${dy.toFixed(1)} px)`);
    await frame.evaluate(() => { DRAW.V.x += 200; DRAW.V.z *= 1.3; }); await frame.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    await frame.evaluate(() => { window.__d = 1; }); await p.waitForTimeout(100);
    if (SHOTS) await p.screenshot({ path: path.join(SHOTS, `viewer_draw_${tag}.png`) });
    // ▶ on the board: replay in the viewer
    await fr.locator("#replayBtn").click(); await p.waitForTimeout(600);
    const rp = await p.evaluate(() => ({ hidden: document.getElementById("drawFrame").hidden, playing, t, cam: MAPCAM }));
    ok(rp.hidden && rp.playing && rp.t > 0 && !rp.cam, `${tag}: ▶ replays it in the viewer (t ${rp.t.toFixed(2)} s)`);
    if (SHOTS) await p.screenshot({ path: path.join(SHOTS, `viewer_draw_${tag}_replay.png`) });
    await p.click("#drawBtn"); await p.waitForTimeout(300);
    ok(await p.evaluate(() => !document.getElementById("drawFrame").hidden && !!MAPCAM), tag + ": ✏ draw goes back to the drawing");
    await fr.locator("#playBtn").click(); await p.waitForTimeout(500);
    ok(await p.evaluate(() => PLAY.on && document.getElementById("drawFrame").hidden), tag + ": 🎮 plays it in the viewer");
    await p.keyboard.press("Space"); await p.waitForTimeout(300);
    ok(!errs.length, tag + ": no page errors" + (errs.length ? " " + errs.slice(0, 3).join(" | ") : ""));
    await p.close();
  }
  await b.close();
  console.log(fail ? fail + " FAILED" : "all ok"); process.exit(fail ? 1 : 0);
})();
