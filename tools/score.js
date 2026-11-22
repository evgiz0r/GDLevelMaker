// node tools/score.js <level.gdlvl> [--brief briefs/NN.json] [--json]
//
// Every gate a level must pass before the user sees it, in one report (STYLE.md "The loop").
// Each gate is PASS, WARN (worth a look, does not block) or FAIL (blocks the hand-over).
//   beatable     the solver beats it (cube/ship/... physics, lib/physics.js)
//   prejumps     no press is committed far ahead of its cue (tools/sightread.js; the user's rule)
//   timing       tightest press window >= the brief's minWindowMs (default 60)
//   difficulty   lib/difficulty.js label vs the brief's target (one step off = WARN)
//   pacing       calm start and end, rests, a rising curve (numbers from the official levels)
//   variety      not one chunk over and over (unless the brief says "repeat": true)
//   readability  spike-like decoration (18-21) never within 2 columns of a hazard
//   colour       a colour change per section (when the brief has sections)
//   sync         presses that can land on a beat (only with a song; WARN only)
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
    gate("prejumps", bad.length ? "FAIL" : "PASS", bad.length ? bad.map(p => `block ${p.to.toFixed(0)} (${p.lead.toFixed(1)} ahead of ${p.cue} at ${p.cueAt.toFixed(0)})`).join("; ") : "none");
  }

  const tight = presses.filter(c => c.ms && c.ms < minMs);
  if (r.ok) gate("timing", tight.length ? "FAIL" : "PASS",
    presses.length ? `tightest ${Math.min(...presses.map(c => c.ms))} ms, want >= ${minMs}` : "no presses",
    tight.map(c => `block ${(c.x / 30).toFixed(0)} ${c.ms} ms`).join("; "));

  let diff = null;
  if (r.ok) {
    diff = GD.difficulty(w, r);
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

  if (brief.grid && r.ok) {
    const pw = GD.SYNC.pressWindows(w, r.events);
    if (pw) {
      let on = 0;
      for (const p of pw.windows) {
        const b0 = GD.SYNC.timeToBeat(brief.grid, brief.offset || 0, p.lo / GD.PHYS.TPS), b1 = GD.SYNC.timeToBeat(brief.grid, brief.offset || 0, (p.hi + 1) / GD.PHYS.TPS);
        if (Math.floor(b1 * 2) >= Math.ceil(b0 * 2)) on++;
      }
      const share = on / Math.max(1, pw.windows.length);
      gate("sync", share >= (brief.syncShare ?? 0.6) ? "PASS" : "WARN", `${on}/${pw.windows.length} presses can land on a beat or half-beat`);
    }
  }

  const unsure = level.objects.filter(o => { const d = GD.objInfo(o.id); return ["solid", "hazard", "orb", "pad", "slope"].includes(d.kind) && d.sure === false; });
  const ids = [...new Set(unsure.map(o => o.id))];
  gate("objects", unsure.length ? "WARN" : "PASS", unsure.length ? `${unsure.length} gameplay objects with unconfirmed hitboxes (ids ${ids.join(", ")})` : "all hitboxes confirmed");

  const fails = gates.filter(g => g.status === "FAIL").length, warns = gates.filter(g => g.status === "WARN").length;
  return { ok: fails === 0, fails, warns, gates, solution: r, prejumps: bad, tight, difficulty: diff };
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
