// node tools/score.js <level.gdlvl> [--brief briefs/NN.json] [--json]
//
// Every gate a level must pass before the user sees it, in one report (STYLE.md "The loop").
// Each gate is PASS, WARN (worth a look, does not block) or FAIL (blocks the hand-over).
//   beatable     the solver beats it (cube/ship/... physics, lib/physics.js)
//   prejumps     no press is committed far ahead of its cue (tools/sightread.js; the user's rule)
//   timing       tightest press window >= the brief's minWindowMs (default 60)
//   recovery     time from landing to the next press window >= minRecoveryMs (default Easy 150,
//                Normal 100, harder: none). Land-and-jump-at-once chains were the wall in GDLM 42
//                (the user's normal-mode deaths, mouse, recording 19:45): fine for the solver, hard
//                for a person without holding the button.
//   difficulty   lib/difficulty.js label vs the brief's target (one step off = WARN)
//   pacing       calm start and end, rests, a rising curve (numbers from the official levels)
//   variety      not one chunk over and over (unless the brief says "repeat": true)
//   readability  spike-like decoration (18-21) never within 2 columns of a hazard
//   colour       a colour change per section (when the brief has sections)
//   sync         with a song: portals on bar starts, and not too many presses pinned to beats (WARN only)
//   lead-in      Easy/Normal: blocks from each mode portal to the first hazard after it, against
//                the medians of 63 rated 2.0-2.1 levels (knowledge/levels/modes_low_tier.md): cube 6,
//                ship 8, wave/robot 3, UFO 2 (Hard and up: 0). WARN under 60% of it.
//   skips        the solved run goes through every mode/gravity/speed portal (FAIL) and uses every
//                orb (WARN): a "secret way" past part of the level means a path should be blocked
//   objects      gameplay objects with unconfirmed hitboxes (sure:false; WARN only)
// Cost: two solves of the level (a few seconds for a 30 s cube level). One at a time.
const fs = require("fs");
const { GD, readGdlvl } = require("./io.js");
Object.assign(GD, require("../lib/difficulty.js"), require("../lib/sync.js"));
const { sightread } = require("./sightread.js");
const { chunks } = require("./style.js");

const LABELS = ["Easy", "Normal", "Hard", "Harder", "Insane", "Demon"];
const SPIKY_DECO = new Set([18, 19, 20, 21]);

function scoreLevel(level, brief, opts = {}) {
  brief = brief || {};
  const want = brief.difficulty || {};
  const minMs = want.minWindowMs ?? 60;
  const gates = [];
  const gate = (name, status, value, note) => gates.push({ name, status, value, note: note || "" });

  const w = GD.makeWorld(level.objects, level.header);
  const r = GD.solveAny(w);
  gate("beatable", r.ok ? "PASS" : "FAIL", r.ok ? `${r.clicks.filter(c => c.type === "press").length} presses` :
    `dies at block ${(r.dieAt.x / 30).toFixed(1)} (${r.why})`);
  const presses = r.ok ? r.clicks.filter(c => c.type === "press") : [];

  let bad = [];
  if (r.ok) {
    const s = sightread(level);
    bad = s.ok ? s.presses.filter(p => p.flag) : [];
    // approximate on levels with modes (sweep solver, fixed later inputs): a WARN, not a FAIL
    gate("prejumps", bad.length ? (s.approx ? "WARN" : "FAIL") : "PASS", bad.length ? bad.map(p => `block ${p.to.toFixed(0)} (${p.lead.toFixed(1)} ahead of ${p.cue} at ${p.cueAt.toFixed(0)})`).join("; ") + (s.approx ? " (approximate: level with modes)" : "") : "none");
  }

  // windows: the exact solver gives them per press; the sweep solver (ship, wave ... levels) does
  // not, so take lib/difficulty.js's measured windows for every input (press and release)
  let diff = null, pathCache = null;
  const runPath = () => pathCache || (pathCache = GD.run(w, r.events).path);
  if (r.ok) diff = GD.difficulty(w, r);
  const exact = presses.length && presses.every(c => c.ms > 0);
  const inputs = exact ? presses.map(c => ({ x: c.x, ms: c.ms, kind: "press" }))
    : (diff ? diff.actions.map(a => ({ x: (runPath()[a.tick] || {}).x || 0, ms: a.ms, kind: a.type || "input" })) : []);
  const tight = inputs.filter(c => c.ms < minMs);
  if (r.ok) gate("timing", tight.length ? "FAIL" : "PASS",
    inputs.length ? `tightest ${Math.min(...inputs.map(c => c.ms))} ms over ${inputs.length} inputs, want >= ${minMs}` + (exact ? "" : " (measured windows)") : "no inputs",
    tight.map(c => `block ${(c.x / 30).toFixed(0)} ${c.kind} ${c.ms} ms`).join("; "));

  // recovery: landing -> next press window
  const RECOVERY = { Easy: 150, Normal: 100 };
  const minRec = want.minRecoveryMs ?? RECOVERY[want.label] ?? null;
  let chains = [];
  if (r.ok && presses.length > 1) {
    const path = GD.run(w, r.events).path;
    for (let i = 1; i < presses.length; i++) {
      let t = presses[i - 1].tick + 2;
      while (t < path.length && !path[t].grounded) t++;
      if (t > presses[i].lo) continue; // pressed in the air (orbs): not a landing
      const ms = (presses[i].lo - t) / GD.PHYS.TPS * 1000;
      if (minRec != null ? ms < minRec : ms < 100) chains.push({ x: path[presses[i].tick].x, ms: Math.round(ms) });
    }
    gate("recovery", chains.length && minRec != null ? "FAIL" : chains.length ? "WARN" : "PASS",
      chains.length ? `${chains.length} press(es) right after landing` + (minRec != null ? ` (< ${minRec} ms)` : " (< 100 ms)") : `every press >= ${minRec ?? 100} ms after landing`,
      chains.map(c => `block ${(c.x / 30).toFixed(0)} ${c.ms} ms`).join("; "));
  }

  if (r.ok) {
    const lab = GD.difficultyLabel(diff.logAttempts);
    const off = want.label ? Math.abs(LABELS.indexOf(lab) - LABELS.indexOf(want.label)) : 0;
    gate("difficulty", off >= 2 ? "FAIL" : off === 1 ? "WARN" : "PASS",
      `${lab} (${diff.logAttempts.toFixed(2)} = ~${Math.round(10 ** diff.logAttempts)} attempts)` + (want.label ? `, want ${want.label}` : ""));
  }

  // pacing, from hazard columns
  const haz = level.objects.filter(o => GD.objInfo(o.id).kind === "hazard").map(o => Math.floor(o.x / 30)).sort((a, b) => a - b);
  const endCol = Math.max(...level.objects.map(o => o.x)) / 30;
  if (haz.length) {
    const startRest = haz[0], endRest = endCol - haz[haz.length - 1];
    let longest = 0, runStart = haz[0];
    for (let i = 1; i < haz.length; i++) if (haz[i] - haz[i - 1] > 6) { longest = Math.max(longest, haz[i - 1] - runStart); runStart = haz[i]; }
    longest = Math.max(longest, haz[haz.length - 1] - runStart);
    const third = endCol / 3;
    const d1 = haz.filter(c => c < third).length, d3 = haz.filter(c => c >= 2 * third).length;
    const probs = [];
    if (startRest < 10) probs.push(`start rest ${startRest} < 10 blocks`);
    if (endRest < 10) probs.push(`end rest ${endRest.toFixed(0)} < 10 blocks`);
    if (longest > 60) probs.push(`${longest} blocks with no 6-block rest`);
    if (d3 < d1) probs.push(`last third calmer than the first (${d3} vs ${d1} hazards)`);
    gate("pacing", probs.length ? "WARN" : "PASS", `start ${startRest}, end ${endRest.toFixed(0)}, longest busy ${longest}, hazards first/last third ${d1}/${d3}`, probs.join("; "));
  }

  // variety: how often the most common chunk shows up
  const ch = chunks({ objects: level.objects });
  if (ch.length >= 6) {
    const n = new Map();
    for (const c of ch) n.set(c.pic, (n.get(c.pic) || 0) + 1);
    const top = Math.max(...n.values());
    const share = top / ch.length;
    gate("variety", brief.repeat ? "PASS" : share > 0.5 || n.size < 3 ? "WARN" : "PASS",
      `${n.size} different chunks in ${ch.length}, most common ${Math.round(share * 100)}%` + (brief.repeat ? " (repetition intended)" : ""));
  }

  // readability: spike-looking decoration next to real hazards
  const hazCols = new Set(haz);
  const near = level.objects.filter(o => SPIKY_DECO.has(o.id)).filter(o => { const c = Math.floor(o.x / 30); return [-2, -1, 0, 1, 2].some(d => hazCols.has(c + d)); });
  gate("readability", near.length ? "FAIL" : "PASS", near.length ? `${near.length} spike-like decorations within 2 columns of a hazard` : "decoration clear of hazards");

  if (brief.sections) {
    const colourT = level.objects.filter(o => o.id === 899 || o.id === 29 || o.id === 30).length;
    const need = brief.sections.filter(s => s.bg).length;
    gate("colour", colourT >= need ? "PASS" : "WARN", `${colourT} colour triggers for ${need} coloured sections`);
  }

  // sync, loosely (the user: "too synced may sound forced", not every click is on the beat; the
  // official levels put portals on bar starts and barely lean presses to the beat -- SYNC.md
  // "How much to sync"). PASS when the mode/speed portals sit on bar starts and at most 60% of the
  // presses are pinned to a beat; WARN otherwise. Never a FAIL.
  if (brief.grid && r.ok) {
    const grid = Object.assign({}, brief.grid, { period: brief.grid.period || 60 / brief.grid.bpm, t0: brief.grid.t0 || 0 });
    const off = brief.offset || 0, down = brief.grid.downbeat || 0;
    const beatAt = sec => GD.SYNC.timeToBeat(grid, off, sec);        // 1 = the first beat
    const path = runPath();
    const tickAtX = x => { for (let t = 0; t < path.length; t++) if (path[t].x >= x) return t; return path.length - 1; };
    const portals = level.objects.filter(o => ["mode", "speed"].includes(GD.objInfo(o.id).kind));
    const onBar = portals.filter(o => { const b0 = beatAt(tickAtX(o.x) / GD.PHYS.TPS) - 1 - down; const m = ((b0 % 4) + 4) % 4; return Math.min(m, 4 - m) < 0.25; }).length;
    const pw = GD.SYNC.pressWindows(w, r.events);
    let pinned = 0, n = 0;
    if (pw) for (const p of pw.windows) { n++; const mid = beatAt((p.lo + p.hi) / 2 / GD.PHYS.TPS); if (Math.abs(mid - Math.round(mid)) * grid.period < 0.035) pinned++; }
    const portalsOk = portals.length < 2 || onBar / portals.length >= 0.5, pinOk = !n || pinned / n <= 0.6;
    gate("sync", portalsOk && pinOk ? "PASS" : "WARN",
      `${onBar}/${portals.length} portals on a bar start, ${pinned}/${n} presses centred on a beat`,
      [!portalsOk ? "portals off the bars: put mode/speed changes on bar starts" : "", !pinOk ? "most presses pinned to beats: can sound forced, loosen some" : ""].filter(Boolean).join("; "));
  }

  // lead-in after mode portals (low tiers only)
  if (["Easy", "Normal"].includes(want.label || "Easy")) {
    const LEAD = { cube: 6, ship: 8, wave: 3, robot: 3, ufo: 2, ball: 3, spider: 3, swing: 3 };
    const ports = level.objects.filter(o => GD.objInfo(o.id).kind === "mode").sort((a, b) => a.x - b.x);
    const hx = level.objects.filter(o => GD.objInfo(o.id).kind === "hazard").map(o => GD.hitbox(o)).filter(Boolean).map(h => h.x0).sort((a, b) => a - b);
    const short = [];
    for (const p of ports) {
      const m = GD.objInfo(p.id).mode, need = LEAD[m] || 3;
      const first = hx.find(x => x > p.x);
      if (first == null) continue;
      const lead = (first - p.x) / 30;
      if (lead < 0.6 * need) short.push(`${m} at block ${((p.x - 15) / 30).toFixed(0)}: ${lead.toFixed(1)} blocks (typical ${need})`);
    }
    if (ports.length) gate("lead-in", short.length ? "WARN" : "PASS", short.length ? short.join("; ") : `${ports.length} mode portals with a calm lead-in`);
  }

  // skips: which portals and orbs the solved run never touched
  if (r.ok) {
    const path = runPath();
    const touched = o => {
      const hb = GD.hitbox(o); if (!hb) return true;
      for (let t = 0; t < path.length; t += 2) { const p = path[t]; if (p.x + 15 >= hb.x0 && p.x - 15 <= hb.x1 && p.y + 15 >= hb.y0 && p.y - 15 <= hb.y1) return true; }
      return false;
    };
    const portals = level.objects.filter(o => ["mode", "gravity", "speed"].includes(GD.objInfo(o.id).kind));
    const orbs = level.objects.filter(o => GD.objInfo(o.id).kind === "orb");
    const missedP = portals.filter(o => !touched(o)), missedO = orbs.filter(o => !touched(o));
    gate("skips", missedP.length ? "FAIL" : missedO.length ? "WARN" : "PASS",
      missedP.length || missedO.length ? [...missedP, ...missedO].map(o => `${GD.objInfo(o.id).name} at block ${((o.x - 15) / 30).toFixed(0)}`).join("; ") + " not touched by the solved run: block that way past it" : `all ${portals.length} portals and ${orbs.length} orbs on the path`);
  }

  const unsure = level.objects.filter(o => { const d = GD.objInfo(o.id); return ["solid", "hazard", "orb", "pad", "slope"].includes(d.kind) && d.sure === false; });
  const ids = [...new Set(unsure.map(o => o.id))];
  gate("objects", unsure.length ? "WARN" : "PASS", unsure.length ? `${unsure.length} gameplay objects with unconfirmed hitboxes (ids ${ids.join(", ")})` : "all hitboxes confirmed");

  const fails = gates.filter(g => g.status === "FAIL").length, warns = gates.filter(g => g.status === "WARN").length;
  return { ok: fails === 0, fails, warns, gates, solution: r, prejumps: bad, tight, chains, difficulty: diff };
}

function print(name, s) {
  console.log(`== ${name}: ${s.ok ? "READY" : "NOT READY"} (${s.fails} fail, ${s.warns} warn)`);
  for (const g of s.gates) console.log(`   ${g.status.padEnd(4)} ${g.name.padEnd(11)} ${g.value}${g.note ? "  -- " + g.note : ""}`);
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const bi = args.indexOf("--brief");
  const brief = bi >= 0 ? JSON.parse(fs.readFileSync(args[bi + 1], "utf8")) : null;
  const files = args.filter((a, i) => a.endsWith(".gdlvl") && args[i - 1] !== "--brief");
  if (!files.length) { console.log("usage: node tools/score.js <level.gdlvl> [--brief briefs/NN.json] [--json]"); process.exit(1); }
  let bad = 0;
  for (const f of files) {
    const L = readGdlvl(f);
    const s = scoreLevel(L.level, brief);
    if (args.includes("--json")) console.log(JSON.stringify({ name: L.name, ok: s.ok, gates: s.gates }));
    else print(L.name, s);
    if (!s.ok) bad++;
  }
  process.exit(bad ? 2 : 0);
}
module.exports = { scoreLevel, print };
