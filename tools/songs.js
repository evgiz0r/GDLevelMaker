// node tools/songs.js [--info] <id> [<id> ...]   -- get custom songs by id, the way GD does
// node tools/songs.js --levels [--info]          -- every custom song the repo's levels, examples/
//                                                   and local/community/ use, that this PC lacks
// node tools/songs.js --phone                    -- copy the songs the repo's levels use into the
//                                                   user's OneDrive "GD songs" folder (phone page)
// node tools/songs.js --list                     -- what is where
//
// Where songs live: the game's own copy first (%LOCALAPPDATA%/GeometryDash/<id>.mp3|ogg, the
// songs the user downloaded in GD), then the shared cache local/songs/<id>.mp3|ogg that this tool
// fills (never committed: songs belong to their artists; local/ is gitignored). serve.js and
// beats.js look in both (songFile below).
//
// How GD gets a song: it POSTs the id to boomlings.com/database/getGJSongInfo.php and gets back
// "1~|~id~|~2~|~name~|~3~|~artistId~|~4~|~artist~|~5~|~MB~|~...~|~10~|~<url-encoded mp3 url>"
// (Newgrounds, audio.ngfiles.com), or "-1"/"-2" when the song is missing or not allowed. Ids from
// 10000000 up are GD 2.2's own music library (NCS and others), served as .ogg from RobTop's CDN.
// --info only asks for the song info (name, artist, size, url) and downloads nothing.
// Politeness: one request at a time, 3 s apart; never parallel. Meta goes to local/songs/<id>.json.
const fs = require("fs"), path = require("path"), https = require("https"), http = require("http"), qs = require("querystring");
const ROOT = path.join(__dirname, "..");
const SAVE = require("./gdpaths.js").SAVE;
const CACHE = path.join(ROOT, "local", "songs");
const LIBRARY_CDN = process.env.GD_MUSIC_CDN || "https://geometrydashfiles.b-cdn.net/music/";
const PHONE_DIR = process.env.GD_PHONE_SONGS || path.join(process.env.USERPROFILE || "", "OneDrive", "GD songs");
const UA = "GDLevelMaker-song-fetch"; // generic; no personal details

// the local file for a custom song id, or null
function songFile(id) {
  for (const dir of [SAVE, CACHE]) for (const ext of ["mp3", "ogg"]) {
    const f = path.join(dir, `${id}.${ext}`);
    if (fs.existsSync(f) && fs.statSync(f).size > 1000) return f;
  }
  return null;
}

function request(url, opts, body) {
  return new Promise((res, rej) => {
    const u = new URL(url), lib = u.protocol === "http:" ? http : https;
    const req = lib.request(u, Object.assign({ timeout: 60000 }, opts), r => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) { r.resume(); return res(request(new URL(r.headers.location, url).href, { method: "GET", headers: { "User-Agent": UA } })); }
      const chunks = []; r.on("data", c => chunks.push(c)); r.on("end", () => res({ status: r.statusCode, type: r.headers["content-type"] || "", body: Buffer.concat(chunks) }));
    });
    req.on("error", rej); req.on("timeout", () => req.destroy(new Error("timeout")));
    req.end(body);
  });
}
async function songInfo(id) {
  const body = qs.stringify({ songID: id, secret: "Wmfd2893gb7" });
  const r = await request("https://www.boomlings.com/database/getGJSongInfo.php", { method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "Content-Length": Buffer.byteLength(body), "User-Agent": "" } }, body);
  const text = r.body.toString("utf8").trim();
  if (!text.includes("~|~")) return { id, ok: false, why: `server answered "${text.slice(0, 20)}" (missing, or not allowed in GD)` };
  const p = text.split("~|~"), kv = {};
  for (let i = 0; i + 1 < p.length; i += 2) kv[p[i]] = p[i + 1];
  return { id, ok: true, name: kv[2], artist: kv[4], mb: +kv[5] || null, url: decodeURIComponent(kv[10] || "") };
}
async function fetchSong(id, infoOnly) {
  const have = songFile(id);
  if (have) return { id, ok: true, file: have, already: true };
  let meta;
  if (+id >= 10000000) meta = { id, ok: true, name: "(GD music library)", url: LIBRARY_CDN + id + ".ogg", library: true };
  else meta = await songInfo(id);
  fs.mkdirSync(CACHE, { recursive: true });
  fs.writeFileSync(path.join(CACHE, id + ".json"), JSON.stringify(Object.assign({ checked: new Date().toISOString() }, meta), null, 1));
  if (!meta.ok || !meta.url || infoOnly) return meta;
  await sleep(3000);
  const r = await request(meta.url, { method: "GET", headers: { "User-Agent": UA } });
  if (r.status !== 200 || r.body.length < 10000 || /text|html|json/.test(r.type)) return Object.assign(meta, { ok: false, why: `download gave HTTP ${r.status}, ${r.body.length} bytes, ${r.type}` });
  const ext = meta.library || /ogg/.test(r.type) ? "ogg" : "mp3";
  const file = path.join(CACHE, `${id}.${ext}`);
  fs.writeFileSync(file, r.body);
  return Object.assign(meta, { file, bytes: r.body.length });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

// custom song ids used by the repo's levels, examples/ and local/community/ -> [files]
function usedSongs(dirs) {
  const { GD, unpack } = require("./io.js");
  const ids = {};
  for (const d of dirs || ["levels", "examples", "local/community"]) {
    const dir = path.join(ROOT, d);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter(f => f.endsWith(".gdlvl"))) {
      try { const s = GD.getField(GD.parseRecord(unpack(fs.readFileSync(path.join(dir, f), "utf8"))), "k45"); if (s && +s > 0) (ids[s] = ids[s] || []).push(d + "/" + f); } catch (e) {}
    }
  }
  return ids;
}

async function main() {
  const args = process.argv.slice(2), infoOnly = args.includes("--info");
  if (args.includes("--list")) {
    const used = usedSongs();
    for (const id of Object.keys(used).sort((a, b) => a - b)) {
      const f = songFile(id), m = fs.existsSync(path.join(CACHE, id + ".json")) ? JSON.parse(fs.readFileSync(path.join(CACHE, id + ".json"), "utf8")) : null;
      console.log(`${id.padStart(9)}  ${f ? (f.startsWith(SAVE) ? "game  " : "cache ") : m && !m.ok ? "n/a   " : "-     "} ${m && m.name ? m.name + (m.artist ? " by " + m.artist : "") : ""}  (${used[id].length} level${used[id].length > 1 ? "s" : ""})`);
    }
    return;
  }
  if (args.includes("--phone")) {
    const { GD, unpack } = require("./io.js");
    const OFFICIAL_DIR = path.join(require("./gdpaths.js").GAME, "Resources");
    const NAMES = require("./beats.js").OFFICIAL;
    fs.mkdirSync(PHONE_DIR, { recursive: true });
    const want = new Set();
    for (const f of fs.readdirSync(path.join(ROOT, "levels")).filter(f => f.endsWith(".gdlvl"))) {
      const rec = GD.parseRecord(unpack(fs.readFileSync(path.join(ROOT, "levels", f), "utf8")));
      const c = GD.getField(rec, "k45"), o = GD.getField(rec, "k8");
      // the songs its Song triggers switch to too (k104, lib/music.js)
      for (const x of String(GD.getField(rec, "k104") || "").split(",").filter(x => +x > 0 && x !== c)) { const s = songFile(x); if (s) want.add(s); else console.log(`${f}: song ${x} not on this PC (node tools/songs.js ${x})`); }
      if (c && +c > 0) { const s = songFile(c); if (s) want.add(s); else console.log(`${f}: song ${c} not on this PC (node tools/songs.js ${c})`); }
      else { const n = NAMES[+(o || 0)]; if (n) want.add(path.join(OFFICIAL_DIR, n + ".mp3")); }
    }
    for (const s of want) { const to = path.join(PHONE_DIR, path.basename(s)); if (!fs.existsSync(to)) { fs.copyFileSync(s, to); console.log("copied", path.basename(s)); } }
    console.log(`${want.size} songs in ${PHONE_DIR}`);
    return;
  }
  let ids = args.filter(a => /^\d+$/.test(a));
  if (args.includes("--levels")) ids = Object.keys(usedSongs()).filter(id => !songFile(id)).sort((a, b) => a - b);
  if (!ids.length) { console.log("usage: node tools/songs.js [--info] <id>... | --levels | --phone | --list"); process.exit(1); }
  let got = 0, bytes = 0;
  for (const id of ids) {
    let r;
    try { r = await fetchSong(id, infoOnly); } catch (e) { r = { id, ok: false, why: e.message }; }
    if (r.ok && r.file) { got++; bytes += r.bytes || 0; }
    console.log(`${id}: ` + (r.already ? `already here (${r.file})` : !r.ok ? `not fetched: ${r.why}` :
      `${r.name || ""}${r.artist ? " by " + r.artist : ""}${r.mb ? `, ${r.mb} MB` : ""}${r.file ? ` -> ${path.relative(ROOT, r.file)}` : infoOnly ? `  ${r.url}` : ""}`));
    await sleep(3000);
  }
  if (!infoOnly) console.log(`${got}/${ids.length} songs on this PC; ${(bytes / 1e6).toFixed(1)} MB downloaded. Next: node tools/beats.js`);
}
module.exports = { songFile, songInfo, usedSongs, CACHE };
if (require.main === module) main();
