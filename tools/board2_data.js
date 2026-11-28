// node tools/board2_data.js [--local <dir>] [--stats <stats.json>] [--out <data.json>]
//   Builds the data file of the new work board (board2/README.md): the main levels' solve state (tools/board_mains.js
//   on local/mains + local/difficulty), the board's section types with their check (knowledge/layout_check.json), the
//   section-generation and join stats from the stats report (--stats, any shape: rows are shown as tables), and our
//   levels with their judge report (levels/*.report.txt). Light: no solving, a second or two.
//   --local: a copy of the PC's local/ (a cloud session stages local/mains, local/difficulty, local/phone/url.txt).
//   Default out: local/board2/data.json. Then republish board2/page.html with files {"data.json": <out>}.
const fs = require("fs"), path = require("path"), cp = require("child_process");
const ROOT = path.join(__dirname, "..");
const args = process.argv.slice(2), opt = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const LOCAL = opt("--local") || path.join(ROOT, "local");
const OUT = opt("--out") || path.join(ROOT, "local", "board2", "data.json");
const rdj = p => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch (e) { return null; } };

// main levels: the same rows as the old board
let mains = null;
try {
  const out = cp.execFileSync(process.execPath, [path.join(__dirname, "board_mains.js"), "--local", LOCAL, "--json"],
    { encoding: "utf8", windowsHide: true, maxBuffer: 1 << 24 });
  const m = JSON.parse(out);
  mains = { at: m.at, rows: m.levels.map(l => ({ n: l.n, name: l.name, rating: l.rating, route_pct: l.route_pct,
    need: l.need, kind: l.route_kind, score: l.score, score_model: l.score_model || null, est_stars: l.est_stars ?? null, label: l.label || null, score_parts: l.score_parts || null, inputs: l.inputs, tight: l.tight, min_ms: l.min_ms,
    attempts: l.attempts, flag: l.flag, stale: !!l.score_stale })) };
} catch (e) { mains = { error: String(e.message || e).slice(0, 300) }; }

// the board's section types and their last check
const lc = rdj(path.join(ROOT, "knowledge", "layout_check.json")) || {};
const gone = new Set(rdj(path.join(ROOT, "knowledge", "layout_sections_removed.json")) || []);
const types = Object.values(lc).filter(t => !gone.has(t.key)).map(t => ({ key: t.key, name: t.name, mode: t.mode, cols: t.cols, ok: !!t.ok,
  label: t.label, presses: t.presses, tightest: Array.isArray(t.tight) && t.tight.length ? Math.min(...t.tight.map(x => +x.ms || +x || 1e9)) : null,
  skips: Array.isArray(t.skips) ? t.skips.length : null, height: t.spread && t.spread.used != null ? t.spread.used : null,
  solve_ms: t.ms, at: t.at }));

// our levels with a judge report
const phone = (() => { try { return fs.readFileSync(path.join(LOCAL, "phone", "url.txt"), "utf8").trim(); } catch (e) { return null; } })();
const levels = [];
for (const f of fs.readdirSync(path.join(ROOT, "levels")).filter(f => f.endsWith(".report.txt"))) {
  const txt = fs.readFileSync(path.join(ROOT, "levels", f), "utf8"), L = txt.split(/\r?\n/), base = f.replace(/\.report\.txt$/, "");
  const head = /^(.*?):\s*([\d.]+) s, (\d+) presses, (\d+) modes/.exec(L[0]) || [];
  const line = k => (L.find(x => x.startsWith(k)) || "").slice(k.length).trim();
  const lay = line("Layout"), lm = /^([\d.]+)\/10\s*(.*)$/.exec(lay) || [];
  const parts = (lm[2] || "").split("·").map(s => s.trim()).filter(Boolean).map(s => { const m = /^(.*\S)\s+([\d.]+)$/.exec(s); return m ? [m[1], +m[2]] : [s, null]; });
  const ni = L.findIndex(x => x.startsWith("Top notes"));
  const notes = ni >= 0 ? L.slice(ni + 1).filter(x => /^\s+\d+\./.test(x)).map(x => x.trim().replace(/^\d+\.\s*/, "")) : [];
  let mtime = null; try { mtime = cp.execFileSync("git", ["log", "-1", "--format=%cI", "--", "levels/" + base + ".gdlvl"], { cwd: ROOT, encoding: "utf8", windowsHide: true }).trim() || null; } catch (e) {}
  levels.push({ base, name: head[1] || base, seconds: +head[2] || null, presses: +head[3] || null, modes: +head[4] || null,
    layout: lm[1] != null ? +lm[1] : null, parts, difficulty: line("Difficulty"), fairness: line("Fairness"), taste: line("Taste"),
    secret: line("Secret ways:"), notes, at: mtime, link: phone ? phone + "#" + base : null });
}
levels.sort((a, b) => String(b.at).localeCompare(String(a.at)));

const stats = opt("--stats") ? rdj(opt("--stats")) : null;
let commit = null; try { commit = cp.execFileSync("git", ["log", "-1", "--format=%h %cI"], { cwd: ROOT, encoding: "utf8", windowsHide: true }).trim(); } catch (e) {}
const data = { at: new Date().toISOString(), commit, mains, types, levels, stats, phone };
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(data));
console.log(`${OUT}: ${mains.rows ? mains.rows.length : 0} mains, ${types.length} section types, ${levels.length} levels, stats ${stats ? "in" : "none"}`);
