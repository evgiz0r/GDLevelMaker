// node tests/install_keeps_id.js
//
// Re-installing a level that is already shared online must keep its online ID (k1) and upload
// version (k16), so pressing Share again in GD updates the same upload (PUBLISH.md). Works on a
// COPY of the user's save in the OS temp folder (skips if there is no save); never touches the save.
const fs = require("fs"), os = require("os"), path = require("path"), zlib = require("zlib");
const { execFileSync } = require("child_process");

const save = path.join(process.env.LOCALAPPDATA || "", "GeometryDash", "CCLocalLevels.dat");
const level = path.join(__dirname, "..", "levels", "gdlm_44_hellgate.gdlvl");
const NAME = "GDLM 44 hellgate";
if (!fs.existsSync(save) || !fs.existsSync(level)) { console.log("skip: no save or no level file"); process.exit(0); }

const dec = b => zlib.gunzipSync(Buffer.from(Buffer.from(b.map(x => x ^ 11)).toString("latin1").replace(/\0/g, "").trim()
  .replace(/-/g, "+").replace(/_/g, "/"), "base64")).toString("utf8");
const enc = x => Buffer.from(Buffer.from(zlib.gzipSync(Buffer.from(x)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_"), "latin1").map(b => b ^ 11));

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gdlm-install-test-"));
const copy = path.join(dir, "CCLocalLevels.dat");
let x = dec(fs.readFileSync(save));
const n = x.indexOf(`<k>k2</k><s>${NAME}</s>`);
if (n < 0) { console.log(`skip: "${NAME}" not in the save`); process.exit(0); }
// strip any real online keys of this record, then put fake ones in
const c = x.lastIndexOf("<k>kCEK</k><i>4</i>", n) + "<k>kCEK</k><i>4</i>".length;
const head = x.slice(c, n).replace(/<k>k(1|16)<\/k><i>[^<]*<\/i>/g, "");
x = x.slice(0, c) + "<k>k1</k><i>999000111</i><k>k16</k><i>3</i>" + head + x.slice(n);
fs.writeFileSync(copy, enc(x));

execFileSync(process.execPath, [path.join(__dirname, "..", "tools", "install.js"), level, "--save", copy], { windowsHide: true, stdio: "pipe" });
const y = dec(fs.readFileSync(copy));
const m = y.indexOf(`<k>k2</k><s>${NAME}</s>`);
const rec = y.slice(y.lastIndexOf("<k>kCEK</k>", m), m);
const ok = rec.includes("<k>k1</k><i>999000111</i>") && rec.includes("<k>k16</k><i>3</i>");
console.log(ok ? "ok: online ID and version kept" : "FAIL: re-install dropped the online ID\n" + rec);

// --slot phone: another level goes into the record holding the slot's ID, keeping the slot's
// server name (the server refuses a rename) and the unlisted flag, without the "this version is
// uploaded" flag k15 (GD refuses to re-share with it), at the top
const other = path.join(__dirname, "..", "levels", "gdlm_43_climb.gdlvl");
let ok2 = true;
if (fs.existsSync(other)) {
  const ids = path.join(dir, "phone_ids.json");
  fs.writeFileSync(ids, JSON.stringify({ slots: { phone: { id: 999000111, name: NAME, holds: { level: NAME }, history: [] } } }));
  execFileSync(process.execPath, [path.join(__dirname, "..", "tools", "install.js"), other, "--save", copy, "--slot", "phone", "--ids", ids], { windowsHide: true, stdio: "pipe" });
  const z = dec(fs.readFileSync(copy));
  const first = z.slice(z.indexOf("<k>k_0</k><d>"), z.indexOf("<k>k_1</k><d>"));
  const j = JSON.parse(fs.readFileSync(ids, "utf8")).slots.phone;
  ok2 = first.includes("<k>k1</k><i>999000111</i>") && first.includes(`<k>k2</k><s>${NAME}</s>`) && !first.includes("<k>k15</k>") && first.includes("<k>k79</k><t />") && (z.match(/<i>999000111<\/i>/g) || []).length === 1
    && j.holds.level === "GDLM 43 climb" && j.history[0].level === NAME;
  console.log(ok2 ? "ok: --slot phone puts the level into the slot's record" : "FAIL: --slot phone\n" + first.slice(0, 300));
}
// --slot lab with no ID yet: the level goes in at the top under the slot's name with the given
// description + signature, no online keys; a second install replaces that same record
let ok3 = true;
if (fs.existsSync(other)) {
  const ids = path.join(dir, "lab_ids.json");
  fs.writeFileSync(ids, JSON.stringify({ slots: { lab: { id: null, name: "Claude Lab", holds: null, history: [], desc: "Lab default." } } }));
  const run = () => execFileSync(process.execPath, [path.join(__dirname, "..", "tools", "install.js"), other, "--save", copy, "--slot", "lab", "--ids", ids, "--desc", "testing X"], { windowsHide: true, stdio: "pipe" });
  // without --desc the slot's own default description is used
  execFileSync(process.execPath, [path.join(__dirname, "..", "tools", "install.js"), other, "--save", copy, "--slot", "lab", "--ids", ids], { windowsHide: true, stdio: "pipe" });
  const z0 = dec(fs.readFileSync(copy)), f0 = z0.slice(z0.indexOf("<k>k_0</k><d>"), z0.indexOf("<k>k_1</k><d>"));
  const dflt = Buffer.from(((f0.match(/<k>k3<\/k><s>([^<]*)<\/s>/) || [])[1] || "").replace(/-/g, "+").replace(/_/g, "/"), "base64").toString();
  run(); run();
  const z = dec(fs.readFileSync(copy));
  const first = z.slice(z.indexOf("<k>k_0</k><d>"), z.indexOf("<k>k_1</k><d>"));
  const d3 = (first.match(/<k>k3<\/k><s>([^<]*)<\/s>/) || [])[1] || "";
  const desc = Buffer.from(d3.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString();
  const j = JSON.parse(fs.readFileSync(ids, "utf8")).slots.lab;
  ok3 = first.includes("<k>k2</k><s>Claude Lab</s>") && !/<k>k(1|15|79)<\/k>/.test(first) && (z.match(/<s>Claude Lab<\/s>/g) || []).length === 1
    && desc.startsWith("testing X -- Made by Claude") && j.holds.level === "GDLM 43 climb" && j.history.length === 2
    && dflt === "Lab default. -- Made by Claude (and some humans)";
  console.log(ok3 ? "ok: --slot lab (no ID yet) installs under its name with the description" : "FAIL: --slot lab\n" + desc + "\n" + first.slice(0, 300));
}
// --ids-from: the slot's record was deleted and the level re-added without its ID (2026-11-24 cleanup);
// the online keys come from an older save, and the same-named copy is replaced (one record, ID back)
let ok4 = true;
if (fs.existsSync(other) && ok2) {
  const ids = path.join(dir, "phone_ids4.json");
  fs.writeFileSync(ids, JSON.stringify({ slots: { phone: { id: 999000111, name: NAME, holds: null, history: [] } } }));
  const older = path.join(dir, "older.dat");
  fs.copyFileSync(copy, older);   // holds NAME with k1 999000111 (from the --slot phone test)
  const cur = dec(fs.readFileSync(copy)).replace(/<k>k(1|16|60)<\/k><i>999000111<\/i>/g, "").replace(/<k>k1<\/k><i>999000111<\/i>/g, "");
  fs.writeFileSync(copy, enc(cur));
  const run = extra => { try { execFileSync(process.execPath, [path.join(__dirname, "..", "tools", "install.js"), level, "--save", copy, "--slot", "phone", "--ids", ids, ...extra], { stdio: "pipe", windowsHide: true }); return 0; } catch (e) { return e.status; } };
  const without = run([]);
  const code = run(["--ids-from", older]);
  const z = dec(fs.readFileSync(copy));
  const first = z.slice(z.indexOf("<k>k_0</k><d>"), z.indexOf("<k>k_1</k><d>"));
  ok4 = without === 4 && code === 0 && first.includes("<k>k1</k><i>999000111</i>") && first.includes("<k>k79</k><t />")
    && (z.match(new RegExp(`<s>${NAME}</s>`, "g")) || []).length === 1;
  console.log(ok4 ? "ok: --ids-from puts a deleted slot record's online ID back on the re-added level" : `FAIL: --ids-from (exit ${without}/${code})\n` + first.slice(0, 300));
}
fs.rmSync(dir, { recursive: true, force: true });
process.exit(ok && ok2 && ok3 && ok4 ? 0 : 1);
