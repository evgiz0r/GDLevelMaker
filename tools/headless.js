// Shared by tools/shoot.js and tools/catalogue.js: open a page of the viewer in a headless Edge/Chrome
// and wait until the page writes its done file. Starts tools/serve.js on the port when nothing answers
// there (and stops it after). A fresh temp browser profile each time, never the user's own.
// headless(pagePath, doneFile, {port, timeoutMs, width, height}) -> {ok, seconds}
const fs = require("fs"), path = require("path"), http = require("http"), cp = require("child_process"), os = require("os");
const BROWSERS = ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe", "/usr/bin/chromium", "/usr/bin/google-chrome"];
const up = port => new Promise(res => http.get(`http://localhost:${port}/viewer/`, r => { r.resume(); res(true); }).on("error", () => res(false)));
async function headless(pagePath, doneFile, opt = {}) {
  // test=1: silent, and nothing it sends counts as the user's (viewer/index.html; CLAUDE.md: experiments are silent)
  const tp = pagePath.replace(/^\//, "").replace(/^([^?#]*)(\?[^#]*)?/, (m, a, q) => a + (q ? q + "&" : "?") + "test=1");
  const port = opt.port || 8767, url = `http://localhost:${port}/${tp}`;
  try { fs.unlinkSync(doneFile); } catch (e) {}
  let server = null;
  if (!(await up(port))) {
    server = cp.spawn(process.execPath, [path.join(__dirname, "serve.js"), String(port)], { windowsHide: true, stdio: "ignore" });
    for (let i = 0; i < 40 && !(await up(port)); i++) await new Promise(r => setTimeout(r, 150));
  }
  const exe = process.env.BROWSER || BROWSERS.find(b => fs.existsSync(b));
  if (!exe) { if (server) server.kill(); throw new Error("no Edge/Chrome found: open " + url + " in a browser (or set BROWSER=path)"); }
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), "gdlm-headless-"));
  const br = cp.spawn(exe, ["--headless=new", "--mute-audio", "--disable-gpu", "--no-first-run", "--hide-scrollbars", "--force-device-scale-factor=1",
    "--user-data-dir=" + prof, `--window-size=${opt.width || 1920},${opt.height || 1080}`, url], { windowsHide: true, stdio: "ignore" });
  const t0 = Date.now(), limit = opt.timeoutMs || 10 * 60e3;
  // opt.stallMs: give up when the page's folder (where doneFile goes) gets no new file for that long -- a hung page must not
  // hold the shared heavy slot for its whole timeout (physics 2, 2026-11-24: a video sat on it for 60 min)
  const dir = path.dirname(doneFile); let seen = -1, lastNew = Date.now(), stalled = false;
  while (!fs.existsSync(doneFile) && Date.now() - t0 < limit) {
    await new Promise(r => setTimeout(r, 400));
    if (opt.stallMs) { let n = 0; try { n = fs.readdirSync(dir).length; } catch (e) {} if (n !== seen) { seen = n; lastNew = Date.now(); } else if (Date.now() - lastNew > opt.stallMs) { stalled = true; break; } }
  }
  // kill and let go: on Windows Edge's broker can outlive the kill, and a live child handle kept node
  // running after the PNGs were written (gd-polish, 2026-11-23)
  try { br.kill(); } catch (e) {} br.unref();
  // ...and it does: Edge's launcher hands off to a broker that kill() never reaches, so every headless run left a browser
  // behind (14 of them, ~2 h old, one still solving a page, 2026-11-25). On Windows, stop every process of THIS run's own
  // profile (the temp dir in its command line), nothing else.
  if (process.platform === "win32") try {
    cp.execFileSync("powershell", ["-NoProfile", "-Command", `Get-CimInstance Win32_Process -Filter "name='${path.basename(exe)}'" | ` +
      `Where-Object { $_.CommandLine -like '*${path.basename(prof)}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`],
      { windowsHide: true, stdio: "ignore", timeout: 20000 });
  } catch (e) { /* best effort */ }
  if (server) { try { server.kill(); } catch (e) {} server.unref(); }
  await new Promise(r => setTimeout(r, 300));
  try { fs.rmSync(prof, { recursive: true, force: true }); } catch (e) {}
  return { ok: fs.existsSync(doneFile), seconds: (Date.now() - t0) / 1000, stalled };
}
module.exports = { headless };
