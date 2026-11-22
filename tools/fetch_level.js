// node tools/fetch_level.js <id> [<id> ...]   [--out local/community]
//
// Downloads online levels by ID from GD's own server (the same request the game makes when you
// press "download"), and writes each as local/community/<id>.gdlvl so the other tools can
// measure it (`node tools/style.js local/community/<id>.gdlvl --detail`).
// These are other people's levels: they stay in local/ (git-ignored), never committed, never
// installed into the save. Only numbers measured from them go into knowledge/.
// One request every 2 s, so the server is not hammered.
const fs = require("fs"), path = require("path"), http = require("http"), qs = require("querystring");
const { GD, pack, unpack } = require("./io.js");

function post(levelID) {
  const body = qs.stringify({ levelID, secret: "Wmfd2893gb7" });
  return new Promise((res, rej) => {
    const req = http.request({
      host: "www.boomlings.com", path: "/database/downloadGJLevel22.php", method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "Content-Length": Buffer.byteLength(body), "User-Agent": "" },
      timeout: 30000,
    }, r => { let d = ""; r.setEncoding("latin1"); r.on("data", c => d += c); r.on("end", () => res(d)); });
    req.on("error", rej); req.on("timeout", () => req.destroy(new Error("timeout")));
    req.end(body);
  });
}

// response: "1:id:2:name:3:desc:4:levelstring:...#hash#..."
function parse(resp) {
  const head = resp.split("#")[0], p = head.split(":"), kv = {};
  for (let i = 0; i + 1 < p.length; i += 2) kv[p[i]] = p[i + 1];
  return kv;
}

async function main() {
  const args = process.argv.slice(2);
  let out = "local/community";
  const oi = args.indexOf("--out"); if (oi >= 0) { out = args[oi + 1]; args.splice(oi, 2); }
  fs.mkdirSync(out, { recursive: true });
  for (const id of args) {
    const file = path.join(out, id + ".gdlvl");
    if (fs.existsSync(file)) { console.log(id, "already here"); continue; }
    let kv;
    try { const r = await post(id); if (r.trim() === "-1" || !r.includes(":4:")) throw new Error("server said " + r.slice(0, 20)); kv = parse(r); }
    catch (e) { console.log(id, "FAILED:", e.message); continue; }
    let lvl = kv[4];
    if (!lvl.startsWith("H4sI")) lvl = pack(lvl); // very old levels are stored uncompressed
    // some old levels hold one more layer inside: base64(zlib(level string)) ("eJ...")
    let inner = unpack(lvl);
    while (/^(eJ|H4sI)/.test(inner)) inner = require("zlib").unzipSync(Buffer.from(GD.b64urlToBytes(inner))).toString("utf8");
    lvl = pack(inner);
    const rec = GD.newRecord(kv[2] || id, GD.decodeDesc(kv[3]));
    GD.setField(rec, "k4", "s", lvl);
    if (kv[35] && kv[35] !== "0") GD.setField(rec, "k45", "i", kv[35]);
    else GD.setField(rec, "k8", "i", kv[12] || "0");
    fs.writeFileSync(file, pack(GD.serializeRecord(rec)));
    console.log(id, (kv[2] || "").trim(), "->", file, "song", kv[35] && kv[35] !== "0" ? "custom " + kv[35] : "official " + (kv[12] || 0));
    await new Promise(r => setTimeout(r, 2000));
  }
}
main();
