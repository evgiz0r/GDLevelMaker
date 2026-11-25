// node tools/draw_web.js [--out <dir>]  -- builds the whiteboard (viewer/draw.html, DRAW.md) as one folder for the user's
// private claude.ai Artifact (the phone): the page with its libs next to it ("lib/..."), the worker, the committed beat
// grids (viewer/draw_songs.js) plus, on the PC, every grid in local/beats.local.js (numbers measured from songs; never the
// songs: on the phone "♪ -> pick the mp3"). Publish the folder's draw.html with its files and capabilities {db: {}, user: {}}
// (the sketches sync to the collection "sketches", which sessions read with ArtifactData); link in local/phone/draw_url.txt.
// Default out: local/draw_web/ (use a folder in the session's own directories when publishing from a worktree).
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, ".."), oi = process.argv.indexOf("--out");
const OUT = oi > 0 ? path.resolve(process.argv[oi + 1]) : path.join(ROOT, "local", "draw_web");
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(path.join(OUT, "lib"), { recursive: true });
let html = fs.readFileSync(path.join(ROOT, "viewer", "draw.html"), "utf8").replace(/\r\n/g, "\n");
const libs = [...html.matchAll(/<script src="\.\.\/lib\/([\w.]+)"><\/script>/g)].map(m => m[1]);
for (const f of libs) fs.copyFileSync(path.join(ROOT, "lib", f), path.join(OUT, "lib", f));
fs.copyFileSync(path.join(ROOT, "viewer", "draw_worker.js"), path.join(OUT, "draw_worker.js"));
fs.copyFileSync(path.join(ROOT, "viewer", "draw_songs.js"), path.join(OUT, "draw_songs.js"));
fs.copyFileSync(path.join(ROOT, "viewer", "song_grids.js"), path.join(OUT, "song_grids.js"));
fs.copyFileSync(path.join(ROOT, "viewer", "bricks.js"), path.join(OUT, "bricks.js"));
const BM = path.join(ROOT, "local", "bricks_main.js"); if (fs.existsSync(BM)) fs.copyFileSync(BM, path.join(OUT, "bricks_main.js"));   // private page only   // the ✨ pen's brick set (our levels only), loaded on first use // every measured song's grid, committed numbers
const beats = path.join(ROOT, "local", "beats.local.js");
fs.writeFileSync(path.join(OUT, "beats.js"), fs.existsSync(beats) ? fs.readFileSync(beats) : "window.GD_BEATS = {};\n");
const swap = (a, b) => { if (!html.includes(a)) throw new Error("draw.html changed, update tools/draw_web.js: " + a); html = html.split(a).join(b); };
// the Artifact wraps the page in its own doctype / head / body
swap("<!doctype html>\n", ""); swap('<html lang="en">\n', ""); swap("<head>\n", ""); swap("</head>\n", ""); swap("<body>\n", ""); swap("</body>\n", ""); swap("</html>\n", "");
swap('<meta charset="utf-8">\n', ""); swap('<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">\n', "");
swap('src="../lib/', 'src="lib/');
swap('<script src="../local/beats.local.js" onerror="window.GD_BEATS = {}"></script>', '<script src="beats.js"></script>');
fs.writeFileSync(path.join(OUT, "draw.html"), html);
console.log(`built ${path.relative(process.cwd(), OUT) || OUT}: draw.html + ${libs.length} libs + worker + beat grids`);
console.log("files: " + JSON.stringify(Object.fromEntries(["draw_worker.js", "draw_songs.js", "song_grids.js", "bricks.js", "beats.js"].concat(fs.existsSync(path.join(OUT, "bricks_main.js")) ? ["bricks_main.js"] : []).concat(libs.map(f => "lib/" + f)).map(f => [f, path.join(OUT, f)]))));
