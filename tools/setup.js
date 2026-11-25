// node tools/setup.js [--game <folder>] [--save <folder>] [--force] [--json]
//   First run on a new computer (SETUP.md). Finds Geometry Dash on this computer, remembers it in local/gd_paths.json
//   (every tool reads it through tools/gdpaths.js), checks what the viewer needs from the game (the 22 main levels,
//   the sprite sheets for "GD art", the main songs, the save folder), loads the main levels with their routes from git
//   (tools/mains_routes.js import: the levels from YOUR game, the press timings from knowledge/mains/routes.json),
//   builds the viewer's level list and prints what works, what does not, and what to run next.
//   Nothing of RobTop's is copied into the repo: it all stays in local/ (gitignored) or is read from the game folder.
//   --game: the folder that holds Resources/ (on macOS the .app's Contents), when it is not found by itself.
//   --force: replace main-level routes already in local/. Exit code 0 when the main levels are ready, 1 otherwise.
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const args = process.argv.slice(2), opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const asJson = args.includes("--json");
const say = s => { if (!asJson) console.log(s); };
const report = { checks: [], ok: true };
const check = (name, ok, detail, fix, needed = true) => {
  report.checks.push({ name, ok, detail, fix: ok ? undefined : fix, needed });
  if (!ok && needed) report.ok = false;
  say(`${ok ? "ok  " : needed ? "FAIL" : "warn"} ${name}${detail ? ": " + detail : ""}${!ok && fix ? "\n     -> " + fix : ""}`);
};

// 1. node
const major = +process.versions.node.split(".")[0];
check("Node.js 18+", major >= 18, "v" + process.versions.node, "install Node.js 18 or newer from nodejs.org");
if (major < 18) finish();

// 2. where GD is: flags, else what gdpaths finds; then remember it
if (opt("--game")) process.env.GD_GAME = path.resolve(opt("--game"));
if (opt("--save")) process.env.GD_SAVE = path.resolve(opt("--save"));
const gp = require("./gdpaths.js");
const levelsOk = n => fs.existsSync(path.join(gp.LEVELS, n + ".txt"));
check("Geometry Dash found", gp.found.game, gp.GAME + " (" + gp.from.GAME + ")",
  "GD must be installed (Steam, GD 2.2). If it is somewhere unusual: node tools/setup.js --game \"<the folder that holds Resources>\"");
check("GD save folder", gp.found.save, gp.SAVE + " (" + gp.from.SAVE + ")",
  "start GD once so it makes its save folder, or pass --save <folder>. Only needed for custom songs and installing levels", false);
if (gp.found.game) {
  fs.mkdirSync(path.join(ROOT, "local"), { recursive: true });
  fs.writeFileSync(gp.SAVED, JSON.stringify({ GAME: gp.GAME, SAVE: gp.found.save ? gp.SAVE : undefined, at: new Date().toISOString() }, null, 1));
  say("     remembered in local/gd_paths.json");
}

// 3. what the viewer reads from the game
const RES = path.join(gp.GAME, "Resources");
const missingLevels = []; for (let n = 1; n <= 22; n++) if (!levelsOk(n)) missingLevels.push(n);
check("main levels 1-22 in the game", gp.found.game && !missingLevels.length, missingLevels.length ? "missing " + missingLevels.join(",") : gp.LEVELS,
  "verify GD's files in Steam (Properties -> Installed Files -> Verify)");
const sheets = ["GJ_GameSheet", "GJ_GameSheet02", "GJ_GameSheet03"].filter(s => !fs.existsSync(path.join(RES, s + "-uhd.png")));
check("sprite sheets for the \"GD art\" look", gp.found.game && !sheets.length, sheets.length ? "missing " + sheets.join(", ") + "-uhd.png" : "ok",
  "set GD's texture quality to High once, or verify the files in Steam; without them the viewer uses its own drawn look", false);
const songs = ["StereoMadness", "BackOnTrack", "Dash"].filter(s => !fs.existsSync(path.join(RES, s + ".mp3")));
check("main level songs", gp.found.game && !songs.length, songs.length ? "missing " + songs.join(", ") : "ok", "verify GD's files in Steam", false);

// 4. the main levels with routes
let rows = [];
if (gp.found.game && !missingLevels.length) {
  say("\nloading the main levels (levels from your game, routes from knowledge/mains/routes.json):");
  rows = require("./mains_routes.js").importRoutes({ force: args.includes("--force"), log: asJson ? () => {} : s => say("  " + s) });
  const ready = rows.filter(r => r.state === "clears" || (r.state === "kept" && r.ok)).length;
  const failing = rows.filter(r => r.state === "fails" || (r.state === "kept" && !r.ok)).map(r => r.n);
  const noRoute = rows.filter(r => r.state === "no route").map(r => r.n);
  report.mains = { ready, failing, noRoute, rows };
  check("main levels playable in the viewer", !failing.length && ready > 0, ready + " of 22 replay to the end",
    "re-solve the ones that die: node tools/mains.js run " + failing.join(" ") + " (5 s to 40 min each, SETUP.md \"Rebuilding local data\")");
  // a level with no route in git (not beaten in our sim yet, e.g. Dash): shown without a replay, not a setup failure
  if (noRoute.length) check("main levels without a route in git", false, noRoute.join(", ") + " (listed without a replay)",
    "not beaten in the sim yet, or routes.json is missing: node tools/difficulty_solve.js all " + noRoute.join(" ") + " (long, see SETUP.md)", false);
} else {
  try { require("./index_levels.js").buildIndex(); } catch (e) {}
}

// 5. our own levels (in git) and the viewer's list
const ours = fs.readdirSync(path.join(ROOT, "levels")).filter(f => f.endsWith(".gdlvl")).length;
check("viewer level list built", fs.existsSync(path.join(ROOT, "viewer", "levels.local.js")), ours + " GDLM levels + " + rows.filter(r => r.state !== "no level file").length + " main levels", "node tools/index_levels.js");

finish();
function finish() {
  if (asJson) { console.log(JSON.stringify(report, null, 1)); process.exit(report.ok ? 0 : 1); }
  say(report.ok ? "\nREADY. Next: node tools/serve.js  then open http://localhost:8765/viewer/ (main levels are under \"official\")."
                : "\nNOT READY: fix the FAIL lines above and run node tools/setup.js again.");
  process.exit(report.ok ? 0 : 1);
}
