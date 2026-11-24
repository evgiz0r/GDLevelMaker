// node tools/compare_frames.js <ours.gdlvl | official:N | c<id>> <ref.gdlvl | official:N | c<id> | <id>> [--at "pct:10,30,50,70,90" | --at "s:5,12"]
//                              [--ref-at ...] [--layers] [--deco-only] [--shapes] [--out local/compare/<name>]
// Our level and a reference side by side at matching spots, for judging design and deco by picture (the art session's
// deco study): one PNG per spot, 1600x450 -- ours left, the reference right, both 800x450 in the game look with GD's own
// art at the same zoom -- each frame labelled with its level, time, % and objects per block in view, and how many 2.2
// deco objects are drawn without their child sprites (our tables have only their root sprite: such a reference looks
// barer than it is). --at: spots as % of each level's length (default pct:10,30,50,70,90) or seconds; --ref-at: other
// spots for the reference (default: the same). --layers: every object in view as a box coloured by its z-layer (B5..T4,
// legend at the bottom); --deco-only: decoration only (no blocks, hazards, orbs, pads, portals, player).
// A bare number as the reference is a community level id (local/community/<id>.gdlvl, the study's levels).
// Writes local/compare/<ours>_vs_<ref>/<spot>.png (local only: RobTop's art). One heavy job (headless browser).
const fs = require("fs"), path = require("path"), cp = require("child_process");
const ROOT = path.join(__dirname, ".."), { headless } = require("./headless.js"), { levelOf } = require("./shoot.js");
const args = process.argv.slice(2), opt = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
if (require.main === module && (args.length < 2 || args[0].startsWith("--"))) { console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n")); process.exit(1); }

function resolve(w) {
  if (/^\d+$/.test(w)) w = path.join(ROOT, "local", "community", w + ".gdlvl");
  else if (/^c\d+$/.test(w)) w = path.join(ROOT, "local", "community", w.slice(1) + ".gdlvl");
  const lv = levelOf(w);
  if (!lv.solution) try { const s = require("./solutions.js").get(lv.levelStr, true); if (s && s.events) lv.solution = s; } catch (e) {}
  // no saved route: never solve in the page (a big 2.2 level hung the render for its 10 min, Brave Blue 2026-11-24): the
  // camera runs through it at the level's speed (the page's ghost), which is all a deco picture needs
  if (!lv.solution) lv.solution = { ok: false, events: [], why: "not solved: the camera runs at the level's speed", pending: true };
  return lv;
}
function spots(spec) {
  const m = /^(pct|s):(.+)$/.exec(spec || "pct:10,30,50,70,90"); if (!m) throw new Error("--at pct:10,30 or s:5,12");
  const v = m[2].split(",").map(Number).filter(isFinite); return m[1] === "pct" ? { pcts: v } : { times: v };
}
// one headless render of a level at its spots, 800x450 each; the frames' paths in order
async function render(lv, sp, flags, port) {
  const id = "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), dir = path.join(ROOT, "local", "shoot");
  fs.mkdirSync(dir, { recursive: true });
  const job = Object.assign({ level: lv, art: !flags.shapes, width: 800, height: 450, label: lv.name, layers: flags.layers, decoOnly: flags.decoOnly, times: sp.times || [0] }, sp.pcts ? { pcts: sp.pcts } : {});
  fs.writeFileSync(path.join(dir, id + ".json"), JSON.stringify(job));
  const r = await headless(`viewer/?shoot=${id}`, path.join(dir, id, ".done"), { port, width: 800, height: 450, timeoutMs: 10 * 60e3, stallMs: 4 * 60e3 });
  const n = (sp.pcts || sp.times).length, out = [];
  for (let i = 0; i < n; i++) { const f = path.join(dir, id, String(i).padStart(3, "0") + ".png"); out.push(fs.existsSync(f) ? f : null); }
  return { files: out, cleanup: () => { try { fs.rmSync(path.join(dir, id), { recursive: true, force: true }); fs.unlinkSync(path.join(dir, id + ".json")); } catch (e) {} }, ok: r.ok };
}
// a PNG's pixels as data: URLs carry base64 PNG; save them as files (the shoot endpoint already writes PNG files)
module.exports = { spots };
if (require.main === module) (async () => {
  const ours = resolve(args[0]), ref = resolve(args[1]);   // the inputs first: a wrong path fails before queueing
  await require("./heavy.js").claim();   // one heavy job at a time (tools/heavy.js)
  const flags = { layers: args.includes("--layers"), decoOnly: args.includes("--deco-only"), shapes: args.includes("--shapes") };
  const spO = spots(opt("--at")), spR = opt("--ref-at") ? spots(opt("--ref-at")) : spO;
  if ((spO.pcts || spO.times).length !== (spR.pcts || spR.times).length) throw new Error("--at and --ref-at need the same number of spots");
  const safe = s => s.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_");
  const out = opt("--out") ? path.resolve(opt("--out")) : path.join(ROOT, "local", "compare", `${safe(ours.name)}_vs_${safe(ref.name)}` + (flags.layers ? "_layers" : "") + (flags.decoOnly ? "_deco" : ""));
  fs.mkdirSync(out, { recursive: true });
  const port = +(opt("--port") || 8767), t0 = Date.now();
  const a = await render(ours, spO, flags, port), b = await render(ref, spR, flags, port);
  const names = (spO.pcts || spO.times).map((v, i) => (spO.pcts ? `pct${String(v).padStart(3, "0")}` : `s${String(v).padStart(5, "0")}`));
  const made = [];
  for (let i = 0; i < names.length; i++) {
    if (!a.files[i] || !b.files[i]) { console.log(`  ${names[i]}: a frame is missing`); continue; }
    const dst = path.join(out, names[i] + ".png");
    const r = cp.spawnSync(process.env.FFMPEG || "ffmpeg", ["-v", "error", "-y", "-i", a.files[i], "-i", b.files[i], "-filter_complex", "[0]scale=800:450[a];[1]scale=800:450[b];[a][b]hstack", dst], { windowsHide: true });
    if (r.status === 0) made.push(path.relative(ROOT, dst)); else console.log(`  ${names[i]}: ffmpeg failed: ${String(r.stderr).slice(0, 200)}`);
  }
  a.cleanup(); b.cleanup();
  console.log(`${made.length} pictures in ${((Date.now() - t0) / 1000).toFixed(0)} s (${ours.name} | ${ref.name}):`);
  for (const f of made) console.log("  " + f);
  process.exit(made.length ? 0 : 1);
})().catch(e => { console.error(e.message); process.exit(1); });
