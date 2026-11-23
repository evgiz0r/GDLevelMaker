// node tests/generator_impact.js [--verbose]
//
// Does a change to a shared generator (tools/patterns.js, structures.js, compose.js, decorate.js, make.js)
// change the GAMEPLAY of levels already made? For every specs/*.json whose level is in levels/, rebuild its
// objects from the spec (make.js build: no solve, seconds) and compare the gameplay objects (solids,
// hazards, orbs, pads, portals, slopes: id, x, y, rotation, flips, scale) with the saved level. A difference
// means: rebuilding that level now changes how it plays. Run it before pushing a generator change; tell each
// level's owner, or keep the old shape (pattern options in the spec).
// Found by: polish's wave-zigzag change for hellgate (3221f04) silently changed GDLM 50 eclipse (417 -> 397
// blocks, 70 -> 80 slopes); showcase saw it only when a --look rebuild fell back to a full solve.
// Exit 1 when any level would change (a report, not a failure of the code: decide, then commit).
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const { GD, readGdlvl } = require(path.join(ROOT, "tools", "io.js"));
const { build, slug } = require(path.join(ROOT, "tools", "make.js"));
const PLAY = new Set(["solid", "hazard", "orb", "pad", "mode", "gravity", "speed", "size", "teleport", "slope"]);
const key = o => [o.id, Math.round(o.x * 10) / 10, Math.round(o.y * 10) / 10, o.rot || 0, o.flipX ? 1 : 0, o.flipY ? 1 : 0, (o.props || {})[32] || 1].join(",");
const play = objs => objs.filter(o => PLAY.has(GD.objInfo(o.id).kind)).map(key);

const verbose = process.argv.includes("--verbose");
let changed = 0, checked = 0;
const quiet = console.log;
for (const f of fs.readdirSync(path.join(ROOT, "specs")).filter(f => f.endsWith(".json")).sort()) {
  let spec; try { spec = JSON.parse(fs.readFileSync(path.join(ROOT, "specs", f), "utf8")); } catch (e) { continue; }
  if (!spec.name || !Array.isArray(spec.objects)) continue;
  const lv = path.join(ROOT, "levels", slug(spec.name) + ".gdlvl");
  if (!fs.existsSync(lv)) continue;
  let built;
  console.log = () => {};                     // build() prints its notes; keep the report readable
  try { built = build(spec, path.join("specs", f)).level; } catch (e) { console.log = quiet; console.log(`${spec.name}: build fails (${e.message})`); changed++; continue; } finally { console.log = quiet; }
  const saved = readGdlvl(lv).level;
  const a = play(saved.objects), b = play(built.objects);
  const count = arr => { const m = new Map(); for (const k of arr) m.set(k, (m.get(k) || 0) + 1); return m; };
  const ma = count(a), mb = count(b), gone = [], added = [];
  for (const [k, n] of ma) for (let i = 0; i < n - (mb.get(k) || 0); i++) gone.push(k);
  for (const [k, n] of mb) for (let i = 0; i < n - (ma.get(k) || 0); i++) added.push(k);
  checked++;
  const endA = Math.max(...saved.objects.filter(o => PLAY.has(GD.objInfo(o.id).kind)).map(o => o.x)) / 30, endB = Math.max(...built.objects.filter(o => PLAY.has(GD.objInfo(o.id).kind)).map(o => o.x)) / 30;
  if (!gone.length && !added.length) { if (verbose) console.log(`${spec.name}: same gameplay`); continue; }
  changed++;
  const name = k => GD.objInfo(+k.split(",")[0]).name, firstX = [...gone, ...added].map(k => +k.split(",")[1] / 30).sort((x, y) => x - y)[0];
  const kinds = arr => { const m = {}; for (const k of arr) m[name(k)] = (m[name(k)] || 0) + 1; return Object.entries(m).map(([k, n]) => `${n} ${k}`).join(", "); };
  console.log(`${spec.name} (${f}): gameplay WOULD CHANGE from block ${firstX.toFixed(0)} -- ${gone.length} gone (${kinds(gone)}), ${added.length} new (${kinds(added)}); last gameplay block ${endA.toFixed(0)} -> ${endB.toFixed(0)}`);
}
console.log(`\n${checked} levels checked, ${changed} would change when rebuilt from their spec`);
process.exit(changed ? 1 : 0);
