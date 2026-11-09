(function(){
  const { load, esc, yearOf, typeOf, findProject, ownersOf, ownerLabel, embedUrl, imageTag } = window.NSP;
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  const main = document.getElementById('workMain');
  document.getElementById('foot-year').textContent = '© ' + new Date().getFullYear();

  function mediaHTML(m,eager=false){
    if(!m || !m.type) return '';
    const cap = m.caption ? `<figcaption>${esc(m.caption)}</figcaption>` : '';
    if(m.type === 'image'){
      if(!m.src) return '';
      return `<figure class="m-item">${imageTag(m.src,m.caption||document.title,{eager})}${cap}</figure>`;
    }
    if(m.type === 'video'){
      if(!m.src) return '';
      const poster = m.poster ? ` poster="${esc(m.poster)}"` : '';
      return `<figure class="m-item"><video src="${esc(m.src)}"${poster} controls playsinline preload="metadata"></video>${cap}</figure>`;
    }
    if(m.type === 'embed'){
      const url = embedUrl(m.src);
      if(!url) return '';
      return `<figure class="m-item m-embed"><div class="embed-frame"><iframe src="${esc(url)}" title="${esc(m.caption||'Project documentation')}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen loading="lazy"></iframe></div>${cap}</figure>`;
    }
    return '';
  }

  const validMedia = m => {
    if(!m || !m.type) return false;
    if(m.type === 'embed') return !!embedUrl(m.src);
    return !!m.src;
  };

  // further images → slideshow (a single leftover image is just shown plainly)
  function slideshowHTML(imgs){
    if(!imgs.length) return '';
    if(imgs.length === 1) return `<div class="media">${mediaHTML(imgs[0])}</div>`;
    const slides = imgs.map((m,i)=>
      `<figure class="slide" role="group" aria-roledescription="slide" aria-label="${i+1} / ${imgs.length}">${imageTag(m.src,m.caption||`Project image ${i+2}`)}</figure>`).join('');
    return `<section class="slideshow" aria-roledescription="carousel" aria-label="More images">
      <div class="slide-stage">
        <div class="slide-track" tabindex="0">${slides}</div>
        <button class="slide-btn prev" type="button" aria-label="Previous image">‹</button>
        <button class="slide-btn next" type="button" aria-label="Next image">›</button>
      </div>
      <div class="slide-bar"><span class="slide-cap">${esc(imgs[0].caption||'')}</span><span class="slide-count"><span class="slide-cur">1</span> / ${imgs.length}</span></div>
    </section>`;
  }

  function bindSlideshow(imgs){
    const root = main.querySelector('.slideshow'); if(!root) return;
    const track = root.querySelector('.slide-track');
    const cur = root.querySelector('.slide-cur'), cap = root.querySelector('.slide-cap');
    const n = imgs.length;
    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    let i = 0, raf = 0;
    const sync = () => {
      i = Math.max(0, Math.min(n-1, Math.round(track.scrollLeft / track.clientWidth)));
      cur.textContent = i + 1;
      cap.textContent = imgs[i].caption || '';
    };
    const go = k => track.scrollTo({ left: ((k + n) % n) * track.clientWidth, behavior: reduce ? 'auto' : 'smooth' });
    track.addEventListener('scroll', ()=>{ cancelAnimationFrame(raf); raf = requestAnimationFrame(sync); });
    root.querySelector('.prev').addEventListener('click', ()=>go(i-1));
    root.querySelector('.next').addEventListener('click', ()=>go(i+1));
    track.addEventListener('keydown', e=>{
      if(e.key === 'ArrowLeft'){ e.preventDefault(); go(i-1); }
      else if(e.key === 'ArrowRight'){ e.preventDefault(); go(i+1); }
    });
    window.addEventListener('resize', ()=>{ track.scrollTo({ left: i * track.clientWidth, behavior: 'auto' }); });
  }

  function render(data){
    if(!id){ main.innerHTML = notFound('No work specified.'); return; }
    const res = findProject(data, id);
    if(!res){ main.innerHTML = notFound('Work “'+esc(id)+'” not found.'); return; }
    const p = res.project;
    document.title = p.title + ' — 不標準製作';
    const yr = yearOf(p.tag), ty = typeOf(p.tag);
    // a project listed under several people (e.g. ZHAN under both a and b) shares this one page
    const owners = ownersOf(data, p.id);
    const owner = owners.map(k => ownerLabel(data, k)).join(' & ');

    const isPH = s => !s || /^placeholder/i.test(String(s).trim());
    const metaBits = [ty, yr, owner].filter(Boolean).map(esc).join(' &nbsp;·&nbsp; ');

    const facts = [];
    if(!isPH(p.role))         facts.push(['Role', p.role]);
    if(!isPH(p.medium))       facts.push(['Medium', p.medium]);
    if(!isPH(p.dimensions))   facts.push(['Dimensions', p.dimensions]);
    if(!isPH(p.artists))      facts.push(['Artists', p.artists]);
    if(!isPH(p.collaborators))facts.push(['With', p.collaborators]);
    if(!isPH(p.supervisor))   facts.push(['Supervisor', p.supervisor]);
    const factsHTML = facts.length
      ? `<dl class="facts">${facts.map(([k,v])=>`<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` : '';

    const cnHTML = (p.cn && !isPH(p.cn)) ? `<div class="work-cn">${esc(p.cn)}</div>` : '';
    const linkHTML = (p.link && !isPH(p.link))
      ? `<a class="work-link" href="${esc(p.link)}" target="_blank" rel="noopener">Open project ↗</a>` : '';

    const paras = String(p.blurb||'').split(/\n\n+/).map(t=>`<p>${esc(t)}</p>`).join('');
    const bodyHTML = `<div class="work-body">${paras}</div>`;

    // The first image leads unless heroLayout is "none", which sends all
    // detail images to the slideshow. The cover is used for listings.
    const mediaList = (p.media || []).filter(validMedia);
    const images = mediaList.filter(m => m.type === 'image');
    const videos = mediaList.filter(m => m.type !== 'image');
    const hero = p.heroLayout === 'none' ? null : images[0];
    const split = hero && /^(split|inline)$/i.test(String(p.heroLayout||''));
    const heroHTML = hero ? `<div class="media">${mediaHTML(hero,true)}</div>` : '';
    const rest = hero ? images.slice(1) : images;
    const videosHTML = videos.length ? `<div class="media">${videos.map(mediaHTML).join('')}</div>` : '';
    const emptyNotice = (!mediaList.length && !linkHTML)
      ? `<p class="media-empty">Documentation will be added soon.</p>` : '';
    const person=params.get('person');
    const backUrl='works.html'+(['a','b','group'].includes(person)?'?person='+person:'');
    const contactOwners = new Set(owners.flatMap(key => {
      const profile = data.profiles[key];
      return key === 'group' && !profile?.contact && !profile?.instagram ? ['a','b'] : [key];
    }));
    const contacts = [...contactOwners].map(key => {
      const profile = data.profiles[key];
      if(!profile?.contact && !profile?.instagram) return '';
      return `<li>
        <strong>${esc(ownerLabel(data,key))}</strong>
        ${profile.contact ? `<span class="work-email">${esc(profile.contact)}</span>` : ''}
        ${profile.instagram ? `<a class="profile-link" href="${esc(profile.instagram)}" target="_blank" rel="noopener noreferrer">Instagram ↗</a>` : ''}
      </li>`;
    }).join('');
    const papers=(data.writings||[]).filter(w=>w.projectId===p.id && w.link)
      .map(w=>`<a class="action" href="${esc(w.link)}">Read paper ↗</a>`).join('');

    const textBlock = split
      ? `<div class="work-split">${heroHTML}${bodyHTML}</div>`
      : `${heroHTML}${bodyHTML}`;

    main.innerHTML = `
      <a class="back" href="${backUrl}#works-h">← All works</a>
      <article class="work">
        <div class="work-eyebrow">${metaBits}</div>
        <h1 class="work-title">${esc(p.title)}</h1>
        ${cnHTML}
        ${factsHTML}
        ${linkHTML}
        ${textBlock}
        ${slideshowHTML(rest)}
        ${videosHTML}
        ${emptyNotice}
        <footer class="work-end">
          ${contacts ? `<h2>Contact</h2><ul class="work-contacts">${contacts}</ul>` : ''}
          <div class="hero-actions">${papers}<a class="action" href="${backUrl}#works-h">More works</a><a class="action" href="${backUrl}#people-h">Profiles &amp; CV</a></div>
        </footer>
      </article>`;
    bindSlideshow(rest);
    document.title = p.title + ' — 不標準製作';
  }

  function notFound(msg){
    return `<a class="back" href="works.html">← Index</a>
      <div class="work"><h1 class="work-title">Not found</h1><p class="hero-note">${msg}</p></div>`;
  }

  load().then(render);
})();
