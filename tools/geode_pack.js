#!/usr/bin/env node
// Usage: node tools/geode_pack.js <mod dir> <built .dll> [--out <file.geode>] [--install]
//   Packs a Geode mod the way `geode package new` does for a mod with no sprites/fonts: a zip with mod.json,
//   about.md / logo.png / changelog.md / support.md if present, and the binary renamed to <mod id>.dll.
//   --install copies it to the Steam GD's geode/mods folder, and refuses while GeometryDash.exe runs.
// Why: Smart App Control on the user's PC blocks the unsigned Geode CLI (geode.exe), so the build runs with
// -DGEODE_DISABLE_CLI_CALLS=ON and this does the CLI's packaging step (GEODE.md "Building on this PC").
"use strict";
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { spawnSync } = require("child_process");

const GD_DIR = require("./gdpaths.js").GAME;

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function zip(entries) {
  const locals = [], centrals = [];
  let off = 0;
  for (const { name, data } of entries) {
    const nm = Buffer.from(name, "utf8");
    const comp = zlib.deflateRawSync(data, { level: 9 });
    const crc = crc32(data);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6); lh.writeUInt16LE(8, 8);
    lh.writeUInt16LE(0, 10); lh.writeUInt16LE(0x21, 12); lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(nm.length, 26);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8);
    ch.writeUInt16LE(8, 10); ch.writeUInt16LE(0, 12); ch.writeUInt16LE(0x21, 14); ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(nm.length, 28);
    ch.writeUInt32LE(off, 42);
    locals.push(lh, nm, comp);
    centrals.push(ch, nm);
    off += 30 + nm.length + comp.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  return Buffer.concat([...locals, cd, end]);
}

function gdRunning() {
  const r = spawnSync("tasklist", ["/FI", "IMAGENAME eq GeometryDash.exe", "/NH"], { encoding: "utf8", windowsHide: true });
  return /GeometryDash\.exe/i.test(r.stdout || "");
}

function main() {
  const a = process.argv.slice(2);
  const flag = (f) => { const i = a.indexOf(f); if (i < 0) return null; const v = a[i + 1]; a.splice(i, 2); return v; };
  const out0 = flag("--out");
  const install = a.includes("--install");
  const pos = a.filter((x) => !x.startsWith("--"));
  if (pos.length < 2) { console.error("usage: node tools/geode_pack.js <mod dir> <built .dll> [--out f.geode] [--install]"); process.exit(2); }
  const [modDir, dll] = pos;
  const modJson = fs.readFileSync(path.join(modDir, "mod.json"));
  const id = JSON.parse(modJson).id;
  const entries = [{ name: "mod.json", data: modJson }];
  for (const f of fs.readdirSync(modDir)) {
    if (["about.md", "logo.png", "changelog.md", "support.md"].includes(f.toLowerCase()))
      entries.push({ name: f.toLowerCase(), data: fs.readFileSync(path.join(modDir, f)) });
  }
  entries.push({ name: id + ".dll", data: fs.readFileSync(dll) });
  const out = out0 || path.join(path.dirname(dll), id + ".geode");
  fs.writeFileSync(out, zip(entries));
  console.log(`packed ${out} (${entries.map((e) => e.name).join(", ")})`);
  if (install) {
    if (gdRunning()) { console.log("GeometryDash.exe is running: not installed (run again with the game closed)"); process.exit(1); }
    const dest = path.join(GD_DIR, "geode", "mods");
    fs.mkdirSync(dest, { recursive: true });
    fs.copyFileSync(out, path.join(dest, id + ".geode"));
    console.log(`installed ${path.join(dest, id + ".geode")}`);
  }
}

main();
