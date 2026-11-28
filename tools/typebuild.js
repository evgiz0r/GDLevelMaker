// node tools/typebuild.js <briefs/NN_name.types.json> [--run] [--dry] [--seeds 6] [--map]  -- a level built from SECTION TYPES, not the lego
//   --run = the whole flow, one command: plan -> sections -> layout -> make (solve + deco) -> judge report
//
// Evgeni (2026-11-27): "lets generate a new level, 1 minute, using all our generation knowlege. lets use the generation of
// sections for now, not the lego itself we strip levels. using the latest deco, which changes across levels. no pulses or
// too flashy effects". So every section is generated fresh from its type's concept (tools/sectiongen.js,
// knowledge/section_types.md) at the song section's length, speed and tier; nothing comes from a mined brick.
// The pipeline (BUILDING.md section 0b):
//   song -> sections cut at its transitions and typed (tools/songplan.js, tools/sections.js)
//        -> feel per section: speed, density, shape (tools/feel.js)
//        -> a section type per section (its mode + the song section's kind, never the same type twice in a row; the brief
//           may name one) -> generated at that length (cols = seconds x blocks a second at its speed, motifs on the beat)
//           and tier (break easy, entry/groove normal, build/drop hard), several seeds each, the first one that solves
//           alone (tools/layoutcheck.js) and has the most presses wins
//        -> joined (lib/scenejoin.js: floors and ceilings ramp to each other), a portal WALL where the mode or speed
//           changes (portals stacked across the whole gap, so no path goes around them), up on blocks from the start
//           (the entrance type's ramp), the auto outro + the signature after the end
//        -> the deco: one design theme per look (tools/designthemes.js via the structure deco pass, tools/structdeco.js),
//           2-3 looks a level that change with the song's vibe, one indicator style for the level; no pulses (spec
//           "modern" off, no pulseZones)
//        -> specs/NN_name.json -> node tools/make.js (solve, deco, indicators, outro, signature).
// Brief (briefs/76_*.types.json):
// { "name": "GDLM 76 ...", "desc": "...", "out": "specs/76_x.json", "song": 1086693, "to": 61, "tier": "Normal", "seed": 7,
//   "looks": {"calm": "void", "drop": "hellgate", "break": "frost"},     // look name -> design theme (or an inline theme)
//   "sections": [{"type": "entrance", "look": "calm", "mode": "cube"}, ...]   // optional per section (by order); any left
//   "indicator": "spark" }                                                     // out comes from the rules below
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const OU = require("./outside.js"), SG = require("./sectiongen.js"), LS = require("./layoutsections.js"), SJ = require("../lib/scenejoin.js");
const APRON = 5, HAZ = new Set(["^", "v", "o", "q", "s"]);   // hazard letters of the section maps (tools/layoutsections.js)
const BPS = { "0.5x": 8.372, "1x": 10.386, "2x": 12.914, "3x": 15.6, "4x": 19.2 };   // blocks a second (planbuild.js)
const PORTAL = { cube: "cube portal", ship: "ship portal", wave: "wave portal", ufo: "ufo portal", ball: "ball portal", swing: "swing portal", robot: "robot portal", spider: "spider portal" };
const SPEEDN = { "0.5x": "0.5x speed", "1x": "1x speed", "2x": "2x speed", "3x": "3x speed", "4x": "4x speed" };
const FLY = new Set(["ship", "wave", "swing", "ufo"]);
// which types a mode can take, by the song section's kind (first = preferred); cube-ud = a cube type with its gravity pair
const TYPES = {
  cube: { break: ["staircase", "opencube", "my-mwz1637w"], build: ["my-mwz1637w", "staircase", "closecube"], groove: ["closecube", "opencube", "staircase"],
    entry: ["opencube", "my-mwz2haf0", "closecube"], drop: ["closecube", "my-mwz1637w", "my-mwz2haf0"] },
  "cube-ud": { any: ["closecube", "my-mwz1637w"] },
  ship: { drop: ["fly", "my-mwz1s7po"], any: ["my-mwz1s7po", "fly"] }, wave: { any: ["wave"] }, ufo: { any: ["flappy"] }, ball: { any: ["ball", "my-mwz8kaem"] }, spider: { any: ["my-mwz7nxue"] },
  swing: { any: ["my-mwz1890c"] },
};
// the generators' presses a second run under the ~2 cps the levels need (Evgeni: "not so sparse"; the first GDLM 76 pass at
// easy/normal/hard gave 0.9-1.4 cps, every section Easy), so each kind asks a step more of its type's pace
const TIER_OF = { break: "normal", entry: "hard", groove: "hard", build: "harder", drop: "harder" };
// calm effects only (Evgeni: "no pulses or too flashy effects"), a different one each section by its kind, so sections differ
// in effects as well as colour and pace ("i want veriaty between sections, in colors/pacing/effects. keeping the same vibe")
const FX_OF = { break: ["clouds", "none"], entry: ["chase", "clouds"], groove: ["chase", "none"], build: ["screenFrame", "chase"], drop: ["screenFrame", "none"] };
const LOOK_OF = { break: "break", drop: "drop", build: "drop" };   // else the level's first look ("calm")

const tilesOf = map => LS.tiles({ map });
// a join with room around its portal (the judge's "abrupt switch": the mains keep ~0.37 s quiet before a mode change and
// ~0.48 s after): lib/scenejoin.js's ramp with its first column held LEAD more columns and its last one TAIL more
const LEAD = 4, TAIL = 5, SPLIT_S = 5, BANDED = new Set(["ship", "ufo", "wave", "swing"]);
function joinPad(a, b) {
  const j = SJ.join(a, b), first = j.tiles.filter(q => q.c === 0), last = j.tiles.filter(q => q.c === j.n - 1), out = [];
  for (let k = 0; k < LEAD; k++) for (const q of first) if (q.t === "#") out.push({ t: "#", c: k, r: q.r });
  for (const q of j.tiles) out.push({ t: q.t, c: q.c + LEAD, r: q.r });
  for (let k = 0; k < TAIL; k++) for (const q of last) if (q.t === "#") out.push({ t: "#", c: LEAD + j.n + k, r: q.r });
  // the portal wall 2 columns into the flat tail, not on the join's last column: a join that steps the floor down right
  // before the wall left the cube no room to drop into the wall's opening, so it had to jump 4 blocks early (GDLM 78
  // block 61: a prejump and an "abrupt switch")
  return { n: LEAD + j.n + TAIL, tiles: out, floor: j.floor, portalAt: LEAD + j.n - 1 + Math.min(2, TAIL - 2) };
}
// the empty run of a column (rows from the ground) the player passes through: bounded by something on both sides first
function runsOf(map, c) {
  const H = map.length, runs = []; let a = null;
  for (let r = 0; r <= H; r++) { const ch = r < H ? map[H - 1 - r][c] : "#", empty = ch === "." || "GN".includes(ch);
    if (empty && a == null) a = r; if (!empty && a != null) { runs.push({ a, b: r - 1, closed: a > 0 && r < H }); a = null; } }
  return runs;
}
// with `row` (where the route of the section before leaves it): the run holding that row, else the nearest one
function gapOf(map, c, row) {
  const H = map.length, runs = runsOf(map, c);
  if (row != null && runs.length) return runs.slice().sort((x, y) => dist(x, row) - dist(y, row))[0];
  const closed = runs.filter(x => x.closed && x.b - x.a >= 2);
  const pool = closed.length ? closed : runs;
  return pool.sort((x, y) => (y.b - y.a) - (x.b - x.a))[0] || { a: 0, b: H - 1 };
}
const dist = (x, r) => r < x.a ? x.a - r : r > x.b ? r - x.b : 0;

function plan(brief, o = {}) {
  const SP = require("./songplan.js").plan(String(brief.song), { to: brief.to, from: brief.from });
  const FE = require("./feel.js").feel(SP.sections, { song: String(brief.song), tier: brief.tier || "Normal", speed: brief.speed || "1x", seed: brief.seed || 7 });
  const P = SP.period, secs = FE.sections.map((s, i) => {
    const over = (brief.sections || [])[i] || {}, mode = over.mode || s.mode, speed = over.speed || s.feel.speed;
    return { i, b0: s.b0, b1: s.b1, t0: s.t0, t1: s.t1, kind: s.type, mode, speed, feel: s.feel, secs: (s.b1 - s.b0) * P,
      type: over.type, seed: over.seed, seedB: over.seedB, tier: over.tier || TIER_OF[s.type] || "normal", look: over.look || LOOK_OF[s.type] || "calm" };
  });
  if (brief.maxSections) secs.length = Math.min(secs.length, brief.maxSections);
  // types: the brief's, else by mode + kind: one not used yet in the level, else never the type just used
  let last = null; const usedT = new Set();
  for (const s of secs) {
    if (!s.type) { const T = TYPES[s.mode] || TYPES.cube, list = (T[s.kind] || T.any || Object.values(T)[0]).slice();
      if (s.i === 0 && s.mode === "cube") list.unshift("entrance");
      s.type = list.find(k => !usedT.has(k)) || list.find(k => k !== last) || list[0]; }
    last = s.type; usedT.add(s.type);
  }
  // a section over SPLIT_S seconds is two ideas, not one corridor (the judge on GDLM 76 v1: "long corridor: 6.3 s of one
  // corridor (want 4 s or less per idea)", "no variety: 7.2 s with one kind of obstacle"): cut at its middle bar, the second
  // half another type of the same mode, or the same type a tier harder (its peak) when the mode has one type
  const STEP = { easy: "normal", normal: "hard", hard: "harder", harder: "extreme", extreme: "extreme" };
  const out = [], usedB = new Set(secs.map(s => s.type));
  for (const s of secs) {
    if (s.secs <= (brief.split ?? SPLIT_S) || s.noSplit) { out.push(s); continue; }
    const mid = s.b0 + Math.max(4, Math.round((s.b1 - s.b0) / 2 / 4) * 4), T = TYPES[s.mode] || TYPES.cube;
    const alts = [...new Set([...(T[s.kind] || []), ...(T.any || []), ...Object.values(T).flat()])].filter(k => k !== s.type && k !== "entrance" && !(SG.PRIORITY[k] < 1));
    const b = Object.assign({}, s, { b0: mid, secs: (s.b1 - mid) * P, sub: 1, seed: s.seedB, type: (brief.sections || [])[s.i]?.typeB || alts.find(k => !usedB.has(k)) || alts[0] || s.type });
    usedB.add(b.type);
    if (b.type === s.type) b.tier = STEP[s.tier] || s.tier;
    out.push(Object.assign({}, s, { b1: mid, secs: (mid - s.b0) * P, sub: 0 }), b);
  }
  out.forEach((s, k) => { s.si = s.i; s.i = k; });
  return { SP, FE, P, secs: out };
}

function build(brief, o = {}) {
  const { SP, P, secs } = plan(brief, o);
  const LC = require("./layoutcheck.js"), nSeeds = o.seeds || 6, seed0 = brief.seed || 7;
  // columns: each section ends where its song section ends (joins come out of the section's own length)
  let col = 0, prev = null, prevSpeed = "1x";
  const parts = [], tiles = [], portals = [], report = [];
  for (const s of secs) {
    const endCol = col + s.secs * BPS[s.speed];
    const beatCols = P * BPS[s.speed];
    let best = null;
    for (let k = 0; k < nSeeds; k++) {
      const seed = s.seed != null ? s.seed + k : seed0 * 100 + s.i * 10 + k;
      const gen = W => { const z = SG.make(s.type, { cols: Math.max(16, Math.round(W)), seed, tier: s.tier, beatCols, speed: BPS[s.speed] / BPS["1x"] });
        if (s.mode === "cube-ud" && !z.map.some(l => /G/.test(l))) {   // upside down needs a G portal inside: another flipping type
          for (const k2 of ["my-mwz1637w", "staircase", "closecube"]) { if (k2 === s.type) continue;
            const z2 = SG.make(k2, { cols: Math.max(16, Math.round(W)), seed, tier: s.tier, beatCols, speed: BPS[s.speed] / BPS["1x"] });
            if (z2.map.some(l => /G/.test(l))) { s.type = k2; return z2; } }
          return k > 1 ? z : null; }   // none flips at this length: the plain cube after a few tries
        return z; };
      let z = gen(endCol - col - 4); if (!z) continue;
      const cur = { T: tilesOf(z.map), w: z.map[0].length, h: z.map.length };
      const jn = prev ? joinPad(prev.cur, cur).n : 0;
      z = gen(endCol - col - jn); if (!z) continue;
      if (o.dry) { best = { z, c: { ok: null, presses: 0 }, seed }; break; }
      z.speedName = s.speed; const c = LC.check(z);   // checked at its own speed, not 1x
      // a seed whose own solve flies over or under its structure is a secret way (Evgeni 2026-11-28): scored down by the share
      const around = c.ok ? OU.outsideMap(z.map, c.route) : 0;
      const score = c.ok ? 100 + c.presses - (c.tight && c.tight[0] && c.tight[0].ms < 60 ? 50 : 0) - Math.round(around * 300) : -1;
      if (around > 0.05) console.log(`   s${s.i} seed ${seed}: the solve flies around the structure for ${Math.round(around * 100)}% of the way`);
      console.log(`   s${s.i} ${s.type} seed ${seed}: ` + (c.ok ? `solves, ${c.presses} presses, ${c.label}${c.tight[0] ? ", tightest " + c.tight[0].ms + " ms" : ""}` : `no (${c.why} at col ${c.dieCol})`));
      if (!best || score > best.score) best = { z, c, seed, score };
      if (c.ok && (s.seed != null || k >= 2) && best.score >= 100) break;
    }
    if (!best) throw new Error(`s${s.i}: no ${s.type} for ${s.mode}`);
    const z = best.z, cur = { T: tilesOf(z.map), w: z.map[0].length, h: z.map.length, mode: s.mode };
    const mode = s.mode === "cube-ud" ? "cube" : s.mode;
    let jn = 0, j = null;
    if (prev) { j = joinPad(prev.cur, cur); jn = j.n; for (const q of j.tiles) tiles.push({ t: q.t, c: q.c + col, r: q.r }); }
    // the portal wall: the last column of the join, across the gap the player can be in there
    // two sections of one flying mode in a row get a portal of that mode too: it sets the flying band again around the player
    // (a portal of your own mode re-bands, CLAUDE.md Calibration), so the second one is played in the band it was checked in
    // (GDLM 78: the second swing inherited the first one's band, flew over its saws and missed its band movers)
    const reband = prev && mode === prev.mode && BANDED.has(mode);
    if (prev && (mode !== prev.mode || s.speed !== prevSpeed || reband)) portals.push({ c: col + (j ? j.portalAt : 0), row: prev.exitRow, mode: mode !== prev.mode || reband ? mode : null, speed: s.speed !== prevSpeed ? s.speed : null, from: prev.mode, next: col + (j ? j.n : 0) + 1 });
    const c0 = col + jn;
    // an apron after a mode portal: no hazard in the new section's first APRON columns (a section is generated and
    // checked entering at its own start, but the portal can leave the player at another row: GDLM 76 v3's swing put a saw
    // right where the cube came out of the wall, block 592; and no input is forced right after a mode change, fairness.js)
    const apron = prev && mode !== prev.mode ? APRON : 0;
    for (const q of cur.T) if (!(q.c < apron && HAZ.has(q.t))) tiles.push({ t: q.t, c: q.c + c0, r: q.r });
    parts.push({ i: s.i, sub: s.sub, seed: best.seed, type: s.type, mode, c0: col, c1: c0 + cur.w, look: s.look, b0: s.b0, b1: s.b1, kind: s.kind, speed: s.speed, t0: s.t0, t1: s.t1, floor: SJ.floorEdge(cur.T, 0, "L") });
    report.push(`s${s.i} b${s.b0}-${s.b1} ${s.kind.padEnd(6)} ${s.mode.padEnd(7)} ${s.speed} ${s.type} (${z.name}, ${s.tier}) cols ${col.toFixed(0)}-${(c0 + cur.w).toFixed(0)} seed ${best.seed}: ` +
      (best.c.ok ? `${best.c.presses} presses, ${best.c.label}` : best.c.ok === null ? "not checked" : "DOES NOT SOLVE ALONE"));
    const rt = best.c && best.c.route; col = c0 + cur.w; prev = { cur, mode, exitRow: rt && rt.length ? Math.round(rt[rt.length - 1][1]) : null }; prevSpeed = s.speed;
  }
  // the joined map -> objects
  const H = Math.max(...tiles.map(q => q.r)) + 1, W = Math.ceil(col), g = Array.from({ length: H }, () => Array(W).fill("."));
  for (const q of tiles) if (q.r < H && q.c < W) g[H - 1 - q.r][Math.floor(q.c)] = q.t;
  const map = g.map(l => l.join(""));
  // portal walls: portals stacked over the open run the player is in there (the section before's route leaves it at
  // exitRow; every 3 rows), and
  const extra = [];
  // the wall: every other cell of the column is a block, up to above the band, so no path goes around it
  for (const p of portals) {
    const c = p.c; let run0 = gapOf(map, c, p.row);
    // arriving in a flying mode, the wall opens only onto the next section's way in (its first column's run): an open stretch before
    // the wall left the whole height open, and GDLM 78's ship came through high and flew over the next corridor's roof
    if (p.next != null && BANDED.has(p.from)) { const nr = gapOf(map, Math.floor(p.next), p.row), a = Math.max(run0.a, nr.a), b = Math.min(run0.b, nr.b);
      run0 = b - a >= 2 ? { a, b } : { a: Math.max(run0.a, nr.a - 1), b: Math.min(run0.b, Math.max(nr.b, nr.a + 2)) }; }
    const top = Math.max(H, run0.b + 4) + 2;
    // arriving on the ground in a jumping mode (cube, robot; a ball cannot climb it): a one-block step under the portals, so it is taken in the air on
    // a jump, not walked into (the judge's "walked portal": official portals 93% taken on the move; Hellgate thread's run)
    const ground = (p.from === "cube" || p.from === "robot") && run0.b - run0.a >= 4, run = ground ? { a: run0.a + 1, b: run0.b } : run0;
    if (ground) extra.push(["block", c, run0.a]);
    for (let r = run.a + 1; r <= Math.max(run.a + 1, run.b - 1); r += 3) { if (p.mode) extra.push([PORTAL[p.mode], c, r]); if (p.speed) extra.push([SPEEDN[p.speed], c - 1, r]); }
    for (let r = 0; r <= top; r++) if ((r < run.a || r > run.b) && (map[H - 1 - r] === undefined || map[H - 1 - r][c] === ".")) extra.push(["block", c, r]);
  }
  const objects = ["// built by tools/typebuild.js from section types (tools/sectiongen.js)"];
  for (const e of require("./designthemes.js").sampleOf(map)) objects.push(e);
  objects.push(...extra);
  // looks: one design theme per look, a look per section, changed only where the look changes
  const looks = brief.looks || { calm: "void", drop: "hellgate", break: "frost" };
  // and inside one look every section gets its own sky and backdrop option (variety between sections, the look's vibe kept)
  const lsecs = [], nLook = {};
  for (const p of parts) { if (p.sub) continue; const th = looks[p.look] || looks.calm, k = nLook[p.look] = (nLook[p.look] ?? -1) + 1;
    lsecs.push(Object.assign({ from: Math.max(0, Math.round(p.c0) - 2) }, typeof th === "string" ? { theme: th } : th,
      { sky: k % 3, backdrop: p.kind === "drop" ? ["b", "c"][k % 2] : ["a", "c", "b"][k % 3] })); }
  // one calm effect per section, never the same as the section before
  const fx = []; let lastFx = null;
  for (const p of parts) { if (p.sub) { const f = fx[fx.length - 1]; if (f && lastFx !== "none") { f.t1 = +((p.b1 - 1) * P - 0.2).toFixed(2); f.c1 = Math.round(p.c1); } continue; }
    const list = FX_OF[p.kind] || ["none"], e = list.find(x => x !== lastFx) || "none"; lastFx = e;
    if (e !== "none") fx.push({ effect: e, t0: +((p.b0 - 1) * P + 0.3).toFixed(2), t1: +((p.b1 - 1) * P - 0.2).toFixed(2), hue: { void: 270, hellgate: 15, frost: 195, toxic: 110, temple: 45 }[looks[p.look]] ?? 265, y: (p.floor + 1.5) * 30, c0: Math.round(p.c0), c1: Math.round(p.c1) }); }
  const firstTheme = require("./designthemes.js").resolve(typeof (looks[parts[0].look]) === "string" ? looks[parts[0].look] : looks[parts[0].look]);
  const spec = {
    name: brief.name, desc: brief.desc || "Made by Claude.",
    notes: `built by tools/typebuild.js from ${o.briefFile || "a brief"}: ${parts.length} sections from section types (${parts.map(p => p.type).join(", ")}), cut at the song's transitions, feel per section; no lego bricks`,
    song: { custom: +brief.song }, offset: SP.from, grid: { bpm: 60 / P, t0: SP.t0 },
    colours: { bg: firstTheme.skies[0].bg, ground: firstTheme.skies[0].ground },
    structures: { sections: lsecs }, indicators: { style: brief.indicator || "spark", colour: "auto" },
    modern: false, scene: "tools/scenes/typefx.js", fx, outro: brief.outro ?? false,   // the quiet sign over the last 5 s is the ending since 0ce685b; an outro only when the brief asks
    signature: true, session: brief.session || "typebuild",
    sectionsInfo: parts.map(p => ({ seed: p.seed, type: p.type, mode: p.mode, speed: p.speed, kind: p.kind, look: p.look, from: Math.round(p.c0), to: Math.round(p.c1), beat: p.b0 })),
    objects,
  };
  return { spec, report, map, parts };
}
module.exports = { plan, build, TYPES, gapOf };

if (require.main === module) {
  require("./heavy.js").claim();
  const a = process.argv.slice(2), opt = k => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : null; };
  if (!a[0]) { console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n")); process.exit(1); }
  const brief = JSON.parse(fs.readFileSync(a[0], "utf8"));
  const r = build(brief, { dry: a.includes("--dry"), seeds: +(opt("--seeds") || 6), briefFile: a[0] });
  r.report.forEach(l => console.log(l));
  if (a.includes("--map")) console.log(r.map.join("\n"));
  const out = path.join(ROOT, brief.out);
  fs.writeFileSync(out, JSON.stringify(r.spec, null, 1) + "\n");
  fs.writeFileSync(out.replace(/\.json$/, ".map.txt"), r.map.join("\n") + "\n");   // the joined layout as text (columns = blocks)
  console.log("-> " + brief.out + (a.includes("--run") ? "" : "  (then: node tools/make.js " + brief.out + ", or --run for the whole flow)"));
  // --run: the whole flow in one command (Evgeni 2026-11-27: "when i mean to generate i mean the whole process, orchistator
  // -> sections -> layout -> deco -> judge"): make.js (solve, deco pass, indicators, outro, signature, stages, saved route),
  // then the judge report (tools/report.js), written beside the level as <level>.report.txt
  if (a.includes("--run")) {
    const { spawnSync } = require("child_process"), run = (args, label) => { console.log(`\n== ${label}: node ${args.join(" ")}`);
      const t = Date.now(), r = spawnSync(process.execPath, args, { cwd: ROOT, stdio: ["ignore", "pipe", "inherit"], encoding: "utf8", windowsHide: true, maxBuffer: 1 << 28 });
      process.stdout.write(r.stdout || ""); console.log(`   (${label}: ${((Date.now() - t) / 1000).toFixed(0)} s, exit ${r.status})`); return r; };
    const m = run(["tools/make.js", brief.out], "layout + solve + deco");
    const lv = "levels/" + require("./make.js").slug(brief.name) + ".gdlvl";
    if (m.status !== 0 || !fs.existsSync(path.join(ROOT, lv))) { console.log("!! make did not finish: no judge report"); process.exit(1); }
    const rep = run(["tools/report.js", lv], "judge");
    // secret ways (Evgeni 2026-11-28: "be careful for secret ways and skipping the structures ( in wave for example )"):
    // a portal the route never takes (tools/skips.js), a stretch flown over or under a corridor (tools/outside.js)
    const sk = run(["tools/skips.js", lv], "skipped portals"), ou = run(["tools/outside.js", lv], "flown around");
    fs.writeFileSync(path.join(ROOT, lv.replace(/\.gdlvl$/, ".report.txt")), (rep.stdout || "") + "Secret ways: " + (sk.stdout || "").trim() + "; " + (ou.stdout || "").trim() + "\n");
    console.log("\n-> " + lv + " + " + lv.replace(/\.gdlvl$/, ".report.txt"));
  }
}
