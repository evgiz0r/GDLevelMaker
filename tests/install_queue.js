// node tests/install_queue.js
//
// The install queue (tools/install_queue.js) on a COPY of the user's save in the OS temp folder, with
// its own queue file: nothing installs while "GD runs" (a marker file), then everything does once it
// "closes", the read-back matches the files, an online ID is kept, and the queue is emptied.
const fs = require("fs"), os = require("os"), path = require("path");
const { spawn, execFileSync } = require("child_process");
const save = path.join(process.env.LOCALAPPDATA || "", "GeometryDash", "CCLocalLevels.dat");
const ROOT = path.join(__dirname, ".."), T = path.join(ROOT, "tools", "install_queue.js");
const lv = ["gdlm_43_climb", "gdlm_44_hellgate"].map(n => path.join(ROOT, "levels", n + ".gdlvl"));
if (!fs.existsSync(save) || !lv.every(f => fs.existsSync(f))) { console.log("skip: no save or level files"); process.exit(0); }
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gdlm-queue-test-"));
const copy = path.join(dir, "CCLocalLevels.dat"), marker = path.join(dir, "gd_running");
fs.copyFileSync(save, copy); fs.writeFileSync(marker, "");
const env = { ...process.env, GDLM_INSTALL_QUEUE: path.join(dir, "q.json"), GDLM_INSTALL_REPORTS: path.join(dir, "reports") };
execFileSync(process.execPath, [T, "add", ...lv, "--by", "test"], { env, stdio: "pipe" });
const w = spawn(process.execPath, [T, "watch", "--every", "0.3", "--save", copy, "--pretend-running", marker, "--exit-after-install"], { env });
let out = ""; w.stdout.on("data", d => out += d);
setTimeout(() => {
  const before = fs.readFileSync(copy).equals(fs.readFileSync(save));
  fs.unlinkSync(marker);   // "GD closes"
  w.on("exit", code => {
    const q = JSON.parse(fs.readFileSync(env.GDLM_INSTALL_QUEUE, "utf8")).queue;
    const ok = before && code === 0 && q.length === 0 && /ok\s+GDLM 43 climb/.test(out) && /ok\s+GDLM 44 hellgate/.test(out);
    console.log(ok ? "ok: waits while GD runs, installs when it closes, read-back matches, queue emptied" : "FAIL\n" + out + " exit " + code + " untouched-while-running " + before);
    fs.rmSync(dir, { recursive: true, force: true });
    process.exit(ok ? 0 : 1);
  });
}, 1500);
setTimeout(() => { console.log("FAIL: timeout\n" + out); w.kill(); process.exit(1); }, 60000);
