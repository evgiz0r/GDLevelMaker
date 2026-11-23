// node tools/skips.js [n ... | file.gdlvl ...] [--json]
//
// Does a saved route skip anything? The user, 2026-11-23: "we need to stop accepting those secret ways by
// the solvers. especially in official levels. if the solver skips something, its 99% wrong." Replays the
// route (official n: local/official_NN.json, the one tools/difficulty.js scores; a .gdlvl: its saved
// solution, tools/solutions.js) and lists, within the part the route covers, every portal (mode, gravity,
// speed, size, teleport) its box never touches -- a skip: the route and every number from it are not
// trusted (on an official level it means a physics bug) -- and every orb / pad never touched (a WARN: some
// orbs are optional). Same touch test as tools/score.js's "skips" gate. Static positions: an object a move
// trigger carries is checked where the editor has it (noted as "moves").
// No arguments: every official level with a saved route. Used by tools/difficulty.js (a skipping route
// gets no number) and DIFFICULTY.md's official table.
const fs = require("fs"), path = require("path");
const { GD, readGdlvl } = require("./io.js");
const ROOT = path.join(__dirname, "..");
const PORTAL = ["mode", "gravity", "speed", "size", "teleport"];

function skipsOf(objects, header, events) {
  const w = GD.makeWorld(objects, header), run = GD.run(w, events), P = run.path, end = run.end;
  // every object the run fired: the union over the whole run (a state's used list is trimmed to the last 80 units)
  const reach = end.x, used = new Set(); for (const p of P) for (const i of p.used || []) used.add(i);
  const moved = new Set();
  for (const o of objects) if (o.id === 901 && o.props && o.props[51]) moved.add(String(o.props[51]));
  const movesOf = o => o.props && o.props[57] && String(o.props[57]).split(".").some(g => moved.has(g));
  // taken = the sim fired it (its index is in the run's used list, as GD.skipCheck in lib/physics.js) -- not a
  // box overlap: Electrodynamix's mini ship clipped a cube portal's corner by 6 units and stayed a ship
  const items = kinds => w.items.filter(b => kinds.includes(b.kind) && b.x1 + 15 < reach);
  const portals = items(PORTAL), orbs = items(["orb", "pad"]);
  const at = x => { let best = P[0]; for (const p of P) { if (p.x > x) break; best = p; } return best; };
  // a no-op: the route there already has what the portal sets (same mode / gravity / speed / size), shown by
  // the run's own state at the portal; a twin: a portal with the same effect within 30 units that fired
  const eff = b => b.kind + ":" + (b.d.mode || "") + ":" + (b.d.grav != null ? b.d.grav : "") + ":" + (b.d.speed != null ? b.d.speed : "") + ":" + (b.d.mini != null ? b.d.mini : "");
  const cx = b => (b.x0 + b.x1) / 2;
  const noop = b => { const d = b.d, s = at(cx(b));
    return b.kind === "mode" ? d.mode === s.mode : b.kind === "gravity" ? d.grav === s.grav : b.kind === "speed" ? d.speed === s.sp : b.kind === "size" ? !!d.mini === !!s.mini : false; };
  // within reach: the route came within 60 units of it (physics' rule, lib/physics.js 14449b0: a portal far
  // off the play is decoration, not a requirement -- ClockWood's ball portal at y 675)
  const REACH = 60, near = b => P.some(p => p.x + 15 > b.x0 - REACH && p.x - 15 < b.x1 + REACH && p.y + 15 > b.y0 - REACH && p.y - 15 < b.y1 + REACH);
  const desc = b => ({ id: b.o.id, far: !near(b), name: b.d.name, block: +((b.o.x - 15) / 30).toFixed(1), y: Math.round(b.o.y), moves: !!movesOf(b.o), noop: noop(b),
    lane: portals.some(c => c !== b && used.has(c.i) && eff(c) === eff(b) && Math.abs(cx(c) - cx(b)) < 30) });
  return { reach, complete: !!run.done, portals: portals.length, orbs: orbs.length,
    missedPortals: portals.filter(b => !used.has(b.i)).map(desc), missedOrbs: orbs.filter(b => !used.has(b.i)).map(desc),
    shared: GD.skipCheck ? (GD.skipCheck(w, P, events) || {}).skipped || null : undefined };
}

function official(n) {
  const f = path.join(ROOT, "local", `official_${String(n).padStart(2, "0")}.json`);
  if (!fs.existsSync(f)) return null;
  const j = JSON.parse(fs.readFileSync(f, "utf8")), L = GD.parseLevel(j.level);
  return Object.assign({ name: j.name, n }, skipsOf(L.objects, L.header, (j.solution || {}).events || []));
}
function file(f) {
  const L = readGdlvl(f), s = require("./solutions.js").get(L.levelStr, true);
  if (!s || !s.events) return { name: L.name, none: true };
  return Object.assign({ name: L.name }, skipsOf(L.level.objects, L.level.header, s.events));
}

function main() {
  const args = process.argv.slice(2).filter(a => a !== "--json");
  const list = args.length ? args : Array.from({ length: 22 }, (_, i) => String(i + 1));
  const out = [];
  for (const a of list) {
    const r = /\.gdlvl$/.test(a) ? file(a) : official(+a);
    if (!r) continue;
    out.push(r);
    if (process.argv.includes("--json")) continue;
    if (r.none) { console.log(`${r.name}: no saved route`); continue; }
    const mp = r.missedPortals.filter(o => !o.moves && !o.noop && !o.lane && !o.far), mm = r.missedPortals.filter(o => o.moves), nn = r.missedPortals.filter(o => !o.moves && (o.noop || o.lane || o.far));
    console.log(`${(r.n ? String(r.n).padStart(2) + " " : "") + r.name}: ${mp.length ? "SKIPS " + mp.length + " of " + r.portals + " portals" : "takes all " + r.portals + " portals"}` +
      (mm.length ? ` (+${mm.length} moved by triggers, unsure)` : "") + (nn.length ? ` (${nn.length} passed that change nothing, are another lane or lie over 2 blocks off the route)` : "") + `, ${r.missedOrbs.length} of ${r.orbs} orbs/pads untouched${r.complete ? "" : ", route ends at block " + (r.reach / 30).toFixed(0)}`);
    for (const o of mp) console.log(`     portal ${o.name} (${o.id}) at block ${o.block}, y ${o.y}`);
  }
  if (process.argv.includes("--json")) console.log(JSON.stringify(out));
}
if (require.main === module) main();
const realSkips = r => (r.missedPortals || []).filter(o => !o.moves && !o.noop && !o.lane && !o.far);
module.exports = { skipsOf, official, file, realSkips };
