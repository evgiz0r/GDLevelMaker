// node tools/shoot.js <level> [--at 2,5.5,10 | --every 2] [--rec <video> --t0 <s>] [--out <dir>] [--shapes] [--hitboxes] [--input] [--port 8767]
//
// Pictures of a level as GD draws it (the viewer's "GD art", lib/art.js), with no browser to drive:
// headless Edge renders 1920x1080 frames at the given level times (seconds) into local/shots/<level>/
// (never committed: RobTop's art). For sessions that decorate: look at your level, then Read the PNGs.
//   <level>     a .gdlvl (levels/, local/wip/<session>/, examples/), local/official_NN.json, "official:9",
//               or "save:<name>" -- a level from the user's own save (CCLocalLevels.dat, read only),
//               e.g. "save:GDLM 41 classic": what is really installed, not the repo's copy
//   --at        level times in seconds (default: every 2 s through the level, at most 30 frames)
//   --rec, --t0 a recording in ~/Videos/Captures and the video second where this attempt starts:
//               each frame becomes render | game side by side (VISUALS.md "Facts" for how to find t0)
//   --shapes    the shape drawing instead of GD art; --hitboxes overlays hitboxes
//   --input     the viewer's button strip under the ground: presses, holds, each input's timing window
// Uses a saved solution when there is one (tools/solutions.js); otherwise the page solves the level.
// One heavy job at a time (a headless browser with the sheets is ~1 GB).
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, ".."), { headless } = require("./headless.js"), { readGdlvl } = require("./io.js");
const args = process.argv.slice(2), opt = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const what = args[0];
if (require.main === module && (!what || what.startsWith("--"))) { console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n")); process.exit(1); }

function levelOf(w) {
  let m;
  if ((m = /^official:(\d+)$/.exec(w))) w = path.join(ROOT, "local", `official_${String(+m[1]).padStart(2, "0")}.json`);
  if ((m = /^save:(.+)$/.exec(w))) {
    const all = require("./corpus.js").mine(), want = m[1].toLowerCase();
    const hit = all.find(l => l.short.toLowerCase() === want) || all.find(l => l.short.toLowerCase().includes(want));
    if (!hit) throw new Error("no level like '" + m[1] + "' in the save; there are: " + all.map(l => l.short).slice(0, 20).join(", "));
    return { name: hit.short, levelStr: hit.levelStr };
  }
  if (/\.json$/.test(w)) { const j = JSON.parse(fs.readFileSync(w, "utf8")); return { name: j.name, levelStr: j.level, solution: j.solution && j.solution.events ? j.solution : null }; }
  const L = readGdlvl(w);
  return { name: L.name, levelStr: L.levelStr };
}
module.exports = { levelOf };
if (require.main === module) (async () => {
  const lv = levelOf(what);
  if (!lv.solution) {
    try { const s = require("./solutions.js").get(lv.levelStr, true); if (s && s.events) lv.solution = s; } catch (e) {}
  }
  // the level's length in seconds, roughly, for the default times (the page clamps to the real end)
  const lenS = (() => { const P = require("../lib/physics.js"); const xs = require("../lib/gd.js").parseLevel(lv.levelStr).objects.map(o => o.x); return Math.max(2, Math.max(...xs) / ((P.PHYS || P).SPEED || 311.58)); })();
  let times;
  if (opt("--at")) times = opt("--at").split(",").map(Number).filter(isFinite);
  else { const step = +(opt("--every") || 2); times = []; for (let s = 0; s <= lenS && times.length < 30; s += step) times.push(+s.toFixed(2)); }
  const id = "j" + Date.now().toString(36);
  const dir = path.join(ROOT, "local", "shoot"); fs.mkdirSync(dir, { recursive: true });
  const job = { level: lv, times, art: !args.includes("--shapes"), hitboxes: args.includes("--hitboxes"), input: args.includes("--input"), rec: opt("--rec"), t0: +(opt("--t0") || 0) };
  fs.writeFileSync(path.join(dir, id + ".json"), JSON.stringify(job));
  if (!lv.solution) console.log("(no saved solution: the page solves it, which can take a while for long levels)");
  const r = await headless(`viewer/?shoot=${id}`, path.join(dir, id, ".done"), { port: +(opt("--port") || 8767) });
  const safe = lv.name.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_") || "level";
  const out = opt("--out") || path.join(ROOT, "local", "shots", safe);
  fs.mkdirSync(out, { recursive: true });
  const files = [];
  for (let i = 0; i < times.length; i++) {
    const src = path.join(dir, id, String(i).padStart(3, "0") + ".png");
    if (!fs.existsSync(src)) continue;
    const dst = path.join(out, `${job.rec ? "cmp_" : ""}t${times[i].toFixed(2).padStart(6, "0")}.png`);
    fs.copyFileSync(src, dst); files.push(path.relative(ROOT, dst));
  }
  try { fs.rmSync(path.join(dir, id), { recursive: true, force: true }); fs.unlinkSync(path.join(dir, id + ".json")); } catch (e) {}
  console.log(r.ok ? `${files.length} frames in ${r.seconds.toFixed(0)} s:` : `timed out after ${r.seconds.toFixed(0)} s; got ${files.length} frames:`);
  for (const f of files) console.log("  " + f);
  process.exit(r.ok ? 0 : 1);
})().catch(e => { console.error(e.message); process.exit(1); });
