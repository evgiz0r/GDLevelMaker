// node tests/lab_view.js -- the section lab's server side (tools/serve.js /lab/*, VIEWER.md "Section lab"): a round in a
// temp folder (GDLM_LAB_DIR) is listed, read with its variants' files and results, and a test pick answers without storing.
const fs = require("fs"), path = require("path"), os = require("os"), { spawn } = require("child_process"), http = require("http");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gdlm-lab-")), port = 8790 + Math.floor(Math.random() * 100);
fs.mkdirSync(path.join(dir, "r7"));
fs.writeFileSync(path.join(dir, "r7", "round.json"), JSON.stringify({ id: "r7", moment: "a drop", t: [10, 25], variants: [{ k: 1, hook: "speed-up", why: "faster" }, { k: 2, hook: "orb-trick", why: "orbs" }] }));
fs.writeFileSync(path.join(dir, "r7", "v2.result.json"), JSON.stringify({ ok: true, pace: { cps: 2, obsPerBar: 3, changesPer10s: 1 } }));
const srv = spawn(process.execPath, [path.join(__dirname, "..", "tools", "serve.js"), String(port), "--no-update", "--local-only"], { env: Object.assign({}, process.env, { GDLM_LAB_DIR: dir }), windowsHide: true, stdio: "ignore" });
const req = (method, p, body) => new Promise((ok, no) => { const r = http.request({ host: "127.0.0.1", port, path: p, method }, res => { let d = ""; res.on("data", c => d += c); res.on("end", () => ok({ code: res.statusCode, j: (() => { try { return JSON.parse(d); } catch (e) { return d; } })() })); }); r.on("error", no); if (body) r.write(JSON.stringify(body)); r.end(); });
let fails = 0; const check = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) fails++; };
(async () => {
  for (let i = 0; i < 50; i++) { try { await req("GET", "/lab/list"); break; } catch (e) { await new Promise(r => setTimeout(r, 200)); } }
  const ls = await req("GET", "/lab/list"); check(ls.code === 200 && ls.j.length === 1 && ls.j[0].id === "r7" && ls.j[0].n === 2, "list: the round with its variant count");
  const R = await req("GET", "/lab/r7"); check(R.j.variants[0].file === "local/wip/style/lab_r7_v1.gdlvl", "round: each variant's stage card file");
  check(R.j.variants[1].result && R.j.variants[1].result.pace.cps === 2 && R.j.variants[0].result === null, "round: results where they exist");
  const none = await req("GET", "/lab/r99"); check(none.code === 404, "an unknown round is a 404");
  const pk = await req("POST", "/lab/pick", { round: "r7", k: 2, note: "love the orbs", test: true }); check(pk.j.answer === "v2 orb-trick" && pk.j.test, "a test pick answers with the variant and stores nothing");
  const pn = await req("POST", "/lab/pick", { round: "r7", k: 0, test: true }); check(/^none/.test(pn.j.answer), "k 0 = none of them");
  srv.kill(); fs.rmSync(dir, { recursive: true, force: true });
  console.log(fails ? fails + " failed" : "all ok"); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); srv.kill(); process.exit(1); });
