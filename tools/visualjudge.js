// node tools/visualjudge.js shots <level.gdlvl> [--out dir] [--max 16] [--shapes]
// node tools/visualjudge.js review <level.gdlvl>              (needs ANTHROPIC_API_KEY; else prints how a session does it)
// node tools/visualjudge.js put <level.gdlvl> <review.txt> [--model haiku-5.5]
// node tools/visualjudge.js show <level.gdlvl>
//
// The visual judge (knowledge/visual_judge.md; Evgeni 2026-11-28: yes to "full-size crops at each transition and
// portal, GD's art, Haiku, a warning in the judge report"). A vision model looks at the level where looks matter most:
//   shots   one frame at each section change / portal the route crosses (portals within 1 s are one moment), the
//           route drawn on (shoot.js --trail: 2 s behind solid yellow, 2 s ahead dashed, a pink dot per press),
//           2x2 sheets at 960 px a tile (4x the detail of the 3x3 trial) + prompt.txt + manifest.json.
//           GD art where the sprite sheets are (the PC); the look render elsewhere (the cloud). --shapes forces shapes.
//   review  sends the sheets + prompt to Claude Haiku 5.5 (raw HTTP, no dependencies) and stores the answer (= put).
//   put     stores a review written by a session's Haiku helper: knowledge/visual_judge/<base>.json, stamped with the
//           level's version (tools/measures.js verOf), so a changed level shows its review as stale.
// tools/report.js shows a current review's notes as "visual: <category>" WARNINGS: they never change a score or a gate.
// Trial: Haiku found 3 of Evgeni's 7 picture-visible notes on GDLM 78 (dead time, odd portals, plain transitions) at
// ~$0.001 a review; it misses path bugs and indicator direction (the geometry checks own those).
"use strict";
const fs = require("fs"), path = require("path"), cp = require("child_process");
const ROOT = path.join(__dirname, ".."), STORE = path.join(ROOT, "knowledge", "visual_judge");
const MODEL = "claude-haiku-5-5";

const PROMPT = (name, secs, n) => `You are a visual judge for a Geometry Dash level (${name}, ${secs} s). Read the ${n} contact sheets attached / listed. Each tile is one moment where the player crosses a portal or a section change; the yellow label bottom-left of each tile is the level time.
Drawn on each frame: the player's route, solid yellow = last 2 s, dashed white = next 2 s, pink dots = presses.

Find VISUAL and LAYOUT problems a demanding level creator would flag at these moments:
- structures missing their 3D faces / side shading, flat or unfinished
- background or deco hiding the path or hazards (low contrast, clutter)
- ugly or broken joins between structures, holes, floating fragments
- the transition itself: plain, nothing special happening, or abrupt
- jump indicators / arrows pointing the wrong way or missing
- the route going around / over / under a structure instead of through it
- portals that look odd or pointless (stacked portals, pairs with no visible purpose, a portal that changes nothing)
- dead space: nothing to do around the moment
Do not invent problems; only report what you can see. Ignore the text label at the top of tiles. Output ONLY a list, max 12 lines, each exactly:
<time s> | <category> | <one short sentence>
with category one of: 3d, contrast, join, transition, indicator, route, portal, dead, clutter, other. Then one line "OVERALL: <one sentence>".`;

function load(file) {
  const { readGdlvl, GD } = require("./io.js"), S = require("./solutions.js");
  const L = readGdlvl(file); let sol = S.get(L.levelStr, true);
  // no route in local/solutions (a fresh cloud checkout): the one the viewer ships for this exact level string
  if (!sol || !sol.events) sol = viewerRoute(L.levelStr);
  if (!sol || !sol.events) throw new Error("no saved route: node tools/solutions.js " + file);
  const w = GD.makeWorld(L.level.objects, L.level.header), run = GD.run(w, sol.events);
  return { L, GD, sol, run, base: path.basename(file, ".gdlvl"), ver: require("./measures.js").verOf(L.levelStr) };
}

function viewerRoute(levelStr) {
  try { const w = {}; new Function("window", fs.readFileSync(path.join(ROOT, "viewer", "levels.js"), "utf8"))(w);
    const e = (w.GD_LEVELS || []).find(x => x.level === levelStr); return e && e.solution; } catch (e) { return null; }
}

// the moments: the route crossing a portal of any kind that changes the play (mode, gravity, speed, size, dual)
function moments(GD, L, run, max) {
  const xs = [];
  for (const o of L.level.objects) { const k = GD.objInfo(o.id).kind; if (/^(mode|gravity|speed|size|dual)$/.test(k)) xs.push(o.x); }
  xs.sort((a, b) => a - b);
  const P = run.path, ts = []; let k = 0;
  for (const x of xs) { while (k < P.length - 1 && GD.progressX(P[k]) < x) k++; if (k >= P.length - 1) break; const t = k / 240; if (!ts.length || t - ts[ts.length - 1] > 1.0) ts.push(t); }
  // too many: keep an even spread, always the first and the last
  if (ts.length > max) { const keep = []; for (let i = 0; i < max; i++) keep.push(ts[Math.round(i * (ts.length - 1) / (max - 1))]); return keep; }
  return ts;
}

function shots(file, opt = {}) {
  const { L, GD, sol, run, base, ver } = load(file), secs = +(run.path.length / 240).toFixed(1);
  // the frame a hair after the crossing: the portal just behind the player, the next stretch ahead on screen
  const times = moments(GD, L, run, opt.max || 16).map(t => +(t + 0.25).toFixed(2));
  const out = opt.out || path.join(ROOT, "local", "visual_judge", base); fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
  const fr = path.join(out, "frames"), job = path.join(out, "level.json");
  fs.writeFileSync(job, JSON.stringify({ name: L.name, level: L.levelStr, solution: sol }));
  const args = [path.join(__dirname, "shoot.js"), job, "--at", times.join(","), "--trail", "--out", fr].concat(opt.shapes ? ["--shapes"] : []);
  cp.execFileSync(process.execPath, args, { stdio: "inherit", windowsHide: true, env: Object.assign({}, process.env, { GDLM_HEAVY_NOSYNC: "1" }) });
  const sheets = cp.execFileSync(process.platform === "win32" ? "python" : "python3",
    [path.join(__dirname, "contactsheet.py"), fr, path.join(out, "sheet"), "--cols", "2", "--rows", "2", "--w", "960"], { encoding: "utf8", windowsHide: true })
    .trim().split(/\r?\n/).filter(Boolean);
  const prompt = PROMPT(L.name, secs, sheets.length);
  fs.writeFileSync(path.join(out, "prompt.txt"), prompt);
  fs.writeFileSync(path.join(out, "manifest.json"), JSON.stringify({ level: L.name, file: path.relative(ROOT, path.resolve(file)).replace(/\\/g, "/"), ver, times, sheets }, null, 1));
  return { out, times, sheets, prompt };
}

// a review's text -> notes
function parse(text) {
  const notes = [], lines = String(text).split(/\r?\n/); let overall = "";
  for (const ln of lines) {
    const m = /^\s*[-*]?\s*([\d.]+)(?:\s*[-–]\s*[\d.]+)?\s*s?\s*\|\s*([\w -]+?)\s*\|\s*(.+)$/.exec(ln);
    if (m) notes.push({ t: +m[1], cat: m[2].trim().toLowerCase(), note: m[3].trim() });
    const o = /^\s*OVERALL:\s*(.+)$/i.exec(ln); if (o) overall = o[1].trim();
  }
  return { notes, overall };
}

function put(file, text, opt = {}) {
  const { L, base, ver } = load(file), r = parse(text);
  fs.mkdirSync(STORE, { recursive: true });
  const rec = { level: L.name, ver, model: opt.model || "haiku-5.5", at: new Date().toISOString().slice(0, 16) + "Z", render: opt.render || "", overall: r.overall, notes: r.notes };
  fs.writeFileSync(path.join(STORE, base + ".json"), JSON.stringify(rec, null, 1) + "\n");
  return rec;
}

// for report.js: the stored review, and whether it is for this version of the level
function stored(file, levelStr) {
  const p = path.join(STORE, path.basename(file, ".gdlvl") + ".json"); if (!fs.existsSync(p)) return null;
  const r = JSON.parse(fs.readFileSync(p, "utf8")); r.current = r.ver === require("./measures.js").verOf(levelStr); return r;
}

async function review(file, opt = {}) {
  const key = process.env.ANTHROPIC_API_KEY, dir = path.join(ROOT, "local", "visual_judge", path.basename(file, ".gdlvl"));
  if (!fs.existsSync(path.join(dir, "manifest.json"))) shots(file, opt);
  const man = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8")), prompt = fs.readFileSync(path.join(dir, "prompt.txt"), "utf8");
  if (!key) {
    console.log("No ANTHROPIC_API_KEY here. A session runs it with a Haiku helper instead:\n  sheets: " + man.sheets.join("\n          ") +
      "\n  prompt: " + path.join(dir, "prompt.txt") + "\n  then:   node tools/visualjudge.js put " + file + " <the helper's answer as a .txt>");
    return null;
  }
  const content = man.sheets.map(s => ({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: fs.readFileSync(s).toString("base64") } }));
  content.push({ type: "text", text: prompt });
  const res = await fetch((process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com") + "/v1/messages", { method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: MODEL, max_tokens: 4000, output_config: { effort: "low" }, messages: [{ role: "user", content }] }) });
  const j = await res.json(); if (!res.ok) throw new Error("API " + res.status + ": " + JSON.stringify(j).slice(0, 300));
  if (j.stop_reason === "refusal") throw new Error("the model declined the review");
  const text = j.content.filter(b => b.type === "text").map(b => b.text).join("\n");
  const rec = put(file, text, { model: MODEL, render: opt.shapes ? "shapes" : "art/look" });
  rec.usage = j.usage; return rec;
}

module.exports = { shots, parse, put, stored, review, moments, PROMPT };

if (require.main === module) (async () => {
  const a = process.argv.slice(2), oi = k => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : null; };
  const [cmd, file] = a;
  if (!cmd || !file) { console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n")); process.exit(1); }
  if (cmd === "shots") { const r = shots(file, { out: oi("--out"), max: +(oi("--max") || 16), shapes: a.includes("--shapes") }); console.log(`${r.times.length} moments: ${r.times.join(", ")} s\n` + r.sheets.join("\n") + "\nprompt: " + path.join(r.out, "prompt.txt")); }
  else if (cmd === "put") { const r = put(file, fs.readFileSync(a[2], "utf8"), { model: oi("--model") || undefined, render: oi("--render") || "" }); console.log(`stored ${r.notes.length} notes -> knowledge/visual_judge/${path.basename(file, ".gdlvl")}.json`); }
  else if (cmd === "review") { const r = await review(file, { shapes: a.includes("--shapes") }); if (r) console.log(`${r.notes.length} notes; usage ${JSON.stringify(r.usage)}`); }
  else if (cmd === "show") { const { L } = load(file), r = stored(file, L.levelStr); console.log(r ? JSON.stringify(r, null, 1) : "no review stored"); }
  else { console.error("unknown command " + cmd); process.exit(1); }
})().catch(e => { console.error(e.message); process.exit(1); });
