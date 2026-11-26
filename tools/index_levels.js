// node tools/index_levels.js  -- packs every levels/*.gdlvl and examples/*.gdlvl into
// viewer/levels.js so viewer/index.html can show them straight from disk (file:// cannot fetch).
const fs = require("fs");
const path = require("path");
const { readGdlvl, GD } = require("./io.js");

// official songs by level number (files in the game's Resources folder)
const OFFICIAL_SONGS = ["StereoMadness", "BackOnTrack", "Polargeist", "DryOut", "BaseAfterBase", "CantLetGo",
  "Jumper", "TimeMachine", "Cycles", "xStep", "Clutterfunk", "TheoryOfEverything", "Electroman", "Clubstep",
  "Electrodynamix", "HexagonForce", "BlastProcessing", "TheoryOfEverything2", "GeometricalDominator",
  "Deadlocked", "Fingerdash", "Dash"];
// kA13 in the level header = where in the song the level starts, in seconds
// The saved route for the viewer: today's (tools/solutions.js), else an older one (solved on earlier
// physics) that still replays to the end on today's physics -- one run, cheap. get() alone drops every
// route after any physics commit, and the page then solves the level itself; when that fails it replays
// "the run that got furthest", which dies (the user, 2026-11-23: "why when I play the cube timings it dies").
function specGrid(name) {
  const dir = path.join(__dirname, "..", "specs");
  for (const f of fs.readdirSync(dir).filter(f => /\.json$/.test(f) && !/\.plan\.json$/.test(f))) {
    let sp; try { sp = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); } catch (e) { continue; }
    if (sp.name === name && sp.grid && sp.grid.bpm && sp.grid.t0 != null)
      return { bpm: sp.grid.bpm, period: 60 / sp.grid.bpm, t0: sp.grid.t0, downbeat: sp.grid.downbeat || 0, conf: "spec", sections: [] };
  }
  return null;
}
function savedRoute(L) {
  const sols = require("./solutions.js"), now = sols.get(L.levelStr);
  if (now) return now;
  const old = sols.get(L.levelStr, true);
  if (!old || !old.ok || !old.events) return null;
  const { GD } = require("./io.js"), q = GD.run(GD.makeWorld(L.level.objects, L.level.header), old.events);
  return (q.done || (q.end && !q.dead)) ? Object.assign({}, old, { stale: true, replayedOn: sols.physicsCommit() }) : null;
}

function offsetOf(header) { const m = /(?:^|,)kA13,([-0-9.]+)/.exec(header || ""); return m ? +m[1] : 0; }
function songOf(rec, header) {
  const custom = GD.getField(rec, "k45");
  if (custom && custom !== "0") return { url: "/song/custom/" + custom + ".mp3", id: +custom, offset: offsetOf(header) };
  const k8 = +(GD.getField(rec, "k8") || 0);
  return { url: "/song/official/" + OFFICIAL_SONGS[k8] + ".mp3", official: k8, offset: offsetOf(header) };
}

function buildIndex() {
  const root = path.join(__dirname, "..");
  const list = [];
  // the routes already in the committed viewer/levels.js: a fresh clone has no local/ solutions, and rebuilding the
  // list (tools/setup.js, make.js) must not drop the replays everyone else gets from git (SETUP.md)
  const prev = {}; try { const w = {}; new Function("window", fs.readFileSync(path.join(root, "viewer", "levels.js"), "utf8"))(w);
    for (const l of w.GD_LEVELS || []) if (l.solution) prev[l.file] = l; } catch (e) {}
  for (const dir of ["levels", "examples"]) {
    const d = path.join(root, dir);
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d).sort()) {
      if (!f.endsWith(".gdlvl")) continue;
      const file = path.join(d, f);
      const L = readGdlvl(file);
      // the saved solution (tools/solutions.js), so the viewer and the phone replay it instead of solving
      // A stale one (solved on older physics) is kept, marked `stale`, when it still replays to the end on
      // today's physics (savedRoute): without any, the page solved the level itself for minutes and looked
      // hung, and replayed a death when its solve failed (the user: "why when I play the cube timings it dies").
      let solution; try { solution = savedRoute(L) || undefined; } catch (e) {}
      const was = prev[dir + "/" + f]; if (!solution && was && was.level === L.levelStr) solution = was.solution;
      // when this level was made: the last commit that changed its file (not mtimes, index rebuilds or re-solves)
      // -- unless the file differs from HEAD (a level being committed: index_levels runs before the commit, so git log
      // gave the PREVIOUS version's time and GDLM 44 v4 showed "made" as v3's, 2026-11-26): then the file's own time
      let made; try { if (require("child_process").execSync(`git status --porcelain -- "${dir}/${f}"`, { windowsHide: true, cwd: root, encoding: "utf8" }).trim()) made = fs.statSync(path.join(root, dir, f)).mtime.toISOString(); } catch (e) {}
      if (!made) try { const ct = +require("child_process").execSync(`git log -1 --format=%ct -- "${dir}/${f}"`, { windowsHide: true, cwd: root, encoding: "utf8" }).trim(); if (ct) made = new Date(ct * 1000).toISOString(); } catch (e) {}
      const song = songOf(L.rec, L.level.header), g = specGrid(L.name);
      // a spec that pins a local beat grid (its "grid": {bpm, t0} in song seconds) -- where the song's whole-song grid
      // drifts (Infertehno 2 for GDLM 44 v3: half a beat off) -- carries it, so the viewer's beat lines follow it
      if (song && g) song.grid = g;
      list.push({ name: L.name, file: dir + "/" + f, level: L.levelStr, song, solution, made });
    }
  }
  const local = [];
  const ld = path.join(root, "local");
  // the player's real deaths (tools/runs.js --level N): % where each normal-mode attempt ended
  const deaths = {}, rd = path.join(ld, "runs");
  if (fs.existsSync(rd)) for (const f of fs.readdirSync(rd)) {
    if (!f.endsWith(".json")) continue;
    const r = JSON.parse(fs.readFileSync(path.join(rd, f), "utf8"));
    if (r.level) for (const a of r.runs) if (a.mode === "normal" && !a.beaten) (deaths[r.level] = deaths[r.level] || []).push(a.pct);
  }
  if (fs.existsSync(ld)) for (const f of fs.readdirSync(ld).sort()) {
    if (!f.endsWith(".json")) continue;
    const o = JSON.parse(fs.readFileSync(path.join(ld, f), "utf8"));
    if (!o || typeof o.level !== "string") continue;   // other sessions' json in the shared local/ (not a level)
    const header = o.level.split(";")[0];
    local.push({ name: "official " + o.n + ": " + o.name + (/_coins\.json$/.test(f) ? " (3 coins route)" : ""), file: "local/" + f, level: o.level, solution: o.solution, deaths: deaths[o.n] || [],
                 song: { url: "/song/official/" + OFFICIAL_SONGS[o.n - 1] + ".mp3", official: o.n - 1, offset: offsetOf(header) } });
  }
  fs.writeFileSync(path.join(root, "viewer", "levels.local.js"),
    "// generated by tools/index_levels.js from local/ -- not committed\nwindow.GD_LEVELS_LOCAL = " + JSON.stringify(local) + ";\n");
  fs.writeFileSync(path.join(root, "viewer", "levels.js"),
    "// generated by tools/index_levels.js -- do not edit\nwindow.GD_LEVELS = " + JSON.stringify(list, null, 1) + ";\n");
  return list;
}

if (require.main === module) console.log(buildIndex().map(l => l.file).join("\n"));
module.exports = { buildIndex, songOf };
