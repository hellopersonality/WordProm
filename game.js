/* Twistword game code. Word data comes from data/words.js, loaded first. */
(function(){
'use strict';
const VX=-35.264, VY=-45;
let reduce=false;
try{reduce=localStorage.getItem('twistword-calm')==='1'}catch(e){}
document.documentElement.classList.toggle('calm',reduce);
let DUR=reduce?200:320, TURN_DUR=reduce?240:460;
function setCalm(on){reduce=on;DUR=on?200:320;TURN_DUR=on?240:460;document.documentElement.classList.toggle('calm',on);try{localStorage.setItem('twistword-calm',on?'1':'0')}catch(e){}}
/* each face's local x and y axes in cube space; a letter's upright direction is -y */
const AXES={'0,0,1':[[1,0,0],[0,1,0]],'0,0,-1':[[-1,0,0],[0,1,0]],'1,0,0':[[0,0,-1],[0,1,0]],'-1,0,0':[[0,0,1],[0,1,0]],'0,-1,0':[[1,0,0],[0,0,1]],'0,1,0':[[1,0,0],[0,0,-1]]};
const FACE_NAME={'0,0,1':'front','0,-1,0':'top','1,0,0':'right','-1,0,0':'left','0,1,0':'bottom','0,0,-1':'back'};
const VISIBLE=['0,0,1','0,-1,0','1,0,0'];
/* twist arrows sit just past the outer edges of the three visible faces */
const ARROW_EDGES=[[[0,0,1],[-1,0,0]],[[0,0,1],[0,1,0]],[[1,0,0],[0,0,-1]],[[1,0,0],[0,1,0]],[[0,-1,0],[0,0,-1]],[[0,-1,0],[-1,0,0]]];
const FACE_ROT={'0,0,1':'','1,0,0':'rotateY(90deg)','0,-1,0':'rotateX(90deg)'};
const FACE_AXES={'0,0,1':[[1,0,0],[0,1,0]],'1,0,0':[[0,0,-1],[0,1,0]],'0,-1,0':[[1,0,0],[0,0,1]]};
const ARROW_SVG='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h12M12 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const HUE_OF={'0,0,1':'w','0,0,-1':'y','0,-1,0':'r','0,1,0':'o','1,0,0':'b','-1,0,0':'g'};
const FT={'0,0,1':'translateZ(var(--h))','0,0,-1':'rotateY(180deg) translateZ(var(--h))','1,0,0':'rotateY(90deg) translateZ(var(--h))','-1,0,0':'rotateY(-90deg) translateZ(var(--h))','0,-1,0':'rotateX(90deg) translateZ(var(--h))','0,1,0':'rotateX(-90deg) translateZ(var(--h))'};
const BAG='eeeeeeeeeeeaaaaaaaaaiiiiiiiooooooonnnnnnrrrrrrttttttsssssslllldddduuugggbbccmmppffhhwwyykv';

const CFG_META=[
  ['minLen','Minimum word length',2,5],
  ['coinsPerLetter','Coins per letter',0,20],
  ['longBonus','Bonus for 6+ letters',0,100],
  ['crossBonus','Bonus per extra face crossed',0,100],
  ['levelBonus','Level bonus',0,500],
  ['clearBonus','Cube clear bonus',0,1000],
  ['cleanBonus','Extra for a clear with no sweeps',0,1000],
  ['twistUnlock','Twists unlock at level',1,20],
  ['traySize','Free tray letters per level',0,10],
  ['trayResetCost','Cost to get new tray letters',0,500],
  ['wildsPerSet','Wildcards in each tray set',0,5],
  ['sweepMax','Sweep allowed at or below this many letters',0,54],
  ['sweepCost','Sweep cost per letter',0,200],
  ['freeCollapses','Free collapses per level',0,10],
  ['collapseCost','Collapse cost after free ones',0,500],
  ['startCoins','Starting coins',0,5000]
];
const DEFAULT_CFG={minLen:2,coinsPerLetter:2,longBonus:5,crossBonus:4,levelBonus:25,clearBonus:100,cleanBonus:100,twistUnlock:3,traySize:5,trayResetCost:50,freeCollapses:1,collapseCost:60,wildsPerSet:1,sweepMax:8,sweepCost:15,startCoins:100};

/* ---------- dictionary ---------- */
const DICT=new Set(), PREF=new Set();
(function decode(){
  const s=DICT_RAW; let w='', i=0;
  while(i<s.length){
    const k=s.charCodeAt(i)-48; i++;
    let j=i; while(j<s.length && s.charCodeAt(j)>57) j++;
    w=w.slice(0,k)+s.slice(i,j); i=j;
    DICT.add(w);
    for(let p=Math.max(1,k+1);p<w.length;p++) PREF.add(w.slice(0,p));
  }
})();
const PLANT=PLANT_RAW.split(' '), COMMON=new Set(PLANT), BYLEN={};
PLANT.forEach(w=>{(BYLEN[w.length]=BYLEN[w.length]||[]).push(w)});

/* ---------- helpers ---------- */
const $=id=>document.getElementById(id);
const key=v=>v.join(',');
const rnd=n=>Math.floor(Math.random()*n);
const pick=a=>a[rnd(a.length)];
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=rnd(i+1);[a[i],a[j]]=[a[j],a[i]]}return a}
function rot(v,k,s){const[x,y,z]=v;
  if(s>0) return k===0?[x,-z,y]:k===1?[z,y,-x]:[-y,x,z];
  return k===0?[x,z,-y]:k===1?[-z,y,x]:[y,-x,z];}
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const axisOf=n=>n[0]?0:n[1]?1:2;
function adj(a,b){
  const ka=axisOf(a.n), kb=axisOf(b.n);
  if(ka===kb){ if(a.n[ka]!==b.n[kb]) return false;
    return Math.max(Math.abs(a.pos[0]-b.pos[0]),Math.abs(a.pos[1]-b.pos[1]),Math.abs(a.pos[2]-b.pos[2]))===1; }
  /* across a cube edge: both stickers sit on the shared edge, like neighbours on the unfolded net */
  if(a.pos[kb]!==b.n[kb]||b.pos[ka]!==a.n[ka]) return false;
  const m=3-ka-kb; return Math.abs(a.pos[m]-b.pos[m])<=1;
}
const facesIn=p=>new Set(p.map(s=>key(s.n))).size;
function proj(v){const b=VY*Math.PI/180,a=VX*Math.PI/180;const[x,y,z]=v;
  const x1=x*Math.cos(b)+z*Math.sin(b), z1=-x*Math.sin(b)+z*Math.cos(b);
  return [x1, y*Math.cos(a)-z1*Math.sin(a)];}

/* ---------- state ---------- */
let cfg={...DEFAULT_CFG};
let G=null;
let busy=false, path=[], gesture=null, S=80;
const POS=[];for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++)if(x||y||z)POS.push([x,y,z]);

/* Saves the exact cube (letters, positions after twists, hidden words, tray, progress) so
   Continue resumes where the player left off. Browser storage can be missing; the game still runs. */
const SAVE_KEY='twistword-v2', ENDLESS_KEY='twistword-endless';
function load(k){try{return JSON.parse(localStorage.getItem(k||SAVE_KEY)||'null')}catch(e){return null}}
let saved=null, savedE=null;
const isEndless=()=>!!(G&&G.mode==='endless');
function save(){
  if(!G) return;
  if(isEndless()&&G.solution.length>80) G.solution=G.solution.slice(-80);
  const st={...G,note:null,stickers:G.stickers.map(s=>({id:s.id,pos:s.pos,n:s.n,ch:s.ch,hue:s.hue}))};
  const rec={level:G.level,coins:G.coins,words:G.found.length,cfg,state:st};
  if(isEndless()){savedE=rec;try{localStorage.setItem(ENDLESS_KEY,JSON.stringify(rec))}catch(e){}}
  else{saved=rec;try{localStorage.setItem(SAVE_KEY,JSON.stringify(rec))}catch(e){}}
}
function restore(st){
  if(!st||!st.stickers||st.stickers.length!==54) return false;
  G={...st,note:null};G.stickers=st.stickers.map(s=>({...s}));G.stickers.sort((a,b)=>a.id-b.id);
  path=[];$('sheet').hidden=true;
  if(G.done){newLevel(G.level+1,G.coins);return true}
  return true;
}
const twistsOn=()=>isEndless()||G.level>=cfg.twistUnlock;

function randomPath(cells,L){
  const free=cells.filter(c=>!c.ch);
  function dfs(p){ if(p.length===L) return p;
    const last=p[p.length-1];
    for(const c of shuffle(free.filter(c=>!p.includes(c)&&adj(c,last)))){const r=dfs([...p,c]);if(r)return r}
    return null;}
  for(const s of shuffle(free.slice())){const r=dfs([s]);if(r)return r}
  return null;
}
const VOW='aeiou';
const SPLITS=[[4,5],[4,5],[3,6],[3,6],[3,3,3]];
const trayLetter=()=>pick(BAG);
function makeTray(){
  const nw=Math.min(cfg.wildsPerSet,cfg.traySize),nl=cfg.traySize-nw;let a=null;
  for(let t=0;t<50&&!a;t++){const b=Array.from({length:nl},trayLetter);if(b.filter(c=>VOW.includes(c)).length>=Math.min(2,b.length))a=b}
  a=a||Array.from({length:nl},trayLetter);
  for(let i=0;i<nw;i++) a.splice(rnd(a.length+1),0,'?');
  return a;
}
/* wildcard tiles ('?') stand for any letter; pick the most common unused word that fits */
const ALPHA='abcdefghijklmnopqrstuvwxyz';
function resolveWild(pat){
  const found=new Set(G.found.map(f=>f.w)),hits=[];
  (function go(i,s){
    if(hits.length>400) return;
    if(i===pat.length){if(DICT.has(s)&&!found.has(s))hits.push(s);return}
    if(s&&!PREF.has(s)) return;
    for(const L of pat[i]==='?'?ALPHA:pat[i]) go(i+1,s+L);
  })(0,'');
  if(!hits.length) return null;
  hits.sort((x,y)=>(COMMON.has(y)-COMMON.has(x))||x.localeCompare(y));
  return hits[0];
}
function newLevel(level,coins,mode){
  mode=mode||(G&&G.mode)||'classic';
  const st=[];let id=0;
  for(const p of POS) for(let k=0;k<3;k++) if(p[k]!==0){const n=[0,0,0];n[k]=p[k];st.push({id:id++,pos:p.slice(),n,ch:null,hue:HUE_OF[key(n)]})}
  /* every face is tiled completely by hidden words, so a full clear always exists */
  const solution=[],usedW=new Set();
  for(const fk of Object.keys(FACE_NAME)){
    const cells=st.filter(s=>key(s.n)===fk);
    let words=null;
    for(let tries=0;tries<400&&!words;tries++){
      cells.forEach(c=>c.ch=null);const ws=[];
      for(const L of pick(SPLITS)){const p=randomPath(cells,L);if(!p)break;const w=pick(BYLEN[L].filter(x=>!usedW.has(x)));p.forEach((c,i)=>c.ch=w[i]);ws.push({word:w,ids:p.map(c=>c.id),done:false})}
      if(cells.every(c=>c.ch)) words=ws;
    }
    if(!words){words=[];cells.forEach(c=>{if(!c.ch)c.ch=pick(BAG)})}
    words.forEach(w=>usedW.add(w.word));solution.push(...words);
  }
  G={mode,level,coins,stickers:st,found:[],twistsUsed:0,lettersAdded:0,done:false,earned:0,spent:0,note:null,tray:makeTray(),solution,_deal:true};
  path=[];
  $('sheet').hidden=true;
}

/* ---------- solver ---------- */
/* words anywhere on the cube; onlyFaces limits which faces the path may use */
function cubeWords(firstOnly,onlyFaces){
  const cells=G.stickers.filter(s=>s.ch&&(!onlyFaces||onlyFaces.includes(key(s.n)))), out=[], found=new Set(G.found.map(f=>f.w));
  const nb=new Map(cells.map(c=>[c,cells.filter(d=>d!==c&&adj(c,d))]));
  let stop=false;
  function dfs(p,str){
    if(stop) return;
    if(str.length>=cfg.minLen&&DICT.has(str)&&!found.has(str)){out.push({w:str,path:p.slice(),fk:key(p[0].n)});if(firstOnly){stop=true;return}}
    if(!PREF.has(str)) return;
    for(const c of nb.get(p[p.length-1])){ if(!p.includes(c)){p.push(c);for(const L of c.ch==='?'?ALPHA:c.ch){dfs(p,str+L);if(stop)break}p.pop()} }
  }
  for(const c of cells){for(const L of c.ch==='?'?ALPHA:c.ch){dfs([c],L);if(stop)break}if(stop)break}
  return out;
}
const faceWords=(fk,firstOnly)=>cubeWords(firstOnly,[fk]);
const anyWord=()=>cubeWords(true).length>0;

/* ---------- render ---------- */
const cubeEl=$('cube'), stage=$('stage');
const base=p=>`translate3d(${p[0]*S}px,${p[1]*S}px,${p[2]*S}px)`;
let elById={};
function render(fresh){
  const map={};G.stickers.forEach(s=>map[key(s.pos)+'|'+key(s.n)]=s);
  const clock=(performance.now()%2800)/1000;
  elById={};const spun=[],slid=[];
  const frag=document.createDocumentFragment();
  for(const p of POS){
    const c=document.createElement('div');c.className='cubie';c._pos=p;c.style.transform=base(p);
    for(const fk of Object.keys(FT)){
      const f=document.createElement('div');f.style.transform=FT[fk];
      const s=map[key(p)+'|'+fk];
      if(s){f.className='face sticker h-'+s.hue+(s.ch?'':' empty')+(fresh?' fresh':'');f.dataset.id=s.id;
        {const q=[0,1,2].map(i=>p[i]+s.n[i]*.5);f.style.setProperty('--ph',`${-(clock+(q[0]-q[1]+q[2])*.32+9).toFixed(3)}s`)}
        const t=document.createElement('div');t.className='tile'+(s.ch==='?'?' wild':'');if(s.ch){const c=document.createElement('span');c.className='ch';c.textContent=s.ch;if(s.spin){c.style.transition='none';c.style.transform=`rotate(${s.spin}deg)`;spun.push(c)}t.appendChild(c)}if(s.born!==undefined){f.classList.add('born');f.style.setProperty('--b',s.born)}if(s.slide){t.style.transition='none';t.style.transform=`translate3d(${s.slide[0]*S}px,${s.slide[1]*S}px,${S*.04}px)`;slid.push(t)}f.appendChild(t);elById[s.id]=f;}
      else f.className='face';
      c.appendChild(f);
    }
    frag.appendChild(c);
  }
  if(twistsOn()&&!G.done){
    const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
    for(const [n,d] of ARROW_EDGES){
      const nk=key(n),[lx,ly]=FACE_AXES[nk],ang=Math.atan2(dot(d,ly),dot(d,lx))*180/Math.PI;
      const a=cross(n,d),k=axisOf(a),s=a[k];
      const ei=axisOf(d);
      for(const p of POS){
        if(p[axisOf(n)]!==n[axisOf(n)]||p[ei]!==d[ei]) continue;
        const c=[0,1,2].map(i=>(p[i]+n[i]*.5+d[i]*.95)*S);
        const b=document.createElement('button');b.className='arrow';b.innerHTML=ARROW_SVG;
        b.dataset.k=k;b.dataset.s=s;b.dataset.l=p[k];
        b.setAttribute('aria-label',`Twist ${k===1?'row':'column'} toward the ${FACE_NAME[key(d.map(v=>v))]||'edge'}`);
        b.style.transform=`translate3d(${c[0]}px,${c[1]}px,${c[2]}px) ${FACE_ROT[nk]} rotate(${ang}deg)`;
        frag.appendChild(b);
      }
    }
  }
  cubeEl.replaceChildren(frag);
  G.stickers.forEach(s=>{delete s.spin;delete s.slide;delete s.born});
  if(spun.length) requestAnimationFrame(()=>requestAnimationFrame(()=>spun.forEach(c=>{c.style.transition='';c.style.transform=''})));
  if(slid.length) requestAnimationFrame(()=>requestAnimationFrame(()=>{slid.forEach(el=>{el.style.transition='transform .5s cubic-bezier(.3,.1,.2,1)';el.style.transform=`translate3d(0,0,${S*.04}px)`});
    setTimeout(()=>slid.forEach(el=>{el.style.transition='none';el.style.transform=''}),540)}));
  paintSel();hud();
}
function paintSel(){
  const ids=new Set(path.map(s=>s.id));
  for(const id in elById)elById[id].classList.toggle('sel',ids.has(+id));
  const r=stage.getBoundingClientRect();
  /* the trail takes a colour that reads on each tile it crosses: dark on light stickers,
     light on cobalt, yellow on wildcards; a thin halo in the opposite tone keeps it legible at seams */
  const INK='#0A0A0A',PAPER='#F2F2F2',YEL='#FFD60A';
  const tone=s=>s.ch==='?'?[YEL,INK]:s.hue==='b'?[PAPER,INK]:[INK,PAPER];
  const pts=path.map(s=>{const b=elById[s.id].getBoundingClientRect();return {x:b.left+b.width/2-r.left,y:b.top+b.height/2-r.top,t:tone(s)}});
  const w=S*.15,h=w+S*.07;let defs='',halo='',core='',dots='';
  for(let i=1;i<pts.length;i++){
    const a=pts[i-1],b=pts[i],g=(id,ca,cb)=>`<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"><stop offset=".4" stop-color="${ca}"/><stop offset=".6" stop-color="${cb}"/></linearGradient>`;
    defs+=g('tc'+i,a.t[0],b.t[0])+g('th'+i,a.t[1],b.t[1]);
    const xy=`x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"`;
    halo+=`<line ${xy} stroke="url(#th${i})" stroke-opacity=".55" stroke-width="${h}"/>`;
    core+=`<line ${xy} stroke="url(#tc${i})" stroke-opacity=".85" stroke-width="${w}"/>`;
  }
  pts.forEach(p=>{dots+=`<circle cx="${p.x}" cy="${p.y}" r="${w*.62}" fill="${p.t[0]}" stroke="${p.t[1]}" stroke-opacity=".55" stroke-width="${S*.035}"/>`});
  $('trail').innerHTML=pts.length?`<defs>${defs}</defs>${halo}${core}${dots}`:'';
}
let lastHud={};
function juice(el){if(!el||reduce)return;el.classList.remove('juice');void el.offsetWidth;el.classList.add('juice');clearTimeout(el._jt);el._jt=setTimeout(()=>el.classList.remove('juice'),520)}
function hud(){
  const left=G.stickers.filter(s=>s.ch).length, total=G.stickers.length, made=G.found.length;
  if(lastHud.level!==undefined&&lastHud.level!==G.level) juice($('lvlPill'));
  document.documentElement.classList.toggle('endless',isEndless());
  $('lvl').textContent=isEndless()?'∞':G.level;$('lvlPill').title=isEndless()?'Endless':'Level';
  $('wordsVal').textContent=made;
  if(lastHud.made!==undefined&&made>lastHud.made) juice($('wordsPill'));
  $('lettersVal').textContent=left;
  if(lastHud.left!==undefined&&left!==lastHud.left) juice($('goalClear'));
  $('ring').style.strokeDashoffset=(263.9*(left/total)).toFixed(1);
  $('goalClear').title=left===0?'Cube cleared':`${left} letters left`;
  $('minLenTxt').textContent=cfg.minLen;
  setCoins(G.coins);
  const fc=Math.max(0,cfg.freeCollapses-(G.collapses||0)),cs=$('collapseSub');
  cs.textContent=fc?(fc>1?`${fc} free`:'free'):cfg.collapseCost;cs.classList.toggle('free',!!fc);
  $('trayResetSub').textContent=cfg.trayResetCost;
  if(!G.tray) G.tray=makeTray();
  const deal=G._deal;G._deal=false;const mid=(G.tray.length-1)/2;
  $('tray').innerHTML=G.tray.map((c,i)=>`<button class="tl${c==='?'?' wild':''}${deal?' deal':''}" style="--o:${(i-mid).toFixed(2)};--i:${i}" data-i="${i}" aria-label="${c==='?'?'Wildcard, any letter':'Letter '+c.toUpperCase()}">${c}</button>`).join('')+
    Array.from({length:Math.max(0,cfg.traySize-G.tray.length)},()=>'<span class="tray-empty"></span>').join('');
  $('found').innerHTML=made?G.found.map(f=>`<span class="w${f.nf>1?' cross':''}">${f.w}<b>+${f.c}</b></span>`).join(''):'<span class="none">No words yet</span>';
  lastHud={level:G.level,made,left};
}

/* ---------- coins: counter, particles ---------- */
let shown=null,inFlight=0,coinTween=0;
function drawCoins(){$('coins').textContent=shown}
function setCoins(v){
  if(shown===null){shown=v;drawCoins();return}
  if(inFlight>0||v===shown) return;
  if(v<shown){const t=$('coinTile');t.classList.remove('spend');void t.offsetWidth;t.classList.add('spend')}
  const from=shown,d=v-from,t0=performance.now(),dur=reduce?0:Math.min(700,250+Math.abs(d)*6),id=++coinTween;
  (function step(now){if(id!==coinTween)return;const k=dur?Math.min(1,(now-t0)/dur):1;shown=Math.round(from+d*(1-Math.pow(1-k,3)));drawCoins();if(k<1)requestAnimationFrame(step)})(t0);
}
/* coins burst from where they were earned and arc into the counter, each one ticking it up */
function spawnCoins(points,amount){
  if(!amount) return;
  const tile=$('coinTile'),tr=tile.getBoundingClientRect(),tx=tr.left+18,ty=tr.top+tr.height/2;
  if(reduce||!points.length){hud();return}
  const n=Math.max(1,Math.min(amount,18)),base=Math.floor(amount/n);let extra=amount-base*n;
  coinTween++;inFlight+=n;
  const fx=$('fx');
  for(let i=0;i<n;i++){
    const share=base+(extra-->0?1:0),[sx,sy]=points[i%points.length];
    const el=document.createElement('div');el.className='cp';fx.appendChild(el);
    const ang=Math.random()*Math.PI*2,r=30+Math.random()*50,bx=sx+Math.cos(ang)*r,by=sy+Math.sin(ang)*r-40;
    const delay=i*28,dur=620+Math.random()*260,t0=performance.now()+delay;
    el.style.transform=`translate(${sx}px,${sy}px) scale(0)`;
    (function step(now){
      const k=Math.max(0,Math.min(1,(now-t0)/dur));
      if(now<t0){requestAnimationFrame(step);return}
      const e=k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2, u=1-e;
      const x=u*u*sx+2*u*e*bx+e*e*tx, y=u*u*sy+2*u*e*by+e*e*ty, sc=k<.15?k/.15:1-.4*e;
      el.style.transform=`translate(${x}px,${y}px) scale(${sc}) rotate(${k*360}deg)`;
      if(k<1){requestAnimationFrame(step);return}
      el.remove();shown+=share;drawCoins();juice(tile);
      if(--inFlight===0){setCoins(G.coins)}
    })(performance.now());
  }
  const f=document.createElement('div');f.className='float';f.textContent='+'+amount;
  const c=points.reduce((a,p)=>[a[0]+p[0]/points.length,a[1]+p[1]/points.length],[0,0]);
  f.style.left=c[0]+'px';f.style.top=c[1]+'px';fx.appendChild(f);setTimeout(()=>f.remove(),950);
}
const centerOf=el=>{const r=el.getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]};

/* ---------- notices ---------- */
let toastT;
function toast(m){const t=$('toast');t.textContent=m;t.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>t.hidden=true,2600)}
function clearNotice(){$('notice').hidden=true;$('notice').dataset.msg=''}
function setNotice(msg,tone,actions){
  const n=$('notice'),sig=msg+'|'+(actions||[]).map(a=>a[0]).join();if(n.dataset.msg===sig&&!n.hidden)return;n.dataset.msg=sig;n.hidden=false;n.className='notice'+(tone?' '+tone:'');n.innerHTML='';
  const m=document.createElement('span');m.className='msg';m.textContent=msg;n.appendChild(m);
  (actions||[]).forEach(([label,fn,primary])=>{const b=document.createElement('button');b.className='btn'+(primary?' primary':'');b.textContent=label;b.onclick=fn;n.appendChild(b)});
}
function status(){
  if(G.done) return;
  if(G.note){const nt=G.note;G.note=null;setNotice(nt.msg,nt.tone,nt.actions);return}
  if(!anyWord()){
    const left=G.stickers.filter(s=>s.ch).length,acts=[];
    if(left<=cfg.sweepMax) acts.push([`Sweep ${left} · ${left*cfg.sweepCost}`,sweep,true]);
    if(canCollapse()) acts.push(['Collapse',collapse,!acts.length]);
    acts.push(['Reshuffle',reshuffle]);
    setNotice('No words left','warn',acts);return;
  }
  const lone=stranded();
  if(lone>=3){setNotice(`${lone} stranded letters`,'warn',canCollapse()?[['Collapse',collapse,true]]:[]);return}
  if(twistsOn()&&G.level===cfg.twistUnlock&&!G.twistsUsed){setNotice('Twists unlocked · tap the arrows','good');return}
  clearNotice();
}

/* ---------- preview ---------- */
let prevT;
let lastPrev='';
function preview(word,cls,extra){
  const p=$('preview');clearTimeout(prevT);p.className='preview'+(cls?' '+cls:'');
  const grow=!cls&&word.length===lastPrev.length+1&&word.startsWith(lastPrev);lastPrev=cls?'':word;
  p.innerHTML='';const w=document.createElement('span');w.className='word';
  [...word].forEach((ch,i)=>{const l=document.createElement('span');l.className='l'+(grow&&i===word.length-1?' new':'');l.style.setProperty('--i',i);l.textContent=ch;w.appendChild(l)});
  p.appendChild(w);
  if(extra){const e=document.createElement('span');e.className='tag';e.textContent=extra;p.appendChild(e)}
  if(cls) prevT=setTimeout(()=>{p.className='preview';p.innerHTML='';lastPrev=''},1500);
}

/* ---------- moves ---------- */
const cubies=sel=>[...cubeEl.children].filter(el=>el._pos&&sel(el._pos));
function rotEls(els,A,deg,ms){els.forEach(el=>{el.style.transition=ms?`transform ${ms}ms cubic-bezier(.25,.1,.2,1)`:'none';el.style.transform=`rotate${A}(${deg}deg) ${base(el._pos)}`})}
/* rotate stickers in the selected layer(s); letters keep their on-screen tilt, then spin upright */
function moveStickers(sel,k,s){
  const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  G.stickers.forEach(st=>{if(!sel(st.pos))return;
    const up=rot(AXES[key(st.n)][1].map(v=>-v),k,s);
    st.pos=rot(st.pos,k,s);st.n=rot(st.n,k,s);
    const[lx,ly]=AXES[key(st.n)];const a=Math.round(Math.atan2(dot(up,lx),-dot(up,ly))*180/Math.PI);
    if(a) st.spin=a;});
}
function animate(sel,k,s,dur,after,fromDeg){
  busy=true;cubeEl.classList.add('moving');
  const A='XYZ'[k], els=cubies(sel);
  if(!fromDeg){rotEls(els,A,0,0);void cubeEl.offsetWidth;}
  const ms=Math.max(90,Math.round(dur*(1-Math.abs(fromDeg||0)/90)));
  rotEls(els,A,90*s,ms);
  setTimeout(()=>{moveStickers(sel,k,s);cubeEl.classList.remove('moving');render(true);busy=false;after&&after()},ms+30);
}
function turnCube(k,s,fromDeg){
  if((busy&&!fromDeg)||G.done) return;
  path=[];
  animate(()=>true,k,s,TURN_DUR,null,fromDeg);
}
function twist(k,s,layer){
  if(busy||G.done||!twistsOn()) return;
  path=[];G.twistsUsed++;
  animate(p=>p[k]===layer,k,s,DUR,()=>{status();save()});
}
function dirFor(n,dx,dy){
  let best=null,bd=-Infinity;
  for(let i=0;i<3;i++){if(n[i]!==0)continue;for(const sg of [1,-1]){const d=[0,0,0];d[i]=sg;const p=proj(d);const l=Math.hypot(p[0],p[1])||1;const dot=(p[0]*dx+p[1]*dy)/l;if(dot>bd){bd=dot;best=d}}}
  const a=cross(n,best),k=a.findIndex(v=>v!==0);return [k,a[k]];
}

/* ---------- collapse power-up ----------
   For each face, try every way of placing that face's letters on its 9 squares and keep the layout
   that leaves the fewest letters stranded and the most letters touching, counting letters on
   neighbouring faces across the edges. Letters never leave their face. A few passes let faces
   settle against each other; ties favour the layout that moves letters least. */
let NB=null;
/* recomputed each time: turns and twists move stickers, so neighbours change */
function neighbours(){NB={};G.stickers.forEach(a=>NB[a.id]=G.stickers.filter(b=>b!==a&&adj(a,b)).map(b=>b.id));return NB}
function stranded(){const nb=neighbours();return G.stickers.filter(s=>s.ch&&!nb[s.id].some(id=>G.stickers[id].ch)).length}
const canCollapse=()=>(G.collapses||0)<cfg.freeCollapses||G.coins>=cfg.collapseCost;
function collapseLetters(){
  const nb=neighbours(), faces=Object.keys(FACE_NAME), occ=new Set(G.stickers.filter(s=>s.ch).map(s=>s.id));
  const cellsOf={};faces.forEach(fk=>cellsOf[fk]=G.stickers.filter(s=>key(s.n)===fk));
  const orig={};faces.forEach(fk=>orig[fk]=cellsOf[fk].filter(s=>s.ch));
  const pc=m=>{let c=0;while(m){c+=m&1;m>>=1}return c};
  const dist=(a,b)=>Math.hypot(a.pos[0]-b.pos[0],a.pos[1]-b.pos[1],a.pos[2]-b.pos[2]);
  function moveCost(from,to){ /* greedy nearest pairing, good enough for 9 squares */
    const pairs=[];from.forEach((a,i)=>to.forEach((b,j)=>pairs.push([dist(a,b),i,j])));pairs.sort((x,y)=>x[0]-y[0]);
    const ui=new Set(),uj=new Set(),map=[];let c=0;
    for(const[d,i,j] of pairs){if(ui.has(i)||uj.has(j))continue;ui.add(i);uj.add(j);map.push([from[i],to[j]]);c+=d}
    return {c,map};
  }
  const plan={};
  for(let pass=0;pass<4;pass++){
    let changed=false;
    for(const fk of faces){
      const cells=cellsOf[fk],k=orig[fk].length;if(k===0||k===9) continue;
      let best=null;
      for(let m=0;m<512;m++){
        if(pc(m)!==k) continue;
        const chosen=cells.filter((_,i)=>m>>i&1),ids=new Set(chosen.map(s=>s.id));
        let iso=0,tight=0;
        for(const s of chosen){let n=0;for(const id of nb[s.id]){const same=key(G.stickers[id].n)===fk;if(same?ids.has(id):occ.has(id)){n++;tight+=same?.5:.8}}if(!n)iso++}
        const mv=moveCost(orig[fk],chosen);
        const score=-12*iso+tight-.04*mv.c;
        if(!best||score>best.score+1e-9) best={score,chosen,map:mv.map};
      }
      const prevIds=[...cellsOf[fk]].filter(s=>occ.has(s.id)).map(s=>s.id).sort().join();
      cellsOf[fk].forEach(s=>occ.delete(s.id));best.chosen.forEach(s=>occ.add(s.id));
      if(best.chosen.map(s=>s.id).sort().join()!==prevIds) changed=true;
      plan[fk]=best.map;
    }
    if(!changed&&pass>0) break;
  }
  /* apply: letters glide across their face to the new squares */
  let moved=0;const letters=new Map(G.stickers.map(s=>[s.id,s.ch]));
  for(const fk in plan){
    const[lx,ly]=AXES[fk];
    cellsOf[fk].forEach(s=>s.ch=null);
    for(const[from,to] of plan[fk]){
      to.ch=letters.get(from.id);
      if(from!==to){moved++;const v=[0,1,2].map(i=>from.pos[i]-to.pos[i]);to.slide=[dot3(v,lx),dot3(v,ly)]}
    }
  }
  return moved;
}
function collapse(){
  if(busy||G.done||drag) return;
  const free=(G.collapses||0)<cfg.freeCollapses;
  if(!free&&G.coins<cfg.collapseCost){toast(`A collapse costs ${cfg.collapseCost} coins. Make words to earn more.`);return}
  const before=stranded();
  const moved=collapseLetters();
  if(!moved){render();toast('The letters are already as close together as they can get.');return}
  if(!free){G.coins-=cfg.collapseCost;G.spent+=cfg.collapseCost}
  G.collapses=(G.collapses||0)+1;path=[];
  render();
  const after=stranded();
  preview('collapse','ok',before>after?`${before-after} letter${before-after===1?'':'s'} rescued`:`${moved} letters moved`);
  status();save();
}

/* endgame: pay to clear the last few letters when no word can use them */
function sweep(){
  if(busy||G.done) return;
  const left=G.stickers.filter(s=>s.ch),cost=left.length*cfg.sweepCost;
  if(left.length>cfg.sweepMax){toast(`Sweep works once ${cfg.sweepMax} or fewer letters are left.`);return}
  if(G.coins<cost){toast(`Sweeping ${left.length} letters costs ${cost} coins.`);return}
  G.coins-=cost;G.spent+=cost;G.swept=(G.swept||0)+left.length;
  busy=true;left.forEach(s=>elById[s.id]&&elById[s.id].classList.add('pop'));
  preview('swept','ok',`−${cost}`);
  setTimeout(()=>{left.forEach(s=>s.ch=null);busy=false;render();progress()},reduce?0:230);
}

/* ---------- words ---------- */
function submit(){
  const word=path.map(s=>s.ch).join('');
  const used=path.slice();path=[];
  if(word.length<cfg.minLen){paintSel();preview('');if(word.length>1)preview(word,'bad',`words need ${cfg.minLen}+ letters`);return}
  if(word.includes('?')){
    const w2=resolveWild(word);
    if(!w2){paintSel();preview(word,'bad','no unused word fits');return}
    return accept(w2,used);
  }
  if(!DICT.has(word)){paintSel();preview(word,'bad','not in the word list');return}
  if(G.found.some(f=>f.w===word)){paintSel();preview(word,'bad','already made');return}
  accept(word,used);
}
/* the hidden route: is a full clear still guaranteed from here? */
function routeWords(){
  return (G.solution||[]).map(w=>{
    if(w.done) return {...w,state:'done'};
    if(G.found.some(f=>f.w===w.word)) return {...w,state:'broken'}; /* already spent elsewhere; can't be made twice */
    const ss=w.ids.map(id=>G.stickers[id]);
    const ok=ss.every((s,i)=>s.ch===w.word[i])&&ss.every((s,i)=>i===0||adj(ss[i-1],s));
    return {...w,state:ok?'intact':'broken'};
  });
}
function routeIntact(){
  if(!G.solution||!G.solution.length) return false;
  const rw=routeWords();if(rw.some(w=>w.state==='broken')) return false;
  const owned=new Set();rw.forEach(w=>{if(w.state==='intact')w.ids.forEach(id=>owned.add(id))});
  return G.stickers.every(s=>!s.ch||owned.has(s.id));
}
function accept(word,used){
  const uk=used.map(s=>s.id).sort((a,b)=>a-b).join();
  (G.solution||[]).forEach(w=>{if(!w.done&&w.ids.slice().sort((a,b)=>a-b).join()===uk)w.done=true});
  const nf=facesIn(used);
  const c=word.length*cfg.coinsPerLetter+(word.length>=6?cfg.longBonus:0)+(nf-1)*cfg.crossBonus;
  const pts=used.map(st=>elById[st.id]).filter(Boolean).map(centerOf);
  G.coins+=c;G.earned+=c;G.found.push({w:word,c,nf});
  preview(word,'ok',nf>1?`${nf} faces`:'');
  if(!reduce){stage.style.setProperty('--k',Math.min(4,word.length-2));stage.classList.remove('thump');void stage.offsetWidth;stage.classList.add('thump');setTimeout(()=>stage.classList.remove('thump'),340)}
  spawnCoins(pts,c);
  busy=true;
  used.forEach(s=>elById[s.id]&&elById[s.id].classList.add('pop'));
  paintSel();
  setTimeout(()=>{if(isEndless())refill(used);else used.forEach(s=>s.ch=null);busy=false;render();progress()},reduce?0:230);
}
/* endless: the squares a word leaves are filled straight away with a new hidden word (or words)
   along a fresh path through those same squares, so there is always something to spell there */
function refill(cells){
  cells.forEach(c=>c.ch=null);
  const found=new Set(G.found.map(f=>f.w)),order=[];
  for(let guard=0;guard<12&&cells.some(c=>!c.ch);guard++){
    const left=cells.filter(c=>!c.ch).length;let placed=false;
    for(let L=Math.min(left,9);L>=2&&!placed;L--){
      const pool=(BYLEN[L]||[]).filter(w=>!found.has(w));if(!pool.length) continue;
      const p=randomPath(cells,L);if(!p) continue;
      const w=pick(pool);p.forEach((c,i)=>{c.ch=w[i];order.push(c)});found.add(w);
      G.solution.push({word:w,ids:p.map(c=>c.id),done:false});placed=true;
    }
    if(!placed) cells.filter(c=>!c.ch).forEach(c=>{c.ch=pick(BAG);order.push(c)});
  }
  order.forEach((c,i)=>c.born=i);
}
function progress(){
  if(!G.stickers.some(s=>s.ch)){complete(true);return}
  status();save();
}
function reshuffle(){
  const filled=G.stickers.filter(s=>s.ch), letters=filled.map(s=>s.ch);
  for(let t=0;t<300;t++){shuffle(letters);filled.forEach((s,i)=>s.ch=letters[i]);if(anyWord()){render(true);status();return}}
  render();
  const left=G.stickers.filter(s=>s.ch).length,acts=[];
  if(left<=cfg.sweepMax) acts.push([`Sweep ${left} · ${left*cfg.sweepCost}`,sweep,true]);
  acts.push(['Restart level',()=>{newLevel(G.level,G.coins);render(true);status();save()},!acts.length]);
  G.note={msg:"These letters can't form a word",tone:'warn',actions:acts};status();
}
function complete(cleared){
  if(G.done) return;
  G.done=true;path=[];paintSel();
  const clean=cleared&&!G.swept;
  const left=G.stickers.filter(s=>s.ch).length, bonus=cfg.levelBonus+(cleared?cfg.clearBonus:0)+(clean?cfg.cleanBonus:0);
  G.coins+=bonus;
  $('sheetTitle').textContent=`Level ${G.level} cleared`;
  const rows=[['Words',`${G.found.length}`],['From words',`+${G.earned}`,'pos'],['Level bonus',`+${cfg.levelBonus}`,'pos'],['Clear bonus',`+${cfg.clearBonus}`,'pos'],
    ...(clean?[['No-help bonus',`+${cfg.cleanBonus}`,'pos']]:[]),...(G.swept?[['Swept',`${G.swept}`]]:[]),...(G.spent?[['Spent',`−${G.spent}`,'neg']]:[])];
  $('sheetStats').innerHTML=rows.map((r,i)=>`<div style="--i:${i}"><dt>${r[0]}</dt><dd class="${r[2]||''}">${r[1]}</dd></div>`).join('');
  $('sheet').hidden=false;clearNotice();
  inFlight++;hud();setTimeout(()=>{inFlight--;spawnCoins([centerOf($('nextBtn'))],bonus);if(reduce)setCoins(G.coins)},reduce?0:650);
  save();$('nextBtn').focus({preventScroll:true});
}

/* ---------- pointer geometry ----------
   The pointer is projected back onto the cube's faces (same rotation and perspective as the CSS),
   so tracing works in true face units instead of the skewed on-screen tile shapes. */
const D2R=Math.PI/180, dot3=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
function toView([x,y,z]){const b=VY*D2R,a=VX*D2R;const x1=x*Math.cos(b)+z*Math.sin(b),z1=-x*Math.sin(b)+z*Math.cos(b);return [x1,y*Math.cos(a)-z1*Math.sin(a),y*Math.sin(a)+z1*Math.cos(a)]}
function fromView([x1,y2,z2]){const b=VY*D2R,a=VX*D2R;const y=y2*Math.cos(a)+z2*Math.sin(a),z1=-y2*Math.sin(a)+z2*Math.cos(a);return [x1*Math.cos(b)-z1*Math.sin(b),y,x1*Math.sin(b)+z1*Math.cos(b)]}
function screenToCube(cx,cy){
  const r=stage.getBoundingClientRect(),sx=cx-(r.left+r.width/2),sy=cy-(r.top+r.height/2),d=13*S;
  let best=null;
  for(const fk of VISIBLE){
    const n=fk.split(',').map(Number),nv=toView(n),den=nv[0]*sx+nv[1]*sy-nv[2]*d;
    if(Math.abs(den)<1e-9) continue;
    const tt=(1.5*S-nv[2]*d)/den;if(tt<=0) continue;
    const X=[tt*sx,tt*sy,d*(1-tt)],P=fromView(X).map(v=>v/S),k=axisOf(n);
    const over=Math.max(...[0,1,2].filter(i=>i!==k).map(i=>Math.abs(P[i])))-1.5;
    if(over>.3) continue;
    const sc=(over<=0?1e6:0)+X[2];
    if(!best||sc>best.sc) best={fk,n,P,sc};
  }
  return best;
}
const ctr=s=>[0,1,2].map(i=>s.pos[i]+s.n[i]*.5);
/* Pick the next letter. On the same face, the drag direction from the last letter snaps to one of
   eight directions once the pointer is 0.6 tiles out, so diagonals win over brushing a side
   neighbour. Across an edge, the pointer must come within 0.42 tiles of a letter's centre. */
function traceTarget(cx,cy){
  const h=screenToCube(cx,cy);if(!h) return null;
  const last=path[path.length-1],prev=path[path.length-2];
  if(h.fk===key(last.n)){
    const[lx,ly]=AXES[h.fk],c=ctr(last),v=[0,1,2].map(i=>h.P[i]-c[i]),u=dot3(v,lx),w=dot3(v,ly);
    if(Math.hypot(u,w)<.6) return null;
    const o=Math.round(Math.atan2(w,u)/(Math.PI/4)),du=Math.round(Math.cos(o*Math.PI/4)),dv=Math.round(Math.sin(o*Math.PI/4));
    const tp=key([0,1,2].map(i=>last.pos[i]+du*lx[i]+dv*ly[i]));
    const s=G.stickers.find(q=>key(q.n)===h.fk&&key(q.pos)===tp);
    if(s&&(s===prev||(s.ch&&!path.includes(s)))) return s;
  }
  let best=null,bd=.42;
  for(const s of G.stickers){if(!s.ch||!VISIBLE.includes(key(s.n)))continue;const c=ctr(s),dd=Math.hypot(h.P[0]-c[0],h.P[1]-c[1],h.P[2]-c[2]);if(dd<bd){bd=dd;best=s}}
  return best;
}

/* ---------- input ---------- */
function stickerAt(x,y){const el=document.elementFromPoint(x,y);const t=el&&el.closest&&el.closest('.sticker');return t&&stage.contains(t)?t:null}
const byId=id=>G.stickers[id];
stage.addEventListener('pointerdown',e=>{
  if(!playing||busy||G.done||e.button>0) return;
  $('foundPanel').hidden=true;
  const ar=e.target.closest&&e.target.closest('.arrow');
  if(ar){e.preventDefault();twist(+ar.dataset.k,+ar.dataset.s,+ar.dataset.l);return}
  try{stage.setPointerCapture(e.pointerId)}catch(_){}
  const t=stickerAt(e.clientX,e.clientY), st=t&&byId(+t.dataset.id);
  gesture={x:e.clientX,y:e.clientY,st,fired:false,kind:st&&st.ch?'trace':'turn'};
  if(gesture.kind==='trace'){path=[st];paintSel();preview(st.ch)}
  e.preventDefault();
});
stage.addEventListener('pointermove',e=>{
  if(!gesture) return;
  const dx=e.clientX-gesture.x, dy=e.clientY-gesture.y;
  if(gesture.kind==='trace'){
    const st=traceTarget(e.clientX,e.clientY), last=path[path.length-1];
    if(!st||st===last||!st.ch) return;
    if(path.length>1&&st===path[path.length-2]) path.pop();
    else if(!path.includes(st)&&adj(st,last)) path.push(st);
    else return;
    paintSel();preview(path.map(s=>s.ch).join(''));
    return;
  }
  liveMove(gesture,e.clientX,e.clientY,stage.clientWidth*.4);
});
function endGesture(){
  if(!gesture)return;const g=gesture;gesture=null;
  if(g.kind==='trace'){submit();return}
  liveEnd(g);
}
/* whole-cube turn that follows a drag. Passing a full quarter turn commits it and keeps going,
   so one long drag can spin the cube round; on release it settles to the nearest face. */
function liveMove(g,cx,cy,span){
  const dx=cx-g.x,dy=cy-g.y;
  if(!g.live){
    if(busy||G.done||Math.hypot(dx,dy)<8) return;
    const[k,s]=dirFor([0,0,1],dx,dy),l=Math.hypot(dx,dy);
    g.live={k,s,ux:dx/l,uy:dy/l,deg:0,els:cubies(()=>true)};busy=true;path=[];paintSel();cubeEl.classList.add('moving');
  }
  const L=g.live,prog=(dx*L.ux+dy*L.uy)/span;
  if(prog>=1){moveStickers(()=>true,L.k,L.s);cubeEl.classList.remove('moving');render(true);busy=false;g.live=null;g.x=cx;g.y=cy;return}
  L.deg=Math.max(-.1,prog)*90*L.s;
  rotEls(L.els,'XYZ'[L.k],L.deg,0);
}
function liveEnd(g){
  const L=g.live;if(!L) return;g.live=null;
  if(Math.abs(L.deg)>=24){turnCube(L.k,L.s,L.deg);return}
  rotEls(L.els,'XYZ'[L.k],0,160);
  setTimeout(()=>{cubeEl.classList.remove('moving');render();busy=false},190);
}
/* The turn pad is one big target: tap a side to turn the cube that way, or drag anywhere on it
   to spin the cube with your finger; the knob springs back on release. */
(function pad(){
  const area=$('pad'),knob=$('knob');let g=null;
  const flash=d=>{area.querySelectorAll('.chev').forEach(c=>c.classList.toggle('on',c.dataset.d===d));setTimeout(()=>area.querySelectorAll('.chev').forEach(c=>c.classList.remove('on')),250)};
  area.addEventListener('pointerdown',e=>{
    if(!playing||G.done||busy||e.button>0) return;e.preventDefault();
    try{area.setPointerCapture(e.pointerId)}catch(_){}
    g={x:e.clientX,y:e.clientY,ox:e.clientX,oy:e.clientY,moved:false};knob.style.transition='none';
  });
  area.addEventListener('pointermove',e=>{
    if(!g) return;
    const dx=e.clientX-g.ox,dy=e.clientY-g.oy;
    if(Math.hypot(dx,dy)>8) g.moved=true;
    if(!g.moved) return;
    const l=Math.hypot(dx,dy),k=Math.min(1,18/(l||1));
    knob.style.transform=`translate(${dx*k}px,${dy*k}px)`;
    liveMove(g,e.clientX,e.clientY,110);
  });
  const end=e=>{
    if(!g) return;const h=g;g=null;
    knob.style.transition=reduce?'none':'transform .5s cubic-bezier(.2,1.8,.4,1)';knob.style.transform='';
    if(h.moved){liveEnd(h);return}
    if(e.type==='pointercancel'||held(area)) return;
    const r=area.getBoundingClientRect(),vx=e.clientX-(r.left+r.width/2),vy=e.clientY-(r.top+r.height/2);
    if(Math.hypot(vx,vy)<4) return;
    if(Math.abs(vx)>Math.abs(vy)){flash(vx>0?'right':'left');turnCube(1,vx>0?1:-1)}
    else{flash(vy>0?'down':'up');turnCube(0,vy>0?-1:1)}
  };
  area.addEventListener('pointerup',end);area.addEventListener('pointercancel',end);
})();
stage.addEventListener('pointerup',endGesture);
stage.addEventListener('pointercancel',endGesture);

stage.addEventListener('click',e=>{const ar=e.target.closest&&e.target.closest('.arrow');if(ar&&e.detail===0)twist(+ar.dataset.k,+ar.dataset.s,+ar.dataset.l)});

/* ---------- letter tray ---------- */
let drag=null;
const tray=$('tray');
function clearDrop(){for(const id in elById)elById[id].classList.remove('drop-ok','drop-hover')}
tray.addEventListener('pointerdown',e=>{
  const b=e.target.closest('.tl');if(!b||!playing||busy||G.done||e.button>0) return;
  e.preventDefault();
  const i=+b.dataset.i, gh=document.createElement('div');gh.className='ghost'+(G.tray[i]==='?'?' wild':'');gh.textContent=G.tray[i];document.body.appendChild(gh);
  const lift=e.pointerType==='touch'?-74:0;
  gh.style.transform=`translate(${e.clientX}px,${e.clientY+lift}px) rotate(-6deg)`;
  b.classList.add('lifted');
  try{tray.setPointerCapture(e.pointerId)}catch(_){}
  G.stickers.forEach(s=>{if((!s.ch||isEndless())&&elById[s.id])elById[s.id].classList.add('drop-ok')});
  path=[];paintSel();
  drag={i,gh,b,over:null,lift};
});
tray.addEventListener('pointermove',e=>{
  if(!drag) return;
  drag.gh.style.transform=`translate(${e.clientX}px,${e.clientY+drag.lift}px) rotate(-6deg)`;
  if(!reduce){const vx=e.clientX-(drag.lx??e.clientX);drag.lx=e.clientX;drag.gh.style.rotate=`${Math.max(-22,Math.min(22,vx*2.2)).toFixed(1)}deg`;
    clearTimeout(drag.rt);drag.rt=setTimeout(()=>{if(drag)drag.gh.style.rotate='0deg'},70)}
  const t=stickerAt(e.clientX,e.clientY), st=t&&byId(+t.dataset.id);
  const ok=st&&(!st.ch||isEndless())?st:null;
  if(ok!==drag.over){if(drag.over&&elById[drag.over.id])elById[drag.over.id].classList.remove('drop-hover');drag.over=ok;if(ok)elById[ok.id].classList.add('drop-hover');drag.gh.style.scale=ok?'1.15':'1'}
});
function endDrag(e){
  if(!drag) return;
  const d=drag;drag=null;d.gh.remove();d.b.classList.remove('lifted');clearDrop();
  if(e.type==='pointercancel') return;
  if(d.over){
    const ch=G.tray[d.i];
    const swap=!!d.over.ch;d.over.ch=ch;d.over.born=0;G.lettersAdded++;G.tray.splice(d.i,1);
    render();preview(ch,'ok',swap?(G.tray.length?`swapped · ${G.tray.length} left`:'swapped · tray empty'):G.tray.length?`placed · ${G.tray.length} left`:'placed · tray empty');status();save();
  } else {
    const t=stickerAt(e.clientX,e.clientY);
    if(t) toast(isEndless()?'Drop the letter on a square to swap it in.':'Drop the letter on an empty square.');
  }
}
tray.addEventListener('pointerup',endDrag);
$('trayReset').onclick=()=>{
  if(held($('trayReset'))) return;
  if(busy||G.done||drag) return;
  if(G.coins<cfg.trayResetCost){toast(`New letters cost ${cfg.trayResetCost} coins. Make words to earn more.`);return}
  G.coins-=cfg.trayResetCost;G.spent+=cfg.trayResetCost;G.trayResets=(G.trayResets||0)+1;G.tray=makeTray();G._deal=true;
  hud();status();save();toast(`New set of ${G.tray.length} letters.`);
};
tray.addEventListener('pointercancel',endDrag);
$('collapseBtn').onclick=()=>{if(!held($('collapseBtn')))collapse()};
$('nextBtn').onclick=()=>{newLevel(G.level+1,G.coins);if(G.level===cfg.twistUnlock)toast('Twists unlocked.');size();render(true);status();save()};
document.addEventListener('keydown',e=>{
  if(e.target.closest&&e.target.closest('input')) return;
  if(e.key==='Escape'){back();return}
  if(!playing||!$('pause').hidden||!$('info').hidden) return;
  const m={ArrowLeft:[1,-1],ArrowRight:[1,1],ArrowUp:[0,1],ArrowDown:[0,-1]}[e.key];
  if(m){e.preventDefault();turnCube(m[0],m[1])}
});

/* ---------- tuning ---------- */
function buildTune(){
  const box=$('tune');
  box.innerHTML=`<label class="toggle" for="calmBox">Reduce motion<input type="checkbox" id="calmBox"${reduce?' checked':''}></label><p>Economy changes apply when you restart the level.</p>`+CFG_META.map(([k,l,mn,mx])=>`<label for="cfg-${k}">${l}<input type="number" id="cfg-${k}" min="${mn}" max="${mx}" value="${cfg[k]}"></label>`).join('')+
   '<div class="row"><button class="btn primary" id="applyCfg">Apply and restart level</button><button class="btn" id="resetCfg">Defaults</button><button class="btn" id="resetAll">Reset progress</button></div><p class="credits">Word lists: ENABLE, and 12dicts by Alan Beale, both public domain. Font: Figtree, SIL Open Font License.</p>';
  $('calmBox').onchange=e=>{setCalm(e.target.checked);toast(e.target.checked?'Motion reduced.':'Full motion on.')};
  $('applyCfg').onclick=()=>{CFG_META.forEach(([k,,mn,mx])=>{const v=parseInt($('cfg-'+k).value,10);cfg[k]=isNaN(v)?DEFAULT_CFG[k]:Math.max(mn,Math.min(mx,v))});buildTune();
    if(G){newLevel(G.level,G.coins);size();render(true);status();save();toast(playing?'Settings applied. Level restarted.':'Settings saved.')}};
  $('resetCfg').onclick=()=>{cfg={...DEFAULT_CFG};buildTune()};
  let armed=false;const ra=$('resetAll');
  ra.onclick=()=>{if(!armed){armed=true;ra.textContent='Tap again to reset';setTimeout(()=>{armed=false;ra.textContent='Reset progress'},3000);return}
    newLevel(1,cfg.startCoins);size();render(true);status();save();ra.textContent='Reset progress';armed=false;refreshTitle();toast('Progress reset to level 1.')};
}

/* ---------- info overlay ---------- */
function openInfo(tab){$('info').hidden=false;showTab(tab||'play');$('infoClose').focus({preventScroll:true})}
function showTab(t){$('tabPlay').setAttribute('aria-selected',t==='play');$('tabTune').setAttribute('aria-selected',t==='tune');$('panePlay').hidden=t!=='play';$('tune').hidden=t!=='tune'}
$('infoClose').onclick=()=>{$('info').hidden=true};
$('tabPlay').onclick=()=>showTab('play');$('tabTune').onclick=()=>showTab('tune');
$('info').addEventListener('click',e=>{if(e.target===$('info'))$('info').hidden=true});
/* tiles lean toward the pointer, like cards in hand */
document.querySelectorAll('.jelly').forEach(el=>{
  el.addEventListener('pointermove',e=>{if(e.pointerType!=='mouse'||reduce)return;const r=el.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;
    el.classList.add('tilt');el.style.transform=`perspective(500px) rotateX(${-y*14}deg) rotateY(${x*14}deg) translateY(-3px) scale(1.03)`});
  el.addEventListener('pointerleave',()=>{el.classList.remove('tilt');el.style.transform=''});
});

/* ---------- sizing + boot ---------- */
/* the stage is the largest square that fits between the bars; the cube is framed a little looser
   once twist arrows appear around it */
function size(){
  const r=$('stageWrap').getBoundingClientRect();
  const side=Math.max(200,Math.floor(Math.min(r.width,r.height)));
  const arrows=G&&twistsOn();
  S=Math.round(side/(arrows?6.5:5.2));
  const st=document.documentElement.style;
  st.setProperty('--side',side+'px');st.setProperty('--s',S+'px');st.setProperty('--h',(S/2)+'px');
  if(G) render();
}
/* ---------- app flow: title, pause, back ---------- */
let playing=false,newArmed=false;
function refreshTitle(){
  const has=!!(saved&&saved.state);
  $('tContinue').hidden=!has;
  if(has) $('tContinueSub').textContent=`Level ${saved.level} · ${saved.coins} coins`;
  newArmed=false;$('tNewSub').textContent='';
  $('tEndlessSub').textContent=savedE&&savedE.state?`${savedE.words||0} words · ${savedE.coins} coins`:'letters never run out';
}
function showTitle(){
  if(G&&playing) save();
  playing=false;$('pause').hidden=true;$('info').hidden=true;$('title').hidden=false;$('toast').hidden=true;clearNotice();$('foundPanel').hidden=true;
  refreshTitle();
  /* replay the intro */
  $('title').querySelectorAll('.logo span,.mbtn').forEach(el=>{el.style.animation='none';void el.offsetWidth;el.style.animation=''});
}
function enterPlay(){
  $('title').hidden=true;$('pause').hidden=true;playing=true;size();render(true);status();save();
}
function continueGame(){
  if(!(saved&&saved.state&&restore(saved.state))){newLevel(saved&&saved.level||1,saved&&typeof saved.coins==='number'?saved.coins:cfg.startCoins,'classic')}
  enterPlay();
}
function endless(){
  if(G&&playing) save();
  if(!(savedE&&savedE.state&&restore(savedE.state))) newLevel(1,cfg.startCoins,'endless');
  enterPlay();
}
let runArmed=false;
function newRun(){
  if(!runArmed){runArmed=true;$('pNewRunSub').textContent='tap again to start over';setTimeout(()=>{runArmed=false;$('pNewRunSub').textContent=''},3000);return}
  runArmed=false;$('pNewRunSub').textContent='';newLevel(1,cfg.startCoins,'endless');resume();size();render(true);status();save();toast('New endless run.');
}
function newGame(){
  if(saved&&saved.state&&!newArmed){newArmed=true;$('tNewSub').textContent='tap again to start over';setTimeout(()=>{if(newArmed&&!$('title').hidden){newArmed=false;$('tNewSub').textContent=''}},3000);return}
  newArmed=false;newLevel(1,cfg.startCoins,'classic');enterPlay();
  let seen=false;try{seen=!!localStorage.getItem('twistword-seen');localStorage.setItem('twistword-seen','1')}catch(e){}
  if(!seen) openInfo('play');
}
function openPause(){if(!playing||(G&&G.done))return;$('pNewRun').hidden=!isEndless();runArmed=false;$('pNewRunSub').textContent='';$('pause').hidden=false}
function resume(){$('pause').hidden=true}
/* Escape closes whatever is on top, one layer at a time; during play it opens the pause menu */
function back(){
  if(!$('info').hidden){$('info').hidden=true;return}
  if(!$('pause').hidden){resume();return}
  if(!$('foundPanel').hidden){$('foundPanel').hidden=true;return}
  if(playing) openPause();
}
$('tContinue').onclick=continueGame;
$('tNew').onclick=newGame;
$('tEndless').onclick=endless;
$('pNewRun').onclick=newRun;
$('tHow').onclick=()=>openInfo('play');
$('tSettings').onclick=()=>openInfo('tune');
$('menuBtn').onclick=openPause;
$('pResume').onclick=resume;
$('pHow').onclick=()=>openInfo('play');
$('pSettings').onclick=()=>openInfo('tune');
$('pMenu').onclick=showTitle;
$('pause').addEventListener('click',e=>{if(e.target===$('pause'))resume()});
$('wordsPill').onclick=()=>{$('foundPanel').hidden=!$('foundPanel').hidden};
/* save when the tab is hidden or closed, like an app going to the background */
document.addEventListener('visibilitychange',()=>{if(document.hidden&&playing)save()});
window.addEventListener('pagehide',()=>{if(playing)save()});

/* touch screens have no hover, so a long press shows what a tool does (and doesn't trigger it) */
const coarse=matchMedia('(pointer: coarse)').matches;
function held(el){if(el._held){el._held=false;return true}return false}
['collapseBtn','trayReset','pad'].forEach(id=>{
  const el=$(id);let tm=null;
  el.addEventListener('contextmenu',e=>e.preventDefault());
  el.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse')return;el._held=false;clearTimeout(tm);tm=setTimeout(()=>{el._held=true;toast(el.title)},500)});
  ['pointerup','pointercancel','pointerleave'].forEach(ev=>el.addEventListener(ev,()=>clearTimeout(tm)));
});

function start(data){
  saved=load();savedE=load(ENDLESS_KEY);
  if(saved&&saved.cfg) cfg={...DEFAULT_CFG,...saved.cfg};
  if(data&&data.G&&data.G.stickers){
    G=data.G;if(data.cfg)cfg={...DEFAULT_CFG,...data.cfg};G.stickers.sort((a,b)=>a.id-b.id);
    buildTune();
    if(data.playing){$('title').hidden=true;playing=true;size();render(true);status()}else{size();refreshTitle()}
  } else {
    buildTune();
    if(saved&&saved.state) restore(saved.state); else newLevel(1,cfg.startCoins);
    size();refreshTitle();
  }
  new ResizeObserver(size).observe($('stageWrap'));
}
start({});
/* offline play and "add to home screen" when served over http(s) */
if('serviceWorker' in navigator&&location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(()=>{});
})();
