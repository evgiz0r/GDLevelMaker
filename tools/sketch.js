// node tools/sketch.js list                         the whiteboard's saved sketches (local/sketches/, from the PC board)
// node tools/sketch.js <id | sketch.json> [--fit] [--out <file.gdlvl>] [--name "GDLM NN ..."] [--wip <session>]
//   --fit: through the layout fitter first (lib/sketchfit.js, the board's 🧩 layout): the level written is the fitted
//   one, its changes are printed, and the plan is the fitted marks. Picture: node tools/sketchshot.js <sketch> --fit
//   one sketch -> a .gdlvl as drawn (default local/sketches/<id>.gdlvl): what each stroke became, the user's
//   "I jump here" marks replayed (where they die), the solver's answer, the notes the user wrote for us. --wip puts it in
//   the viewer's in-progress list with its layout stage (the jump marks as the plan, so it replays at once).
// Sketches drawn on the PHONE live in the phone board's database: read them with one ArtifactData `list` of the
// collection "sketches" on the board's artifact (link in local/phone/draw_url.txt), save the row as JSON, run this on it.
// This is the reading step only: the drawing is intent, not geometry. Rebuilding it into a level that plays well
// (sizes, timing, fairness, the song) follows SKETCH.md and BUILDING.md; DRAW.md says what the board's strokes mean.
const fs = require("fs"), path = require("path");
if (require.main === module && process.argv[2] && process.argv[2] !== "list") require("./heavy.js").claim();   // it solves
const ROOT = path.join(__dirname, ".."), DIR = path.join(ROOT, "local", "sketches");
const { GD, writeGdlvl } = require("./io.js");
const SK = require("../lib/sketch.js");
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };

function load(a) {
  const f = fs.existsSync(a) ? a : path.join(DIR, a.replace(/\.json$/, "") + ".json");
  const j = JSON.parse(fs.readFileSync(f, "utf8"));
  return j.data && j.data.items ? j.data : j;   // an ArtifactData row saved as is
}
function list() {
  if (!fs.existsSync(DIR)) return console.log("no sketches yet (local/sketches/ is empty)");
  for (const f of fs.readdirSync(DIR).filter(f => f.endsWith(".json"))) {
    try { const s = load(path.join(DIR, f)); console.log(`${s.id.padEnd(14)} ${new Date(s.updated || 0).toISOString().slice(0, 16)}  ${String(s.items.length).padStart(4)} pieces  ${s.name}`); } catch (e) {}
  }
}
function main() {
  const a = process.argv[2];
  if (!a || a === "list") return list();
  let sk = load(a); const id = sk.id || path.basename(a, ".json"); let fitted = null;
  if (process.argv.includes("--fit")) {
    fitted = require("../lib/sketchfit.js").fit(sk);
    console.log(`layout fitter: ${fitted.clear ? "plays with the marks (" + fitted.presses + " presses)" : "stops at block " + (fitted.dieX / 30).toFixed(1) + " (" + fitted.why + ")"}, ${fitted.changes.length} changes:`);
    for (const c of fitted.changes) console.log(`  ${c.mark} ${c.x == null ? "" : "block " + (c.x / 30).toFixed(1) + ": "}${c.text}`);
    sk = Object.assign({}, fitted.sketch, { id });
  }
  const r = SK.convert(sk);
  const name = arg("--name", "GDLM sketch " + (sk.name || id));
  const out = arg("--out", path.join(DIR, id + ".gdlvl"));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const rec = GD.newRecord(name, "Drawn on the GDLM whiteboard");
  const m = /\/song\/custom\/(\d+)\./.exec((sk.song && sk.song.url) || ""); if (m) GD.setField(rec, "k45", "i", m[1]);
  writeGdlvl(out, rec, { header: r.header, objects: r.objects });
  const by = {}; for (const it of sk.items) { const k = it.k === "stroke" ? it.pen + (SK.isLoop(it.pts) ? " area" : " line") : it.k === "stamp" ? it.what : it.k; by[k] = (by[k] || 0) + 1; }
  console.log(`${name}: ${sk.items.length} pieces drawn (${Object.entries(by).map(([k, n]) => n + " " + k).join(", ")})`);
  console.log(`  -> ${r.counts.play} gameplay objects, ${r.counts.deco} deco, ${(r.endX / 30).toFixed(0)} blocks, ${SK.xToTime(sk, r.endX).toFixed(1)} s -> ${path.relative(ROOT, out)}`);
  const w = GD.makeWorld(r.objects, r.header), ev = fitted ? fitted.events : SK.planEvents(sk);
  if (ev.length) { const q = GD.run(w, ev), done = q.done || (!q.dead && q.end && q.end.x >= w.endX);
    console.log(`  the user's ${ev.length / 2} jump marks: ${done ? "clear it" : "die at block " + (q.end.x / 30).toFixed(1) + " (" + (q.why || "hit") + ")"}`); }
  const s = GD.solveAny(w);
  console.log(`  solver: ${s.ok ? "beatable, " + s.clicks.filter(c => !c.auto && c.type !== "release").length + " presses" : "no way through after block " + ((s.dieAt && s.dieAt.x || 0) / 30).toFixed(1) + (s.why ? " (" + s.why + ")" : "")}`);
  if (r.notes.length) console.log(`  notes the user drew: ${r.notes.length} (look at them on the board: they are not in the level)`);
  const sess = arg("--wip");
  if (sess) {
    require("./stages.js").put({ session: sess, base: path.basename(out, ".gdlvl"), name, stage: "layout", levelStr: GD.serializeLevel({ header: r.header, objects: r.objects }), data: { events: ev, from: "whiteboard", sketch: id }, note: "as drawn on the whiteboard" });
    console.log(`  put as a layout stage for ${sess} (the viewer shows it; run tools/wip.js put once it is rebuilt)`);
  }
}
if (require.main === module) main();
module.exports = { load };
