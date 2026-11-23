// node tools/community.js <step> [options]     -- study rated community levels, numbers only
//
//   list [--per 20,10,5]   GDBrowser search: most-liked Featured/Epic/Legendary per tier Easy..Harder
//                          -> local/community/list.json (no platformers, no duplicates)
//   fetch                  download every listed level (tools/fetch_level.js, 2 s apart)
//   measure                per-level numbers (tools/style.js analyse) -> local/community/measured.json,
//                          and medians per tier / era / rating as a markdown table
//   sections               all 2.0-2.1 sections by speed and by mode (blocks, seconds, density)
//   modes                  per-mode anatomy of a section: lead-in after the portal, share of columns
//                          with a hazard, ground gaps/runs, flying openings (Easy+Normal vs Hard+Harder)
//   ref                    the modes numbers as deciles per band and mode -> knowledge/levels/tier_ref.json
//                          (committed: numbers only), read by tools/tiercheck.js
//   comments               fetch the top 60 comments per level -> local/community/comments/<id>.json
//   themes                 count themes in those comments (sync, gameplay, design, "should be harder"...)
//
// Everything downloaded stays in local/community/ (git-ignored, shared between worktrees): other
// people's levels and comments are never committed. What we keep is the numbers, written up in
// knowledge/levels/low_tier_stats.md, modes_low_tier.md and knowledge/players_say.md.
// Static layout only: 2.2 levels that move their gameplay with triggers measure as near empty.
const fs = require("fs"), path = require("path"), https = require("https");
const { execFileSync } = require("child_process");
const style = require("./style.js");
const corpus = require("./corpus.js");
const { GD } = require("./io.js");

const DIR = path.join(__dirname, "..", "local", "community");
const LIST = path.join(DIR, "list.json"), MEAS = path.join(DIR, "measured.json");
const TIERS = { 1: "Easy", 2: "Normal", 3: "Hard", 4: "Harder" };
const FLY = new Set(["ship", "ufo", "wave", "swing"]);
const BPS = { "0.5x": 8.4, "1x": 10.4, "2x": 12.9, "3x": 15.6, "4x": 19.2 }; // blocks per second
const sleep = ms => new Promise(r => setTimeout(r, ms));
const med = a => { a = a.filter(Number.isFinite); if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const f = (v, d = 1) => Number.isFinite(v) ? (+v).toFixed(d) : "-";
const getJSON = u => new Promise(res => https.get(u, { headers: { "User-Agent": "GDLevelMaker-research" } }, r => {
  let d = ""; r.on("data", c => d += c); r.on("end", () => { try { res(JSON.parse(d)); } catch (e) { res(null); } });
}).on("error", () => res(null)));
const eraOf = v => /^1\.|^pre/i.test(v) ? "1.x" : /^2\.[01]/.test(v) ? "2.0-2.1" : "2.2";
const loadList = () => JSON.parse(fs.readFileSync(LIST, "utf8"));
const levelFile = id => path.join(DIR, id + ".gdlvl");

async function list(per) {
  const out = {};
  for (const d of [1, 2, 3, 4]) for (const [filter, count] of [["featured", per[0]], ["epic", per[1]], ["legendary", per[2]]]) {
    const L = await getJSON(`https://gdbrowser.com/api/search/*?diff=${d}&type=mostliked&${filter}&count=${count}`);
    for (const l of Array.isArray(L) ? L : []) {
      if (l.platformer || out[l.id]) continue;
      out[l.id] = { id: l.id, name: l.name.trim(), author: l.author, tier: TIERS[d], stars: l.stars, rating: l.rating,
        likes: l.likes, ver: l.gameVersion, era: eraOf(l.gameVersion), length: l.length, song: `${l.songName} / ${l.songAuthor}`, pick: filter };
    }
    await sleep(1500);
  }
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(LIST, JSON.stringify(Object.values(out), null, 1));
  console.log(Object.values(out).length, "levels ->", LIST);
}

function analyseLevel(id) {
  const L = corpus.file(levelFile(id));
  const a = style.analyse(L);
  const m = style.motifs(L);
  return { L, a, m };
}

// one level's numbers; run in its own process (style.js keeps every level it has read, and the
// big 2.2 levels have 100k+ objects, so one process for all of them runs out of memory)
function one(id) {
  const { a, m } = analyseLevel(id);
  const speeds = [...new Set(a.sections.map(s => s.speed))];
  return { secs: a.secs, blocks: a.blocks, play: Math.round(a.gameplayShare * 100), sections: a.sections.length,
      modes: new Set(a.sections.map(s => s.mode)).size, speeds, rests: a.rests.length,
      haz10: a.sections.reduce((t, s) => t + s.hazards * s.blocks, 0) / Math.max(1, a.sections.reduce((t, s) => t + s.blocks, 0)),
      hazMax: Math.max(0, ...a.sections.map(s => s.hazards)), orbsPads: a.sections.reduce((t, s) => t + s.orbsPads, 0),
      spikeRuns: m.spikeRuns, move: a.triggers.move || 0, alphaZero: a.alphaZero,
      camera: Object.entries(a.triggers).filter(([k]) => k.startsWith("camera")).reduce((t, [, v]) => t + v, 0) };
}
function measure() {
  const rows = [];
  for (const l of loadList()) {
    if (!fs.existsSync(levelFile(l.id))) continue;
    const r = JSON.parse(execFileSync(process.execPath, ["--max-old-space-size=1500", __filename, "one", l.id], { windowsHide: true, encoding: "utf8", maxBuffer: 1 << 24 }));
    if (r.blocks) rows.push({ ...l, ...r });
  }
  fs.writeFileSync(MEAS, JSON.stringify(rows, null, 1));
  const line = (label, R) => {
    const g = k => med(R.map(k)), pc = p => Math.round(100 * R.filter(p).length / R.length);
    return `| ${label} | ${R.length} | ${f(g(r => r.secs), 0)} | ${f(g(r => r.sections), 0)} | ${f(g(r => r.secs / r.sections))} | ${f(g(r => r.modes), 0)} | ` +
      `${pc(r => r.speeds.includes("0.5x"))}% / ${pc(r => r.speeds.includes("3x") || r.speeds.includes("4x"))}% | ${f(g(r => r.play), 0)} | ` +
      `${f(g(r => r.rests / (r.secs / 60)))} | ${f(g(r => r.haz10))} | ${f(g(r => r.orbsPads / (r.secs / 60)), 0)} | ${f(g(r => r.move), 0)} | ${f(g(r => r.alphaZero), 0)} |`;
  };
  console.log("| group | n | s | sections | s per section | modes | 0.5x / 3x+ | play% | rests/min | haz/10 | orbs+pads/min | move | alpha-to-0 |");
  console.log("|---|---|---|---|---|---|---|---|---|---|---|---|---|");
  for (const t of Object.values(TIERS)) console.log(line(t, rows.filter(r => r.tier === t)));
  for (const t of Object.values(TIERS)) { const R = rows.filter(r => r.tier === t && r.era === "2.0-2.1"); if (R.length) console.log(line(t + " (2.0-2.1)", R)); }
  for (const e of ["1.x", "2.0-2.1", "2.2"]) { const R = rows.filter(r => r.era === e); if (R.length) console.log(line("era " + e, R)); }
  for (const k of ["featured", "epic", "legendary", "mythic"]) { const R = rows.filter(r => r.rating === k); if (R.length) console.log(line("rating " + k, R)); }
  console.log(`\n${rows.length} levels measured -> ${MEAS}`);
}

function sectionsOf(filter) {
  const out = [];
  for (const l of loadList().filter(filter)) {
    if (!fs.existsSync(levelFile(l.id))) continue;
    const { L, a } = analyseLevel(l.id);
    out.push({ l, L, a });
  }
  return out;
}

function sections() {
  const bySpeed = {}, byMode = {};
  for (const { a } of sectionsOf(l => l.era === "2.0-2.1")) for (const s of a.sections) {
    if (s.blocks < 8) continue;
    (bySpeed[s.speed] ||= []).push(s); (byMode[s.mode] ||= []).push(s);
  }
  console.log("| speed | sections | median blocks | median s | haz/10 |\n|---|---|---|---|---|");
  for (const k of Object.keys(BPS)) if (bySpeed[k]) { const S = bySpeed[k]; console.log(`| ${k} | ${S.length} | ${f(med(S.map(s => s.blocks)), 0)} | ${f(med(S.map(s => s.blocks)) / BPS[k])} | ${f(med(S.map(s => s.hazards)))} |`); }
  console.log("\n| mode | sections | median blocks | haz/10 |\n|---|---|---|---|");
  for (const [k, S] of Object.entries(byMode).sort((p, q) => q[1].length - p[1].length)) console.log(`| ${k} | ${S.length} | ${f(med(S.map(s => s.blocks)), 0)} | ${f(med(S.map(s => s.hazards)))} |`);
}

// per-section anatomy of one level (sections of 8+ blocks): lead-in after the portal, share of
// columns with a hazard, ground gaps/runs, flying openings. Used by modes(), ref() and tools/tiercheck.js.
function sectionStats(L, a) {
  const objs = L.objects.map(o => ({ o, c: style.classify(o.id).cat })).filter(x => ["solid", "hazard", "orb", "pad"].includes(x.c));
  const out = [];
  for (const s of a.sections) {
    if (s.blocks < 8) continue;
    const x0 = s.from * 30, x1 = x0 + s.blocks * 30;
    const inside = objs.filter(x => x.o.x >= x0 && x.o.x < x1), haz = inside.filter(x => x.c === "hazard");
    const st = { mode: s.mode, speed: s.speed, from: s.from, blocks: s.blocks, secs: s.secs, start: s.start, haz10: s.hazards, act10: s.orbsPads / s.blocks * 10, cont: !!s.cont };
    st.leadIn = ((haz.length ? Math.min(...haz.map(x => x.o.x)) : x1) - x0) / 30;
    const cols = new Map();
    for (const x of inside) { const c = Math.floor(x.o.x / 30); if (!cols.has(c)) cols.set(c, []); cols.get(c).push(x); }
    const hc = [...cols.entries()].filter(([, xs]) => xs.some(x => x.c === "hazard")).map(([c]) => c).sort((p, q) => p - q);
    st.hazCols = hc.length / s.blocks;
    if (FLY.has(s.mode)) {
      const opens = [];
      for (const xs of cols.values()) {
        const ys = xs.filter(x => x.c === "solid" || x.c === "hazard").map(x => x.o.y).concat([-15]).sort((p, q) => p - q);
        if (ys.length < 3) continue;
        let best = 0; for (let i = 1; i < ys.length; i++) best = Math.max(best, ys[i] - ys[i - 1]);
        if (best > 0 && best < 600) opens.push(best / 30 - 1);
      }
      st.open = med(opens);
    } else {
      const gaps = [], runs = []; let run = 1;
      for (let i = 1; i < hc.length; i++) { const d = hc[i] - hc[i - 1]; if (d === 1) run++; else { runs.push(run); run = 1; gaps.push(d - 1); } }
      if (hc.length) runs.push(run);
      st.gap = med(gaps); st.run = med(runs);
    }
    out.push(st);
  }
  return out;
}
const bandOf = tier => tier === "Easy" || tier === "Normal" ? "Easy+Normal" : "Hard+Harder";
function collect() {
  const out = {};
  for (const { l, L, a } of sectionsOf(l => l.era === "2.0-2.1"))
    for (const st of sectionStats(L, a)) ((out[bandOf(l.tier)] ||= {})[st.mode] ||= []).push(st);
  return out;
}
function modes() {
  const out = collect();
  for (const grp of ["Easy+Normal", "Hard+Harder"]) {
    if (!out[grp]) continue;
    console.log(`\n### ${grp} (2.0-2.1)\n`);
    console.log("| mode | sections | median blocks | median s | lead-in blocks | haz/10 | cols with hazard | orbs+pads/10 | ground: gap / run (cols) | fly: opening (blocks) |");
    console.log("|---|---|---|---|---|---|---|---|---|---|");
    for (const [m, S] of Object.entries(out[grp]).sort((p, q) => q[1].length - p[1].length)) {
      const g = k => med(S.map(s => s[k]));
      console.log(`| ${m} | ${S.length} | ${f(g("blocks"), 0)} | ${f(g("secs"))} | ${f(g("leadIn"))} | ${f(g("haz10"))} | ${Math.round(100 * g("hazCols"))}% | ${f(g("act10"))} | ` +
        `${FLY.has(m) ? "-" : `${f(g("gap"), 0)} / ${f(g("run"), 0)}`} | ${FLY.has(m) ? f(g("open")) : "-"} |`);
    }
  }
}

// per band and mode: the deciles (10th..90th percentile) of each section number -> knowledge/levels/tier_ref.json
// (numbers only, so it is committed; tools/tiercheck.js reads it)
const REF = path.join(__dirname, "..", "knowledge", "levels", "tier_ref.json");
const pct = (a, p) => { a = a.filter(Number.isFinite).sort((x, y) => x - y); return a.length ? +a[Math.min(a.length - 1, Math.floor(p * a.length))].toFixed(2) : null; };
function ref() {
  const out = collect(), R = { made: "node tools/community.js ref (" + new Date().toISOString().slice(0, 10) + ")",
    from: "rated 2.0-2.1 community levels in local/community/list.json, sections of 8+ blocks", bands: {} };
  for (const [band, M] of Object.entries(out)) for (const [m, S] of Object.entries(M)) {
    if (S.length < 5) continue;
    const e = (R.bands[band] ||= {})[m] = { n: S.length };
    for (const k of ["secs", "leadIn", "hazCols", "haz10", "act10", "gap", "run", "open"]) {
      const v = S.map(s => s[k]); if (!v.some(Number.isFinite)) continue;
      e[k] = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => pct(v, d / 10));
    }
  }
  fs.writeFileSync(REF, JSON.stringify(R, null, 1).replace(/\[\s+([^\]]*?)\s+\]/g, (m, x) => "[" + x.replace(/\s+/g, " ") + "]") + "\n");
  console.log("->", REF);
}

async function comments() {
  const dir = path.join(DIR, "comments"); fs.mkdirSync(dir, { recursive: true });
  let ok = 0;
  for (const l of loadList()) {
    const file = path.join(dir, l.id + ".json");
    if (fs.existsSync(file)) { ok++; continue; }
    const c = await getJSON(`https://gdbrowser.com/api/comments/${l.id}?top&count=60`);
    if (Array.isArray(c)) { fs.writeFileSync(file, JSON.stringify(c.map(x => ({ t: x.content, likes: x.likes })))); ok++; }
    await sleep(1500);
  }
  console.log(ok, "of", loadList().length, "levels have comments in", dir);
}

const THEMES = {
  sync: /\bsync|sincron/i, gameplay: /gameplay|jugabilidad/i,
  design: /\bdeco|design|art\b|beautiful|gorgeous|hermos|visual|effects?\b|bonit/i, music: /\bsong|music|canci[oó]n|musica/i,
  "too hard / should be higher": /should be (harder|insane|a demon|demon|hard|normal)|too hard|harder than|not (an )?easy|overrated|easy demon|insane\b|is a demon|deber[ií]a ser (demon|insane|harder|hard)/i,
  "too easy / should be lower": /too easy|should be (auto|easy)|easier than|underrated|muy facil/i,
  fake: /\bfake/i, memory: /memor/i, nostalgia: /nostalg|childhood|infancia|years ago|first (level|time)|primer nivel|remember when/i,
  "a % spot": /\b\d{1,2}%|\b100%/i, "unfair / bad": /unfair|bullshit|\bbs\b|bad gameplay|terrible|annoying|garbage|horrible/i,
  "flow / fun": /\bflow|\bfun\b|enjoy|divertid|smooth|satisf/i,
};
function themes() {
  const per = {}, n = {}, perLevel = [];
  for (const l of loadList()) {
    const file = path.join(DIR, "comments", l.id + ".json");
    if (!fs.existsSync(file)) continue;
    const C = JSON.parse(fs.readFileSync(file, "utf8")), c = {};
    for (const x of C) for (const [k, re] of Object.entries(THEMES)) if (re.test(x.t || "")) c[k] = (c[k] || 0) + 1;
    per[l.tier] ||= {}; for (const k in c) per[l.tier][k] = (per[l.tier][k] || 0) + c[k];
    n[l.tier] = (n[l.tier] || 0) + C.length; perLevel.push({ l, N: C.length, c });
  }
  const T = Object.values(TIERS);
  console.log(`| theme | ${T.join(" | ")} |\n|---|${T.map(() => "---|").join("")}`);
  for (const k in THEMES) console.log(`| ${k} | ${T.map(t => f(100 * ((per[t] || {})[k] || 0) / (n[t] || 1)) + "%").join(" | ")} |`);
  console.log("\nlevels where a theme comes up most (count / comments):");
  for (const k of ["gameplay", "too hard / should be higher", "unfair / bad", "design"]) {
    const top = perLevel.sort((p, q) => (q.c[k] || 0) / q.N - (p.c[k] || 0) / p.N).slice(0, 6);
    console.log(`  ${k}: ` + top.map(x => `${x.l.name} (${x.l.tier}) ${x.c[k] || 0}/${x.N}`).join("; "));
  }
}

module.exports = { sectionStats, bandOf, FLY, BPS, med };
if (require.main === module) (async () => {
  const [step, ...rest] = process.argv.slice(2);
  if (step === "list") { const i = rest.indexOf("--per"); await list(i >= 0 ? rest[i + 1].split(",").map(Number) : [20, 10, 5]); }
  else if (step === "fetch") execFileSync(process.execPath, [path.join(__dirname, "fetch_level.js"), ...loadList().map(l => l.id), "--out", DIR], { windowsHide: true, stdio: "inherit" });
  else if (step === "one") process.stdout.write(JSON.stringify(one(rest[0])));
  else if (step === "measure") measure();
  else if (step === "sections") sections();
  else if (step === "modes") modes();
  else if (step === "ref") ref();
  else if (step === "comments") await comments();
  else if (step === "themes") themes();
  else console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n"));
})();
