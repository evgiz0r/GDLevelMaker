// node tools/claude_icons.js sheet [--out f.png] | text <mode> | png [--dir viewer/icons/claude]
// The solver's icon set (lib/claude_icons.js; ART.md "Claude icons").
//   sheet  preview of all 8 icons: at GD icon size (2 px a pixel, ~32 px a cube, as the viewer draws a block of
//          ~32 px) and 4x, with the glow, on a dark and a GD-blue background -> local/props/claude_icons.png
//   text   one icon as text pixels
//   png    one PNG per mode (8 px a pixel, glow included) for the viewer
"use strict";
const fs = require("fs"), path = require("path"), cp = require("child_process");
const ROOT = path.join(__dirname, ".."), CI = require("../lib/claude_icons.js");
const args = process.argv.slice(2), opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };

function sheet(out) {
  out = out || path.join(ROOT, "local", "props", "claude_icons.png");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const job = { palette: CI.PALETTE, glow: CI.GLOW, icons: CI.MODES.map(m => { const g = CI.grid(m); return { mode: m, w: g.w, h: g.h, c: g.c }; }) };
  const jf = out.replace(/\.png$/, "_job.json"); fs.writeFileSync(jf, JSON.stringify(job));
  cp.execFileSync("python", [path.join(__dirname, "claude_icons_sheet.py"), jf, out], { stdio: "inherit" });
  return out;
}
function pngs(dir) {
  const { writePng } = require("./png.js"); dir = dir || path.join(ROOT, "viewer", "icons", "claude"); fs.mkdirSync(dir, { recursive: true });
  for (const m of CI.MODES) { const r = CI.rgba(m, 8, { glow: true }); writePng(path.join(dir, m + ".png"), r.w, r.h, r.rgba); }
  return dir;
}
if (require.main === module) {
  if (args[0] === "sheet") console.log(sheet(opt("--out")));
  else if (args[0] === "text") console.log(CI.grid(args[1]).text());
  else if (args[0] === "png") console.log(pngs(opt("--dir")));
  else console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n"));
}
module.exports = { sheet, pngs };
