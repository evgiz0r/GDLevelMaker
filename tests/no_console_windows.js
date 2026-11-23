// node tests/no_console_windows.js [--fix]  -- never pop a window on the user's screen: every child process started
// from tools/, lib/ or tests/ (spawn, spawnSync, exec*, execFile*, fork) must pass windowsHide: true. On Windows a
// console child without it flashes a console window -- serve.js's self-update did that every minute (2026-11-23,
// "shell windows popping up"). Lists every call without it and fails; --fix adds it (inside the call's options
// object, or as a new last argument) and prints what it changed.
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, ".."), FIX = process.argv.includes("--fix");
const NAMES = "execSync|execFileSync|spawnSync|spawn|execFile|fork";
// a call: a qualified one (cp.spawn, child_process.exec, require("child_process").execSync) or a bare one of the
// destructured names (exec alone is too common a word: only qualified)
const CALL = new RegExp(`(?:\\b(?:cp|child_process|childProcess)|require\\(["']child_process["']\\))\\s*\\.\\s*(?:${NAMES}|exec)\\s*\\(|(?<![.\\w$])(?:${NAMES})\\s*\\(`, "g");

// the end of a call's argument list from just after its "(": brackets, strings and template literals respected
function callEnd(src, i) {
  let depth = 1, args = [], start = i;
  while (i < src.length) {
    const c = src[i];
    if (c === "'" || c === '"') { const q = c; i++; while (i < src.length && src[i] !== q) { if (src[i] === "\\") i++; i++; } }
    else if (c === "`") { i++; let d = 0; while (i < src.length && !(src[i] === "`" && d === 0)) { if (src[i] === "\\") i++; else if (src[i] === "$" && src[i + 1] === "{") { d++; i++; } else if (src[i] === "}" && d > 0) d--; i++; } }
    else if (c === "/" && src[i + 1] === "/") { while (i < src.length && src[i] !== "\n") i++; }
    else if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") { depth--; if (depth === 0) { args.push([start, i]); return { end: i, args }; } }
    else if (c === "," && depth === 1) { args.push([start, i]); start = i + 1; }
    i++;
  }
  return null;
}
const files = [];
for (const d of ["tools", "lib", "tests"]) for (const f of fs.readdirSync(path.join(ROOT, d))) if (f.endsWith(".js")) files.push(path.join(d, f));
let missing = 0, fixed = 0;
for (const rel of files) {
  const file = path.join(ROOT, rel); let src = fs.readFileSync(file, "utf8");
  if (rel === path.join("tests", "no_console_windows.js")) continue;
  const edits = [];
  CALL.lastIndex = 0; let m;
  while ((m = CALL.exec(src))) {
    const line = src.lastIndexOf("\n", m.index) + 1, lineText = src.slice(line, src.indexOf("\n", m.index));
    if (/^\s*\/\//.test(lineText) || /^\s*(async\s+)?function\b/.test(lineText.slice(m.index - line - 9 < 0 ? 0 : m.index - line - 9))) continue;
    const r = callEnd(src, m.index + m[0].length); if (!r) continue;
    const body = src.slice(m.index + m[0].length, r.end);
    if (/windowsHide/.test(body) || !body.trim()) continue;
    missing++;
    const ln = src.slice(0, m.index).split("\n").length;
    const last = r.args[r.args.length - 1], lastText = src.slice(last[0], last[1]).trim();
    let edit;
    if (lastText.startsWith("{")) { const at = src.indexOf("{", last[0]); edit = [at + 1, " windowsHide: true,"]; }
    else if (/=>|^function\b/.test(lastText)) { edit = [last[0], " { windowsHide: true },"]; }  // a callback last: options before it
    else edit = [r.end, ", { windowsHide: true }"];
    edits.push(edit);
    console.log(`${FIX ? "fixed" : "MISSING"} ${rel}:${ln}  ${lineText.trim().slice(0, 110)}`);
  }
  if (FIX && edits.length) { for (const [at, text] of edits.sort((a, b) => b[0] - a[0])) src = src.slice(0, at) + text + src.slice(at); fs.writeFileSync(file, src); fixed += edits.length; }
}
if (FIX) { console.log(`added windowsHide to ${fixed} calls`); process.exit(0); }
console.log(missing ? `${missing} child process call(s) without windowsHide: true -- node tests/no_console_windows.js --fix` : "every child process call hides its window");
process.exit(missing ? 1 : 0);
