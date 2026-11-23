// The files of incremental solving (PHYSICS.md "Incremental solving"), all in the shared local/ folder:
//   local/incsolve/sections/<entry key>.json   cached route sections (lib/incsolve.js sectionRecord), a list per key
//   local/solutions/lv/<level hash>.gz         the level a saved solution was solved on, so a later edit of that
//                                              level can be diffed against it (tools/solutions.js keeps it)
//   local/solutions/names.json                 level name -> the hashes of its saved solutions, newest last
// require("./inc_store.js").sections() is the store lib/incsolve.js's cache functions take.
const fs = require("fs"), path = require("path"), zlib = require("zlib");
const ROOT = path.join(__dirname, "..", "local");
const SEC = path.join(ROOT, "incsolve", "sections"), LV = path.join(ROOT, "solutions", "lv"), NAMES = path.join(ROOT, "solutions", "names.json");

// the section store: get(key) -> [records], put(record) (one record per objects hash + stamp + entry key)
function sections() {
  const mem = new Map();
  const file = k => path.join(SEC, k + ".json");
  const get = k => { if (mem.has(k)) return mem.get(k); let l = [];
    try { l = JSON.parse(fs.readFileSync(file(k), "utf8")); } catch (e) { /* none yet */ }
    mem.set(k, l); return l; };
  const put = r => { const l = get(r.key).filter(x => !(x.objs === r.objs && x.stamp === r.stamp && x.held0 === r.held0)); l.push(r);
    if (l.length > 8) l.splice(0, l.length - 8);   // the newest few per entry
    mem.set(r.key, l); fs.mkdirSync(SEC, { recursive: true }); fs.writeFileSync(file(r.key), JSON.stringify(l)); };
  return { get, put };
}

// the level string a solution was solved on, by its solutions.js hash
function saveLevel(hash, levelStr, name) {
  try {
    fs.mkdirSync(LV, { recursive: true });
    const f = path.join(LV, hash + ".gz");
    if (!fs.existsSync(f)) fs.writeFileSync(f, zlib.gzipSync(Buffer.from(levelStr, "utf8")));
    if (name) { let n = {}; try { n = JSON.parse(fs.readFileSync(NAMES, "utf8")); } catch (e) { /* first */ }
      const l = (n[name] || []).filter(h => h !== hash); l.push(hash); n[name] = l.slice(-20);
      fs.writeFileSync(NAMES, JSON.stringify(n)); }
  } catch (e) { /* a cache: never fail the caller */ }
}
function loadLevel(hash) { try { return zlib.gunzipSync(fs.readFileSync(path.join(LV, hash + ".gz"))).toString("utf8"); } catch (e) { return null; } }
// the hashes saved under a level name, newest last
function byName(name) { try { return JSON.parse(fs.readFileSync(NAMES, "utf8"))[name] || []; } catch (e) { return []; } }

module.exports = { sections, saveLevel, loadLevel, byName, SEC, LV };
