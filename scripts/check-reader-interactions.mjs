/** Document gesture regression checks with deterministic PDF/DOM stand-ins. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { performance } from 'node:perf_hooks';

class Element {
  constructor(id) {
    this.id = id; this.hidden = false; this.open = false; this.style = {};
    this.attributes = {}; this.listeners = {}; this.isConnected = true;
    this.clientWidth = 390; this.clientHeight = 600; this.scrollLeft = 0; this.scrollTop = 0;
    const classes = new Set();
    this.classList = {
      add: (...names) => names.forEach(name => classes.add(name)),
      remove: (...names) => names.forEach(name => classes.delete(name)),
      contains: name => classes.has(name),
      toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name),
    };
  }
  addEventListener(type, handler) { (this.listeners[type] ||= []).push(handler); }
  dispatch(type, values = {}) {
    const event = { target: this, preventDefault() { this.defaultPrevented = true; }, ...values };
    for (const handler of this.listeners[type] || []) handler(event);
    return event;
  }
  click() { this.dispatch('click'); }
  focus() { document.activeElement = this; }
  blur() { this.dispatch('change'); }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name]; }
  showModal() { this.open = true; }
  close() { this.open = false; this.dispatch('close'); }
  getContext() { return { drawImage() {} }; }
  contains(target) { return target === this || (this.id === 'canvasWrap' && target === elements.canvas); }
  scrollTo({ left, top }) { this.scrollLeft = left; this.scrollTop = top; }
  setPointerCapture() {}
  getBoundingClientRect() {
    if (this.id !== 'canvas') return { left: 10, top: 80, width: this.clientWidth, height: this.clientHeight, right: 400, bottom: 680 };
    const width = parseFloat(this.style.width) || 300, height = parseFloat(this.style.height) || 150;
    const view = elements.readerView;
    const left = 22 + Math.max(0, (view.clientWidth - 24 - width) / 2) - view.scrollLeft;
    const top = 92 + Math.max(0, (view.clientHeight - 24 - height) / 2) - view.scrollTop;
    return { left, top, width, height, right: left + width, bottom: top + height };
  }
}

const elements = Object.fromEntries([
  'readerDialog', 'readerView', 'canvas', 'page', 'canvasWrap', 'msg', 'controls',
  'pageInput', 'cPrev', 'cNext', 'zOut', 'zIn', 'fitPage', 'fitWidth', 'readerTitle',
  'readerKind', 'readerHelp', 'closeReader', 'pageTotal', 'readerStatus',
].map(id => [id, new Element(id)]));
const document = new Element('document');
document.body = new Element('body'); document.activeElement = document.body;
document.getElementById = id => elements[id];
document.querySelectorAll = () => [];
document.querySelector = () => null;
document.createElement = tag => new Element(tag);
const sizes = [[595, 842], [1190, 842], [1190, 842]];
const pdf = {
  numPages: sizes.length,
  async getPage(number) {
    return {
      getViewport: ({ scale }) => ({ width: sizes[number - 1][0] * scale, height: sizes[number - 1][1] * scale }),
      render: () => ({ promise: Promise.resolve(), cancel() {} }),
    };
  },
};
const context = {
  document, console, performance, setTimeout, clearTimeout, URLSearchParams,
  location: { search: '?book=a', pathname: '/reader.html' }, history: { replaceState() {} },
  matchMedia: () => ({ matches: false }), devicePixelRatio: 2,
  getComputedStyle: () => ({ paddingLeft: '12px', paddingRight: '12px', paddingTop: '12px', paddingBottom: '12px' }),
  ResizeObserver: class { observe() {} },
  pdfjsLib: { GlobalWorkerOptions: {}, getDocument: () => ({ promise: Promise.resolve(pdf), destroy: () => Promise.resolve() }) },
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(new URL('../reader.js', import.meta.url), 'utf8'), context);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function ready() {
  for (let i = 0; i < 100; i++) {
    if (elements.readerView.getAttribute('aria-busy') === 'false' && elements.readerStatus.textContent) return;
    await sleep(2);
  }
  throw new Error('Reader render did not finish');
}
const page = () => Number(elements.pageInput.value);
const width = () => parseFloat(elements.canvas.style.width);
function pointer(type, id, x, y, pointerType = 'touch') {
  return elements.readerView.dispatch(type, { pointerId: id, clientX: x, clientY: y, pointerType, button: 0, target: elements.canvas });
}
function tap(x, y) { pointer('pointerdown', 1, x, y); pointer('pointerup', 1, x, y); }

await ready();
assert(elements.readerDialog.open);
const coverWidth = width();
const wheel = elements.readerView.dispatch('wheel', { ctrlKey: true, deltaY: -250, deltaMode: 0, clientX: 190, clientY: 300 });
assert(wheel.defaultPrevented, 'Document wheel zoom must suppress browser zoom');
await ready();
assert(width() > coverWidth, 'The PDF canvas itself must enlarge');
const priorScroll = elements.readerView.scrollLeft;
pointer('pointerdown', 1, 190, 300);
pointer('pointermove', 1, 140, 250);
pointer('pointerup', 1, 140, 250);
await sleep(350);
assert(elements.readerView.scrollLeft > priorScroll);
assert.equal(page(), 1, 'Panning must not turn the page');

elements.fitPage.click(); await ready();
assert(Math.abs(width() - coverWidth) < .01);
let rect = elements.canvas.getBoundingClientRect();
tap(rect.right - 5, rect.top + 20); await sleep(350); await ready();
assert.equal(page(), 2, 'Right-side tap advances');
const spreadWidth = width();
assert(Math.abs(spreadWidth / coverWidth - 2) < .01, 'Cover and spread use a common base scale');
rect = elements.canvas.getBoundingClientRect();
tap(rect.left + 100, rect.top + 40); await sleep(30);
tap(rect.left + 100, rect.top + 40); await ready(); await sleep(350);
assert.equal(page(), 2, 'Double-tap must zoom without turning');
assert(width() > spreadWidth * 2);

const key = document.dispatch('keydown', { key: '0', ctrlKey: true, target: document.body });
assert(key.defaultPrevented); await ready();
assert(Math.abs(width() - spreadWidth) < .01);
pointer('pointerdown', 1, 120, 280); pointer('pointerdown', 2, 240, 280);
pointer('pointermove', 2, 300, 280); pointer('pointermove', 1, 60, 280);
assert(elements.canvasWrap.style.transform.includes('scale(2)'));
pointer('pointerup', 2, 300, 280); pointer('pointerup', 1, 60, 280);
await ready(); await sleep(350);
assert(Math.abs(width() / spreadWidth - 2) < .01);
assert.equal(elements.canvasWrap.style.transform, '');
assert.equal(page(), 2, 'Pinching must not turn the page');

elements.fitPage.click(); await ready();
rect = elements.canvas.getBoundingClientRect();
tap(rect.left + 5, rect.top + 20); await sleep(350); await ready();
assert.equal(page(), 1, 'Left-side tap goes back');
elements.fitWidth.click(); await ready();
assert(Math.abs(width() - (elements.readerView.clientWidth - 24)) < .01);
const beforeCancel = page();
pointer('pointerdown', 1, 150, 200); pointer('pointercancel', 1, 150, 200);
await sleep(350); assert.equal(page(), beforeCancel);
elements.closeReader.click(); assert.equal(elements.readerDialog.open, false);
console.log('PASS: canvas-only wheel/keyboard zoom, fit/width, panning, left/right taps, double-tap, anchored pinch, cancel and close.');
