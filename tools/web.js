// node tools/web.js  -- builds local/web/: the replay viewer as one folder that works on a phone
// (published as a private claude.ai Artifact, so levels can be watched away from the PC).
// Only the repo's own levels (viewer/levels.js) go in: never levels.local.js (RobTop's official
// levels) and never songs. The beat grids (numbers measured from the songs) do go in, so the
// beat lines show; the music button is hidden, since there is no song to play.
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, ".."), OUT = path.join(ROOT, "local", "web");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, "lib"), { recursive: true });

let html = fs.readFileSync(path.join(ROOT, "viewer", "index.html"), "utf8").replace(/\r\n/g, "\n");
const libs = [...html.matchAll(/<script src="\.\.\/lib\/([\w.]+)"><\/script>/g)].map(m => m[1]);
for (const f of libs) fs.copyFileSync(path.join(ROOT, "lib", f), path.join(OUT, "lib", f));
fs.copyFileSync(path.join(ROOT, "viewer", "levels.js"), path.join(OUT, "levels.js"));
const beats = path.join(ROOT, "viewer", "beats.local.js");
fs.writeFileSync(path.join(OUT, "beats.js"), fs.existsSync(beats) ? fs.readFileSync(beats) : "window.GD_BEATS = {};\n");

const swap = (a, b) => { if (!html.includes(a)) throw new Error("viewer changed, update tools/web.js: " + a); html = html.split(a).join(b); };
// the Artifact page is wrapped in its own doctype/head/body
swap("<!doctype html>\n", ""); swap('<html lang="en">\n', ""); swap("<head>\n", ""); swap("</head>\n", "");
swap("<body>\n", ""); swap("</body>\n", ""); swap("</html>\n", "");
swap('<meta charset="utf-8">\n', ""); swap('<meta name="viewport" content="width=device-width, initial-scale=1">\n', "");
swap("<title>GD Level Viewer</title>", "<title>GDLM Level Replays</title>");
swap('src="../lib/', 'src="lib/');
swap('<script src="levels.local.js" onerror="window.GD_LEVELS_LOCAL = []"></script>', "<script>window.GD_LEVELS_LOCAL = [];</script>");
swap('<script src="beats.local.js" onerror="window.GD_BEATS = {}"></script>', '<script src="beats.js" onerror="window.GD_BEATS = {}"></script>');
swap('<button id="music" class="on">music</button>', "");
swap('document.getElementById("music").onclick', "if (0) document.body.onclick");
swap("if (!info || location.protocol === \"file:\") return;", "if (true) return;");
swap("<label class=\"btn\">open .gdlvl", "<label class=\"btn\" hidden>open .gdlvl");
// phone: bigger touch targets, the header wraps, the canvas keeps a usable height
swap("</style>", `  @media (max-width: 700px) {
    header { padding:8px max(12px, env(safe-area-inset-left, 0px)); gap:6px; }
    header h1 { width:100%; }
    select { flex:1 1 100%; min-width:0; }
    select, button { padding:9px 12px; font-size:15px; }
    canvas#cv { height:min(52vh, 420px); }
    #strip { height:40px; }
    main { padding:12px max(16px, env(safe-area-inset-left, 0px)) 24px; }
    .card { overflow-x:auto; }
  }
</style>`);
html = `<!-- built by tools/web.js from viewer/index.html; do not edit -->\n` + html;
fs.writeFileSync(path.join(OUT, "index.html"), html);
console.log("local/web/: index.html, levels.js, beats.js, lib/" + libs.join(" lib/"));
