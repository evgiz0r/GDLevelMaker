// node tests/install_hot.js
//
// The node side of "install into a running GD" (tools/hotinstall.js + install.js's hot path, GEODE.md): the mod-ready
// check (version, pid), the request file (a full plist record with install.js's description and length label), waiting
// for the mod's answer (a fake mod in a child process answers like the real one), a request left waiting, dropping stale
// requests, and the fallback to the install queue. Everything in a temp folder: never the user's game, save or inbox.
const fs = require("fs"), os = require("os"), path = require("path");
const { spawn } = require("child_process");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gdlm-hot-test-"));
process.env.GDLM_PROBE_DIR = path.join(dir, "gdlm.probe");
process.env.GDLM_INSTALL_QUEUE = path.join(dir, "queue", "install_queue.json");
const H = require("../tools/hotinstall.js"), INST = require("../tools/install.js");
const level = path.join(__dirname, "..", "levels", "gdlm_44_hellgate.gdlvl");
if (!fs.existsSync(level)) { console.log("skip: no level file"); process.exit(0); }
let fails = 0;
const ok = (c, m) => { console.log((c ? "ok: " : "FAIL: ") + m); if (!c) fails++; };
const save = path.join(dir, "CCLocalLevels.dat"); fs.writeFileSync(save, "not a real save");
const quiet = fn => { const w = process.stdout.write; let out = ""; process.stdout.write = s => { out += s; return true; }; try { return [fn(), out]; } finally { process.stdout.write = w; } };

// versions and the ready check
ok(H.atLeast("v0.6.0") && H.atLeast("v0.10.1") && H.atLeast("1.0.0") && !H.atLeast("v0.5.1") && !H.atLeast(""), "version compare");
const pd = process.env.GDLM_PROBE_DIR; fs.mkdirSync(pd, { recursive: true });
ok(!H.modReady({ pids: [42] }).ok, "no status file: not ready");
fs.writeFileSync(path.join(pd, "probe.status.json"), JSON.stringify({ version: "v0.5.1", pid: 42 }));
ok(/v0\.6\.0/.test(H.modReady({ pids: [42] }).why), "older mod: not ready");
fs.writeFileSync(path.join(pd, "probe.status.json"), JSON.stringify({ version: "v0.6.0", pid: 41 }));
ok(!H.modReady({ pids: [42] }).ok, "status from another GD run: not ready");
fs.writeFileSync(path.join(pd, "probe.status.json"), JSON.stringify({ version: "v0.6.0", pid: 42 }));
ok(H.modReady({ pids: [42] }).ok, "mod v0.6.0 in this GD: ready");

const ready = { ...H, modReady: () => ({ ok: true, status: { version: "v0.6.0", pid: 42 } }) };

// a fake mod: answers every request like the real one (name check, installed, not saved)
const fake = spawn(process.execPath, ["-e", `
  const fs = require("fs"), path = require("path"), d = path.join(process.argv[1], "install");
  const t0 = Date.now();
  const tick = () => {
    let files = []; try { files = fs.readdirSync(d).filter(f => f.endsWith(".req.json")); } catch (e) {}
    for (const f of files) {
      const id = f.slice(0, -9), j = JSON.parse(fs.readFileSync(path.join(d, f), "utf8"));
      const good = j.record.startsWith("<?xml") && j.record.includes("<k>k2</k><s>" + j.name + "</s>") && j.record.includes("<k>k4</k><s>") && j.record.endsWith("</dict></plist>");
      fs.renameSync(path.join(d, f), path.join(d, id + ".taken.json"));
      const r = good ? { id, status: "installed", name: j.name, position: 3, replaced: true, online_id: 152848491, saved: false, song: "known" }
        : { id, status: "failed", why: "bad record", name: j.name };
      fs.writeFileSync(path.join(d, id + ".result.json.tmp"), JSON.stringify(r)); fs.renameSync(path.join(d, id + ".result.json.tmp"), path.join(d, id + ".result.json"));
      process.exit(0);
    }
    if (Date.now() - t0 < 15000) setTimeout(tick, 100); else process.exit(1);
  };
  tick();`, pd], { windowsHide: true, stdio: "ignore" });
const [code, out] = quiet(() => INST.hot([level], save, ["--wait", "10"], ready));
ok(code === 0 && /replaced \(position 3\).*kept online ID 152848491/.test(out), "installed through the inbox: " + (out.match(/"GDLM[^\n]*/) || [out])[0]);
ok(fs.readdirSync(path.join(dir, "gdlm_backups")).some(f => f.startsWith("CCLocalLevels.")), "the save was backed up first");
const taken = fs.readdirSync(H.inboxDir()).find(f => f.endsWith(".taken.json"));
const req = taken && JSON.parse(fs.readFileSync(path.join(H.inboxDir(), taken), "utf8"));
ok(req && req.name === "GDLM 44 hellgate" && /<k>k23<\/k><i>\d<\/i>/.test(req.record) && /<k>k3<\/k><s>/.test(req.record) && req.save === true, "the request holds the record with length label and description");
fake.kill();

// no answer in time (the user is in a level): exit 3, the request stays; a closed-game install drops it
const [code2, out2] = quiet(() => INST.hot([level], save, ["--wait", "0.3"], ready));
ok(code2 === 3 && /waiting in GD's inbox/.test(out2), "no answer: waits in the inbox (exit 3)");
ok(fs.readdirSync(H.inboxDir()).filter(f => f.endsWith(".req.json")).length === 1, "the request is still pending");
ok(H.dropPending(["GDLM 44 hellgate"]).length === 1 && !fs.readdirSync(H.inboxDir()).some(f => f.endsWith(".req.json")), "dropPending removes the stale request");

// --slot with GD running: refused, nothing written
const [code3] = quiet(() => INST.hot([level], save, ["--slot", "phone"], ready));
ok(code3 === 3 && !fs.readdirSync(H.inboxDir()).some(f => f.endsWith(".req.json")), "--slot with GD running: refused");

// mod not there: falls back to the install queue
const none = { ...H, modReady: () => ({ ok: false, why: "no probe.status.json" }) };
const [code4, out4] = quiet(() => INST.hot([level], save, [], none));
const q = JSON.parse(fs.readFileSync(process.env.GDLM_INSTALL_QUEUE, "utf8"));
ok(code4 === 3 && /queued/.test(out4) && q.queue.some(e => e.name === "GDLM 44 hellgate"), "no mod: queued for when GD closes");

fs.rmSync(dir, { recursive: true, force: true });
console.log(fails ? `${fails} FAILED` : "all ok");
process.exit(fails ? 1 : 0);
