// node tests/end_screen.js  -- a cleared level ends as in the game (viewer/index.html endFx, VISUALS.md "The end"): playing on
// past the clear for END_LEN seconds (the wall, the pull-in, LEVEL COMPLETE and the card), then stopping; no page errors.
// Headless Chromium (playwright), muted, from disk. The user, 2026-11-25, on the Jumper video: "no end screen like in the
// real game, it just falls on the ground".
const path = require("path");
let chromium; try { ({ chromium } = require("playwright")); } catch (e) { console.log("skip: no playwright"); process.exit(0); }
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1280, height: 720 } }), errs = [];
  p.on("pageerror", e => errs.push(e.message));
  await p.goto("file://" + path.join(__dirname, "..", "viewer", "index.html") + "?mute=1#lv=gdlm_02_on_the_beat.gdlvl");
  await p.waitForFunction(() => typeof L !== "undefined" && L && L.path && L.path.length > 100 && L.sol && L.sol.ok, null, { timeout: 120e3 }).catch(() => {});
  const r = await p.evaluate(async () => {
    const end = (L.path.length - 1) / P.TPS, last = L.path[L.path.length - 1]; t = end - 0.3; playing = true;
    await new Promise(q => setTimeout(q, 2000)); const mid = playing;
    await new Promise(q => setTimeout(q, 4000));
    return { endT: endTime(), end, ghostAfter: !!last.ghost, mid, stopped: !playing, past: t - end, stats: endStats() };
  });
  await b.close();
  const fails = [];
  if (r.endT == null) fails.push("the route's clear was not found (endTime null)");
  if (r.ghostAfter) fails.push("a ghost runs on after the clear");
  if (!r.mid) fails.push("playback stopped at the clear instead of playing the end");
  if (!r.stopped || r.past < 4) fails.push(`playback did not stop after the end (${r.past.toFixed(2)} s past)`);
  if (!(r.stats && r.stats.jumps > 0)) fails.push("no jumps on the card");
  if (errs.length) fails.push("page errors: " + errs.join("; "));
  console.log(fails.length ? fails.map(f => "FAIL " + f).join("\n") : `ok: end plays ${r.past.toFixed(1)} s past the clear, card ${JSON.stringify(r.stats)}`);
  process.exit(fails.length ? 1 : 0);
})();
