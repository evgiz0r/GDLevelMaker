// node tools/link_local.js   -- run once in each session's worktree (the main checkout needs nothing).
//
// Makes this worktree's local/ the SAME folder as the main checkout's local/, so every session
// shares solved levels, beat grids, marks, recordings notes and work-in-progress levels
// (local/wip/). Without it each worktree has its own local/, and sessions re-solve the same
// levels (memory!) and never see each other's results or the user's marks.
//
// What it does, without deleting anything:
//   1. copies every file from this worktree's local/ into the main local/ when the main copy is
//      missing or older (newest wins);
//   2. renames this worktree's local/ to local.before-share/ (delete it yourself once happy);
//   3. puts a directory junction local/ -> <main>/local/ in its place (no admin rights needed).
// Run it between jobs, not while something of yours is writing into local/.
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const git = args => execSync("git " + args, { encoding: "utf8" }).trim();
const top = path.resolve(git("rev-parse --show-toplevel"));
const main = path.resolve(path.dirname(path.resolve(top, git("rev-parse --git-common-dir"))));
const mine = path.join(top, "local"), shared = path.join(main, "local");

if (top === main) { fs.mkdirSync(shared, { recursive: true }); console.log("main checkout: local/ is the shared folder itself, nothing to do"); process.exit(0); }
fs.mkdirSync(shared, { recursive: true });
let isLink = false;
try { isLink = fs.lstatSync(mine).isSymbolicLink() || fs.realpathSync(mine) === fs.realpathSync(shared); } catch (e) { /* no local/ yet */ }
if (isLink) { console.log("already shared:", mine, "->", shared); process.exit(0); }

let copied = 0, kept = 0;
function merge(from, to) {
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, e.name), b = path.join(to, e.name);
    if (e.isDirectory()) { fs.mkdirSync(b, { recursive: true }); merge(a, b); continue; }
    const sa = fs.statSync(a);
    let sb = null; try { sb = fs.statSync(b); } catch (x) {}
    if (!sb || sa.mtimeMs > sb.mtimeMs) { fs.copyFileSync(a, b); fs.utimesSync(b, sa.atime, sa.mtime); copied++; } else kept++;
  }
}
if (fs.existsSync(mine)) {
  merge(mine, shared);
  let old = path.join(top, "local.before-share"), n = 1;
  while (fs.existsSync(old)) old = path.join(top, "local.before-share-" + ++n);
  fs.renameSync(mine, old);
  console.log(`merged into the shared folder: ${copied} files copied, ${kept} already there and newer; old folder kept as ${path.basename(old)}/`);
}
fs.symlinkSync(shared, mine, "junction");
console.log("linked", mine, "->", shared);
