// node tools/genslides.js [type,type] [noforce] -- ship / wave pieces: from every 6th column, the plan then the button held
// (or let go) to the end; counts the runs that get more than 8 columns on (a slide skipping gameplay; Evgeni 2026-11-28)
const R = require("path").join(__dirname, "..") + "/";
const SG = require(R + "tools/sectiongen.js"), LC = require(R + "tools/layoutcheck.js"), log = console.log;
if (require.main === module) require("./heavy.js").claim();
const keys=(process.argv[2]||"fly,my-mwz1s7po").split(","), V=process.argv[3]!=="noforce";
for (const key of keys) { let n=0, bad=0, worst=0;
 for (let seed=1;seed<=6;seed++){ const z=SG.make(key,{cols:40,seed,tier:"normal",force:V?undefined:false}); if(!z.presses) continue; const W=z.map[0].length;
  for (let a=2;a<W-10;a+=6) for (const hold of [true,false]) { const ps=[]; for (const p of z.presses){const [p0,p1]=[].concat(p); if(p0>=a)continue; ps.push(Array.isArray(p)?[p0,hold?(p1>=a?W+2:p1):Math.min(p1,a)]:p);} if(hold&&!(ps.length&&Array.isArray(ps.at(-1))&&ps.at(-1)[1]>a)) ps.push([a,W+2]);
   console.log=()=>{}; const c=LC.planCheck(Object.assign({key},z,{presses:ps})); console.log=log; const got=c.ok?W-a:c.dieCol-a; n++; if(got>8){bad++; worst=Math.max(worst,got);} } }
 log(key, V?"forced":"plain", "slides over 8 cols:", bad,"/",n, "longest", worst.toFixed(1)); }
