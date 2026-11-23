// Build stages, shown in the viewer while a level is being made (the user, 2026-11-24: "i want even partial steps like
// song/layout/path/deco to be available in the process, not just the end result"). VIEWER: the stage bar on the level
// and the stage on the picker's in-progress cards; tools/serve.js GET /wip/stages and /wip/list read what this writes.
//
//   require("./stages.js").put({ session, base, name, stage, levelStr?, data?, note? })
//   node tools/stages.js put <session> <level.gdlvl | base> <stage> [--json file.json] [--note "..."] [--name "GDLM 70 x"]
//   node tools/stages.js list [session]
//
// stage: song | layout | path | deco | final (that order). Files: local/wip/<session>/<base>.stages/
//   index.json      { level: "<base>.gdlvl", name, session, stages: [{ stage, at, note, file?, data? }] } -- a later
//                   put of the same stage replaces it; stages are kept in the order above
//   <stage>.gdlvl   the level at that stage, when levelStr is given (layout: gameplay only; deco: with the look; final)
// data by stage (all optional):
//   song  { song: { url, id, offset }, grid: { bpm, period, t0, beats, downbeat, sections }, sections: [{ name, from, to }] }
//         (no level needed: the viewer shows an empty level with the song, its beats and sections)
//   path  { planned: [{ t, what }] }  -- the planned presses, drawn beside the measured route
// Small files, no solving here: the viewer replays a stage with its saved solution when tools/solutions.js has one,
// and asks the PC to solve it otherwise (the task modal).
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, ".."), WIP = process.env.GDLM_WIP_DIR || path.join(ROOT, "local", "wip");   // GDLM_WIP_DIR: tests
const ORDER = ["song", "layout", "path", "deco", "final"];
function dirOf(session, base) { return path.join(WIP, String(session).replace(/[^\w-]+/g, ""), String(base).replace(/\.gdlvl$/, "") + ".stages"); }
function read(dir) { try { return JSON.parse(fs.readFileSync(path.join(dir, "index.json"), "utf8")); } catch (e) { return null; } }
function put(o) {
  if (!ORDER.includes(o.stage)) throw new Error("stage must be one of " + ORDER.join(", "));
  if (!o.session || !o.base) throw new Error("session and base are needed");
  const base = String(o.base).replace(/\.gdlvl$/, ""), dir = dirOf(o.session, base);
  fs.mkdirSync(dir, { recursive: true });
  const idx = read(dir) || { level: base + ".gdlvl", name: o.name || base, session: o.session, stages: [] };
  if (o.name) idx.name = o.name;
  const entry = { stage: o.stage, at: new Date().toISOString() };
  if (o.note) entry.note = o.note;
  if (o.levelStr) {
    const { pack } = require("./io.js"), GD = require("../lib/gd.js");
    const rec = GD.newRecord(idx.name + " (" + o.stage + ")", "build stage " + o.stage);
    GD.setField(rec, "k4", "s", pack(o.levelStr));
    fs.writeFileSync(path.join(dir, o.stage + ".gdlvl"), pack(GD.serializeRecord(rec)));
    entry.file = o.stage + ".gdlvl";
  }
  if (o.data) entry.data = o.data;
  idx.stages = idx.stages.filter(s => s.stage !== o.stage).concat([entry]).sort((a, b) => ORDER.indexOf(a.stage) - ORDER.indexOf(b.stage));
  fs.writeFileSync(path.join(dir, "index.json"), JSON.stringify(idx, null, 1));
  return idx;
}
// every build with stages: [{ session, base, dir, index }]
function list(session) {
  const out = [];
  if (!fs.existsSync(WIP)) return out;
  for (const s of fs.readdirSync(WIP)) {
    if (session && s !== session) continue;
    let ds = []; try { ds = fs.readdirSync(path.join(WIP, s)).filter(f => f.endsWith(".stages")); } catch (e) { continue; }
    for (const d of ds) { const idx = read(path.join(WIP, s, d)); if (idx) out.push({ session: s, base: d.replace(/\.stages$/, ""), dir: path.join(WIP, s, d), index: idx }); }
  }
  return out;
}
module.exports = { put, list, dirOf, ORDER };

if (require.main === module) {
  const a = process.argv.slice(2), opt = n => { const i = a.indexOf(n); return i >= 0 ? a[i + 1] : null; };
  if (a[0] === "put" && a[3]) {
    const [, session, lv, stage] = a; let levelStr = null, base = path.basename(lv).replace(/\.gdlvl$/, ""), name = opt("--name");
    if (lv.endsWith(".gdlvl") && fs.existsSync(lv)) { const L = require("./io.js").readGdlvl(lv); levelStr = L.levelStr; name = name || L.name; }
    const data = opt("--json") ? JSON.parse(fs.readFileSync(opt("--json"), "utf8")) : undefined;
    const idx = put({ session, base, name, stage, levelStr, data, note: opt("--note") });
    console.log(`stage ${stage} of ${idx.name} saved (${idx.stages.map(s => s.stage).join(" > ")}) -> ${path.relative(ROOT, dirOf(session, base))}`);
  } else if (a[0] === "list") {
    for (const b of list(a[1])) console.log(`${b.session.padEnd(14)} ${b.index.name.padEnd(30)} ${b.index.stages.map(s => s.stage).join(" > ")}`);
  } else console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n"));
}
