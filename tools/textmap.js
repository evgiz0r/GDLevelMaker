// node tools/textmap.js <level.gdlvl | official:N> [--from COL] [--to COL] [--rows 12] [--row0 R] [--no-path]
// official:N reads level N from the GD install and draws the cached solve (local/difficulty/NN.json, also
// an unbeaten run's trail, ending in X where it dies).
// The level as text, one character per grid square, with the player's path from the saved / natural
// solution, so a session can reason about a stretch without opening the viewer:
//   # block   = slab / thin   / \ slope   ^ spike   v hanging spike   o orb   _ pad   P portal
//   T teleport   . the player's path   * a press   ' a release   (decoration is not drawn)
// Rows are printed top (row --rows-1) to bottom (row 0, the ground row); the column ruler is every 5.
const fs = require("fs");
const { GD, readGdlvl } = require("./io.js");
Object.assign(GD, require("../lib/natural.js"));
const a = process.argv.slice(2), file = a.find(x => x.endsWith(".gdlvl") || x.startsWith("official:"));
const opt = (k, d) => { const i = a.indexOf("--" + k); return i < 0 ? d : +a[i + 1]; };
if (!file) { console.log(fs.readFileSync(__filename, "utf8").split("\n").slice(0, 6).join("\n")); process.exit(1); }
let L, cached = null;
if (file.startsWith("official:")) {
  const n = +file.slice(9), path = require("path"), { unpack } = require("./io.js");
  const src = path.join(process.env.GD_LEVELS || "C:/Program Files (x86)/Steam/steamapps/common/Geometry Dash/Resources/levels/", n + ".txt");
  L = { name: "official " + n, level: GD.parseLevel(unpack(fs.readFileSync(src, "utf8"))) };
  try { cached = require(path.join(__dirname, "..", "local", "difficulty", String(n).padStart(2, "0") + ".json")); } catch (e) {}
} else L = readGdlvl(file);
const w = GD.makeWorld(L.level.objects, L.level.header);
const ROWS = opt("rows", 12), R0 = opt("row0", 0), C0 = opt("from", 0), C1 = opt("to", Math.ceil(w.endX / 30) + 1);
const grid = []; for (let r = 0; r < ROWS; r++) grid.push(new Array(C1 - C0 + 1).fill(" "));
const put = (c, r, ch, over) => { r -= R0; if (c < C0 || c > C1 || r < 0 || r >= ROWS) return; const g = grid[r]; if (over || g[c - C0] === " " || g[c - C0] === ".") g[c - C0] = ch; };
for (const o of L.level.objects) {
  const d = GD.objInfo(o.id), c = Math.round((o.x - 15) / 30), r = Math.round((o.y - 15) / 30);
  const ch = { solid: d.hit && d.hit.h < 20 ? "=" : "#", slope: (o.flipX ? 1 : 0) ^ (o.flipY ? 1 : 0) ? "\\" : "/", hazard: (o.flipY || Math.abs((o.rot || 0) % 360) === 180) ? "v" : "^",
    orb: "o", pad: "_", mode: "P", gravity: "P", speed: "P", size: "P", teleport: "T" }[d.kind];
  if (ch) put(c, r, ch, true);
}
if (!a.includes("--no-path")) {
  let sol = null;
  if (!cached) try { sol = require("./solutions.js").get(L.levelStr, true); } catch (e) {}
  let ev = cached ? cached.events : sol && sol.ok ? sol.events : null;
  if (!ev) { const r = GD.solveAny(w); if (r.ok) { ev = r.events; try { const n = GD.naturalPlan(w, r, L.level.objects); if (n) ev = n.events; } catch (e) {} } }
  if (ev) {
    const path = GD.run(w, ev).path, at = new Map(ev.map(e => [e.tick, e.type]));
    for (let t = 0; t < path.length; t++) {
      const p = path[t], c = Math.round((p.x - 15) / 30), r = Math.round((p.y - 15) / 30), e = at.get(t);
      put(c, r, e === "press" ? "*" : e === "release" ? "'" : ".", !!e);
    }
    const q = GD.run(w, ev); if (q.dead || (q.end && q.end.dead)) { const e = q.end || path[path.length - 1]; put(Math.round((e.x - 15) / 30), Math.round((e.y - 15) / 30), "X", true); }
  } else console.log("(no solution: no path drawn)");
}
const ruler = Array.from({ length: C1 - C0 + 1 }, (_, i) => (C0 + i) % 5 ? " " : String(Math.floor((C0 + i) / 5) % 10)).join("");
console.log(`${L.name}, columns ${C0}-${C1} (ruler digit = column / 5 mod 10, at every 5th column)`);
for (let r = ROWS - 1; r >= 0; r--) console.log(String(r + R0).padStart(2) + " |" + grid[r].join(""));
console.log("   " + ruler);
