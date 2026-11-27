// node tools/workboard_data.js [--out local/workboard/data.json]  -- the data for the Claude workboard artifact
//   (workboard/README.md): every use case from USE_CASES.md with its status, the structure library's stats
//   (knowledge/structures.json: mode, tier, gates, width, length, presses, tightest window, warnings), and the GD video
//   catalog (Videos/Captures recordings and clips + local/video renders, with length by ffprobe and the levels named in
//   local/real_stats.jsonl). Light, a few seconds (ffprobe per video). Then republish the page with data.json beside it
//   (workboard/README.md "Refresh"). The output stays in local/: it names the user's recordings.
const fs=require('fs'),path=require('path'),cp=require('child_process');
const R=path.join(__dirname,".."); const oi=process.argv.indexOf("--out"); const OUT=oi>0?process.argv[oi+1]:path.join(R,"local","workboard","data.json"); fs.mkdirSync(path.dirname(OUT),{recursive:true});
// features
const uc=fs.readFileSync(R+'/USE_CASES.md','utf8').split('\n').filter(l=>/^\| \d+ \|/.test(l));
const strip=s=>s.replace(/\*\*/g,'').replace(/`/g,'').trim();
const features=uc.map((l,i)=>{const c=l.split(' | ');c[0]=c[0].replace(/^\| /,'');const last=c[c.length-1].replace(/ \|$/,'');c[c.length-1]=last;
 return {id:'uc'+(i+1),n:c[0],name:strip(c[1]),status:strip(c[2]),has:strip(c[3]||''),missing:strip(c[4]||'')}});
// structures
const S=JSON.parse(fs.readFileSync(path.join(R,'knowledge','structures.json'),'utf8')).structures;
const structures=Object.values(S).map(s=>({id:s.id,mode:s.mode,tier:s.tier,tags:s.tags,doc:s.doc,ok:s.ok,width:s.width,presses:s.presses,minWindowMs:s.minWindowMs,seconds:s.seconds,rank:s.rank??s.score??null,
 warn:Object.entries(s.gates||{}).filter(([k,v])=>v!=='PASS').map(([k,v])=>k+':'+v),
 needs:s.needs&&`${s.needs.mode}${s.needs.mini?' mini':''} ${s.needs.speed} g${s.needs.grav}`,leaves:s.leaves&&`${s.leaves.mode}${s.leaves.mini?' mini':''} ${s.leaves.speed} g${s.leaves.grav}`}));
// videos
const stats={};for(const l of (fs.existsSync(path.join(R,'local','real_stats.jsonl'))?fs.readFileSync(path.join(R,'local','real_stats.jsonl'),'utf8'):'').split('\n')){try{const j=JSON.parse(l);const k=j.video.replace(/^.*?(\d{4}-\d\d-\d\d_\d\d-\d\d-\d\d).*$/,'$1');(stats[k]=stats[k]||{levels:new Set(),n:0,deaths:0});stats[k].levels.add(j.level);stats[k].n++;if(j.result==='death')stats[k].deaths++}catch{}}
const dur=f=>{try{return +cp.execFileSync('ffprobe',['-v','error','-show_entries','format=duration','-of','csv=p=0',f],{windowsHide:true}).toString().trim()}catch{return null}};
const vids=[];
const cap=path.join(process.env.USERPROFILE,'Videos','Captures');
if(fs.existsSync(cap))for(const f of fs.readdirSync(cap)){if(!/\.(mkv|mp4)$/.test(f))continue;const p=path.join(cap,f),st=fs.statSync(p);
 const k=(f.match(/\d{4}-\d\d-\d\d[_ ]\d\d-\d\d-\d\d/)||[''])[0].replace(' ','_');const s=stats[k];
 vids.push({id:'v_'+f.replace(/\W/g,'_'),file:f,kind:/claude-rec/.test(f)?'recording (record.sh)':/^Claude/.test(f)?'Game Bar clip (Claude app)':'Game Bar clip (GD)',
  date:st.mtime.toISOString().slice(0,16).replace('T',' '),mb:+(st.size/1048576).toFixed(1),sec:dur(p),levels:s?[...s.levels]:[],attempts:s?s.n:0,deaths:s?s.deaths:0});}
if(fs.existsSync(R+'/local/video'))for(const f of fs.readdirSync(R+'/local/video')){if(!/\.(mp4|mkv)$/.test(f))continue;const p=R+'/local/video/'+f,st=fs.statSync(p);
 vids.push({id:'v_'+f.replace(/\W/g,'_'),file:f,kind:'rendered (video.js)',date:st.mtime.toISOString().slice(0,16).replace('T',' '),mb:+(st.size/1048576).toFixed(1),sec:dur(p),levels:[f.replace(/\.mp4$/,'').replace(/_/g,' ')],attempts:0,deaths:0});}
vids.sort((a,b)=>b.date.localeCompare(a.date));
fs.writeFileSync(OUT,JSON.stringify({built:new Date().toISOString(),features,structures,videos:vids}));
console.log(`${features.length} features, ${structures.length} structures, ${vids.length} videos (${vids.filter(v=>v.levels.length).length} with levels) -> ${OUT}`);
