(function(){
  const { load, esc, yearOf, typeOf, ownerLabel, coverOf, monogram, imageTag, profileIntroHTML, emailButton } = window.NSP;
  const elx = id => document.getElementById(id);
  let DATA = null;
  const requested=new URLSearchParams(location.search).get('person');
  let filter = ['a','b','group'].includes(requested)?requested:'all';

  function renderStatement(){
    const key=filter==='all'?'group':filter;
    const profile=DATA.profiles?.[key] || {};
    elx('indexTitle').textContent=ownerLabel(DATA,key);
    elx('statement').textContent=profile.short || profile.intro || '';
    const person=['a','b'].includes(filter)?filter:null;
    elx('heroActions').innerHTML=`<a class="action primary" href="#works-h">View works</a>
      <a class="action" href="${person?'#person-'+person:'#people-h'}">${person?'Profile &amp; CV':'Profiles &amp; CV'}</a>
      <a class="action" href="reader.html${person?'?book='+person:''}">Portfolio</a>`;
    document.title=ownerLabel(DATA,key)+' — 不標準製作';
  }

  function renderFilters(){
    const opts = [
      {id:'all',   label:'All'},
      {id:'group', label:'Studio'},
      {id:'a',     label:ownerLabel(DATA,'a')},
      {id:'b',     label:ownerLabel(DATA,'b')}
    ];
    elx('filters').innerHTML = opts.map(o =>
      `<button class="filter${o.id===filter?' active':''}" data-f="${o.id}" aria-pressed="${o.id===filter}">${esc(o.label)}</button>`).join('');
    elx('filters').querySelectorAll('.filter').forEach(b=>{
      b.addEventListener('click', ()=>{
        filter=b.dataset.f;
        history.replaceState(null,'',filter==='all'?location.pathname:'?person='+filter);
        renderStatement(); renderFilters(); renderWorks();
        elx('filters').querySelector(`[data-f="${filter}"]`).focus();
      });
    });
  }

  // whole row is a link to the work detail page; leading cover thumbnail
  function thumbHTML(p){
    const cover = coverOf(p);
    if(cover) return `<span class="thumb">${imageTag(cover,'',{sizes:'(max-width: 640px) calc(100vw - 40px), 420px'})}</span>`;
    return `<span class="thumb thumb-ph" data-mono="${esc(monogram(p.title))}"><span>${esc(monogram(p.title))}</span></span>`;
  }
  function rowHTML(p){
    const yr = yearOf(p.tag), ty = typeOf(p.tag);
    const isReal = s => s && !/^placeholder/i.test(s);
    const sub = isReal(p.role) ? esc(p.role) : (isReal(p.medium) ? esc(p.medium) : '');
    return `<a class="row rowlink" href="work.html?id=${encodeURIComponent(p.id)}${filter!=='all'?'&amp;person='+filter:''}">
      ${thumbHTML(p)}
      <span class="main"><span class="r-title">${esc(p.title)}</span>${sub?`<span class="r-role">${sub}</span>`:''}</span>
      <span class="who">${esc(ty)}${yr?`<br><span class="who-yr">${esc(yr)}</span>`:''}</span>
    </a>`;
  }

  function renderWorks(){
    const groups = filter==='all' ? ['group','a','b'] : [filter];
    let html = '';
    groups.forEach(g=>{
      const list = (DATA.projects && DATA.projects[g]) || [];
      if(!list.length) return;
      if(filter==='all') html += `<div class="group-h">${esc(ownerLabel(DATA,g))}</div>`;
      html += list.map(rowHTML).join('');
    });
    elx('worksList').innerHTML = html || '<p class="hero-note">No works listed yet.</p>';
  }

  function renderWriting(){
    const list = DATA.writings || [];
    elx('writingList').innerHTML = list.map(w=>{
      const yr = yearOf(w.meta), ty = typeOf(w.meta);
      const authors = (w.authors && !/^placeholder/i.test(w.authors)) ? esc(w.authors) : '';
      const inner = `<span class="yr">${esc(yr)}</span>
        <span class="main">
          <span class="r-title">${esc(w.title)}</span>
          <span class="r-role">${esc(ty)}${authors?' — '+authors:''}</span>
        </span>`;
      return w.link
        ? `<a class="row writing rowlink" href="${esc(w.link)}"${w.pdf?'':' target="_blank" rel="noopener"'}>${inner}</a>`
        : `<div class="row writing">${inner}</div>`;
    }).join('');
  }

  const CV_SECTIONS = [
    ['education','Education'],
    ['exhibitions','Exhibitions'],
    ['awards','Awards'],
    ['experience','Experience']
  ];
  function cvHTML(pr){
    return CV_SECTIONS.map(([key,label])=>{
      const rows = (pr[key]||[]).filter(r=> r && r.hidden !== true && r.text && !/^placeholder/i.test(r.text));
      if(!rows.length) return '';
      const items = rows.map(r=>`<li><span class="cv-yr">${esc(r.year||'')}</span><span class="cv-tx">${esc(r.text)}</span></li>`).join('');
      return `<div class="cv-group"><h4>${label}</h4><ul class="cv">${items}</ul></div>`;
    }).join('');
  }

  function renderPeople(){
    const order = ['group','a','b'];
    elx('peopleList').innerHTML = order.map(id=>{
      const pr = DATA.profiles?.[id]; if(!pr) return '';
      const contact = pr.contact
        ? emailButton(pr.contact,pr.contact,'p-contact') : '';
      const instagram = pr.instagram
        ? `<a class="p-contact" href="${esc(pr.instagram)}" target="_blank" rel="noopener noreferrer">Instagram ↗</a>` : '';
      return `<div class="person${id==='group'?' studio':''}" id="person-${id}">
        <h3>${esc(pr.heading)}</h3>
        ${pr.cn && id!=='group' ? `<div class="cn">${esc(pr.cn)}</div>`:''}
        ${profileIntroHTML(pr)}
        <div class="profile-contact-links">${contact}${instagram}</div>
        ${id!=='group'?`<div class="person-actions"><a class="action" href="works.html?person=${id}#works-h">View works</a><a class="action" href="reader.html?book=${id}">Read portfolio</a></div>`:''}
        ${cvHTML(pr)}
      </div>`;
    }).join('');
  }

  elx('foot-year').textContent = '© ' + new Date().getFullYear();

  load().then(d=>{
    DATA = d;
    renderStatement(); renderFilters(); renderWorks(); renderWriting(); renderPeople();
  });
})();
