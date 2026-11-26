// node tools/planbuild.js briefs/<NN_name>.plan.json [--dry]   -- a level from a SECTION PLAN on the song's hits -> its spec
//
// The GDLM 44 hellgate v4 builder (tools/hellgate_build.js, BUILDING.md section 0, LEGO.md "The build pipeline Evgeni set")
// with its plan as data, so any level can be built that way (GDLM 73 was the first, 2026-11-26). Per section:
//   ground modes (cube, ball, robot, ufo, spider): our own verified bricks placed on the song's hits (tools/brickpick.js),
//     single spikes on the hits ("j<beat>") between them; cube / robot / ufo floors climb a block at a time;
//   mini: single spikes on the hits only;
//   flying modes (ship, wave, swing): a smooth fly-path corridor sized to fill the section at its speed, entered through a
//     walled portal at the end of the section before and left through a walled portal into the next (no skips).
// A flying section can not be the first, and two flying sections must not follow each other (put a ground part between).
// Needs the song's hits: node tools/hits.js <song id> (local/hits/<id>.json, on the plan's grid).
//
// Plan file:
// { "name": "GDLM 73 ...", "desc": "...", "notes": "...", "out": "specs/73_x.json",
//   "song": 753562, "offset": 0, "bpm": 160.007, "t0": 0.2483, "end": 203,      // end = the last level beat
//   "theme": "sunny",                                         // tools/themes/<name>.js; each section's "variant" picks its look
//   "colours": {...}, "drop": 25, "pulseZones": [[25, 41]],   // as in a make.js spec
//   "sections": [ { "from": 1, "to": 17, "mode": "cube", "speed": "1x", "kind": "intro", "base": 0, "variant": "morning",
//                   "max": "Normal", "rows": [2, 5, 3] }, ... ] }
//   base = the section's floor in blocks (null for a flying one); rows = a flying corridor's knot heights (else a default
//   set per mode, rotated per section so no corridor repeats); max = the hardest brick label (default Normal at 1x, Hard
//   faster); fill = the filler's shapes in rotation (cube default single / double); minDensity = presses per 10 blocks
//   for a brick (default 1.5 at 1x, scaled by speed).
"use strict";
const fs = require("fs"), path = require("path");
const { pick } = require("./brickpick.js");
const ROOT = path.join(__dirname, "..");
const BPS = { "0.5x": 8.372, "1x": 10.386, "2x": 12.914, "3x": 15.6, "4x": 19.2 };   // blocks per second (lib/physics.js SPEEDS x * 60 / 30)
const FLY = new Set(["ship", "wave", "swing"]);
const PORTAL = { cube: "cube portal", mini: "cube portal", ball: "ball portal", ship: "ship portal", robot: "robot portal",
  ufo: "ufo portal", wave: "wave portal", spider: "spider portal", swing: "swing portal" };
const CLIMB = [1, 2, 1, 3, 2, 3, 4, 3, 2, 1, 2, 3];
const HEIGHTS = { wave: [2, 6, 3, 7, 2, 5, 4, 8, 3, 6, 2, 7, 4, 6, 2, 8, 3, 6, 2, 7, 3, 5],
  swing: [2, 5, 3, 6, 2, 6, 3, 5, 2, 6, 4, 2], ship: [2, 5, 3, 6, 2, 5, 3, 6, 4, 2, 5, 3] };

function build(plan) {
  const P = 60 / plan.bpm, offset = plan.offset || 0;
  const hitsFile = path.join(ROOT, plan.hits || path.join("local", "hits", plan.song + ".json"));
  const H = JSON.parse(fs.readFileSync(hitsFile, "utf8"));
  if (Math.abs(H.t0 - plan.t0) > 1e-3) throw new Error(`${hitsFile} is on another grid (t0 ${H.t0}): node tools/hits.js ${plan.song} --bpm ${plan.bpm} --t0 ${plan.t0} --downbeat 0`);
  const S = plan.sections.map(s => Object.assign({ base: FLY.has(s.mode) ? null : 0 }, s));
  S.forEach((s, i) => { if (FLY.has(s.mode) && (i === 0 || FLY.has(S[i - 1].mode))) throw new Error(`section ${i} (${s.mode}): a flying section needs a ground section before it`); });
  const colOf = b => { let c = 0; for (const s of S) { if (b <= s.from) break; c += (Math.min(b, s.to) - s.from) * P * BPS[s.speed]; } return c; };
  const objs = [], used = (plan.avoid || []).slice(), report = [];
  const gate = (at, names, row) => {
    for (const n of names) objs.push([n, at, row]);
    for (let r = 0; r < Math.max(10, row + 10); r++) if (r < row - 1 || r > row + 1) objs.push(["block", at, r]);
  };
  const floorOf = (b0, b1, sp, B) => { const out = [], w = Math.ceil((b1 - b0) * P * BPS[sp]);
    for (let c = 1; c < w; c++) for (let r = 0; r < B; r++) out.push(["block", `b${b0}+${c}`, r]); return out; };
  const rise = (b0, vcol, picks, mode, B = 0) => {
    if (!["cube", "mini", "robot", "ufo"].includes(mode)) { for (const p of picks) p.h = B; return []; }
    const out = []; let h = 0, k = 0;
    picks.forEach((p, i) => {
      const prevEnd = i ? picks[i - 1].col + picks[i - 1].width : p.col - 2;
      let nh = CLIMB[(k++ + b0) % CLIMB.length]; if (nh > h + 1) nh = h + 1;
      h = nh;
      const a = Math.round(prevEnd - vcol), z = Math.round(p.col + p.width - vcol);
      for (let c = a; c < z; c++) for (let r = B; r < B + h; r++) out.push(["block", `b${b0}+${c}`, r]);
      p.h = B + h;
    });
    return out;
  };
  const base = { slots: H.slots, grid: { period: P }, offset, used, beatCols: true, deadAir: 1.0, gap: [2, 4], minDensity: 1.5 };

  S.forEach((s, i) => {
    const { from: b0, to: b1, mode, speed: sp, kind } = s, prev = S[i - 1];
    const label = `b${b0}-${b1} ${mode} ${sp}${kind ? " (" + kind + ")" : ""}`;
    const vcol = (b0 - 1) * P * BPS[sp];
    if (FLY.has(mode)) return;
    if (i > 0 && !FLY.has(prev.mode)) {
      const names = [];
      if (PORTAL[mode] !== PORTAL[prev.mode]) names.push(PORTAL[mode]);
      if (sp !== prev.speed) names.push(sp + " speed");
      if (mode === "mini") names.push(101); if (prev.mode === "mini") names.push(99);
      if (names.length) gate("b" + b0, names, prev.base + 1);
    }
    const B = s.base;
    objs.push(...floorOf(b0, b1, sp, B));
    if (mode === "mini") {
      const r = pick(Object.assign({}, base, { mode: "cube", speed: sp, startCol: vcol + 4, fromBeat: b0, toBeat: b1 - 1, max: "Easy", beats: true, fillerOnly: true }));
      const ps = r.picks.filter(p => p.j), floor = rise(b0, vcol, ps, mode, B);
      objs.push(...floor, ...ps.map(p => ["pattern", "single", "j" + p.beat, p.h || 0]));
      report.push(`${label}: ${ps.length} spikes on the hits`);
    } else {
      // minDensity is presses per 10 blocks: the same presses per second spread over more blocks at a faster speed (2x
      // bricks were all filtered out by the 1x floor, GDLM 73's first cut: 8 single spikes per 2x section)
      const r = pick(Object.assign({}, base, { mode, speed: sp, startCol: vcol + 4, fromBeat: b0, toBeat: b1 - 0.5, beats: true, usedPenalty: 1.2,
        minDensity: s.minDensity ?? base.minDensity * BPS["1x"] / BPS[sp] * 0.9,
        filler: mode === "cube" || mode === "robot", max: s.max || (sp !== "1x" ? "Hard" : "Normal") }));
      // the filler's shape: a rotation (default single / double) so a run of filler is not one spike over and over
      const fill = s.fill || (mode === "cube" ? ["single", "double", "single", "single", "double"] : ["single"]); let fk = i;
      for (const p of r.picks) if (p.j) p.shape = fill[fk++ % fill.length];
      for (const p of r.picks) if (!p.j) used.push(p.id);
      const floor = rise(b0, vcol, r.picks, mode, B);
      objs.push(...floor, ...r.picks.map(p => p.j ? ["pattern", p.shape || "single", "j" + p.beat, p.h] : mode === "cube" ? ["pattern", "s:" + p.id, "b" + p.beat, p.h] : ["pattern", "s:" + p.id, "b" + p.beat, p.h, { raw: true }]));
      report.push(`${label}: ${r.picks.map(p => p.shape || p.id).join(", ") || "(none)"} -- ${r.presses} presses, ${Math.round(r.onHit * 100)}% on a hit`);
    }
    const nx = S[i + 1];
    if (nx && FLY.has(nx.mode)) {
      const { from: f0, to: f1, mode: fm, speed: fsp } = nx, after = S[i + 2];
      const width = Math.floor((f1 - f0) * P * BPS[fsp]) - 2;
      // the default knots, rotated per section so two corridors of one mode never share a recipe (checklist: no corridor twice)
      const H0 = nx.rows || HEIGHTS[fm], rot = nx.rows ? 0 : (5 * S.slice(0, i + 1).filter(x => x.mode === fm).length + 1) % H0.length;
      const heights = H0.slice(rot).concat(H0.slice(0, rot));
      const flat = fm === "wave" ? 2 : fm === "swing" ? 5 : 6, lead = 4;
      const rows = [heights[0]]; let w = lead;
      const Bp = s.base, Bn = after ? after.base : 0, L = Math.max(2, Math.min(8, Bn - Bp + 1));
      for (let k = 1; k < heights.length; k++) { const add = Math.abs(heights[k] - rows[rows.length - 1]) + flat, fin = Math.abs(L - heights[k]) + flat;
        if (w + add + fin + 3 > width) break; rows.push(heights[k]); w += add; }
      if (rows[rows.length - 1] !== L) { w += Math.abs(L - rows[rows.length - 1]) + flat; rows.push(L); }
      const tail = Math.max(3, width - w);
      const a = { mode: fm, rows, flat, lead, tail, gap: fm === "wave" ? 4 : 5, spikes: fm === "wave" ? "turns" : "both", every: 5,
        exit: after ? (after.mode === "mini" ? "cube" : after.mode) : undefined };
      if (fm === "ship") a.gates = [2, 4];
      Object.assign(a, nx.args || {});
      const names = [PORTAL[fm]]; if (fsp !== sp) names.push(fsp + " speed"); if (mode === "mini") names.push(99);
      gate("b" + f0, names, Bp + 1);
      objs.push(["pattern", "fly-path", "b" + f0 + "+1", Bp, a]);
      const exitAt = "b" + f0 + "+" + (1 + w + tail), er = Bp + rows[rows.length - 1];
      if (after && after.speed !== fsp) objs.push([after.speed + " speed", exitAt, er]);
      if (after && after.mode === "mini") objs.push([101, exitAt, er]);
      report.push(`b${f0}-${f1} ${fm} ${fsp}: fly-path ${rows.join("-")}, ${width} blocks`);
    }
  });

  const endBeat = plan.end || S[S.length - 1].to, endCol = Math.round(colOf(endBeat));
  const spec = Object.assign({
    name: plan.name, desc: plan.desc, notes: plan.notes, style: plan.style, indicators: {}, signature: true,
    song: { custom: plan.song }, offset, grid: { bpm: plan.bpm, t0: plan.t0 },
    drop: plan.drop, pulseZones: plan.pulseZones, colours: plan.colours,
  }, plan.theme ? { scene: "tools/scenes/theme.js",
    theme: { name: plan.theme, sections: S.map(s => ({ from: Math.max(0, Math.round(colOf(s.from)) - 2), variant: s.variant })).filter(x => x.variant) } } : {},
  plan.spec || {}, { objects: objs });
  for (const k of Object.keys(spec)) if (spec[k] === undefined) delete spec[k];
  return { spec, report, endCol, secs: (endBeat - 1) * P };
}

if (require.main === module) {
  const a = process.argv.slice(2);
  if (!a[0]) { console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n")); process.exit(1); }
  const plan = JSON.parse(fs.readFileSync(a[0], "utf8")), r = build(plan);
  console.log(r.report.join("\n"));
  console.log(`~${r.endCol} blocks, ${r.secs.toFixed(1)} s`);
  if (!a.includes("--dry")) {
    const out = path.join(ROOT, plan.out); fs.writeFileSync(out, JSON.stringify(r.spec, null, 1) + "\n"); console.log("-> " + plan.out);
    // the song stage (BUILDING.md 4): the song, its grid, the plan's sections and the hits, before any gameplay
    try {
      const STG = require("./stages.js"), { slug } = require("./make.js"), P = 60 / plan.bpm;
      const H = JSON.parse(fs.readFileSync(path.join(ROOT, plan.hits || path.join("local", "hits", plan.song + ".json")), "utf8"));
      const session = r.spec.session || process.env.GDLM_SESSION || "planbuild";
      STG.put({ session, base: slug(plan.name), name: plan.name, stage: "song", note: `song ${plan.song}, ${plan.sections.length} sections on its bars`,
        data: { song: { id: plan.song, offset: plan.offset || 0 }, grid: { bpm: plan.bpm, period: P, t0: plan.t0 },
          sections: plan.sections.map(x => ({ name: `${x.mode} ${x.speed}${x.kind ? " " + x.kind : ""}`, from: +((x.from - 1) * P).toFixed(3), to: +((x.to - 1) * P).toFixed(3) })),
          hits: H.slots.filter(x => x.kind && x.kind !== ".").map(x => ({ beat: x.beat, t: x.t, kind: x.kind })) } });
      console.log(`   song stage -> local/wip/${session}/${slug(plan.name)}.stages/`);
    } catch (e) { console.log("   (song stage not put: " + e.message + ")"); }
  }
}
module.exports = { build };
