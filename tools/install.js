// node tools/install.js <level.gdlvl> [...] [--save <path>] [--dry]   (also: the length label k23 and the song in the game's song list, PUBLISH.md)
// node tools/install.js <level.gdlvl> --slot phone|lab [--desc "what is tested"] [--ids <phone_ids.json>] [--ids-from <older save .dat>]
//   (the online slots, PUBLISH.md: the level goes in under the slot's fixed name; --desc sets the
//   description, with the signature line)
//
// Puts levels straight into the game's save (Windows: %LOCALAPPDATA%\GeometryDash\CCLocalLevels.dat)
// so they appear at the top of Create -> My Levels. A level with the same name is replaced in
// place, so re-installing after an edit updates it instead of piling up copies; a level already
// shared online keeps its online ID (k1/k16/k60), so Share again updates that upload (PUBLISH.md).
//
// With the game CLOSED it writes the save itself. With GD RUNNING (it rewrites the save when it exits, wiping anything
// put in meanwhile) it hands each level to the probe mod's install inbox instead (tools/hotinstall.js, mod v0.6.0+,
// GEODE.md "Install into a running GD"): the mod adds it to My Levels on a menu (never during play), keeps the online ID,
// lets GD save, and answers; install.js waits --wait <s> (default 20) and reads the save back. While the user is in a
// level the request waits until they leave it. Mod not loaded / older: the level goes to the install queue
// (tools/install_queue.js). --slot still needs GD closed (or the queue).
// Every run first copies the save to GeometryDash\gdlm_backups\ (restore = copy it back).
// --dry writes nothing to the save: it builds the new save in memory and checks it decodes.
//
// Save format: XOR every byte with 11 -> base64url -> gzip -> plist. Levels are the dict under
// LLM_01, keys k_0 (newest) .. k_N, each the same record a .gdlvl holds.
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { execSync } = require("child_process");
const { unpack } = require("./io.js");

function decodeSave(buf) {
  const s = Buffer.from(buf.map(b => b ^ 11)).toString("latin1").replace(/\0/g, "").trim();
  return zlib.gunzipSync(Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64")).toString("utf8");
}
function encodeSave(xml) {
  const b64 = zlib.gzipSync(Buffer.from(xml, "utf8")).toString("base64").replace(/\+/g, "-").replace(/\//g, "_");
  return Buffer.from(Buffer.from(b64, "latin1").map(b => b ^ 11));
}
function gameRunning() {
  try { return /GeometryDash\.exe/i.test(execSync("tasklist", { windowsHide: true, encoding: "utf8" })); } catch (e) { return false; }
}
function levelNames(xml) {
  return [...xml.matchAll(/<k>(k_\d+)<\/k><d><k>kCEK<\/k><i>4<\/i>[\s\S]*?<k>k2<\/k><s>([^<]*)<\/s>/g)].map(m => m[2]);
}
// the level dicts under LLM_01, as [{key, text}] with balanced <d> nesting
function splitLevels(xml) {
  const start = xml.indexOf("<k>LLM_01</k><d>");
  if (start < 0) throw new Error("no LLM_01 in save");
  let i = start + "<k>LLM_01</k><d>".length, depth = 1, j = i;
  while (depth > 0) {
    const o = xml.indexOf("<d>", j), c = xml.indexOf("</d>", j);
    if (o >= 0 && o < c) { depth++; j = o + 3; } else { depth--; j = c + 4; }
  }
  const body = xml.slice(i, j - 4), items = [];
  let head = "", k = 0;
  const re = /<k>(k_\d+)<\/k><d>/g;
  const first = body.search(re);
  head = body.slice(0, first);
  k = first;
  while (k < body.length) {
    const m = /^<k>(k_\d+)<\/k><d>/.exec(body.slice(k));
    if (!m) throw new Error("unexpected save layout at " + k);
    let p = k + m[0].length, d = 1;
    while (d > 0) {
      const o = body.indexOf("<d>", p), c = body.indexOf("</d>", p);
      if (o >= 0 && o < c) { d++; p = o + 3; } else { d--; p = c + 4; }
    }
    items.push({ key: m[1], inner: body.slice(k + m[0].length, p - 4) });
    k = p;
  }
  return { before: xml.slice(0, i), head, items, after: xml.slice(j - 4) };
}
function joinLevels(parts) {
  return parts.before + parts.head + parts.items.map((it, n) => `<k>k_${n}</k><d>${it.inner}</d>`).join("") + parts.after;
}
// the short player-facing description from the level's spec ("desc", STYLE.md "Name and description"):
// a level file built before that rule may still carry the old note-like text
function specDesc(levelName) {
  const dir = path.join(__dirname, "..", "specs");
  try {
    for (const f of fs.readdirSync(dir).filter(f => f.endsWith(".json"))) {
      try { const j = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); if (j.name === levelName && j.desc) return j.desc; } catch (e) {}
    }
  } catch (e) {}
  return null;
}
function setDesc(inner, text) {
  const d = Buffer.from(require("./signature.js").describe(text)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_");
  return /<k>k3<\/k><s>/.test(inner) ? inner.replace(/<k>k3<\/k><s>[^<]*<\/s>/, `<k>k3</k><s>${d}</s>`)
    : inner.replace(/(<k>k2<\/k><s>[^<]*<\/s>)/, `$1<k>k3</k><s>${d}</s>`);
}
function nameOf(inner) { const m = inner.match(/<k>k2<\/k><s>([^<]*)<\/s>/); return m ? m[1] : ""; }
// A level already shared online carries k1 (its online ID), k79 (true = unlisted), and maybe k16
// (upload version) and k60 (account id). Replacing the record must keep them, or GD would upload
// the new version as a NEW level, or as listed. NOT k15 (true = "this version is uploaded"): GD
// clears it when a level is edited, and with it kept GD refuses Share ("This version has already
// been submitted", seen 2026-11-23).
const ONLINE_KEYS = ["k1", "k16", "k60", "k79"];
function entry(inner, k) { const m = inner.match(new RegExp(`<k>${k}</k>(<(i|s|r)>[^<]*</\\2>|<t />)`)); return m ? m[0] : null; }
function keepOnline(oldInner, newInner) {
  let inner = newInner, id = null;
  for (const k of ONLINE_KEYS) {
    const old = entry(oldInner, k);
    if (!old || entry(inner, k)) continue;
    if (k === "k1") id = old.replace(/<[^>]+>/g, "").replace(/^k1/, "");
    inner = inner.replace(/^(<k>kCEK<\/k><i>4<\/i>)?/, m => m + old);
  }
  return { inner, id };
}

// GD's length label (k23: 0 Tiny < 10 s, 1 Short < 30, 2 Medium < 60, 3 Long < 120, 4 XL), from the level's own time to its
// last object (speed portals counted). Our records were all written Short (lib/gd.js newRecord): GDLM 72, 1:27, showed
// "Short" in the game (the user, 2026-11-25).
function lengthCode(file) {
  try {
    const io = require("./io.js"), GD = io.GD, L = io.readGdlvl(file); Object.assign(GD, require("../lib/sync.js"));
    const xs = L.level.objects.map(o => o.x).filter(x => x != null), end = Math.max(...xs);
    let t; try { t = GD.SYNC.tOfX(GD.SYNC.timeline(GD.makeWorld(L.level.objects, L.level.header)), end); } catch (e) { t = end / 311.58; }
    return { code: t < 10 ? 0 : t < 30 ? 1 : t < 60 ? 2 : t < 120 ? 3 : 4, secs: t };
  } catch (e) { return null; }
}
function setLength(inner, code) {
  return /<k>k23<\/k><i>/.test(inner) ? inner.replace(/<k>k23<\/k><i>[^<]*<\/i>/, `<k>k23</k><i>${code}</i>`)
    : inner.replace(/^(<k>kCEK<\/k><i>4<\/i>)?/, m => m + `<k>k23</k><i>${code}</i>`);
}
// A custom song (k45) shows "Unknown" in the game until its info is in the game's song list (CCGameManager.dat, MDLM_001):
// the user has to find the song in the editor and download it (GDLM 72's Dot, 2026-11-25). So install adds the entry,
// from GD's own song server (getGJSongInfo: name, artist, artist id, size, url), local/songs/<id>.json as the fallback.
function songIds(inners) { return [...new Set(inners.map(i => (i.match(/<k>k45<\/k><i>(\d+)<\/i>/) || [])[1]).filter(Boolean))]; }
function songInfo(id) {
  const esc = v => String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  let info = null;
  try {
    const r = require("child_process").spawnSync("curl", ["-s", "-m", "15", "-A", "", "-X", "POST", "https://www.boomlings.com/database/getGJSongInfo.php",
      "--data", `songID=${id}&secret=Wmfd2893gb7`], { windowsHide: true, encoding: "utf8" });
    const p = (r.stdout || "").split("~|~"), m = {}; for (let i = 0; i + 1 < p.length; i += 2) m[p[i]] = p[i + 1];
    if (m[1] == id) info = { name: m[2], artistId: m[3], artist: m[4], mb: m[5], url: decodeURIComponent(m[10] || "") };
  } catch (e) {}
  if (!info) try { const j = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "local", "songs", id + ".json"), "utf8")); info = { name: j.name, artist: j.artist, mb: j.mb, url: j.url }; } catch (e) {}
  if (!info || !info.name) return null;
  return `<k>${id}</k><d><k>kCEK</k><i>6</i><k>1</k><i>${id}</i><k>2</k><s>${esc(info.name)}</s><k>4</k><s>${esc(info.artist || "")}</s>` +
    (info.artistId ? `<k>3</k><i>${info.artistId}</i>` : "") + (info.mb ? `<k>5</k><r>${info.mb}</r>` : "") + (info.url ? `<k>10</k><s>${esc(info.url)}</s>` : "") + "</d>";
}
// adds the missing songs to CCGameManager.dat next to the level save (backed up first); returns what it did
function addSongs(ids, levelSave, dry, { mp3Only = false } = {}) {
  const gm = path.join(path.dirname(levelSave), "CCGameManager.dat");
  if (!ids.length || !fs.existsSync(gm)) return [];
  const out = [], add = [];
  // the mp3 itself: GD plays <id>.mp3 from its own folder and had never downloaded Dot ("no music", GDLM 72, 2026-11-25);
  // our song cache (local/songs, tools/songs.js) holds the same file GD would fetch
  for (const id of ids) {
    const mp3 = path.join(path.dirname(levelSave), id + ".mp3"), src = path.join(__dirname, "..", "local", "songs", id + ".mp3");
    if (fs.existsSync(mp3)) continue;
    if (!fs.existsSync(src)) { out.push(`song ${id}: no mp3 in local/songs (node tools/songs.js ${id}); GD downloads it on a tap`); continue; }
    if (!dry) fs.copyFileSync(src, mp3);
    out.push(`song ${id}: mp3 copied into GD's folder`);
  }
  if (mp3Only) return out;   // GD runs: CCGameManager.dat is its to write; the mod asks GD for the song's info
  const xml = decodeSave(fs.readFileSync(gm)), tag = "<k>MDLM_001</k><d>", at = xml.indexOf(tag);
  if (at < 0) return out.concat(["no song list (MDLM_001) in CCGameManager.dat: songs not added"]);
  for (const id of ids) {
    if (xml.includes(`<k>${id}</k><d><k>kCEK</k><i>6</i>`)) { out.push(`song ${id} already in the game's song list`); continue; }
    const e = songInfo(id); if (!e) { out.push(`song ${id}: no info found, not added (download it in the editor)`); continue; }
    add.push(e); out.push(`song ${id} added to the game's song list`);
  }
  if (!add.length || dry) return out;
  const nx = xml.slice(0, at + tag.length) + add.join("") + xml.slice(at + tag.length), enc = encodeSave(nx);
  if (decodeSave(enc) !== nx) throw new Error("re-encoded CCGameManager does not decode back; not writing");
  const bdir = path.join(path.dirname(gm), "gdlm_backups"); fs.mkdirSync(bdir, { recursive: true });
  fs.copyFileSync(gm, path.join(bdir, `CCGameManager.${new Date().toISOString().replace(/[:.]/g, "-")}.dat`));
  fs.writeFileSync(gm, enc);
  return out;
}

// the record's inner dict as it goes into the save: the spec's short description, the length label
function prepare(f) {
  const rec = unpack(fs.readFileSync(f, "utf8"));
  let inner = rec.match(/<plist[^>]*><dict>([\s\S]*)<\/dict><\/plist>/)[1];
  const name = nameOf(inner);
  const sd = specDesc(name);
  if (sd) inner = setDesc(inner, sd);   // the spec's short description wins over an old one in the file
  const len = lengthCode(f);
  if (len) { inner = setLength(inner, len.code); console.log(`length: ${["Tiny", "Short", "Medium", "Long", "XL"][len.code]} (${len.secs.toFixed(0)} s)`); }
  return { name, inner };
}
const levelString = inner => (inner.match(/<k>k4<\/k><s>([^<]*)<\/s>/) || [])[1] || "";

// GD runs: the probe mod's install inbox (tools/hotinstall.js), else the install queue. Returns the exit code:
// 0 installed, 3 not installed now (queued, or waiting in the inbox), 5 the mod refused one.
function hot(files, save, args, H = require("./hotinstall.js")) {
  if (args.includes("--slot")) { console.log("Geometry Dash is running: --slot needs it closed (or: node tools/install_queue.js add ...)."); return 3; }
  const ready = H.modReady();
  if (!ready.ok) {
    console.log(`Geometry Dash is running and the install inbox is not available (${ready.why}).`);
    const r = require("child_process").spawnSync(process.execPath, [path.join(__dirname, "install_queue.js"), "add", ...files, "--by", "install.js"], { windowsHide: true, encoding: "utf8" });
    process.stdout.write(r.stdout || ""); process.stderr.write(r.stderr || "");
    console.log("queued: the install queue's watcher installs it when GD closes (node tools/install_queue.js watch).");
    return 3;
  }
  // the save as GD last wrote it: backed up first, as for a closed-game install
  const bdir = path.join(path.dirname(save), "gdlm_backups"); fs.mkdirSync(bdir, { recursive: true });
  const backup = path.join(bdir, `CCLocalLevels.${new Date().toISOString().replace(/[:.]/g, "-")}.dat`);
  if (fs.existsSync(save)) fs.copyFileSync(save, backup);
  console.log(`GD is running with the probe mod ${ready.status.version}: installing through its inbox. backup: ${backup}`);
  const reqs = files.map(f => { const p = prepare(f); return { ...p, file: f, id: H.request(p.name, p.inner) }; });
  // the mp3 is a plain file in GD's folder (safe while it runs); the song's info is asked by the mod
  try { for (const l of addSongs(songIds(reqs.map(r => r.inner)), save, false, { mp3Only: true })) console.log(l); } catch (e) { console.log("songs: " + e.message); }
  const wi = args.indexOf("--wait"), wait = (wi >= 0 ? +args[wi + 1] : 20) * 1000;
  const res = H.waitResults(reqs.map(r => r.id), { wait });
  let code = 0, xml = null;
  for (const r of reqs) {
    const a = res[r.id];
    if (!a) { console.log(`"${r.name}": waiting in GD's inbox (GD is in a level or the editor?): it goes in when the user is back on a menu. Check: node tools/hotinstall.js results`); code = Math.max(code, 3); continue; }
    if (a.status !== "installed") { console.log(`"${r.name}": NOT installed: ${a.why}`); code = 5; continue; }
    let check = "; GD saves it when it exits";
    if (a.saved) {
      try {
        xml = xml || decodeSave(fs.readFileSync(save));
        const it = splitLevels(xml).items.find(it => nameOf(it.inner) === r.name);
        check = !it ? "; !! not found in the saved file" : levelString(it.inner) === levelString(r.inner) ? "; read back from the save: same level data" : "; !! the saved level data differs";
      } catch (e) { check = "; read-back failed: " + e.message; }
    }
    console.log(`"${r.name}": ${a.replaced ? `replaced (position ${a.position})` : "added at the top"} of My Levels` +
      (a.online_id > 0 ? `, kept online ID ${a.online_id}` : "") + `, song ${a.song}${check}`);
  }
  return code;
}

function main() {
  const args = process.argv.slice(2);
  const dry = args.includes("--dry");
  const si = args.indexOf("--save");
  const save = si >= 0 ? args[si + 1] : path.join(require("./gdpaths.js").SAVE, "CCLocalLevels.dat");
  const files = args.filter((a, n) => a.endsWith(".gdlvl") && args[n - 1] !== "--save");
  if (!files.length) { console.log("usage: node tools/install.js <level.gdlvl> [...] [--save path] [--dry]"); process.exit(1); }
  if (!dry && si < 0 && gameRunning()) process.exit(hot(files, save, args));

  const buf = fs.readFileSync(save);
  const xml = decodeSave(buf);
  const parts = splitLevels(xml);
  if (joinLevels(parts) !== xml) throw new Error("save did not split/join cleanly; refusing to touch it");

  // --slot phone: put the level into the save record that holds the slot's online ID (PUBLISH.md),
  // so Share updates that one upload instead of making a new level. It keeps the slot's server name
  // (slots.<slot>.name): GD locks a shared level's name, and the server refused an update under a
  // new name ("Upload Failed" twice, 2026-11-23, renamed "GDLM phone: 44 hellgate").
  const sl = args.indexOf("--slot");
  const slotName = sl >= 0 ? args[sl + 1] : null;
  const ii = args.indexOf("--ids");
  const idsFile = ii >= 0 ? args[ii + 1] : path.join(__dirname, "..", "local", "phone_ids.json");
  let slotDone = null;
  if (slotName) {
    if (files.length !== 1) { console.log("--slot takes exactly one level"); process.exit(1); }
    const ids = JSON.parse(fs.readFileSync(idsFile, "utf8"));
    const slot = ids.slots && ids.slots[slotName];
    if (!slot) { console.log(`no slot "${slotName}" in ${idsFile}`); process.exit(1); }
    // a slot with no ID yet (never uploaded, e.g. "lab"): its record is found by the slot's name, or
    // made; its first Share creates the ID (record it in phone_ids.json after GD has exited once)
    const fresh = !slot.id;
    if (fresh && !slot.name) { console.log(`slot "${slotName}" has neither an id nor a name`); process.exit(1); }
    const hasId = it => (entry(it.inner, "k1") || "").includes(`<i>${slot.id}</i>`);
    let at = fresh ? parts.items.findIndex(it => nameOf(it.inner) === slot.name) : parts.items.findIndex(hasId);
    // --ids-from <older save .dat>: the record holding the slot's ID was deleted from the save (2026-11-24:
    // a cleanup removed every GDLM level). Take its online keys from an older save / backup instead; a
    // same-named copy in the save (the level re-added without its ID) is replaced, so there is one record.
    let fromOld = null;
    const fi = args.indexOf("--ids-from");
    if (at < 0 && !fresh && fi >= 0) {
      const oldParts = splitLevels(decodeSave(fs.readFileSync(args[fi + 1])));
      const o = oldParts.items.find(hasId);
      if (!o) { console.log(`no level with online ID ${slot.id} in ${args[fi + 1]} either`); process.exit(4); }
      fromOld = o.inner;
      at = parts.items.findIndex(it => nameOf(it.inner) === slot.name);
      console.log(`online ID ${slot.id} taken from ${args[fi + 1]} ("${nameOf(o.inner)}")` + (at >= 0 ? `; replaces the same-named copy at position ${at + 1}` : ""));
    }
    if (at < 0 && !fresh && !fromOld) { console.log(`no level with online ID ${slot.id} in the save. GD writes the ID when it exits after the upload; close GD once, then retry (or --ids-from <older save> if the record was deleted).`); process.exit(4); }
    const rec = unpack(fs.readFileSync(files[0], "utf8"));
    let inner = rec.match(/<plist[^>]*><dict>([\s\S]*)<\/dict><\/plist>/)[1];
    const old = fromOld || (at >= 0 ? parts.items[at].inner : "");
    const own = nameOf(inner), was = at >= 0 ? nameOf(old) : "(new)";
    const name = slot.name || was;
    inner = inner.replace(/<k>k2<\/k><s>[^<]*<\/s>/, `<k>k2</k><s>${name}</s>`);
    // --desc "what is being tested": the description for this upload, with the signature line
    // (default: the slot's own "desc" in phone_ids.json, e.g. the lab's; else the level spec's "desc")
    const di = args.indexOf("--desc"), descText = di >= 0 ? args[di + 1] : (slot.desc || specDesc(own));
    if (descText) { inner = setDesc(inner, descText); console.log(`description: ${require("./signature.js").describe(descText)}`); }
    const kept = keepOnline(old, inner);
    // a shared slot is unlisted by definition (even if an earlier install dropped the flag); a fresh
    // one gets Unlisted ticked in GD's share form at its first upload. The new level is a new
    // version, not the one already uploaded (no k15).
    if (!fresh && !entry(kept.inner, "k79")) kept.inner = kept.inner.replace(/^(<k>kCEK<\/k><i>4<\/i>)?/, m => m + "<k>k79</k><t />");
    kept.inner = kept.inner.replace(/<k>k15<\/k>(<t \/>|<i>[^<]*<\/i>)/, "");
    if (at >= 0) parts.items.splice(at, 1);
    parts.items.unshift({ key: "", inner: kept.inner });
    console.log(`slot "${slotName}" (${fresh ? (kept.id ? `online ID ${kept.id} in the save but not in ${idsFile}: record it` : "no online ID yet: its first Share creates one, tick Unlisted") : `online ID ${slot.id}`}): "${was}" -> "${name}", now at the top of My Levels. Share it only with the user's yes.`);
    slotDone = { ids, slot, entry: { level: own, name, file: files[0].replace(/\\/g, "/"), installed: new Date().toISOString().slice(0, 10), shared: null, ...(descText ? { desc: descText } : {}) } };
  }

  const installed = [];
  for (const f of slotName ? [] : files) {
    const { name, inner } = prepare(f);
    installed.push(inner);
    const at = parts.items.findIndex(it => nameOf(it.inner) === name);
    if (at >= 0) {
      const kept = keepOnline(parts.items[at].inner, inner);
      parts.items[at].inner = kept.inner;
      console.log(`replaced "${name}" (position ${at + 1})` + (kept.id ? `, kept online ID ${kept.id}: pressing Share again updates that same upload (PUBLISH.md)` : ""));
    }
    else { parts.items.unshift({ key: "", inner }); console.log(`added "${name}" at the top`); }
  }
  const out = joinLevels(parts);
  const enc = encodeSave(out);
  if (decodeSave(enc) !== out) throw new Error("re-encoded save does not decode back; not writing");
  console.log("levels now:", levelNames(out).slice(0, 8).join(" | "), levelNames(out).length > 8 ? `... (${levelNames(out).length})` : "");
  const songIdsNow = songIds(installed.concat(slotDone ? [parts.items[0].inner] : []));
  if (dry) { for (const l of addSongs(songIdsNow, save, true)) console.log(l); console.log("dry run: nothing written"); return; }

  const bdir = path.join(path.dirname(save), "gdlm_backups");
  fs.mkdirSync(bdir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backup = path.join(bdir, `CCLocalLevels.${stamp}.dat`);
  fs.copyFileSync(save, backup);
  fs.writeFileSync(save, enc);
  console.log(`written. backup: ${backup}`);
  // a request still waiting in the running-game inbox for one of these levels is older than what was just written
  // (only for the game's own save: a --save copy is a test)
  if (si < 0) try { const gone = require("./hotinstall.js").dropPending(installed.map(nameOf).concat(slotDone ? [slotDone.entry.name] : [])); if (gone.length) console.log(`dropped older inbox requests: ${gone.join(", ")}`); } catch (e) {}
  try { for (const l of addSongs(songIdsNow, save, false)) console.log(l); } catch (e) { console.log("songs: " + e.message); }
  if (slotDone) {
    const { ids, slot, entry: e } = slotDone;
    if (slot.holds) (slot.history = slot.history || []).push(slot.holds);
    slot.holds = e;   // "shared": null until it is re-shared in GD; set it then (PUBLISH.md)
    fs.writeFileSync(idsFile, JSON.stringify(ids, null, 2) + "\n");
    console.log(`${idsFile}: slot "${slotName}" now holds ${e.level} (not shared yet)`);
  }
}
if (require.main === module) main();
module.exports = { decodeSave, encodeSave, splitLevels, joinLevels, levelNames, nameOf, entry, gameRunning, lengthCode, songInfo, addSongs, prepare, hot };
