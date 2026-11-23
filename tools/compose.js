// node tools/compose.js briefs/<NN_name>.json [--rounds 8]
// node tools/compose.js briefs/<NN_name>.json --dry            -- where each section lands, nothing solved
// node tools/compose.js briefs/<NN_name>.json --section 3      -- score one section alone (local/sections/)
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
// `mode`: "ship" or "wave" makes the section one corridor (ship-tunnel / wave-zigzag) with its
// portal on the ground and a framed cube portal at its end; `args` {"ship-tunnel": {...}} tune it.
// `mode`: "ball" = a ball corridor (ball-run: floor and roof spikes, one flip each); "upside" = the
// cube upside down under a ceiling (gravity portal in and out), its `use` patterns hung from the
// ceiling (only block/spike patterns). The cube section after any of these starts with a lead-in.
// Song-driven sections: `"beats": n` instead of "blocks" (the brief needs a "song"; the grid comes
// from local/beats like make.js's "b12" columns), so every section starts on a beat of the song --
// put the boundaries on the song's own section changes (local/beats/<song>.json "sections") and its
// 4/8-bar phrases. The look of a section: "bg", "ground", "line", "obj" colours (changed on its first
// beat, `secs` fade), "flash": true (the background flashes bright on that beat, for a drop), and
// "deco": share of free columns with ground decoration (default 0.25; 0 for a bare, calm break).
// "sectionwise": true in the brief (default for levels over 90 s) scores each section on its own
// (the rest of the level left out; every section starts and ends as a cube on the ground) and keeps
// the scores of unchanged sections, so a repair round re-solves only what it changed; the whole
// level is scored once at the end.
const fs = require("fs"), path = require("path");
const { make, build, slug } = require("./make.js");
const { PATTERNS, expand, mirrorUp } = require("./patterns.js");
const PH = require("../lib/physics.js"), SY = require("../lib/sync.js");
const { scoreLevel, print } = require("./score.js");

// an easier pattern to fall back to when one keeps failing a gate
const EASIER = { triple: "double", double: "single", "block-spike-block": "spike-block", "spike-block": "single",
  gate: "single", hops: "platform", "pad-launch": "double", "orb-pit": "double", stairs: "platform" };

const HARDER = { single: "double", double: "triple", "spike-block": "block-spike-block", platform: "hops" };
const LABELS = ["Easy", "Normal", "Hard", "Harder", "Insane", "Demon"];

function rng(seed) { let s = (seed * 9301 + 49297) % 233280 || 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
function widthOf(name, args) { return PATTERNS[name].fn(args || {}).width; }

// brief + tweaks -> spec. tweaks: { "<section>:<k>": {gap: +n, swap: "name"} } for the k-th chunk.
// section lengths in beats -> start columns (the player's centre on the section's first beat)
function beatColumns(brief) {
  const { songOf, gridOf } = require("./make.js");
  const grid = brief._grid || (brief._grid = brief.grid ? gridOf(brief) : gridOf(brief, songOf(brief)));
  const sp = { "0.5x": 0, "1x": 1, "2x": 2, "3x": 3, "4x": 4 }[brief.speed || "1x"] ?? 1;
  const ups = PH.SPEEDS[sp].x * 60;
  return b => (SY.SYNC.beatToTime(grid, brief.offset || 0, b) * ups - 15) / 30;
}
function sectionBlocks(brief) {
  if (!brief.sections.some(s => s.beats)) return brief.sections.map(s => s.blocks);
  const colOf = beatColumns(brief);
  let b = 1, prev = 0;
  return brief.sections.map(s => {
    if (!s.beats) { prev += s.blocks; return s.blocks; }
    b += s.beats;
    const next = Math.round(colOf(b)), n = next - prev;
    prev = next;
    return n;
  });
}

function compose(brief, tweaks = {}) {
  const rnd = rng(brief.seed || 1);
  const objects = [], placed = [], ranges = [], deco = [];
  const seen = new Set();
  let col = 0, prevFlying = false, flyEnd = -99;
  const lens = sectionBlocks(brief);
  const total = lens.reduce((a, n) => a + n, 0);
  for (const [si, sec0] of brief.sections.entries()) {
    const sec = Object.assign({}, sec0, { blocks: lens[si] });
    const start = col, end = col + sec.blocks, i0 = objects.length;
    const at = si === 0 ? 0 : (sec0.beats ? start : Math.max(0, start - 2));  // on the beat when in beats
    for (const ch of ["bg", "ground", "line", "obj"]) if (sec[ch]) {
      if (ch === "bg" && sec.flash && si > 0) {
        // a drop: flash bright on the beat, then settle on the section's colour
        objects.push(["colour", at, { ch: "bg", rgb: sec.bg.map(v => Math.min(255, v + 150)), secs: 0 }]);
        objects.push(["colour", at + 0.5, { ch: "bg", rgb: sec.bg, secs: 0.6 }]);
      } else objects.push(["colour", at, { ch, rgb: sec[ch], secs: sec.secs ?? (sec0.beats ? 0.4 : 1) }]);
    }
    if (sec.deco != null) deco.push([start, sec.deco]);
    for (const e of sec.objects || []) { const c = e.slice(); c[c[0] === "pattern" ? 2 : 1] += start; objects.push(c); }
    if (sec.mode === "ball") {
      const key = `${si}:0`, t = tweaks[key] || {};
      const args = Object.assign({ w: sec.blocks - 3, gap: 5, every: 9, lead: 6 }, (sec.args || {})["ball-run"] || {}, { portal: true, exit: "cube", portalRow: 1 });
      if (t.room) args.every += 2 * t.room;
      objects.push(["pattern", "ball-run", start + 1, 0, args]);
      placed.push({ key, name: "ball-run", from: start + 1, to: start + 1 + widthOf("ball-run", args), section: sec.name, flying: true });
      ranges.push([i0, objects.length, start, end]);
      col = end; prevFlying = true; flyEnd = end;
      continue;
    }
    // a flying section: one corridor with its own portal (entered from the ground) and a framed
    // cube portal at its end (tools/patterns.js). Repairs widen its room.
    if (sec.mode === "ship" || sec.mode === "wave") {
      const key = `${si}:0`, t = tweaks[key] || {};
      const name = sec.mode === "ship" ? "ship-tunnel" : "wave-zigzag";
      const base = sec.mode === "ship"
        ? { w: sec.blocks - 3, gap: 5, amp: 1.5, base: 0, teeth: true, lead: 6 }
        : { seg: 4, legs: Math.max(2, Math.floor((sec.blocks - 3) / 4)), gap: 4, low: 1, slopes: true };
      const args = Object.assign(base, (sec.args || {})[name] || {}, { portal: true, exit: "cube", portalRow: 1 });
      if (t.room) args.gap = (args.gap || 4) + t.room;
      objects.push(["pattern", name, start + 1, 0, args]);
      placed.push({ key, name, from: start + 1, to: start + 1 + widthOf(name, args), section: sec.name, flying: true });
      ranges.push([i0, objects.length, start, end]);
      col = end; prevFlying = true; flyEnd = end;
      continue;
    }
    const upside = sec.mode === "upside", ceil = (sec.args && sec.args.ceil) || 6;
    if (upside) {
      // ceiling from start+1 to end-1, its gravity portal on the section's first beat, out at its last column
      objects.push(["pattern", "ceiling", start + 1, 0, { w: sec.blocks - 2, ceil, portal: true, exit: true }]);
    }
    if (!sec.rest && sec.use && sec.use.length) {
      const early = start / total < 0.5;
      const [gMin, gMax] = sec.gaps || (early ? [4, 7] : [3, 5]);
      // after a flying section the cube lands from its exit portal: a calm lead-in first
      // (rated low-tier levels: ~6 blocks after a cube portal, knowledge/levels/modes_low_tier.md)
      // (8 here: the cube first falls out of the exit portal, ~0.3 s)
      // upside down: the cube first falls up to the ceiling (~0.3 s), so 8 columns after its portal
      let c = upside ? start + 10 : start + (prevFlying ? Math.max(3, 8 - (start - flyEnd)) : 3), k = 0, last = null;
      const stop = upside ? end - 9 : end - 3;   // upside: room to read and take the exit portal
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
        if (c + wdt > stop) break;
        if (upside) objects.push(...mirrorUp(expand(name, c, 0, args), ceil));
        else objects.push(["pattern", name, c, 0, args]);
        placed.push({ key, name, from: c, to: c + wdt - 1, section: sec.name });
        seen.add(name); last = name;
        c += wdt; k++;
      }
      prevFlying = false;
    }
    if (upside) { prevFlying = true; flyEnd = end; }   // the cube drops from the ceiling: a lead-in next
    ranges.push([i0, objects.length, start, end]);
    col = end;
  }
  objects.push(["block", col + 2, 6]); // marks the end; out of the cube's way
  const spec = { name: brief.name, desc: brief.desc || brief.idea || "", objects };
  if (deco.length) spec.decoDensity = deco;
  for (const k of ["style", "colours", "art", "speed", "song", "offset", "grid", "snap", "seed"]) if (brief[k] != null) spec[k] = brief[k];
  if (brief.sections[0] && brief.sections[0].bg && !spec.colours) spec.colours = { bg: brief.sections[0].bg, ground: brief.sections[0].ground || brief.sections[0].bg };
  return { spec, placed, ranges };
}
// the spec of one section alone (the rest of the level left out), for sectionwise scoring
function sectionSpec(spec, range) {
  const [i0, i1, , end] = range;
  return Object.assign({}, spec, { objects: spec.objects.slice(i0, i1).concat([["block", end + 2, 6]]) });
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
  const whole = (tweaks) => { const { spec, placed } = compose(brief, tweaks); const { level } = build(spec, briefFile); return { tweaks, spec, placed, s: scoreLevel(level, brief) }; };
  // sectionwise: each section scored alone, unchanged sections from the cache (see the top)
  const lens = sectionBlocks(brief);
  const secs = lens.reduce((a, n) => a + n, 0) / 10.4;
  const sectionwise = brief.sectionwise ?? secs > 90;
  const cache = new Map();
  const BLOCKING = new Set(["beatable", "prejumps", "timing", "recovery", "skips"]);
  const RANK = { PASS: 0, WARN: 1, FAIL: 2 };
  const bySection = (tweaks) => {
    const { spec, placed, ranges } = compose(brief, tweaks);
    const parts = [];
    for (const [si, rg] of ranges.entries()) {
      const sub = sectionSpec(spec, rg);
      if (!sub.objects.some(o => !["colour", "fade", "zoom"].includes(o[0]))) continue;
      const key = JSON.stringify(sub.objects);
      if (!cache.has(key)) {
        const t0 = Date.now();
        const { level } = build(sub, briefFile);
        // section-local gates only: pacing / colour / difficulty are for the whole level
        const sc = scoreLevel(level, Object.assign({}, brief, { sections: undefined }));
        sc.gates = sc.gates.filter(g => BLOCKING.has(g.name));
        sc.ok = !sc.gates.some(g => g.status === "FAIL");
        console.log(`   section ${si} ${brief.sections[si].name}: ${sc.ok ? "ok" : "FAIL " + sc.gates.filter(g => g.status === "FAIL").map(g => g.name).join(",")} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
        cache.set(key, sc);
      }
      parts.push({ si, s: cache.get(key) });
    }
    // one combined score: the worst status of each gate, named by its section
    const gates = [];
    for (const name of BLOCKING) {
      let worst = null;
      for (const p of parts) for (const g of p.s.gates) if (g.name === name && (!worst || RANK[g.status] > RANK[worst.status])) worst = Object.assign({}, g, { value: `${brief.sections[p.si].name}: ${g.value}` });
      if (worst) gates.push(worst);
    }
    const s = { ok: parts.every(p => p.s.ok), fails: gates.filter(g => g.status === "FAIL").length, warns: gates.filter(g => g.status === "WARN").length, gates, parts: parts.map(p => p.s), difficulty: null };
    return { tweaks, spec, placed, s };
  };
  const evaluate = sectionwise ? bySection : whole;
  if (sectionwise) console.log(`sectionwise: ${brief.sections.length} sections scored one by one (${secs.toFixed(0)} s level)`);
  const labelOf = s => { const g = s.gates.find(g => g.name === "difficulty"); return g ? g.value.split(" ")[0] : null; };
  const dist = r => !target || !r.s.difficulty ? 0 : Math.abs(LABELS.indexOf(labelOf(r.s)) - LABELS.indexOf(target)) * 10 + Math.abs(r.s.difficulty.logAttempts - BAND_MID[target]);
  // sound = no FAIL but the difficulty one: being off the target steers the hardening below, it is
  // not a defect to repair (GDLM 45 v5 stopped in round 1 on "Easy, want Hard" when it was one)
  const sound = s => !s.gates.some(g => g.status === "FAIL" && g.name !== "difficulty");
  const better = (a, b) => !b || (sound(a.s) && !sound(b.s)) || (sound(a.s) === sound(b.s) && dist(a) < dist(b));
  const list = fixes => fixes.map(f => `- ${f.what}${NL}`).join("");
  const blocked = new Set();
  let cur = evaluate({}), best = null;
  for (let round = 1; round <= rounds; round++) {
    const s = cur.s;
    log.push(`${NL}## Round ${round}: ${s.ok ? "READY" : "not ready"} (${s.fails} fail, ${s.warns} warn)${NL}`);
    for (const g of s.gates) log.push(`- ${g.status} ${g.name}: ${g.value}${g.note ? " -- " + g.note : ""}${NL}`);
    console.log(`round ${round}: ${s.ok ? "READY" : "not ready"} (${s.fails} fail, ${s.warns} warn)` + s.gates.filter(g => g.status !== "PASS" && g.name !== "objects").map(g => ` | ${g.name}: ${g.value}`).join(""));
    if (better(cur, best)) best = cur;
    const onTarget = !target || sectionwise || labelOf(s) === target;
    if (s.ok && onTarget) break;
    const tweaks = clone(cur.tweaks), fixes = [];
    if (!sound(s)) {
      // blocking problems: room before the chunk that causes it; after two tries, an easier chunk
      const blame = [];
      for (const q of s.parts ? s.parts.filter(q => !q.ok) : [s]) {
        if (!q.solution.ok) blame.push({ col: q.solution.dieAt.x / 30, why: "dies here" });
        if ((q.gates.find(g => g.name === "prejumps") || {}).status === "FAIL") for (const p of q.prejumps) blame.push({ col: p.cueAt, why: `prejump (${p.lead.toFixed(1)} blocks ahead)` });
        for (const c of q.tight) blame.push({ col: c.x / 30 + 1.5, why: `${c.ms} ms window` });
        if ((q.gates.find(g => g.name === "recovery") || {}).status === "FAIL")
          for (const c of q.chains) blame.push({ col: c.x / 30 + 1.5, why: `jump ${c.ms} ms after landing` });
      }
      for (const b of blame) {
        const ch = chunkAt(cur.placed, b.col);
        if (!ch || fixes.some(f => f.key === ch.key)) continue;
        const t = tweaks[ch.key] || (tweaks[ch.key] = {});
        blocked.add(ch.key);
        if (ch.flying) { if ((t.room || 0) < 2) { t.room = (t.room || 0) + 1; fixes.push({ key: ch.key, what: `1 more row of room in the ${ch.name} at ${ch.from} (${b.why})` }); } continue; }
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
      if (ch.flying) {
        // a corridor: one row less of room (ball: hazards 2 columns closer), once; the timing and
        // recovery gates still decide whether it stays
        if (have < want && (t.room || 0) > -1) { t.room = (t.room || 0) - 1; fixes.push({ key: ch.key, what: `1 row less room in the ${ch.name} at ${ch.from} (below ${target})` }); }
        else blocked.add(ch.key);
        continue;
      }
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
    if (sound(cand.s) && dist(cand) <= dist(cur)) { log.push(`${NL}Tried and kept:${NL}` + list(fixes)); cur = cand; }
    else {
      for (const f of fixes) blocked.add(f.key);
      log.push(`${NL}Tried and undone (` + cand.s.gates.filter(g => g.status === "FAIL").map(g => g.name).join(", ") + `):${NL}` + list(fixes));
    }
  }
  if (sectionwise) {
    // the whole level once: difficulty, pacing, colour, sync, lead-in over all of it
    console.log("whole level: one full score (slow for long levels)");
    const t0 = Date.now();
    const full = whole(best.tweaks);
    log.push(`${NL}## Whole level (${((Date.now() - t0) / 1000).toFixed(0)} s to score): ${full.s.ok ? "READY" : "not ready"}${NL}`);
    for (const g of full.s.gates) log.push(`- ${g.status} ${g.name}: ${g.value}${g.note ? " -- " + g.note : ""}${NL}`);
    best = full;
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
  const si = args.indexOf("--section");
  if (args.includes("--dry") || si >= 0) {
    // --dry: where each section starts (column, seconds) and what it holds; --section n: score that
    // section alone (as the sectionwise loop does) and write it to local/sections/ for the viewer
    const brief = JSON.parse(fs.readFileSync(file, "utf8"));
    const { spec, placed, ranges } = compose(brief);
    for (const [i, rg] of ranges.entries()) {
      if (si >= 0 && i !== +args[si + 1]) continue;
      const sec = brief.sections[i];
      console.log(`${String(i).padStart(2)} ${sec.name.padEnd(20)} col ${String(rg[2]).padStart(5)}-${String(rg[3]).padEnd(5)} ${(rg[2] / 10.39).toFixed(1).padStart(6)} s  ${sec.mode || (sec.rest ? "rest" : "cube")}  ` +
        placed.filter(p => p.key.startsWith(i + ":")).map(p => p.name).join(" "));
      if (si >= 0) {
        const sub = sectionSpec(spec, rg);
        sub.name = `${brief.name} s${i}`;
        const { level, rec } = build(sub, file);
        const out = path.join(__dirname, "..", "local", "sections", slug(sub.name) + ".gdlvl");
        fs.mkdirSync(path.dirname(out), { recursive: true });
        require("./io.js").writeGdlvl(out, rec, level);
        const sc = scoreLevel(level, Object.assign({}, brief, { sections: undefined }));
        print(sub.name, sc);
        console.log("written " + path.relative(process.cwd(), out));
      }
    }
    if (si < 0) console.log(`total ${ranges[ranges.length - 1][3]} columns, ${(ranges[ranges.length - 1][3] / 10.39).toFixed(0)} s`);
  } else loop(file, ri >= 0 ? +args[ri + 1] : 8);
}
module.exports = { compose, loop };
