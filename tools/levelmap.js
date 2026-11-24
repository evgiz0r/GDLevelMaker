// node tools/levelmap.js <level> [--shapes] [--rows N] [--scale px-per-unit] [--brief briefs/NN.json] [--name n] [--port 8767]
//
// The whole level as ONE picture with its intended path: the level cut into stacked rows (phone-
// friendly), drawn as GD draws it (GD art; --shapes for the shape drawing), each part at the moment the
// player passes it (colour triggers, moved objects), with the replayed path over it -- coloured by mode,
// a dot at each press, a hollow square where a hold is released, a yellow diamond at each orb / pad,
// portals named at the top of the row, seconds and % ticks under it, section names (from the spec's
// "sections" or a level's brief, when given), and a red X where a run the sim cannot finish stops.
//   <level>  as tools/shoot.js: a .gdlvl, local/official_NN.json, official:N, save:<name>
// Uses the saved solution (tools/solutions.js; the natural replay when the level has one); else the
// page solves it. Writes local/maps/<name>.png (full) and <name>.jpg (phone: <= 1600 px wide, ~1 MB),
// both never committed (GD art is RobTop's; official levels are RobTop's). The viewer's "level map"
// button opens local/maps/<file name>.jpg. Shapes maps (--shapes) are art-free: <name>_shapes.*
// VISUALS.md "Level map".
if (require.main === module) require("./heavy.js").claim();   // one heavy job at a time (tools/heavy.js)
const fs = require("fs"), path = require("path"), cp = require("child_process");
const ROOT = path.join(__dirname, ".."), { headless } = require("./headless.js"), { levelOf } = require("./shoot.js");
const args = process.argv.slice(2), opt = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
if (!args[0] || args[0].startsWith("--")) { console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n")); process.exit(1); }

(async () => {
  const lv = levelOf(args[0]);
  // only a solution made on today's physics: a stale one can die where the game would not (GDLM 45's wave)
  if (!lv.solution || lv.official === undefined) { try { const s = require("./solutions.js").get(lv.levelStr); if (s && s.events) lv.solution = s; else if (!/official/.test(args[0])) lv.solution = null; } catch (e) {} }
  if (!lv.solution) console.log("(no saved solution: the page solves it; for long levels run node tools/solutions.js <level> first)");
  let sections = null;
  if (opt("--spec")) {
    const sp = JSON.parse(fs.readFileSync(opt("--spec"), "utf8"));
    sections = (sp.sections || []).filter(s => s.name && typeof s.from === "number").map(s => ({ from: s.from, name: s.name }));
  }
  // a brief's sections (briefs/NN.json): {name, blocks} add up; {name, beats: "a-b" | n} sit on the song's
  // beat grid (brief.grid / offset, 1x speed) the way tools/compose.js lays them out
  if (opt("--brief")) {
    const br = JSON.parse(fs.readFileSync(opt("--brief"), "utf8")), SY = require("../lib/sync.js"), PH = require("../lib/physics.js");
    const sp = { "0.5x": 0, "1x": 1, "2x": 2, "3x": 3, "4x": 4 }[br.speed || "1x"] ?? 1, ups = PH.SPEEDS[sp].x * 60;
    let grid = null;
    if (br.grid) { const per = br.grid.period || 60 / br.grid.bpm; grid = { period: per, t0: br.grid.t0 || 0 }; }
    const colOfBeat = b => grid ? (SY.SYNC.beatToTime(grid, br.offset || 0, b) * ups - 15) / 30 : null;
    let col = 0, beat = 1;
    sections = [];
    for (const sc of br.sections || []) {
      let from = col;
      if (sc.beats !== undefined) {
        const a = typeof sc.beats === "string" ? +String(sc.beats).split("-")[0] : beat;
        if (typeof sc.beats === "number") beat += sc.beats; else beat = +String(sc.beats).split("-")[1] || beat;
        const c = colOfBeat(a); if (c === null) continue; from = c;
        col = colOfBeat(beat);
      } else col += sc.blocks || 0;
      sections.push({ from, name: sc.name });
    }
  }
  const shapes = args.includes("--shapes");
  const id = "m" + Date.now().toString(36), dir = path.join(ROOT, "local", "shoot");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, id + ".json"), JSON.stringify({ level: lv, times: [0], map: true, ghost: false, art: !shapes,
    rows: +(opt("--rows") || 0) || null, scale: +(opt("--scale") || 0) || null, sections }));
  const r = await headless(`viewer/?shoot=${id}`, path.join(dir, id, ".done"), { port: +(opt("--port") || 8767), timeoutMs: 15 * 60e3 });
  const src = path.join(dir, id, "000.png");
  if (!fs.existsSync(src)) { console.log("no map made" + (r.ok ? "" : " (timed out)")); process.exit(1); }
  // official:N -> official_NN_<name> (as local/official_NN.json maps were named), lower case
  const offN = /^official:(\d+)$/.exec(args[0]) || /official_(\d+)\.json$/.exec(args[0]);
  const base = offN ? `official_${String(+offN[1]).padStart(2, "0")}_${String(lv.name || "").toLowerCase()}` : path.basename(args[0]).replace(/\.(gdlvl|json)$/, "").replace(/^save:/, "");
  const safe = (opt("--name") || base).replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_") + (shapes ? "_shapes" : "");
  const out = path.join(ROOT, "local", "maps"); fs.mkdirSync(out, { recursive: true });
  const png = path.join(out, safe + ".png"), jpg = path.join(out, safe + ".jpg");
  fs.copyFileSync(src, png);
  try { cp.execFileSync("ffmpeg", ["-v", "error", "-y", "-i", png, "-vf", "scale='min(1600,iw)':-2", "-q:v", "3", jpg], { windowsHide: true }); } catch (e) { console.log("(ffmpeg missing: no phone .jpg)"); }
  try { fs.rmSync(path.join(dir, id), { recursive: true, force: true }); fs.unlinkSync(path.join(dir, id + ".json")); } catch (e) {}
  const mb = f => fs.existsSync(f) ? (fs.statSync(f).size / 1e6).toFixed(1) + " MB" : "-";
  console.log(`map of ${lv.name} in ${r.seconds.toFixed(0)} s:\n  ${path.relative(ROOT, png)} (${mb(png)})\n  ${path.relative(ROOT, jpg)} (${mb(jpg)}, phone)`);
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
