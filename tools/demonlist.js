// node tools/demonlist.js [list | fetch | manifest | all] [--top 150] [--max-mb 1024]
//
// The demon list's levels on this PC, for looking at (layout, deco), never committed:
//   list      the current top N from Pointercrate's public API (api/v2/demons/listed, no account)
//             -> local/community/demonlist_pc.json
//   fetch     downloads Bloodbath, the top N and every former Top 1 (knowledge/levels/demonlist_top1.json,
//             from the fan wiki's "List of Top 1 levels") into local/community/<id>.gdlvl with
//             tools/fetch_level.js: one request every 2.5 s, skips what is there, carries on after errors,
//             stops once local/community's demon files pass --max-mb (default 1024)
//   manifest  local/community/demonlist.json: name, id, list position, Top 1 (when, how long), creator,
//             verifier, size, objects. Files over 5 MB are counted under the heavy-job lock.
//   all       the three in order (default)
// These are other people's levels: they stay in local/ (git-ignored). Only the Top 1 history (public
// names / ids / dates) is in the repo.
const fs = require("fs"), path = require("path"), https = require("https");
const ROOT = path.join(__dirname, "..");
const COMM = path.join(ROOT, "local", "community");
const PC = path.join(COMM, "demonlist_pc.json"), MAN = path.join(COMM, "demonlist.json");
const TOP1 = path.join(ROOT, "knowledge", "levels", "demonlist_top1.json");
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const TOPN = +opt("--top", 150), MAXMB = +opt("--max-mb", 1024);
const step = args.find(a => !a.startsWith("--") && !/^\d+$/.test(a)) || "all";
const sleep = ms => new Promise(r => setTimeout(r, ms));

function getJSON(url) {
  return new Promise((res, rej) => {
    https.get(url, { headers: { "User-Agent": "GDLevelMaker level study", Accept: "application/json" }, timeout: 30000 }, r => {
      let d = ""; r.setEncoding("utf8"); r.on("data", c => d += c);
      r.on("end", () => { try { res(JSON.parse(d)); } catch (e) { rej(new Error("bad json " + r.statusCode)); } });
    }).on("error", rej).on("timeout", function () { this.destroy(new Error("timeout")); });
  });
}

async function list() {
  const all = [];
  for (let after = 0; all.length < TOPN; after += 100) {
    const page = await getJSON(`https://pointercrate.com/api/v2/demons/listed/?limit=100&after=${after}`);
    if (!Array.isArray(page) || !page.length) break;
    all.push(...page); await sleep(1000);
  }
  const rows = all.filter(d => d.position <= TOPN).map(d => ({ position: d.position, name: d.name, id: d.level_id,
    publisher: d.publisher && d.publisher.name, verifier: d.verifier && d.verifier.name, pointercrate: d.id, video: d.video }));
  fs.mkdirSync(COMM, { recursive: true });
  fs.writeFileSync(PC, JSON.stringify({ fetched: new Date().toISOString(), top: rows }, null, 1));
  console.log(`list: top ${rows.length} from Pointercrate -> ${path.relative(ROOT, PC)}`);
  return rows;
}

function wanted() {
  const pc = fs.existsSync(PC) ? JSON.parse(fs.readFileSync(PC, "utf8")).top : [];
  const t1 = JSON.parse(fs.readFileSync(TOP1, "utf8")).levels;
  const m = new Map();
  const add = (id, o) => { if (!id) return; m.set(id, Object.assign(m.get(id) || { id }, o)); };
  add(10565740, { name: "Bloodbath" });
  for (const d of pc) add(d.id, { name: d.name, position: d.position, creator: d.publisher, verifier: d.verifier });
  for (const t of t1) add(t.id, { name: (m.get(t.id) || {}).name || t.name, top1: { kind: t.kind, uploaded: t.uploaded, for: t.top1For },
    creator: (m.get(t.id) || {}).creator || t.creator });
  // Bloodbath first, then Top 1s newest first, then the list in order
  const order = [10565740, ...t1.map(t => t.id), ...pc.map(d => d.id)];
  return [...new Set(order)].filter(id => m.has(id)).map(id => m.get(id));
}

const demonBytes = w => w.reduce((s, x) => { const f = path.join(COMM, x.id + ".gdlvl"); return s + (fs.existsSync(f) ? fs.statSync(f).size : 0); }, 0);

async function fetchAll() {
  const { fetchOne } = require("./fetch_level.js");
  const w = wanted(); let got = 0, had = 0, failed = [];
  for (const x of w) {
    if (demonBytes(w) > MAXMB * 1048576) { console.log(`fetch: stopped, demon files passed ${MAXMB} MB`); break; }
    try {
      const r = await fetchOne(String(x.id), COMM);
      if (r.skipped) { had++; continue; }
      got++; console.log(`${x.id} ${r.name} ${(r.bytes / 1048576).toFixed(2)} MB, ${r.objects} objects` + (x.position ? ` (#${x.position})` : "") + (x.top1 ? " (Top 1)" : ""));
    } catch (e) { failed.push(`${x.id} ${x.name}: ${e.message}`); console.log(x.id, x.name, "FAILED:", e.message); }
    await sleep(2500);
  }
  console.log(`fetch: ${got} new, ${had} already here, ${failed.length} failed; demon files ${(demonBytes(w) / 1048576).toFixed(1)} MB`);
  if (failed.length) console.log(" failed:\n  " + failed.join("\n  "));
}

function manifest() {
  const { GD, unpack } = require("./io.js");
  let old = {}; try { for (const r of JSON.parse(fs.readFileSync(MAN, "utf8")).levels) old[r.id] = r; } catch (e) {}
  let claimed = false; const rows = [];
  for (const x of wanted()) {
    const f = path.join(COMM, x.id + ".gdlvl");
    if (!fs.existsSync(f)) { rows.push(Object.assign({}, x, { missing: true })); continue; }
    const bytes = fs.statSync(f).size;
    let objects = old[x.id] && old[x.id].bytes === bytes ? old[x.id].objects : null, song = old[x.id] && old[x.id].song;
    if (objects == null) {
      if (bytes > 5 * 1048576 && !claimed) { require("./heavy.js").claim(); claimed = true; }
      try { const rec = GD.parseRecord(unpack(fs.readFileSync(f, "utf8"))); const s = unpack(GD.getField(rec, "k4")); objects = s.split(";").length - 2; song = GD.getField(rec, "k45") ? "custom " + GD.getField(rec, "k45") : "official " + (GD.getField(rec, "k8") || 0); } catch (e) { objects = null; }
    }
    rows.push(Object.assign({}, x, { file: path.relative(ROOT, f).replace(/\\/g, "/"), bytes, objects, song }));
  }
  const total = rows.reduce((s, r) => s + (r.bytes || 0), 0);
  fs.writeFileSync(MAN, JSON.stringify({ made: new Date().toISOString(), totalMB: +(total / 1048576).toFixed(1), levels: rows }, null, 1));
  console.log(`manifest: ${rows.filter(r => !r.missing).length} levels here, ${rows.filter(r => r.missing).length} missing, ${(total / 1048576).toFixed(1)} MB -> ${path.relative(ROOT, MAN)}`);
}

(async () => {
  if (step === "list" || step === "all") await list();
  if (step === "fetch" || step === "all") await fetchAll();
  if (step === "manifest" || step === "all") manifest();
})();
