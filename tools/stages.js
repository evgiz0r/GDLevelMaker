// Build stages, shown in the viewer while a level is being made (the user, 2026-11-24: "i want even partial steps like
// song/layout/path/deco to be available in the process, not just the end result"). VIEWER: the stage bar on the level
// and the stage on the picker's in-progress cards; tools/serve.js GET /wip/stages and /wip/list read what this writes.
//
//   require("./stages.js").put({ session, base, name, stage, levelStr?, data?, note? })
//   node tools/stages.js put <session> <level.gdlvl | base> <stage> [--json file.json] [--note "..."] [--name "GDLM 70 x"]
//   node tools/stages.js list [session]
//   node tools/stages.js wait <session> <base> <stage> [--timeout-min 120]   a builder's gate: blocks until the user
//        approves (prints "ok") or sends the stage back (prints "redo<TAB>note"); exit 2 on timeout
//
// Approve or redo (the viewer's stage bar, VIEWER.md): put({..., gate: true}) marks a stage the build waits on; the user's
// answer is stored on the stage as review {verdict: "ok" | "redo", note, spot?: {t, x}, at} (approve() below, from
// tools/serve.js POST /stages/review). Without a gate an approval is optional and just recorded.
//
// Sections (collab-style building, tools/seams.js: fixed seams, each section with its own builders and roles): the index
// holds a top-level "sections" array copied from briefs/<NN>.seams.json -- [{ id, name, x: [x0, x1], t: [t0, t1],
// builder: { layout, deco, playtest }, status: { layout, deco, playtest }: planned | built | ok | redo }] -- set with
// put({..., sections}) or setSections(); the viewer shows them as a strip under the stage bar. A per-section answer:
// approve(session, base, stage, { verdict, note, spot, section: "s3", role? }) stores sections[i].reviews[role] (role:
// layout | deco | playtest; default the stage's own: layout -> layout, deco / final -> deco, path -> playtest) and sets
// status[role] to ok / redo. A builder waits on one section: waitApproval(session, base, stage, { section, role }), or
//   node tools/stages.js wait <session> <base> <stage> --section s3 [--role playtest]
//   node tools/stages.js sections <session> <base> <briefs/NN.seams.json>    copy the seam contract's sections in
// setSections() keeps a section's reviews while its status for that role is unchanged; a new status clears them.
//
// stage: song | layout | path | deco | final (that order). Files: local/wip/<session>/<base>.stages/
//   index.json      { level: "<base>.gdlvl", name, session, stages: [{ stage, at, note, file?, data? }] } -- a later
//                   put of the same stage replaces it; stages are kept in the order above
//   <stage>.gdlvl   the level at that stage, when levelStr is given (layout: gameplay only; deco: with the look; final)
// data by stage (all optional):
//   song  { song: { url, id, offset }, grid: { bpm, period, t0, beats, downbeat, sections }, sections: [{ name, from, to }],
//           hits: tools/hits.js slots [{ beat, t (song seconds), kind: K/S/A/x/. }] -- drawn as kick / snare ticks }
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
  if (o.gate) entry.gate = true;   // the build waits for the user's ok / redo on this stage (waitApproval)
  if (o.levelStr) {
    const { pack } = require("./io.js"), GD = require("../lib/gd.js");
    const rec = GD.newRecord(idx.name + " (" + o.stage + ")", "build stage " + o.stage);
    GD.setField(rec, "k4", "s", pack(o.levelStr));
    fs.writeFileSync(path.join(dir, o.stage + ".gdlvl"), pack(GD.serializeRecord(rec)));
    entry.file = o.stage + ".gdlvl";
  }
  if (o.data) entry.data = o.data;
  if (Array.isArray(o.sections)) idx.sections = mergeSections(idx.sections, o.sections);
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
// the song stage's level: empty, but as long as the song's plan (its last section, hit or beat + 2 s at 1x), so the
// replay runs through the whole song -- one decoration square high above the view marks the end
function emptyLevel(data) {
  const GD = require("../lib/gd.js"), d = data || {};
  const ts = [].concat((d.sections || []).map(x => +x.to || 0), (d.hits || []).map(x => +x.t || 0), ((d.grid || {}).beats || []).slice(-1).map(Number));
  const secs = Math.max(4, ...ts.filter(isFinite)) - (+((d.song || {}).offset) || 0) + 2;
  const x = Math.round(secs * 311.58);   // 1x speed: 10.386 units a tick x 30 (lib/physics.js SPEEDS[1])
  return GD.serializeLevel({ header: GD.DEFAULT_HEADER, objects: [{ id: 1764, x, y: 1500, rot: 0, flipX: false, flipY: false, props: { 155: "1" } }] });
}
// a stage's song as the viewer needs it: a url (the song's id alone: /song/custom/<id>.mp3, as tools/serve.js serves it)
function songOf(data) {
  const sg = data && data.song; if (!sg) return undefined;
  return sg.url ? sg : Object.assign({}, sg, sg.id ? { url: "/song/custom/" + sg.id + ".mp3" } : {});
}
// sections from the seam contract (or compose): the fields the viewer needs; a section's reviews stay while its status for
// that role is the same (a rebuilt section, status "built" again, asks again)
const SEC_FIELDS = ["id", "name", "role", "x", "t", "builder", "status", "beats"];   // role: a collab part's, from the coordinator (tools/coordinator.js)
function mergeSections(old, secs) {
  const byId = new Map((old || []).map(s => [s.id, s]));
  return secs.map(s => {
    const n = {}; for (const k of SEC_FIELDS) if (s[k] !== undefined) n[k] = s[k];
    const o = byId.get(s.id);
    if (o && o.reviews) { const keep = {}; for (const [role, r] of Object.entries(o.reviews)) if ((n.status || {})[role] === r.verdict) keep[role] = r; if (Object.keys(keep).length) n.reviews = keep; }
    return n;
  });
}
function setSections(session, base, secs) {
  const dir = dirOf(session, base), idx = read(dir); if (!idx) throw new Error("no stages for " + session + "/" + base);
  idx.sections = mergeSections(idx.sections, secs);
  fs.writeFileSync(path.join(dir, "index.json"), JSON.stringify(idx, null, 1));
  return idx.sections;
}
const ROLE_OF = { layout: "layout", path: "playtest", deco: "deco", final: "deco", song: "layout" };
// the user's answer on a stage: {verdict: "ok" | "redo", note?, spot?} -> stored on the stage as review; with section
// (and role) -> on that section
function approve(session, base, stage, r) {
  const dir = dirOf(session, base), idx = read(dir); if (!idx) throw new Error("no stages for " + session + "/" + base);
  const st = idx.stages.find(x => x.stage === stage); if (!st) throw new Error("no stage " + stage);
  if (!["ok", "redo"].includes(r.verdict)) throw new Error("verdict must be ok or redo");
  if (r.section) {
    const sec = (idx.sections || []).find(s => s.id === r.section); if (!sec) throw new Error("no section " + r.section);
    const role = r.role || ROLE_OF[stage] || stage;
    const rev = { verdict: r.verdict, stage, note: r.note || undefined, spot: r.spot || undefined, at: new Date().toISOString() };
    sec.reviews = Object.assign({}, sec.reviews, { [role]: rev }); sec.status = Object.assign({}, sec.status, { [role]: r.verdict });
    fs.writeFileSync(path.join(dir, "index.json"), JSON.stringify(idx, null, 1));
    return Object.assign({ section: sec.id, role }, rev);
  }
  st.review = { verdict: r.verdict, note: r.note || undefined, spot: r.spot || undefined, at: new Date().toISOString() };
  fs.writeFileSync(path.join(dir, "index.json"), JSON.stringify(idx, null, 1));
  return st.review;
}
// a builder at a gate: resolves with the review when the user answers (polls the index; after a redo the builder puts
// the stage again, which clears the review, and waits again)
function waitApproval(session, base, stage, opts = {}) {
  const until = Date.now() + (opts.timeoutMin || 120) * 60e3;
  return new Promise((ok, no) => { const tick = () => {
    const idx = read(dirOf(session, base)), st = idx && idx.stages.find(x => x.stage === stage);
    if (opts.section) { const sec = idx && (idx.sections || []).find(s => s.id === opts.section), rv = sec && sec.reviews && sec.reviews[opts.role || ROLE_OF[stage] || stage];
      if (rv) return ok(rv); }
    else if (st && st.review) return ok(st.review);
    if (Date.now() > until) return no(new Error("no answer on " + stage + " yet"));
    setTimeout(tick, opts.everyMs || 2000);
  }; tick(); });
}
module.exports = { put, list, dirOf, ORDER, emptyLevel, songOf, approve, waitApproval, setSections, ROLE_OF };

if (require.main === module) {
  const a = process.argv.slice(2), opt = n => { const i = a.indexOf(n); return i >= 0 ? a[i + 1] : null; };
  if (a[0] === "put" && a[3]) {
    const [, session, lv, stage] = a; let levelStr = null, base = path.basename(lv).replace(/\.gdlvl$/, ""), name = opt("--name");
    if (lv.endsWith(".gdlvl") && fs.existsSync(lv)) { const L = require("./io.js").readGdlvl(lv); levelStr = L.levelStr; name = name || L.name; }
    const data = opt("--json") ? JSON.parse(fs.readFileSync(opt("--json"), "utf8")) : undefined;
    const idx = put({ session, base, name, stage, levelStr, data, note: opt("--note") });
    console.log(`stage ${stage} of ${idx.name} saved (${idx.stages.map(s => s.stage).join(" > ")}) -> ${path.relative(ROOT, dirOf(session, base))}`);
  } else if (a[0] === "wait" && a[3]) {
    waitApproval(a[1], a[2].replace(/\.gdlvl$/, ""), a[3], { timeoutMin: +opt("--timeout-min") || 120, section: opt("--section"), role: opt("--role") })
      .then(r => { console.log(r.verdict + (r.note ? "	" + r.note : "")); process.exit(0); }, e => { console.error(e.message); process.exit(2); });
  } else if (a[0] === "sections" && a[3]) {
    const secs = setSections(a[1], a[2].replace(/\.gdlvl$/, ""), JSON.parse(fs.readFileSync(a[3], "utf8")).sections || []);
    console.log(`${secs.length} section(s): ` + secs.map(s => s.id + " " + (s.name || "") + " " + JSON.stringify(s.status || {})).join("; "));
  } else if (a[0] === "list") {
    for (const b of list(a[1])) console.log(`${b.session.padEnd(14)} ${b.index.name.padEnd(30)} ${b.index.stages.map(s => s.stage).join(" > ")}`);
  } else console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n"));
}
