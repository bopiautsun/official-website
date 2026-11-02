(function(){
  'use strict';

/* ============================================================
   不標準製作 — console (home) page
   Data + loader live in shared.js (window.NSP). Print slip → writings ·
   lever → reader.html · work banks → work.html?id=… · screen → work.html
   ============================================================ */

/* ---------- stage scaling ---------- */
const STAGE_W = 1280, STAGE_H = 800, MAX_SCALE = 1.6;
const stage = document.getElementById('stage');
function fitStage(){
  const navHeight=document.querySelector('.topbar').getBoundingClientRect().height;
  document.documentElement.style.setProperty('--nav-height',navHeight+'px');
  stage.style.setProperty('--scale', Math.min(window.innerWidth/STAGE_W, (window.innerHeight-navHeight)/STAGE_H, MAX_SCALE));
}
window.addEventListener('resize', fitStage); fitStage();

/* Cables use viewport coordinates, so the jack and the bottom edge stay joined
   even when the desktop stage is scaled or letterboxed. */
const cableLayer=document.createElementNS('http://www.w3.org/2000/svg','svg');
cableLayer.classList.add('contact-cables');
cableLayer.setAttribute('aria-hidden','true');
document.body.appendChild(cableLayer);
function drawContactCables(){
  cableLayer.replaceChildren();
  if(matchMedia('(max-width:760px)').matches) return;
  cableLayer.setAttribute('viewBox',`0 0 ${innerWidth} ${innerHeight}`);
  document.querySelectorAll('.contact-plug.plugged').forEach(plug=>{
    const r=plug.querySelector('.plug-jack').getBoundingClientRect();
    const x=r.left+r.width/2, y=r.top+r.height/2;
    const scale=stage.getBoundingClientRect().width/STAGE_W;
    // Start at 45 degrees, then turn into a dedicated vertical lane.
    // Upper sockets use the outer lanes so cables clear all lower sockets.
    const lane=x-(68-Number(plug.dataset.row)*13)*scale;
    const drop=x-lane;
    const bend=6*scale;
    const path=document.createElementNS(cableLayer.namespaceURI,'path');
    path.setAttribute('d',`M${x} ${y} L${lane+bend} ${y+drop-bend} Q${lane} ${y+drop} ${lane} ${y+drop+bend} V${innerHeight+8}`);
    path.setAttribute('class',`cable-${plug.dataset.person}`);
    cableLayer.appendChild(path);
  });
}
window.addEventListener('resize',drawContactCables);

/* Repeating audio signal, with a complex carrier and a soft amplitude envelope. */
const audioWave=document.getElementById('audioWave');
if(audioWave){
  const points=[];
  for(let x=0;x<=300;x+=.5){
    const t=x%100;
    const envelope=.22+.78*Math.pow(Math.sin(Math.PI*t/100),2);
    const y=50+envelope*(22*Math.sin(t*Math.PI/10)+8*Math.sin(t*Math.PI/5));
    points.push(`${x===0?'M':'L'}${x.toFixed(1)},${y.toFixed(2)}`);
  }
  audioWave.setAttribute('d',points.join(' '));
}

/* ---------- sign: click to cycle accent tint ---------- */
(function(){
  const signScreen = document.querySelector('.sign-screen');
  if(!signScreen) return;
  const SIGN_TINTS = ['--gold','--red'];
  let i = 0;
  signScreen.addEventListener('click', ()=>{
    i = (i+1) % SIGN_TINTS.length;
    signScreen.style.setProperty('--sign-tint', `var(${SIGN_TINTS[i]})`);
  });
})();

/* ============================================================
   LED FACE — drawable dot-matrix canvas with a preset face
   ============================================================ */
const GRID = 28;
function blankGrid(){ return Array.from({length:GRID}, ()=>new Uint8Array(GRID)); }
function ellipseVal(x,y,cx,cy,rx,ry){ const dx=(x-cx)/rx, dy=(y-cy)/ry; return dx*dx+dy*dy; }
function presetFace(kind){
  const g=blankGrid();
  const line=(x1,y1,x2,y2)=>{
    const steps=Math.max(Math.abs(x2-x1),Math.abs(y2-y1));
    for(let i=0;i<=steps;i++) g[Math.round(y1+(y2-y1)*i/(steps||1))][Math.round(x1+(x2-x1)*i/(steps||1))]=1;
  };
  // Shared face outline, ears, neck and shoulders; hairstyles remain distinct.
  [[6,11,6,18],[21,11,21,18],[7,19,10,22],[20,19,17,22],
   [10,22,17,22],[11,23,11,24],[16,23,16,24],[7,25,20,25],
   [4,13,4,16],[23,13,23,16],[13,16,13,18],[12,20,15,20]].forEach(p=>line(...p));
  for(let y=3;y<=11;y++) for(let x=5;x<=22;x++){
    if(ellipseVal(x,y,13.5,9,9,7)<1 &&
      (kind==='a' ? y<=9 : (x<13 ? y<=14-x*.45 : y<=14-(27-x)*.45))) g[y][x]=1;
  }
  if(kind==='a'){
    line(5,9,22,9); line(5,10,5,21); line(22,10,22,21);
  }else{
    line(13,3,13,6); line(14,3,14,6);
    for(let y=3;y<=7;y++){ g[y][13]=0; g[y][14]=0; }
    line(6,8,5,12); line(21,8,22,12);
  }
  // Two complete glasses frames and a bridge, readable at small sizes.
  [[7,12,11,12],[7,16,11,16],[7,12,7,16],[11,12,11,16],
   [16,12,20,12],[16,16,20,16],[16,12,16,16],[20,12,20,16],
   [12,13,15,13],[5,13,6,13],[21,13,22,13],[9,14,9,14],[18,14,18,14]].forEach(p=>line(...p));
  return g;
}
class LedFace{
  constructor(canvas, kind){
    this.canvas=canvas; this.ctx=canvas.getContext('2d');
    this.grid=presetFace(kind); this.preset=this.grid.map(r=>Uint8Array.from(r));
    this.paintVal=1; this.drawing=false;
    this._size(); this._bind(); this.draw();
    window.addEventListener('resize', ()=>{ this._size(); this.draw(); });
  }
  _size(){ const rect=this.canvas.getBoundingClientRect(); const dpr=Math.min(window.devicePixelRatio||1,2); const css=rect.width||176;
    this.canvas.width=Math.round(css*dpr); this.canvas.height=Math.round(css*dpr); this.px=this.canvas.width/GRID; }
  _cell(e){ const rect=this.canvas.getBoundingClientRect(); const sx=this.canvas.width/rect.width, sy=this.canvas.height/rect.height;
    return { x:Math.floor(((e.clientX-rect.left)*sx)/this.px), y:Math.floor(((e.clientY-rect.top)*sy)/this.px) }; }
  _paint(e){ const {x,y}=this._cell(e); if(x<1||y<1||x>=GRID-1||y>=GRID-1) return; if(this.grid[y][x]!==this.paintVal){ this.grid[y][x]=this.paintVal; this.draw(); } }
  _bind(){ const c=this.canvas;
    c.addEventListener('pointerdown', e=>{ c.setPointerCapture(e.pointerId); const {x,y}=this._cell(e); this.paintVal=(this.grid[y]&&this.grid[y][x])?0:1; this.drawing=true; this._paint(e); });
    c.addEventListener('pointermove', e=>{ if(this.drawing) this._paint(e); });
    const stop=()=>{ this.drawing=false; }; c.addEventListener('pointerup',stop); c.addEventListener('pointercancel',stop); c.addEventListener('pointerleave',stop); }
  reset(){ this.grid=this.preset.map(r=>Uint8Array.from(r)); this.draw(); }
  clear(){ this.grid=blankGrid(); this.draw(); }
  draw(){ const ctx=this.ctx, px=this.px, W=this.canvas.width; ctx.fillStyle='#0d0a09'; ctx.fillRect(0,0,W,W);
    const gap=Math.max(1,px*0.12);
    for(let y=0;y<GRID;y++) for(let x=0;x<GRID;x++){ const lit=this.grid[y][x];
      ctx.fillStyle=lit?'#3f5c1a':'#070605'; ctx.fillRect(x*px+gap,y*px+gap,px-gap*2,px-gap*2);
      if(lit){ ctx.fillStyle='#A9EE3E'; const i2=gap+(px-gap*2)*0.16; ctx.fillRect(x*px+i2,y*px+i2,px-i2*2,px-i2*2); } } }
}

/* ============================================================
   WIPE PANEL — instruction text drawn on canvas; drag to erase it,
   fog-fades back in a few seconds after the last touch
   ============================================================ */
class WipePanel{
  constructor(canvas){
    this.canvas=canvas; this.ctx=canvas.getContext('2d');
    this.text=''; this.alpha=1; this.idleTimer=null; this._fadeToken=0;
    this._size(); this._bind();
    window.addEventListener('resize', ()=>{ this._size(); this._redrawFull(); });
  }
  _size(){
    const rect=this.canvas.getBoundingClientRect();
    const dpr=Math.min(window.devicePixelRatio||1,2);
    this.cw=Math.max(1,rect.width); this.ch=Math.max(1,rect.height);
    this.canvas.width=Math.round(this.cw*dpr); this.canvas.height=Math.round(this.ch*dpr);
    this.ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  setText(text){
    this.text=text||''; this.alpha=1; this._fadeToken++;
    clearTimeout(this.idleTimer);
    this._redrawFull();
  }
  _wrapLines(maxWidth){
    const words=String(this.text).split(/\s+/).filter(Boolean);
    const lines=[]; let line='';
    for(const w of words){
      const test=line?line+' '+w:w;
      if(this.ctx.measureText(test).width>maxWidth && line){ lines.push(line); line=w; }
      else line=test;
    }
    if(line) lines.push(line);
    return lines;
  }
  _redrawFull(){
    const ctx=this.ctx;
    ctx.clearRect(0,0,this.cw,this.ch);
    ctx.font="500 15px 'Chakra Petch', system-ui, sans-serif";
    ctx.fillStyle='#5d6158'; ctx.textBaseline='top';
    ctx.globalAlpha=this.alpha;
    const lineH=22.5;
    this._wrapLines(this.cw).forEach((l,i)=> ctx.fillText(l, 0, i*lineH));
    ctx.globalAlpha=1;
  }
  _bind(){
    const c=this.canvas;
    let drawing=false;
    const erase=e=>{
      this._fadeToken++; clearTimeout(this.idleTimer);
      const rect=c.getBoundingClientRect();
      const x=e.clientX-rect.left, y=e.clientY-rect.top;
      this.ctx.globalCompositeOperation='destination-out';
      this.ctx.beginPath(); this.ctx.arc(x,y,16,0,Math.PI*2); this.ctx.fill();
      this.ctx.globalCompositeOperation='source-over';
      this._scheduleFade();
    };
    c.addEventListener('pointerdown', e=>{ c.setPointerCapture(e.pointerId); drawing=true; erase(e); });
    c.addEventListener('pointermove', e=>{ if(drawing) erase(e); });
    const stop=()=>{ drawing=false; };
    c.addEventListener('pointerup',stop); c.addEventListener('pointercancel',stop); c.addEventListener('pointerleave',stop);
  }
  _scheduleFade(){
    clearTimeout(this.idleTimer);
    this.idleTimer=setTimeout(()=>this._fadeBackIn(), 3000);
  }
  _fadeBackIn(){
    if(matchMedia('(prefers-reduced-motion: reduce)').matches){ this.alpha=1; this._redrawFull(); return; }
    const token=++this._fadeToken;
    const dur=1500, start=performance.now();
    const step=now=>{
      if(token!==this._fadeToken) return;
      const t=Math.min(1,(now-start)/dur);
      this.alpha=t; this._redrawFull();
      if(t<1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
}

/* ============================================================
   RADAR MINI-GAME — the wander blip stays fixed; steering the player
   blip onto it (mouse inside the circle) trips a 3s "blackout"
   (everything dims, radar flashes red)
   ============================================================ */
(function(){
  const radar = document.getElementById('radar');
  const blipWander = document.getElementById('blipWander');
  const blipPlayer = document.getElementById('blipPlayer');
  if(!radar || !blipWander || !blipPlayer) return;
  const REST_W = { x:66, y:38 }, REST_P = { x:40, y:60 };

  let P = { ...REST_P };
  let blackoutUntil = 0, hovering = false;

  const setPos = (el,pos) => { el.style.left=pos.x+'%'; el.style.top=pos.y+'%'; };
  setPos(blipWander, REST_W); setPos(blipPlayer, P);

  function clampToCircle(x,y){
    const dx=x-50, dy=y-50, r=Math.sqrt(dx*dx+dy*dy), max=44;
    if(r<=max) return {x,y};
    const k=max/r; return { x:50+dx*k, y:50+dy*k };
  }

  function checkCollision(){
    if(Date.now()<blackoutUntil) return;
    const dx=REST_W.x-P.x, dy=REST_W.y-P.y;
    if(Math.sqrt(dx*dx+dy*dy) < 7) triggerBlackout();
  }

  function triggerBlackout(){
    blackoutUntil = Date.now()+3000;
    document.body.classList.add('blackout');
    radar.classList.add('alarm');
    setTimeout(()=>{
      document.body.classList.remove('blackout');
      radar.classList.remove('alarm');
      P = { ...REST_P };
      setPos(blipPlayer,P);
    }, 3000);
  }

  function pointerToPercent(e){
    const rect=radar.getBoundingClientRect();
    const x=((e.clientX-rect.left)/rect.width)*100, y=((e.clientY-rect.top)/rect.height)*100;
    return clampToCircle(x,y);
  }
  radar.addEventListener('pointerenter', ()=>{ hovering=true; });
  radar.addEventListener('pointermove', e=>{ if(!hovering || Date.now()<blackoutUntil) return; P=pointerToPercent(e); setPos(blipPlayer,P); checkCollision(); });
  radar.addEventListener('pointerleave', ()=>{ hovering=false; });
})();

/* ============================================================
   LEVER — starts at rest with the bulb off; drag the handle to the
   far end of the track (down on desktop, right on mobile) to light
   the bulb and flip through to the PDF reader. Enter/Space does the
   same for keyboard users.
   ============================================================ */
(function(){
  const lever = document.getElementById('lever');
  const track = document.querySelector('.lever-track');
  const handle = document.getElementById('leverHandle');
  const bulb = document.getElementById('leverBulb');
  if(!lever || !track || !handle || !bulb) return;
  let dragging = false, done = false;

  function setPull(v, animate){
    const pull = Math.min(1, Math.max(0, v));
    handle.classList.toggle('snap', !!animate);
    handle.style.setProperty('--pull', pull);
    return pull;
  }
  function pointerToPull(e){
    const r = track.getBoundingClientRect();
    return r.height >= r.width ? (e.clientY-r.top)/r.height : (e.clientX-r.left)/r.width;
  }
  function complete(){
    if(done) return;
    done = true;
    setPull(1, true);
    bulb.classList.add('lit');
    setTimeout(()=>{ location.href = 'reader.html'; }, 350);
  }
  function release(){
    if(!dragging) return;
    dragging = false;
    if(!done) setPull(0, true);
  }

  handle.addEventListener('pointerdown', e=>{
    if(done) return;
    dragging = true; handle.setPointerCapture(e.pointerId);
    setPull(pointerToPull(e), false);
  });
  handle.addEventListener('pointermove', e=>{
    if(!dragging || done) return;
    const v = pointerToPull(e);
    setPull(v, false);
    if(v >= 0.94) complete();
  });
  handle.addEventListener('pointerup', release);
  handle.addEventListener('pointercancel', release);
  lever.addEventListener('keydown', e=>{
    if(done) return;
    if(e.key==='Enter' || e.key===' '){ e.preventDefault(); complete(); }
  });
})();

/* ============================================================
   MAIN
   ============================================================ */
(function(){
  const { load, esc, typeOf, yearOf, coverOf, monogram, imageTag, profileIntroHTML, emailButton } = window.NSP;
  const el = id => document.getElementById(id);
  const BANK_SLOTS = 9;
  const els = {
    keyA:el('keyA'), keyB:el('keyB'), keyAName:el('keyAName'), keyBName:el('keyBName'),
    printSlip:el('printSlip'),
    bankUnified:el('bankUnified'),
    screen:el('screen'), screenInner:el('screenInner'),
    profile:el('profile'), profileHeading:el('profileHeading'), profileBody:el('profileBody'),
    profileMore:el('profileMore'), profileWipe:el('profileWipe'),
    lampA:el('lampA'), lampGroup:el('lampGroup'), lampB:el('lampB'),
    scrim:el('scrim'), drawer:el('drawer'), drawerContent:el('drawerContent'), drawerClose:el('drawerClose')
  };
  const wipePanel = new WipePanel(els.profileWipe);

  let DATA = null; let a=false, b=false; let selectedId=null;
  const stateKey = () => (a&&b)?'group' : a?'a' : b?'b' : 'off';

  const CV_SECTIONS = [['education','Education'],['exhibitions','Exhibitions'],['awards','Awards'],['experience','Experience']];
  const hasCV = pr => CV_SECTIONS.some(([k])=> (pr && pr[k]||[]).some(r=> r && r.hidden !== true && r.text && !/^placeholder/i.test(r.text)));

  function projectsFor(st){
    if(st==='group') return DATA.projects.group||[];
    if(st==='a') return DATA.projects.a||[];
    if(st==='b') return DATA.projects.b||[];
    return [];
  }
  function renderBank(container, slots){
    container.innerHTML='';
    slots.forEach(p=>{
      const btn = document.createElement('button');
      btn.className = 'work-btn';
      btn.disabled = !p;
      if(p){
        btn.innerHTML = `<span class="wb-type">${esc(typeOf(p.tag))}</span><span class="wb-title">${esc(p.title)}</span><span class="wb-year">${esc(yearOf(p.tag))}</span>`;
        btn.addEventListener('click', ()=>{
          if(selectedId===p.id && btn.classList.contains('active')){
            location.href = 'work.html?id='+encodeURIComponent(p.id||'');
          } else {
            loadScreen(p, btn);
          }
        });
        setTimeout(()=> btn.classList.add('lit'), 20);
      }
      container.appendChild(btn);
    });
  }
  function renderBanks(st){
    const valid = projectsFor(st).filter(p=> p && p.id)
      .sort((a,b)=> (parseInt(yearOf(b.tag),10)||0) - (parseInt(yearOf(a.tag),10)||0));
    const grid = Array(BANK_SLOTS).fill(null);
    valid.slice(0, BANK_SLOTS).forEach((p,i)=>{ grid[i]=p; });
    renderBank(els.bankUnified, grid);
  }

  function loadScreen(p, btnEl){
    selectedId = p.id;
    document.querySelectorAll('.work-btn.active').forEach(b=>b.classList.remove('active'));
    if(btnEl) btnEl.classList.add('active');
    const cover = coverOf(p);
    els.screenInner.innerHTML = cover
      ? imageTag(cover,p.title,{eager:true,sizes:'400px'})
      : `<span class="screen-mono">${esc(monogram(p.title))}</span>`;
    els.screen.classList.add('loaded');
    els.screen.setAttribute('aria-label',`Open ${p.title}`);
    document.getElementById('consoleHint').textContent='Preview ready. Select the screen to open the full project.';
    els.screen.setAttribute('href', 'work.html?id='+encodeURIComponent(p.id||''));
    els.screenInner.classList.remove('flicker');
    void els.screenInner.offsetWidth; // restart the animation on repeat selections
    els.screenInner.classList.add('flicker');
  }
  function clearScreen(){
    selectedId = null;
    document.querySelectorAll('.work-btn.active').forEach(b=>b.classList.remove('active'));
    els.screenInner.innerHTML = '<span class="screen-noise"></span><span class="screen-msg">NO SIGNAL</span>';
    els.screen.classList.remove('loaded');
    els.screen.removeAttribute('href');
    els.screen.setAttribute('aria-label','Selected work preview');
    document.getElementById('consoleHint').textContent=stateKey()==='off'
      ? 'Select a name to explore their work. Select both for studio projects.'
      : 'Select a work to preview it, then select the screen to open the project.';
  }

  function render(){
    if(!DATA) return;
    const st = stateKey();
    stage.classList.remove('group','a','b','off'); stage.classList.add(st);
    els.keyA.classList.toggle('on', a); els.keyB.classList.toggle('on', b);
    els.keyA.setAttribute('aria-pressed', a); els.keyB.setAttribute('aria-pressed', b);
    els.lampA.classList.toggle('lit', st==='a');
    els.lampGroup.classList.toggle('lit', st==='group');
    els.lampB.classList.toggle('lit', st==='b');
    document.querySelectorAll('.contact-plug[data-person="a"]').forEach(p=> p.classList.toggle('plugged', a));
    document.querySelectorAll('.contact-plug[data-person="b"]').forEach(p=> p.classList.toggle('plugged', b));
    drawContactCables();

    const prof = DATA.profiles[st] || {};
    const text = prof.short || prof.intro || '';
    els.profileHeading.textContent = prof.heading || '';
    els.profileBody.textContent = text;
    wipePanel.setText(text);
    els.profile.classList.toggle('has-cv', hasCV(prof));
    els.profileMore.hidden=!hasCV(prof);

    renderBanks(st);
    clearScreen();
  }

  function openProfile(){
    const prof = DATA.profiles[stateKey()]; if(!prof || !hasCV(prof)) return;
    let html = `<div class="eyebrow">Profile</div><h2>${esc(prof.heading)}</h2>`;
    if(prof.cn && stateKey()!=='group') html += `<div class="eyebrow" style="letter-spacing:.16em;margin-top:-6px;">${esc(prof.cn)}</div>`;
    html += profileIntroHTML(prof);
    if(prof.contact) html += `<p>${emailButton(prof.contact,prof.contact,'profile-link')}</p>`;
    if(prof.instagram) html += `<p><a class="profile-link" href="${esc(prof.instagram)}" target="_blank" rel="noopener noreferrer">Instagram ↗</a></p>`;
    CV_SECTIONS.forEach(([key,label])=>{
      const rows=(prof[key]||[]).filter(r=> r && r.hidden !== true && r.text && !/^placeholder/i.test(r.text));
      if(!rows.length) return;
      html += `<div class="eyebrow" style="margin-top:20px;">${label}</div>`;
      rows.forEach(r=>{ html += `<div class="cv-row"><div class="yr">${esc(r.year||'')}</div><div class="txt">${esc(r.text)}</div></div>`; });
    });
    els.drawerContent.innerHTML = html; openDrawer();
  }
  function openWritings(){
    let html='<div class="eyebrow">Writing</div><h2>Notes &amp; essays</h2>';
    (DATA.writings||[]).forEach(w=>{
      const authors=(w.authors && !/^placeholder/i.test(w.authors)) ? ` · ${esc(w.authors)}` : '';
      const title=w.link?`<a href="${esc(w.link)}"${w.pdf?'':' target="_blank" rel="noopener"'}>${esc(w.title)} ↗</a>`:esc(w.title);
      html += `<div class="writing-item"><h3>${title}</h3><span>${esc(w.meta)}${authors}</span></div>`;
    });
    els.drawerContent.innerHTML=html; openDrawer();
  }
  let drawerTrigger=null;
  function openDrawer(){
    drawerTrigger=document.activeElement;
    els.scrim.classList.add('open'); els.drawer.classList.add('open'); els.drawer.setAttribute('aria-hidden','false');
    document.getElementById('viewport').inert=true;
    document.querySelector('.topbar').inert=true;
    els.drawerClose.focus();
  }
  function closeDrawer(){
    if(!els.drawer.classList.contains('open')) return;
    els.scrim.classList.remove('open'); els.drawer.classList.remove('open'); els.drawer.setAttribute('aria-hidden','true');
    document.getElementById('viewport').inert=false;
    document.querySelector('.topbar').inert=false;
    drawerTrigger?.focus();
  }
  els.drawer.addEventListener('keydown',event=>{
    if(event.key!=='Tab') return;
    const targets=Array.from(els.drawer.querySelectorAll('button:not([disabled]),a[href]'));
    const first=targets[0], last=targets[targets.length-1];
    if(event.shiftKey && document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first.focus();}
  });

  els.keyA.addEventListener('click', ()=>{ a=!a; render(); });
  els.keyB.addEventListener('click', ()=>{ b=!b; render(); });
  els.printSlip.addEventListener('click', openWritings);
  els.profileMore.addEventListener('click', openProfile);
  els.scrim.addEventListener('click', closeDrawer);
  els.drawerClose.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeDrawer(); });

  const faces = { A:new LedFace(document.getElementById('faceA'),'a'), B:new LedFace(document.getElementById('faceB'),'b') };
  document.querySelectorAll('.ftool').forEach(btn=>{ btn.addEventListener('click', ()=>{ const f=faces[btn.dataset.face]; btn.dataset.act==='reset'?f.reset():f.clear(); }); });

  load().then(d=>{
    DATA = d;
    if(d.profiles){
      els.keyAName.innerHTML=(d.profiles.a.heading||'').replace(' ','<br>');
      els.keyBName.innerHTML=(d.profiles.b.heading||'').replace(' ','<br>');
    }
    render();
  });
})();
})();
