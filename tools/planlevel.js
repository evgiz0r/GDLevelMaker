// node tools/planlevel.js <song> --name "GDLM NN name" --out specs/NN_name.json [planner options: --from-bar
//                         --bars --secs --theme] [--desc "..."] [--seed n]
//   -- a level from the section planner (tools/scenes.js, SCENES.md): every section of the plan becomes
//      gameplay in its mode, made of ranked structures (tools/structures.js, STRUCTURES.md), with its
//      mode portal on the section's first bar (framed when a flying mode leaves through it), the lead-in
//      of rated low-tier levels after it, and the plan itself in the spec ("scenePlan") for the scene
//      script tools/scenes/planned.js (palettes, props from lib/props.js, camera). Then:
//      node tools/make.js specs/NN_name.json && node tools/score.js levels/<name>.gdlvl
// The whole level stays at 1x (structures with speed portals are left out: they would move every later
// section off its bar; open in SCENES.md).
"use strict";
const fs = require("fs"), path = require("path");
const SC = require("./scenes.js"), ST = require("./structures.js");

const SPEED = 311.58;   // units per second at 1x
// blocks of calm after a mode portal (rated low-tier medians, knowledge/levels/modes_low_tier.md)
const LEADIN = { cube: 6, upside: 4, ship: 8, wave: 4, robot: 4, ufo: 4, ball: 5, spider: 5, swing: 6 };
const FLYING = new Set(["ship", "ufo", "wave", "swing"]);
const PORTAL = { cube: "cube portal", upside: "cube portal", ship: "ship portal", ufo: "ufo portal", wave: "wave portal", robot: "robot portal", ball: "ball portal", spider: "spider portal", swing: "swing portal" };

// the structures a section of this mode may use, best ranked first
function pool(mode, role) {
  const all = ST.ranked({ maxTier: "Normal" }).filter(s => !(s.tags || []).some(t => /speed|teleport/.test(t)) && s.needs.grav === 1 && s.leaves.grav === 1 && !s.needs.mini && !s.leaves.mini && s.needs.speed === "1x");
  if (mode === "upside") return all.filter(s => s.mode === "cube" && (s.tags || []).includes("gravity"));
  if (mode === "cube") return all.filter(s => s.mode === "cube" && !(s.tags || []).includes("gravity") && (role === "intro" ? s.tier === "Easy" : true));
  return all.filter(s => s.mode === mode);
}

function build(plan, o = {}) {
  const period = plan.period, barSec = plan.barSec;
  const colOfT = t => (t * SPEED - 15) / 30;
  const objs = [], used = new Map();
  let prevMode = "cube", prevExit = 1;
  const push = (t, c, r, x) => objs.push(x ? [t, c, r, x] : [t, c, r]);
  const gate = (c, r) => { for (let rr = 0; rr < 10; rr++) if (rr < r - 1 || rr > r + 1) push("block", c, rr); };
  plan.sections.forEach((s, i) => {
    const mode = s.mode.split(" ")[0];
    const c0 = colOfT(s.t[0]), c1 = colOfT(s.t[1]), first = Math.round(c0);
    objs.push(`// ${s.bars[0]}-${s.bars[1]} ${s.role}: ${s.scene.place}, ${s.mode}`);
    let c = i === 0 ? 14 : first;   // the level opens with 14 calm blocks (checklist: start after the attempt counter)
    // the mode portal on the section's first bar (beat 4*bar + 1); a flying mode leaving through it gets a
    // gate (blocks above and below the portal's three rows) so the path goes through it
    const modeCh = (mode === "upside" ? "cube" : mode) !== (prevMode === "upside" ? "cube" : prevMode);
    if (i > 0 && modeCh) {
      const r = FLYING.has(mode) ? (FLYING.has(prevMode) ? Math.max(2, Math.min(7, prevExit)) : 1) : 1;
      push(PORTAL[mode], `b${4 * s.bars[0] + 1}`, FLYING.has(prevMode) ? r : 1);
      if (FLYING.has(prevMode)) gate(first, FLYING.has(mode) ? r : 1);
      c = first + 1 + LEADIN[mode];
    } else if (i > 0) c = first + 3;
    // structures back to back until the section's end (room left for the next portal's approach)
    const end = c1 - (FLYING.has(mode) ? 5 : 3);
    const cand = pool(mode, s.role);
    let k = 0, lastExit = 1;
    while (cand.length) {
      const fresh = cand.filter(x => !used.has(x.id));
      const pick = (fresh.length ? fresh : cand.filter(x => used.get(x.id) < 2)).find(x => c + x.width <= end);
      if (!pick) break;
      const st = ST.byId(pick.id), r = st.build(Object.assign({}, st.args));
      objs.push(`//   ${pick.id} (score ${pick.rank && (pick.rank.score ?? pick.score)}) at ${Math.round(c)}`);
      for (const e of r.objects) {
        if (e[0] === "pattern") objs.push(["pattern", e[1], Math.round(c) + e[2], e[3], e[4]]);
        else push(e[0], Math.round(c) + e[1], e[2], e[3]);
      }
      used.set(pick.id, (used.get(pick.id) || 0) + 1);
      lastExit = r.exitRow ?? 1;
      c += r.width + 3 + (k++ % 2);
    }
    prevMode = mode; prevExit = lastExit;
  });
  // the end: back to a cube on the ground (framed), a short run, then make.js's signature
  const endT = plan.sections[plan.sections.length - 1].t[1], ce = Math.round(colOfT(endT));
  if ((prevMode === "upside" ? "cube" : prevMode) !== "cube") {
    push("cube portal", ce, 1);
    if (FLYING.has(prevMode)) { gate(ce, 1); for (let cc = ce - 6; cc < ce; cc++) push("block", cc, 3); }
  }
  return objs;
}

function spec(plan, o) {
  const objs = build(plan, o);
  return {
    name: o.name, desc: o.desc || `A journey through ${plan.sections.map(s => s.scene.place).filter((p, i, a) => a.indexOf(p) === i).join(", ")}.`,
    notes: `Made by the section planner (tools/scenes.js) and tools/planlevel.js from ${plan.song}, song bars ${plan.fromBar}-${plan.toBar}, theme ${plan.theme}.`,
    song: { custom: +String(plan.song).replace(/\D/g, "") }, offset: plan.offset, grid: { bpm: plan.bpm, t0: o.t0 },
    scene: "tools/scenes/planned.js", indicators: {},
    scenePlan: { theme: plan.theme, barSec: plan.barSec, sections: plan.sections.map(s => ({ bars: s.bars, t: s.t, role: s.role, energy: s.energy, mode: s.mode, fade: s.fade, camera: s.camera, place: s.scene.place, mood: s.scene.mood, palette: s.scene.palette, props: s.scene.props })) },
    objects: objs,
  };
}
module.exports = { build, spec };

if (require.main === module) {
  const a = process.argv.slice(2), opt = k => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : undefined; };
  if (!a[0] || !opt("--name") || !opt("--out")) { console.log('usage: node tools/planlevel.js <song> --name "GDLM NN name" --out specs/NN_name.json [--from-bar B] [--bars N | --secs S] [--theme T] [--desc "..."]'); process.exit(1); }
  const song = SC.loadSong(a[0]);
  const plan = SC.plan(song, { fromBar: opt("--from-bar") != null ? +opt("--from-bar") : undefined, bars: opt("--bars") != null ? +opt("--bars") : undefined, secs: opt("--secs") != null ? +opt("--secs") : undefined, theme: opt("--theme") });
  const beats = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "local", "beats", song.key + ".json"), "utf8"));
  const sp = spec(plan, { name: opt("--name"), desc: opt("--desc"), t0: beats.t0 });
  const lines = JSON.stringify(Object.assign({}, sp, { objects: undefined }), null, 2).replace(/\n}$/, "");
  fs.writeFileSync(opt("--out"), lines + ',\n  "objects": [\n' + sp.objects.map(e => "    " + JSON.stringify(e)).join(",\n") + "\n  ]\n}\n");
  console.log(`${opt("--out")}: ${plan.sections.length} sections, ${sp.objects.filter(e => Array.isArray(e)).length} entries`);
  for (const e of sp.objects) if (typeof e === "string") console.log("  " + e.replace(/^\/\/ ?/, ""));
}
