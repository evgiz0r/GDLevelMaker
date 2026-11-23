// node tools/tiercheck.js <level.gdlvl | official N | community> [...] [--tier Easy|Normal|Hard|Harder] [--brief]
//   community = every rated 2.0-2.1 level in local/community/ at its own tier; --brief = one line per level
//
// Does each section of a level look like the sections of rated community levels of its tier?
// For every section (cut at mode/speed portals, 8+ blocks) it compares, per mode:
//   lead-in   blocks from the portal to the first hazard
//   cols      share of the section's columns that hold a hazard
//   haz/10    hazards per 10 blocks
//   gap / run ground modes: empty columns between hazard groups, width of a group
//   open      flying modes: widest vertical opening per column (blocks)
//   s         section length in seconds
// with the same numbers over 2.0-2.1 rated Easy+Normal and Hard+Harder levels
// (knowledge/levels/tier_ref.json, made by `node tools/community.js ref`). Each number is called
// E (sits nearer the middle of Easy+Normal sections) or H (nearer Hard+Harder). A section is
// flagged when most of its calls are the other band from --tier, and "sparse" when fewer of its columns
// hold a hazard than in 3 of 4 Easy+Normal sections of that mode. It also prints the whole-level
// tier guess of lib/difficulty.js (layout model, the difficulty session's), so the two can be read
// side by side.
//
// Layout only: it says nothing about timing (use tools/difficulty.js / DIFFICULTY.md "Tier ladder")
// or fairness (tools/sightread.js). The two bands are what the data tells apart; Easy vs Normal and
// Hard vs Harder barely differ in layout (DIFFICULTY.md).
const fs = require("fs"), path = require("path");
const style = require("./style.js");
const corpus = require("./corpus.js");
const { GD, readGdlvl } = require("./io.js");
const DF = require("../lib/difficulty.js");
const { sectionStats, bandOf, FLY } = require("./community.js");

const REF = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "knowledge", "levels", "tier_ref.json"), "utf8")).bands;
const BANDS = ["Easy+Normal", "Hard+Harder"];
// rank of v among a band's deciles, 0..1 (ties count half)
const rank = (dec, v) => { let lt = 0, eq = 0; for (const d of dec) { if (d < v) lt++; else if (d === v) eq++; } return (lt + eq / 2) / dec.length; };
const f = (v, d = 1) => Number.isFinite(v) ? (+v).toFixed(d) : "-";
// [key, label, decimals, vote weight]: density counts double; section length is shown but does not vote
// (old levels have long sections at every tier)
const FEATS = [["leadIn", "lead-in", 1, 1], ["hazCols", "cols", 0, 2], ["haz10", "haz/10", 1, 2], ["gap", "gap", 0, 1], ["run", "run", 0, 1], ["open", "open", 1, 1], ["secs", "s", 1, 0]];
let BRIEF = false;
const log = (...a) => { if (!BRIEF) console.log(...a); };

// Community sections are short (median ~40 blocks); the official levels' are 100-480. A long
// section is cut into ~40-block windows so its dense stretches are not averaged away; only the
// first window of a section has a lead-in.
function windows(L, a) {
  const cat = o => style.classify(o.id).cat, out = [];
  for (const s of a.sections) {
    const n = s.blocks > 80 ? Math.round(s.blocks / 40) : 1;
    for (let i = 0; i < n; i++) {
      const w = s.blocks / n, x0 = (s.from + i * w) * 30, x1 = x0 + w * 30;
      const inside = n === 1 ? null : L.objects.filter(o => o.x >= x0 && o.x < x1);
      out.push(n === 1 ? s : { mode: s.mode, speed: s.speed, from: s.from + i * w, blocks: w, secs: s.secs / n, start: s.start + i * s.secs / n,
        hazards: inside.filter(o => cat(o) === "hazard").length / w * 10, orbsPads: inside.filter(o => ["orb", "pad"].includes(cat(o))).length, cont: i > 0 });
    }
  }
  return { ...a, sections: out };
}

function check(L, tier) {
  const a = style.analyse(L);
  const S = sectionStats(L, windows(L, a));
  for (const st of S) if (st.cont) st.leadIn = NaN;
  const want = tier ? bandOf(tier) : null;
  log(`\n== ${L.name}: ${a.secs.toFixed(1)} s, ${S.length} sections of 8+ blocks` + (tier ? `, target ${tier} (${want})` : ""));
  const w = GD.makeWorld(L.objects, L.header), lay = DF.layout(w), t = DF.tierFromLayout(lay);
  log(`   whole level (lib/difficulty.js layout model): ${f(t, 2)} = ${DF.tierName(t)};  rests/min ${f(lay.restsPerMin)}, ` +
    `lead-in ${f(lay.leadIn)}, cols with hazard ${Math.round(100 * lay.hazCols)}%, orbs+pads/min ${f(lay.orbsPadsPerMin, 0)}`);
  const tally = { E: 0, H: 0 }, flagged = [];
  let sparseBlocks = 0, allBlocks = 0;
  for (const s of S) {
    const ref = BANDS.map(b => (REF[b] || {})[s.mode]);
    const at = `${String(Math.round(s.from)).padStart(5)} ${s.mode.padEnd(6)} ${s.speed.padEnd(4)} ${String(Math.round(s.blocks)).padStart(4)} bl`;
    if (!ref[0] || !ref[1]) { log(`   ${at}  (no reference for ${s.mode})`); continue; }
    const calls = [];
    for (const [k, label, d, wt] of FEATS) {
      if (!Number.isFinite(s[k]) || !ref[0][k] || !ref[1][k]) continue;
      if ((k === "gap" || k === "run") && FLY.has(s.mode)) continue;
      const rE = rank(ref[0][k], s[k]), rH = rank(ref[1][k], s[k]);
      const c = Math.abs(rE - 0.5) < Math.abs(rH - 0.5) ? "E" : Math.abs(rE - 0.5) > Math.abs(rH - 0.5) ? "H" : "=";
      const v = k === "hazCols" ? Math.round(100 * s[k]) + "%" : f(s[k], d);
      const mE = k === "hazCols" ? Math.round(100 * ref[0][k][4]) + "%" : f(ref[0][k][4], d), mH = k === "hazCols" ? Math.round(100 * ref[1][k][4]) + "%" : f(ref[1][k][4], d);
      calls.push({ k, c, wt, txt: `${label} ${v}${c === "=" ? "" : c}`, why: `${label} ${v} (E ${mE}, H ${mH})` });
    }
    const sum = x => calls.filter(c => c.c === x).reduce((t, c) => t + c.wt, 0), nE = sum("E"), nH = sum("H");
    const looks = nE > nH ? "E" : nH > nE ? "H" : "=";
    if (looks !== "=") tally[looks] += s.blocks;
    const off = want && looks !== "=" && looks !== want[0];
    // emptier than 3 in 4 Easy+Normal sections of this mode (hazard columns): "is there anything to do?"
    const sparse = Number.isFinite(s.hazCols) && ref[0].hazCols && rank(ref[0].hazCols, s.hazCols) < 0.25;
    if (sparse) sparseBlocks += s.blocks;
    allBlocks += s.blocks;
    if (off) flagged.push({ s, calls: calls.filter(c => c.c === looks && c.wt) });
    log(`   ${at}  ${looks === "E" ? "Easy+Normal-like" : looks === "H" ? "Hard+Harder-like" : "between       "}${off ? " <-- off" : sparse ? " sparse " : "        "}  ${calls.map(c => c.txt).join(", ")}`);
  }
  const tot = tally.E + tally.H;
  if (tot) log(`   blocks in Easy+Normal-like sections: ${Math.round(100 * tally.E / tot)}%, Hard+Harder-like: ${Math.round(100 * tally.H / tot)}%`);
  for (const { s, calls } of flagged)
    log(`   off at block ${Math.round(s.from)} (${s.start !== undefined ? f(s.start) + " s, " : ""}${s.mode} ${s.speed}): ${calls.map(c => c.why).join("; ")}`);
  if (allBlocks) log(`   sparse (hazards in fewer columns than 3 in 4 Easy+Normal sections of the mode): ${Math.round(100 * sparseBlocks / allBlocks)}% of the blocks`);
  if (want && !flagged.length) log(`   every section reads as ${want}.`);
  const hShare = tot ? tally.H / tot : NaN;
  if (BRIEF) console.log(`${(L.short || L.name).slice(0, 28).padEnd(28)} ${String(tier || "").padEnd(7)} H-like ${String(Math.round(100 * hShare)).padStart(3)}%  sparse ${String(Math.round(100 * sparseBlocks / Math.max(1, allBlocks))).padStart(3)}%  layout ${f(t, 2)}`);
  return { hShare, layoutTier: t };
}

const args = process.argv.slice(2);
const bi = args.indexOf("--brief"); if (bi >= 0) { BRIEF = true; args.splice(bi, 1); }
const ti = args.indexOf("--tier"), tier = ti >= 0 ? args.splice(ti, 2)[1] : null;
if (tier && !["Easy", "Normal", "Hard", "Harder"].includes(tier)) { console.error("--tier Easy|Normal|Hard|Harder"); process.exit(1); }
if (!args.length) { console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n")); process.exit(0); }
for (let i = 0; i < args.length; i++) {
  if (args[i] === "official") { check(corpus.official(+args[++i]), tier); continue; }
  if (args[i] === "community") { // every rated 2.0-2.1 level in local/community/ at its own tier (in-sample: the reference is made from them)
    const D = path.join(__dirname, "..", "local", "community");
    for (const l of JSON.parse(fs.readFileSync(path.join(D, "list.json"), "utf8")).filter(l => l.era === "2.0-2.1"))
      if (fs.existsSync(path.join(D, l.id + ".gdlvl"))) check(Object.assign(corpus.file(path.join(D, l.id + ".gdlvl")), { short: l.name }), l.tier);
    continue;
  }
  check(corpus.file(args[i]), tier);
}
