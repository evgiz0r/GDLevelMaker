// node tools/community_index.js   -- the community levels on this PC as the viewer's picker lists them (GET /community/list):
// every local/community/<id>.gdlvl with its name, size and, for the demon list (local/community/demonlist.json, the
// taste session's tools/demonlist.js), its list place, Top 1 history, creator and verifier. No level strings: the viewer
// fetches one level's file when it is opened (other people's levels: local/ only, never the repo or the phone page).
// Names come from each file's record (k2), read once and cached by each file's size and time (in memory and in
// local/community/names.cache.json: the first call on a new PC reads every file, ~1.3 s for 334; later ones ~20 ms).
const fs = require("fs"), path = require("path");
const DIR = () => path.join(process.env.GDLM_LOCAL_DIR || path.join(__dirname, "..", "local"), "community");
let CACHE = null;
function list() {
  let names = []; try { names = fs.readdirSync(DIR()).filter(f => /^\d+\.gdlvl$/.test(f)); } catch (e) { return []; }
  let man = null; try { man = JSON.parse(fs.readFileSync(path.join(DIR(), "demonlist.json"), "utf8")); } catch (e) {}
  const st = f => { try { const s = fs.statSync(path.join(DIR(), f)); return s.size + ":" + s.mtimeMs; } catch (e) { return ""; } };
  const stamp = names.map(f => f + ":" + st(f)).join("|") + "|" + st("demonlist.json");
  if (CACHE && CACHE.stamp === stamp && CACHE.dir === DIR()) return CACHE.rows;
  // names already read: this process's cache, else the file cache (local/community/names.cache.json) from an earlier run
  let prev = (CACHE && CACHE.rows) || null; if (!prev) try { prev = JSON.parse(fs.readFileSync(path.join(DIR(), "names.cache.json"), "utf8")); } catch (e) {}
  const old = new Map((prev || []).map(r => [r.file + "|" + r.stamp, r])); let read = 0;
  const demons = new Map(((man && man.levels) || []).map(d => [String(d.id), d]));
  const rows = [];
  for (const f of names) {
    const id = f.replace(/\.gdlvl$/, ""), file = "local/community/" + f, s = st(f), d = demons.get(id);
    let r = old.get(file + "|" + s);
    if (!r) {
      r = { file, id: +id, stamp: s, bytes: +s.split(":")[0] || 0 }; read++;
      if (d && d.name) r.name = d.name;
      else try { const { GD, unpack } = require("./io.js"); r.name = GD.getField(GD.parseRecord(unpack(fs.readFileSync(path.join(DIR(), f), "utf8"))), "k2") || id; } catch (e) { r.name = id; }
    }
    r = Object.assign({}, r, { demon: d ? { position: d.position || null, top1: d.top1 || null, creator: d.creator || "", verifier: d.verifier || "", objects: d.objects || null, song: d.song || "" } : undefined });
    rows.push(r);
  }
  if (read) try { fs.writeFileSync(path.join(DIR(), "names.cache.json"), JSON.stringify(rows.map(r => ({ file: r.file, id: r.id, stamp: r.stamp, bytes: r.bytes, name: r.name })))); } catch (e) {}
  CACHE = { stamp, dir: DIR(), rows }; return rows;
}
module.exports = { list };
if (require.main === module) { const t0 = Date.now(), r = list(); console.log(`${r.length} community levels (${r.filter(x => x.demon).length} on the demon list), ${Date.now() - t0} ms`);
  for (const x of r.filter(x => x.demon).sort((a, b) => (a.demon.position || 999) - (b.demon.position || 999)).slice(0, 10)) console.log(`#${x.demon.position || "-"} ${x.name} by ${x.demon.creator}${x.demon.top1 ? " (former Top 1)" : ""}`); }
