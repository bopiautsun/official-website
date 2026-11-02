/* Floating portfolio reader. All pages share one document scale, including covers. */
(function(){
  const BOOKS = [
    { id:'a', name:'Yu-Fang LAI', src:'asset/fang_portfolio_2024.pdf' },
    { id:'b', name:'Wei-Cheng HSU', src:'asset/Weicheng_portfolio.pdf' }
  ];
  const PDF_WORKER_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  if(typeof pdfjsLib!=='undefined') pdfjsLib.GlobalWorkerOptions.workerSrc=PDF_WORKER_SRC;
  const el = id => document.getElementById(id);
  const dialog=el('readerDialog'), view=el('readerView'), canvas=el('canvas');
  const pageBox=el('page'), wrap=el('canvasWrap'), msg=el('msg'), controls=el('controls');
  const input=el('pageInput'), ctx=canvas.getContext('2d');
  let pdf=null, loadingTask=null, renderTask=null, pageNum=1, zoom=1;
  let bookWidth=1, bookHeight=1, session=0, revision=0, chain=Promise.resolve();
  const MAX_ZOOM=6;
  let renderedZoom=1, currentPageWidth=1;
  let lastTrigger=null;
  let tapTimer=null, lastTap=null, gesture=null, ignorePointers=false;
  const pointers=new Map();
  const params=new URLSearchParams(location.search);
  const embedded=params.get('embedded')==='1' && window.parent!==window;
  if(embedded)document.body.classList.add('embedded-reader');

  function message(text){
    msg.textContent=text; msg.hidden=false; pageBox.hidden=true; controls.hidden=true;
  }
  function syncControls(){
    input.value=pageNum;
    el('cPrev').disabled=!pdf || pageNum<=1;
    el('cNext').disabled=!pdf || pageNum>=pdf.numPages;
    el('zOut').disabled=zoom<=1;
    el('zIn').disabled=zoom>=MAX_ZOOM;
    el('fitPage').textContent=zoom===1?'Fit':Math.round(zoom*100)+'%';
  }
  function fitScale(){
    const style=getComputedStyle(view);
    const width=view.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight);
    const height=view.clientHeight-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom);
    return Math.max(.01,Math.min(width/bookWidth,height/bookHeight));
  }
  function captureAnchor(clientX,clientY){
    const area=view.getBoundingClientRect(), page=canvas.getBoundingClientRect();
    const x=clientX ?? area.left+view.clientWidth/2;
    const y=clientY ?? area.top+view.clientHeight/2;
    return {x:(x-page.left)/page.width,y:(y-page.top)/page.height,clientX:x,clientY:y};
  }
  function restoreAnchor(anchor){
    const page=canvas.getBoundingClientRect();
    view.scrollLeft+=page.left+anchor.x*page.width-anchor.clientX;
    view.scrollTop+=page.top+anchor.y*page.height-anchor.clientY;
  }
  function clearPreview(){
    wrap.style.transform=''; wrap.style.transformOrigin='';
  }
  function requestRender({resetScroll=false,anchor=null}={}){
    if(!pdf || !dialog.open) return;
    const rev=++revision, token=session, doc=pdf, n=pageNum, requestedZoom=zoom;
    if(renderTask) renderTask.cancel();
    syncControls();
    view.classList.toggle('is-zoomed',requestedZoom>1);
    view.setAttribute('aria-busy','true');
    // Render offscreen and swap only when complete. The current page stays
    // visible while a zoomed, sharper image is being prepared.
    chain=chain.catch(()=>{}).then(async()=>{
      if(rev!==revision || token!==session || !dialog.open) return;
      try{
        const page=await doc.getPage(n);
        if(rev!==revision || token!==session) return;
        const base=page.getViewport({scale:1});
        const cssViewport=page.getViewport({scale:fitScale()*requestedZoom});
        const pixels=cssViewport.width*cssViewport.height;
        const dpr=Math.min(devicePixelRatio||1,2,Math.sqrt(16000000/pixels));
        const viewport=page.getViewport({scale:fitScale()*requestedZoom*dpr});
        const buffer=document.createElement('canvas');
        buffer.width=Math.ceil(viewport.width); buffer.height=Math.ceil(viewport.height);
        renderTask=page.render({canvasContext:buffer.getContext('2d'),viewport});
        await renderTask.promise;
        if(rev!==revision || token!==session) return;
        canvas.width=buffer.width; canvas.height=buffer.height;
        ctx.drawImage(buffer,0,0);
        canvas.style.width=cssViewport.width+'px';
        canvas.style.height=cssViewport.height+'px';
        canvas.setAttribute('aria-label',`Document page ${n} of ${doc.numPages}`);
        currentPageWidth=base.width; renderedZoom=requestedZoom;
        clearPreview();
        wrap.classList.remove('turn');
        if(resetScroll){void wrap.offsetWidth;wrap.classList.add('turn');}
        if(anchor) restoreAnchor(anchor);
        else if(resetScroll) view.scrollTo({left:0,top:0,behavior:'instant'});
        el('readerStatus').textContent=`Page ${n} of ${doc.numPages}`;
      }catch(error){
        if(error.name!=='RenderingCancelledException' && token===session && rev===revision){
          console.error(error); clearPreview();
          message('This page could not be displayed. Close the document and try again.');
        }
      }finally{
        renderTask=null;
        if(rev===revision) view.setAttribute('aria-busy','false');
      }
    });
  }
  async function openBook(book,trigger){
    lastTrigger=trigger || document.activeElement;
    const token=++session;
    revision++;
    if(renderTask) renderTask.cancel();
    if(loadingTask) { loadingTask.destroy().catch(()=>{}); loadingTask=null; }
    resetGesture();
    pdf=null; pageNum=1; zoom=1; renderedZoom=1;
    el('readerStatus').textContent='';
    view.classList.remove('is-zoomed');
    el('readerHelp').textContent=matchMedia('(pointer: coarse)').matches
      ? 'Tap left/right to turn · Pinch or double-tap to zoom'
      : 'Click left/right to turn · Double-click or Ctrl/⌘ + scroll to zoom';
    el('readerTitle').textContent=book.name;
    el('readerKind').textContent=book.type==='paper'?'Paper':'Portfolio';
    document.title=book.name+(book.type==='paper'?' — Writing':' — Portfolio');
    message('Loading document…');
    dialog.showModal(); document.body.classList.add('reader-open');
    el('closeReader').focus();
    view.setAttribute('aria-busy','true');
    if(typeof pdfjsLib==='undefined'){
      view.setAttribute('aria-busy','false');
      message('The portfolio viewer could not load. Please reload and try again.'); return;
    }
    try{
      loadingTask=pdfjsLib.getDocument({url:book.src,isEvalSupported:false});
      const doc=await loadingTask.promise;
      if(token!==session) return;
      // Measure every page once: a portrait cover uses the same scale as a spread.
      const sizes=await Promise.all(Array.from({length:doc.numPages},async(_,i)=>{
        const p=await doc.getPage(i+1); return p.getViewport({scale:1});
      }));
      if(token!==session) return;
      pdf=doc;
      bookWidth=Math.max(...sizes.map(p=>p.width));
      bookHeight=Math.max(...sizes.map(p=>p.height));
      currentPageWidth=sizes[0].width;
      el('pageTotal').textContent=doc.numPages;
      msg.hidden=true; pageBox.hidden=false; controls.hidden=false;
      requestRender({resetScroll:true});
    }catch(error){
      if(token!==session) return;
      console.error(error); view.setAttribute('aria-busy','false');
      message(error.name==='MissingPDFException'
        ? 'This portfolio is not available yet. Please close it and choose another book.'
        : 'The portfolio could not be opened. Please close it and try again.');
    }
  }
  function closeBook(){ dialog.close(); }
  dialog.addEventListener('close',()=>{
    session++; revision++; pdf=null; resetGesture();
    if(renderTask) renderTask.cancel();
    if(loadingTask) { loadingTask.destroy().catch(()=>{}); loadingTask=null; }
    document.body.classList.remove('reader-open');
    if(embedded){
      window.parent.postMessage({type:'nsp-reader-close'},location.origin);
      return;
    }
    history.replaceState(null,'',location.pathname);
    document.title='Portfolio — 不標準製作';
    loadCovers();
    if(lastTrigger && lastTrigger.isConnected) lastTrigger.focus();
  });
  el('closeReader').addEventListener('click',closeBook);
  dialog.addEventListener('click',event=>{ if(event.target===dialog){
    const r=dialog.getBoundingClientRect();
    if(event.clientX<r.left || event.clientX>r.right || event.clientY<r.top || event.clientY>r.bottom) closeBook();
  }});
  function cancelTap(){clearTimeout(tapTimer);tapTimer=null;lastTap=null;}
  function resetGesture(){
    cancelTap();pointers.clear();gesture=null;ignorePointers=false;
    clearPreview();view.classList.remove('is-panning');
  }
  function go(delta){
    if(!pdf) return;
    cancelTap();
    const next=Math.max(1,Math.min(pdf.numPages,pageNum+delta));
    if(next===pageNum) return;
    pageNum=next; clearPreview(); requestRender({resetScroll:true});
  }
  function setZoom(value,point){
    if(!pdf) return;
    cancelTap();
    const next=Math.max(1,Math.min(MAX_ZOOM,value));
    const anchor=point && 'clientX' in point?point:captureAnchor(point?.x,point?.y);
    zoom=next; requestRender({anchor});
  }
  function fitWidth(){
    const style=getComputedStyle(view);
    const width=view.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight);
    setZoom(width/(currentPageWidth*fitScale()));
  }
  el('cPrev').addEventListener('click',()=>go(-1));
  el('cNext').addEventListener('click',()=>go(1));
  el('zOut').addEventListener('click',()=>setZoom(zoom/1.25));
  el('zIn').addEventListener('click',()=>setZoom(zoom*1.25));
  el('fitPage').addEventListener('click',()=>{zoom=1;cancelTap();requestRender({resetScroll:true});});
  el('fitWidth').addEventListener('click',fitWidth);
  input.addEventListener('change',()=>{
    const n=Number(input.value);
    if(pdf && Number.isInteger(n) && n>=1 && n<=pdf.numPages){pageNum=n;cancelTap();requestRender({resetScroll:true});}
    else input.value=pageNum;
  });
  input.addEventListener('keydown',event=>{if(event.key==='Enter')input.blur();});
  document.addEventListener('keydown',event=>{
    if(!dialog.open) return;
    const modified=event.ctrlKey||event.metaKey;
    if(modified && ['s','p'].includes(event.key.toLowerCase())){event.preventDefault();return;}
    if(modified && ['+','=','-','0'].includes(event.key)){
      event.preventDefault();
      if(event.key==='0') el('fitPage').click();
      else setZoom(event.key==='-'?zoom/1.25:zoom*1.25);
      return;
    }
    if(event.target===input || modified || event.altKey) return;
    if(['ArrowRight','PageDown'].includes(event.key)){event.preventDefault();go(1);}
    else if(['ArrowLeft','PageUp'].includes(event.key)){event.preventDefault();go(-1);}
    else if(event.key==='+' || event.key==='='){event.preventDefault();setZoom(zoom*1.25);}
    else if(event.key==='-'){event.preventDefault();setZoom(zoom/1.25);}
  });
  canvas.addEventListener('contextmenu',event=>event.preventDefault());
  canvas.addEventListener('dragstart',event=>event.preventDefault());
  view.addEventListener('wheel',event=>{
    if(!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?view.clientHeight:1);
    setZoom(zoom*Math.exp(-delta*.002),{x:event.clientX,y:event.clientY});
  },{passive:false});
  view.addEventListener('dblclick',event=>event.preventDefault());
  const midpoint=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  function tap(point){
    const now=performance.now();
    if(lastTap && now-lastTap.time<320 && distance(lastTap,point)<28){
      cancelTap();setZoom(zoom>1?1:2.5,point);return;
    }
    cancelTap();lastTap={...point,time:now};
    const token=session,n=pageNum;
    tapTimer=setTimeout(()=>{
      tapTimer=null;lastTap=null;
      if(!pdf || token!==session || n!==pageNum) return;
      const rect=canvas.getBoundingClientRect();
      go(point.x<rect.left+rect.width/2?-1:1);
    },320);
  }
  view.addEventListener('pointerdown',event=>{
    if(!pdf || pageBox.hidden || (event.pointerType==='mouse' && event.button!==0)) return;
    if(view.getAttribute('aria-busy')==='true' || ignorePointers) return;
    event.preventDefault();
    try{view.setPointerCapture(event.pointerId);}catch(error){/* Synthetic tests have no native pointer. */}
    const point={x:event.clientX,y:event.clientY};
    if(lastTap && performance.now()-lastTap.time<320 && distance(lastTap,point)<28){
      clearTimeout(tapTimer);tapTimer=null;
    }else cancelTap();
    pointers.set(event.pointerId,point);
    if(pointers.size===1){
      gesture={type:'single',start:point,left:view.scrollLeft,top:view.scrollTop,moved:false,onPage:wrap.contains(event.target)};
      if(zoom>1)view.classList.add('is-panning');
    }else if(pointers.size===2){
      cancelTap();
      const [a,b]=[...pointers.values()],middle=midpoint(a,b);
      gesture={type:'pinch',distance:distance(a,b),startZoom:renderedZoom,previewZoom:renderedZoom,
        anchor:captureAnchor(middle.x,middle.y),startMiddle:middle,middle};
      view.classList.remove('is-panning');
    }
  });
  view.addEventListener('pointermove',event=>{
    if(!pointers.has(event.pointerId) || !gesture || ignorePointers) return;
    event.preventDefault();
    const point={x:event.clientX,y:event.clientY};pointers.set(event.pointerId,point);
    if(gesture.type==='pinch' && pointers.size>=2){
      const [a,b]=[...pointers.values()];
      gesture.middle=midpoint(a,b);
      gesture.previewZoom=Math.max(1,Math.min(MAX_ZOOM,gesture.startZoom*distance(a,b)/Math.max(1,gesture.distance)));
      const scale=gesture.previewZoom/renderedZoom;
      const dx=gesture.middle.x-gesture.startMiddle.x,dy=gesture.middle.y-gesture.startMiddle.y;
      wrap.style.transformOrigin=`${gesture.anchor.x*100}% ${gesture.anchor.y*100}%`;
      wrap.style.transform=`translate(${dx}px,${dy}px) scale(${scale})`;
      el('fitPage').textContent=Math.round(gesture.previewZoom*100)+'%';
    }else if(gesture.type==='single'){
      const dx=point.x-gesture.start.x,dy=point.y-gesture.start.y;
      if(Math.hypot(dx,dy)>8){gesture.moved=true;cancelTap();}
      if(zoom>1){view.scrollLeft=gesture.left-dx;view.scrollTop=gesture.top-dy;}
    }
  },{passive:false});
  function endPointer(event,cancelled=false){
    if(!pointers.has(event.pointerId)) return;
    const point={x:event.clientX,y:event.clientY};pointers.delete(event.pointerId);
    if(gesture?.type==='pinch'){
      const pinch=gesture;gesture=null;ignorePointers=pointers.size>0;
      zoom=pinch.previewZoom;
      requestRender({anchor:{...pinch.anchor,clientX:pinch.middle.x,clientY:pinch.middle.y}});
    }else if(gesture?.type==='single'){
      const single=gesture;gesture=null;
      if(!cancelled){
        const dx=point.x-single.start.x,dy=point.y-single.start.y;
        const moved=single.moved || Math.hypot(dx,dy)>8;
        if(moved && zoom===1 && Math.abs(dx)>60 && Math.abs(dx)>Math.abs(dy)*1.5)go(dx<0?1:-1);
        else if(!moved && single.onPage)tap(point);
      }
    }
    if(pointers.size===0){ignorePointers=false;view.classList.remove('is-panning');}
  }
  view.addEventListener('pointerup',event=>endPointer(event));
  view.addEventListener('pointercancel',event=>endPointer(event,true));
  let resizeTimer;
  new ResizeObserver(()=>{
    clearTimeout(resizeTimer); resizeTimer=setTimeout(()=>requestRender(),100);
  }).observe(view);
  async function loadCover(button,book){
    const thumbnail=button.querySelector('.book-thumbnail');
    const status=button.querySelector('.book-cover-status');
    if(typeof pdfjsLib==='undefined'){
      status.textContent='Cover unavailable'; return;
    }
    const task=pdfjsLib.getDocument({url:book.src,isEvalSupported:false});
    try{
      const doc=await task.promise;
      const cover=await doc.getPage(1);
      const base=cover.getViewport({scale:1});
      const viewport=cover.getViewport({scale:Math.min(448/base.width,600/base.height)});
      thumbnail.width=Math.ceil(viewport.width);
      thumbnail.height=Math.ceil(viewport.height);
      await cover.render({canvasContext:thumbnail.getContext('2d'),viewport}).promise;
      thumbnail.hidden=false; status.hidden=true;
    }catch(error){
      status.textContent=error.name==='MissingPDFException'?'PDF not available yet':'Cover unavailable';
    }finally{
      task.destroy().catch(()=>{});
    }
    thumbnail.addEventListener('contextmenu',event=>event.preventDefault());
  }
  let coversLoaded=false;
  function loadCovers(){
    if(coversLoaded || embedded)return;
    coversLoaded=true;
    document.querySelectorAll('.book-card').forEach(button=>{
      loadCover(button,BOOKS.find(book=>book.id===button.dataset.book));
    });
  }
  document.querySelectorAll('.book-card').forEach(button=>{
    const book=BOOKS.find(b=>b.id===button.dataset.book);
    button.addEventListener('click',()=>{
      history.replaceState(null,'','?book='+book.id); openBook(book,button);
    });
  });
  if(!params.has('paper'))loadCovers();
  const requested=BOOKS.find(book=>book.id===params.get('book'));
  if(requested) openBook(requested,document.querySelector(`[data-book="${requested.id}"]`));
  else if(params.get('paper')){
    const paperId=params.get('paper');
    fetch('data.json').then(response=>{
      if(!response.ok) throw new Error('Writing data unavailable');
      return response.json();
    }).then(data=>{
      const paper=(data.writings||[]).find(item=>item.id===paperId && item.pdf);
      if(!paper) throw new Error('Paper not found');
      openBook({name:paper.title,src:paper.pdf,type:'paper'});
    }).catch(error=>{
      console.error(error);
      lastTrigger=document.activeElement;
      el('readerTitle').textContent='Paper unavailable';
      el('readerKind').textContent='Paper';
      dialog.showModal(); document.body.classList.add('reader-open');
      message('This paper could not be opened. Please close it and try again.');
      el('closeReader').focus();
    });
  }
})();
