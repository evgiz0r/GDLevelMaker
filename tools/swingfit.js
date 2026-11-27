// node tools/swingfit.js <section key> [--clicks "0.3 0.9,1.1 1.8 ..."] [--margin 2] [--write]  -- a swing section built
//   AROUND a click pattern (Evgeni 2026-11-27 on the board's swing: "shouldnt be that jitter click, i suggest building the
//   structure around the pattern after doing some clicks. can be double triple clicks here and there not too fast").
//   The clicks come first (seconds from the section's start; a group "a,b,c" = a double / triple click), the sim flies
//   them in the open, then a wall of saws (the board's o / q chain, his look) runs --margin rows above and below the
//   path, column by column, inside the swing's band (10 rows). The section keeps its width and height. Prints the map,
//   the presses and the tightest gap; --write saves it to knowledge/layout_sections.json (then tools/layoutcheck.js).
const fs = require("fs"), path = require("path");
const { GD } = require("./io.js");
const LC = require("./layoutcheck.js"), { build } = require("./make.js");
const a = process.argv.slice(2), arg = (k, d) => { const i = a.indexOf("--" + k); return i >= 0 ? a[i + 1] : d; };
const key = a[0], M = +arg("margin", 2), BAND = 10;
const F = path.join(__dirname, "..", "knowledge", "layout_sections.json"), J = JSON.parse(fs.readFileSync(F, "utf8"));
const old = J[key], H = +arg("rows", old.length), W = old[0].length;
const clicks = arg("clicks", "0.35 1.0,1.18 1.9 2.55,2.72,2.89 3.7 4.3,4.48 5.1").split(/\s+/).flatMap(g => g.split(",").map(Number));
// a block in the top row's last column, above the band: the level's end needs an object there (an empty map ends at once)
const flat = () => { const g = Array.from({ length: H }, () => Array(W).fill(".")); g[0][W - 1] = "#"; return g; };
function fly(g) { const z = { key, name: key, mode: "swing", map: g.map(l => l.join("")) }, S = LC.specOf(z), lv = build(S.spec, "swingfit:" + key, {}).level;
  const w = GD.makeWorld(lv.objects, lv.header), p0 = GD.run(w, []).path, t0 = p0.findIndex(s => s.x / 30 - S.x0 >= 0), TPS = GD.PHYS.TPS;
  const ev = []; for (const c of clicks) { const t = t0 + Math.round(c * TPS); ev.push({ tick: t, type: "press" }, { tick: t + 6, type: "release" }); }
  return { S, w, ev, r: GD.run(w, ev) }; }
// 1. the clicks in the open; with --every N a hidden swing portal (W) every N columns at the player's height moves the
// band with it (Evgeni 2026-11-27: "people put invisible ones to move further in the screens"), so the swing can go
// higher than one band: placed from the path, flown again, three rounds
const EVERY = +arg("every", 0), base = flat();
let open = fly(base);
if (EVERY) for (let k = 0; k < 3; k++) {
  for (const l of base) for (let c = 0; c < W; c++) if (l[c] === "W") l[c] = ".";
  const q = open.r.path, S0 = open.S;
  for (let c = EVERY; c < W - 2; c += EVERY) { const s0 = q.find(s => s.x / 30 - S0.x0 >= c); if (!s0) break; const r = Math.max(1, Math.min(H - 2, Math.floor(s0.y / 30))); base[H - 1 - r][c] = "W"; }
  open = fly(base); }
const p = open.r.path, S = open.S;
if (a.includes("--debug")) { console.log("open run:", open.r.ok, open.r.why, (p[p.length - 1].x / 30 - S.x0).toFixed(1), (p[p.length - 1].y / 30).toFixed(1), p[p.length-1].mode); for (let t = 0; t < p.length; t += 40) console.log(t, (p[t].x / 30 - S.x0).toFixed(1), (p[t].y / 30).toFixed(2), p[t].mode); }
const lo = Array(W).fill(Infinity), hi = Array(W).fill(-Infinity);
for (const s of p) { const c = Math.floor(s.x / 30 - S.x0); if (c < 0 || c >= W) continue; lo[c] = Math.min(lo[c], s.y / 30); hi[c] = Math.max(hi[c], s.y / 30); }
// 2. the walls: saws M rows under the lowest and over the highest point of each column (and its neighbours, so a wall
// never cuts a corner), the board's chain look: o and q alternating
const g = base.map(l => l.slice()), BANDTOP = EVERY ? H : BAND, put = (c, r, ch) => { if (c >= 0 && c < W && r >= 0 && r < H) g[H - 1 - r][c] = ch; };
for (let c = 0; c < W; c++) { const L = Math.min(lo[Math.max(0, c - 1)], lo[c], lo[Math.min(W - 1, c + 1)]), U = Math.max(hi[Math.max(0, c - 1)], hi[c], hi[Math.min(W - 1, c + 1)]);
  if (!isFinite(L)) continue; const ch = arg("saw", "q") === "chain" ? (c % 2 ? "q" : "o") : arg("saw", "q");
  // near the band's roof the top line moves in to the band's last row (when that still leaves the path a row): the
  // corridor stays closed instead of opening onto the roof (the solver rode the roof past a missing line)
  const rb = Math.floor(L) - M, rt0 = Math.ceil(U) + M - 1, rt = rt0 < BANDTOP - 1 ? rt0 : (BANDTOP - 1 > U + +arg("roof", 1.2) ? BANDTOP - 1 : rt0);
  // the saw line at the corridor's edge, solid beyond it to the band's edge: no way round outside the corridor (a first
  // try with saw lines only let the solver fly over the top line, 20 jittery presses)
  if (rb >= 1) { put(c, rb, ch); for (let r = 0; r < rb; r++) if (g[H - 1 - r][c] !== "W") put(c, r, "#"); }
  if (rt <= BANDTOP - 1) { put(c, rt, ch); for (let r = rt + 1; r < BANDTOP; r++) if (g[H - 1 - r][c] !== "W") put(c, r, "#"); } }
// 3. check: the planned clicks still clear with the walls in
const chk = fly(g.map(l => l.slice())), ok = chk.r.ok || chk.r.path.length > chk.ev[chk.ev.length - 1].tick + 300;
console.log(`clicks: ${clicks.join(" ")} s (${clicks.length} presses)`);
console.log(`path rows ${Math.min(...lo.filter(isFinite)).toFixed(1)} .. ${Math.max(...hi.filter(isFinite)).toFixed(1)} (band 0 .. ${BAND})`);
console.log(ok ? "the planned clicks clear with the walls" : "the planned clicks DIE at col " + (chk.r.path[chk.r.path.length - 1].x / 30 - S.x0).toFixed(1));
console.log(g.map(l => l.join("")).join("\n"));
if (a.includes("--write") && ok) { J[key] = g.map(l => l.join("")); fs.writeFileSync(F, JSON.stringify(J, null, 1) + "\n"); console.log("-> knowledge/layout_sections.json"); }
