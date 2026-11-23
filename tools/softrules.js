// node tools/softrules.js [level.gdlvl ...] [--all] [--json]
//   -- the user's notes as soft rules (CLAUDE.md: every note is a rule with a scored check, swept over
//      every level). Light: no solve. Default: every levels/*.gdlvl. Prints per level what each rule
//      finds, with a WARN / PASS per rule and the count over all levels.
//
// Rules (each with the note it came from; TASTE.md, knowledge/checklist.md):
//   arrows   a jump indicator (d_arrow 132/460/494/3630-3632 in the indicator group 990) over a hazard
//            (FAIL) or within a block of a hazard's hitbox at its height (WARN). The user on GDLM 50 v2:
//            "arrow into the spike"; "too close to the spike, almost inside it". tools/decorate.js
//            places them a block in front now (INDICATOR.clear).
//   stubs    a corridor's roof or floor that steps one row into the corridor for a single column next to
//            a slope (a hanging notch where the line should join the slope flush), or a one-block hanger
//            at a corridor's mouth. The user on GDLM 50 v2's wave entrance: "this entrance is wrong in
//            its shape". tools/patterns.js wave-zigzag joins its roof flush and stretches its exit portal.
//   flash    pulse triggers (1006) per minute, how many pulse towards near-white, and sky (1000) flashes.
//            The user on a modern-look level: "waaaay too flashy ... hard to tell what kills you".
//            WARN over 120 pulses/min, over 10 white pulses, or more than 1 sky flash (the signature's
//            own flashes not counted). Calm reference:
//            GDLM 50 v2 (bars only, tints, one dim flash).
// A level may break a rule on purpose: say why in its spec's "notes".
"use strict";
const fs = require("fs"), path = require("path");
const { GD, readGdlvl } = require("./io.js");

const ARROW = new Set([132, 460, 494, 3630, 3631, 3632]);
const CLEAR = 30;   // units: an arrow's centre to any hazard hitbox (tools/decorate.js INDICATOR.clear)

function arrows(level, w) {
  const hz = w.items.filter(b => b.kind === "hazard"), over = [], near = [];
  const marks = level.objects.filter(o => ARROW.has(o.id) && o.props && o.props[57] === "990");
  for (const o of marks) {
    const down = ((o.rot || 0) % 360 + 360) % 360 !== 270;
    const atH = b => down ? b.y1 >= o.y - 60 && b.y0 <= o.y : b.y0 <= o.y + 60 && b.y1 >= o.y;
    if (hz.some(b => atH(b) && b.x0 - 8 <= o.x && b.x1 + 8 >= o.x)) over.push(o);
    else if (hz.some(b => atH(b) && b.x0 - CLEAR < o.x && b.x1 + CLEAR > o.x)) near.push(o);
  }
  const at = o => ((o.x - 15) / 30).toFixed(1);
  return { n: marks.length, bad: over.length + near.length, status: over.length ? "FAIL" : near.length ? "WARN" : "PASS",
    text: `${marks.length} arrows` + (over.length ? `; over a hazard at ${over.map(at).join(", ")}` : "") + (near.length ? `; within a block of a hazard at ${near.map(at).join(", ")}` : "") };
}

// the solid grid (blocks and slopes, from the physics' own boxes): cell -> "#" or "/"
function grid(w) {
  const g = new Map();
  for (const b of w.items) {
    if (b.kind !== "solid" && b.kind !== "slope") continue;
    for (let c = Math.floor(b.x0 / 30 + 0.01); c < Math.ceil(b.x1 / 30 - 0.01); c++)
      for (let r = Math.floor(b.y0 / 30 + 0.01); r < Math.ceil(b.y1 / 30 - 0.01); r++) if (r >= 0 && r < 14) g.set(c + "," + r, b.kind === "slope" ? "/" : g.get(c + "," + r) || "#");
  }
  return g;
}
function stubs(level, w) {
  const g = grid(w), cols = [...g.keys()].map(k => +k.split(",")[0]);
  if (!cols.length) return { bad: 0, status: "PASS", text: "no solids" };
  const c0 = Math.min(...cols), c1 = Math.max(...cols), found = [];
  // per column: the roof (lowest solid cell with a free cell under it, above row 1) and the floor (top of the solid run from the ground)
  const roof = c => { for (let r = 1; r < 13; r++) if (g.has(c + "," + r) && !g.has(c + "," + (r - 1))) { let top = r; while (g.has(c + "," + (top + 1))) top++; if (top >= 8) return r; } return null; };
  const slopeNear = c => [c - 1, c, c + 1].some(cc => [...Array(13).keys()].some(r => g.get(cc + "," + r) === "/"));
  for (let c = c0 + 1; c < c1; c++) {
    const a = roof(c - 1), b = roof(c), d = roof(c + 1);
    if (a == null || b == null || d == null) continue;
    // a single column dipping a row into the corridor next to a slope: a hanging notch
    if (b === a - 1 && b < d && slopeNear(c)) found.push(`roof notch at block ${c}`);
    // a one-block hanger: a roof cell one row below a flat roof on both sides
    else if (b === a - 1 && b === d - 1 && !slopeNear(c)) found.push(`hanger at block ${c}`);
  }
  return { bad: found.length, status: found.length ? "WARN" : "PASS", text: found.length ? found.join("; ") : "roofs join their slopes flush" };
}
function flash(level) {
  // the end signature's own beat flashes (its channels 988-999, tools/signature.js) are not counted
  const ps = level.objects.filter(o => o.id === 1006 && !(+o.props[51] >= 988 && +o.props[51] <= 999 && o.props[52] !== "1"));
  const lastX = Math.max(...level.objects.map(o => o.x)), mins = Math.max(0.25, lastX / 311.58 / 60);
  const white = ps.filter(o => +o.props[7] >= 230 && +o.props[8] >= 230 && +o.props[9] >= 230).length;
  const sky = ps.filter(o => o.props[51] === "1000" && o.props[52] !== "1").length;
  const perMin = ps.length / mins;
  const warn = perMin > 120 || white > 10 || sky > 1;
  return { bad: warn ? 1 : 0, status: warn ? "WARN" : "PASS", text: `${Math.round(perMin)} pulses/min, ${white} to white, ${sky} sky flashes` };
}

function check(file) {
  const L = readGdlvl(file).level, w = GD.makeWorld(L.objects, L.header);
  return { file: path.relative(process.cwd(), file), arrows: arrows(L, w), stubs: stubs(L, w), flash: flash(L) };
}
module.exports = { check, arrows, stubs, flash };

if (require.main === module) {
  let files = process.argv.slice(2).filter(a => !a.startsWith("--"));
  if (!files.length) files = fs.readdirSync(path.join(__dirname, "..", "levels")).filter(f => f.endsWith(".gdlvl")).map(f => path.join(__dirname, "..", "levels", f));
  const res = files.map(check), tot = { arrows: 0, stubs: 0, flash: 0 };
  for (const r of res) {
    console.log(`== ${r.file}`);
    for (const k of ["arrows", "stubs", "flash"]) { console.log(`   ${r[k].status.padEnd(4)} ${k.padEnd(7)} ${r[k].text}`); tot[k] += r[k].bad; }
  }
  console.log(`\nfound over ${res.length} levels: arrows ${tot.arrows}, stubs ${tot.stubs}, flash ${tot.flash} level(s)`);
  if (process.argv.includes("--json")) fs.writeFileSync(path.join(__dirname, "..", "local", "softrules.json"), JSON.stringify(res, null, 1));
}
