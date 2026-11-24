// node tests/measures.js -- the measurements store (tools/measures.js): record stamps, latest per level x measure,
// stale on a code change (git diff from the stamp) and on a newer level version. Light: a temp file, no solving.
const fs = require("fs"), os = require("os"), path = require("path"), assert = require("assert");
const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "measures-")), "m.jsonl");
process.env.GDLM_MEASURES_FILE = tmp;
const M = require("../tools/measures.js");
const now = M.commitOf("physics");
assert(now, "physics commit found");
const a = M.record({ level: "test:1", measure: "solved", value: true, levelStr: "abc" });
assert.equal(a.stamps.physics, now); assert.equal(a.ver, M.verOf("abc")); assert(!("levelStr" in a), "level string never stored");
M.record({ level: "test:2", measure: "difficulty", value: 1.2, stamps: { physics: "46672ee~1" } });
M.record({ level: "test:1", measure: "taste", value: 60, levelStr: "abc" });
M.record({ level: "test:1", measure: "taste", value: 61, levelStr: "abcd" });   // a newer version
assert.equal(M.record({ measure: "x" }), null, "no level: not recorded, no throw");
const L = M.latest(M.read()), get = (l, m) => L.find(r => r.level === l && r.measure === m);
assert.deepEqual(get("test:1", "solved").stale.filter(w => !/level changed/.test(w)), [], "today's stamp is current");
assert(get("test:1", "solved").stale.some(w => /level changed/.test(w)), "an older version of the level is stale");
assert(get("test:2", "difficulty").stale.some(w => /physics changed/.test(w)), "physics changed since the stamp");
assert.equal(get("test:1", "taste").value, 61); assert.deepEqual(get("test:1", "taste").stale, []);
const seed = path.join(__dirname, "..", "knowledge", "measurements.jsonl");
for (const l of fs.readFileSync(seed, "utf8").split("\n").filter(Boolean)) { const o = JSON.parse(l);
  assert(o.level && o.measure && o.stamps && !o.levelStr && !o.events && !o.objects, "store line: " + l.slice(0, 80)); }
console.log("measures ok");
