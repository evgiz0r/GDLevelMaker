// node tools/compare.js <level A> <level B> [more ...] [--html out.html] [--json out.json] [--thumbs] [--no-taste]
//   <level>: a .gdlvl, a GDLM name from the viewer's list ("GDLM 70", "candy"), or official:N (on the PC: local/ data)
// Two or more levels side by side (the user, 2026-11-25: "Level compare"), on every axis we measure, with which one is
// ahead on each (COMPARE.md: what each row means, where it comes from, numbers, what is open):
//   size      length (s), objects, presses, presses a second, modes in order, speed / gravity / size portals
//   difficulty (lib/difficulty.js via tools/balance.js) score = log10 expected attempts, its label, lapse / timing /
//             after-portal parts, v2 (flying by room), the tightest window, the costliest presses, unfair lone spikes,
//             cost per mode stretch, and the cost curve over the level (the page draws it)
//   taste     (tools/taste.js, ~330 rated levels + the user's repetition rule) 0-100 and the parts that move it most
//   bricks    (tools/lego.js) the level cut into 1-3 s pieces: family mix (fly / jump / flip, by seconds), distinct pieces,
//             repeats of the 4 before; and with local/lego/pieces.json (the PC, after `lego.js mine`) which verified
//             bricks it is built from (tools/lego_match.js) and how much of it they cover
// Prints a table; --html writes one page (template viewer/compare.html; default local/compare/<a>_vs_<b>.html);
// --thumbs puts each level's picture on it (tools/thumb.js, local/thumbs/; made first when missing -- a headless render).
// GDLM levels use their saved route (viewer/levels.js; no solve). Difficulty measures every window: seconds for a short
// cube level, a few minutes for a long one with modes. One heavy job (tools/heavy.js).
if (require.main === module) require("./heavy.js").claim();
const fs = require("fs"), path = require("path"), vm = require("vm"), cp = require("child_process");
const ROOT = path.join(__dirname, ".."), { GD, readGdlvl } = require("./io.js");
const B = 30, TPS = 240;

let VL = null;
function viewerLevels() {
  if (VL) return VL;
  try { const c = { window: {} }; vm.runInNewContext(fs.readFileSync(path.join(ROOT, "viewer", "levels.js"), "utf8"), c); VL = c.window.GD_LEVELS || []; } catch (e) { VL = []; }
  return VL;
}
// a level argument -> { arg, kind, name, file?, n?, level, levelStr, events }
function resolve(arg) {
  let m = /^official:(\d+)$/.exec(arg);
  if (m) { const f = path.join(ROOT, "local", `official_${m[1].padStart(2, "0")}.json`);
    if (!fs.existsSync(f)) throw new Error(`${arg}: no ${path.relative(ROOT, f)} here (main levels are only on the PC)`);
    const j = JSON.parse(fs.readFileSync(f, "utf8"));
    return { arg, kind: "official", n: +m[1], name: j.name || "official " + m[1], level: GD.parseLevel(j.level), levelStr: j.level, events: j.solution && j.solution.events }; }
  let file = arg;
  if (!fs.existsSync(file)) { const want = arg.toLowerCase(), e = viewerLevels().find(e => e.name.toLowerCase().startsWith(want)) || viewerLevels().find(e => e.file.toLowerCase().includes(want) || e.name.toLowerCase().includes(want));
    if (!e) throw new Error(`no level like '${arg}' (a .gdlvl, a GDLM name or official:N)`); file = path.join(ROOT, e.file); }
  const r = readGdlvl(file), rel = path.relative(ROOT, path.resolve(file)).replace(/\\/g, "/");
  let events = null;
  const e = viewerLevels().find(e => e.file === rel);
  if (e && e.solution && e.solution.events && e.solution.events.length) events = e.solution.events;
  if (!events) try { const s = require("./solutions.js").get(r.levelStr, true); if (s && s.events) events = s.events; } catch (er) {}
  return { arg: rel, kind: "gdlm", name: r.name, file: rel, level: r.level, levelStr: r.levelStr, events };
}

function size(S) {
  const w = GD.makeWorld(S.level.objects, S.level.header), O = require("../lib/objects.js");
  const counts = {}, seq = [];
  for (const o of S.level.objects) { const d = O.objInfo(o.id); if (!d) continue;
    if (["mode", "speed", "gravity", "size", "dual", "mirror", "teleport"].includes(d.kind)) counts[d.kind] = (counts[d.kind] || 0) + 1;
    if (d.kind === "mode") seq.push([o.x, d.mode]); }
  seq.sort((a, b) => a[0] - b[0]);
  let seconds = null, done = null, modesRun = [];
  if (S.events) { const r = GD.run(w, S.events); seconds = +((r.path.length - 1) / TPS).toFixed(1); done = !!r.done;
    for (const p of r.path) if (modesRun[modesRun.length - 1] !== p.mode) modesRun.push(p.mode); }
  const modes = modesRun.length ? modesRun : ["cube", ...seq.map(s => s[1])].filter((m, i, a) => i === 0 || a[i - 1] !== m);
  const presses = S.events ? S.events.filter(e => e.type === "press").length : null;
  return { seconds, blocks: Math.round(w.endX / B), objects: S.level.objects.length, presses, pps: presses != null && seconds ? +(presses / seconds).toFixed(2) : null,
    modes, modeKinds: [...new Set(modes)], portals: counts, routeClears: done };
}

function difficulty(S) {
  const BAL = require("./balance.js");
  const b = S.kind === "official" ? BAL.official(S.n) : null;
  let bb = b;
  if (!bb) {
    if (!S.events) return { none: "no saved route: no difficulty (solve it first: node tools/solutions.js)" };
    const DF = require("../lib/difficulty.js"), w = GD.makeWorld(S.level.objects, S.level.header);
    const d = DF.difficulty(w, { ok: true, events: S.events }, {});
    const fly = DF.flyRoom(w, GD.run(w, d.events).path);
    bb = BAL.balance(S.name, d.actions, { fly, kind: S.kind, seconds: d.seconds, complete: d.complete });
  }
  const tight = bb.inputs.length ? bb.inputs.reduce((m, a) => a.ms < m.ms ? a : m) : null, end = bb.inputs.length ? bb.inputs[bb.inputs.length - 1].t : 1;
  return { score: bb.score, label: bb.label, attempts: bb.attempts, parts: bb.parts, v2: bb.v2.score, v2label: bb.v2.label, v2fly: bb.v2.fly,
    inputs: bb.inputs.length, tightestMs: tight ? tight.ms : null, tightestAt: tight ? { t: tight.t, block: tight.block, mode: tight.mode } : null,
    under60: bb.inputs.filter(a => a.ms < 60).length,
    top: bb.top.slice(0, 5).map(a => ({ t: a.t, block: a.block, mode: a.mode, type: a.type, ms: a.ms, cost: +a.cost.toFixed(3), share: a.share })),
    spikes: bb.spikes.map(k => ({ t: k.t, block: k.block, mode: k.mode, ms: k.ms, calm: k.calm })),
    sections: bb.sections.map(s => ({ mode: s.mode, from: s.from, to: s.to, inputs: s.inputs, cost: s.cost, share: s.share, minMs: s.minMs })),
    curve: bb.inputs.map((a, i) => [+(a.t / Math.max(1e-6, end)).toFixed(4), bb.curve[i]]), rating: bb.rating || null };
}

function taste(S, noTaste) {
  if (noTaste) return { none: "skipped (--no-taste)" };
  try {
    const arg = S.kind === "official" ? "official:" + S.n : path.join(ROOT, S.file);
    const r = JSON.parse(cp.execFileSync(process.execPath, ["--max-old-space-size=1200", path.join(__dirname, "taste.js"), "one", arg],
      { windowsHide: true, encoding: "utf8", maxBuffer: 1 << 26, env: Object.assign({}, process.env, { GDLM_HEAVY_HELD: "1" }) }));
    const t = require("./taste.js").taste(r.F);
    const rep = t.parts.find(p => /repetition/.test(p.f));
    return { score: t.score, band: t.band, repetition: r.F.repR != null ? +(+r.F.repR).toFixed(3) : null, repetitionCost: rep ? rep.contrib : 0,
      parts: t.parts.slice(0, 6).map(p => ({ f: p.f, value: typeof p.value === "number" ? +p.value.toFixed(3) : p.value, pct: p.pct, contrib: p.contrib })),
      rulesBroken: t.rules.filter(q => !q.ok).map(q => q.rule) };
  } catch (e) { return { none: "taste failed: " + String(e.message).split("\n")[0] }; }
}

function bricks(S) {
  const L = require("./lego.js");
  const s = { src: S.kind === "official" ? "official" : "ours", name: S.name, level: S.level, events: S.events };
  const R = L.route(s), ps = L.cut(R.r, R.inputs).map(([a, b]) => L.measure(s, R.w, R.r, R.inputs, a, b));
  let rep = 0; const fam = {}, sigs = {};
  ps.forEach((p, i) => { if (ps.slice(Math.max(0, i - 4), i).some(q => q.sig === p.sig)) rep++;
    const f = p.sig.split(" / ")[0]; fam[f] = (fam[f] || 0) + p.s; sigs[p.sig] = (sigs[p.sig] || 0) + 1; });
  const tot = Object.values(fam).reduce((a, b) => a + b, 0) || 1;
  const out = { pieces: ps.length, distinct: Object.keys(sigs).length, repeats: rep, repeatShare: ps.length ? +(rep / ps.length).toFixed(2) : 0,
    families: Object.fromEntries(Object.entries(fam).map(([k, v]) => [k, +(v / tot).toFixed(3)])),
    common: Object.entries(sigs).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([sig, n]) => ({ sig, n })),
    sequence: ps.map(p => ({ x: p.x, s: +p.s.toFixed(2), sig: p.sig })), route: S.events ? "saved" : "midline (no route)" };
  // which verified bricks it is built from: only where the catalogue has been mined (local/lego/pieces.json, the PC)
  try {
    const all = L.load().filter(p => p.grain === "brick" && p.verified && !p.dupOf && !p.empty);
    if (all.length) {
      const pool = S.kind === "official" ? all.filter(p => !String(p.level).startsWith(S.n + " ")) : all.filter(p => p.level !== S.name);
      const M = require("./lego_match.js").match(S.level, pool, { min: 0.6 }), cov = M.kept.reduce((a, k) => a + k.brick.w, 0);
      const bySrc = {}; for (const k of M.kept) bySrc[k.brick.src] = (bySrc[k.brick.src] || 0) + 1;
      out.match = { bricksTried: pool.length, matched: M.kept.length, cover: +(cov / Math.max(1, M.cols)).toFixed(3), bySource: bySrc,
        best: M.kept.slice().sort((a, b) => b.score - a.score).slice(0, 5).map(k => ({ at: k.at, w: k.brick.w, score: k.score, id: k.brick.src === "official" ? null : k.brick.id, sig: k.brick.sig, src: k.brick.src })) };
    } else out.match = { none: "no mined catalogue here (local/lego/pieces.json: node tools/lego.js mine official ours)" };
  } catch (e) { out.match = { none: "no mined catalogue here (local/lego/pieces.json)" }; }
  return out;
}

function thumbOf(S, make) {
  const safe = String(S.name).replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_") || "level";
  const dir = path.join(ROOT, "local", "thumbs", safe), small = path.join(dir, "thumb_small.png"), big = path.join(dir, "thumb.png");
  if (!fs.existsSync(small) && !fs.existsSync(big) && make) {
    const arg = S.kind === "official" ? "official:" + S.n : path.join(ROOT, S.file);
    cp.spawnSync(process.execPath, [path.join(__dirname, "thumb.js"), arg], { windowsHide: true, stdio: ["ignore", 2, 2], env: Object.assign({}, process.env, { GDLM_HEAVY_HELD: "1" }) });
  }
  const f = fs.existsSync(small) ? small : fs.existsSync(big) ? big : null;
  return f ? "data:image/png;base64," + fs.readFileSync(f).toString("base64") : null;
}

function measureLevel(arg, o = {}) {
  const t0 = Date.now(), S = resolve(arg);
  const out = { name: S.name, kind: S.kind, file: S.file || null, n: S.n || null, route: S.events ? "saved" : "none" };
  out.size = size(S); out.difficulty = difficulty(S); out.taste = taste(S, o.noTaste); out.bricks = bricks(S);
  if (o.thumbs) out.thumb = thumbOf(S, true);
  out.seconds = +((Date.now() - t0) / 1000).toFixed(1);
  return out;
}

// which level is ahead on each row: [label, value getter, "high" | "low" is better | null (no winner), format]
const ROWS = [
  ["length (s)", L => L.size.seconds, null],
  ["objects", L => L.size.objects, null],
  ["presses", L => L.size.presses, null],
  ["presses / s", L => L.size.pps, null],
  ["modes", L => L.size.modeKinds.join(" "), null],
  ["mode switches", L => Math.max(0, L.size.modes.length - 1), "high"],
  ["difficulty", L => L.difficulty.score, null, L => L.difficulty.none ? "-" : `${L.difficulty.score.toFixed(2)} ${L.difficulty.label} (~${L.difficulty.attempts} att.)`],
  ["  v2 (flying by room)", L => L.difficulty.v2, null, L => L.difficulty.none ? "-" : `${L.difficulty.v2.toFixed(2)} ${L.difficulty.v2label}`],
  ["  timing / lapse / after-portal", L => L.difficulty.parts && L.difficulty.parts.timing, null, L => L.difficulty.none ? "-" : `${L.difficulty.parts.timing.toFixed(2)} / ${L.difficulty.parts.lapse.toFixed(2)} / ${L.difficulty.parts.settle.toFixed(2)}`],
  ["tightest window (ms)", L => L.difficulty.tightestMs, null, L => L.difficulty.none ? "-" : `${L.difficulty.tightestMs} at ${L.difficulty.tightestAt.t.toFixed(1)} s (${L.difficulty.tightestAt.mode})`],
  ["windows under 60 ms", L => L.difficulty.under60, null],
  ["lone hard spikes (unfair)", L => L.difficulty.spikes && L.difficulty.spikes.length, "low"],
  ["taste (0-100)", L => L.taste.score, "high"],
  ["  repetition (R, cost)", L => L.taste.repetition, "low", L => L.taste.none ? "-" : `${L.taste.repetition} (${L.taste.repetitionCost ? "-" + Math.abs(L.taste.repetitionCost) : "no cost"})`],
  ["pieces (1-3 s)", L => L.bricks.pieces, null],
  ["distinct pieces", L => L.bricks.distinct, "high"],
  ["repeat share", L => L.bricks.repeatShare, "low"],
  ["family mix (s share)", L => Object.entries(L.bricks.families).map(([k, v]) => `${k} ${Math.round(v * 100)}%`).join(", "), null],
  ["built from verified bricks", L => L.bricks.match && L.bricks.match.cover, "high", L => !L.bricks.match || L.bricks.match.none ? "-" : `${Math.round(L.bricks.match.cover * 100)}% (${L.bricks.match.matched} bricks)`],
];
function table(levels) {
  return ROWS.map(([label, get, better, fmt]) => {
    const vals = levels.map(L => { try { return get(L); } catch (e) { return null; } });
    const shown = levels.map((L, i) => { try { if (fmt) return fmt(L); } catch (e) { return "-"; } const v = vals[i]; return v == null || v === "" ? "-" : String(v); });
    let best = null;
    const nums = vals.map(v => typeof v === "number" && isFinite(v) ? v : null);
    if (better && nums.filter(v => v != null).length >= 2) { const t = better === "high" ? Math.max(...nums.filter(v => v != null)) : Math.min(...nums.filter(v => v != null));
      const at = nums.map((v, i) => v === t ? i : -1).filter(i => i >= 0); if (at.length < nums.filter(v => v != null).length) best = at; }
    return { label, values: shown, raw: nums, better, best };
  });
}
// a few plain sentences: where they differ most
function verdict(levels) {
  const out = [], [a, b] = levels;
  if (!a || !b) return out;
  const da = a.difficulty.score, db = b.difficulty.score;
  if (isFinite(da) && isFinite(db)) out.push(Math.abs(da - db) < 0.15 ? `About as hard as each other (${da.toFixed(2)} vs ${db.toFixed(2)}).`
    : `${da > db ? a.name : b.name} is harder: ~${Math.max(a.difficulty.attempts, b.difficulty.attempts)} expected attempts vs ~${Math.min(a.difficulty.attempts, b.difficulty.attempts)}.`);
  // v1 and v2 (DIFFICULTY.md: after-portal only when forced, flying by room) can disagree: say so rather than trust one
  const va = a.difficulty.v2, vb = b.difficulty.v2;
  if (isFinite(da) && isFinite(db) && isFinite(va) && isFinite(vb) && Math.abs(da - db) >= 0.5 && (Math.abs(va - vb) < 0.15 || (da > db) !== (va > vb)))
    out.push(`But by v2 (after-portal only when forced, flying by room) they are ${Math.abs(va - vb) < 0.15 ? "about even" : "the other way round"}: ${va.toFixed(2)} vs ${vb.toFixed(2)}. The gap is mostly the after-portal part.`);
  if (a.taste.score != null && b.taste.score != null && a.taste.score !== b.taste.score) out.push(`${a.taste.score > b.taste.score ? a.name : b.name} scores higher on taste (${Math.max(a.taste.score, b.taste.score)} vs ${Math.min(a.taste.score, b.taste.score)}).`);
  if (a.bricks.pieces && b.bricks.pieces) { const va = a.bricks.distinct / a.bricks.pieces, vb = b.bricks.distinct / b.bricks.pieces;
    if (Math.abs(va - vb) > 0.1) out.push(`${va > vb ? a.name : b.name} varies its pieces more (${Math.round(Math.max(va, vb) * 100)}% distinct vs ${Math.round(Math.min(va, vb) * 100)}%).`); }
  const sa = a.difficulty.spikes || [], sb = b.difficulty.spikes || [];
  if (sa.length !== sb.length) out.push(`Lone hard presses: ${a.name} ${sa.length}, ${b.name} ${sb.length}.`);
  return out;
}

function print(levels, rows) {
  const W0 = Math.max(...rows.map(r => r.label.length)) + 2, Wc = Math.min(44, Math.max(14, ...levels.map(L => L.name.length + 2), ...rows.flatMap(r => r.values.map(v => v.length + 3))));
  console.log("".padEnd(W0) + levels.map(L => L.name.slice(0, Wc - 2).padEnd(Wc)).join(""));
  for (const r of rows) console.log(r.label.padEnd(W0) + r.values.map((v, i) => ((r.best && r.best.includes(i) ? "* " : "  ") + v).slice(0, Wc - 1).padEnd(Wc)).join(""));
  console.log("(* = ahead on that row)");
  for (const L of levels) {
    if (!L.difficulty.none) { console.log(`\n${L.name}: costliest presses`);
      for (const a of L.difficulty.top.slice(0, 3)) console.log(`  ${a.t.toFixed(1).padStart(6)} s  block ${String(Math.round(a.block)).padStart(4)}  ${a.mode.padEnd(6)} window ${String(a.ms).padStart(3)} ms  ${Math.round(a.share * 100)}% of the score`); }
    if (!L.taste.none) console.log(`  taste moved most by: ${L.taste.parts.slice(0, 3).map(p => `${p.f} ${p.contrib >= 0 ? "+" : ""}${p.contrib}`).join(", ")}`);
    if (L.bricks.common.length) console.log(`  most used piece: ${L.bricks.common[0].sig} (x${L.bricks.common[0].n})`);
  }
}

function main() {
  const args = process.argv.slice(2);
  const take = k => { const i = args.indexOf(k); return i >= 0 ? args.splice(i, 2)[1] : null; };
  const flag = k => { const i = args.indexOf(k); if (i >= 0) { args.splice(i, 1); return true; } return false; };
  const html = take("--html"), json = take("--json"), thumbs = flag("--thumbs"), noTaste = flag("--no-taste");
  if (args.length < 2) { console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n")); process.exit(1); }
  const levels = args.map(a => { const L = measureLevel(a, { thumbs, noTaste }); console.error(`measured ${L.name} in ${L.seconds} s`); return L; });
  const rows = table(levels), data = { made: new Date().toISOString(), levels, rows, verdict: verdict(levels) };
  print(levels, rows);
  if (data.verdict.length) console.log("\n" + data.verdict.join("\n"));
  if (json) fs.writeFileSync(json, JSON.stringify(data));
  const safe = s => String(s).replace(/[^\w]+/g, "_").toLowerCase();
  const out = html || path.join(ROOT, "local", "compare", levels.map(L => safe(L.name)).join("_vs_") + ".html");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const tpl = fs.readFileSync(path.join(ROOT, "viewer", "compare.html"), "utf8");
  fs.writeFileSync(out, tpl.replace("/*COMPARE_DATA*/null", JSON.stringify(data).replace(/</g, "\\u003c")));
  console.log("\npage:", path.relative(ROOT, out));
}
module.exports = { measureLevel, table, verdict, resolve };
if (require.main === module) main();
