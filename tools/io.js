// Node-side reading and writing of .gdlvl files (the gzip layers).
const fs = require("fs");
const zlib = require("zlib");
const GD = Object.assign({}, require("../lib/gd.js"), require("../lib/objects.js"), require("../lib/physics.js"));

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
function writeGdlvl(file, rec, level) {
  GD.setField(rec, "k4", "s", pack(GD.serializeLevel(level)));
  GD.setField(rec, "k48", "i", String(level.objects.length));
  fs.writeFileSync(file, pack(GD.serializeRecord(rec)));
}

module.exports = { GD, unpack, pack, readGdlvl, writeGdlvl };
