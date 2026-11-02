/* ============================================================
   Shared helpers for 不標準製作 site (loaded by every page).
   One data loader, one fallback, one file:// warning banner.
   ============================================================ */

window.NSP = (function(){
  const FALLBACK_DATA = {
    profiles: {
      off:{heading:"INSTRUCTION",intro:"Press a name to light up that person's work. Press both for the studio. The printed slip holds writings."},
      a:{heading:"Yu-Fang LAI",cn:"賴 榆 方",intro:"Biography is currently unavailable.",contact:"",education:[],exhibitions:[],awards:[],experience:[]},
      b:{heading:"Wei-Cheng HSU",cn:"許 煒 晟",intro:"Biography is currently unavailable.",contact:"",education:[],exhibitions:[],awards:[],experience:[]},
      group:{heading:"不 標 準 製 作",cn:"不 標 準 製 作",intro:"Studio information is currently unavailable.",education:[],exhibitions:[],awards:[],experience:[]}
    },
    projects:{ group:[], a:[], b:[] },
    writings:[]
  };

  async function load(){
    try{
      const res = await fetch('data.json');
      if(!res.ok) throw new Error('HTTP '+res.status);
      return await res.json();
    }catch(err){
      console.warn('[不標準製作] data.json not loaded — using fallback.', err.message);
      if(location.protocol === 'file:') showFileBanner();
      return FALLBACK_DATA;
    }
  }

  function showFileBanner(){
    if(document.getElementById('nsp-file-banner')) return;
    const b = document.createElement('div');
    b.id = 'nsp-file-banner';
    b.textContent = 'Please preview this site through a local web server so its content can load.';
    b.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:9999;background:#2b2f28;color:#f0ede3;font:500 12.5px/1.5 system-ui,sans-serif;padding:10px 16px;text-align:center;';
    document.addEventListener('DOMContentLoaded', ()=>document.body.appendChild(b));
    if(document.body) document.body.appendChild(b);
  }

  // helpers shared by pages
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const yearOf = tag => { const m = String(tag||'').match(/\b(19|20)\d{2}\b/); return m ? m[0] : ''; };
  const typeOf = tag => String(tag||'').split('·')[0].trim();
  const findProject = (data, id) => {
    for(const k of Object.keys(data.projects||{})){
      const hit = (data.projects[k]||[]).find(p => p.id === id);
      if(hit) return { project: hit, owner: k };
    }
    return null;
  };
  const ownersOf = (data, id) =>
    Object.keys(data.projects||{}).filter(k => (data.projects[k]||[]).some(p => p.id === id));
  const ownerLabel = (data, key) =>
    key==='group' ? (data.profiles?.group?.heading || 'Studio') : (data.profiles?.[key]?.heading || key);

  // normalise a pasted YouTube/Vimeo link into an embeddable URL
  function embedUrl(url){
    if(!url) return '';
    let m;
    if((m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/))) return 'https://www.youtube.com/embed/' + m[1];
    if((m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/))) return 'https://player.vimeo.com/video/' + m[1];
    return url;
  }
  // first usable cover image for a project (explicit cover, else first media image)
  function coverOf(project){
    if(project.cover) return project.cover;
    const img = (project.media||[]).find(m => m && m.type==='image' && m.src);
    return img ? img.src : '';
  }
  // monogram initials for placeholder tiles
  const STOP = new Set(['of','the','a','an','and','for','to','in','on']);
  function monogram(title){
    const words = String(title||'').trim().split(/[\s/]+/).filter(w => w && !STOP.has(w.toLowerCase()));
    const letters = words.map(w => w[0]).filter(c => /[A-Za-z\u4e00-\u9fff]/.test(c));
    return letters.slice(0,2).join('').toUpperCase() || '▦';
  }

  const IMAGE_VARIANTS = window.NSP_IMAGE_VARIANTS || {};
  function imageTag(src,alt,options={}){
    const variants=IMAGE_VARIANTS[src];
    const best=variants?.[1];
    const responsive=variants?` srcset="${variants.map(v=>esc(encodeURI(v.src))+' '+v.width+'w').join(', ')}" sizes="${esc(options.sizes||'(max-width: 640px) calc(100vw - 40px), 650px')}" width="${best.width}" height="${best.height}"`:'';
    return `<img src="${esc(best?encodeURI(best.src):src)}"${responsive} alt="${esc(alt||'')}" loading="${options.eager?'eager':'lazy'}" decoding="async" draggable="false"${options.eager?' fetchpriority="high"':''}>`;
  }

  function profileIntroHTML(profile){
    const intro=/^placeholder/i.test(profile.intro||'')?(profile.short||''):(profile.intro||'');
    const paragraphs=String(intro).split(/\n\n+/).filter(Boolean)
      .map(text=>`<p class="p-bio">${esc(text)}</p>`).join('');
    if(!profile.conversation?.length) return paragraphs;
    const lines=profile.conversation.map(line=>line.aside
      ? `<p class="studio-aside"><em>（${esc(line.text)}）</em></p>`
      : `<p>${esc(line.text)}</p>`).join('');
    return `<div class="studio-intro"><figure class="studio-conversation" lang="zh-Hant">
      <figcaption>關於團體簡介的一次討論</figcaption><blockquote>${lines}</blockquote>
      </figure><div class="studio-copy">${paragraphs}</div></div>`;
  }

  function emailButton(address,label=address,className=''){
    return `<button class="email-copy ${esc(className)}" type="button" data-email="${esc(address)}" aria-label="Copy ${esc(address)}">${esc(label)}</button>`;
  }

  return { load, esc, yearOf, typeOf, findProject, ownersOf, ownerLabel, embedUrl, coverOf, monogram, imageTag, profileIntroHTML, emailButton };
})();

// Open configured paper links above the current page, preserving its URL,
// author filter and scroll position. The existing reader handles the PDF.
(function(){
  let activeReader=null;
  document.addEventListener('click',event=>{
    const link=event.target.closest('a[href]');
    if(!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button>0) return;
    const url=new URL(link.href,location.href);
    if(url.origin!==location.origin || !url.pathname.endsWith('/reader.html') || !url.searchParams.has('paper')) return;
    event.preventDefault();
    if(activeReader){activeReader.frame.focus();return;}
    const dialog=document.createElement('dialog');
    dialog.className='document-overlay';
    dialog.setAttribute('aria-label','Paper reader');
    const loading=document.createElement('p');
    loading.className='document-loading';loading.textContent='Opening document…';
    loading.setAttribute('role','status');
    const loadingClose=document.createElement('button');
    loadingClose.type='button';loadingClose.className='document-loading-close';loadingClose.textContent='Close ×';
    loadingClose.addEventListener('click',()=>dialog.close());
    const frame=document.createElement('iframe');
    frame.className='document-frame';frame.title='Paper reader';
    frame.style.visibility='hidden';
    url.searchParams.set('embedded','1');frame.src=url.href;
    frame.addEventListener('load',()=>{
      if(!dialog.open)return;
      loading.hidden=true;loadingClose.hidden=true;frame.style.visibility='visible';frame.focus();
    });
    dialog.append(loading,frame,loadingClose);document.body.appendChild(dialog);
    activeReader={dialog,frame};
    const message=event=>{
      if(event.origin===location.origin && event.source===frame.contentWindow && event.data?.type==='nsp-reader-close') dialog.close();
    };
    window.addEventListener('message',message);
    dialog.addEventListener('click',event=>{
      if(event.target!==dialog)return;
      const r=dialog.getBoundingClientRect();
      if(event.clientX<r.left || event.clientX>r.right || event.clientY<r.top || event.clientY>r.bottom)dialog.close();
    });
    dialog.addEventListener('close',()=>{
      window.removeEventListener('message',message);
      activeReader=null;document.body.classList.remove('document-open');dialog.remove();
      if(link.isConnected)link.focus({preventScroll:true});
    },{once:true});
    document.body.classList.add('document-open');dialog.showModal();
  });
})();

// Delegation also covers buttons rendered later in profiles and the drawer.
(function(){
  let notice=null, timer=null;
  function notify(text){
    if(!notice){
      notice=document.createElement('div');
      notice.className='copy-notice';
      notice.setAttribute('role','status');
      notice.setAttribute('aria-live','polite');
      document.body.appendChild(notice);
    }
    notice.textContent=text; notice.hidden=false;
    clearTimeout(timer); timer=setTimeout(()=>{notice.hidden=true;},2600);
  }
  async function copy(address){
    if(navigator.clipboard && window.isSecureContext){
      try{await navigator.clipboard.writeText(address);return true;}catch(error){/* Try the selection fallback. */}
    }
    const previousFocus=document.activeElement;
    const input=document.createElement('textarea');
    input.value=address; input.setAttribute('readonly','');
    input.style.cssText='position:fixed;opacity:0;pointer-events:none;';
    document.body.appendChild(input);
    try{input.select();return document.execCommand('copy');}
    finally{input.remove();previousFocus?.focus({preventScroll:true});}
  }
  document.addEventListener('click',async event=>{
    const button=event.target.closest('[data-email]');
    if(!button) return;
    event.preventDefault();
    try{notify(await copy(button.dataset.email)?'Email copied':'Could not copy. Please copy the address manually.');}
    catch(error){notify('Could not copy. Please copy the address manually.');}
  });
})();

// Discourage saving artwork through the browser's image menu or drag gesture.
// Delivered image files remain accessible to the browser; this is a UI restriction.
document.addEventListener('contextmenu', event=>{
  if(event.target.closest('.media img, .slideshow img, .thumb, .screen-inner img')) event.preventDefault();
});
document.addEventListener('dragstart', event=>{
  if(event.target.closest('.media img, .slideshow img, .thumb, .screen-inner img')) event.preventDefault();
});
