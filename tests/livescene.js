// node tests/livescene.js -- tools/livescene.js: the lab on GDLM 44 keeps its route, places a horde and a sky event in view,
// its own checks come back clean, and every group it uses is in 6001-6999
"use strict";
const path = require("path"), os = require("os"), fs = require("fs"), { execFileSync } = require("child_process");
const ROOT = path.join(__dirname, ".."), out = path.join(os.tmpdir(), "gdlm_test_livescene.gdlvl");
const line = execFileSync("node", [path.join(ROOT, "tools/livescene.js"), "lab", "--out", out], { encoding: "utf8", windowsHide: true, env: Object.assign({}, process.env, { GDLM_HEAVY_NOSYNC: "1" }) }).trim().split("\n").pop();
const bad = m => { console.error("FAIL: " + m + "\n" + line); process.exit(1); };
if (!/route still clears/.test(line)) bad("route");
if (!/check: clean/.test(line)) bad("check");
if (!/horde [\d.]+-[\d.]+ s n [1-9]/.test(line)) bad("horde placed");
if (!/(strafe|flyby) [\d.]+-[\d.]+ s y \d+ open [\d.]+/.test(line)) bad("sky event placed");
const { readGdlvl } = require(path.join(ROOT, "tools/io.js")), base = readGdlvl(path.join(ROOT, "levels/gdlm_44_hellgate.gdlvl")), L = readGdlvl(out);
const baseG = new Set(); for (const o of base.level.objects) for (const g of String(o.props[57] || "").split(".").filter(Boolean)) baseG.add(+g);
for (const o of L.level.objects) for (const g of String(o.props[57] || "").split(".").filter(Boolean)) if (!baseG.has(+g) && (+g < 6001 || +g > 6999)) bad("group " + g + " outside 6001-6999");
fs.unlinkSync(out);
console.log("ok: " + line.replace(/^.*?: /, ""));
