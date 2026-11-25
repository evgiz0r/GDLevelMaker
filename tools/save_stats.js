// node tools/save_stats.js [--list] [--demons] [--done] [--diff <Easy|Normal|Hard|Harder|Insane|Demon|...>]
// Reads (NEVER writes) the player's own stats from the game's save (CCGameManager.dat; GD need not be closed, the file is
// only read). Save format: XOR 11 -> base64url -> gzip -> plist.
//   local/difficulty/user_stats.json         -- the 22 main levels (as before; tools/difficulty.js reads it)
//   local/difficulty/user_stats_online.json  -- the catalogue: every level in the save (main levels + every online level
//                                               played, GLM_03), its difficulty, and the player's stats; plus the totals
//                                               from GS_value and the completed list GS_completed. Local only (his data).
//                                               {at, totals, demonsTaken, levels: [{id, name, creator, kind, tier, stars,
//                                               done, attempts, jumps, best (= normal %), practice, ...}]} -- the work board's
//                                               "Your levels" table reads it.
// Keys per level (gddocs "Level object"; GLM_01 main, GLM_03 online, entry "n"): k1 id, k2 name, k5 creator, k18 attempts
// (lifetime, incl. replays after beating), k36 jumps, k19 normal-mode best %, k20 practice best %, k26 stars, k25 demon,
// k76 demon type, k27 feature score, k75 epic (1 epic, 2 legendary, 3 mythic), k45 custom song, k23 length, k88 the
// normal-mode new-best steps (e.g. "1,15,84": 1%, then +15 to 16%, then +84 to 100%).
// GS_value: 3 official levels done, 4 online levels done, 5 demons, 6 stars, 42 insane levels. GS_completed: c_<id> done,
// n_<id> beaten in normal, star_<id> stars taken, demon_<id> demon taken (gddocs; the demon type numbers are the server's
// key-43 values; checked on the user's save 2026-11-25: 3 Easy (Robotic Nightmares), 4 Medium (B), 5 Insane (Supersonic,
// Necropolis), 6 Extreme (Bloodbath, Acu, Sonic Wave); a Hard demon has NO k76 (0 is the plist default, left out): Nine
// Circles, Jawbreaker, Future Funk, Deadly Clubstep... -- so a demon with k76 missing is Hard. The raw value stays demonType).
// Every printed level has --list form: id, name, difficulty, done, attempts, normal %, practice %.
const fs = require("fs"), path = require("path"), zlib = require("zlib");
const SAVE = process.env.GD_SAVE_FILE || path.join(process.env.LOCALAPPDATA || "", "GeometryDash", "CCGameManager.dat");
const OUT = path.join(__dirname, "..", "local", "difficulty", "user_stats.json");
const OUT_ALL = path.join(__dirname, "..", "local", "difficulty", "user_stats_online.json");

function readSave(file) {
  const b = fs.readFileSync(file);
  for (let i = 0; i < b.length; i++) b[i] ^= 11;
  const s = b.toString("latin1").replace(/\0/g, "").replace(/-/g, "+").replace(/_/g, "/");
  return zlib.gunzipSync(Buffer.from(s, "base64")).toString("utf8");
}

function officialStats(xml) {
  const at = xml.indexOf("<k>GLM_01</k>"), out = {};
  if (at < 0) return out;
  for (let n = 1; n <= 22; n++) {
    const a = xml.indexOf(`<k>${n}</k><d><k>kCEK</k><i>4</i><k>k1</k><i>${n}</i>`, at);
    if (a < 0) continue;
    const seg = xml.slice(a, xml.indexOf("</d>", a));
    const g = k => { const r = new RegExp(`<k>${k}</k><[is]>([^<]*)<`).exec(seg); return r ? r[1] : null; };
    out[n] = { attempts: +g("k18") || 0, jumps: +g("k36") || 0, normal: +g("k19") || 0, practice: +g("k20") || 0,
               bestSteps: (g("k88") || "").split(",").filter(Boolean).map(Number) };
  }
  return out;
}

// ---- a small plist reader for GD's short tags: <d>, <k>, <s>, <i>, <r>, <t/>, <f/>, <a> ----
function unxml(s) { return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&"); }
function parsePlist(xml) {
  const re = /<(\/?)([a-z]+)\s*(\/?)>/g;
  let m, root = null; const stack = []; let key = null, textFrom = 0, open = null;
  const put = v => {
    const top = stack[stack.length - 1];
    if (!top) { root = v; return; }
    if (Array.isArray(top.v)) top.v.push(v); else { top.v[top.key] = v; top.key = null; }
  };
  while ((m = re.exec(xml))) {
    const [, close, tag, self] = m;
    if (tag === "plist" || tag === "dict" && false) continue;
    if (self) {
      if (tag === "t") put(true); else if (tag === "f") put(false);
      else if (tag === "d" || tag === "dict") put({}); else if (tag === "a") put([]); else if (tag === "s") put("");
      continue;
    }
    if (!close) {
      if (tag === "d" || tag === "dict" || tag === "a" || tag === "array") stack.push({ v: tag[0] === "a" ? [] : {}, key: null });
      else { open = tag; textFrom = re.lastIndex; }
      continue;
    }
    if (tag === "d" || tag === "dict" || tag === "a" || tag === "array") { const c = stack.pop(); put(c.v); continue; }
    const text = xml.slice(textFrom, m.index);
    if (tag === "k" || tag === "key") { stack[stack.length - 1].key = unxml(text); continue; }
    if (tag === "i" || tag === "integer") put(+text);
    else if (tag === "r" || tag === "real") put(+text);
    else if (tag === "s" || tag === "string") put(unxml(text));
    open = null;
  }
  return root || {};
}
// the value of top-level key `name` only (the save is several MB: parse just that dict)
function section(xml, name) {
  const at = xml.indexOf(`<k>${name}</k>`);
  if (at < 0) return null;
  let i = at + name.length + 7;
  if (xml.startsWith("<d />", i) || xml.startsWith("<d/>", i)) return {};
  if (!xml.startsWith("<d>", i)) return null;
  let depth = 0; const re = /<(\/?)d(\s*\/)?>/g; re.lastIndex = i; let m;
  while ((m = re.exec(xml))) {
    if (m[2]) continue;
    depth += m[1] ? -1 : 1;
    if (!depth) return parsePlist(xml.slice(i, re.lastIndex));
  }
  return null;
}

const MAIN = [null, ["Stereo Madness", 1], ["Back On Track", 2], ["Polargeist", 3], ["Dry Out", 4], ["Base After Base", 5],
  ["Can't Let Go", 6], ["Jumper", 7], ["Time Machine", 8], ["Cycles", 9], ["xStep", 10], ["Clutterfunk", 11],
  ["Theory of Everything", 12], ["Electroman Adventures", 10], ["Clubstep", 14], ["Electrodynamix", 12],
  ["Hexagon Force", 12], ["Blast Processing", 10], ["Theory of Everything 2", 14], ["Geometrical Dominator", 10],
  ["Deadlocked", 15], ["Fingerdash", 12], ["Dash", 12]];
const MAIN_TIER = { 1: "Easy", 2: "Easy", 3: "Normal", 4: "Normal", 5: "Hard", 6: "Hard", 7: "Harder", 8: "Harder", 9: "Harder",
  10: "Insane", 11: "Insane", 12: "Insane", 13: "Insane", 14: "Easy Demon", 15: "Insane", 16: "Insane", 17: "Harder",
  18: "Easy Demon", 19: "Harder", 20: "Easy Demon", 21: "Insane", 22: "Insane" };
const DEMON = { 3: "Easy", 4: "Medium", 0: "Hard", 5: "Insane", 6: "Extreme" };   // server key 43 values; save k76 assumed alike
const LEN = ["Tiny", "Short", "Medium", "Long", "XL", "Platformer"];
const EPIC = ["", "Epic", "Legendary", "Mythic"];
function tierOf(stars, demon, demonType, auto, k7) {
  if (demon || stars >= 10) return (DEMON[demonType == null ? 0 : demonType] || "?") + " Demon";   // no k76 = 0 = Hard
  if (auto || stars === 1) return "Auto";
  if (stars) return stars <= 2 ? "Easy" : stars === 3 ? "Normal" : stars <= 5 ? "Hard" : stars <= 7 ? "Harder" : "Insane";
  return "Unrated";
}
const TIER_ORDER = ["Unrated", "Auto", "Easy", "Normal", "Hard", "Harder", "Insane", "Easy Demon", "Medium Demon",
  "Hard Demon", "Insane Demon", "Extreme Demon", "? Demon"];

function levelRow(d, kind, completed) {
  const id = +d.k1, stars = +d.k26 || 0, demon = !!d.k25;
  const done = (+d.k19 || 0) >= 100 || completed.has("c_" + id) || completed.has("n_" + id);
  return {
    id, kind, name: d.k2 || "", creator: d.k5 || "", stars, demon, demonType: d.k76 != null ? +d.k76 : null,
    tier: kind === "main" ? MAIN_TIER[id] : tierOf(stars, demon, d.k76 != null ? +d.k76 : null, d.k33, d.k7),
    featured: (+d.k27 || 0) > 0, epic: EPIC[+d.k75 || 0] || "", length: LEN[+d.k23] || null, song: +d.k45 || null,
    done, attempts: +d.k18 || 0, jumps: +d.k36 || 0, normal: +d.k19 || 0, best: +d.k19 || 0, practice: +d.k20 || 0,
    bestSteps: String(d.k88 || "").split(",").filter(Boolean).map(Number),
  };
}

function catalogue(xml) {
  const gsv = section(xml, "GS_value") || {}, gsc = section(xml, "GS_completed") || {};
  const completed = new Set(Object.keys(gsc));
  const levels = [];
  const main = section(xml, "GLM_01") || {};
  for (let n = 1; n <= 22; n++) {
    const d = main[n] || { k1: n };
    const r = levelRow({ ...d, k1: n, k2: MAIN[n][0] }, "main", completed);
    r.stars = MAIN[n][1]; r.demon = r.tier.endsWith("Demon");
    levels.push(r);
  }
  const online = section(xml, "GLM_03") || {};
  for (const [id, d] of Object.entries(online)) if (d && typeof d === "object") levels.push(levelRow({ k1: +id, ...d }, "online", completed));
  const ids = new Set(levels.map(l => l.kind + l.id));
  // completed in GS_completed but not kept in GLM_03 (GD drops old downloads): listed by id only
  for (const k of completed) {
    const m = /^c_(\d+)$/.exec(k); if (!m || ids.has("online" + +m[1]) || +m[1] <= 22 && ids.has("main" + +m[1])) continue;
    levels.push({ id: +m[1], kind: "online", name: "", tier: completed.has("demon_" + m[1]) ? "? Demon" : "?", done: true,
      demon: completed.has("demon_" + m[1]), attempts: null, normal: 100, best: 100, practice: null, notInSave: true });
  }
  const totals = { jumps: +gsv[1] || 0, attempts: +gsv[2] || 0, officialDone: +gsv[3] || 0, onlineDone: +gsv[4] || 0,
    demons: +gsv[5] || 0, stars: +gsv[6] || 0, insaneDone: +gsv[42] || 0 };
  const demonsTaken = [...completed].filter(k => /^demon_\d+$/.test(k)).map(k => +k.slice(6));
  return { at: new Date().toISOString(), source: "CCGameManager.dat (read-only)", totals, demonsTaken, levels };
}

function show(cat, args) {
  const want = args.includes("--demons") ? l => l.demon : args.includes("--done") ? l => l.done : () => true;
  const di = args.indexOf("--diff"), diff = di >= 0 ? (args[di + 1] || "").toLowerCase() : null;
  const rows = cat.levels.filter(want).filter(l => !diff || (l.tier || "").toLowerCase().includes(diff))
    .sort((a, b) => TIER_ORDER.indexOf(b.tier) - TIER_ORDER.indexOf(a.tier) || (b.attempts || 0) - (a.attempts || 0));
  for (const l of rows) console.log(`${String(l.id).padStart(9)}  ${(l.name || "(not in save)").slice(0, 28).padEnd(28)} ${(l.tier || "").padEnd(14)}`
    + ` ${l.done ? "done" : "    "} ${String(l.attempts ?? "-").padStart(6)} att  normal ${String(l.normal ?? "-").padStart(3)}%  practice ${String(l.practice ?? "-").padStart(3)}%`);
  const t = cat.totals;
  console.log(`\n${rows.length} levels shown. Save totals: ${t.demons} demons, ${t.onlineDone} online + ${t.officialDone} official levels done,`
    + ` ${t.stars} stars, ${t.attempts} attempts, ${t.jumps} jumps.`);
}

if (require.main === module) {
  const args = process.argv.slice(2), xml = readSave(SAVE);
  const stats = officialStats(xml);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(stats, null, 1));
  const cat = catalogue(xml);
  fs.writeFileSync(OUT_ALL, JSON.stringify(cat, null, 1));
  if (args.includes("--list") || args.includes("--demons") || args.includes("--done") || args.includes("--diff")) show(cat, args);
  else for (const [n, s] of Object.entries(stats)) console.log(`${n.padStart(2)}  ${String(s.attempts).padStart(5)} attempts  normal ${s.normal}%  best steps ${s.bestSteps.join(",")}`);
  console.log(`\n${OUT}\n${OUT_ALL} (${cat.levels.length} levels; --list | --demons | --done | --diff Insane prints them)`);
}
module.exports = { readSave, officialStats, parsePlist, section, catalogue, tierOf };
