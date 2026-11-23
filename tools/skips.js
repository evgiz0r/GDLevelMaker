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
  const w = GD.makeWorld(objects, header), run = GD.run(w, events), P = run.path;
  const reach = run.end.x;
  const moved = new Set();
  for (const o of objects) if (o.id === 901 && o.props && o.props[51]) moved.add(String(o.props[51]));
  const movesOf = o => o.props && o.props[57] && String(o.props[57]).split(".").some(g => moved.has(g));
  const touched = o => {
    const hb = GD.hitbox(o); if (!hb) return true;
    for (let t = 0; t < P.length; t++) { const p = P[t]; if (p.x + 15 >= hb.x0 && p.x - 15 <= hb.x1 && p.y + 15 >= hb.y0 && p.y - 15 <= hb.y1) return true; }
    return false;
  };
  const inReach = o => o.x < reach - 15;
  const kind = o => (GD.objInfo(o.id) || {}).kind;
  const portals = objects.filter(o => PORTAL.includes(kind(o)) && inReach(o)), orbs = objects.filter(o => /^(orb|pad)$/.test(kind(o)) && inReach(o));
  // what the route is at a portal's x: a portal that would change nothing there (a ship portal while
  // flying a ship, normal gravity while upright...) is a no-op, not a skip (a same-mode portal in a
  // flying mode moves the band in GD: noted, not counted); a portal in the same column as one the route
  // takes is another lane (Deadlocked's stacked teleports), not a skip
  const at = x => { let best = P[0]; for (const p of P) { if (p.x > x) break; best = p; } return best; };
  const noop = o => { const i = GD.objInfo(o.id), s = at(o.x);
    return i.kind === "mode" ? i.mode === s.mode : i.kind === "gravity" ? i.grav === s.grav : i.kind === "speed" ? i.speed === s.sp : i.kind === "size" ? !!i.mini === !!s.mini : false; };
  const desc = o => ({ id: o.id, name: GD.objInfo(o.id).name, block: +((o.x - 15) / 30).toFixed(1), y: Math.round(o.y), moves: movesOf(o), noop: noop(o) });
  return { reach, complete: !!run.done, portals: portals.length, orbs: orbs.length,
    missedPortals: (() => { const tk = portals.filter(touched); return portals.filter(o => !touched(o)).map(desc).map(d => Object.assign(d, { lane: tk.some(t => Math.abs(t.x - (d.block * 30 + 15)) < 10) })); })(),
    missedOrbs: orbs.filter(o => !touched(o)).map(desc) };
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
    const mp = r.missedPortals.filter(o => !o.moves && !o.noop && !o.lane), mm = r.missedPortals.filter(o => o.moves), nn = r.missedPortals.filter(o => !o.moves && (o.noop || o.lane));
    console.log(`${(r.n ? String(r.n).padStart(2) + " " : "") + r.name}: ${mp.length ? "SKIPS " + mp.length + " of " + r.portals + " portals" : "takes all " + r.portals + " portals"}` +
      (mm.length ? ` (+${mm.length} moved by triggers, unsure)` : "") + (nn.length ? ` (${nn.length} passed that change nothing or are another lane)` : "") + `, ${r.missedOrbs.length} of ${r.orbs} orbs/pads untouched${r.complete ? "" : ", route ends at block " + (r.reach / 30).toFixed(0)}`);
    for (const o of mp) console.log(`     portal ${o.name} (${o.id}) at block ${o.block}, y ${o.y}`);
  }
  if (process.argv.includes("--json")) console.log(JSON.stringify(out));
}
if (require.main === module) main();
const realSkips = r => (r.missedPortals || []).filter(o => !o.moves && !o.noop && !o.lane);
module.exports = { skipsOf, official, file, realSkips };
