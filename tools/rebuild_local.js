// node tools/rebuild_local.js                  -- what is local-only (never in git), whether this computer has it, and the
//                                                  command that rebuilds it from YOUR game or a public source
// node tools/rebuild_local.js --quick          -- rebuild every quick item that is missing (seconds to a minute, no heavy solve)
// node tools/rebuild_local.js --run <id ...>   -- rebuild those items (missing or not); --all = every item that can be rebuilt
// node tools/rebuild_local.js --json           -- the table as JSON
//
// The one list of local-only data (SETUP.md "Rebuilding local data"). The rule (CLAUDE.md): anything we keep out of git
// -- RobTop's levels, art and songs, other people's levels, anything made from them -- gets a row here with an easy
// rebuild command, in the same change that makes it local-only. Personal data (the owner's recordings, save, marks) is
// listed as "personal": it cannot be rebuilt on another computer, only made anew by playing. Test: node tests/rebuild_local.js
"use strict";
const fs = require("fs"), path = require("path"), cp = require("child_process");
const ROOT = path.join(__dirname, ".."), L = p => path.join(ROOT, "local", p);
const has = p => fs.existsSync(L(p));
const count = (dir, re) => { try { return fs.readdirSync(L(dir)).filter(f => re.test(f)).length; } catch (e) { return 0; } };
const node = (...a) => ({ cmd: process.execPath, args: a.map(x => x.startsWith("tools/") ? path.join(ROOT, x) : x), show: "node " + a.join(" ") });

// id, what, source (game | public | network | personal), check -> {ok, detail}, how to rebuild, how long + basis, quick?
const ITEMS = [
  { id: "mains", what: "main levels 1-22 with their routes, raw solves, coin routes (viewer \"official\")", source: "game",
    check: () => { const n = count("", /^official_\d\d\.json$/); return { ok: n >= 21, detail: n + " of 22" }; },
    run: node("tools/setup.js"), time: "~15 s (owner's PC, 2026-11-25)", quick: true },
  { id: "lego", what: "bricks cut from every level's route (lego pieces, incl. the main levels')", source: "game",
    check: () => ({ ok: has("lego/pieces.json") }), after: ["mains"],
    run: Object.assign(node("tools/lego.js", "mine"), { env: { LEGO_CACHED_WINDOWS: "1" }, show: "LEGO_CACHED_WINDOWS=1 node tools/lego.js mine" }),
    time: "seconds: timing windows from git (knowledge/lego_windows/), marked stale where the physics moved since", quick: true },
  { id: "lego_windows", what: "the bricks' timing windows measured again on today's physics (git's copy goes stale after a physics change)", source: "game",
    check: () => ({ ok: count("lego/windows", /\.json$/) >= 21, detail: count("lego/windows", /\.json$/) + " levels measured here" }), after: ["mains"],
    run: node("tools/lego.js", "mine"), time: "~40 min+ for the main levels: 1-20 in 40 min, Deadlocked alone 22 min, Fingerdash not timed (fresh clone, cloud, 2026-11-28)", heavy: true },
  { id: "bricks_main", what: "the main levels' bricks for the private pages and the draw pen", source: "game",
    check: () => ({ ok: has("bricks_main.js") }), after: ["lego"],
    run: node("tools/brickset.js", "--main"), time: "seconds (not measured)", quick: true },
  { id: "gdsolver", what: "gdsolver's real-game input plans for the 22 main levels (MIT; tools/tas.js, coins.js, presslib)", source: "network",
    check: () => { const n = count("gdsolver", /^solution_lv\d+_(dp|coins)\.txt$/); return { ok: n >= 22, detail: n + " plans" }; },
    run: { fn: fetchGdsolver, show: "git clone --depth 1 github.com/gdsolver/gdsolver, copy data/ -> local/gdsolver/" },
    time: "~5 s (cloud, 2026-11-28)", quick: true },
  { id: "presslib", what: "the press library learned from every clear", source: "game",
    check: () => ({ ok: has("presslib/lib.json") }), after: ["mains", "gdsolver"],
    run: node("tools/presslib.js", "learn", "--set", "all"), time: "not measured" },
  { id: "difficulty", what: "difficulty scores of the main levels", source: "game",
    check: () => { const n = count("difficulty", /^scored_\d\d\.json$/); return { ok: n >= 20, detail: n + " scored" }; }, after: ["mains"],
    run: node("tools/difficulty.js"), time: "~16 min for levels 1-20 (DIFFICULTY.md, 2026-11-25)", heavy: true },
  { id: "beats", what: "beat grids measured from the song files (the committed viewer/song_grids.js already covers the viewer)", source: "game",
    check: () => ({ ok: has("beats.local.js") }), needs: ["ffmpeg"],
    run: node("tools/beats.js", "--all"), time: "not measured" },
  { id: "songs", what: "custom Newgrounds songs our levels use", source: "network",
    check: () => ({ ok: count("songs", /\.mp3$/) > 0, detail: count("songs", /\.mp3$/) + " songs" }),
    run: node("tools/songs.js", "--levels"), time: "3 s wait per song + download (not measured); GD also fetches each one the first time you play" },
  { id: "catalogue", what: "contact sheets of every object id with GD's picture", source: "game",
    check: () => ({ ok: count("catalogue", /\.png$/) > 0 }), needs: ["chromium"],
    run: node("tools/catalogue.js", "sheets"), time: "~1 min (tools/catalogue.js)", heavy: true },
  { id: "videos", what: "videos of the main levels played on their routes, with the song", source: "game",
    check: () => ({ ok: count("video", /\.mp4$/) > 0, detail: count("video", /\.mp4$/) + " videos" }), needs: ["ffmpeg", "chromium"], after: ["mains"],
    run: { fn: videos, show: "node tools/video.js official:N --route   (N = 1..21, one at a time)" },
    time: "2.2-4.7x each level's length (Jumper 90 s: 202-408 s; CLAUDE.md)", heavy: true },
  { id: "community", what: "rated community levels (taste corpus, demon list); the learned numbers are in git", source: "network",
    check: () => ({ ok: count("community", /\.gdlvl$/) > 0, detail: count("community", /\.gdlvl$/) + " levels" }),
    run: node("tools/taste.js", "fetch"), time: "10+ min of rate-limit waits for ~330 levels (taste.js)" },
  { id: "personal", what: "the owner's recordings, attempts, marks, save stats, work in progress", source: "personal",
    check: () => ({ ok: has("attempts") || has("marks.jsonl"), detail: "made by playing and marking on this computer" }), run: null },
];

function needOk(n) {
  if (n === "ffmpeg") return cp.spawnSync(process.env.FFMPEG || "ffmpeg", ["-version"], { windowsHide: true }).status === 0;
  if (n === "chromium") { const src = fs.readFileSync(path.join(__dirname, "headless.js"), "utf8");   // the browsers headless.js looks for
    const list = (src.match(/"(?:[A-Z]:)?\/[^"]+(?:msedge|chrome|chromium)(?:\.exe)?"/g) || []).map(x => x.slice(1, -1));
    try { for (const d of fs.readdirSync("/opt/pw-browsers")) if (/^chromium-\d+$/.test(d)) list.push(`/opt/pw-browsers/${d}/chrome-linux64/chrome`); } catch (e) {}
    return list.some(f => fs.existsSync(f)); }
  return true;
}
function fetchGdsolver() {
  const tmp = L("tmp/gdsolver_clone"); fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(L("tmp"), { recursive: true });
  const r = cp.spawnSync("git", ["clone", "-q", "--depth", "1", "https://github.com/gdsolver/gdsolver", tmp], { stdio: "inherit", windowsHide: true });
  if (r.status !== 0) return 1;
  fs.mkdirSync(L("gdsolver"), { recursive: true });
  let n = 0; for (const f of fs.readdirSync(path.join(tmp, "data"))) { const s = path.join(tmp, "data", f); if (fs.statSync(s).isFile()) { fs.copyFileSync(s, L("gdsolver/" + f)); n++; } }
  fs.rmSync(tmp, { recursive: true, force: true }); console.log(`gdsolver: ${n} files -> local/gdsolver/`); return 0;
}
function videos() {
  let bad = 0;
  for (let n = 1; n <= 22; n++) {
    const f = L(`official_${String(n).padStart(2, "0")}.json`); let j = null; try { j = JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) {}
    if (!j || !j.solution || !j.solution.ok) { console.log(`videos: ${n} has no clearing route, skipped`); continue; }
    bad += cp.spawnSync(process.execPath, [path.join(__dirname, "video.js"), "official:" + n, "--route"], { stdio: "inherit", windowsHide: true, cwd: ROOT }).status ? 1 : 0;
  }
  return bad ? 1 : 0;
}

function table() {
  return ITEMS.map(it => { const c = it.check(); const missing = (it.needs || []).filter(n => !needOk(n));
    return { id: it.id, what: it.what, source: it.source, have: !!c.ok, detail: c.detail || "", rebuild: it.run ? it.run.show : "cannot be rebuilt",
      time: it.time || "", quick: !!it.quick, heavy: !!it.heavy, needs: missing }; });
}
function runItem(it) {
  if (!it.run) { console.log(`${it.id}: personal data, cannot be rebuilt`); return 0; }
  const missing = (it.needs || []).filter(n => !needOk(n));
  if (missing.length) { console.log(`${it.id}: needs ${missing.join(", ")} -- install it first, skipped`); return 1; }
  console.log(`\n== ${it.id}: ${it.run.show}  (${it.time})`);
  if (it.run.fn) return it.run.fn();
  return cp.spawnSync(it.run.cmd, it.run.args, { stdio: "inherit", windowsHide: true, cwd: ROOT, env: Object.assign({}, process.env, it.run.env || {}) }).status || 0;
}

if (require.main === module) {
  const a = process.argv.slice(2);
  if (a.includes("--json")) { console.log(JSON.stringify(table(), null, 1)); process.exit(0); }
  let pick = null;
  if (a.includes("--quick")) pick = ITEMS.filter(it => it.quick && !it.check().ok);
  else if (a.includes("--all")) pick = ITEMS.filter(it => it.run);
  else if (a.includes("--run")) { const ids = a.slice(a.indexOf("--run") + 1).filter(x => !x.startsWith("--"));
    const bad = ids.filter(id => !ITEMS.find(it => it.id === id)); if (bad.length) { console.log("unknown: " + bad.join(", ") + "\nids: " + ITEMS.map(i => i.id).join(" ")); process.exit(1); }
    pick = ITEMS.filter(it => ids.includes(it.id)); }
  if (pick) { let fails = 0; for (const it of pick) fails += runItem(it) ? 1 : 0;
    if (!pick.length) console.log("nothing to do: every quick item is here");
    console.log(fails ? `\n${fails} item(s) failed` : "\ndone"); process.exit(fails ? 1 : 0); }
  console.log("local-only data on this computer (never in git). Rebuild one: node tools/rebuild_local.js --run <id>; every quick one: --quick\n");
  for (const r of table()) {
    console.log(`${r.have ? "have" : r.source === "personal" ? "  - " : "MISS"}  ${r.id.padEnd(13)}${r.what}${r.detail ? " [" + r.detail + "]" : ""}`);
    if (!r.have && r.source !== "personal") console.log(`      ${r.rebuild}   ${r.time}${r.quick ? "  (quick)" : ""}${r.heavy ? "  (heavy)" : ""}${r.needs.length ? "  needs " + r.needs.join(", ") : ""}`);
  }
}
module.exports = { ITEMS, table };
