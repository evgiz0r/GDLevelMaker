// node tools/compose.js briefs/<NN_name>.json [--rounds 8]
//
// A level from a BRIEF (sections, not blocks) -> specs/<NN_name>.json -> levels/<name>.gdlvl,
// then the loop: score every gate (tools/score.js), repair what fails, rebuild, until it passes
// or the rounds run out. Writes the generated spec (so it can be read, diffed, hand-edited) and
// briefs/<NN_name>.log.md (what each round changed and why).
//
// Brief:
// {
//   "name": "GDLM 43 first steps",
//   "idea": "...", "story": "...",              // free text: what the level is for (kept in the log)
//   "difficulty": {"label": "Easy", "minWindowMs": 60},   // labels: Easy Normal Hard Harder Insane Demon
//   "style": "classic", "colours": {...}, "speed": "1x", "song": ..., "seed": 1,
//   "sections": [
//     {"name": "intro", "blocks": 14, "rest": true, "bg": [r,g,b], "ground": [r,g,b]},
//     {"name": "spikes", "blocks": 40, "use": ["single", "double"], "gaps": [4, 7],
//      "args": {"hops": {"n": 3}}, "bg": [...], "ground": [...]},
//     {"name": "end", "blocks": 16, "rest": true}
//   ]
// }
// In a section: `use` = the pattern names it may place (tools/patterns.js); the first time a pattern
// appears in the level it gets room on both sides (introduce, then repeat, then mix -- STYLE.md).
// `gaps` = [min, max] empty columns between chunks (default: calmer early, tighter later).
// `objects` = extra hand-placed spec entries, columns counted from the section start.
const fs = require("fs"), path = require("path");
const { make, build, slug } = require("./make.js");
const { PATTERNS } = require("./patterns.js");
const { scoreLevel, print } = require("./score.js");

// an easier pattern to fall back to when one keeps failing a gate
const EASIER = { triple: "double", double: "single", "block-spike-block": "spike-block", "spike-block": "single",
  gate: "single", hops: "platform", "pad-launch": "double", "orb-pit": "double", stairs: "platform" };

const HARDER = { single: "double", double: "triple", "spike-block": "block-spike-block", platform: "hops" };
const LABELS = ["Easy", "Normal", "Hard", "Harder", "Insane", "Demon"];

function rng(seed) { let s = (seed * 9301 + 49297) % 233280 || 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
function widthOf(name, args) { return PATTERNS[name].fn(args || {}).width; }

// brief + tweaks -> spec. tweaks: { "<section>:<k>": {gap: +n, swap: "name"} } for the k-th chunk.
function compose(brief, tweaks = {}) {
  const rnd = rng(brief.seed || 1);
  const objects = [], placed = [];
  const seen = new Set();
  let col = 0;
  const total = brief.sections.reduce((a, s) => a + s.blocks, 0);
  for (const [si, sec] of brief.sections.entries()) {
    const start = col, end = col + sec.blocks;
    if (sec.bg) objects.push(["colour", Math.max(0, start - 2), { ch: "bg", rgb: sec.bg, secs: sec.secs || 1 }]);
    if (sec.ground) objects.push(["colour", Math.max(0, start - 2), { ch: "ground", rgb: sec.ground, secs: sec.secs || 1 }]);
    for (const e of sec.objects || []) { const c = e.slice(); c[c[0] === "pattern" ? 2 : 1] += start; objects.push(c); }
    if (!sec.rest && sec.use && sec.use.length) {
      const early = start / total < 0.5;
      const [gMin, gMax] = sec.gaps || (early ? [4, 7] : [3, 5]);
      let c = start + 3, k = 0, last = null;
      // draw every random choice up front so a tweak to one chunk does not reshuffle the others
      const draws = Array.from({ length: 64 }, () => [rnd(), rnd()]);
      while (k < 64) {
        const key = `${si}:${k}`, t = tweaks[key] || {};
        const [r1, r2] = draws[k];
        // the newest idea first: an unseen pattern from the list, else a random one (favouring the
        // section's last-listed, its new idea), never the same twice in a row when there is a choice
        let name = sec.use.find(n => !seen.has(n));
        if (!name) {
          const pool = sec.use.length > 1 ? sec.use.filter(n => n !== last) : sec.use;
          const wts = pool.map((n, i) => 1 + (n === sec.use[sec.use.length - 1] ? 1 : 0) + i * 0.2);
          let x = r1 * wts.reduce((a, b) => a + b, 0);
          name = pool[pool.length - 1];
          for (let i = 0; i < pool.length; i++) { x -= wts[i]; if (x <= 0) { name = pool[i]; break; } }
        }
        if (t.swap) name = t.swap;
        const intro = !seen.has(name);
        const args = (sec.args || {})[name] || {};
        const wdt = widthOf(name, args);
        const gap = gMin + Math.floor(r2 * (gMax - gMin + 1)) + (intro && k > 0 ? 2 : 0) + (t.gap || 0);
        if (k > 0) c += gap;
        if (c + wdt > end - 3) break;
        objects.push(["pattern", name, c, 0, args]);
        placed.push({ key, name, from: c, to: c + wdt - 1, section: sec.name });
        seen.add(name); last = name;
        c += wdt; k++;
      }
    }
    col = end;
  }
  objects.push(["block", col + 2, 6]); // marks the end; out of the cube's way
  const spec = { name: brief.name, desc: brief.desc || brief.idea || "", objects };
  for (const k of ["style", "colours", "art", "speed", "song", "offset", "grid", "snap", "seed"]) if (brief[k] != null) spec[k] = brief[k];
  if (brief.sections[0] && brief.sections[0].bg && !spec.colours) spec.colours = { bg: brief.sections[0].bg, ground: brief.sections[0].ground || brief.sections[0].bg };
  return { spec, placed };
}

// which placed chunk a column belongs to (or the next one after it)
function chunkAt(placed, col) {
  return placed.find(p => col >= p.from - 1 && col <= p.to + 1) || placed.find(p => p.from >= col);
}

// Difficulty bands on lib/difficulty.js's scale (log10 attempts): the middle of each label's range.
const BAND_MID = { Easy: 0.15, Normal: 0.55, Hard: 1.15, Harder: 2, Insane: 3.25, Demon: 5 };

function loop(briefFile, rounds = 8) {
  const brief = JSON.parse(fs.readFileSync(briefFile, "utf8"));
  const base = path.basename(briefFile, ".json");
  const target = brief.difficulty && brief.difficulty.label;
  const NL = "\n";
  const log = [`# ${brief.name}${NL}`, `Idea: ${brief.idea || "-"}${NL}`, brief.story ? `Story: ${brief.story}${NL}` : "", `Target: ${JSON.stringify(brief.difficulty || {})}${NL}`];
  const clone = o => JSON.parse(JSON.stringify(o));
  const evaluate = (tweaks) => { const { spec, placed } = compose(brief, tweaks); const { level } = build(spec, briefFile); return { tweaks, spec, placed, s: scoreLevel(level, brief) }; };
  const labelOf = s => { const g = s.gates.find(g => g.name === "difficulty"); return g ? g.value.split(" ")[0] : null; };
  const dist = r => !target || !r.s.difficulty ? 0 : Math.abs(LABELS.indexOf(labelOf(r.s)) - LABELS.indexOf(target)) * 10 + Math.abs(r.s.difficulty.logAttempts - BAND_MID[target]);
  const better = (a, b) => !b || (a.s.ok && !b.s.ok) || (a.s.ok === b.s.ok && dist(a) < dist(b));
  const list = fixes => fixes.map(f => `- ${f.what}${NL}`).join("");
  const blocked = new Set();
  let cur = evaluate({}), best = null;
  for (let round = 1; round <= rounds; round++) {
    const s = cur.s;
    log.push(`${NL}## Round ${round}: ${s.ok ? "READY" : "not ready"} (${s.fails} fail, ${s.warns} warn)${NL}`);
    for (const g of s.gates) log.push(`- ${g.status} ${g.name}: ${g.value}${g.note ? " -- " + g.note : ""}${NL}`);
    console.log(`round ${round}: ${s.ok ? "READY" : "not ready"} (${s.fails} fail, ${s.warns} warn)` + s.gates.filter(g => g.status !== "PASS" && g.name !== "objects").map(g => ` | ${g.name}: ${g.value}`).join(""));
    if (better(cur, best)) best = cur;
    const onTarget = !target || labelOf(s) === target;
    if (s.ok && onTarget) break;
    const tweaks = clone(cur.tweaks), fixes = [];
    if (!s.ok) {
      // blocking problems: room before the chunk that causes it; after two tries, an easier chunk
      const blame = [];
      if (!s.solution.ok) blame.push({ col: s.solution.dieAt.x / 30, why: "dies here" });
      for (const p of s.prejumps) blame.push({ col: p.cueAt, why: `prejump (${p.lead.toFixed(1)} blocks ahead)` });
      for (const c of s.tight) blame.push({ col: c.x / 30 + 1.5, why: `${c.ms} ms window` });
      for (const b of blame) {
        const ch = chunkAt(cur.placed, b.col);
        if (!ch || fixes.some(f => f.key === ch.key)) continue;
        const t = tweaks[ch.key] || (tweaks[ch.key] = {});
        blocked.add(ch.key);
        t.tries = (t.tries || 0) + 1;
        if (t.tries <= 2) { t.gap = (t.gap || 0) + 2; fixes.push({ key: ch.key, what: `2 more columns before ${t.swap || ch.name} at ${ch.from} (${b.why})` }); }
        else if (EASIER[t.swap || ch.name]) { t.swap = EASIER[t.swap || ch.name]; t.tries = 0; fixes.push({ key: ch.key, what: `${ch.name} at ${ch.from} -> ${t.swap} (${b.why})` }); }
      }
      if (!fixes.length) { log.push(`${NL}No automatic repair for what is left: needs a rethink of the brief.${NL}`); break; }
      log.push(`${NL}Repairs:${NL}` + list(fixes));
      cur = evaluate(tweaks);
      continue;
    }
    // ready but off target: try harder (or easier) chunks, four at a time (brief "stepsPerRound"), later sections first;
    // keep the change only if nothing breaks, else block those chunks and try others
    const have = LABELS.indexOf(labelOf(s)), want = LABELS.indexOf(target);
    for (const ch of cur.placed.slice().reverse()) {
      if (fixes.length >= (brief.stepsPerRound || 4)) break;
      if (blocked.has(ch.key)) continue;
      const t = tweaks[ch.key] || (tweaks[ch.key] = {});
      const name = t.swap || ch.name;
      if (have < want) {
        if (HARDER[name]) { t.swap = HARDER[name]; fixes.push({ key: ch.key, what: `${name} at ${ch.from} -> ${t.swap} (below ${target})` }); }
        else if ((t.gap || 0) > -2) { t.gap = (t.gap || 0) - 1; fixes.push({ key: ch.key, what: `1 column less before ${name} at ${ch.from} (below ${target})` }); }
        else blocked.add(ch.key);
      } else if (EASIER[name]) { t.swap = EASIER[name]; fixes.push({ key: ch.key, what: `${name} at ${ch.from} -> ${t.swap} (above ${target})` }); }
      else blocked.add(ch.key);
    }
    if (!fixes.length) {
      log.push(`${NL}Nothing left to adjust toward the target difficulty: ${labelOf(s)} at ${s.difficulty.logAttempts.toFixed(2)} is the most this brief allows ` +
        `(its patterns, its ${brief.difficulty.minWindowMs ?? 60} ms floor and its length). To reach ${target}: make the level longer, ` +
        `allow harder patterns in its sections, or lower the floor.${NL}`);
      console.log(`   target ${target} not reachable with this brief (stuck at ${labelOf(s)} ${s.difficulty.logAttempts.toFixed(2)}): longer sections, harder patterns or a lower minWindowMs`);
      break;
    }
    const cand = evaluate(tweaks);
    if (cand.s.ok) { log.push(`${NL}Tried and kept:${NL}` + list(fixes)); cur = cand; }
    else {
      for (const f of fixes) blocked.add(f.key);
      log.push(`${NL}Tried and undone (` + cand.s.gates.filter(g => g.status === "FAIL").map(g => g.name).join(", ") + `):${NL}` + list(fixes));
    }
  }
  log.push(`${NL}## Kept: ${best.s.ok ? "READY" : "not ready"}, difficulty ${labelOf(best.s) || "-"}${target ? " (target " + target + ")" : ""}${NL}`);
  const specFile = path.join(__dirname, "..", "specs", base + ".json");
  fs.writeFileSync(specFile, JSON.stringify(best.spec, null, 0).replace(/,\["/g, ',\n  ["').replace('"objects":[', '"objects": [\n  ') + "\n");
  fs.writeFileSync(path.join(path.dirname(briefFile), base + ".log.md"), log.join(""));
  console.log(`spec: ${path.relative(process.cwd(), specFile)}  log: ${path.relative(process.cwd(), path.join(path.dirname(briefFile), base + ".log.md"))}`);
  make(specFile);
  print(brief.name, best.s);
  return best;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const ri = args.indexOf("--rounds");
  const file = args.find(a => a.endsWith(".json"));
  if (!file) { console.log("usage: node tools/compose.js briefs/<NN_name>.json [--rounds 8]"); process.exit(1); }
  loop(file, ri >= 0 ? +args[ri + 1] : 8);
}
module.exports = { compose, loop };
