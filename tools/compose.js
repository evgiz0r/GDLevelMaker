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
// "palette": "light" (a happy level: pastel block fills, nothing dark; pair it with "art": {"bg": 13}, the
// flat white background texture that shows its colour as set -- the default art 1 turns bright colours
// muddy, measured over the game's 59 bg textures). "sectionwise": true in the brief (default for levels over 90 s) scores each section on its own
// (the rest of the level left out; every section starts and ends as a cube on the ground) and keeps
// the scores of unchanged sections, so a repair round re-solves only what it changed; the whole
// level is scored once at the end.
// "structures" (default on; false = off): every plain cube section (not rest, no mode) also gets ONE
// structure from the ranked library (tools/structures.js, STRUCTURES.md) as its newest idea, a
// different one per section, best-ranked first within the brief's difficulty label, skipping what the
// level already uses; a section names its own with `use: ["s:<id>"]`, or "structures": false for none.
if (require.main === module) require("./heavy.js").claim();   // one heavy job at a time (tools/heavy.js)
const fs = require("fs"), path = require("path");
const { make, build, slug } = require("./make.js");
const { PATTERNS, expand, mirrorUp } = require("./patterns.js");
const PH = require("../lib/physics.js"), SY = require("../lib/sync.js"), { GD } = require("./io.js");
const { scoreLevel, print } = require("./score.js");

// an easier pattern to fall back to when one keeps failing a gate
const EASIER = { triple: "double", double: "single", "block-spike-block": "spike-block", "spike-block": "single",
  gate: "single", hops: "platform", "pad-launch": "double", "orb-pit": "double", stairs: "platform" };

const HARDER = { single: "double", double: "triple", "spike-block": "block-spike-block", platform: "hops" };
const LABELS = ["Easy", "Normal", "Hard", "Harder", "Insane", "Demon"];

function rng(seed) { let s = (seed * 9301 + 49297) % 233280 || 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
function widthOf(name, args) { return PATTERNS[name].fn(args || {}).width; }
// how high a pattern ends (rows of block in its last column): the cube drops that far after it
function endHeight(name, args) {
  const r = PATTERNS[name].fn(args || {}), last = r.width - 1;
  return r.objects.filter(([t, c]) => t === "block" && c === last).reduce((h, [, , row]) => Math.max(h, row + 1), 0);
}

// brief + tweaks -> spec. tweaks: { "<section>:<k>": {gap: +n, swap: "name"} } for the k-th chunk.
// section lengths in beats -> start columns (the player's centre on the section's first beat)
function beatColumns(brief) {
  const { songOf, gridOf } = require("./make.js");
  const grid = brief._grid || (brief._grid = brief.grid ? gridOf(brief) : gridOf(brief, songOf(brief)));
  const sp = { "0.5x": 0, "1x": 1, "2x": 2, "3x": 3, "4x": 4 }[brief.speed || "1x"] ?? 1;
  const ups = PH.SPEEDS[sp].x * 60;
  return b => (SY.SYNC.beatToTime(grid, brief.offset || 0, b) * ups - 15) / 30;
}
const SPEED_IX = { "0.5x": 0, "1x": 1, "2x": 2, "3x": 3, "4x": 4 };
const upsOf = sp => PH.SPEEDS[SPEED_IX[sp || "1x"] ?? 1].x * 60;
// a section's speed: its own "speed", else the one before it, else the brief's
function speedsOf(brief) { let cur = brief.speed || "1x"; return brief.sections.map(s => (cur = s.speed || cur)); }
function sectionBlocks(brief) {
  if (!brief.sections.some(s => s.beats)) return brief.sections.map(s => s.blocks);
  const { songOf, gridOf } = require("./make.js");
  const grid = brief._grid || (brief._grid = brief.grid ? gridOf(brief) : gridOf(brief, songOf(brief)));
  const sp = speedsOf(brief);
  // each section runs from its first beat to the next section's, at its own speed (speed portals on
  // its first column), so every boundary stays on its beat whatever the speeds
  let b = 1, t = 0, x = -15, prev = 0;
  return brief.sections.map((s, i) => {
    if (!s.beats) { prev += s.blocks; x += s.blocks * 30; t += s.blocks * 30 / upsOf(sp[i]); return s.blocks; }
    b += s.beats;
    const t1 = SY.SYNC.beatToTime(grid, brief.offset || 0, b);
    x += (t1 - t) * upsOf(sp[i]); t = t1;
    const next = Math.round(x / 30), n = next - prev;
    prev = next;
    return n;
  });
}

// one library structure per plain cube section (see the header: "structures")
function structurePicks(brief, tweaks = {}) {
  const out = {};
  if (brief.structures === false) return out;
  let pool;
  try { pool = require("./structures.js").ranked({ registered: true, maxTier: (brief.difficulty || {}).label || "Normal" }); } catch (e) { return out; }
  const used = new Set(brief.sections.flatMap(s => s.use || []));
  // checked at 1x only: sections at another speed get none, and speed-changing ones (they end on a 1x
  // portal) are never placed automatically
  const sp = speedsOf(brief);
  pool = pool.filter(r => !r.tags.includes("speed"));
  const want = brief.sections.map((s, i) => [s, i]).filter(([s, i]) => !s.rest && !s.mode && s.use && s.use.length && s.structures !== false && sp[i] === "1x");
  // spread the mechanics: a mode or tag not yet in the level first
  const tagsUsed = new Set();
  for (const [, i] of want) {
    const fresh = pool.filter(r => !used.has("s:" + r.id));
    // a reseeded section (tweaks "reseed:<i>", a variant or a backtrack) takes the n-th alternative
    const rs = tweaks["reseed:" + i] || 0, novel = fresh.filter(r => ![r.mode, ...r.tags].some(t => tagsUsed.has(t)));
    const pick = rs ? (novel.length ? novel : fresh)[rs % Math.max(1, (novel.length ? novel : fresh).length)] : (novel[0] || fresh[0]);
    if (!pick) break;
    out[i] = "s:" + pick.id; used.add(out[i]);
    [pick.mode, ...pick.tags].forEach(t => t !== "cube" && tagsUsed.add(t));
  }
  return out;
}

function compose(brief, tweaks = {}) {
  const rnd = rng(brief.seed || 1);
  const objects = [], placed = [], ranges = [], deco = [], firsts = [], looks = [];
  const seen = new Set();
  let col = 0, prevFlying = false, flyEnd = -99;
  const lens = sectionBlocks(brief), speeds = speedsOf(brief);
  // no dead air at the end (polish's tools/deadair.js; the user on hellgate: "the ending is too long where
  // nothing happens"; GD ends a level at its furthest object): the closing rest holds the signature (3
  // blocks in, 7 wide) and a little run, ~14 blocks
  { const li = brief.sections.length - 1; if (brief.sections[li].rest && brief.signature !== false) lens[li] = Math.min(lens[li], 14); }
  // length and mode changes, before anything is placed (QUALITY.md: official levels 1-10 run 78-95 s and
  // change mode 1.3-5.2 times a minute; ours were short with 7-17 a minute -- snippets). A note, not a stop:
  // the brief decides (score.js gates "length" / "mode changes"; "accept" them with the reason)
  {
    const secs = lens.reduce((a, n, i) => a + n * 30 / upsOf(speeds[i]), 0);
    let ch = 0; for (let i = 1; i < brief.sections.length; i++) if ((brief.sections[i].mode || "cube").replace("upside", "cube") !== (brief.sections[i - 1].mode || "cube").replace("upside", "cube")) ch++;
    if (secs < 60) console.log(`   NOTE the brief is ${secs.toFixed(0)} s: official levels run 78-95 s (QUALITY.md)`);
    if (ch / (secs / 60) > 6) console.log(`   NOTE ${ch} mode changes in ${secs.toFixed(0)} s = ${(ch / (secs / 60)).toFixed(1)} a minute: official 1.3-5.2; longer sections with one mode each`);
  }
  const total = lens.reduce((a, n) => a + n, 0);
  let lastSpeed = brief.speed || "1x", h = 0, prevUpside = false;
  const extra = structurePicks(brief, tweaks);
  for (const [si, sec0] of brief.sections.entries()) {
    const sec = Object.assign({}, sec0, { blocks: lens[si] });
    if (extra[si]) sec.use = [...sec.use, extra[si]];
    const start = col, end = col + sec.blocks, i0 = objects.length;
    const at = si === 0 ? 0 : (sec0.beats ? start : Math.max(0, start - 2));  // on the beat when in beats
    for (const ch of ["bg", "ground", "line", "obj"]) if (sec[ch]) {
      if (ch === "bg" && sec.flash && si > 0) {
        // a drop: a short shift toward a lighter tint of the section's own colour on the beat (a third of
        // the way to white, not +150 near white), then settle -- calm, not flashy (the user on hellgate:
        // "waaaay too flashy ... hard to tell what kills you"; checklist "Calm, not flashy")
        objects.push(["colour", at, { ch: "bg", rgb: sec.bg.map(v => Math.round(v + (255 - v) / 3)), secs: 0.1 }]);
        objects.push(["colour", at + 0.5, { ch: "bg", rgb: sec.bg, secs: 0.8 }]);
      } else objects.push(["colour", at, { ch, rgb: sec[ch], secs: sec.secs ?? (sec0.beats ? 0.4 : 1) }]);
    }
    if (sec.deco != null) deco.push([start, sec.deco]);
    // the modern pass's section (tools/decorate.js modernPass): kind, and colours from the section's bg
    { const bg = sec.bg || (looks.length ? looks[looks.length - 1].bg : [40, 60, 160]);
      const kind = sec.rest ? "rest" : sec.deco === 0 ? "break" : (sec.mode || "cube");
      looks.push({ from: start, to: end, kind, bg, flash: !!sec.flash, fill: bg.map(v => Math.min(255, Math.round(brief.palette === "light" ? v * 0.45 + 140 : v * 0.8 + 60))), light: bg.map(v => Math.min(255, v + 110)) }); }
    for (const e of sec.objects || []) { const c = e.slice(); c[c[0] === "pattern" ? 2 : 1] += start; objects.push(c); }
    // a mode section right after a corridor: the cube leaves the exit portal in the air, so its own
    // portal comes `land` columns later, once the cube is down (GDLM 45 v5 round 2: the cube fell past
    // the ball portal that stood right after the ship's exit, and skipped the ball)
    // (8 after an upside-down part: the cube falls from the ceiling first; 4 left it mid-air at the next
    // portal, fairness gate, GDLM 47)
    let land = prevFlying && start - flyEnd < 4 ? (prevUpside ? 8 : 4) : 0;
    // a speed portal where the player passes: on the ground row, before this section's own portal (and
    // after the landing room). Above a corridor (row 5) the wave flew under it and the speed never
    // changed (GDLM 47 round 1: a 0.5x section ran on into the next three).
    if (speeds[si] !== lastSpeed) {
      const flying = sec.mode && sec.mode !== "upside";
      objects.push([speeds[si] + " speed", flying || sec.mode === "upside" ? start + land - 1 : start, 1]);
      // the section's own portal 3 columns later: a speed change is a "switch" too, and the next mode's
      // first input closed 192 ms after it (fairness gate, GDLM 47's 1x speed + wave portal)
      if (flying) land += 3;
      lastSpeed = speeds[si];
    }
    if (sec.mode === "ball") {
      const key = `${si}:0`, t = tweaks[key] || {};
      const args = Object.assign({ w: sec.blocks - 3 - land, gap: 5, every: 9, lead: 6 }, (sec.args || {})["ball-run"] || {}, { portal: true, exit: "cube", portalRow: 1 });
      if (t.room) args.every += 2 * t.room;
      objects.push(["pattern", "ball-run", start + 1 + land, 0, args]);
      placed.push({ key, name: "ball-run", from: start + 1 + land, to: start + 1 + land + widthOf("ball-run", args), section: sec.name, flying: true });
      ranges.push([i0, objects.length, start, end]);
      col = end; prevFlying = true; flyEnd = end; prevUpside = false;
      continue;
    }
    // a flying section: one corridor with its own portal (entered from the ground) and a framed
    // cube portal at its end (tools/patterns.js). Repairs widen its room.
    if (sec.mode === "ship" || sec.mode === "wave") {
      const key = `${si}:0`, t = tweaks[key] || {};
      const name = sec.mode === "ship" ? "ship-tunnel" : "wave-zigzag";
      const base = sec.mode === "ship"
        ? { w: sec.blocks - 3 - land, gap: 5, amp: 1.5, base: 0, teeth: true, lead: 6 }
        : (() => {
          // wave turns need room: level stretches at each peak and valley (2 columns at Easy/Normal,
          // 1 above) and 2 at the entry -- with pure 45-degree legs a turn was 13-88 ms (GDLM 44, physics
          // 2026-11-23); aim: every wave input >= ~150 ms at Normal (tools/windows.js)
          const easy = ["Easy", "Normal"].includes((brief.difficulty || {}).label || "Easy"), flat = easy ? 2 : 1, seg = 4;
          // entry: 4 level columns with 8 rows of room (leadGap, gd-polish): a wave entering with the
          // button held or not has ~300 ms before roof or floor (fairness gate: wave deadline 300 ms)
          return { seg, flat, lead: 4, leadGap: 8, legs: Math.max(2, Math.floor((sec.blocks - 5 - land) / (seg + flat))), gap: easy ? 5 : 4, low: 2, slopes: true };
        })();
      const args = Object.assign(base, (sec.args || {})[name] || {}, { portal: true, exit: "cube", portalRow: 1 });
      if (t.room) args.gap = (args.gap || 4) + t.room;
      objects.push(["pattern", name, start + 1 + land, 0, args]);
      placed.push({ key, name, from: start + 1 + land, to: start + 1 + land + widthOf(name, args), section: sec.name, flying: true });
      ranges.push([i0, objects.length, start, end]);
      col = end; prevFlying = true; flyEnd = end; prevUpside = false;
      continue;
    }
    const upside = sec.mode === "upside", ceil = (sec.args && sec.args.ceil) || 6;
    if (upside) {
      // ceiling from start+1 to end-1, its gravity portal on the section's first beat, out at its last column
      objects.push(["pattern", "ceiling", start + 1 + land, 0, { w: sec.blocks - 2 - land, ceil, portal: true, exit: true }]);
    }
    if (!sec.rest && sec.use && sec.use.length) {
      const early = start / total < 0.5;
      // reactive (score.js gate, the user on GDLM 45 v6): at Easy/Normal at least 4 empty columns between
      // chunks, so after each landing there is room to see the next thing and jump on reaction
      const low = ["Easy", "Normal"].includes((brief.difficulty || {}).label);
      let [gMin, gMax] = sec.gaps || (early ? [4, 7] : [3, 5]);
      if (low) { gMin = Math.max(gMin, 4); gMax = Math.max(gMax, gMin); }
      // after a flying section the cube lands from its exit portal: a calm lead-in first
      // (rated low-tier levels: ~6 blocks after a cube portal, knowledge/levels/modes_low_tier.md)
      // (8 here: the cube first falls out of the exit portal, ~0.3 s)
      // upside down: the cube first falls up to the ceiling (~0.3 s), so 8 columns after its portal
      // the level's first section: a calm start (pacing gate: 10+ blocks before the first hazard)
      let c = upside ? start + 10 + land : start + (prevFlying ? Math.max(3, 8 - (start - flyEnd)) : si === 0 ? 10 : 3), k = 0, last = null;
      // upside: room to read and take the exit portal. Terrain: back on the ground well before the next
      // section (a cube jumping off a step into the next mode portal read as a 6-block prejump: 45 v8, block 82)
      const stop = upside ? end - 9 : brief.terrain ? end - 8 : end - 3;
      // draw every random choice up front so a tweak to one chunk does not reshuffle the others
      let draws = Array.from({ length: 64 }, () => [rnd(), rnd()]);
      let tdraws = Array.from({ length: 64 }, () => [rnd(), rnd()]);   // terrain, drawn apart so old levels keep their chunks
      // a variant / backtrack of this section (tweaks "reseed:<si>" = n): its chunks, gaps and terrain heights
      // drawn from a generator of its own (the shared draws above are still taken, so the other sections stay
      // as they were); the n-th alternative library structure too (structurePicks)
      if (tweaks["reseed:" + si]) {
        const r2 = rng((brief.seed || 1) * 131 + si * 1009 + tweaks["reseed:" + si] * 7919);
        draws = draws.map(() => [r2(), r2()]); tdraws = tdraws.map(() => [r2(), r2()]);
      }
      // block terrain (brief "terrain": true): the floor of a cube section steps between rows 0 and 2
      // between chunks, so the play is on blocks, ledges and steps, not the bare floor (rated Easy/
      // Normal: a block in ~47% of cube columns, most spikes by a block; GDLM had 13%:
      // knowledge/levels/obstacles.md). Orb and pad chunks go back to the ground (their arcs are
      // placed from it). A step up sometimes has a spike at its foot (a ledge); a step down gets landing
      // room. The terrain goes back to the ground at the section's end.
      // Upside down too (the user on GDLM 47's upside part: "all in flat area. no change of height
      // really"): the same steps hang from the ceiling, at most 2 rows (the room under it is 6).
      // Heights: 0-3 on the floor, a change at ~4 chunks in 5 (official levels: ~13.6 floor changes per
      // 10 s of jumping play, range ~7 blocks; GDLM 47 had 7.5 and 3: tools/flow.js, STRUCTURES.md).
      const terrain = brief.terrain;
      const maxH = upside ? 2 : 3;
      let filledTo = c;
      h = 0;
      const fill = (from, to, hh) => { for (let cc = from; cc < to; cc++) for (let r = 0; r < hh; r++) objects.push(["block", cc, upside ? ceil - 1 - r : r]); };
      while (k < 64) {
        const key = `${si}:${k}`, t = tweaks[key] || {};
        const [r1, r2] = draws[k];
        // the newest idea first: an unseen pattern from the list, else a random one (favouring the
        // section's last-listed, its new idea), never the same twice in a row when there is a choice
        let name = sec.use.find(n => !seen.has(n));
        if (!name) {
          // not one of the last two chunks when the section has 3+ kinds (score.js "repetition": official
          // levels hardly repeat a 4-move pattern within 10 s; GDLM 47 repeated 17%)
          const recent = placed.slice(-2).map(p => p.name);
          const pool = sec.use.length > 2 ? sec.use.filter(n => !recent.includes(n)) : sec.use.length > 1 ? sec.use.filter(n => n !== last) : sec.use;
          const wts = pool.map((n, i) => 1 + (n === sec.use[sec.use.length - 1] ? 1 : 0) + i * 0.2);
          let x = r1 * wts.reduce((a, b) => a + b, 0);
          name = pool[pool.length - 1];
          for (let i = 0; i < pool.length; i++) { x -= wts[i]; if (x <= 0) { name = pool[i]; break; } }
        }
        if (t.swap) name = t.swap;
        const intro = !seen.has(name);
        // Easy/Normal: block-spike-block with 2-wide blocks (land, look, jump: no exact hop off a lone block)
        const LOW_ARGS = { "block-spike-block": { w1: 2, w2: 2 }, "spike-block": { at: 1, w: 3 } };
        const args = Object.assign(low && LOW_ARGS[name] ? LOW_ARGS[name] : {}, (sec.args || {})[name] || {});
        const wdt = widthOf(name, args);
        // landing room: after a chunk that ends h rows up, the cube falls h rows; nothing may need a
        // jump before it has landed and seen it (GDLM 45 v4: a spike-block right past a 3-high stair,
        // the user died there 3 times "cant tell where to jump")
        const drop = last ? endHeight(last, (sec.args || {})[last]) : 0;
        // after an orb or pad launch the cube comes down from high up: room to land and look (GDLM 47:
        // an orb chain at 2x landed 3 blocks before a step with a double on it)
        const launched = last && /orb|pad/.test(last) ? 3 : 0;
        let gap = gMin + Math.floor(r2 * (gMax - gMin + 1)) + (intro && k > 0 ? 2 : 0) + (t.gap || 0) + (drop >= 2 ? drop + 1 : 0) + launched;
        let newH = h, stepAt = null, ledge = false;
        if (terrain) {
          const [t1, t2] = tdraws[k];
          if (/orb|pad/.test(name)) newH = 0;
          // one row at a time: a 2-row step is a jump started ~2.5 blocks before its face, read as a prejump
          // (GDLM 45 v8 round 1-6, block 25)
          else if (k > 0 && t1 < 0.8) newH = h === 0 ? 1 : h >= maxH ? h - 1 : (t1 < 0.45 ? h + 1 : h - 1);
          if (newH !== h) {
            // the step 3 columns after the last chunk, then 5 (up) or 6 (down, a drop) on the new level
            // before the next: steps mid-gap left 3 columns and chained the jumps (GDLM 47 round 1)
            // a step up 5 columns after the chunk (its jump lands ~2 past the chunk's end: then a run, then
            // the jump onto the step; at +3 it was a land-and-jump chain), a step down 3 (no input)
            // a step up comes after the zone where the last chunk's jump comes down (score.js "reactive",
            // spike then step: half a jump + 250 ms of run; 1x 4.8 blocks, 2x 6.1, 3x 7.3), so it is its
            // own jump on reaction (5 at 1x as before)
            const ups = upsOf(speeds[si]), zone = Math.ceil(0.43 * ups / 30 / 2 + 0.25 * ups / 30) + 1;
            const upAt = Math.max(5, zone);
            gap = Math.max(gap, newH > h ? upAt + 5 : 9);
            stepAt = c + (newH > h ? upAt : 3);
            // a chunk that already ends up high (a platform): the new level continues from its end, no
            // 3-wide pit between them to drop into and jump straight out of (GDLM 47: 50 ms, block 57)
            if (newH > h && last && endHeight(last, (sec.args || {})[last]) >= newH - h) { stepAt = c; gap = Math.max(gap, 6); }
            ledge = newH > h && t2 < 0.35 && k > 0 && !["Easy", "Normal"].includes((brief.difficulty || {}).label);   // a spike at the step's foot: Hard and up
          }
        }
        if (k > 0) c += gap; else if (stepAt != null) { stepAt = c + 2; c += 5; }
        if (c + wdt > stop) break;
        if (terrain) {
          if (stepAt == null) fill(filledTo, c + wdt, h);
          else {
            fill(filledTo, stepAt, h); fill(stepAt, c + wdt, newH);
            if (ledge) objects.push(upside ? ["spike", stepAt - 1, ceil - 1 - h, { rot: 180 }] : ["spike", stepAt - 1, h]);
          }
          filledTo = c + wdt; h = newH;
        }
        if (intro) firsts.push(c);
        if (upside) objects.push(...mirrorUp(expand(name, c, 0, args), ceil - (terrain ? h : 0)));
        else objects.push(["pattern", name, c, terrain ? h : 0, args]);
        placed.push({ key, name, from: c, to: c + wdt - 1, section: sec.name });
        seen.add(name); last = name;
        c += wdt; k++;
      }
      if (terrain && h > 0) { fill(filledTo, filledTo + 2, h); h = 0; }   // a last step down to the ground
      prevFlying = false;
    }
    // a rest in the middle over 3 s gets one easy single in its middle, so no stretch passes without an
    // input (polish's tools/deadair.js: no stretch over 3 s without an input or obstacle); "busy": false
    // on the section keeps it empty (then accept "dead air" in the brief with the reason)
    if (sec.rest && si > 0 && si < brief.sections.length - 1 && sec.busy !== false && sec.blocks * 30 / upsOf(speeds[si]) > 3)
      objects.push(["pattern", "single", start + Math.floor(sec.blocks / 2), 0, {}]);
    if (upside) { prevFlying = true; flyEnd = end; }   // the cube drops from the ceiling: a lead-in next
    prevUpside = upside;
    ranges.push([i0, objects.length, start, end]);
    col = end;
  }
  // marks the end (the level ends at its last object): an alpha trigger on an unused group, invisible
  // in the game (a block up at row 6 showed as a stray black square, GDLM 47)
  objects.push(["fade", col + 2, { group: 999, to: 1, secs: 0 }]);
  // "desc" is what players read in the game (short, flavour; make.js checks it); the idea is a note for us
  const spec = { name: brief.name, desc: brief.desc || "", notes: brief.idea || "", objects };
  if (deco.length) spec.decoDensity = deco;
  // the modern look (STYLE.md: knowledge/levels/modern_look.md); "modern": false in the brief turns it off
  // the signature at the end (tools/signature.js, the visuals session's): in the last rest section
  // on by default; make.js puts it 3 blocks after the last gameplay object and ends the level ~5 blocks after it
  spec.signature = brief.signature === false ? false : {};
  if (brief.scene) spec.scene = brief.scene;   // a scene script (tools/scenes/<name>.js, SHOWCASE.md): the look by hand, run by make.js
  if (brief.craft) spec.craft = brief.craft;   // craft pass (tools/craftkit.js, CRAFT.md): rods, chains, lanterns on the structures
  if (brief.modern !== false) spec.modern = { sections: looks.map(({ bg, ...l }) => l), title: brief.name, end: "thanks for playing", seed: brief.seed || 3, light: brief.palette === "light" };
  // jump indicators (tools/decorate.js): on jumps that cannot be read in time, and the first jump of
  // each new pattern. Default on; "indicators": false in the brief turns them off.
  if (brief.indicators !== false) spec.indicators = Object.assign({ at: firsts }, brief.indicators || {});
  for (const k of ["style", "colours", "art", "speed", "song", "offset", "grid", "snap", "seed"]) if (brief[k] != null) spec[k] = brief[k];
  if (brief.sections[0] && brief.sections[0].bg && !spec.colours) spec.colours = { bg: brief.sections[0].bg, ground: brief.sections[0].ground || brief.sections[0].bg };
  return { spec, placed, ranges };
}
// the spec of one section alone (the rest of the level left out), for sectionwise scoring
// Moved to the level's start (12 columns in), with the speed in force there, and without the
// decoration passes: solving from the real start walked up to 90 s of empty ground first (~80 of a
// section's ~100 s, GDLM 47). `shift` (columns) maps the results back.
function sectionSpec(spec, range, speed) {
  const [i0, i1, start, end] = range, shift = Math.max(0, start - 12);
  const mv = e => { const c = e.slice(); const k = c[0] === "pattern" ? 2 : 1; if (typeof c[k] === "number") c[k] -= shift; return c; };
  const objs = spec.objects.slice(i0, i1).map(mv).concat([["block", end - shift + 2, 6]]);
  if (speed && speed !== (spec.speed || "1x")) objs.unshift([speed + " speed", 2, 1]);
  const sub = Object.assign({}, spec, { objects: objs });
  delete sub.modern; delete sub.signature; delete sub.indicators; delete sub.decoDensity;
  return { sub, shift };
}
// a section's score, back in the level's columns
function unshift(sc, shift) {
  const u = shift * 30;
  if (sc.solution && sc.solution.dieAt) sc.solution.dieAt = Object.assign({}, sc.solution.dieAt, { x: sc.solution.dieAt.x + u });
  for (const p of sc.prejumps || []) { p.cueAt += shift; if (p.to != null) p.to += shift; if (p.from != null) p.from += shift; }
  for (const c of sc.tight || []) c.x += u;
  for (const c of sc.chains || []) c.x += u;
  return sc;
}

// which placed chunk a column belongs to (or the next one after it)
function chunkAt(placed, col) {
  return placed.find(p => col >= p.from - 1 && col <= p.to + 1) || placed.find(p => p.from >= col);
}

// Difficulty bands on lib/difficulty.js's scale (log10 attempts): the middle of each label's range.
const BAND_MID = { Easy: 0.15, Normal: 0.55, Hard: 1.15, Harder: 2, Insane: 3.25, Demon: 5 };

function loop(briefFile, rounds = 8, phase = {}) {
  const brief = JSON.parse(fs.readFileSync(briefFile, "utf8"));
  const base = path.basename(briefFile, ".json");
  const target = brief.difficulty && brief.difficulty.label;
  const NL = "\n";
  const log = [`# ${brief.name}${NL}`, `Idea: ${brief.idea || "-"}${NL}`, brief.story ? `Story: ${brief.story}${NL}` : "", `Target: ${JSON.stringify(brief.difficulty || {})}${NL}`];
  const clone = o => JSON.parse(JSON.stringify(o));
  // the fairness gate (tools/fairness.js, ~1 min a level) runs once, on the finished level, not in the rounds
  const whole = (tweaks, opts = { fairness: false }) => { const { spec, placed } = compose(brief, tweaks); const { level } = build(spec, briefFile); return { tweaks, spec, placed, s: scoreLevel(level, brief, opts) }; };
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
      const { sub, shift } = sectionSpec(spec, rg, speedsOf(brief)[si]);
      if (!sub.objects.some(o => !["colour", "fade", "zoom", "block"].includes(o[0]) || (o[0] === "block" && o[2] !== 6))) continue;
      const key = JSON.stringify(sub.objects);
      if (!cache.has(key)) {
        const t0 = Date.now();
        const { level } = build(sub, briefFile);
        // section-local gates only: pacing / colour / difficulty are for the whole level
        const sc = scoreLevel(level, Object.assign({}, brief, { sections: undefined }), { fairness: false });
        sc.gates = sc.gates.filter(g => BLOCKING.has(g.name));
        sc.ok = !sc.gates.some(g => g.status === "FAIL");
        unshift(sc, shift);
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
  // An approximate prejump (WARN, levels with modes) counts too: GDLM 45 v4's WARN at its stairs was
  // the spot the user died at three times.
  const sound = s => !s.gates.some(g => (g.status === "FAIL" && g.name !== "difficulty") || (g.name === "prejumps" && g.status !== "PASS"));
  const nFails = r => r.s.gates.filter(g => g.status === "FAIL" && g.name !== "difficulty").length;
  // when none is sound yet: fewer failing gates first (GDLM 47 kept round 1 of 6 for want of this)
  const better = (a, b) => !b || (sound(a.s) && !sound(b.s)) || (!sound(a.s) && !sound(b.s) && nFails(a) < nFails(b)) || (sound(a.s) === sound(b.s) && nFails(a) === nFails(b) && dist(a) < dist(b));
  const list = fixes => fixes.map(f => `- ${f.what}${NL}`).join("");
  const blocked = new Set();
  // ---- section scores, variants, backtracking (the user, 2026-11-23: "in building levels in general it may
  // be cool to somehow see possible alternatives"). A section is scored ALONE (sectionSpec) with every gate
  // that makes sense for a part: 100 minus 30 per FAIL and 6 per WARN. The opening, the drops ("flash") and
  // the finale get brief.variants (default 3) versions -- "reseed:<si>": other draws for its chunks, gaps and
  // terrain heights and another library structure -- and the best one is kept; all are saved with their
  // scores to local/wip/<session>/<level>.variants/ for the user to see, close calls marked. A section that
  // fails 2 repair rounds is rebuilt from another plan (the next reseed), not patched further.
  const SECTION_ONLY = new Set(["pacing", "colour", "sync", "length", "mode changes", "difficulty", "ending", "lead-in", "variety", "taste", "craft", "deco coverage"]);
  const points = sc => Math.max(0, 100 - sc.gates.filter(g => !SECTION_ONLY.has(g.name)).reduce((a, g) => a + (g.status === "FAIL" ? 30 : g.status === "WARN" ? 6 : 0), 0));
  const secCache = new Map();
  const scoreSection = (tweaks, si) => {
    const { spec, ranges } = compose(brief, tweaks);
    const { sub } = sectionSpec(spec, ranges[si], speedsOf(brief)[si]);
    const key = JSON.stringify(sub.objects);
    if (!secCache.has(key)) {
      sub.name = `${brief.name} s${si}`;
      const { level, rec } = build(sub, briefFile);
      const sc = scoreLevel(level, Object.assign({}, brief, { sections: undefined }), { fairness: false });
      secCache.set(key, { sc, points: points(sc), level, rec });
    }
    return secCache.get(key);
  };
  // viewer format (visuals, 2026-11-23): local/wip/<session>/<level base>.variants/index.json + one WHOLE-level
  // file per variant (that section swapped in), keys A, B, C ... (A = the plain plan, the baseline); the user's
  // pick comes back as a "variant-pick" mark in local/marks.jsonl (tools/marks.js)
  const vbase = slug(brief.name), vdir = path.join(__dirname, "..", "local", "wip", brief.session || "style", vbase + ".variants");
  const vindex = { level: vbase + ".gdlvl", version: null, sections: [] };
  try { vindex.version = JSON.parse(fs.readFileSync(path.join(vdir, "..", vbase + ".json"), "utf8")).version; } catch (e) {}
  const lastPlay = brief.sections.map((s, i) => i).filter(i => !brief.sections[i].rest).pop();
  const firstCube = brief.sections.findIndex(s => !s.rest && !s.mode && s.use && s.use.length);
  const important = brief.sections.map((s, i) => i).filter(i => {
    const s = brief.sections[i];
    return s.use && s.use.length && !s.rest && (!s.mode || s.mode === "upside") && (i === firstCube || s.flash || i === lastPlay || (brief.variantSections || []).includes(s.name));
  });
  // ---- the pipeline (the user: "its a repeatable process, we need to make whatever needed to iterate better next
  // time. i see layout song quicker, with the path"): song, then the layout with its full plan at once (no scoring
  // first), then the alternatives being weighed (put into the layout stage as alt[]), the repair rounds, the check
  // solve, deco, final. Every stage records its seconds against a target (stages data.secs, local/timings.jsonl)
  // and the build ends with a retro in BUILDS.md. Two phases for user gates (tools/gated.js): --until layout ends
  // after the layout stage (gate: true), saving the plan; --resume goes on from it.
  const stateFile = path.join(__dirname, "..", "local", "wip", brief.session || "style", slug(brief.name) + ".compose_state.json");
  const saved = phase.resume ? (() => { try { return JSON.parse(fs.readFileSync(stateFile, "utf8")); } catch (e) { return null; } })() : null;
  const K = saved ? 1 : brief.variants ?? 3, start0 = saved ? Object.assign({}, saved.tweaks) : {}, vlog = [];
  const T0 = Date.now(), TARGET = { song: 10, layout: 60, path: 900, deco: 1200, final: 1200 }, timings = [];
  const STG = (() => { try { return require("./stages.js"); } catch (e) { return null; } })();
  const stage = (st, extra) => {
    const secs = +((Date.now() - T0) / 1000).toFixed(1);
    timings.push({ stage: st, secs, target: TARGET[st] });
    try { fs.appendFileSync(path.join(__dirname, "..", "local", "timings.jsonl"), JSON.stringify({ level: brief.name, step: "compose-" + st, stage: st, secs, target: TARGET[st], resume: !!phase.resume, at: new Date().toISOString() }) + "\n"); } catch (e) {}
    if (!STG) return;
    const timing = timings.map(t => `${t.stage} ${t.secs < 90 ? t.secs.toFixed(0) + " s" : (t.secs / 60).toFixed(1) + " min"}`).join(", ");
    extra = Object.assign({}, extra); extra.data = Object.assign({}, extra.data || {}, { secs, target: TARGET[st], timing });
    extra.note = (extra.note || "") + ` [${timing}]`;
    try { STG.put(Object.assign({ session: brief.session || "style", base: slug(brief.name), name: brief.name, stage: st }, extra)); } catch (e) { console.log("   (stage " + st + " not saved: " + e.message + ")"); }
  };
  const gameplayOnly = spec => { const g = JSON.parse(JSON.stringify(spec)); delete g.scene; delete g.craft; delete g.modern; delete g.indicators; delete g.decoDensity; g.signature = false; g.objects = g.objects.filter(o => !Array.isArray(o) || !["colour", "fade", "zoom"].includes(o[0])); return g; };
  const quiet = fn => { const log0 = console.log; console.log = () => {}; try { return fn(); } finally { console.log = log0; } };
  // a plan's gameplay level, its planned presses and its driven events (the full plan; cache gaps named)
  const planOf = (tweaks, drive = true) => {
    const comp = compose(brief, tweaks), built = quiet(() => build(gameplayOnly(comp.spec), briefFile));
    const I = require("./intent.js"), wg = GD.makeWorld(built.level.objects, built.level.header), tl = SY.SYNC.timeline(wg);
    const { intents, missing } = I.intents(built.ctx.placements || [], tl, { raw: built.ctx.raw, cacheOnly: !drive });
    const planned = intents.map(i => ({ t: +SY.SYNC.tOfX(tl, i.x).toFixed(3), what: i.type === "press" ? "jump" : "release" }));
    let events = null, vnote = "";
    if (drive) {
      const v = I.verify(wg, built.level, intents, { maxRepairs: 6 });
      events = v.events;
      vnote = v.ok ? (v.repairs ? `; plays to the end with ${v.repairs} local repair(s) (cache gaps: ${v.log.join("; ")})` : "; plays to the end from the plan alone") : `; the plan stops at block ${((v.dieX || 0) / 30).toFixed(0)} (${v.log.join("; ")})`;
    }
    if (missing.length) vnote += `; no intent yet for ${missing.join(", ")}`;
    return { built, planned, events, vnote, ranges: comp.ranges, tl, world: wg };
  };
  const layoutStage = (tweaks, alt) => {
    try {
      const p = planOf(tweaks);
      console.log("   layout plan" + p.vnote);
      // the seam contract (tools/seams.js; briefs/<NN>.seams.json) and the viewer's section strip: the state at
      // every section boundary on this plan; a section's builder and status survive a rewrite
      try {
        const SM = require("./seams.js"), path0 = p.events ? GD.run(p.world, p.events).path : null;
        let old = null; try { old = JSON.parse(fs.readFileSync(SM.fileOf(briefFile), "utf8")); } catch (e) {}
        let bb = 1;
        const sections = brief.sections.map((sx, i) => {
          const b0 = bb; bb += sx.beats || 0;
          const rg = p.ranges[i], x0 = rg[2] * 30, x1 = rg[3] * 30, prev = old && old.sections && old.sections[i];
          const scene = { bg: sx.bg, ground: sx.ground, line: sx.line, obj: sx.obj };
          return { id: "s" + i, name: sx.name, beats: sx.beats ? [b0, bb] : null, t: [+SY.SYNC.tOfX(p.tl, x0).toFixed(3), +SY.SYNC.tOfX(p.tl, x1).toFixed(3)], x: [x0, x1],
            in: Object.assign(path0 ? SM.stateAt(path0, x0) || {} : {}, { scene }), out: Object.assign(path0 ? SM.stateAt(path0, x1 - 1) || {} : {}, { scene }),
            builder: (prev && prev.builder) || { layout: brief.session || "style", deco: brief.session || "style", playtest: brief.session || "style" },
            status: Object.assign({}, (prev && prev.status) || { deco: "planned", playtest: "planned" }, { layout: "built" }) };
        });
        fs.writeFileSync(SM.fileOf(briefFile), JSON.stringify({ level: brief.name, brief: path.relative(path.join(__dirname, ".."), briefFile).split(path.sep).join("/"),
          song: { custom: brief.song && brief.song.custom, offset: brief.offset || 0, bpm: brief.grid && brief.grid.bpm, t0: brief.grid && brief.grid.t0 }, planOk: !!p.events, sections }, null, 1));
        if (STG && STG.setSections) STG.setSections(brief.session || "style", slug(brief.name), sections);
      } catch (e) { console.log("   (seams: " + e.message + ")"); }
      stage("layout", Object.assign({ levelStr: GD.serializeLevel(p.built.level), data: Object.assign({ planned: p.planned, events: p.events, kind: "planned" }, alt ? { alt } : {}),
        note: "gameplay and its planned presses" + p.vnote + (alt ? `; ${alt.length} section(s) with alternatives` : "") + (phase.until === "layout" ? " -- waiting for the user" : "") }, phase.until === "layout" ? { gate: true } : {}));
    } catch (e) { console.log("   (layout stage: " + e.message + ")"); }
  };
  // 1. song
  {
    const { songOf, gridOf } = require("./make.js");
    let grid = null; try { grid = brief._grid || (brief.grid ? gridOf(brief) : gridOf(brief, songOf(brief))); } catch (e) {}
    let b = 1; const secs = brief.sections.map(s => { const from = grid ? SY.SYNC.beatToTime(grid, brief.offset || 0, b) : null; b += s.beats || 0; const to = grid ? SY.SYNC.beatToTime(grid, brief.offset || 0, b) : null; return { name: s.name, from, to }; });
    stage("song", { data: { song: { id: brief.song && brief.song.custom, offset: brief.offset || 0 }, grid: grid ? { bpm: brief.grid && brief.grid.bpm, period: grid.period, t0: grid.t0 } : null, sections: secs }, note: "song and its sections" });
  }
  // 2. the layout with its full plan, at once
  layoutStage(start0);
  // 3. the alternatives being weighed for the important sections: scored alone, kept by score, shown as alt[]
  const alt = [];
  if (K > 1) for (const si of important) {
    const tried = [], KEYS = "ABCDEFGH";
    const entry = { id: "s" + si, name: brief.sections[si].name, from: null, to: null, variants: [] };
    for (let n = 0; n < K; n++) {
      const tw = Object.assign({}, start0, n ? { ["reseed:" + si]: n } : {});
      const r = scoreSection(tw, si);
      const issues = r.sc.gates.filter(g => g.status !== "PASS").map(g => `${g.status} ${g.name}`);
      tried.push({ n, points: r.points, gates: issues, r });
      // the whole level with this section's variant (no solve: the viewer solves it, or the cache has it)
      const whole = compose(brief, tw), b = quiet(() => build(whole.spec, briefFile));
      const rg = whole.ranges[si]; entry.from = rg[2] * 30; entry.to = rg[3] * 30;
      fs.mkdirSync(vdir, { recursive: true });
      const file = `s${si}_${KEYS[n]}.gdlvl`;
      require("./io.js").writeGdlvl(path.join(vdir, file), b.rec, b.level);
      const sol = (() => { try { return require("./solutions.js").get(require("./io.js").readGdlvl(path.join(vdir, file)).levelStr); } catch (e) { return null; } })();
      const diffG = r.sc.gates.find(g => g.name === "difficulty");
      let planned = []; try { planned = planOf(tw, false).planned; } catch (e) {}
      entry.variants.push(Object.assign({ key: KEYS[n], file, planned, scores: { section: r.points, difficulty: diffG ? diffG.value.split(" (")[0] : undefined, issues: issues.length ? issues.join(", ") : "none" },
        note: n ? `reseed ${n}: other chunks, gaps, terrain heights and library structure` : "the plain plan (baseline)" }, sol ? { solution: sol } : {}));
    }
    vindex.sections.push(entry);
    tried.sort((a, b) => b.points - a.points);
    const win = tried[0], close = tried.length > 1 && tried[0].points - tried[1].points <= 5;
    if (win.n) start0["reseed:" + si] = win.n;
    const line = `${brief.sections[si].name}: v${win.n} kept (${win.points}) over ` + tried.slice(1).map(t => `v${t.n} ${t.points}` + (t.gates.length ? ` [${t.gates.join(", ")}]` : "")).join(", ") + (close ? " -- CLOSE: a taste call for the user" : "");
    console.log("   variants " + line); vlog.push(line);
    for (const v of entry.variants) { v.scores.kept = v.key === "ABCDEFGH"[win.n] ? "yes" : "no"; if (close) v.scores.close = "taste call"; }
    alt.push({ section: entry.id, name: entry.name, from: entry.from, to: entry.to, close,
      options: entry.variants.map(v => ({ key: v.key, points: v.scores.section, why: v.scores.issues, kept: v.scores.kept === "yes", file: path.basename(vdir) + "/" + v.file, planned: v.planned })) });
    log.push(`- variants ${line}${NL}`);
  }
  if (vindex.sections.length) fs.writeFileSync(path.join(vdir, "index.json"), JSON.stringify(vindex, null, 1));
  if (vlog.length) {
    // learn: which variant won and why (knowledge/variants.md, appended per run; the user's picks count double)
    const lf = path.join(__dirname, "..", "knowledge", "variants.md");
    const head = fs.existsSync(lf) ? "" : "# Section variants: which won and why\n\n";
    fs.appendFileSync(lf, head + `## ${brief.name} (${new Date().toISOString().slice(0, 10)})\n` + vlog.map(l => "- " + l).join("\n") + "\n\n");
  }
  // the layout again, now with the alternatives and the kept ones in place
  if (alt.length) layoutStage(start0, alt);
  if (phase.until === "layout") {
    fs.mkdirSync(path.dirname(stateFile), { recursive: true });
    fs.writeFileSync(stateFile, JSON.stringify({ brief: briefFile, tweaks: start0, at: new Date().toISOString() }, null, 1));
    console.log(`layout stage put (gated); the plan is saved in ${path.relative(process.cwd(), stateFile)}: tools/gated.js waits for the user, then resumes`);
    return null;
  }
  const failRounds = {};
  let cur = evaluate(start0), best = null;
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
        if ((q.gates.find(g => g.name === "prejumps") || {}).status !== "PASS") for (const p of q.prejumps) blame.push({ col: p.cueAt, why: `prejump (${p.lead.toFixed(1)} blocks ahead)` });
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
      // backtrack: a section blamed in 2 rounds is rebuilt from another plan instead of patched again
      for (const si of new Set(fixes.map(f => +String(f.key).split(":")[0]).filter(n => !isNaN(n)))) {
        failRounds[si] = (failRounds[si] || 0) + 1;
        if (failRounds[si] >= 2) {
          for (const k of Object.keys(tweaks)) if (k.startsWith(si + ":")) delete tweaks[k];
          for (const k of [...blocked]) if (String(k).startsWith(si + ":")) blocked.delete(k);
          tweaks["reseed:" + si] = (tweaks["reseed:" + si] || 0) + (brief.variants ?? 3);
          failRounds[si] = 0;
          for (let i = fixes.length - 1; i >= 0; i--) if (String(fixes[i].key).startsWith(si + ":")) fixes.splice(i, 1);
          fixes.push({ key: "reseed:" + si, what: `section ${brief.sections[si].name} rebuilt from another plan (reseed ${tweaks["reseed:" + si]}): 2 rounds of patching did not fix it` });
        }
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
  {
    // the whole level once more, with every gate: difficulty, pacing, colour, sync, lead-in, fairness
    console.log("whole level: one full score (slow for long levels)");
    const t0 = Date.now();
    const full = whole(best.tweaks, {});
    if (sectionwise) {
      // In a level with modes the whole run is solved by the sweep, whose cube windows read far too small
      // (16 ms where the exact solver on the section alone gives 100+, GDLM 47): timing, recovery and
      // prejumps come from the sections (exact where they are cube-only); the rest from the whole level.
      const secs = bySection(best.tweaks).s;
      full.s.gates = full.s.gates.map(g => (["timing", "recovery", "prejumps"].includes(g.name) && secs.gates.find(x => x.name === g.name))
        ? Object.assign({}, secs.gates.find(x => x.name === g.name), { note: "from the sections" }) : g);
      full.s.fails = full.s.gates.filter(g => g.status === "FAIL").length; full.s.warns = full.s.gates.filter(g => g.status === "WARN").length;
      full.s.ok = !full.s.fails;
    }
    log.push(`${NL}## Whole level (${((Date.now() - t0) / 1000).toFixed(0)} s to score): ${full.s.ok ? "READY" : "not ready"}${NL}`);
    for (const g of full.s.gates) log.push(`- ${g.status} ${g.name}: ${g.value}${g.note ? " -- " + g.note : ""}${NL}`);
    best = full;
  }
  log.push(`${NL}## Kept: ${best.s.ok ? "READY" : "not ready"}, difficulty ${labelOf(best.s) || "-"}${target ? " (target " + target + ")" : ""}${NL}`);
  const specFile = path.join(__dirname, "..", "specs", base + ".json");
  fs.writeFileSync(specFile, JSON.stringify(best.spec, null, 0).replace(/,\["/g, ',\n  ["').replace('"objects":[', '"objects": [\n  ') + "\n");
  fs.writeFileSync(path.join(path.dirname(briefFile), base + ".log.md"), log.join(""));
  console.log(`spec: ${path.relative(process.cwd(), specFile)}  log: ${path.relative(process.cwd(), path.join(path.dirname(briefFile), base + ".log.md"))}`);
  // the path stage: the kept layout with its planned presses (tools/intent.js: each pattern's intended inputs)
  try {
    const g = gameplayOnly(best.spec), log0 = console.log; console.log = () => {};
    let built; try { built = build(g, briefFile); } finally { console.log = log0; }
    const I = require("./intent.js"), wg = GD.makeWorld(built.level.objects, built.level.header), tl = SY.SYNC.timeline(wg);
    const { intents } = I.intents(built.ctx.placements || [], tl, { cacheOnly: true });
    stage("path", { levelStr: GD.serializeLevel(built.level), data: { planned: intents.map(i => ({ t: +SY.SYNC.tOfX(tl, i.x).toFixed(3), what: i.type === "press" ? "jump" : "release" })) }, note: "the kept layout and its planned presses" });
  } catch (e) { console.log("   (path stage skipped: " + e.message + ")"); }
  make(specFile);
  try { const L = require("./io.js").readGdlvl(path.join(__dirname, "..", "levels", slug(brief.name) + ".gdlvl"));
    stage("deco", { levelStr: L.levelStr, note: "with the look" }); stage("final", { levelStr: L.levelStr, note: best.s.ok ? "READY" : "not ready" }); } catch (e) {}
  // the retro (BUILDS.md): stage times against their targets, rounds, what failed, the slowest step
  try {
    const bf = path.join(__dirname, "..", "BUILDS.md");
    const head = fs.existsSync(bf) ? "" : "# Builds: what each took, what broke, what to change\n\nOne entry per compose run (tools/compose.js writes the numbers; the session adds the change it made after\nreading them). Targets: song 10 s, layout with its full plan 60 s, path (check solve) 15 min, final 20 min.\nThe stage times are also in local/timings.jsonl.\n\n";
    const steps = timings.map((t, i) => ({ stage: t.stage, d: t.secs - (i ? timings[i - 1].secs : 0) }));
    const slow = steps.slice().sort((a, b) => b.d - a.d)[0];
    const over = timings.filter(t => t.target && t.secs > t.target).map(t => `${t.stage} ${t.secs.toFixed(0)} s > ${t.target} s`);
    const fails = best.s.gates.filter(g => g.status === "FAIL").map(g => g.name);
    fs.appendFileSync(bf, head + `## ${brief.name}, ${new Date().toISOString().slice(0, 16).replace("T", " ")}${phase.resume ? " (resumed)" : ""}\n` +
      `- stages: ${timings.map(t => `${t.stage} ${t.secs.toFixed(0)} s`).join(", ")}\n` +
      `- slowest step: ${slow ? slow.stage + " (" + slow.d.toFixed(0) + " s)" : "-"}${over.length ? "; over target: " + over.join(", ") : ""}\n` +
      `- result: ${best.s.ok ? "READY" : "not ready (" + fails.join(", ") + ")"}, ${(log.join("").match(/## Round/g) || []).length} round(s)${vlog.length ? ", variants: " + vlog.length + " section(s)" : ""}\n` +
      `- change made: (the session fills this in)\n\n`);
  } catch (e) {}
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
        const { sub } = sectionSpec(spec, rg, speedsOf(brief)[i]);
        sub.name = `${brief.name} s${i}`;
        const { level, rec } = build(sub, file);
        const out = path.join(__dirname, "..", "local", "sections", slug(sub.name) + ".gdlvl");
        fs.mkdirSync(path.dirname(out), { recursive: true });
        require("./io.js").writeGdlvl(out, rec, level);
        const sc = scoreLevel(level, Object.assign({}, brief, { sections: undefined }), { fairness: false });
        print(sub.name, sc);
        console.log("written " + path.relative(process.cwd(), out));
      }
    }
    if (si < 0) console.log(`total ${ranges[ranges.length - 1][3]} columns, ${(ranges[ranges.length - 1][3] / 10.39).toFixed(0)} s`);
  } else {
    const ui = args.indexOf("--until");
    loop(file, ri >= 0 ? +args[ri + 1] : 8, { until: ui >= 0 ? args[ui + 1] : null, resume: args.includes("--resume") });
  }
}
module.exports = { compose, loop };
