// Node-side reading and writing of .gdlvl files (the gzip layers).
const fs = require("fs");
const zlib = require("zlib");
// GD.run with lib/runcache.js (exact: a run starts where it first differs from an earlier one): installed on the
// physics module itself before anything copies it, so lib/natural.js, windows.js and difficulty.js get it too
const PHYSICS = require("../lib/physics.js"); require("../lib/runcache.js").installRunCache(PHYSICS);
const GD = Object.assign({}, require("../lib/gd.js"), require("../lib/objects.js"), PHYSICS);

function unpack(b64) { return zlib.gunzipSync(Buffer.from(GD.b64urlToBytes(b64))).toString("utf8"); }
function pack(text) {
  // GD writes a gzip header with mtime 0 ("H4sIAAAAAAAA..."); node's gzip does the same
  return GD.bytesToB64url(zlib.gzipSync(Buffer.from(text, "utf8")));
}

function readGdlvl(file) {
  const rec = GD.parseRecord(unpack(fs.readFileSync(file, "utf8")));
  const levelStr = unpack(GD.getField(rec, "k4"));
  return { rec, level: GD.parseLevel(levelStr), levelStr, name: GD.getField(rec, "k2"), desc: GD.decodeDesc(GD.getField(rec, "k3")) };
}
// Key 155 is GD 2.2's colour-batch index: objects that share a value share ONE colour in the game (Brave Blue: 617 of its
// 638 values go with exactly one colour pair). We wrote "1" on every object, so the game painted all our deco in one
// colour -- the user's colour test (2026-11-24_19-16-56.mkv): every row flips to the colour of the leftmost one on screen.
// Levels without it (Dreamy, 17736 objects) are coloured right: GD works it out on load. So it is never written.
function strip155(level) { for (const o of level.objects) if (o.props && "155" in o.props) delete o.props[155]; return level; }
function writeGdlvl(file, rec, level) {
  strip155(level);
  GD.setField(rec, "k4", "s", pack(GD.serializeLevel(level)));
  GD.setField(rec, "k48", "i", String(level.objects.length));
  fs.writeFileSync(file, pack(GD.serializeRecord(rec)));
}

module.exports = { GD, unpack, pack, readGdlvl, writeGdlvl, strip155 };
