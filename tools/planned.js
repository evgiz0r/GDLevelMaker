// node tools/planned.js "<level name>"   -- the presses a level's build planned, in seconds from the level start.
// The human route presses on these times where the press clears (lib/natural.js opts.planned, via
// tools/solutions.js), instead of at the generic ~40% of each window (BUILDING.md section 2).
// Where they live (one place, agreed with gd-style and gd-sync62): the level's stages index,
//   local/wip/<session>/<slug>.stages/index.json, stage "layout" (else "path"): data.planned = [{t, what}, ...]
// (entries whose `what` says release are left out), or a level-side file <slug>.planned.json beside the level
// ({planned: [{t}...]} or [t, ...]). slug = the level name in lower case, non-letters/digits as "_"
// ("GDLM 62 low end lullaby" -> gdlm_62_low_end_lullaby). Returns [] when there is none.
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
// a build stage's level is named "<name> (<stage>)" and lives at .../<slug>.stages/<stage>.gdlvl: both point at the level's plan
const slugOf = name => String(name || "").replace(/\s*\([^)]*\)\s*$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
const stageSlug = file => { const m = String(file || "").split(path.sep).join("/").match(/([^/]+)\.stages\/[^/]+\.gdlvl$/); return m ? m[1] : null; };

function plannedFor(name, levelFile) {
  const slug = stageSlug(levelFile) || slugOf(name), times = list => (list || []).filter(e => typeof e === "number" || !/release/i.test(e.what || ""))
    .map(e => typeof e === "number" ? e : +e.t).filter(t => isFinite(t)).sort((a, b) => a - b);
  const side = levelFile ? levelFile.replace(/\.gdlvl$/, ".planned.json") : null;
  for (const f of [side, path.join(ROOT, "levels", slug + ".planned.json")].filter(Boolean))
    if (fs.existsSync(f)) try { const j = JSON.parse(fs.readFileSync(f, "utf8")); return times(Array.isArray(j) ? j : j.planned); } catch (e) {}
  const wip = path.join(ROOT, "local", "wip");
  if (!slug || !fs.existsSync(wip)) return [];
  for (const sess of fs.readdirSync(wip)) {
    const idx = path.join(wip, sess, slug + ".stages", "index.json");
    if (!fs.existsSync(idx)) continue;
    try {
      const j = JSON.parse(fs.readFileSync(idx, "utf8")), st = Array.isArray(j.stages) ? j.stages : Object.values(j.stages || {});
      const pick = ["layout", "path"].map(n => st.find(s => (s.name || s.stage || s.id) === n && s.data && s.data.planned)).find(Boolean);
      if (pick) return times(pick.data.planned);
    } catch (e) {}
  }
  return [];
}
// the plan as INPUTS: [{tick, type}] at 240 Hz -- every press, with the plan's own releases where it has them ("release"
// entries: a ship's schedule) and a 14-tick tap (0.06 s, tools/hitbuild.js's) after every other press. null when the
// level has no plan with releases or presses. tools/solutions.js uses it as the route when it clears the level as-is.
function plannedEvents(name, levelFile) {
  const slug = stageSlug(levelFile) || slugOf(name), TAP = Math.round(0.06 * 240);
  let raw = null;
  const side = levelFile ? levelFile.replace(/\.gdlvl$/, ".planned.json") : null;
  for (const f of [side, path.join(ROOT, "levels", slug + ".planned.json")].filter(Boolean))
    if (!raw && fs.existsSync(f)) try { const j = JSON.parse(fs.readFileSync(f, "utf8")); raw = Array.isArray(j) ? j : j.planned; } catch (e) {}
  if (!raw || !raw.length) return null;
  const items = raw.map(e => typeof e === "number" ? { t: e, what: "press" } : e).filter(e => isFinite(+e.t))
    .map(e => ({ tick: Math.round(+e.t * 240), rel: /release/i.test(e.what || "") })).sort((p, q) => p.tick - q.tick);
  const ev = [];
  for (let i = 0; i < items.length; i++) {
    const e = items[i]; if (e.rel) { ev.push({ tick: e.tick, type: "release" }); continue; }
    ev.push({ tick: e.tick, type: "press" });
    const next = items[i + 1];
    if (!(next && next.rel)) ev.push({ tick: Math.min(e.tick + TAP, next ? next.tick - 1 : e.tick + TAP), type: "release" });
  }
  return ev.sort((p, q) => p.tick - q.tick || (p.type === "release" ? -1 : 1));
}
module.exports = { plannedFor, plannedEvents, slugOf };
if (require.main === module) {
  const name = process.argv[2];
  if (!name) { console.log(fs.readFileSync(__filename, "utf8").split("\n").slice(0, 3).join("\n")); process.exit(1); }
  const p = plannedFor(name); console.log(`${p.length} planned presses for "${name}"` + (p.length ? `: ${p.slice(0, 12).map(t => t.toFixed(3)).join(", ")}${p.length > 12 ? " ..." : ""}` : ""));
}
