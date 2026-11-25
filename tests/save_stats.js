// node tests/save_stats.js -- the save catalogue on a made-up save (no real save needed)
const assert = require("assert"), zlib = require("zlib"), fs = require("fs"), os = require("os"), path = require("path");
const S = require("../tools/save_stats.js");
const lvl = (id, extra) => `<k>${id}</k><d><k>kCEK</k><i>4</i><k>k1</k><i>${id}</i>${extra}</d>`;
const xml = `<?xml version="1.0"?><plist version="1.0" gjver="2.0"><dict>`
  + `<k>GS_value</k><d><k>2</k><s>5000</s><k>4</k><s>2</s><k>5</k><s>1</s><k>6</k><s>40</s></d>`
  + `<k>GS_completed</k><d><k>c_1001</k><s>1</s><k>demon_1001</k><s>1</s><k>c_777</k><s>1</s><k>c_1</k><s>1</s></d>`
  + `<k>GLM_01</k><d>${lvl(1, "<k>k18</k><i>12</i><k>k19</k><i>100</i><k>k36</k><i>80</i>")}</d>`
  + `<k>GLM_03</k><d>${lvl(1001, "<k>k2</k><s>Bloodbath &amp; co</s><k>k25</k><t /><k>k26</k><i>10</i><k>k76</k><i>6</i><k>k18</k><i>9000</i><k>k19</k><i>100</i><k>k20</k><i>100</i><k>k88</k><s>3,50,47</s><k>kI6</k><d><k>0</k><s>0</s></d>")}`
  + `${lvl(2002, "<k>k2</k><s>Easy one</s><k>k26</k><i>2</i><k>k18</k><i>3</i><k>k19</k><i>64</i><k>k75</k><i>1</i><k>k27</k><i>5</i>")}</d>`
  + `</dict></plist>`;
const f = path.join(os.tmpdir(), "gdlm_test_save.dat");
const b = Buffer.from(zlib.gzipSync(Buffer.from(xml)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_"), "latin1");
for (let i = 0; i < b.length; i++) b[i] ^= 11;
fs.writeFileSync(f, b);
const cat = S.catalogue(S.readSave(f));
const by = id => cat.levels.find(l => l.id === id && (id > 22 || l.kind === "main"));
assert.equal(cat.totals.demons, 1); assert.equal(cat.totals.attempts, 5000);
assert.deepEqual(cat.demonsTaken, [1001]);
assert.equal(by(1).name, "Stereo Madness"); assert.equal(by(1).attempts, 12); assert.ok(by(1).done);
assert.equal(by(1001).name, "Bloodbath & co"); assert.equal(by(1001).tier, "Extreme Demon"); assert.ok(by(1001).done);
assert.deepEqual(by(1001).bestSteps, [3, 50, 47]);
assert.equal(by(2002).tier, "Easy"); assert.ok(!by(2002).done); assert.equal(by(2002).epic, "Epic"); assert.ok(by(2002).featured);
assert.ok(by(777).notInSave && by(777).done);
assert.equal(cat.levels.filter(l => l.kind === "main").length, 22);
assert.deepEqual(S.officialStats(S.readSave(f))[1].attempts, 12);
fs.unlinkSync(f);
console.log("ok save_stats");
