// node tools/scene_join.js -- print the theme board's current scene (every layout section joined, as tools/designs_tab.js builds it on the page)
const fs=require("fs"),src=fs.readFileSync(require("path").join(__dirname, "designs_tab.js"),"utf8");
const code=src.slice(src.indexOf("  const floorAt"),src.indexOf("  const sceneW"));
const LS=require("./layoutsections.js");
const LPARTS=LS.SECTIONS.map(z=>["sec:"+z.key,z.name,z.map[0].length,z.map.length]);
const SECS=()=>LPARTS; const tilesOf=k=>LS.tiles(LS.SECTIONS.find(z=>"layout:sec:"+z.key===k));
eval(code+"; global.ST=sceneTiles;");
const T=ST(),W=Math.max(...T.map(q=>q.c))+1,H=12,g=Array.from({length:H},()=>Array(W).fill("."));for(const q of T)g[H-1-q.r][q.c]=q.t;
const rows=g.map(l=>l.join(""));for(let i=0;i<W;i+=100)console.log(rows.map(r=>r.slice(i,i+100)).join("\n")+"\n");
