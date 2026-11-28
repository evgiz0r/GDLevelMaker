// node tests/notequeue.js -- an unsent note on a page is still found; an answered one is not (WORKBOOKS.md "Reading the queue")
"use strict";
const assert = require("assert"), fs = require("fs"), os = require("os"), path = require("path"), Q = require("../tools/notequeue.js");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nq-")), put = (c, id, d) => { fs.mkdirSync(path.join(dir, c), { recursive: true }); fs.writeFileSync(path.join(dir, c, id + ".json"), JSON.stringify(d)); };
put("designnotes", "genT_ball-a", { part: "genT:ball", note: "more distance", at: "2026-11-28T11:00:00Z", sentNote: "" });
put("designnotes", "genT_ball-b", { part: "genT:ball", note: "more distance when flying", at: "2026-11-28T11:01:00Z", sentNote: "" });
put("designnotes", "genT_wave-a", { part: "genT:wave", note: "slides", at: "2026-11-28T10:00:00Z", sentNote: "slides" });
put("designnotes", "genT_x-a", { part: "genT:x", note: "", at: "2026-11-28T10:00:00Z" });
put("claudestatus", "w", { part: "genT:wave", reply: "ok", at: "2026-11-28T10:05:00Z" });
put("designmarks", "m1-r1", { mid: "m1", note: "hole", at: "2026-11-28T09:00:00Z" });
put("designmarks", "m1-claudeseen", { mid: "m1", note: "hole", seen: true, at: "2026-11-28T09:30:00Z" });
const q = Q.open(Q.load(dir));
assert.deepStrictEqual(q.map(n => n.part), ["genT:ball"], JSON.stringify(q));
assert(!q[0].sent && q[0].note === "more distance when flying");
fs.rmSync(dir, { recursive: true });
console.log("notequeue ok");
