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
// queued from ANOTHER checkout by a relative path, and that file gone before the watcher runs here:
// the watcher must install from the queue's own copy (2026-11-23: "file missing" across worktrees)
const other = path.join(dir, "other_checkout"); fs.mkdirSync(path.join(other, "levels"), { recursive: true });
fs.copyFileSync(lv[0], path.join(other, "levels", "only_there.gdlvl"));
execFileSync(process.execPath, [T, "add", "levels/only_there.gdlvl", "--by", "test"], { env, cwd: other, stdio: "pipe" });
fs.rmSync(other, { recursive: true, force: true });
execFileSync(process.execPath, [T, "add", lv[1], "--by", "test"], { env, stdio: "pipe" });
const w = spawn(process.execPath, [T, "watch", "--every", "0.3", "--save", copy, "--pretend-running", marker, "--exit-after-install"], { env });
let out = ""; w.stdout.on("data", d => out += d);
setTimeout(() => {
  const before = fs.readFileSync(copy).equals(fs.readFileSync(save));
  fs.unlinkSync(marker);   // "GD closes"
  w.on("exit", code => {
    const q = JSON.parse(fs.readFileSync(env.GDLM_INSTALL_QUEUE, "utf8")).queue;
    const ok = before && code === 0 && q.length === 0 && fs.readdirSync(path.join(dir, "install_queue_files")).length === 0 && /ok\s+GDLM 43 climb/.test(out) && /ok\s+GDLM 44 hellgate/.test(out);
    console.log(ok ? "ok: waits while GD runs, installs when it closes, read-back matches, queue emptied" : "FAIL\n" + out + " exit " + code + " untouched-while-running " + before);
    if (!ok) { fs.rmSync(dir, { recursive: true, force: true }); process.exit(1); }
    guard();
  });
}, 1500);
// the guard: an install that drops an online ID (a fake install.js that strips k1, as main's old
// one did) gets the save put back from the backup, and the report says so
function guard() {
  const zlib = require("zlib");
  const dec = b => zlib.gunzipSync(Buffer.from(Buffer.from(b.map(x => x ^ 11)).toString("latin1").replace(/\0/g, "").trim().replace(/-/g, "+").replace(/_/g, "/"), "base64")).toString("utf8");
  const enc = x => Buffer.from(Buffer.from(zlib.gzipSync(Buffer.from(x)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_"), "latin1").map(b => b ^ 11));
  // give hellgate's record a known fake ID (drop any real one first)
  let x = dec(fs.readFileSync(copy));
  const n = x.indexOf("<k>k2</k><s>GDLM 44 hellgate</s>"), c = x.lastIndexOf("<k>kCEK</k><i>4</i>", n) + "<k>kCEK</k><i>4</i>".length;
  const head = x.slice(c, n).replace(/<k>k1<\/k><i>[^<]*<\/i>/, "");
  x = x.slice(0, c) + "<k>k1</k><i>999000222</i>" + head + x.slice(n);
  fs.writeFileSync(copy, enc(x));
  const good = fs.readFileSync(copy);
  const fake = path.join(dir, "fake_install.js");
  fs.writeFileSync(fake, `const fs=require("fs"),zlib=require("zlib");const s=process.argv[process.argv.indexOf("--save")+1];
const dec=${dec.toString()};const enc=${enc.toString()};
fs.copyFileSync(s, s+".bak");fs.writeFileSync(s, enc(dec(fs.readFileSync(s)).replace("<k>k1</k><i>999000222</i>","")));console.log("written. backup: "+s+".bak");`);
  execFileSync(process.execPath, [T, "add", lv[1], "--by", "test"], { env, stdio: "pipe" });
  let out2 = "", code2 = 0;
  try { out2 = execFileSync(process.execPath, [T, "watch", "--every", "0.3", "--save", copy, "--pretend-running", path.join(dir, "never"), "--exit-after-install"],
    { env: { ...env, GDLM_INSTALL_JS: fake }, encoding: "utf8", stdio: "pipe", timeout: 30000 }); }
  catch (e) { out2 = String(e.stdout || ""); code2 = e.status; }
  const ok = code2 === 2 && /online ID dropped/.test(out2) && /save restored/.test(out2) && fs.readFileSync(copy).equals(good);
  console.log(ok ? "ok: an install that drops an online ID is undone from the backup and reported" : "FAIL guard (exit " + code2 + ")\n" + out2);
  fs.rmSync(dir, { recursive: true, force: true });
  process.exit(ok ? 0 : 1);
}
setTimeout(() => { console.log("FAIL: timeout\n" + out); w.kill(); process.exit(1); }, 60000);
