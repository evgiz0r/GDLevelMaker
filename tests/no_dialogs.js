// node tests/no_dialogs.js  -- no alert(), confirm() or prompt() in the viewer pages or what builds them (the phone
// and public pages): the app's built-in browser and the Artifact frame suppress native dialogs, so a button that
// called alert() simply did nothing for the user ("level map", 2026-11-24). Use notice(), askNote() and showMap().
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const files = fs.readdirSync(path.join(ROOT, "viewer")).filter(f => /\.(html|js)$/.test(f) && f !== "levels.js").map(f => path.join("viewer", f))
  .concat(["tools/web.js", "tools/pages.js"]);
let bad = 0;
for (const rel of files) {
  const lines = fs.readFileSync(path.join(ROOT, rel), "utf8").split(/\r?\n/);
  lines.forEach((l, i) => {
    const code = l.replace(/\/\/.*$/, "");   // comments may name them
    if (/(?<![\w.$])(alert|confirm|prompt)\s*\(/.test(code) || /window\.(alert|confirm|prompt)\s*\(/.test(code)) { bad++; console.log(`DIALOG ${rel}:${i + 1}  ${l.trim().slice(0, 110)}`); }
  });
}
console.log(bad ? `${bad} native dialog call(s): use notice() / askNote() instead` : "no native dialogs in the viewer pages");
process.exit(bad ? 1 : 0);
