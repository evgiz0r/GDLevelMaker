// node tools/colourtest.js [--out local/tmp/gdlm_colour_test.gdlvl]
// A small test level ("GDLM colour test") that answers, in the user's real game or editor, which ways of
// colouring an object GD actually honours -- because the signature (tools/signature.js) came out pure WHITE in
// the game (GDLM 60, recording 2026-11-23_04-27-50.mkv ~57461 s): its text (914 on ch 988), pixels (211 on
// 988-999) and halo (497 with an HSV darken) all white, although the header defines those channels and colour
// triggers set them too, and rated levels use channels 988-999 without trouble. VISUALS.md "Signature".
// Rows, left to right, each with a label above (plain white text) -- the user reports what colour each shows:
//   A  211 pixel, key 21 = ch 5   (header: red)            B  211, key 21 = ch 988 (header: red)
//   C  211, key 22 = ch 988 (detail channel)               D  211, no channel key (the object's default)
//   E  text "RED?" key 21 = ch 5                           F  text "RED?" key 21 = ch 988
//   G  497 circle, key 21 = ch 989 (header: green)         H  497, ch 989 + HSV darken (41/43, as the signature)
//   I  211, key 21 = ch 987: NOT in the header, set red by a colour trigger at the start only
//   J  1764 (a plain deco square), key 21 = ch 988
// Nothing is installed: node tools/install.js <out> with the game closed, only when the user agrees.
const path = require("path"), fs = require("fs"), { GD, writeGdlvl } = require("./io.js");
const out = path.resolve(process.argv.includes("--out") ? process.argv[process.argv.indexOf("--out") + 1] : path.join(__dirname, "..", "local", "tmp", "gdlm_colour_test.gdlvl"));
const RED = [255, 40, 40], GREEN = [40, 255, 80];
const entry = (ch, [r, g, b]) => `1_${r}_2_${g}_3_${b}_11_255_12_255_13_255_4_-1_6_${ch}_7_1_15_1_18_0_8_1`;
let header = GD.DEFAULT_HEADER;
{ // add channels 5, 988 (red) and 989 (green) to the header's kS38
  const m = /kS38,([^,]*)/.exec(header);
  const add = [entry(5, RED), entry(988, RED), entry(989, GREEN)].join("|");
  header = m ? header.replace(m[0], "kS38," + (m[1].replace(/\|$/, "") + "|" + add + "|").replace(/^\|/, "")) : header.replace(/;?$/, ",kS38," + add + "|");
}
const objs = [], b64 = s => Buffer.from(s).toString("base64");
const o = (id, x, y, p) => objs.push({ id, x, y, rot: 0, flipX: false, flipY: false, props: Object.assign({ 155: "1" }, p) });
const text = (x, y, s, p) => o(914, x, y, Object.assign({ 31: b64(s), 32: "0.5" }, p));
const rows = [
  ["A", x => o(211, x, 60, { 21: "5", 32: "2" })],
  ["B", x => o(211, x, 60, { 21: "988", 32: "2" })],
  ["C", x => o(211, x, 60, { 22: "988", 32: "2" })],
  ["D", x => o(211, x, 60, { 32: "2" })],
  ["E", x => text(x, 60, "RED?", { 21: "5", 32: "0.8" })],
  ["F", x => text(x, 60, "RED?", { 21: "988", 32: "0.8" })],
  ["G", x => o(497, x, 60, { 21: "989" })],
  ["H", x => o(497, x, 60, { 21: "989", 41: "1", 43: "0a1a0.28a0a0" })],
  ["I", x => o(211, x, 60, { 21: "987", 32: "2" })],
  ["J", x => o(1764, x, 60, { 21: "988", 32: "2" })],
];
o(899, 15, 300, { 23: "987", 7: String(RED[0]), 8: String(RED[1]), 9: String(RED[2]), 10: "0", 35: "1", 36: "1" }); // for row I
rows.forEach(([lab, put], i) => { const x = 300 + i * 150; put(x); text(x, 140, lab); });
text(300 + rows.length * 75, 220, "colour test: what colour is each?");
for (let x = 2000; x <= 2400; x += 30) o(1, x, 15, {}); // a floor block run so the level has an end
const rec = GD.newRecord("GDLM colour test", "Which colour settings show in the game (tools/colourtest.js). Safe to delete.");
fs.mkdirSync(path.dirname(out), { recursive: true });
writeGdlvl(out, rec, { header, objects: objs });
console.log(`wrote ${path.relative(process.cwd(), out)}: ${rows.length} rows (${rows.map(r => r[0]).join("")}); see the head of tools/colourtest.js for what each tests`);
