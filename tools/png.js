// Minimal PNG read / write in plain node (zlib only, no dependencies). Used by tools/pixelart.js and
// tools/props.js. Reads 8-bit (and 1/2/4-bit palette / grey) non-interlaced PNGs -- what PIL, Paint and
// most editors write; anything else: convert first (python -c "from PIL import Image; Image.open('a').convert('RGBA').save('b.png')").
//   const { readPng, writePng } = require("./png.js");
//   const { w, h, rgba } = readPng("pic.png");     writePng("out.png", w, h, rgba);
"use strict";
const fs = require("fs"), zlib = require("zlib");

function readPng(file) {
  const b = fs.readFileSync(file);
  if (b.readUInt32BE(0) !== 0x89504e47) throw new Error(file + ": not a PNG");
  let p = 8, w, h, depth, type, interlace, pal = null, trns = null; const idat = [];
  while (p < b.length) {
    const len = b.readUInt32BE(p), t = b.toString("ascii", p + 4, p + 8), d = b.subarray(p + 8, p + 8 + len);
    if (t === "IHDR") { w = d.readUInt32BE(0); h = d.readUInt32BE(4); depth = d[8]; type = d[9]; interlace = d[12]; }
    else if (t === "PLTE") pal = d;
    else if (t === "tRNS") trns = d;
    else if (t === "IDAT") idat.push(d);
    else if (t === "IEND") break;
    p += 12 + len;
  }
  if (interlace) throw new Error(file + ": interlaced PNG, save it without interlacing");
  if (depth === 16) throw new Error(file + ": 16-bit PNG, save it as 8-bit");
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type], bpp = Math.max(1, ch * depth / 8), stride = Math.ceil(w * ch * depth / 8);
  const raw = zlib.inflateSync(Buffer.concat(idat)), px = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) { // un-filter
    const f = raw[y * (stride + 1)], src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)), row = px.subarray(y * stride, (y + 1) * stride), up = y ? px.subarray((y - 1) * stride, y * stride) : null;
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? row[i - bpp] : 0, u = up ? up[i] : 0, c = up && i >= bpp ? up[i - bpp] : 0;
      let v = src[i];
      if (f === 1) v += a; else if (f === 2) v += u; else if (f === 3) v += (a + u) >> 1;
      else if (f === 4) { const pp = a + u - c, pa = Math.abs(pp - a), pb = Math.abs(pp - u), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? u : c; }
      row[i] = v & 255;
    }
  }
  const rgba = new Uint8Array(w * h * 4), sample = (y, i) => { // the i-th sample of row y
    if (depth === 8) return px[y * stride + i];
    const bit = i * depth, byte = px[y * stride + (bit >> 3)], shift = 8 - depth - (bit & 7);
    return (byte >> shift) & ((1 << depth) - 1);
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = (y * w + x) * 4;
    if (type === 3) { const k = sample(y, x); rgba[o] = pal[k * 3]; rgba[o + 1] = pal[k * 3 + 1]; rgba[o + 2] = pal[k * 3 + 2]; rgba[o + 3] = trns && k < trns.length ? trns[k] : 255; }
    else if (type === 0 || type === 4) { let v = sample(y, x * ch); if (depth < 8) v = v * 255 / ((1 << depth) - 1); rgba[o] = rgba[o + 1] = rgba[o + 2] = v; rgba[o + 3] = type === 4 ? sample(y, x * ch + 1) : 255; }
    else { for (let c = 0; c < 3; c++) rgba[o + c] = sample(y, x * ch + c); rgba[o + 3] = type === 6 ? sample(y, x * ch + 3) : 255; }
  }
  return { w, h, rgba };
}

const CRC = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return t; })();
function crc(buf) { let c = -1; for (const v of buf) c = CRC[(c ^ v) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; }
function chunk(t, d) { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t, "ascii"), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); }
function writePng(file, w, h, rgba) {
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1); }
  fs.writeFileSync(file, Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ih), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]));
}
module.exports = { readPng, writePng };
