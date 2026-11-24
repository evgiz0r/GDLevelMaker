// node tools/snapshot.js [--no-songs] [--kbps 40] [--out local/phone/viewer_snapshot_<date>.html] [--port 8790]
// The PC viewer as ONE self-contained HTML file that opens from disk (file://) with no server and no network -- for the
// user's phone at work (the user, 2026-11-24, via the main session). Inside: the viewer and its libs, every level the PC
// viewer lists (our levels/, the official ones, every session's work in progress, with their saved routes), the beat
// grids, the user's runs (local/attempts/) and icons, GD's art (the hd sheets as WebP, the backgrounds / grounds the
// levels use) and the songs (AAC, mono, --kbps; --no-songs leaves them out and the file says so).
// How it works: the level data is gzipped JSON in the page, unpacked with DecompressionStream before the viewer's own
// script runs; a fetch shim answers the viewer's server calls (/wip/list, /attempts, /me/icons, /gdres/*.plist,
// /song/*) from that data, and lib/art.js takes its images from window.GD_ART_EMBED. Writes are accepted and dropped
// (marks made offline are not kept). Every "is there a server" check of the viewer is answered yes.
// LOCAL ONLY: RobTop's art, official levels and songs are in it -- never commit, upload or publish it. It goes to the user
// by the chat's file card only. Measured sizes and what works offline: PHONE.md "Offline snapshot".
const fs = require("fs"), path = require("path"), zlib = require("zlib"), cp = require("child_process"), http = require("http"), os = require("os");
const ROOT = path.join(__dirname, ".."), args = process.argv.slice(2), opt = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const GAME = process.env.GD_GAME || "C:/Program Files (x86)/Steam/steamapps/common/Geometry Dash", RES = path.join(GAME, "Resources");
const SAVE = process.env.GD_SAVE || path.join(process.env.LOCALAPPDATA || "", "GeometryDash");
const day = new Date().toISOString().slice(0, 10);
const OUT = path.resolve(opt("--out") || path.join(ROOT, "local", "phone", `viewer_snapshot_${day}${args.includes("--no-songs") ? "_nosongs" : ""}.html`));
const KBPS = +(opt("--kbps") || 40), SONGS = !args.includes("--no-songs");
const get = (port, p) => new Promise(res => http.get(`http://localhost:${port}${p}`, r => { let b = ""; r.on("data", d => b += d); r.on("end", () => res(r.statusCode === 200 ? b : null)); }).on("error", () => res(null)));
const up = port => get(port, "/version").then(b => b != null);
const mb = n => (n / 1048576).toFixed(1) + " MB";
const PY = process.env.PYTHON || "python";

(async () => {
  const t0 = Date.now();
  // ---- the server's answers (a temporary tools/serve.js, never self-updating) ----
  const port = +(opt("--port") || 8790); let srv = null;
  if (!(await up(port))) { srv = cp.spawn(process.execPath, [path.join(__dirname, "serve.js"), String(port), "--no-update"], { windowsHide: true, stdio: "ignore", cwd: ROOT });
    for (let i = 0; i < 60 && !(await up(port)); i++) await new Promise(r => setTimeout(r, 200)); }
  const wip = JSON.parse((await get(port, "/wip/list")) || "[]"), attIndex = JSON.parse((await get(port, "/attempts/index")) || "[]");
  const me = JSON.parse((await get(port, "/me/icons")) || "null"), ver = JSON.parse((await get(port, "/version")) || "{}");
  if (srv) { try { srv.kill(); } catch (e) {} srv.unref(); }
  // ---- levels (as their generated JS, run in order before the viewer) and runs ----
  const js = f => { try { return fs.readFileSync(path.join(ROOT, f), "utf8"); } catch (e) { return ""; } };
  const levelsJs = js("viewer/levels.js"), localJs = js("viewer/levels.local.js") || "window.GD_LEVELS_LOCAL = [];", beatsJs = js("local/beats.local.js") || "window.GD_BEATS = {};";
  const attempts = {}; const AD = path.join(ROOT, "local", "attempts");
  if (fs.existsSync(AD)) for (const f of fs.readdirSync(AD)) if (f.endsWith(".jsonl")) attempts[f.replace(/\.jsonl$/, "")] = fs.readFileSync(path.join(AD, f), "utf8").split(/\r?\n/).filter(Boolean).map(l => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean);
  // ---- GD's art: the hd sheets (2 px a unit) as WebP, their plists, the scenery the levels use ----
  const A = require("../lib/art.js").ART_LIB, sheets = A.SHEETS.concat(A.ICONS), gdres = {}, art = { px: 2 }, scen = new Set();
  const lvls = []; { const w = {}; global.window = w; for (const s of [levelsJs, localJs]) try { eval(s); } catch (e) {} lvls.push(...(w.GD_LEVELS || []), ...(w.GD_LEVELS_LOCAL || []), ...wip); delete global.window; }
  for (const l of lvls) { const h = String(l.level || "").split(";")[0]; const s = A.scenery(h);
    scen.add(`game_bg_${s.bg}_001`); scen.add(`groundSquare_${s.ground}_001`); scen.add(`groundSquare_${s.ground}_2_001`);
    if (s.mg) { const m = String(s.mg).padStart(2, "0"); scen.add(`fg_${m}_001`); scen.add(`fg_${m}_2_001`); } }
  const user = me && me.icons ? Object.entries({ cube: "player", ship: "ship", ball: "player_ball", ufo: "bird", wave: "dart", robot: "robot", spider: "spider", swing: "swing" })
    .map(([m, k]) => "icons/" + k + "_" + String(me.icons[m] || 1).padStart(2, "0")) : [];
  const imgs = [];   // [key as art.js asks for it, file on disk]
  for (const n of new Set(sheets.concat(user))) {
    const pl = path.join(RES, n + "-hd.plist"); if (!fs.existsSync(pl)) continue;
    gdres[n + "-uhd.plist"] = fs.readFileSync(pl, "utf8"); imgs.push([n + "-uhd.png", path.join(RES, n + "-hd.png")]);
  }
  for (const n of scen) { const f = path.join(RES, n + "-hd.png"); if (fs.existsSync(f)) imgs.push([n + "-uhd.png", f]); }
  for (const n of ["Robot", "Spider"]) { const f = path.join(RES, n + "_AnimDesc.plist"); if (fs.existsSync(f)) gdres[n + "_AnimDesc.plist"] = fs.readFileSync(f, "utf8"); }
  if (me && me.streak) { const n = "streak_" + String(me.streak).padStart(2, "0") + "_001"; const f = [path.join(RES, n + "-hd.png"), path.join(RES, n + ".png")].find(x => fs.existsSync(x)); if (f) imgs.push([n + ".png", f]); }
  // WebP (lossy, alpha kept) by Pillow, all in one python run; the tints read these pixels, so data: URLs (never tainted)
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gdlm-snap-"));
  const list = path.join(tmp, "list.json"); fs.writeFileSync(list, JSON.stringify(imgs.map(([k, f], i) => [f, path.join(tmp, i + ".webp")])));
  const py = cp.spawnSync(PY, ["-c", "import json,sys\nfrom PIL import Image\nfor a,b in json.load(open(sys.argv[1])):\n  Image.open(a).convert('RGBA').save(b,'WEBP',quality=82,method=6)", list], { windowsHide: true });
  if (py.status !== 0) throw new Error("WebP conversion failed (needs python + Pillow): " + String(py.stderr).slice(0, 300));
  let artBytes = 0; imgs.forEach(([k], i) => { const b = fs.readFileSync(path.join(tmp, i + ".webp")); artBytes += b.length; art[k] = "data:image/webp;base64," + b.toString("base64"); });
  // ---- songs: every song a listed level uses, AAC mono ----
  const songs = {}; let songBytes = 0, songMiss = [];
  if (SONGS) {
    const urls = new Set(lvls.filter(l => l.song && l.song.url).map(l => l.song.url));
    for (const u of urls) {
      const m = /^\/song\/(official|custom)\/(\w+)\.(mp3|ogg)$/.exec(u); if (!m) continue;
      const f = m[1] === "official" ? path.join(RES, m[2] + ".mp3") : (require("./songs.js").songFile(m[2]) || [".mp3", ".ogg"].map(e => path.join(SAVE, m[2] + e)).find(x => fs.existsSync(x)));
      if (!f || !fs.existsSync(f)) { songMiss.push(u); continue; }
      const o = path.join(tmp, m[2] + ".m4a");
      const r = cp.spawnSync(process.env.FFMPEG || "ffmpeg", ["-v", "error", "-y", "-i", f, "-vn", "-ac", "1", "-c:a", "aac", "-b:a", KBPS + "k", o], { windowsHide: true });
      if (r.status !== 0) { songMiss.push(u); continue; }
      const b = fs.readFileSync(o); songBytes += b.length; songs[u] = b.toString("base64");
    }
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  // ---- the page ----
  const data = zlib.gzipSync(JSON.stringify({ levelsJs, localJs, beatsJs, wip, attIndex, attempts, me, gdres }), { level: 9 });
  const meta = { snapshot: day, commit: ver.commit || "", levels: lvls.length, songs: SONGS ? Object.keys(songs).length : 0, songsLeftOut: !SONGS };
  let html = fs.readFileSync(path.join(ROOT, "viewer", "index.html"), "utf8").replace(/\r\n/g, "\n");
  const scriptSafe = s => s.replace(/<\/script/gi, "<\\/script").replace(/<!--/g, "<\\!--");
  const cut = s => { if (!html.includes(s)) throw new Error("viewer changed, update tools/snapshot.js: " + s); html = html.split(s).join(""); };
  cut('<script src="levels.js"></script>'); cut('<script src="levels.local.js" onerror="window.GD_LEVELS_LOCAL = []"></script>');
  cut('<script src="../local/beats.local.js" onerror="window.GD_BEATS = {}"></script>');
  // the viewer's own inline script waits until the data is unpacked: it becomes text, run by the boot below; every
  // "is there a server" check in it is answered yes (the fetch shim is the server)
  let n = 0; html = html.replace(/<script>([\s\S]*?)<\/script>/g, (m, body) => { n++;
    return `<script type="text/x-gdlm-deferred">${body.replace(/location\.protocol\.startsWith\("http"\)/g, "true").replace(/location\.protocol === "file:"/g, "false")}</script>`; });
  if (n !== 1) throw new Error("viewer changed: expected 1 inline script, found " + n + " (update tools/snapshot.js)");
  // then the libs inline, as they are
  html = html.replace(/<script src="\.\.\/lib\/([\w.]+)"><\/script>/g, (m, f) => `<script>${scriptSafe(fs.readFileSync(path.join(ROOT, "lib", f), "utf8"))}</script>`);
  if (/<script src=/.test(html)) throw new Error("a script file is left: " + /<script src="[^"]+"/.exec(html)[0]);
  const boot = `<script>
// offline snapshot (tools/snapshot.js, ${day}): no server, no network -- the data below answers the viewer's server calls
window.GD_SNAPSHOT = ${JSON.stringify(meta)};
window.GD_ART_EMBED = ${JSON.stringify(art)};
window.GD_SONGS_B64 = ${JSON.stringify(songs)};
(async () => {
  const say = t => { const d = document.getElementById("gdlmBoot"); if (d) d.textContent = t; };
  try {
    const b = atob(document.getElementById("gdlmData").textContent.trim()), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
    const D = JSON.parse(await new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream("gzip"))).text());
    const J = o => new Response(JSON.stringify(o), { headers: { "Content-Type": "application/json" } }), NO = () => new Response("", { status: 404 });
    const rows = (file, hash) => { const k = GD.attemptsBase(file || ""); return (D.attempts[k] || []).filter(r => !hash || r.hash === hash); };
    const real = window.fetch ? window.fetch.bind(window) : null;
    window.fetch = async (input, o) => {
      const url = typeof input === "string" ? input : input.url, m = ((o && o.method) || "GET").toUpperCase();
      const p = url.replace(/^[a-z]+:\\/\\/[^/]*/i, ""), q = new URLSearchParams(p.split("?")[1] || ""), path = decodeURIComponent(p.split("?")[0]);
      if (m !== "GET" && m !== "HEAD") return J({ ok: true, offline: true });   // writes are dropped offline
      if (path === "/version") return J({ commit: GD_SNAPSHOT.commit, subject: "offline snapshot " + GD_SNAPSHOT.snapshot, note: "offline snapshot" });
      if (path === "/wip/list") return J(D.wip);
      if (path === "/attempts/index") return J(D.attIndex);
      if (path === "/attempts") { let r = rows(q.get("file"), q.get("hash")); if (q.get("id")) r = r.filter(x => x.id === q.get("id")); else r = r.map(x => Object.assign({}, x, { events: undefined, presses: (x.events || []).filter(e => e.type === "press").length })); return J(r); }
      if (path === "/me/icons") return D.me ? J(D.me) : NO();
      if (path.startsWith("/gdres/")) { const t = D.gdres[path.slice(7)]; return t != null ? new Response(t) : NO(); }
      if (path.startsWith("/song/")) { const s = GD_SONGS_B64[path]; if (!s) return NO(); const x = atob(s), a = new Uint8Array(x.length); for (let i = 0; i < x.length; i++) a[i] = x.charCodeAt(i); return new Response(a.buffer, { headers: { "Content-Type": "audio/mp4" } }); }
      if (path === "/community/list") return J([]);
      if (/^https?:/.test(url) && real && !/localhost|127\\.0\\.0\\.1/.test(url)) return real(input, o);
      return NO();
    };
    for (const s of [D.levelsJs, D.localJs, D.beatsJs]) { const e = document.createElement("script"); e.textContent = s; document.head.appendChild(e); }
    for (const old of [...document.querySelectorAll('script[type="text/x-gdlm-deferred"]')]) { const e = document.createElement("script"); e.textContent = old.textContent; old.replaceWith(e); }
    document.dispatchEvent(new Event("DOMContentLoaded"));
    const bb = document.getElementById("gdlmBoot"); if (bb) bb.remove();
    if (GD_SNAPSHOT.songsLeftOut && typeof notice === "function") notice("Offline snapshot without songs: levels play silent.", 6000);
  } catch (e) { say("This snapshot could not start: " + (e && e.message || e) + " (it needs a browser from 2023 or later)."); }
})();
</script>`;
  html = html.replace("<body>\n", `<body>\n<div id="gdlmBoot" style="position:fixed;left:12px;top:12px;z-index:99;color:#fff;font:14px system-ui">Opening the offline viewer…</div>\n<script type="application/octet-stream" id="gdlmData">${data.toString("base64")}</script>\n`);
  html = html.replace("</body>", boot + "\n</body>");
  html = html.replace("<title>GD Level Viewer</title>", `<title>GDLM viewer (offline ${day})</title>`);
  fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, html);
  const size = fs.statSync(OUT).size;
  console.log(`${path.relative(ROOT, OUT)}: ${mb(size)} -- ${lvls.length} levels (data ${mb(data.length)} gzipped), art ${imgs.length} pictures ${mb(artBytes)}, ` +
    (SONGS ? `${Object.keys(songs).length} songs ${mb(songBytes)} at ${KBPS} kbps` + (songMiss.length ? ` (missing: ${songMiss.join(", ")})` : "") : "no songs") + `; ${((Date.now() - t0) / 1000).toFixed(0)} s`);
})().catch(e => { console.error(e.stack || e.message); process.exit(1); });
