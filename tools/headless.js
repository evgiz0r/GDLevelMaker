// Shared by tools/shoot.js and tools/catalogue.js: open a page of the viewer in a headless Edge/Chrome
// and wait until the page writes its done file. Starts tools/serve.js on the port when nothing answers
// there (and stops it after). A fresh temp browser profile each time, never the user's own.
// headless(pagePath, doneFile, {port, timeoutMs, width, height}) -> {ok, seconds}
const fs = require("fs"), path = require("path"), http = require("http"), cp = require("child_process"), os = require("os");
const BROWSERS = ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe", "/usr/bin/chromium", "/usr/bin/google-chrome"];
const up = port => new Promise(res => http.get(`http://localhost:${port}/viewer/`, r => { r.resume(); res(true); }).on("error", () => res(false)));
async function headless(pagePath, doneFile, opt = {}) {
  const port = opt.port || 8767, url = `http://localhost:${port}/${pagePath.replace(/^\//, "")}`;
  try { fs.unlinkSync(doneFile); } catch (e) {}
  let server = null;
  if (!(await up(port))) {
    server = cp.spawn(process.execPath, [path.join(__dirname, "serve.js"), String(port)], { stdio: "ignore" });
    for (let i = 0; i < 40 && !(await up(port)); i++) await new Promise(r => setTimeout(r, 150));
  }
  const exe = process.env.BROWSER || BROWSERS.find(b => fs.existsSync(b));
  if (!exe) { if (server) server.kill(); throw new Error("no Edge/Chrome found: open " + url + " in a browser (or set BROWSER=path)"); }
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), "gdlm-headless-"));
  const br = cp.spawn(exe, ["--headless=new", "--disable-gpu", "--no-first-run", "--hide-scrollbars", "--force-device-scale-factor=1",
    "--user-data-dir=" + prof, `--window-size=${opt.width || 1920},${opt.height || 1080}`, url], { stdio: "ignore" });
  const t0 = Date.now(), limit = opt.timeoutMs || 10 * 60e3;
  while (!fs.existsSync(doneFile) && Date.now() - t0 < limit) await new Promise(r => setTimeout(r, 400));
  br.kill(); if (server) server.kill();
  await new Promise(r => setTimeout(r, 300));
  try { fs.rmSync(prof, { recursive: true, force: true }); } catch (e) {}
  return { ok: fs.existsSync(doneFile), seconds: (Date.now() - t0) / 1000 };
}
module.exports = { headless };
