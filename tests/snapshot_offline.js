// node tests/snapshot_offline.js [local/phone/viewer_snapshot_<date>.html] [--level "Hexagon"] [--shot out.png]
// Opens an offline snapshot (tools/snapshot.js) the way the phone will: from disk (file://), a phone-sized window, a
// phone user agent and NO network (every request goes to a dead proxy). A copy of the file gets a small harness that,
// once the page has booted, opens a level by name, checks that it loaded with its route, GD's art and its song decoded,
// plays it for a few seconds and reports what it saw; the page's errors are caught. Prints the report, fails on a problem.
const fs = require("fs"), path = require("path"), os = require("os"), cp = require("child_process");
const ROOT = path.join(__dirname, ".."), args = process.argv.slice(2), opt = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
let file = args.find(a => /\.html$/.test(a));
if (!file) { const d = path.join(ROOT, "local", "phone"); const all = fs.readdirSync(d).filter(f => /^viewer_snapshot_.*\.html$/.test(f)).sort(); file = path.join(d, all.pop()); }
const want = opt("--level") || "Hexagon Force";
const exe = process.env.BROWSER || ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Google/Chrome/Application/chrome.exe"].find(b => fs.existsSync(b));
const harness = `<script>
window.__errs = []; addEventListener("error", e => __errs.push(String(e.message) + (e.error && e.error.stack ? " @ " + e.error.stack.split(String.fromCharCode(10)).slice(1, 4).join(" < ") : "")));
addEventListener("unhandledrejection", e => __errs.push("promise: " + String(e.reason && e.reason.message || e.reason)));
(async () => {
  const out = {}, wait = ms => new Promise(r => setTimeout(r, ms));
  for (let i = 0; i < 300 && !(window.ALL && ALL.length && window.L); i++) await wait(100);
  try {
    out.levels = ALL.length; out.first = L && L.name;
    const i = ALL.findIndex(l => (l.name || "").includes(${JSON.stringify(want)}));
    out.found = i >= 0; if (i >= 0) { pick.value = i; pick.onchange(); }
    for (let k = 0; k < 100 && !(L && L.name.includes(${JSON.stringify(want)}) && L.path.length > 1); k++) await wait(100);
    out.level = L.name; out.route = L.sol && L.sol.ok; out.pathSeconds = +(L.path.length / P.TPS).toFixed(1);
    out.artOn = typeof art !== "undefined" && art; out.artReady = !!(GD.ART_LIB && GD.ART_LIB.S.ready); out.artFailed = GD.ART_LIB && GD.ART_LIB.S.failed;
    for (let k = 0; k < 300 && !(typeof SONGS !== "undefined" && songInfo && SONGS[songKeyOf(songInfo)]); k++) await wait(100);
    out.song = songInfo ? songInfo.url : null; out.songDecoded = !!(songInfo && typeof SONGS !== "undefined" && SONGS[songKeyOf(songInfo)]);
    out.songSeconds = out.songDecoded ? +SONGS[songKeyOf(songInfo)].duration.toFixed(1) : 0;
    t = 0; playing = true; setPlay(); const t0 = performance.now();
    // headless virtual time fires no animation frames: step the viewer's own frame loop (draws every frame as on a phone)
    for (let k = 0; k < 180 && playing; k++) { await wait(16); frame(performance.now()); }
    out.played = +t.toFixed(2); out.wall = +((performance.now() - t0) / 1000).toFixed(2); playing = false; setPlay();
    out.runs = typeof PK !== "undefined" && PK.runs ? PK.runs.length : null;
  } catch (e) { out.crash = String(e && e.stack || e); }
  out.errors = __errs.slice(0, 8);
  const pre = document.createElement("pre"); pre.id = "gdlmResult"; pre.textContent = JSON.stringify(out); document.body.appendChild(pre);
})();
</script>`;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gdlm-snaptest-")), copy = path.join(tmp, "snap.html");
fs.writeFileSync(copy, fs.readFileSync(file, "utf8").replace("<body>\n", "<body>\n" + harness));
const prof = path.join(tmp, "prof"), shot = opt("--shot");
const common = ["--headless=new", "--disable-gpu", "--no-first-run", "--mute-audio", "--hide-scrollbars", "--user-data-dir=" + prof, "--window-size=375,812",
  "--user-agent=Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36",
  "--proxy-server=http://127.0.0.1:9", "--proxy-bypass-list=<-loopback>", "--autoplay-policy=no-user-gesture-required", "--virtual-time-budget=60000"];
const url = "file:///" + copy.replace(/\\/g, "/");
const t0 = Date.now();
const r = cp.spawnSync(exe, common.concat(["--dump-dom", url]), { windowsHide: true, maxBuffer: 1 << 30, timeout: 420000 });
const dom = String(r.stdout || ""), m = /<pre id="gdlmResult">([^<]*)<\/pre>/.exec(dom);
if (shot) cp.spawnSync(exe, common.concat(["--screenshot=" + path.resolve(shot), url]), { windowsHide: true, timeout: 420000 });
try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}
if (!m) { console.log("FAIL: no report from the page (" + ((Date.now() - t0) / 1000).toFixed(0) + " s); " + (/gdlmBoot[^>]*>([^<]*)/.exec(dom) || [])[1]); process.exit(1); }
const o = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">"));
console.log(path.basename(file) + " (" + (fs.statSync(file).size / 1048576).toFixed(1) + " MB), offline, 375x812:\n" + JSON.stringify(o, null, 1));
const bad = [!o.found && "level not found", !o.route && "no route", !o.artReady && "art not ready", o.artFailed && "art failed: " + o.artFailed,
  !/nosongs/.test(file) && !o.songDecoded && "song not decoded", !(o.played > 0.5) && "did not play", o.crash && "crash", ...(o.errors || [])].filter(Boolean);
console.log(bad.length ? "PROBLEMS: " + bad.join("; ") : "ok");
process.exit(bad.length ? 1 : 0);
