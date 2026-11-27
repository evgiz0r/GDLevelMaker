// tools/scenes/typefx.js -- a scene script (make.js spec "scene"): one calm effect per section from spec.fx
//   [{effect, t0, t1 (level seconds), hue, y (units: where the player runs at the section's start)}], written by
//   tools/typebuild.js. The effects are tools/effects.js's (deco only, trusted triggers; no pulse, nothing flashy). The
//   level is not an auto one, so the effects' path is the level's timeline (x of t through its speed portals) at the
//   section's running height: enough for effects that lock to the player or the camera (clouds, chase, screenFrame).
"use strict";
const FX = require("../effects.js");
module.exports = function ({ spec, xOfT, header }) {
  const list = spec.fx || []; if (!list.length) return { objects: [] };
  const TPS = 240, end = Math.max(...list.map(f => f.t1)) + 1, path = [];
  const yAt = t => { const f = list.find(f => t >= f.t0 - 0.5 && t <= f.t1 + 0.5); return f ? f.y : 60; };
  for (let i = 0; i <= end * TPS; i++) path.push({ x: xOfT(i / TPS), y: yAt(i / TPS) });
  const g = spec.grid ? { t0: (spec.grid.t0 || 0) - (spec.offset || 0), period: 60 / spec.grid.bpm } : { t0: 0, period: 0.5 };
  const ctx = FX.context({ path, grid: g, notes: [] }), out = [];
  for (const f of list) { if (!FX[f.effect]) continue; ctx.setHue(f.hue ?? 265); out.push(...FX[f.effect](ctx, { t0: f.t0, t1: f.t1 })); }
  out.push(...ctx.prelude());
  console.log(`   typefx: ${list.map(f => f.effect + " " + f.t0 + "-" + f.t1 + " s").join(", ")}`);
  return { objects: out, header: ctx.header(header) };
};
