// node tools/serve.js [port]  -- serves the repo so the viewer works at http://localhost:8765/viewer/
// (opening viewer/index.html straight from disk also works in a normal browser)
const http = require("http"), fs = require("fs"), path = require("path");
const root = path.join(__dirname, ".."), port = +(process.argv[2] || 8765);
const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".gdlvl": "text/plain", ".mp3": "audio/mpeg", ".ogg": "audio/ogg" };
// songs are served straight from the user's game install and save folder (never copied into the repo)
const GAME = process.env.GD_GAME || "C:/Program Files (x86)/Steam/steamapps/common/Geometry Dash";
const SAVE = process.env.GD_SAVE || path.join(process.env.LOCALAPPDATA || "", "GeometryDash");
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p === "/" || p === "/viewer") { res.writeHead(302, { Location: "/viewer/" }); return res.end(); }
  if (p.endsWith("/")) p += "index.html";
  let f = path.join(root, p);
  const song = /^\/song\/(official|custom)\/([A-Za-z0-9]+)\.(mp3|ogg)$/.exec(p);
  if (song) f = song[1] === "official" ? path.join(GAME, "Resources", song[2] + "." + song[3]) : path.join(SAVE, song[2] + "." + song[3]);
  else if (!f.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (e, data) => {
    if (e) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "Content-Type": types[path.extname(f)] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(data);
  });
}).listen(port, () => console.log(`viewer at http://localhost:${port}/viewer/`));
