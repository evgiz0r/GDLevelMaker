// node tools/orbfit.js <section key> [--gap 3.5] [--clear 1] [--write]  -- re-place a theme-layout section's orbs so the
//   route has to take EVERY one (Evgeni 2026-11-27 on "orb gameplay": "we need the path to hit every orb, so adjust the
//   distances so it has to hit every orb at some way, the orbs more distanced, from themselves and the platform").
//   Keeps his blocks, spikes and portals and his orbs' kinds in his order (left to right); then, orb by orb, plays the
//   chain so far in the sim (the section alone, as tools/layoutcheck.js builds it) and puts the next orb on the player's
//   own path at least --gap columns after the last press, in a free cell --clear cells away from any block, spike or
//   other orb, where a press there keeps the player alive for a while. --write saves the map to
//   knowledge/layout_sections.json (then run tools/layoutcheck.js <key>). Prints the map and the presses.
const fs = require("fs"), path = require("path");
const { GD } = require("./io.js");
const LC = require("./layoutcheck.js"), { build } = require("./make.js");
const a = process.argv.slice(2), arg = (k, d) => { const i = a.indexOf("--" + k); return i >= 0 ? a[i + 1] : d; };
const key = a[0], GAP = +arg("gap", 3.5), CLEAR = +arg("clear", 1);
const F = path.join(__dirname, "..", "knowledge", "layout_sections.json"), J = JSON.parse(fs.readFileSync(F, "utf8"));
const map0 = J[key]; if (!map0) { console.log("no section " + key); process.exit(1); }
const H = map0.length, W = map0[0].length, ORB = "YBE", ROW = +arg("row", Math.floor(H / 2) - 1);
const kinds = []; for (let c = 0; c < W; c++) for (let i = 0; i < H; i++) if (ORB.includes(map0[i][c])) kinds.push(map0[i][c]);
let g = map0.map(l => [...l].map(ch => ORB.includes(ch) ? "." : ch));
const mapOf = () => g.map(l => l.join(""));
const free = (c, r) => { for (let dc = -CLEAR; dc <= CLEAR; dc++) for (let dr = -CLEAR; dr <= CLEAR; dr++) { const cc = c + dc, rr = r + dr;
  if (cc < 0 || cc >= W || rr < 0 || rr >= H) continue; if (g[H - 1 - rr][cc] !== ".") return false; } return c >= 0 && c < W && r >= 1 && r < H; };
function play(events) { const z = { key, name: key, mode: "cube", map: mapOf() }, S = LC.specOf(z), lv = build(S.spec, "orbfit:" + key, {}).level;
  const w = GD.makeWorld(lv.objects, lv.header); return { S, r: GD.run(w, events) }; }
const TPS = GD.PHYS.TPS, ev = [];
let last = null;
for (const k of kinds) {
  const { S, r } = play(ev), p = r.path, gapT = Math.round(GAP / 10.4 * TPS);
  // candidates on the player's path in the window after the gap; tried best first: near the section's middle height
  // (--row, default H/2 - 1: the chain neither climbs out of the section nor sinks to the floor) and falling (an orb
  // taken on the way down reads as a catch); the first whose press keeps the player alive wins
  const t0 = last === null ? p.findIndex(s => s.x / 30 - S.x0 >= 2) : last + gapT, cands = [];
  for (let t = t0; t < Math.min(p.length, t0 + Math.round(1.2 * TPS)); t += 4) {
    const c = Math.floor(p[t].x / 30 - S.x0), rr = Math.floor(p[t].y / 30); if (c >= W - 2 || c < 0) break;
    if (!free(c, rr)) continue; const vy = p[t].vy || 0, grav = p[t].grav || 1;
    cands.push({ t, c, rr, score: Math.abs(rr - ROW) + (vy * grav < 0 ? 0 : 1.5) + (t - t0) / TPS }); }
  cands.sort((x, y) => x.score - y.score);
  let done = false;
  for (const q0 of cands.slice(0, 12)) { const { t, c, rr } = q0;
    g[H - 1 - rr][c] = k; const e2 = ev.concat([{ tick: t, type: "press" }, { tick: t + 3, type: "release" }]);
    const q = play(e2).r, alive = q.path.length > t + Math.round(0.5 * TPS) || q.ok;
    if (alive) { ev.push(...e2.slice(-2)); last = t; done = true; console.log(`${k} at col ${c}, row ${rr}  (tick ${t})`); break; }
    g[H - 1 - rr][c] = "."; }
  if (!done) console.log(`${k}: no place found`);
}
const end = play(ev).r; console.log((end.ok ? "the chain clears" : "the chain dies at col " + (end.path[end.path.length - 1].x / 30).toFixed(1)) + `, ${ev.length / 2} presses for ${kinds.length} orbs`);
console.log(mapOf().join("\n"));
if (a.includes("--write")) { J[key] = mapOf(); fs.writeFileSync(F, JSON.stringify(J, null, 1) + "\n"); console.log("-> knowledge/layout_sections.json"); }
