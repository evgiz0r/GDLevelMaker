// node tools/claude_icons.js kits [--out f.png] | sheet [--kit k] [--out f.png] | text <mode> [kit] | png [--kit k] [--dir viewer/icons/claude]
// The solver's icon set (lib/claude_icons.js; ART.md "Claude icons").
//   sheet  preview of all 8 icons: at GD icon size (2 px a pixel, ~32 px a cube, as the viewer draws a block of
//          ~32 px) and 4x, with the glow, on a dark and a GD-blue background -> local/props/claude_icons.png
//   kits   every kit concept, one row per kit, 8 modes each (icon size + 3x) -> local/props/claude_kits.png
//   text   one icon as text pixels
//   png    one PNG per mode (8 px a pixel, glow included) for the viewer
"use strict";
const fs = require("fs"), path = require("path"), cp = require("child_process");
const ROOT = path.join(__dirname, ".."), CI = require("../lib/claude_icons.js");
const args = process.argv.slice(2), opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };

function kits(out) {
  out = out || path.join(ROOT, "local", "props", "claude_kits.png");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const job = { kits: CI.KITS.map(k => ({ kit: k, title: CI.KIT_DEFS[k].title, palette: CI.palette(k), glow: CI.glow(k),
    icons: CI.MODES.map(m => { const g = CI.grid(m, k); return { mode: m, w: g.w, h: g.h, c: g.c }; }) })) };
  const jf = out.replace(/\.png$/, "_job.json"); fs.writeFileSync(jf, JSON.stringify(job));
  cp.execFileSync("python", [path.join(__dirname, "claude_kits_sheet.py"), jf, out], { stdio: "inherit" });
  return out;
}
function sheet(out, kit) {
  out = out || path.join(ROOT, "local", "props", "claude_icons.png");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const job = { palette: CI.palette(kit), glow: CI.glow(kit), icons: CI.MODES.map(m => { const g = CI.grid(m, kit); return { mode: m, w: g.w, h: g.h, c: g.c }; }) };
  const jf = out.replace(/\.png$/, "_job.json"); fs.writeFileSync(jf, JSON.stringify(job));
  cp.execFileSync("python", [path.join(__dirname, "claude_icons_sheet.py"), jf, out], { stdio: "inherit" });
  return out;
}
function pngs(dir, kit) {
  const { writePng } = require("./png.js"); dir = dir || path.join(ROOT, "viewer", "icons", "claude"); fs.mkdirSync(dir, { recursive: true });
  for (const m of CI.MODES) { const r = CI.rgba(m, 8, { glow: true, kit }); writePng(path.join(dir, m + ".png"), r.w, r.h, r.rgba); }
  return dir;
}
if (require.main === module) {
  if (args[0] === "sheet") console.log(sheet(opt("--out"), opt("--kit")));
  else if (args[0] === "kits") console.log(kits(opt("--out")));
  else if (args[0] === "text") console.log(CI.grid(args[1], args[2]).text());
  else if (args[0] === "png") console.log(pngs(opt("--dir"), opt("--kit")));
  else console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n"));
}
module.exports = { sheet, kits, pngs };
