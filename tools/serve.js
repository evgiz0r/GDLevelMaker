// node tools/serve.js [port]  -- serves the repo so the viewer works at http://localhost:8765/viewer/
// (opening viewer/index.html straight from disk also works in a normal browser)
// POST /marks appends one JSON line to local/marks.jsonl (shared by all sessions): the user's notes from the viewer
// ("ground too dark here"), which Claude reads to make the next round. See marks/README.md.
const http = require("http"), fs = require("fs"), path = require("path");
const root = path.join(__dirname, ".."), port = +(process.argv[2] || 8765);
const MARKS = path.join(root, "local", "marks.jsonl");
const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".jsonl": "text/plain", ".gdlvl": "text/plain", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".png": "image/png", ".jpg": "image/jpeg" };
// songs are served straight from the user's game install and save folder (never copied into the repo)
const GAME = process.env.GD_GAME || "C:/Program Files (x86)/Steam/steamapps/common/Geometry Dash";
const SAVE = process.env.GD_SAVE || path.join(process.env.LOCALAPPDATA || "", "GeometryDash");
const RECS = process.env.GD_RECS || path.join(process.env.USERPROFILE || "", "Videos", "Captures"); // tools/record.sh writes here
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (req.method === "POST" && p === "/marks") {
    let body = "";
    req.on("data", c => { body += c; if (body.length > 1e5) req.destroy(); });
    req.on("end", () => {
      try {
        const m = JSON.parse(body);
        if (typeof m !== "object" || !m || !m.id) throw new Error("not a mark");
        fs.mkdirSync(path.dirname(MARKS), { recursive: true });
        // a session testing the mark flow: id "test-..." or test: true -> local/marks.test.jsonl, never shown to the
        // user (a "TEST mark from Claude" pin sat on hellgate in the user's viewer, 2026-11-23)
        const testMark = m.test === true || /^test-/.test(String(m.id));
        fs.appendFileSync(testMark ? MARKS.replace(/\.jsonl$/, ".test.jsonl") : MARKS, JSON.stringify(m) + "\n");
        res.writeHead(200, { "Content-Type": "application/json" }); res.end('{"ok":true}');
      } catch (e) { res.writeHead(400); res.end(String(e.message)); }
    });
    return;
  }
  // POST /shots: a PNG (data URL) from the viewer's "save comparison" -> local/shots/ (never committed:
  // it holds frames of the user's game)
  if (req.method === "POST" && p === "/shots") {
    const chunks = [];
    req.on("data", c => chunks.push(c));
    req.on("end", () => {
      const body = Buffer.concat(chunks).toString(), m = /^data:image\/png;base64,(.+)$/.exec(body);
      if (!m) { res.writeHead(400); return res.end("not a png"); }
      const dir = path.join(root, "local", "shots"); fs.mkdirSync(dir, { recursive: true });
      const name = "cmp " + new Date().toISOString().replace(/[:.]/g, "-") + ".png";
      fs.writeFileSync(path.join(dir, name), Buffer.from(m[1], "base64"));
      res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ file: "local/shots/" + name }));
    });
    return;
  }
  // POST /catalogue/<name>.png: a contact sheet from viewer/catalogue.html -> local/catalogue/ (never
  // committed: it is RobTop's art). POST /catalogue/done marks the run finished (tools/catalogue.js waits).
  const cat = req.method === "POST" && /^\/catalogue\/([\w.\-]+\.(png|json)|done)$/.exec(p);
  if (cat) {
    const chunks = [];
    req.on("data", c => chunks.push(c));
    req.on("end", () => {
      const dir = path.join(root, "local", "catalogue"); fs.mkdirSync(dir, { recursive: true });
      const body = Buffer.concat(chunks).toString(), m = /^data:image\/png;base64,(.+)$/.exec(body);
      if (cat[1] === "done") fs.writeFileSync(path.join(dir, ".done"), body || String(Date.now()));
      else fs.writeFileSync(path.join(dir, cat[1]), m ? Buffer.from(m[1], "base64") : body);
      res.writeHead(200, { "Content-Type": "application/json" }); res.end('{"ok":true}');
    });
    return;
  }
  // tools/shoot.js: GET /shoot/job/<id>.json (local/shoot/), POST /shoot/<id>/<n>.png | done -> local/shoot/<id>/
  const sj = /^\/shoot\/job\/([\w\-]+)\.json$/.exec(p);
  if (sj && req.method === "GET") {
    return fs.readFile(path.join(root, "local", "shoot", sj[1] + ".json"), (e, d) => {
      if (e) { res.writeHead(404); return res.end("no such job"); }
      res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" }); res.end(d);
    });
  }
  const sp = req.method === "POST" && /^\/shoot\/([\w\-]+)\/(\d+\.png|done)$/.exec(p);
  if (sp) {
    const chunks = [];
    req.on("data", c => chunks.push(c));
    req.on("end", () => {
      const dir = path.join(root, "local", "shoot", sp[1]); fs.mkdirSync(dir, { recursive: true });
      const body = Buffer.concat(chunks).toString(), m = /^data:image\/png;base64,(.+)$/.exec(body);
      fs.writeFileSync(path.join(dir, sp[2] === "done" ? ".done" : sp[2]), m ? Buffer.from(m[1], "base64") : body);
      res.writeHead(200, { "Content-Type": "application/json" }); res.end('{"ok":true}');
    });
    return;
  }
  // the user's recordings (never copied anywhere): a list, and one frame at a time via ffmpeg,
  // for the viewer's "compare" panel
  // GET /wip/list: every session's work-in-progress level (local/wip/<session>/, tools/wip.js), with the
  // decoded level and its song, newest first. Read fresh on every request: refresh = latest.
  if (p === "/wip/list") {
    let out = [];
    try {
      const { list } = require("./wip.js"), { readGdlvl } = require("./io.js"), { songOf } = require("./index_levels.js");
      for (const m of list()) {
        try { const L = readGdlvl(path.join(root, "local", "wip", m.session, m.file));
              out.push(Object.assign({}, m, { name: m.name, file: "local/wip/" + m.session + "/" + m.file, level: L.levelStr, song: songOf(L.rec, L.level.header), wip: true })); } catch (e) {}
      }
    } catch (e) {}
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" }); return res.end(JSON.stringify(out));
  }
  // GET /polish/list: the before/after files tools/polish.js wrote (local/polish/*.compare.json), newest first
  if (p === "/polish/list") {
    let files = [];
    try { const d = path.join(root, "local", "polish"); files = fs.readdirSync(d).filter(f => f.endsWith(".compare.json")).sort((a, b) => fs.statSync(path.join(d, b)).mtimeMs - fs.statSync(path.join(d, a)).mtimeMs).map(f => "local/polish/" + f); } catch (e) {}
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" }); return res.end(JSON.stringify(files));
  }
  if (p === "/rec/list") {
    let files = [];
    try { files = fs.readdirSync(RECS).filter(f => /\.(mkv|mp4)$/i.test(f)).sort().reverse(); } catch (e) {}
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" }); return res.end(JSON.stringify(files));
  }
  if (p === "/rec/frame") {
    const q = new URLSearchParams(req.url.split("?")[1] || ""), name = path.basename(q.get("f") || ""), at = Math.max(0, +q.get("t") || 0);
    const file = path.join(RECS, name);
    if (!/\.(mkv|mp4)$/i.test(name) || !fs.existsSync(file)) { res.writeHead(404); return res.end("no such recording"); }
    const ff = require("child_process").spawn("ffmpeg", ["-v", "error", "-ss", String(at), "-i", file, "-frames:v", "1", "-vf", "scale=960:-1", "-f", "image2pipe", "-vcodec", "png", "-"]);
    const out = [];
    ff.stdout.on("data", c => out.push(c));
    ff.on("error", () => { res.writeHead(500); res.end("ffmpeg not found"); });
    ff.on("close", () => { if (res.headersSent) return; if (!out.length) { res.writeHead(404); return res.end("no frame"); } res.writeHead(200, { "Content-Type": "image/png", "Cache-Control": "no-store" }); res.end(Buffer.concat(out)); });
    return;
  }
  // GET /gdres/<file>: GD's own sprite sheets, plists and background images, read straight from the
  // user's install (never copied: RobTop's art stays out of the repo and off any published page).
  // lib/art.js draws the viewer's "GD art" look from them. Icons are under /gdres/icons/<file>.
  const res_ = /^\/gdres\/((?:icons\/)?[\w.\-]+\.(?:png|plist))$/.exec(p);
  if (res_) {
    const f = path.join(GAME, "Resources", res_[1]);
    return fs.readFile(f, (e, data) => {
      if (e) { res.writeHead(404); return res.end("not in the game's Resources"); }
      res.writeHead(200, { "Content-Type": f.endsWith(".png") ? "image/png" : "text/xml", "Cache-Control": "max-age=3600" });
      res.end(data);
    });
  }
  if (p === "/" || p === "/viewer") { res.writeHead(302, { Location: "/viewer/" }); return res.end(); }
  if (p.endsWith("/")) p += "index.html";
  let f = path.join(root, p);
  const song = /^\/song\/(official|custom)\/([A-Za-z0-9]+)\.(mp3|ogg)$/.exec(p);
  // custom songs: the game's save folder, else the shared cache tools/songs.js fills (either extension)
  if (song) f = song[1] === "official" ? path.join(GAME, "Resources", song[2] + "." + song[3]) : (require("./songs.js").songFile(song[2]) || path.join(SAVE, song[2] + "." + song[3]));
  else if (!f.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (e, data) => {
    if (e) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "Content-Type": types[path.extname(f)] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(data);
  });
}).listen(port, () => console.log(`viewer at http://localhost:${port}/viewer/`));
