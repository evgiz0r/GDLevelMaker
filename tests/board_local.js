// node tests/board_local.js   -- the local work board (tools/board_local.js): serves board/page.html with the db shim,
// reads documents from its data folder, saves picks, refuses writes to anything else. Uses a temp folder, no real data.
const fs = require("fs"), path = require("path"), os = require("os"), http = require("http");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gdlm-board-"));
process.argv.push("--dir", dir);
const B = require("../tools/board_local.js");
let fails = 0; const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) fails++; };
fs.writeFileSync(path.join(dir, "state.json"), JSON.stringify({ updated_at: "2026-11-26T00:00:00Z", workstreams: [] }));
const srv = http.createServer((q, r) => B.handle(q, r, "/board") || (r.writeHead(404), r.end())).listen(0, "127.0.0.1", async () => {
  const base = "http://127.0.0.1:" + srv.address().port + "/board/";
  try {
    const page = await (await fetch(base)).text();
    ok(page.includes("window.claude = { use:") && page.indexOf("window.claude = { use:") < page.indexOf("var state = null"), "page served with the db shim before the board script");
    ok((await fetch(base.slice(0, -1), { redirect: "manual" })).status === 302, "/board redirects to /board/");
    const st = await (await fetch(base + "db/state")).json();
    ok(st.updated_at === "2026-11-26T00:00:00Z", "a document is read from its file");
    ok((await fetch(base + "db/played")).status === 404, "a missing document is a 404 (the page shows 'not yet')");
    const put = await fetch(base + "db/picks", { method: "PUT", body: JSON.stringify({ selected: ["a"], changed_at: "x" }) });
    ok(put.status === 204 && JSON.parse(fs.readFileSync(path.join(dir, "picks.json"), "utf8")).selected[0] === "a", "picks are saved");
    ok((await fetch(base + "db/state", { method: "PUT", body: "{}" })).status === 403, "the page cannot overwrite state");
    ok((await fetch(base + "db/..%2Fx")).status === 404, "no paths outside the data folder");
  } catch (e) { ok(false, "error: " + e.message); }
  srv.close(); fs.rmSync(dir, { recursive: true, force: true });
  console.log(fails ? fails + " failed" : "all ok"); process.exit(fails ? 1 : 0);
});
