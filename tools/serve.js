// node tools/serve.js [port]  -- serves the repo so the viewer works at http://localhost:8765/viewer/
// (opening viewer/index.html straight from disk also works in a normal browser)
// POST /marks appends one JSON line to local/marks.jsonl (shared by all sessions): the user's notes from the viewer
// ("ground too dark here"), which Claude reads to make the next round. See marks/README.md.
// Keeps its own checkout current (the user reloaded and did not get the latest, 2026-11-23): every 60 s, and on a
// page load when the last check is older, `git fetch` + `git merge --ff-only origin/main` -- only on branch main,
// only when the tree is clean apart from the generated viewer/levels.js (restored first), never forced; local
// commits or changes: skipped and logged. When serve.js itself changed, it restarts itself. --no-update: off.
// GET /version: {commit, subject, checked, note} -- the page footer shows it.
const http = require("http"), fs = require("fs"), path = require("path");
const root = path.join(__dirname, ".."), port = +(process.argv[2] || 8765);
const MARKS = path.join(root, "local", "marks.jsonl");
const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".jsonl": "text/plain", ".gdlvl": "text/plain", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".png": "image/png", ".jpg": "image/jpeg" };
// songs are served straight from the user's game install and save folder (never copied into the repo)
const GAME = process.env.GD_GAME || "C:/Program Files (x86)/Steam/steamapps/common/Geometry Dash";
const SAVE = process.env.GD_SAVE || path.join(process.env.LOCALAPPDATA || "", "GeometryDash");
const RECS = process.env.GD_RECS || path.join(process.env.USERPROFILE || "", "Videos", "Captures"); // tools/record.sh writes here
const cp = require("child_process");
const git = args => cp.execFileSync("git", args, { windowsHide: true, cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const UPD = { checked: 0, note: "", busy: false, off: process.argv.includes("--no-update") };
function selfUpdate() {
  if (UPD.off || UPD.busy) return; UPD.busy = true; UPD.checked = Date.now();
  try {
    if (git(["rev-parse", "--abbrev-ref", "HEAD"]) !== "main") { UPD.note = "not on main: no self-update"; return; }
    let dirty = git(["status", "--porcelain", "--untracked-files=no"]).split("\n").filter(Boolean);
    if (dirty.length === 1 && / viewer\/levels\.js$/.test(dirty[0])) { git(["checkout", "--", "viewer/levels.js"]); dirty = []; } // generated: restore
    if (dirty.length) { UPD.note = "local changes (" + dirty.length + "): skipped"; console.log("self-update skipped: local changes " + dirty.join(", ")); return; }
    git(["fetch", "-q", "origin", "main"]);
    const ahead = +git(["rev-list", "--count", "origin/main..HEAD"]), behind = +git(["rev-list", "--count", "HEAD..origin/main"]);
    if (ahead) { UPD.note = ahead + " local commit(s) not on origin: skipped"; console.log("self-update skipped: " + UPD.note); return; }
    if (!behind) { UPD.note = "up to date"; return; }
    const before = git(["rev-parse", "HEAD"]);
    git(["merge", "-q", "--ff-only", "origin/main"]);
    UPD.note = "updated " + behind + " commit(s)"; console.log(`self-update: ${before.slice(0, 7)} -> ${git(["rev-parse", "--short", "HEAD"])} (${behind} commits)`);
    // this file changed: start the new code (same arguments), then leave
    if (git(["diff", "--name-only", before, "HEAD", "--", "tools/serve.js", "tools/wip.js", "tools/index_levels.js", "tools/solutions.js"])) {
      console.log("self-update: serve.js or what it loads changed -- restarting");
      // start the new one at once (it retries the port while this one lets go), drop open keep-alive connections
      // and leave. (The first version started the new one only after close() -- which waits for every open
      // browser connection -- and its 3 s exit came first: the server just stopped, 2026-11-23.)
      SERVER.close(); if (SERVER.closeAllConnections) SERVER.closeAllConnections();
      cp.spawn(process.execPath, process.argv.slice(1), { windowsHide: true, cwd: process.cwd(), detached: true, stdio: "ignore", env: Object.assign({}, process.env, { GDLM_RESTART: "1" }) }).unref();
      setTimeout(() => process.exit(0), 500).unref();
    }
  } catch (e) { UPD.note = "self-update failed: " + String(e.message).split("\n")[0]; console.log(UPD.note); }
  finally { UPD.busy = false; }
}
if (!UPD.off) { setTimeout(selfUpdate, 2000); setInterval(selfUpdate, 60e3).unref(); }
// variants without a saved solution: solved one at a time in a child process (tools/solutions.js waits for the heavy
// lock and saves to the shared cache, where /wip/variants finds it next time)
// level maps asked for by the viewer: made one at a time (tools/levelmap.js claims the heavy lock itself)
const MAPS = { queue: [], seen: new Set(), running: false };
function mapNext() {
  const job = MAPS.queue.shift(); if (!job) { MAPS.running = false; return; }
  MAPS.running = true; console.log("making the map of " + job[0]);
  const ch = cp.spawn(process.execPath, [path.join(__dirname, "levelmap.js"), job[0], "--name", job[1]], { cwd: root, stdio: "ignore", windowsHide: true, env: Object.assign({}, process.env, { GDLM_HEAVY_PRIORITY: "high" }) });
  ch.on("exit", () => { MAPS.seen.delete(job[0]); mapNext(); }); ch.on("error", () => { MAPS.seen.delete(job[0]); mapNext(); });
}
const SOLVE = { queue: [], seen: new Set(), running: false, high: new Set() };
function solveLater(file) {
  if (SOLVE.seen.has(file)) return; SOLVE.seen.add(file); SOLVE.queue.push(file);
  if (!SOLVE.running) solveNext();
}
function solveNext() {
  const f = SOLVE.queue.shift(); if (!f) { SOLVE.running = false; return; }
  SOLVE.running = true; console.log("solving variant " + path.relative(root, f));
  const env = Object.assign({}, process.env, { GDLM_HEAVY_PRIORITY: SOLVE.high.has(f) ? "high" : "normal" });   // the user asked: high
  const ch = cp.spawn(process.execPath, [path.join(__dirname, "solutions.js"), f], { windowsHide: true, cwd: root, stdio: "ignore", env });
  ch.on("exit", () => solveNext()); ch.on("error", () => solveNext());
}
// The public viewer (GitHub Pages, tools/pages.js) may READ songs, GD's art and /version from this server on the
// user's own PC -- so there it plays music and can show GD art, while nothing copyrighted is hosted. Only that
// origin, only those GET paths (Chrome's Private Network Access preflight answered); it may write nothing here.
const PAGES_ORIGINS = ["https://evgiz0r.github.io"];
const SERVER = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  const origin = req.headers.origin;
  if (origin && PAGES_ORIGINS.includes(origin)) {
    const readable = /^\/(version$|song\/|gdres\/)/.test(p);
    if (req.method === "OPTIONS") { res.writeHead(readable ? 204 : 403, readable ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "GET", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Private-Network": "true", "Vary": "Origin" } : {}); return res.end(); }
    if (req.method !== "GET" || !readable) { res.writeHead(403); return res.end("not for the public page"); }
    res.setHeader("Access-Control-Allow-Origin", origin); res.setHeader("Access-Control-Allow-Private-Network", "true"); res.setHeader("Vary", "Origin");
  }
  if (p === "/viewer/" && Date.now() - UPD.checked > 60e3) selfUpdate();   // a page load after a quiet spell
  if (p === "/version") {
    let v = {}; try { v = { commit: git(["rev-parse", "--short", "HEAD"]), subject: git(["log", "-1", "--format=%s"]).slice(0, 80), at: git(["log", "-1", "--format=%cI"]) }; } catch (e) {}
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    return res.end(JSON.stringify(Object.assign(v, { checked: UPD.checked ? new Date(UPD.checked).toISOString() : null, note: UPD.off ? "self-update off" : UPD.note })));
  }
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
  // POST /perf/<id>: a speed run's numbers from the viewer's ?perf= mode (tools/perf.js) -> local/perf/<id>.json
  const perfM = req.method === "POST" && /^\/perf\/([\w-]+)$/.exec(p);
  if (perfM) {
    let body = ""; req.on("data", c => { body += c; if (body.length > 1e6) req.destroy(); });
    req.on("end", () => { const d = path.join(root, "local", "perf"); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, perfM[1] + ".json"), body); res.writeHead(200); res.end("ok"); });
    return;
  }
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
  // GET /wip/variants?file=local/wip/<session>/<level>.gdlvl: the section variants style's compose saved beside it
  // (<level>.variants/index.json: sections {id, name, from, to, variants {key, file, scores, note, solution?}}),
  // each with its level string and its solution when the shared cache has it. A variant with none is solved here
  // in the background, one at a time (tools/solutions.js, heavy lock): the page shows it as "solving" and asks
  // again. VIEWER.md / the viewer's variants bar; the user's pick goes to marks as type "variant-pick".
  if (p === "/wip/variants") {
    const q = new URL(req.url, "http://x").searchParams.get("file") || "";
    if (!/^local\/wip\/[\w-]+\/[\w.-]+\.gdlvl$/.test(q)) { res.writeHead(400); return res.end("bad file"); }
    const dir = path.join(root, q.replace(/\.gdlvl$/, ".variants"));
    let out = { sections: [] };
    try {
      const idx = JSON.parse(fs.readFileSync(path.join(dir, "index.json"), "utf8")), { readGdlvl } = require("./io.js"), S = require("./solutions.js");
      out = Object.assign({}, idx, { sections: (idx.sections || []).map(sec => Object.assign({}, sec, { variants: (sec.variants || []).map(v => {
        const f = path.join(dir, path.basename(String(v.file || "")));
        try { const L = readGdlvl(f), sol = v.solution || S.get(L.levelStr) || null;
          if (!sol) solveLater(f);
          return Object.assign({}, v, { level: L.levelStr, solution: sol, solving: !sol });
        } catch (e) { return Object.assign({}, v, { missing: true }); }
      }) })) });
    } catch (e) {}
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" }); return res.end(JSON.stringify(out));
  }
  // GET /wip/stages?file=local/wip/<session>/<base>.gdlvl: a build's stages (tools/stages.js): each with its level
  // string (the song stage: an empty level), its data and its saved solution when the shared cache has one
  if (p === "/wip/stages") {
    const q = new URL(req.url, "http://x").searchParams.get("file") || "";
    if (!/^local\/wip\/[\w-]+\/[\w.-]+\.gdlvl$/.test(q)) { res.writeHead(400); return res.end("bad file"); }
    let out = { stages: [] };
    try {
      const dir = process.env.GDLM_WIP_DIR ? path.join(process.env.GDLM_WIP_DIR, q.replace(/^local\/wip\//, "").replace(/\.gdlvl$/, ".stages")) : path.join(root, q.replace(/\.gdlvl$/, ".stages")), idx = JSON.parse(fs.readFileSync(path.join(dir, "index.json"), "utf8"));
      const { readGdlvl } = require("./io.js"), S = require("./solutions.js"), GDL = require("../lib/gd.js");
      out = Object.assign({}, idx, { stages: idx.stages.map(st => {
        let level = null, solution = null, file = null;
        if (st.file) try { const abs = path.join(dir, path.basename(st.file)); file = path.relative(root, abs).split(path.sep).join("/"); level = readGdlvl(abs).levelStr; solution = S.get(level) || null; } catch (e) {}
        if (!level) { level = String(GDL.DEFAULT_HEADER).replace(/;?$/, ";"); solution = { ok: true, events: [] }; }   // the song stage: an empty level
        return Object.assign({}, st, { level, solution, file });
      }) });
    } catch (e) {}
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" }); return res.end(JSON.stringify(out));
  }
  // GET /heavy/status?match=<text>: the heavy-job queue (tools/heavy.js) for the viewer's task modal and chip: who
  // runs, who waits in order, and for the job whose command line holds `match`: its place and a rough ETA (minutes)
  if (p === "/heavy/status") {
    const match = new URL(req.url, "http://x").searchParams.get("match") || "";
    let out = { holders: [], waiting: [], mine: null };
    try {
      const H = require("./heavy.js"), now = Date.now(), short = c => (/tools[\\/].*/.exec(c) || [c])[0];
      const hs = H.holders(), ws = H.waiters().sort((a, b) => H.RANK[a.prio] - H.RANK[b.prio] || String(a.since).localeCompare(String(b.since)));
      const typical = c => H.minutesLeft({ cmd: c, start: new Date(now).toISOString() }) || 2;
      out.holders = hs.map(h => ({ cmd: short(h.cmd), session: h.session, min: Math.round((now - Date.parse(h.start)) / 60000), left: H.minutesLeft(h) }));
      out.waiting = ws.map(w => ({ cmd: short(w.cmd), session: w.session, prio: w.prio }));
      const mh = match && hs.find(h => h.cmd.includes(match)), wi = match ? ws.findIndex(w => w.cmd.includes(match)) : -1;
      if (mh) out.mine = { running: true, min: Math.round((now - Date.parse(mh.start)) / 60000), eta: H.minutesLeft(mh) || 1 };
      else if (wi >= 0) out.mine = { running: false, ahead: wi + hs.length, eta: Math.round(hs.reduce((n, h) => n + (H.minutesLeft(h) || 2), 0) + ws.slice(0, wi).reduce((n, w) => n + typical(w.cmd), 0) + typical(ws[wi].cmd)) };
      out.free = H.freeMB ? Math.round(H.freeMB()) : null;
    } catch (e) { out.error = e.message; }
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" }); return res.end(JSON.stringify(out));
  }
  // POST /solve {file}: solve a level that has no saved route on the PC (tools/solutions.js, heavy lock, HIGH priority:
  // the user asked for it now) instead of in the page (which froze for minutes); GET /solution?file= returns it once saved
  if (req.method === "POST" && p === "/solve") {
    let body = ""; req.on("data", c => { body += c; if (body.length > 1e4) req.destroy(); });
    req.on("end", () => {
      let j = {}; try { j = JSON.parse(body); } catch (e) {}
      const file = String(j.file || "");
      if (!/^(levels|examples|local\/wip\/[\w-]+(?:\/[\w.-]+\.stages)?|local)\/[\w.-]+\.(gdlvl|json)$/.test(file) || !fs.existsSync(path.join(root, file))) { res.writeHead(400); return res.end("bad level"); }
      const abs = path.join(root, file); SOLVE.high.add(abs);
      if (!SOLVE.seen.has(abs)) { SOLVE.seen.add(abs); SOLVE.queue.unshift(abs); if (!SOLVE.running) solveNext(); }
      res.writeHead(200, { "Content-Type": "application/json" }); res.end('{"queued":true}');
    });
    return;
  }
  if (p === "/solution") {
    const file = new URL(req.url, "http://x").searchParams.get("file") || "";
    let sol = null;
    try { if (/^(levels|examples|local\/wip\/[\w-]+(?:\/[\w.-]+\.stages)?|local)\/[\w.-]+\.gdlvl$/.test(file)) { const { readGdlvl } = require("./io.js"); sol = require("./solutions.js").get(readGdlvl(path.join(root, file)).levelStr) || null; } } catch (e) {}
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" }); return res.end(JSON.stringify({ solution: sol }));
  }
  // POST /maps/make {file, name}: the viewer's "level map" for a level that has none yet -> tools/levelmap.js
  // <file> --name <name> (local/maps/<name>.jpg, the name the viewer asks for), one at a time, under the heavy lock
  // at normal priority; answers {queued, ahead}. Only levels of this repo / local/ (no paths out).
  if (req.method === "POST" && p === "/maps/make") {
    let body = ""; req.on("data", c => { body += c; if (body.length > 1e4) req.destroy(); });
    req.on("end", () => {
      let j = {}; try { j = JSON.parse(body); } catch (e) {}
      const file = String(j.file || ""), name = String(j.name || "").replace(/[^\w\- ]+/g, "");
      if (!/^(levels|examples|local\/wip\/[\w-]+|local)\/[\w.-]+\.(gdlvl|json)$/.test(file) || !name || !fs.existsSync(path.join(root, file))) { res.writeHead(400); return res.end("bad level"); }
      const ahead = MAPS.queue.length + (MAPS.running ? 1 : 0);
      if (!MAPS.seen.has(file)) { MAPS.seen.add(file); MAPS.queue.push([file, name]); if (!MAPS.running) mapNext(); }
      res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ queued: true, ahead }));
    });
    return;
  }
  if (p === "/wip/list") {
    let out = [];
    try {
      const { list } = require("./wip.js"), { readGdlvl } = require("./io.js"), { songOf } = require("./index_levels.js");
      for (const m of list()) {
        try { const L = readGdlvl(path.join(root, "local", "wip", m.session, m.file));
              // the timing windows measured later (tools/solutions.js cache) for the same inputs: the viewer shows them at once
              let solution = m.solution;
              try { const c = require("./solutions.js").get(L.levelStr, true);
                if (solution && !solution.windows && c && c.windows && JSON.stringify(c.events) === JSON.stringify(solution.events)) solution = Object.assign({}, solution, { windows: c.windows, win: c.win }); } catch (e) {}
              out.push(Object.assign({}, m, { name: m.name, file: "local/wip/" + m.session + "/" + m.file, level: L.levelStr, song: songOf(L.rec, L.level.header), wip: true, solution })); } catch (e) {}
      }
      // build stages (tools/stages.js): the stage each build has reached; a build with stages but no wip level yet
      // is listed too, as its latest stage (the song stage alone: an empty level with the song)
      const ST = require("./stages.js"), GDL = require("../lib/gd.js");
      for (const b of ST.list()) {
        const last = b.index.stages[b.index.stages.length - 1]; if (!last) continue;
        const file = "local/wip/" + b.session + "/" + b.base + ".gdlvl", have = out.find(o => o.file === file);
        if (have) { have.stage = last.stage; continue; }
        const withLevel = b.index.stages.filter(s => s.file).pop(), songSt = b.index.stages.find(s => s.stage === "song");
        let level = String(GDL.DEFAULT_HEADER).replace(/;?$/, ";"), solution = { ok: true, events: [] };
        if (withLevel) try { level = readGdlvl(path.join(b.dir, withLevel.file)).levelStr; solution = require("./solutions.js").get(level) || undefined; } catch (e) {}
        out.push({ name: b.index.name, session: b.session, file, wip: true, stagesOnly: true, stage: last.stage, level, solution,
          song: songSt && songSt.data && songSt.data.song || undefined, version: 0, note: "building: " + b.index.stages.map(s => s.stage).join(" > "),
          made: b.index.stages[0].at, updated: last.at });
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
    const ff = require("child_process").spawn("ffmpeg", ["-v", "error", "-ss", String(at), "-i", file, "-frames:v", "1", "-vf", "scale=960:-1", "-f", "image2pipe", "-vcodec", "png", "-"], { windowsHide: true });
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
  // the beat grids live in the shared local/ (tools/beats.js); an older viewer page asks for viewer/beats.local.js
  if (p === "/viewer/beats.local.js") p = "/local/beats.local.js";
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
});
// a restarted server (self-update) retries the port for 20 s while the old process lets go of it
let listenTries = 0;
SERVER.on("error", e => {
  if (e.code === "EADDRINUSE" && process.env.GDLM_RESTART && ++listenTries < 40) return setTimeout(() => SERVER.listen(port), 500);
  console.error(e.message); process.exit(1);
});
SERVER.listen(port, () => console.log(`viewer at http://localhost:${port}/viewer/`));
