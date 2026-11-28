// node tools/bgconcepts.js [outdir]  -- concept pictures (SVG, not GD objects) of six fiery backgrounds behind the fire theme's
// blocks and spikes, to pick a direction before building one (DECOART.md "Fire backgrounds, concepts first"). Default out: local/bgconcepts/
const fsx = require('fs'); fsx.mkdirSync(process.argv[2] || require('path').join(__dirname, '..', 'local', 'bgconcepts'), { recursive: true });
const { chromium } = require('playwright');
const W = 900, H = 320, CS = 30;
let seed = 7; const R = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
// the play strip (hellgate fire palette): blocks [92,24,22] body, orange rims; spikes orange with dark core
function play() { let s = '';
  const blocks = []; const plat = [[0,0,6,2],[6,0,4,3],[13,0,5,2],[16,4,4,1],[21,0,4,4],[26,0,8,2],[27,6,3,1]];
  for (const [c,r,w,h] of plat) s += `<rect x="${c*CS}" y="${H-(r+h)*CS-20}" width="${w*CS}" height="${h*CS}" fill="rgb(92,24,22)" stroke="rgb(255,150,70)" stroke-width="3"/>`
    + `<rect x="${c*CS+7}" y="${H-(r+h)*CS-13}" width="${w*CS-14}" height="${h*CS-14}" fill="none" stroke="rgb(44,8,10)" stroke-width="3"/>`;
  const spikes = [[10,0],[11,0],[12,0],[18,0],[19,0],[20,0],[25,0]];
  for (const [c,r] of spikes) { const x = c*CS, y = H-r*CS-20; s += `<polygon points="${x},${y} ${x+CS/2},${y-CS} ${x+CS},${y}" fill="rgb(255,150,70)"/><polygon points="${x+8},${y} ${x+CS/2},${y-CS+12} ${x+CS-8},${y}" fill="rgb(120,20,10)"/>`; }
  s += `<rect x="0" y="${H-20}" width="${W}" height="20" fill="rgb(24,4,6)"/>`;
  s += `<rect x="${7*CS+8}" y="${H-5*CS-20+6}" width="18" height="18" fill="rgb(120,240,120)" stroke="#000" stroke-width="2"/>`; // player
  return s; }
const sky = (top, bot) => `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bot}"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#g)"/>`;
const motes = (n, col, y0 = 0, y1 = H) => Array.from({ length: n }, () => `<circle cx="${R()*W}" cy="${y0+R()*(y1-y0)}" r="${1+R()*2.2}" fill="${col}" opacity="${0.4+R()*0.5}"/>`).join('');
const ridge = (y, amp, col, step = 60) => { let p = `0,${H}`; for (let x = 0; x <= W; x += step) p += ` ${x},${y - R()*amp}`; return `<polygon points="${p} ${W},${H}" fill="${col}"/>`; };
const BG = {
  'A  ash and smoke': () => sky('#3a3640', '#5a4f55') + Array.from({length:7},(_,i)=>`<ellipse cx="${60+i*135}" cy="${120+R()*60}" rx="${70+R()*40}" ry="${120}" fill="#6e666b" opacity="0.35"/>`).join('') + ridge(230, 30, '#2b282e') + motes(40, '#ffb060'),
  'B  volcano at dusk': () => sky('#1d1638', '#4a2a5a') + `<polygon points="420,${H} 560,110 600,104 640,112 800,${H}" fill="#120c1c"/><ellipse cx="600" cy="106" rx="34" ry="8" fill="#ff7a2a" opacity="0.9"/><path d="M600 100 Q585 60 610 20 Q630 -10 600 -30" stroke="#55485f" stroke-width="40" fill="none" opacity="0.5"/>` + ridge(250, 25, '#1a1226') + motes(20, '#ffcf80', 0, 200),
  'C  lava sea, dark sky': () => sky('#0c0a12', '#2a1016') + `<rect x="0" y="${H-70}" width="${W}" height="50" fill="#ff6a1a" opacity="0.55"/><rect x="0" y="${H-62}" width="${W}" height="10" fill="#ffd070" opacity="0.6"/>` + Array.from({length:30},()=>`<rect x="${R()*W}" y="${H-60+R()*30}" width="${10+R()*40}" height="2" fill="#ffe0a0" opacity="0.6"/>`).join('') + motes(25, '#ff9a40', 0, 220),
  'D  burnt city': () => sky('#16182c', '#3a2440') + Array.from({length:18},(_,i)=>{const w=30+R()*30,h=60+R()*140,x=i*52;return `<rect x="${x}" y="${H-20-h}" width="${w}" height="${h}" fill="#0e0d18"/>`+Array.from({length:4},()=>`<rect x="${x+5+R()*(w-12)}" y="${H-15-h+R()*h}" width="4" height="5" fill="#ff8a3a" opacity="0.8"/>`).join('');}).join('') + motes(15, '#ffb070', 0, 150),
  'E  obsidian shards (cold contrast)': () => sky('#0d1d24', '#183a40') + Array.from({length:9},(_,i)=>{const x=i*105+R()*40,h=100+R()*120;return `<polygon points="${x},${H-20} ${x+25},${H-20-h} ${x+55},${H-20}" fill="#0a1418" stroke="#ff4a8a" stroke-width="1.5" opacity="0.9"/>`;}).join('') + motes(20, '#7ff0ff', 0, 200),
  'F  bright inferno sky (blocks as silhouettes)': () => sky('#ffcf70', '#ff7a30') + ridge(220, 40, '#d4572a') + ridge(250, 20, '#a83a22') + motes(30, '#fff3c0'),
};
// contrast numbers vs block body and spike colour, on the mid-height background colour
const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126*f(c[0])+0.7152*f(c[1])+0.0722*f(c[2]); };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
  const out = [];
  for (const [name, f] of Object.entries(BG)) { seed = 7;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${f()}${play()}<rect x="0" y="0" width="${W}" height="34" fill="#000" opacity="0.55"/><text x="12" y="23" font-family="sans-serif" font-size="17" fill="#fff">${name}</text></svg>`;
    await p.setContent(`<body style="margin:0">${svg}</body>`); const fn = (process.argv[2] || require('path').join(__dirname, '..', 'local', 'bgconcepts')) + '/' + name.split(' ')[0] + '.png';
    await p.screenshot({ path: fn }); out.push(fn);
    // sample the background colour behind the blocks' height (rendered without the strip)
    await p.setContent(`<body style="margin:0"><svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${(seed=7,f())}</svg></body>`);
    const px = await p.evaluate(() => 0); }
  await b.close(); console.log(out.join('\n')); })();
