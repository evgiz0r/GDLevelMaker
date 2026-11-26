// const { GAME, LEVELS, SAVE } = require("./gdpaths.js")   -- where Geometry Dash lives on THIS computer.
// node tools/gdpaths.js [--json]   -- prints what was found and how.
//   GAME   the folder that holds GD's Resources/ (Windows/Linux: the Steam "Geometry Dash" folder; macOS: the .app's Contents)
//   LEVELS GAME/Resources/levels/ (RobTop's main levels, 1.txt ... 22.txt), with a trailing slash
//   SAVE   GD's save folder (CCLocalLevels.dat, CCGameManager.dat, downloaded songs)
// Order: the env vars GD_GAME / GD_LEVELS / GD_SAVE, then local/gd_paths.json (written by tools/setup.js), then a search of
// the usual places (Steam's default folders and every Steam library listed in libraryfolders.vdf, Windows / macOS / Linux
// with Proton), then the old Windows default. Every tool reads GD's files through this (SETUP.md), so a new computer
// needs no edits: run `node tools/setup.js` once. Synchronous, no child processes, a few stat calls.
const fs = require("fs"), path = require("path"), os = require("os");
const ROOT = path.join(__dirname, "..");
const SAVED = path.join(ROOT, "local", "gd_paths.json");
const DEFAULT_GAME = "C:/Program Files (x86)/Steam/steamapps/common/Geometry Dash";
const isDir = p => { try { return fs.statSync(p).isDirectory(); } catch (e) { return false; } };
const home = os.homedir();
const LOCALAPPDATA = process.env.LOCALAPPDATA || path.join(home, "AppData", "Local");

// Steam roots to look in, then each root's other libraries (libraryfolders.vdf: "path" "D:\\SteamLibrary")
function steamRoots() {
  const roots = [
    "C:/Program Files (x86)/Steam", "C:/Program Files/Steam", "D:/Steam", "D:/SteamLibrary", "E:/SteamLibrary",
    path.join(home, "Library", "Application Support", "Steam"),                          // macOS
    path.join(home, ".steam", "steam"), path.join(home, ".local", "share", "Steam"),     // Linux
    path.join(home, ".var", "app", "com.valvesoftware.Steam", ".local", "share", "Steam"), // Linux flatpak
  ];
  if (process.env["ProgramFiles(x86)"]) roots.unshift(path.join(process.env["ProgramFiles(x86)"], "Steam"));
  const out = [];
  for (const r of roots) {
    if (!isDir(r)) continue; out.push(r);
    try {
      const vdf = fs.readFileSync(path.join(r, "steamapps", "libraryfolders.vdf"), "utf8");
      for (const m of vdf.matchAll(/"path"\s+"([^"]+)"/g)) out.push(m[1].replace(/\\\\/g, "/"));
    } catch (e) {}
  }
  return [...new Set(out.map(p => path.resolve(p)))];
}
// a game folder is right when Resources/levels/1.txt is in it
const gameOk = g => { try { return fs.statSync(path.join(g, "Resources", "levels", "1.txt")).isFile(); } catch (e) { return false; } };
function findGame() {
  for (const r of steamRoots()) {
    const g = path.join(r, "steamapps", "common", "Geometry Dash");
    for (const c of [g, path.join(g, "Geometry Dash.app", "Contents")]) if (gameOk(c)) return c;
  }
  return null;
}
function findSave() {
  const c = [path.join(LOCALAPPDATA, "GeometryDash"), path.join(home, "Library", "Application Support", "GeometryDash")];
  for (const r of steamRoots()) c.push(path.join(r, "steamapps", "compatdata", "322170", "pfx", "drive_c", "users", "steamuser", "AppData", "Local", "GeometryDash"));
  return c.find(isDir) || null;
}

function resolve() {
  let saved = {}; try { saved = JSON.parse(fs.readFileSync(SAVED, "utf8")); } catch (e) {}
  const from = {};
  let GAME = process.env.GD_GAME; from.GAME = "env GD_GAME";
  if (!GAME && saved.GAME) { GAME = saved.GAME; from.GAME = "local/gd_paths.json"; }
  if (!GAME && isDir(DEFAULT_GAME)) { GAME = DEFAULT_GAME; from.GAME = "default"; }
  if (!GAME) { GAME = findGame(); from.GAME = "search"; }
  if (!GAME) { GAME = DEFAULT_GAME; from.GAME = "not found"; }
  let LEVELS = process.env.GD_LEVELS; from.LEVELS = "env GD_LEVELS";
  if (!LEVELS) { LEVELS = path.join(GAME, "Resources", "levels"); from.LEVELS = "GAME"; }
  LEVELS = LEVELS.replace(/[\\/]+$/, "") + "/";
  let SAVE = process.env.GD_SAVE; from.SAVE = "env GD_SAVE";
  if (!SAVE && saved.SAVE) { SAVE = saved.SAVE; from.SAVE = "local/gd_paths.json"; }
  if (!SAVE) { SAVE = findSave(); from.SAVE = "search"; }
  if (!SAVE) { SAVE = path.join(LOCALAPPDATA, "GeometryDash"); from.SAVE = "not found"; }
  return { GAME, LEVELS, SAVE, from, found: { game: gameOk(GAME), save: isDir(SAVE) } };
}
const R = resolve();
module.exports = { GAME: R.GAME, LEVELS: R.LEVELS, SAVE: R.SAVE, from: R.from, found: R.found, resolve, findGame, findSave, steamRoots, SAVED };

if (require.main === module) {
  if (process.argv.includes("--json")) console.log(JSON.stringify(R, null, 1));
  else for (const k of ["GAME", "LEVELS", "SAVE"]) console.log(`${k.padEnd(6)} ${R[k]}  (${R.from[k]})`);
}
