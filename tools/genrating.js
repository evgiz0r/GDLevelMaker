// node tools/genrating.js [list] | set <ratings.json>  -- Evgeni's 0-10 rating of each section generator, as a weight
//
// Evgeni (2026-11-28): "give me some controller on each of the generators, ill put a scale of how good i think it is. if
// something is very low it should be used very rarely". He rates each 🎲 type with a slider on the catalogue's Themes tab
// (db collection "genrating", doc = type key: {key, score 0-10, at}). Claude copies them here with `set` (an ArtifactData
// list of the collection saved to a file: an array of docs, or {docs: [...]}), into knowledge/gen_ratings.json, and every
// builder that picks a section type (tools/typebuild.js) weighs its choices by weight(key):
//   (score / 10)^2, at least 0.02; unrated = 5 (0.25). So a 10 is picked 4x as often as an unrated type, a 2 is 1/6 of an
//   unrated one, a 0-1 almost never -- still not banned (a soft rule: he doesn't want hard limits).
// pick(list, rnd, {avoid}) : a weighted pick; the list's order still counts a little (first 1, then 0.8, 0.65 ...), types in
// `avoid` (used already in the level) are only taken when nothing else is left.
const fs = require("fs"), path = require("path");
const FILE = path.join(__dirname, "..", "knowledge", "gen_ratings.json");
const UNRATED = 5;

function load() { try { return JSON.parse(fs.readFileSync(FILE, "utf8")); } catch (e) { return {}; } }
const scoreOf = (key, R = load()) => (R[key] && typeof R[key].score === "number") ? R[key].score : UNRATED;
const weightOfScore = s => Math.max(0.02, Math.pow(Math.max(0, Math.min(10, s)) / 10, 2));
const weight = (key, R) => weightOfScore(scoreOf(key, R));

function pick(list, rnd, o = {}) {
  const R = o.ratings || load(), avoid = o.avoid || new Set();
  const uniq = [...new Set(list)]; if (!uniq.length) return null;
  const fresh = uniq.filter(k => !avoid.has(k)), pool = fresh.length ? fresh : uniq.filter(k => k !== o.last).length ? uniq.filter(k => k !== o.last) : uniq;
  const w = pool.map(k => weight(k, R) * Math.pow(0.8, Math.max(0, uniq.indexOf(k))));
  let t = (rnd ? rnd() : Math.random()) * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) { t -= w[i]; if (t <= 0) return pool[i]; }
  return pool[pool.length - 1];
}

function set(file) {
  const raw = JSON.parse(fs.readFileSync(file, "utf8")), docs = Array.isArray(raw) ? raw : raw.docs || raw.documents || Object.values(raw);
  const R = load(); let n = 0;
  for (const d0 of docs) { const d = d0 && d0.data ? d0.data : d0; if (!d || !d.key || typeof d.score !== "number") continue;
    if (!R[d.key] || String(d.at || "") >= String(R[d.key].at || "")) { R[d.key] = { score: d.score, at: d.at || new Date().toISOString() }; n++; } }
  fs.writeFileSync(FILE, JSON.stringify(R, null, 1) + "\n"); return n;
}

if (require.main === module) {
  const [cmd, a] = process.argv.slice(2);
  if (cmd === "set") { console.log(set(a) + " ratings written to knowledge/gen_ratings.json"); }
  else { const R = load(), keys = require("./sectiongen.js").KEYS;
    for (const k of keys) console.log(k.padEnd(14) + (R[k] ? String(R[k].score).padStart(3) : "  -") + "  weight " + weight(k, R).toFixed(2)); }
}
module.exports = { load, scoreOf, weight, weightOfScore, pick, UNRATED, FILE };
