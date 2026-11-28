// node tests/visualjudge.js -- the visual judge's parser and its warning-only place in the report (no render, no model)
"use strict";
const assert = require("assert"), VJ = require("../tools/visualjudge.js");
const r = VJ.parse("6s | 3d | flat bars.\n- 29.5 s | Portal | three rings stacked.\njunk line\n47-48s | join | stub.\nOVERALL: mostly fine.");
assert.deepStrictEqual(r.notes.map(n => [n.t, n.cat]), [[6, "3d"], [29.5, "portal"], [47, "join"]]);
assert.strictEqual(r.overall, "mostly fine.");
assert.ok(/portal or a section change/.test(VJ.PROMPT("x", 10, 2)));
// report.js keeps visual notes out of the scores: its layout never reads them
const src = require("fs").readFileSync(require("path").join(__dirname, "..", "tools", "report.js"), "utf8");
assert.ok(/out\.visual = /.test(src) && !/layout[^\n]*visual/.test(src), "visual notes must stay warnings");
console.log("visualjudge ok");
