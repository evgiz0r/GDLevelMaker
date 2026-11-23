// node tests/pages_build.js [built dir]  -- the public site (tools/pages.js) holds nothing it must not: no file from
// local/, no image, sprite, plist, song or video, only our levels (levels/, examples/), and the page is in public
// mode (window.GD_PAGES). Without a dir it builds into a temp folder first. The guard itself is tested too: a
// planted sprite sheet, song and official level in a copy of the build must each be refused by checkDir.
const fs = require("fs"), path = require("path"), os = require("os"), cp = require("child_process");
const ROOT = path.join(__dirname, ".."), { checkDir } = require("../tools/pages.js");
let bad = 0; const check = (ok, what) => { console.log((ok ? "ok   " : "FAIL ") + what); if (!ok) bad++; };
let dir = process.argv[2];
const own = !dir;
if (own) { dir = fs.mkdtempSync(path.join(os.tmpdir(), "gdlm-pages-")); cp.execFileSync(process.execPath, [path.join(ROOT, "tools", "pages.js"), "--out", dir], { windowsHide: true, stdio: "inherit" }); }
check(checkDir(dir).length === 0, "the build passes its own check: " + (checkDir(dir).join("; ") || "nothing forbidden"));
const w = {}; new Function("window", fs.readFileSync(path.join(dir, "levels.js"), "utf8"))(w);
check((w.GD_LEVELS || []).length > 0 && w.GD_LEVELS.every(l => /^(levels|examples)\//.test(String(l.file))), `only our levels (${(w.GD_LEVELS || []).length})`);
const html = fs.readFileSync(path.join(dir, "index.html"), "utf8");
check(/window\.GD_PAGES = true/.test(html) && !/src="\.\.\//.test(html), "public mode, no paths out of the site");
// the guard: plant forbidden things in a copy and expect each to be refused
const copy = fs.mkdtempSync(path.join(os.tmpdir(), "gdlm-pages-bad-"));
fs.cpSync(dir, copy, { recursive: true });
fs.writeFileSync(path.join(copy, "lib", "GJ_GameSheet-uhd.png"), "x");
fs.writeFileSync(path.join(copy, "343707.mp3"), "x");
fs.mkdirSync(path.join(copy, "local"), { recursive: true }); fs.writeFileSync(path.join(copy, "local", "marks.jsonl"), "x");
fs.writeFileSync(path.join(copy, "levels.js"), "window.GD_LEVELS = " + JSON.stringify([{ name: "official 1", file: "local/official_01.json" }]) + ";");
const got = checkDir(copy);
check(got.some(b => /GameSheet/.test(b)) && got.some(b => /\.mp3/.test(b)) && got.some(b => /^local\//.test(b)) && got.some(b => /official_01/.test(b)), `planted sprite, song, local/ file and official level all refused (${got.length})`);
fs.rmSync(copy, { recursive: true, force: true });
if (own) fs.rmSync(dir, { recursive: true, force: true });
console.log(bad ? `${bad} failed` : "all passed"); process.exit(bad ? 1 : 0);
