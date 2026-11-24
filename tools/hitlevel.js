// node tools/hitlevel.js briefs/<NN_name>.hits.json [--check]  -> specs/<NN_name>.json
//   -- an ultra-synced level from a list of HITS: every press is pinned to a real hit of the song
//      (tools/hits.js lists them: kick, snare, accent per half-beat), every portal and look change
//      to a section start. make.js then slides each press's group until the press sits on its beat
//      ("jN" columns, SYNC.md section 4). First used for GDLM 62 (briefs/62_low_end_lullaby.hits.json).
//   --check: also print, for every cell, the hit kind at its beat (from local/hits/<song>.json) and
//      refuse cells on a slot with no hit ('.').
//
// Plan (1x speed only, so beats map straight to columns):
// { "name", "desc", "notes", "song": {"custom": id}, "offset": 0, "grid": {"bpm", "t0"},
//   "style": "classic", "art": {...}, "colours": {...}, "title": "...", "end": "...", "seed": n,
//   "sections": [ {"from": beat, "kind": "cube"|"ball"|"ship"|"rest", "bg", "ground", "line",
//                  "fill", "light", "flash", "deco", "secs"} ],   // ball/ship: portal on `from`,
//                  // a framed cube portal on the next section's `from`
//   "cells": [ [beat, kind, {args}] ],   // cube: spike | double | up | upoff | down | orb | pad | flat ({off: true} = walk off a row later)
//                                        // ball: floor | roof (the flip pressed on `beat`)
//   "pulses": [ [beat, [r,g,b]] ],       // a soft bg swell on a big hit (a tint, never white)
//   "last": beat }                       // the level's last gameplay beat (the sign comes after)
// Cube cells own the columns from their obstacle to the next cell's, at the floor height they
// leave: `up` = a 1-high step face, `down` = a spike on the ledge's end and a floor one row lower,
// `orb` / `pad` = the orb-pit / pad-launch patterns on the bare floor (height 0).
const fs = require("fs"), path = require("path");
const PH = require("../lib/physics.js");

const UPS = PH.SPEEDS[1].x * 60;   // 1x, units per second

// opts (tools/hitbuild.js, beat-first): numeric: true -> plain columns (no "jN": nothing is slid by solving);
// shift[i] / orbShift[i] (columns) move cell i's obstacle / its orb; ship[sectionIndex] = spec entries for a
// ship section (a corridor built around a planned path) instead of the ship-tunnel pattern.
const LEAD = { spike: 2.22, double: 2.22, down: 2.22, orb: 2.22, up: 1.9, upoff: 1.9, flat: 0, floor: 1.6, roof: 1.6 };
function build(plan, opts = {}) {
  const num = !!opts.numeric, ranges = [];
  const P = 60 / plan.grid.bpm, t0 = plan.grid.t0, off = plan.offset || 0;
  const first = Math.ceil((off - t0) / P - 1e-9);
  const tOf = b => t0 + (first + b - 1) * P - off;
  const col = b => (tOf(b) * UPS - 15) / 30;          // the player's centre on beat b
  const bpb = P * UPS / 30;                           // blocks per beat
  const r2 = v => +v.toFixed(2);
  const o = [], secs = plan.sections, modern = [];
  const secAt = b => secs.filter(s => s.from <= b).pop();
  // look + modes per section
  secs.forEach((s, i) => {
    const next = secs[i + 1], b = s.from;
    for (const ch of ["bg", "ground", "line"]) if (s[ch]) o.push(["colour", "b" + b, { ch, rgb: s[ch], secs: s.secs ?? 0.4 }]);
    const to = next ? next.from : plan.last + 3;
    modern.push({ from: Math.max(0, Math.round(col(b))), to: Math.round(col(to)), kind: s.kind === "rest" ? "rest" : s.kind, flash: !!s.flash, fill: s.fill, light: s.light });
    if (s.kind === "ball" || s.kind === "ship") {
      const w = Math.round((next.from - b) * bpb) - 1;
      const c1 = num ? col(b) + 1 : "b" + b + "+1";
      if (s.kind === "ship" && opts.ship && opts.ship[i]) o.push(...opts.ship[i]);
      else if (s.kind === "ball") o.push(["pattern", "ball-run", c1, 0, { w, gap: s.gap || 5, lead: 999, portal: true, exit: "cube", portalRow: 1 }]);
      else o.push(["pattern", "ship-tunnel", c1, 0, { w, gap: s.gap || 5, amp: s.amp ?? 1.5, base: 0, teeth: true, lead: 8, waves: s.waves || 2, portal: true, exit: "cube", portalRow: 1 }]);
    }
  });
  // cells
  let h = 0;
  const cells = plan.cells;
  // numeric: every cell's obstacle column first, so each cell's terrain runs exactly to the next one's
  const Jof = i => +(col(cells[i][0]) + (LEAD[cells[i][1]] ?? 2.22) + ((opts.shift || [])[i] || 0)).toFixed(3);
  cells.forEach(([b, kind, a0], i) => {
    const a = Object.assign({}, a0 || {});
    const s = secAt(b), J = num ? Jof(i) : "j" + b;
    const o0 = o.length; ranges[i] = [o0, o0];
    const nextB = i + 1 < cells.length && secAt(cells[i + 1][0]) === s ? cells[i + 1][0] : null;
    let span = Math.ceil(((nextB || (secs[secs.indexOf(s) + 1] || { from: plan.last + 1.5 }).from) - b) * bpb) + 1;
    if (num && nextB) span = Math.ceil(Jof(i + 1) - J) + 1;   // to the next obstacle (one column of overlap)
    else if (num) span = Math.ceil(col((secs[secs.indexOf(s) + 1] || { from: plan.last + 1.5 }).from) - J) + 1;
    const at = k => num ? +(J + k).toFixed(3) : J + (k >= 0 ? "+" : "") + k;
    const floor = (from, to, hh) => { for (let k = from; k < to; k++) for (let r = 0; r < hh; r++) o.push(["block", at(k), r]); };
    if (s.kind === "ball") {
      if (kind === "floor") { o.push(["spike", J, 0]); o.push(["spike", at(1), 0]); }
      else if (kind === "roof") { const g = s.gap || 5; o.push(["spike", J, g - 1, { rot: 180 }]); o.push(["spike", at(1), g - 1, { rot: 180 }]); }
      else throw new Error(`ball cell "${kind}" at ${b}`);
      ranges[i] = [o0, o.length];
      return;
    }
    // `off` (spike / up cells on a raised floor): the floor steps down a row partway to the next cell
    // (a free walk-off: one more height change without a press; STRUCTURES.md "Height and repetition"), 6+ blocks
    // before the next obstacle so the cube has landed before its jump (GDLM 62: a double 3 blocks after a drop was 113 ms)
    const offAt = a.off === true ? Math.max(3, Math.floor(span - 6)) : a.off;
    const walk = from => { if (offAt && h >= 1) { floor(from, offAt, h); h -= 1; floor(offAt, span, h); } else floor(from, span, h); };
    if (kind === "upoff") { kind = "up"; a.off = true; }
    if (kind === "spike") { o.push(["spike", J, h]); walk(0); }
    else if (kind === "double") { o.push(["spike", J, h]); o.push(["spike", at(1), h]); floor(0, span, h); }
    else if (kind === "up") { h += 1; if (a.spike) o.push(["spike", at(a.spike), h]); const offA = a.off === true ? Math.max(3, Math.floor(span - 6)) : a.off; if (offA) { floor(0, offA, h); h -= 1; floor(offA, span, h); } else floor(0, span, h); }
    else if (kind === "down") { if (h < 1) throw new Error(`"down" on the floor at beat ${b}`); floor(0, 1, h); o.push(["spike", J, h]); h -= 1; floor(1, span, h); }
    else if (kind === "orb") {
      if (h) throw new Error(`orb off the floor at ${b}`);
      if (!num) o.push(["pattern", "orb-pit", J, 0, { n: a.n || 5 }]);
      else { const n = a.n || 5; for (let k = 0; k < n; k++) o.push(["spike", at(k), 0]); const at2 = (opts.orbAt || [])[i];   // [col, row]: where the jump's arc is at the orb tap's hit (tools/hitbuild.js)
        o.push(["yellow orb", at2 ? +(at2[0] + ((opts.orbShift || [])[i] || 0)).toFixed(3) : +(J + Math.floor(n / 2) + ((opts.orbShift || [])[i] || 0)).toFixed(3), at2 ? +at2[1].toFixed(3) : a.orbRow || 2]); }
    }
    else if (kind === "pad") { if (h) throw new Error(`pad off the floor at ${b}`); o.push(["pattern", "pad-launch", num ? +col(b).toFixed(3) : "b" + b, 0, { n: a.n || 3 }]); }
    else if (kind === "flat") floor(0, span, h);
    else throw new Error(`cube cell "${kind}" at ${b}`);
    ranges[i] = [o0, o.length];
    const nextSec = secs[secs.indexOf(s) + 1];
    if (!nextB && h) throw new Error(`section ending at beat ${nextSec ? nextSec.from : "end"} leaves the floor at height ${h}`);
  });
  for (const [b, rgb] of plan.pulses || []) {
    const s = secAt(b);
    o.push(["colour", "b" + b, { ch: "bg", rgb, secs: 0.06 }]);
    o.push(["colour", "b" + (b + 0.5), { ch: "bg", rgb: s.bg, secs: 0.6 }]);
  }
  const spec = {
    name: plan.name, desc: plan.desc, notes: plan.notes,
    decoDensity: secs.map(s => [Math.max(0, Math.round(col(s.from))), s.deco ?? 0.25]),
    signature: {},
    modern: { sections: modern, title: plan.title || plan.name, end: plan.end || "thanks for playing", seed: plan.seed || 1 },
    style: plan.style || "classic", art: plan.art, song: plan.song, offset: off, grid: plan.grid, seed: plan.seed || 1,
    colours: plan.colours || { bg: secs[0].bg, ground: secs[0].ground },
    objects: o,
  };
  if (plan.indicators) spec.indicators = plan.indicators;
  return { spec, col, bpb, tOf, ranges };
}

if (require.main === module) {
  const file = process.argv[2];
  if (!file) { console.log("usage: node tools/hitlevel.js briefs/<NN_name>.hits.json [--check]"); process.exit(1); }
  const plan = JSON.parse(fs.readFileSync(file, "utf8"));
  const { spec, bpb } = build(plan);
  if (process.argv.includes("--check")) {
    const key = plan.song.custom;
    const h = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "local", "hits", key + ".json"), "utf8"));
    const kindAt = b => (h.slots.find(s => Math.abs(s.beat - b) < 0.01) || {}).kind || "?";
    let bad = 0;
    for (const [b, kind] of plan.cells) {
      const k = kindAt(b);
      if (kind === "pad") continue;   // a pad is no press
      if (k === "." || k === "?") bad++;
      console.log(String(b).padStart(6), kind.padEnd(7), "hit:", k);
    }
    console.log(`${plan.cells.length} cells, ${bad} on no hit; ${bpb.toFixed(3)} blocks per beat`);
    if (bad) process.exit(2);
  }
  const out = path.join("specs", path.basename(file).replace(/\.hits\.json$/, ".json"));
  fs.writeFileSync(out, JSON.stringify(spec, null, 1));
  console.log("->", out, spec.objects.length, "entries");
}
module.exports = { build };
