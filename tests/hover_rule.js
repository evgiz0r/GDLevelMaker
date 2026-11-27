// node tests/hover_rule.js -- every page we make has the button hover style (tools/snippets/hover.css; Evgeni 2026-11-27:
// "all UI buttons should have some hover effect, in all workbooks forever"). A new page template goes in the list by itself:
// every .html under viewer/, tools/, board/, workboard/ with a <style>, and the JS page builders listed below.
"use strict";
const fs = require("fs"), path = require("path"), R = path.join(__dirname, "..");
const files = ["viewer", "tools", "board", "workboard"].flatMap(d => fs.readdirSync(path.join(R, d)).filter(f => f.endsWith(".html")).map(f => path.join(d, f)))
  .concat(["tools/deco_page.js"]);
let bad = 0;
for (const f of files) { const s = fs.readFileSync(path.join(R, f), "utf8"); if (!s.includes("<style") && !s.includes("</style>")) continue;
  if (!s.includes("HOVER ON EVERY BUTTON")) { console.log("NO HOVER STYLE:", f, "(paste tools/snippets/hover.css)"); bad++; } }
console.log(bad ? `${bad} page(s) without the hover style` : `ok: ${files.length} files checked`); process.exit(bad ? 1 : 0);
