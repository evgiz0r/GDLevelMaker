// node tools/board_local.js [port] [--dir <data dir>]   -- the work board as a plain local page, no artifact (the user,
// 2026-11-26: "can you give me non artifact thingy"). Opens at http://localhost:8770/ (default port), or at
// http://localhost:8765/board/ through tools/serve.js, which mounts the same handler.
// The page is board/page.html unchanged; a small shim stands in for the artifact runtime's database: each board document
// (board/state, board/picks, board/played, board/played_2..N, board/latest) is a JSON file in local/board/<name>.json
// (the same shape ArtifactData stores), read with GET /board/db/<name>, polled every 15 s for live updates. The page
// writes only board/picks (PUT /board/db/picks). Local data only (the user's save stats): never commit local/board/.
// A session refreshing the board writes each document here as well as to the artifact (board/README.md "Local board").
const fs = require("fs"), path = require("path"), http = require("http");
const ROOT = path.join(__dirname, "..");
const argv = process.argv.slice(2), di = argv.indexOf("--dir");
let DIR = di >= 0 ? path.resolve(argv[di + 1]) : path.join(ROOT, "local", "board");

// the artifact runtime the page expects (window.claude.use("db" | "user" | "permissions")), backed by /board/db/
const SHIM = `<script>
(function(){
  function snap(d){ return { exists: d != null, data: function(){ return d; }, metadata: { fromCache: false } }; }
  function get(n){ return fetch("db/" + n, { cache: "no-store" }).then(function(r){ return r.status === 404 ? null : r.ok ? r.json() : Promise.reject({ code: "http " + r.status }); }); }
  function doc(p){
    var n = String(p).replace(/^board\\//, "");
    return {
      get: function(){ return get(n).then(snap); },
      onSnapshot: function(ok, bad){
        var last = null, stop = false;
        function poll(){ get(n).then(function(d){ var t = JSON.stringify(d); if (stop || t === last) return; last = t; ok(snap(d)); }, function(e){ if (!stop && bad) bad(e); }); }
        poll(); var iv = setInterval(poll, 15000);
        return function(){ stop = true; clearInterval(iv); };
      },
      set: function(body){ return fetch("db/" + n, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        .then(function(r){ if (!r.ok) return Promise.reject({ code: r.status === 403 ? "invalid_argument" : "http " + r.status }); }); }
    };
  }
  var DB = { doc: doc };
  window.claude = { use: function(k){
    if (k === "db") return Promise.resolve(DB);
    if (k === "user") return Promise.resolve({ can: function(){ return Promise.resolve(true); } });
    return Promise.resolve(null);
  } };
})();
</script>
`;

// handle(req, res, prefix): true when the request was the board's; prefix "/board" under serve.js, "" standalone
function handle(req, res, prefix) {
  prefix = prefix || "";
  const p = decodeURIComponent(req.url.split("?")[0]);
  if (prefix && !(p === prefix || p.startsWith(prefix + "/"))) return false;
  const rest = p.slice(prefix.length) || "/";
  if (rest === "/" || rest === "/index.html") {
    if (prefix && p === prefix) { res.writeHead(302, { Location: prefix + "/" }); res.end(); return true; }
    let html = fs.readFileSync(path.join(ROOT, "board", "page.html"), "utf8");
    html = html.replace("<script>", SHIM + "<script>").replace("<title>GD Work Board</title>", "<title>GD Work Board (local)</title>");
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    res.end(html); return true;
  }
  // pictures the board shows (the ending sign's shots, tools/sign_board.js): local/board/img/<name>.png|jpg|gif
  const im = rest.match(/^\/img\/([\w.-]{1,80}\.(png|jpg|gif))$/);
  if (im && req.method === "GET") {
    const f = path.join(DIR, "img", im[1]);
    if (!fs.existsSync(f)) { res.writeHead(404); res.end("no " + im[1]); return true; }
    res.writeHead(200, { "Content-Type": im[2] === "png" ? "image/png" : im[2] === "gif" ? "image/gif" : "image/jpeg", "Cache-Control": "no-store" });
    res.end(fs.readFileSync(f)); return true;
  }
  const m = rest.match(/^\/db\/([\w-]{1,40})$/);
  if (!m) { if (!prefix) { res.writeHead(404); res.end("not found"); return true; } return false; }
  const f = path.join(DIR, m[1] + ".json");
  if (req.method === "GET") {
    if (!fs.existsSync(f)) { res.writeHead(404); res.end("no " + m[1]); return true; }
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    res.end(fs.readFileSync(f)); return true;
  }
  if (req.method === "PUT") {
    if (m[1] !== "picks") { res.writeHead(403); res.end("the page writes only picks"); return true; }
    let body = ""; req.on("data", c => { body += c; if (body.length > 1e6) req.destroy(); });
    req.on("end", () => {
      try { const j = JSON.parse(body); fs.mkdirSync(DIR, { recursive: true });
        fs.writeFileSync(f + ".tmp", JSON.stringify(j, null, 1)); fs.renameSync(f + ".tmp", f);
        res.writeHead(204); res.end(); }
      catch (e) { res.writeHead(400); res.end("bad json"); }
    });
    return true;
  }
  res.writeHead(405); res.end(); return true;
}
module.exports = { handle, SHIM, get DIR() { return DIR; } };

if (require.main === module) {
  const port = +(argv.find(a => /^\d+$/.test(a)) || 8770);
  http.createServer((req, res) => {
    const ra = String(req.socket.remoteAddress || "").replace(/^::ffff:/, "");
    if (!/^(127\.|::1$)/.test(ra)) { res.writeHead(403); return res.end("this PC only"); }   // the user's save stats: never off the PC
    try { handle(req, res, ""); } catch (e) { res.writeHead(500); res.end(String(e.message)); }
  }).listen(port, "127.0.0.1", () => console.log(`work board: http://localhost:${port}/  (data: ${DIR})`));
}
