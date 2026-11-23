// node tools/web.js [--out <dir>]  -- builds the phone page (default local/web/): the replay viewer
// as one folder, published as the user's private claude.ai Artifact (PHONE.md has the link file,
// the publish call and the live data). Publish from a folder inside the session's own directories:
// local/ is a link in worktrees, which the Artifact tool refuses, so pass --out <scratchpad>/web.
// Only the repo's own levels (viewer/levels.js) go in: never levels.local.js (RobTop's official
// levels) and never songs ("add song" plays a file from the phone). The beat grids (numbers
// measured from the songs) do go in, so the beat lines show.
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, ".."), oi = process.argv.indexOf("--out");
const OUT = oi > 0 ? path.resolve(process.argv[oi + 1]) : path.join(ROOT, "local", "web");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, "lib"), { recursive: true });

let html = fs.readFileSync(path.join(ROOT, "viewer", "index.html"), "utf8").replace(/\r\n/g, "\n");
const libs = [...html.matchAll(/<script src="\.\.\/lib\/([\w.]+)"><\/script>/g)].map(m => m[1])
  .filter(f => !/^(art|objects_art|objects_frames)\.js$/.test(f)); // never the GD-art libs (page, worker, publish list)
for (const f of libs) fs.copyFileSync(path.join(ROOT, "lib", f), path.join(OUT, "lib", f));
fs.copyFileSync(path.join(ROOT, "viewer", "levels.js"), path.join(OUT, "levels.js"));
const beats = path.join(ROOT, "local", "beats.local.js"); // tools/beats.js (run it, or --index, when this is missing)
fs.writeFileSync(path.join(OUT, "beats.js"), fs.existsSync(beats) ? fs.readFileSync(beats) : "window.GD_BEATS = {};\n");

const swap = (a, b) => { if (!html.includes(a)) throw new Error("viewer changed, update tools/web.js: " + a); html = html.split(a).join(b); };
// the Artifact page is wrapped in its own doctype/head/body
swap("<!doctype html>\n", ""); swap('<html lang="en">\n', ""); swap("<head>\n", ""); swap("</head>\n", "");
swap("<body>\n", ""); swap("</body>\n", ""); swap("</html>\n", "");
swap('<meta charset="utf-8">\n', ""); swap('<meta name="viewport" content="width=device-width, initial-scale=1">\n', "");
swap("<title>GD Level Viewer</title>", "<title>GDLM Level Replays</title>");
swap('src="../lib/', 'src="lib/');
swap('<script src="levels.local.js" onerror="window.GD_LEVELS_LOCAL = []"></script>', "<script>window.GD_LEVELS_LOCAL = [];</script>");
// no GD art on the published page: RobTop's sprites never leave the user's PC (VISUALS.md "Phone")
// Level maps: only the art-free shape drawings (tools/levelmap.js <level> --shapes ->
// local/maps/<name>_shapes.jpg) of our own levels (gdlm_*) go out; the GD-art maps and official
// levels never do (VISUALS.md "Level map"). The button shows only for levels that have one and
// opens it over the page (a new tab may be blocked inside the Artifact frame).
const MAPS = path.join(ROOT, "local", "maps"), maps = [];
if (fs.existsSync(MAPS)) for (const f of fs.readdirSync(MAPS)) { const m = /^(gdlm_[\w-]+)_shapes\.jpg$/.exec(f); if (m) maps.push(m[1]); }
if (maps.length) fs.mkdirSync(path.join(OUT, "maps"), { recursive: true });
for (const m of maps) fs.copyFileSync(path.join(MAPS, m + "_shapes.jpg"), path.join(OUT, "maps", m + "_shapes.jpg"));
swap('<button id="mapBtn" title="the whole level as one picture with its path (make it with node tools/levelmap.js <level>)">level map</button>\n',
  maps.length ? '<button id="mapBtn" title="the whole level as one picture with its path">level map</button>\n' : "");
swap('  let ok = false; try { ok = (await fetch(url, { method: "HEAD", cache: "no-store" })).ok; } catch (e) {}\n' +
  '  if (ok) showMap(url); else makeMap(l, name, url);',
  '  if (!GD_MAPS.includes(name)) { notice("No map of " + esc(name) + " on this page yet."); return; }\n  showMap("maps/" + name + "_shapes.jpg");');
swap("const artOn = () =>", `const GD_MAPS = ${JSON.stringify(maps)};
function mapName() { const l = ALL[pick.value]; return l ? String(l.file || "").split("/").pop().replace(/\\.(gdlvl|json)$/, "") : ""; }
function mapBtnShow() { const b = document.getElementById("mapBtn"); if (b) b.style.display = GD_MAPS.includes(mapName()) ? "" : "none"; }
pick.addEventListener("change", mapBtnShow); setTimeout(mapBtnShow, 0);
const artOn = () =>`);
swap('<script src="lib/objects_art.js"></script>\n<script src="lib/objects_frames.js"></script>\n<script src="lib/art.js"></script>\n', "<script>window.GD_PHONE = true;</script>\n");
swap('<script src="../local/beats.local.js" onerror="window.GD_BEATS = {}"></script>', '<script src="beats.js" onerror="window.GD_BEATS = {}"></script>');
// Songs: none are published. The viewer picks mp3s from their own device ("add song"); they are
// decoded with Web Audio (no media URLs, which the Artifact frame may refuse) and kept in this
// browser's IndexedDB so each song is picked once. A file named like the game's own copy
// (StereoMadness.mp3, 343707.mp3) goes to every level on that song; any other name goes to the
// level on screen.
swap('<button id="music" class="on">music</button>',
  // The input lies over the button, invisible but real: the user's tap lands on the input itself
  // (no hidden input clicked from code, no capture attribute), which phone WebViews need.
  '<button id="music" class="on">music</button><label class="btn" id="addSong" style="position:relative;overflow:hidden">add song<input id="songFile" type="file" accept="audio/*,.mp3,.ogg,.m4a,.wav" multiple style="position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer;font-size:40px"></label>' +
  '<div id="songMsg" style="display:none;flex:1 0 100%;order:99;box-sizing:border-box;margin:2px 0;padding:8px 10px;border:1px solid #6b5bd0;border-radius:6px;background:#1b1240;font-size:13px;line-height:1.4"></div>');
swap("  if (!info) { songAsk(false); return; }\n  if (location.protocol === \"file:\") return; // songs come from tools/serve.js", "  if (!info) return; updateSongBtn();");
// the viewer's own "add song" (the public site's) is not used here: the phone page has its own, below
swap('<label class="btn" id="addSongPc" hidden>add song<input id="songFilePc" type="file" accept="audio/*,.mp3,.ogg,.m4a,.wav" hidden></label>', "");
swap("song = viewerSong(info);", "song = songPlayer(info);"); // the phone's songs come from the device (below), not the server
swap('<script>\n"use strict";\nconst P = GD.PHYS;', `<script>
const SONGBUF = (GD.SONGBUF = GD.SONGBUF || {}); // song key -> decoded AudioBuffer (the viewer's SONGS too)
const songKey = info => decodeURIComponent(String(info.url).split("/").pop()).toLowerCase();
function audio() { actx = actx || new AudioContext(); return actx; }
// the player is lib/song.js, shared with the viewer (sample-exact; the replay's clock reads it)
function songPlayer(info) { const buf = SONGBUF[songKey(info)]; return buf ? GD.songPlayer(buf, audio) : null; }
function updateSongBtn() {
  const b = document.getElementById("addSong"); if (!b || !b.firstChild) return;
  const have = songInfo && SONGBUF[songKey(songInfo)];
  b.firstChild.nodeValue = have ? "song ✓" : "add song";
  b.classList.toggle("on", !!have);
}
// per-browser memory of picked songs (a convenience: everything works without it)
function songDb() {
  return new Promise((ok, no) => { try { const r = indexedDB.open("gdlm-songs", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("songs"); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); } catch (e) { no(e); } });
}
async function keepSong(key, bytes) { try { const db = await songDb(); db.transaction("songs", "readwrite").objectStore("songs").put(bytes, key); } catch (e) {} }
async function addSongBytes(key, bytes) {
  try { SONGBUF[key] = await audio().decodeAudioData(bytes.slice(0)); return true; } catch (e) { return false; }
}
function songMsg(text) {
  const m = document.getElementById("songMsg"); if (!m) return;
  m.textContent = text || ""; m.style.display = text ? "block" : "none";
}
// one way in for every source: the picker, a dropped file, a pasted file
async function takeSongFiles(files) {
  files = [...(files || [])].filter(f => f && f.size);
  if (!files.length) return;
  const known = new Set((window.GD_LEVELS || []).filter(l => l.song).map(l => songKey(l.song)));
  const b = document.getElementById("addSong"); b.firstChild.nodeValue = "loading…"; songMsg("");
  let bad = 0, ok = 0, skipped = 0;
  for (const f of files) {
    const key = known.has(f.name.toLowerCase()) ? f.name.toLowerCase() : songInfo ? songKey(songInfo) : null;
    if (!key) { skipped++; continue; }
    const bytes = await f.arrayBuffer();
    if (await addSongBytes(key, bytes)) { keepSong(key, bytes); ok++; } else bad++;
  }
  if (songInfo) { const was = playing; setSong(songInfo); syncSong(true); playing = was; }
  updateSongBtn();
  if (bad) songMsg("That file could not be played as a song (" + bad + " of " + files.length + "). An mp3 or ogg works.");
  else if (skipped) songMsg("This level has no song, so the file was not used. Open a level with a song, then add it.");
  else if (ok) songMsg("");
}
document.addEventListener("DOMContentLoaded", () => {
  const inp = document.getElementById("songFile");
  let waiting = null;                       // did the picker open after a tap?
  const opened = () => { if (waiting) { clearTimeout(waiting); waiting = null; } };
  inp.addEventListener("click", () => {
    songMsg(""); opened();
    // a picker that opens hides or blurs the page; inside some in-app browsers nothing happens at all
    waiting = setTimeout(() => { waiting = null; songMsg(
      "No file picker opened? The app's built-in browser may not allow picking files. " +
      "Open this page in Chrome (menu ⋮ → Open in browser, or copy the link into Chrome), " +
      "or drop or paste the song file onto this page."); }, 2500);
  });
  window.addEventListener("blur", opened);
  document.addEventListener("visibilitychange", () => { if (document.hidden) opened(); });
  inp.addEventListener("cancel", opened);
  inp.onchange = async e => { opened(); await takeSongFiles(e.target.files); e.target.value = ""; };
  // second ways in: drag and drop (tablets, desktop), paste (a copied file)
  document.addEventListener("dragover", e => { if (e.dataTransfer && [...e.dataTransfer.types].includes("Files")) e.preventDefault(); });
  document.addEventListener("drop", e => {
    const fs = e.dataTransfer && e.dataTransfer.files;
    if (fs && fs.length) { e.preventDefault(); takeSongFiles(fs); }
  });
  document.addEventListener("paste", e => {
    const fs = e.clipboardData && e.clipboardData.files;
    if (fs && fs.length) { e.preventDefault(); takeSongFiles(fs); }
  });
});
(async () => { try {
  const db = await songDb(), st = db.transaction("songs").objectStore("songs");
  const keys = await new Promise(ok => { const r = st.getAllKeys(); r.onsuccess = () => ok(r.result); r.onerror = () => ok([]); });
  for (const k of keys) {
    const bytes = await new Promise(ok => { const r = db.transaction("songs").objectStore("songs").get(k); r.onsuccess = () => ok(r.result); r.onerror = () => ok(null); });
    if (bytes) await addSongBytes(k, bytes);
  }
  if (songInfo) setSong(songInfo);
} catch (e) {} })();
</script>
<script>
"use strict";
const P = GD.PHYS;`);
swap("<label class=\"btn\">open .gdlvl", "<label class=\"btn\" hidden>open .gdlvl");

// ---- live data on the phone: the page's own database (Artifact `db` capability) ----
// Collections: "wip" = the sessions' work-in-progress levels, one doc per level, the same shape as
// serve.js's /wip/list (written by sessions with ArtifactData from the files tools/wip.js put
// leaves in local/phone/wip/); "marks" = the user's marks made on the phone, the same fields as
// local/marks.jsonl (read back by a session into local/phone/marks/, merged by tools/marks.js).
// Without the database (signed out, or the page opened from disk) the phone page still replays the
// pushed levels, and marks stay in that browser. See PHONE.md.
swap(`  if (!location.protocol.startsWith("http")) return;
  let list = [];
  try { const r = await fetch("/wip/list", { cache: "no-store" }); if (r.ok) list = await r.json(); } catch (e) { return; }`,
`  const db = await phoneDb(); if (!db) return;
  let list = [];
  try { list = (await db.collection("wip").get()).docs.map(d => Object.assign({}, d.data(), { wip: true })); } catch (e) { return; }
  list.sort((a, b) => String(b.updated).localeCompare(String(a.updated)));`);
swap(`  if (location.protocol.startsWith("http")) {
    try { const r = await fetch("../local/marks.jsonl", { cache: "no-store" }); if (r.ok) lines = (await r.text()).split("\\n").filter(Boolean).map(l => JSON.parse(l)); } catch (e) {}
  }`,
`  const db = await phoneDb();
  if (db) try { lines = (await db.collection("marks").get()).docs.map(d => Object.assign({}, d.data())); } catch (e) {}`);
swap(`    const r = await fetch("/marks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(m) });
    if (!r.ok) throw new Error(r.status);`,
`    const db = await phoneDb(); if (!db) throw new Error("no database");
    const ref = db.collection("marks").doc(m.id);
    if (m.note != null) await ref.set(Object.assign({ from: "phone" }, m)); else await ref.update(m);`);
// prompt() does not work inside an Artifact: an in-page box instead
// the mark's note box and the async click handler are the viewer's own now (no prompt anywhere)
// a published page's address can't carry #lv=...&t=...: no link button, no hash writes
swap('<button id="linkBtn"', '<button id="linkBtn" hidden');
swap("setInterval(() => { if (L && !playing) writeHash(); }, 1000);", "");
// Never solve on the page's thread: a phone froze for minutes solving GDLM 45 (ship + wave, ~5 min
// even on the PC). Rows from `wip.js put` carry {solution}; a level without one is solved in a Web
// Worker (solve_worker.js, written below) with a seconds counter and a time limit, and shown
// meanwhile without its run. The page opens on a level that already has a solution.
swap("pick.onchange = () => { const l = ALL[pick.value]; load(l.name, l.level, l.solution, l.song); L.deaths = l.deaths || []; summary(); draw(); };",
`pick.onchange = () => {
  const l = ALL[pick.value];
  const sol = l.solution || SOLVED.get(solveKey(l)) || { ok: false, events: [], why: "not solved yet", pending: true };
  load(l.name, l.level, sol, l.song); L.deaths = l.deaths || []; L.pending = !!sol.pending; summary(); draw();
  if (sol.pending) solveInWorker(l);
};
// ---- background solving (phone page) ----
const SOLVED = new Map(), SOLVE_LIMIT_S = 60;
const solveKey = l => (l.file || l.name) + "|" + (l.version || 0) + "|" + String(l.level || "").length;
let solver = null;
function solveInWorker(l) {
  const key = solveKey(l);
  if (solver && solver.key === key) return;
  if (solver) { solver.w.terminate(); clearInterval(solver.tick); }
  let w;
  try { w = new Worker("solve_worker.js"); } catch (e) { setPending("not solved yet (this browser cannot solve in the background): open it on the PC, or ask the session to put it again"); solver = null; return; }
  const t0 = Date.now();
  solver = { key, w, tick: setInterval(() => {
    const s = Math.round((Date.now() - t0) / 1000);
    if (s >= SOLVE_LIMIT_S) { w.terminate(); clearInterval(solver.tick); solver = null; setPending("not solved yet: too big to solve on the phone (stopped after " + SOLVE_LIMIT_S + " s). Open it on the PC, or ask the session to put it again (wip.js put now saves the solution)."); return; }
    setPending("solving on this phone in the background… " + s + " s (the page stays usable)");
  }, 1000) };
  setPending("solving on this phone in the background… 0 s (the page stays usable)");
  w.onmessage = e => {
    clearInterval(solver.tick); w.terminate(); solver = null;
    SOLVED.set(key, e.data);
    const cur = ALL[pick.value];
    if (cur && solveKey(cur) === key) { const tt = t; pick.onchange(); t = Math.min(tt, (L.path.length - 1) / P.TPS); draw(); }
  };
  w.onerror = () => { clearInterval(solver.tick); w.terminate(); solver = null; setPending("not solved yet (the solver failed here): open it on the PC, or ask the session"); };
  w.postMessage({ level: l.level });
}
function setPending(msg) { if (L && L.pending) { L.sol.why = msg; summary(); } }`);
swap("            : `<p class=\"bad\">${kind} Not beatable in the simulation.",
  "            : s.pending ? `<p class=\"muted\">${esc(s.why)}</p>` : `<p class=\"bad\">${kind} Not beatable in the simulation.");
swap("if (saved) sol = saved.ok ? { ok: true, events: saved.events, clicks: [] } : { ok: false, trail: saved.events, clicks: [], dieAt: { x: saved.dieX || 0, tick: 0 }, why: saved.why || \"\" };",
  "if (saved) sol = saved.ok ? { ok: true, events: saved.events, clicks: [] } : { ok: false, trail: saved.events, clicks: [], dieAt: { x: saved.dieX || 0, tick: 0 }, why: saved.why || \"\", pending: !!saved.pending };");
swap("  else if (ALL.length) { pick.value = 0; pick.onchange(); }",
  "  else if (ALL.length) { const s = ALL.findIndex(l => l.solution); pick.value = Math.max(0, s); pick.onchange(); }");
swap('<script>\n"use strict";\nconst P = GD.PHYS;', `<script>
// the page's database, or null (memoized; null after 10 s when no viewer answers)
let _db;
function phoneDb() {
  if (_db === undefined) _db = (window.claude && window.claude.use)
    ? Promise.race([window.claude.use("db").catch(() => null), new Promise(r => setTimeout(() => r(null), 10000))]) : Promise.resolve(null);
  return _db;
}
// new levels from the sessions arrive while the page is open: refresh the list on any change
phoneDb().then(db => { if (!db) return; let first = true;
  try { db.collection("wip").onSnapshot(() => { if (first) { first = false; return; } loadWip(true); }, () => {}); } catch (e) {} });
</script>
<script>
"use strict";
const P = GD.PHYS;`);
swap("</style>", `</style>`);
// phone: bigger touch targets, the header wraps, the canvas keeps a usable height
swap("</style>", `  @media (max-width: 700px) {
    header { padding:8px max(12px, env(safe-area-inset-left, 0px)); gap:6px; }
    header h1 { width:100%; }
    select { flex:1 1 100%; min-width:0; }
    select, button { padding:9px 12px; font-size:15px; }
    canvas#cv { height:auto; aspect-ratio:4/3; max-height:70vh; } /* the game look frames by width here (viewer draw) */
    #strip { height:40px; }
    main { padding:12px max(16px, env(safe-area-inset-left, 0px)) 24px; }
    .card { overflow-x:auto; }
  }
</style>`);
html = `<!-- built by tools/web.js from viewer/index.html; do not edit -->\n` + html;
fs.writeFileSync(path.join(OUT, "index.html"), html);
// the Artifact publish call, ready to use (files map = everything beside index.html)
// the background solver: the same lib/ files, in a Web Worker (the libs attach to `window`)
fs.writeFileSync(path.join(OUT, "solve_worker.js"), `// built by tools/web.js: solves one level off the page's thread
self.window = self;
importScripts(${libs.map(f => JSON.stringify("lib/" + f)).join(", ")});
onmessage = e => {
  try {
    const level = GD.parseLevel(e.data.level), w = GD.makeWorld(level.objects, level.header), r = GD.solveAny(w);
    postMessage(r.ok ? { ok: true, events: r.events } : { ok: false, events: r.trail || [], dieX: r.dieAt && r.dieAt.x, why: r.why || "" });
  } catch (err) { postMessage({ ok: false, events: [], why: "the solver failed: " + err.message }); }
};
`);
// the timing windows' worker (viewer/windows_worker.js: lib URLs come from the page, so the same file works here)
fs.copyFileSync(path.join(ROOT, "viewer", "windows_worker.js"), path.join(OUT, "windows_worker.js"));
const files = { "levels.js": "levels.js", "beats.js": "beats.js", "solve_worker.js": "solve_worker.js", "windows_worker.js": "windows_worker.js" };
for (const m of maps) files["maps/" + m + "_shapes.jpg"] = "maps/" + m + "_shapes.jpg";
for (const f of libs) files["lib/" + f] = "lib/" + f;
fs.writeFileSync(path.join(OUT, "publish.json"), JSON.stringify({ file_path: path.join(OUT, "index.html"), root: OUT, files, capabilities: { db: {} } }, null, 1));
console.log(`${OUT}: index.html + ${Object.keys(files).length} files; publish.json has the Artifact call's file_path, root, files and capabilities`);
