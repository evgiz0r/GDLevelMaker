// node tools/pages.js [--out _site]  -- the viewer as a PUBLIC site (GitHub Pages; .github/workflows/pages.yml
// builds it on every push to main). PAGES.md: what is on it and what never is.
//
// On it: the viewer and its libraries (lib/), ONLY the levels the user chose for it (knowledge/public_levels.json,
// opt-in per level; empty = none, the page then says "first levels coming soon"; from levels/ and examples/),
// their saved solutions and timing windows, the shapes look. Never on it: anything from local/ (official and
// community levels, songs, recordings, marks, work in progress), GD's sprites or any image, any song file.
// On the user's own PC, with tools/serve.js running, the page fetches songs, GD's art, the beat grids and the
// official levels from http://localhost:8765 (serve.js answers the Pages origin only) -- so there it plays the
// music and can show GD art; for everyone else that fails quietly: shapes look, a song picked from the visitor's
// own device (kept per song in their browser), or the click sound.
// The build refuses (exit 1) when the output would hold a file from local/, an image, audio or a plist, or a
// level that is not ours.
const fs = require("fs"), path = require("path"), cp = require("child_process");
const ROOT = path.join(__dirname, ".."), oi = process.argv.indexOf("--out");
const OUT = path.resolve(oi >= 0 ? process.argv[oi + 1] : path.join(ROOT, "_site"));
// the levels the user said may be public (opt-in, per level)
function publicLevels() { try { return (JSON.parse(fs.readFileSync(path.join(ROOT, "knowledge", "public_levels.json"), "utf8")).levels || []).map(String); } catch (e) { return []; } }
// the refusal check: what in `dir` must never be published (also used by tests/pages_build.js)
function checkDir(dir) {
  const bad = [];
  const walk = d => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else one(p); } };
  function one(p) {
    const rel = path.relative(dir, p).split(path.sep).join("/");
    if (/(^|\/)local\//.test(rel)) bad.push(rel + ": from local/");
    if (/\.(png|jpe?g|gif|webp|plist|mp3|ogg|wav|m4a|flac|mkv|mp4)$/i.test(rel)) bad.push(rel + ": images, sprites, songs and videos are never published");
    if (rel === "levels.js") { const w = {}; new Function("window", fs.readFileSync(p, "utf8"))(w);
      const ok = publicLevels();
      for (const l of w.GD_LEVELS || []) if (!/^(levels|examples)\//.test(String(l.file))) bad.push(`levels.js: ${l.file} is not ours`);
        else if (!ok.includes(String(l.file))) bad.push(`levels.js: ${l.file} is not in knowledge/public_levels.json`); }
  }
  walk(dir);
  return bad;
}
module.exports = { checkDir, publicLevels };
if (require.main === module) {
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(path.join(OUT, "lib"), { recursive: true });
let html = fs.readFileSync(path.join(ROOT, "viewer", "index.html"), "utf8");
const swap = (a, b) => { if (!html.includes(a)) throw new Error("viewer changed, update tools/pages.js: " + a.slice(0, 80)); html = html.split(a).join(b); };
let sha = ""; try { sha = cp.execSync("git rev-parse --short HEAD", { windowsHide: true, cwd: ROOT, encoding: "utf8" }).trim(); } catch (e) {}

// libraries: every ../lib/*.js the viewer loads, copied as they are (facts and code; the art tables name GD's
// sprite frames but hold no art)
const libs = [...html.matchAll(/<script src="\.\.\/lib\/([\w.]+)"><\/script>/g)].map(m => m[1]);
for (const f of libs) fs.copyFileSync(path.join(ROOT, "lib", f), path.join(OUT, "lib", f));
swap('src="../lib/', 'src="lib/');
// the public-site flag (before the viewer's own script) and the build commit
swap('<script src="levels.local.js" onerror="window.GD_LEVELS_LOCAL = []"></script>',
  `<script>window.GD_LEVELS_LOCAL = []; window.GD_PAGES = true; window.GD_BUILD = ${JSON.stringify(sha)};</script>`);
// beat grids: from the PC's server only (they are measured from the songs on that PC)
swap('<script src="../local/beats.local.js" onerror="window.GD_BEATS = {}"></script>', '<script>window.GD_BEATS = {};</script>');
// what needs the PC's own server is hidden here: work in progress, marks, level maps, recordings
swap('<button id="refresh" ', '<button id="refresh" hidden ');
swap('<button id="markBtn" ', '<button id="markBtn" hidden ');
swap('<button id="mapBtn" ', '<button id="mapBtn" hidden ');
swap("<title>", '<meta name="description" content="Geometry Dash levels made by Claude, replayed in the browser">\n<title>');
fs.writeFileSync(path.join(OUT, "index.html"), html);
fs.copyFileSync(path.join(ROOT, "viewer", "windows_worker.js"), path.join(OUT, "windows_worker.js"));
fs.copyFileSync(path.join(ROOT, "viewer", "song_grids.js"), path.join(OUT, "song_grids.js")); // beat grids: numbers only, no audio

// the user's allowlist only (knowledge/public_levels.json); viewer/levels.js lists levels/ and examples/
global.window = {}; require(path.join(ROOT, "viewer", "levels.js"));
const allowed = publicLevels();
const ours = (global.window.GD_LEVELS || []).filter(l => /^(levels|examples)\//.test(String(l.file)) && allowed.includes(String(l.file)));
fs.writeFileSync(path.join(OUT, "levels.js"), "// built by tools/pages.js: our levels (levels/, examples/) only\nwindow.GD_LEVELS = " + JSON.stringify(ours) + ";\n");
fs.writeFileSync(path.join(OUT, ".nojekyll"), "");

const bad = checkDir(OUT);
if (bad.length) { console.error("REFUSED -- the public build would publish:\n  " + bad.join("\n  ")); fs.rmSync(OUT, { recursive: true, force: true }); process.exit(1); }
const size = d => fs.readdirSync(d).reduce((n, f) => { const p = path.join(d, f); return n + (fs.statSync(p).isDirectory() ? size(p) : fs.statSync(p).size); }, 0);
console.log(`public site in ${path.relative(process.cwd(), OUT) || OUT}: ${ours.length} levels, ${libs.length} libs, ${(size(OUT) / 1e6).toFixed(1)} MB, build ${sha || "?"}; checked: nothing from local/, no images, songs or other people's levels`);
}
