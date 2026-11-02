/** Optional real-browser checks. No packages are installed or downloaded. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const options = new Set(process.argv.slice(2));
const prefix = options.has('--subpath') ? '/new-account-portfolio/' : '/';
const browser = process.env.PORTFOLIO_BROWSER || [
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(candidate => fs.existsSync(candidate));
assert(browser, 'Set PORTFOLIO_BROWSER to your installed Chromium browser executable.');

const output = path.join(root, '.site-review');
fs.mkdirSync(output, { recursive: true });
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'portfolio-review-'));
const results = new Map();
const waitingScreenshots = new Set();
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.pdf': 'application/pdf', '.svg': 'image/svg+xml' };

const harness = `<!doctype html><meta charset="utf-8">
<style>body{margin:0;background:white}iframe{display:block;border:0}pre{white-space:pre-wrap;font:12px monospace}</style>
<iframe id="site"></iframe><img src="/__wait__" width="1" height="1" alt=""><pre id="report"></pre>
<script>
const params=new URLSearchParams(location.search),frame=document.getElementById('site');
frame.style.width=params.get('width')+'px';frame.style.height='844px';frame.src=params.get('page');
frame.onload=async()=>{
  const doc=frame.contentDocument;
  const overlayCase=params.get('name').startsWith('paper-overlay');
  const until=async test=>{for(let i=0;i<125;i++){if(test())return;await new Promise(resolve=>setTimeout(resolve,40));}throw Error('Overlay did not reach expected state');};
  let paperLink=null,originalURL=frame.contentWindow.location.href;
  if(overlayCase){
    if(params.get('name')==='paper-overlay-home'){
      await until(()=>doc.querySelector('.work-btn'));
      doc.getElementById('printSlip').click();
    }
    await until(()=>doc.querySelector('a[href*="reader.html?paper="]'));
    paperLink=doc.querySelector('a[href*="reader.html?paper="]');
    paperLink.click();
  }
  if(params.get('name').startsWith('console')){
    doc.getElementById('keyA').click();doc.getElementById('keyB').click();
  }
  setTimeout(async()=>{
    const d=frame.contentDocument,w=frame.contentWindow;
    const result={name:params.get('name'),width:w.innerWidth,scrollWidth:d.documentElement.scrollWidth,errors:w.__smokeErrors||[]};
    const images=[...d.images];
    images.forEach(img=>{img.loading='eager';});
    await until(()=>images.every(img=>img.complete));
    result.brokenImages=images.filter(img=>!img.naturalWidth).map(img=>img.getAttribute('src'));
    if(result.name.startsWith('project-'))result.workReady=!!d.querySelector('.work-title') && d.querySelector('.work-title').textContent!=='Not found';
    if(result.name==='reader-picker')result.coversReady=[...d.querySelectorAll('.book-thumbnail')].every(canvas=>!canvas.hidden && canvas.width>0);
    result.selectionColor=w.getComputedStyle(d.body,'::selection').backgroundColor;
    result.globalDefault=w.getComputedStyle(d.body).cursor;
    result.globalPress=w.getComputedStyle(d.querySelector('.topnav a')).cursor;
    if(overlayCase){
      const overlay=d.querySelector('.document-overlay');
      result.overlayOpen=!!overlay?.open;
      result.samePage=w.location.href===originalURL;
      const inner=overlay?.querySelector('iframe').contentDocument;
      result.embeddedPDFReady=!!inner?.getElementById('readerStatus').textContent;
      result.embeddedPress=inner?.defaultView.getComputedStyle(inner.getElementById('cNext')).cursor;
      if(inner){
        inner.getElementById('closeReader').click();
        await until(()=>!d.querySelector('.document-overlay'));
        result.closedBackToPage=w.location.href===originalURL && d.activeElement===paperLink;
        paperLink.click();
        await until(()=>d.querySelector('.document-frame')?.contentDocument?.getElementById('readerStatus')?.textContent);
      }
    }
    if(result.name.startsWith('console')){
      result.cables=[...d.querySelectorAll('.contact-cables path')].map(p=>p.getAttribute('d'));
      result.faceCursor=w.getComputedStyle(d.querySelector('.face-canvas')).cursor;
      result.leverCursor=w.getComputedStyle(d.getElementById('leverHandle')).cursor;
      result.wipeCursor=w.getComputedStyle(d.getElementById('profileWipe')).cursor;
      result.plugCursor=w.getComputedStyle(d.querySelector('.contact-plug')).cursor;
      result.defaultCursor=w.getComputedStyle(d.body).cursor;
      result.screenCursorBefore=w.getComputedStyle(d.getElementById('screen')).cursor;
      const workButton=d.querySelector('.work-btn:not([disabled])');
      result.pressCursor=w.getComputedStyle(workButton).cursor;
      workButton.click();
      result.screenCursorAfter=w.getComputedStyle(d.getElementById('screen')).cursor;
      d.getElementById('profileMore').click();result.drawerOpen=d.getElementById('drawer').getAttribute('aria-hidden')==='false';
      d.getElementById('drawerClose').click();
    }
    if(['reader','reader-b','reader-desktop','paper'].includes(result.name)){
      result.pdfReady=!!d.getElementById('readerStatus').textContent;
      result.pdfMessage=d.getElementById('msg').hidden?'':d.getElementById('msg').textContent;
      if(result.pdfReady){
        const wait=async()=>{for(let i=0;i<150;i++){
          if(d.getElementById('readerView').getAttribute('aria-busy')==='false')return;
          await new Promise(resolve=>setTimeout(resolve,30));
        }throw Error('PDF render timed out');};
        const canvas=d.getElementById('canvas'),area=d.getElementById('readerView');
        result.pageScaleBefore=w.visualViewport?.scale||1;
        result.pdfWidthBefore=canvas.getBoundingClientRect().width;
        d.getElementById('zIn').click();await wait();
        result.pdfWidthAfter=canvas.getBoundingClientRect().width;
        result.pageScaleAfter=w.visualViewport?.scale||1;
        d.getElementById('fitPage').click();await wait();
        const rect=canvas.getBoundingClientRect();
        const point={clientX:rect.right-4,clientY:rect.top+20,pointerId:1,pointerType:'touch',button:0,bubbles:true,cancelable:true};
        canvas.dispatchEvent(new w.PointerEvent('pointerdown',point));
        canvas.dispatchEvent(new w.PointerEvent('pointerup',point));
        await new Promise(resolve=>setTimeout(resolve,380));await wait();
        result.pageAfterTap=Number(d.getElementById('pageInput').value);
        const before=canvas.getBoundingClientRect();
        const wheel=new w.WheelEvent('wheel',{deltaY:-200,ctrlKey:true,clientX:before.left+before.width/2,clientY:before.top+before.height/2,bubbles:true,cancelable:true});
        area.dispatchEvent(wheel);await wait();
        result.wheelPrevented=wheel.defaultPrevented;
        d.getElementById('fitWidth').click();await wait();
        result.widthMode=canvas.getBoundingClientRect().width;
      }
    }
    document.getElementById('report').textContent=JSON.stringify(result,null,2);
    await fetch('/__result__',{method:'POST',body:JSON.stringify(result)});
  },params.get('name').startsWith('project-')?2000:10000);
};
</script>`;

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost');
  if (url.pathname === '/__wait__') {
    // Hold page load until interaction checks finish, then take the screenshot.
    const finish=()=>{
      if(response.writableEnded)return;
      clearTimeout(timer);waitingScreenshots.delete(finish);
      response.writeHead(200, { 'Content-Type': 'image/gif' });
      response.end(Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64'));
    };
    const timer=setTimeout(finish,30000);
    waitingScreenshots.add(finish);
    return;
  }
  if (url.pathname === '/__result__') {
    let body = '';
    for await (const chunk of request) body += chunk;
    const result = JSON.parse(body);
    results.set(result.name, result);
    response.end('OK');
    setTimeout(()=>{for(const finish of waitingScreenshots)finish();},250);
    return;
  }
  if (url.pathname === '/__review__') {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end(harness);
    return;
  }
  if (!url.pathname.startsWith(prefix)) {
    response.writeHead(404); response.end('Outside publishing directory'); return;
  }
  const name = decodeURIComponent(url.pathname.slice(prefix.length)) || 'index.html';
  const target = path.resolve(root, name);
  if (!target.startsWith(root + path.sep) || !fs.existsSync(target) || !fs.statSync(target).isFile()) {
    response.writeHead(404); response.end('Not found'); return;
  }
  const extension = path.extname(target);
  response.writeHead(200, { 'Content-Type': (types[extension] || 'application/octet-stream') + (['.html', '.js', '.css', '.json'].includes(extension) ? '; charset=utf-8' : '') });
  if (extension === '.html') {
    const instrumentation = `<script>window.__smokeErrors=[];addEventListener('error',event=>{if(event.message)window.__smokeErrors.push(event.message);});</script>`;
    response.end(fs.readFileSync(target, 'utf8').replace('<head>', '<head>' + instrumentation));
  } else fs.createReadStream(target).pipe(response);
});

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const cases = [
  { name: 'console', width: 1280, page: 'index.html' },
  { name: 'console-small', width: 320, page: 'index.html' },
  { name: 'console-mobile', width: 390, page: 'index.html' },
  { name: 'index-small', width: 320, page: 'works.html' },
  { name: 'index-tablet', width: 768, page: 'works.html?person=a' },
  { name: 'work', width: 390, page: 'work.html?id=peering-through-the-collapse' },
  { name: 'reader-picker', width: 320, page: 'reader.html' },
  { name: 'reader', width: 390, page: 'reader.html?book=a' },
  { name: 'reader-b', width: 390, page: 'reader.html?book=b' },
  { name: 'reader-desktop', width: 1280, page: 'reader.html?book=a' },
  { name: 'paper', width: 390, page: 'reader.html?paper=01110100-01101111-2026' },
  { name: 'paper-overlay', width: 390, page: 'works.html#writing-h' },
  { name: 'paper-overlay-home', width: 1280, page: 'index.html' },
];
if(options.has('--all-works')) {
  const data=JSON.parse(fs.readFileSync(path.join(root,'data.json'),'utf8'));
  const ids=[...new Set(Object.values(data.projects).flat().map(project=>project.id))];
  for(const id of ids)for(const width of [320,1280])cases.push({name:`project-${id}-${width}`,width,page:`work.html?id=${encodeURIComponent(id)}`});
}
const requestedCases = new Set([...options].filter(option=>!option.startsWith('--')));

try {
  for (const entry of cases.filter(entry => !requestedCases.size || requestedCases.has(entry.name))) {
    const query = new URLSearchParams({...entry,page:prefix+entry.page});
    const child = spawn(browser, [
      '--headless=new', '--disable-gpu', '--no-first-run',
      `--user-data-dir=${profile}`,
      `--screenshot=${path.join(output, entry.name + '.png')}`,
      `--window-size=${Math.max(800, entry.width + 40)},1100`,
      `http://127.0.0.1:${port}/__review__?${query}`,
    ], { windowsHide: true, stdio: 'ignore' });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { child.kill(); reject(new Error(`Browser check timed out: ${entry.name}`)); }, 45000);
      child.once('error', error => { clearTimeout(timer); reject(error); });
      child.once('exit', () => { clearTimeout(timer); resolve(); });
    });
    const result = results.get(entry.name);
    assert(result, `Browser did not report a result: ${entry.name}`);
    assert(result.scrollWidth <= result.width, `Horizontal overflow: ${entry.name}`);
    assert.equal(result.errors.length, 0, `${entry.name}: ${result.errors.join('; ')}`);
    assert.equal(result.brokenImages.length,0,`Broken images: ${entry.name}: ${result.brokenImages.join(', ')}`);
    if(entry.name.startsWith('project-'))assert(result.workReady,`Work did not load: ${entry.name}`);
    if(entry.name==='reader-picker')assert(result.coversReady,'Both portfolio covers must render');
    assert.equal(result.selectionColor, 'rgb(169, 238, 62)', `Expected lime selection: ${entry.name}`);
    assert(result.globalDefault.includes('cursors/arrow.svg'));
    assert(result.globalPress.includes('cursors/pointer.svg'));
    if (entry.name.startsWith('paper-overlay')) {
      assert(result.overlayOpen && result.samePage,'Paper must open over the current page');
      assert(result.embeddedPDFReady,'Embedded paper must render');
      assert(result.closedBackToPage,'Closing must return to the original page and link');
      assert(result.embeddedPress.includes('cursors/pointer.svg'));
    }
    if (entry.name.startsWith('console')) {
      assert.equal(result.cables.length, entry.width>760?4:0);
      assert(result.cables.every(route => /^M[\d.]+ [\d.]+ L/.test(route)), 'Expected diagonal cable starts');
      assert(result.drawerOpen, 'Studio introduction drawer did not open');
      assert(result.faceCursor.includes('cursors/pencil.svg'));
      assert(result.leverCursor.includes('cursors/grab.svg'));
      assert(result.wipeCursor.includes('cursors/eraser.svg'));
      assert(result.plugCursor.includes('cursors/plug.svg'));
      assert(result.defaultCursor.includes('cursors/arrow.svg'));
      assert(result.pressCursor.includes('cursors/pointer.svg'));
      assert(result.screenCursorBefore.includes('cursors/crosshair.svg'));
      assert(result.screenCursorAfter.includes('cursors/crosshair.svg'));
    }
    if (['reader','reader-b','reader-desktop','paper'].includes(entry.name)) {
      assert(result.pdfReady, `PDF was not ready: ${result.pdfMessage}`);
      assert(result.pdfWidthAfter > result.pdfWidthBefore, 'PDF canvas must enlarge');
      assert.equal(result.pageScaleAfter,result.pageScaleBefore,'Browser viewport must stay at its original zoom');
      assert.equal(result.pageAfterTap,2,'Tap on the PDF should advance to page 2');
      assert(result.wheelPrevented,'Ctrl-wheel must zoom the PDF rather than the browser');
    }
    console.log(`PASS: ${entry.name}, ${entry.width}px, no overflow or JavaScript errors`);
  }
  fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify([...results.values()], null, 2) + '\n');
} finally {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  fs.rmSync(profile, { recursive: true, force: true });
}
