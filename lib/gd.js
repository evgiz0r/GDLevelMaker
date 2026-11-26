// Geometry Dash level format: the parts that do not need gzip.
// A .gdlvl (as exported by the user's mod) is base64url(gzip(record XML)).
// The record is a plist <dict>; key k4 holds the level string, itself base64url(gzip(...)).
// The level string is "header;obj;obj;...;" and each obj is "key,value,key,value,...".
// Works in node (require) and the browser (window.GD).
(function (GD) {
  "use strict";

  // ---- base64url <-> bytes ----
  function b64urlToBytes(s) {
    s = s.trim().replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(s, "base64"));
    const bin = atob(s), out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function bytesToB64url(bytes) {
    let s;
    if (typeof Buffer !== "undefined") s = Buffer.from(bytes).toString("base64");
    else { let bin = ""; for (const b of bytes) bin += String.fromCharCode(b); s = btoa(bin); }
    return s.replace(/\+/g, "-").replace(/\//g, "_"); // GD keeps the '=' padding
  }

  // ---- record (outer plist) ----
  // Returns [{key, type, value}] in file order so it re-serialises byte for byte.
  function parseRecord(xml) {
    const m = xml.match(/<plist[^>]*><dict>([\s\S]*)<\/dict><\/plist>/);
    if (!m) throw new Error("not a GD level record");
    const body = m[1], fields = [];
    const re = /<k>([^<]*)<\/k>(<([a-z])>([\s\S]*?)<\/\3>|<([a-z]) \/>)/g;
    let r;
    while ((r = re.exec(body))) {
      if (r[5]) fields.push({ key: r[1], type: r[5], value: null });
      else if (r[3] === "d") fields.push({ key: r[1], type: "d", value: r[4] }); // nested dict kept raw
      else fields.push({ key: r[1], type: r[3], value: r[4] });
    }
    return { prefix: xml.slice(0, xml.indexOf("<dict>")), fields };
  }
  function serializeRecord(rec) {
    let s = rec.prefix + "<dict>";
    for (const f of rec.fields) {
      s += "<k>" + f.key + "</k>";
      s += f.value === null ? "<" + f.type + " />" : "<" + f.type + ">" + f.value + "</" + f.type + ">";
    }
    return s + "</dict></plist>";
  }
  function getField(rec, key) { const f = rec.fields.find(f => f.key === key); return f ? f.value : undefined; }
  function setField(rec, key, type, value) {
    const f = rec.fields.find(f => f.key === key);
    if (f) { f.type = type; f.value = value; } else rec.fields.push({ key, type, value });
  }
  function dropField(rec, key) { rec.fields = rec.fields.filter(f => f.key !== key); }

  // ---- level string ----
  function parseLevel(str) {
    const parts = str.split(";");
    const header = parts[0];
    const objects = [];
    for (let i = 1; i < parts.length; i++) {
      if (!parts[i]) continue;
      const kv = parts[i].split(","), props = {};
      for (let j = 0; j + 1 < kv.length; j += 2) props[kv[j]] = kv[j + 1];
      objects.push(objFromProps(props));
    }
    return { header, objects };
  }
  // Common keys: 1 id, 2 x, 3 y, 4 flipX, 5 flipY, 6 rotation (degrees, clockwise), 21 color channel.
  function objFromProps(props) {
    return {
      id: +props[1], x: +(props[2] || 0), y: +(props[3] || 0),
      rot: +(props[6] || 0), flipX: props[4] === "1", flipY: props[5] === "1",
      props,
    };
  }
  function objToString(o) {
    const p = Object.assign({}, o.props || {});
    p[1] = String(o.id); p[2] = fmt(o.x); p[3] = fmt(o.y);
    if (o.rot) p[6] = fmt(o.rot); else delete p[6];
    if (o.flipX) p[4] = "1"; else delete p[4];
    if (o.flipY) p[5] = "1"; else delete p[5];
    const keys = Object.keys(p).sort((a, b) => a - b);
    return keys.map(k => k + "," + p[k]).join(",");
  }
  function fmt(n) { return String(Math.round(n * 1000) / 1000); }
  function serializeLevel(lvl) {
    return [lvl.header].concat(lvl.objects.map(objToString)).join(";") + ";";
  }

  // Text fields in the record (name is plain, description k3 is base64url).
  function decodeDesc(s) { try { return new TextDecoder().decode(b64urlToBytes(s || "")); } catch (e) { return ""; } }
  function encodeDesc(s) { return bytesToB64url(new TextEncoder().encode(s)); }

  // A header for a brand-new level: colours and settings copied from a level made in GD 2.2.
  // kA13 (song offset) is 0 and there is no custom song, so the game uses its default song.
  const DEFAULT_HEADER =
    "kS38,1_255_2_80_3_246_11_255_12_255_13_255_4_-1_6_1000_7_1_15_1_18_0_8_1|1_95_2_0_3_174_11_255_12_255_13_255_4_-1_6_1001_7_1_15_1_18_0_8_1|1_73_2_44_3_237_11_255_12_255_13_255_4_-1_6_1009_7_1_15_1_18_0_8_1|1_255_2_255_3_255_11_255_12_255_13_255_4_-1_6_1002_5_1_7_1_15_1_18_0_8_1|1_107_2_100_3_193_11_255_12_255_13_255_4_-1_6_1013_7_1_15_1_18_0_8_1|1_125_2_176_3_193_11_255_12_255_13_255_4_-1_6_1014_7_1_15_1_18_0_8_1|1_255_2_185_3_0_11_255_12_255_13_255_4_-1_6_1005_5_1_7_1_15_1_18_0_8_1|1_255_2_125_3_0_11_255_12_255_13_255_4_-1_6_1006_5_1_7_1_15_1_18_0_8_1|1_255_2_255_3_255_11_255_12_255_13_255_4_-1_6_1004_7_1_15_1_18_0_8_1|1_255_2_255_3_255_11_255_12_255_13_255_4_-1_6_1010_7_1_15_1_18_0_8_1|,kA13,0,kA15,1,kA16,0,kA14,,kA6,57,kA7,5,kA25,1,kA17,1,kA18,0,kS39,0,kA2,0,kA3,0,kA8,0,kA4,0,kA9,0,kA10,0,kA22,0,kA23,0,kA24,0,kA27,1,kA40,1,kA41,1,kA42,1,kA28,0,kA29,0,kA31,1,kA32,1,kA36,0,kA43,0,kA44,0,kA45,1,kA46,0,kA33,1,kA34,1,kA35,0,kA37,1,kA38,1,kA39,1,kA19,0,kA26,0,kA20,0,kA21,0,kA11,0";

  // A record for a brand-new local level, modelled on a real 2.2 export. Unknown editor-only
  // keys from that export (k95, k66, k80) are left out; the game fills in its own.
  function newRecord(name, desc) {
    return {
      prefix: '<?xml version="1.0"?><plist version="1.0" gjver="2.0">',
      fields: [
        { key: "kCEK", type: "i", value: "4" },
        { key: "k23", type: "i", value: "1" },
        { key: "k2", type: "s", value: escapeXml(name) },
        { key: "k4", type: "s", value: "" },
        { key: "k3", type: "s", value: encodeDesc(desc || "") },
        { key: "k101", type: "s", value: "0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0" },
        { key: "k13", type: "t", value: null },
        { key: "k21", type: "i", value: "2" },
        { key: "k50", type: "i", value: "51" },
        { key: "k48", type: "i", value: "0" },
      ],
    };
  }
  function escapeXml(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  // GD's official songs by k8 (the record's song index; main level n uses n-1): the file names in the game's Resources
  // folder, served by tools/serve.js as /song/official/<name>.mp3. One copy, used by index_levels.js, video.js, the viewer.
  const OFFICIAL_SONGS = ["StereoMadness", "BackOnTrack", "Polargeist", "DryOut", "BaseAfterBase", "CantLetGo",
    "Jumper", "TimeMachine", "Cycles", "xStep", "Clutterfunk", "TheoryOfEverything", "Electroman", "Clubstep",
    "Electrodynamix", "HexagonForce", "BlastProcessing", "TheoryOfEverything2", "GeometricalDominator",
    "Deadlocked", "Fingerdash", "Dash"];

  Object.assign(GD, {
    OFFICIAL_SONGS, b64urlToBytes, bytesToB64url, parseRecord, serializeRecord, getField, setField, dropField,
    parseLevel, serializeLevel, objToString, decodeDesc, encodeDesc, newRecord, DEFAULT_HEADER,
  });
})(typeof module !== "undefined" ? module.exports : (window.GD = window.GD || {}));
