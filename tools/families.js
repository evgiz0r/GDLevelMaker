// node tools/families.js [note words]      -- the soft-rule families; with words: which family a note belongs to
//
// One table of every soft-rule FAMILY (the user, 2026-11-23: "each fix to be somewhat a soft rule. and
// reapplied across the level and anything in the future"). Shared by tools/markedit.js (a note -> its family,
// swept over every level), tools/review.js (each issue's effect, effort and fix) and tools/fix.js (the fixes it
// may apply by itself). EDITING.md "Families".
// A family:
//   id        the rule name the checks print (tools/rules.js, softrules.js, edit.js quickChecks, fairness.js,
//             score.js gates) -- `rules` lists every name that belongs to it
//   words     note keywords (regexes) that put a user's note in this family
//   effect    what it does to the player: fairness (a death that is not their fault) > readability (can't
//             tell what to do) > flow (awkward, forced timing) > boredom (flat, samey, long) > look
//   effort    look (decoration only, gameplay untouched) | local (a small gameplay edit at one spot) |
//             redesign (a section rebuilt: compose --section, or by hand)
//   fix       the suggested fix in words
//   auto      (issue) -> edit ops for tools/edit.js, or null: only where the edit is safe and small. fix.js
//             keeps an auto edit only when the level still beats and the issue count drops.
//   check     the tool that finds it; checklist: the knowledge/checklist.md line it comes from
// New families from marks that no check covers yet live in knowledge/families.json (markedit.js --new-family),
// with their words, so the next note like it is recognised; their check is still to be written (listed as such).
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const EFFECT_RANK = { fairness: 5, readability: 4, flow: 3, boredom: 2, look: 1 };
const EFFORT_COST = { look: 1, local: 2, redesign: 4 };
const blockIn = t => { const m = /blocks? (-?[\d.]+)/.exec(t || ""); return m ? +m[1] : null; };

const F = [
  { id: "reactive", rules: ["reactive"], effect: "flow", effort: "local", check: "tools/rules.js (score.js gate reactive)",
    words: [/aw?kk?ward/, /specific (cube )?jump/, /clicks? (very )?unnatural/, /react/, /unnatural/, /calculate where/, /lone block/, /hop/],
    fix: "a landing 3+ blocks wide with 4+ flat columns before the next group; a step right after a spike or 5+ blocks away",
    checklist: "Reactive cube parts",
    auto: i => /lands on a (1|<1)-block spot/.test(i.text) && i.block != null ? [{ op: "extend", what: "block", n: 2, side: "right", at: i.block + 0.5 }] : null },
  { id: "hazards matter", rules: ["hazards matter"], effect: "readability", effort: "local", check: "tools/rules.js",
    words: [/no point/, /pointless/, /(don'?t|dont|no) (need|have) to jump/, /walk (over|across)/, /if we have to jump/],
    fix: "make it a real jump (a gap of 3+, rising slabs) or take the hazards out of the way", checklist: "Every hazard matters",
    auto: i => { const m = /blocks (-?\d+)-(-?\d+)/.exec(i.text); return m ? [{ op: "remove", what: "hazard", from: +m[1], to: +m[2] }] : null; } },
  { id: "symmetry", rules: ["symmetry"], effect: "look", effort: "local", check: "tools/rules.js (score.js gate symmetry)",
    words: [/symmetr/, /not pretty/, /cent(re|er)/, /off.?cent/],
    fix: "the orb over the centre of its spike row (change the row or the landing if the timing wants it off)", checklist: "Symmetry = good",
    auto: i => i.block != null ? [{ op: "centre", what: "orb", at: i.block }] : null },
  { id: "deco coverage", rules: ["deco coverage"], effect: "look", effort: "look", check: "tools/rules.js",
    words: [/empty/, /bare/, /no deco/, /little deco/], fix: "fill the stretch with the level's own deco (modern pass back row, dots)", checklist: "No empty patches", auto: null },
  { id: "jump marks", rules: ["jump marks", "arrows", "indicators"], effect: "readability", effort: "look", check: "tools/softrules.js, tools/indicators.js",
    words: [/arrow/, /indicator/, /chevron/, /too close to the spike/, /inside (the |a )?spike/, /\bmark(ed)?\b.*(spike|jump|high|close)/, /marked jump/],
    fix: "the mark a block in front of the hazard, ~1 block over the surface, only on needed jumps, none under 2 blocks apart",
    checklist: "Jump arrows a block in front of the hazard",
    auto: i => i.block != null && /mark at block|over a hazard|within a block/.test(i.text) ? [{ op: "clearmark", what: "mark", at: i.block }] : null },
  { id: "attempt counter", rules: ["attempt counter"], effect: "look", effort: "look", check: "tools/rules.js",
    words: [/attempt/, /title.*(over|under|behind)/], fix: "the title starts after block 12, clear of GD's Attempt N", checklist: "The title clears GD's",
    auto: () => [{ op: "move", what: "id 914", dx: 8, dy: 0, at: 6, within: 12 }] },
  { id: "clusters", rules: ["clusters"], effect: "flow", effort: "local", check: "tools/clusters.js",
    words: [/very bad jump/, /overlap/, /uneven/, /ragged/, /doubled/], fix: "clean groups: no doubled spikes, no 1-2 column gap inside a group, no hazard right before a pad",
    checklist: "Clean spike groups",
    auto: i => /overlap/.test(i.text) && i.block != null ? [{ op: "remove", what: "hazard", at: i.block, exact: true }] : null },
  { id: "player timing", rules: ["player timing", "timing", "recovery"], effect: "fairness", effort: "local", check: "tools/rules.js, tools/windows.js, score.js gates",
    words: [/tight/, /can'?t fit/, /too precise/, /frame perfect/, /dead end/, /behind a block/, /hard to aim/],
    fix: "widen the window: move what cuts the jump (a block, the next spike) by half a block to a block (polish.js fair pass)",
    checklist: "Windows on the player's route", auto: null },
  { id: "height", rules: ["height"], effect: "boredom", effort: "redesign", check: "tools/flow.js (score.js gate height)",
    words: [/flat/, /no change of height/, /all in flat/], fix: "steps, pillars and pits from the structure library: 12+ floor changes per 10 s", checklist: "Height changes and no repeats", auto: null },
  { id: "repetition", rules: ["repetition", "variety"], effect: "boredom", effort: "redesign", check: "tools/flow.js, tools/variety.js",
    words: [/repeat/, /same/, /boring/, /bland/, /samey/], fix: "new structures: no 4-move pattern twice within 10 s", checklist: "Height changes and no repeats", auto: null },
  { id: "stubs", rules: ["stubs"], effect: "look", effort: "local", check: "tools/softrules.js",
    words: [/entrance.*shape/, /notch/, /hanger/, /flush/], fix: "the roof or floor joins its slope flush at the corridor mouth", checklist: "Corridor mouths flush", auto: null },
  { id: "flash", rules: ["flash"], effect: "readability", effort: "look", check: "tools/softrules.js, tools/readability.js",
    words: [/flash/, /too bright/, /strobe/], fix: "pulses on bars or rarer, toward a tint, never white; one dim sky flash at most", checklist: "Calm, not flashy", auto: null },
  { id: "contrast", rules: ["readability"], effect: "readability", effort: "look", check: "tools/readability.js (renders, ~8 min)",
    words: [/hard to tell what kills/, /contrast/, /can'?t see/, /looks like (an )?(orb|spike|pad)/],
    fix: "hazards stand out (contrast 3+): darker or plainer scenery behind them; no deco that looks like gameplay", checklist: "Readable, measured", auto: null },
  { id: "fairness switch", rules: ["switch"], effect: "fairness", effort: "local", check: "tools/fairness.js",
    words: [/die in the entrance/, /after (the )?portal/, /right after/, /no time/], fix: "an empty lead-in after the portal: cube ~6 blocks, ship ~8, others 2-3; no forced first input", checklist: "No forced input right after a mode", auto: null },
  { id: "fairness chain", rules: ["chain"], effect: "fairness", effort: "local", check: "tools/fairness.js",
    words: [/triple orb/, /orb chain/, /cant adjust/, /can'?t adjust/], fix: "at most 2-3 orbs ~3 blocks apart, with something to correct between taps", checklist: "Orbs", auto: null },
  { id: "fairness floor", rules: ["floor"], effect: "fairness", effort: "local", check: "tools/fairness.js",
    words: [/slope/, /exit.*(block|wave)/], fix: "a flat, readable floor at a portal exit into a ground mode", checklist: "Wave", auto: null },
  { id: "fairness mark", rules: ["mark", "markw"], effect: "fairness", effort: "look", check: "tools/fairness.js",
    words: [/(dont|don'?t) need to jump there/, /mark.*no need/, /no need/], fix: "remove the mark: it sits where no jump is needed and jumping there kills",
    checklist: "Jump arrows only on real inputs", auto: i => i.block != null ? [{ op: "remove", what: "mark", at: i.block }] : null },
  { id: "fairness wave", rules: ["wave"], effect: "fairness", effort: "local", check: "tools/fairness.js", words: [/wave.*(tight|close|narrow)/, /zigzag/],
    fix: "wave turns 100+ ms apart, corridor wider", checklist: "Wave", auto: null },
  { id: "fairness blind", rules: ["blind"], effect: "fairness", effort: "local", check: "tools/fairness.js", words: [/blind/, /two.?step/],
    fix: "a mark or more room before the orb", checklist: "Fair", auto: null },
  { id: "prejumps", rules: ["prejumps"], effect: "fairness", effort: "local", check: "tools/sightread.js", words: [/prejump/, /memori[sz]e/, /couldn'?t see/],
    fix: "the cue must be on screen when the jump must start: move the hazard closer or add a cue", checklist: "No prejumps", auto: null },
  { id: "skips", rules: ["skips"], effect: "fairness", effort: "local", check: "tools/skips.js", words: [/secret way/, /skip/], fix: "block the path past the portal or orb (a roof, a wall)", checklist: "A flying mode's exit portal is framed", auto: null },
  { id: "ending", rules: ["ending"], effect: "boredom", effort: "look", check: "score.js gate ending", words: [/ending/, /too long.*end/], fix: "the sign ~3 blocks after the last input, the level over ~5 after it", checklist: "The level ends right after the last input", auto: null },
  { id: "length", rules: ["length", "mode changes"], effect: "boredom", effort: "redesign", check: "score.js gates length / mode changes", words: [/short/, /snippet/],
    fix: "60 s or more, longer sections (at most ~6 mode changes a minute)", checklist: "Long enough, with long sections", auto: null },
  { id: "craft", rules: ["craft", "look"], effect: "look", effort: "redesign", check: "tools/craft.js", words: [/crude/, /1\.0/, /graphics/, /ugly/, /visuals/],
    fix: "many small pieces over a hazard floor, deco attached to structures (CRAFT.md)", checklist: "Crafted like RobTop's", auto: null },
];

function load() {
  const extra = path.join(ROOT, "knowledge", "families.json");
  let more = [];
  try { more = JSON.parse(fs.readFileSync(extra, "utf8")).map(f => Object.assign({ effort: "local", effect: "flow", auto: null, rules: [f.id], check: "none yet (to write)" }, f, { words: (f.words || []).map(w => new RegExp(w, "i")) })); } catch (e) {}
  return F.concat(more);
}
const ALL = load();
const byRule = new Map(); for (const f of ALL) for (const r of f.rules) byRule.set(r, f);
const of = rule => byRule.get(rule) || null;
// a user's note -> families, best first (count of keyword hits)
function classify(note) {
  const s = String(note || "").toLowerCase();
  return ALL.map(f => ({ f, hits: f.words.filter(w => w.test(s)).length })).filter(x => x.hits).sort((a, b) => b.hits - a.hits || EFFECT_RANK[b.f.effect] - EFFECT_RANK[a.f.effect]).map(x => x.f);
}
// rank: what hurts the player most, cheapest to fix first among equals
function rank(issue) { const f = of(issue.rule) || { effect: "look", effort: "local" }; return (issue.severity === "FAIL" ? 10 : 0) + EFFECT_RANK[f.effect] * 2 - EFFORT_COST[f.effort] * 0.5; }
module.exports = { FAMILIES: ALL, of, classify, rank, blockIn, EFFECT_RANK, EFFORT_COST };

if (require.main === module) {
  const words = process.argv.slice(2).join(" ");
  if (words) { const c = classify(words); console.log(c.length ? c.map(f => `${f.id}  (${f.effect}, ${f.effort}): ${f.fix}`).join("\n") : "no family: a new one (node tools/markedit.js ... --new-family)"); }
  else for (const f of ALL) console.log(`${f.id.padEnd(18)} ${f.effect.padEnd(11)} ${f.effort.padEnd(8)} ${f.auto ? "auto " : "     "} ${f.check}`);
}
