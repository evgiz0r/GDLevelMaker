// node tools/perf.js <level file as the viewer lists it> [--at 5] [--secs 8] [--size 1920x1080] [--port 8767]
// The viewer's playback speed with real animation frames: headless Edge plays the level from --at for --secs
// seconds in each setup (GD art + beats, shapes + beats, light = no art, no beats) through the viewer's
// ?perf= mode, which posts frame and draw times to local/perf/. Prints fps, frame time percentiles (p50/p90/
// p99, frames over 33 ms), draw() time and the JS heap. The level is named as the viewer's #lv= does:
// levels/gdlm_45_first_flight.gdlvl, local/wip/style/gdlm_45_first_flight.gdlvl, ...
// Headless runs without a GPU (software canvas): absolute numbers are a worst case; compare setups, and read the
// real numbers in the user's browser with key F. One heavy job at a time (a browser, ~0.5-1 GB).
// VISUALS.md "Viewer speed".
const fs = require("fs"), path = require("path"), { headless } = require("./headless.js");
const args = process.argv.slice(2), opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const lv = args[0];
if (!lv || lv.startsWith("--")) { console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n")); process.exit(1); }
require("./heavy.js").claim();
const [w, h] = opt("--size", "1920x1080").split("x").map(Number), secs = +opt("--secs", 8), at = +opt("--at", 5), port = +opt("--port", 8767);
const SETUPS = [["GD art + beats", { art: 1, beats: 1 }], ["shapes + beats", { art: 0, beats: 1 }], ["light", { light: 1 }]];
(async () => {
  const dir = path.join(__dirname, "..", "local", "perf"); fs.mkdirSync(dir, { recursive: true });
  const rows = [];
  for (const [name, o] of SETUPS) {
    const id = "p" + Date.now().toString(36), q = Object.entries(o).map(([k, v]) => `${k}=${v}`).join("&");
    const r = await headless(`viewer/?perf=${id}&secs=${secs}&${q}#lv=${encodeURIComponent(lv)}&t=${at}`, path.join(dir, id + ".json"), { port, width: w, height: h, timeoutMs: (secs + 90) * 1000 });
    let d = null; try { d = JSON.parse(fs.readFileSync(path.join(dir, id + ".json"), "utf8")); } catch (e) {}
    rows.push([name, d, r]);
    console.log(d ? `${name.padEnd(16)} ${String(d.fps).padStart(5)} fps  frame p50 ${d.frame.p50} p90 ${d.frame.p90} p99 ${d.frame.p99} ms, ${d.frame.over33} over 33 ms  draw p50 ${d.draw.p50} p90 ${d.draw.p90} ms  heap ${d.heapMB} MB  (${d.W}x${d.H}, ${d.objects} objects)`
      : `${name.padEnd(16)} no result${r.ok ? "" : " (timed out)"}`);
  }
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
