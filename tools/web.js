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
// Songs: none are published. The viewer picks mp3s from their own device ("add song"); they are
// decoded with Web Audio (no media URLs, which the Artifact frame may refuse) and kept in this
// browser's IndexedDB so each song is picked once. A file named like the game's own copy
// (StereoMadness.mp3, 343707.mp3) goes to every level on that song; any other name goes to the
// level on screen.
swap('<button id="music" class="on">music</button>',
  '<button id="music" class="on">music</button><label class="btn" id="addSong">add song<input id="songFile" type="file" accept="audio/*,.mp3,.ogg" multiple hidden></label>');
swap("if (!info || location.protocol === \"file:\") return;", "if (!info) return; updateSongBtn();");
swap('song = new Audio(info.url); song.preload = "auto";\n  song.onerror = () => { song = null; };', "song = songPlayer(info);");
swap('<script>\n"use strict";\nconst P = GD.PHYS;', `<script>
const SONGBUF = {};                       // song key -> decoded AudioBuffer
const songKey = info => decodeURIComponent(String(info.url).split("/").pop()).toLowerCase();
function audio() { actx = actx || new AudioContext(); return actx; }
// an Audio-like player over an AudioBuffer: currentTime, playbackRate, play(), pause(), paused
function songPlayer(info) {
  const buf = SONGBUF[songKey(info)];
  if (!buf) return null;
  let src = null, off = 0, rate = 1, t0 = 0;
  const p = { paused: true };
  const now = () => p.paused ? off : off + (audio().currentTime - t0) * rate;
  const stop = () => { if (src) { try { src.stop(); } catch (e) {} src.disconnect(); src = null; } };
  const start = () => {
    const a = audio(); if (a.resume) a.resume();
    src = a.createBufferSource(); src.buffer = buf; src.playbackRate.value = rate; src.connect(a.destination);
    t0 = a.currentTime;
    if (off >= 0) src.start(0, Math.min(off, buf.duration)); else src.start(a.currentTime - off / rate, 0);
  };
  Object.defineProperty(p, "currentTime", { get: now, set(v) { const playing = !p.paused; stop(); off = v; if (playing) start(); } });
  Object.defineProperty(p, "playbackRate", { get: () => rate, set(v) { if (v === rate) return; const c = now(); const playing = !p.paused; stop(); off = c; rate = v; if (playing) start(); } });
  p.play = () => { if (p.paused) { p.paused = false; start(); } return Promise.resolve(); };
  p.pause = () => { if (!p.paused) { off = now(); stop(); p.paused = true; } };
  return p;
}
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
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("songFile").onchange = async e => {
    const known = new Set((window.GD_LEVELS || []).filter(l => l.song).map(l => songKey(l.song)));
    const b = document.getElementById("addSong"); b.firstChild.nodeValue = "loading…";
    let bad = 0;
    for (const f of e.target.files) {
      const key = known.has(f.name.toLowerCase()) ? f.name.toLowerCase() : songInfo ? songKey(songInfo) : null;
      if (!key) continue;
      const bytes = await f.arrayBuffer();
      if (await addSongBytes(key, bytes)) keepSong(key, bytes); else bad++;
    }
    e.target.value = "";
    if (songInfo) { const was = playing; setSong(songInfo); syncSong(true); playing = was; }
    updateSongBtn();
    if (bad) { b.firstChild.nodeValue = "not a song file"; setTimeout(updateSongBtn, 2500); }
  };
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
swap(`cv.addEventListener("click", e => {
  if (!marking || !L) return;`, `cv.addEventListener("click", async e => {
  if (!marking || !L) return;`);
swap("const note = prompt(`What should change here? (block ${(x / 30).toFixed(1)}, ${(tick() / P.TPS).toFixed(2)} s)`);",
  "const note = await askNote(`What should change here? (block ${(x / 30).toFixed(1)}, ${(tick() / P.TPS).toFixed(2)} s)`);");
// a published page's address can't carry #lv=...&t=...: no link button, no hash writes
swap('<button id="linkBtn"', '<button id="linkBtn" hidden');
swap("setInterval(() => { if (L && !playing) writeHash(); }, 1000);", "");
swap('<script>\n"use strict";\nconst P = GD.PHYS;', `<script>
// the page's database, or null (memoized; null after 10 s when no viewer answers)
let _db;
function phoneDb() {
  if (_db === undefined) _db = (window.claude && window.claude.use)
    ? Promise.race([window.claude.use("db").catch(() => null), new Promise(r => setTimeout(() => r(null), 10000))]) : Promise.resolve(null);
  return _db;
}
// a small note box (prompt() is refused inside an Artifact)
function askNote(title) {
  return new Promise(done => {
    const box = document.getElementById("noteBox"), ta = document.getElementById("noteText");
    document.getElementById("noteTitle").textContent = title; ta.value = ""; box.hidden = false; ta.focus();
    const close = v => { box.hidden = true; done(v); };
    document.getElementById("noteSave").onclick = () => close(ta.value);
    document.getElementById("noteCancel").onclick = () => close(null);
  });
}
// new levels from the sessions arrive while the page is open: refresh the list on any change
phoneDb().then(db => { if (!db) return; let first = true;
  try { db.collection("wip").onSnapshot(() => { if (first) { first = false; return; } loadWip(true); }, () => {}); } catch (e) {} });
</script>
<div id="noteBox" hidden><div class="card"><h2 id="noteTitle"></h2><textarea id="noteText" rows="4"></textarea>
<div class="row"><button id="noteSave" class="on">save mark</button><button id="noteCancel">cancel</button></div></div></div>
<script>
"use strict";
const P = GD.PHYS;`);
swap("</style>", `  #noteBox { position:fixed; inset:0; z-index:20; display:grid; place-items:center; background:rgba(11,6,32,.8); padding:16px; }
  #noteBox[hidden] { display:none; }
  #noteBox .card { width:min(100%, 420px); }
  #noteBox textarea { width:100%; box-sizing:border-box; background:#0e0828; color:var(--ink); border:1px solid #3b2d78; border-radius:6px; padding:8px; font:inherit; font-size:16px; }
  #noteBox .row { display:flex; gap:8px; margin-top:8px; }
</style>`);
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
// the Artifact publish call, ready to use (files map = everything beside index.html)
const files = { "levels.js": "levels.js", "beats.js": "beats.js" };
for (const f of libs) files["lib/" + f] = "lib/" + f;
fs.writeFileSync(path.join(OUT, "publish.json"), JSON.stringify({ file_path: path.join(OUT, "index.html"), root: OUT, files, capabilities: { db: {} } }, null, 1));
console.log(`${OUT}: index.html + ${Object.keys(files).length} files; publish.json has the Artifact call's file_path, root, files and capabilities`);
