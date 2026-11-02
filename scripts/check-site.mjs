/** Offline preflight: syntax, publishable paths, data and shared rendering. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const pages = ['index.html', 'works.html', 'work.html', 'reader.html'];

// Check exact spelling on Windows as well, since static hosts can be case-sensitive.
function publishedFile(source) {
  const parts = decodeURIComponent(source).split('/');
  let current = root;
  for (const part of parts) {
    assert(part && part !== '..', `Invalid local path: ${source}`);
    assert(fs.readdirSync(current).includes(part), `Missing or mis-cased path: ${source}`);
    current = path.join(current, part);
  }
  assert(fs.statSync(current).isFile(), `Expected a file: ${source}`);
}

for (const name of pages) {
  const html = read(name);
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(ids.length, new Set(ids).size, `Duplicate HTML id in ${name}`);
  for (const match of html.matchAll(/(?:href|src)="([^"?#]+)(?:[?#][^"]*)?"/g)) {
    const target = match[1];
    if (/^(?:https?:|mailto:|data:)/.test(target)) continue;
    publishedFile(target);
  }
  assert(html.includes('href="base.css"'), `${name} is missing shared styles`);
  assert(html.includes('href="navigation.css"'), `${name} is missing shared navigation`);
  if (html.includes('src="shared.js"')) {
    assert(html.indexOf('src="image-manifest.js"') < html.indexOf('src="shared.js"'));
  }
}

const javascript = fs.readdirSync(root).filter(name => name.endsWith('.js'));
const utilityScripts = fs.readdirSync(path.join(root, 'scripts')).filter(name => name.endsWith('.mjs')).map(name => 'scripts/' + name);
for (const name of [...javascript, ...utilityScripts]) {
  const result = spawnSync(process.execPath, ['--check', path.join(root, name)], { encoding: 'utf8' });
  assert.equal(result.status, 0, `${name}: ${result.stderr}`);
}

for (const name of fs.readdirSync(root).filter(name => name.endsWith('.css'))) {
  const css = read(name).replace(/\/\*[\s\S]*?\*\//g, '');
  assert.equal((css.match(/{/g) || []).length, (css.match(/}/g) || []).length, `Unbalanced CSS: ${name}`);
  for (const match of css.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
    if (!/^(?:https?:|data:)/.test(match[1])) publishedFile(match[1]);
  }
}

const context = {
  window: {},
  document: { addEventListener() {} },
  console,
};
vm.createContext(context);
vm.runInContext(read('image-manifest.js'), context);
vm.runInContext(read('shared.js'), context);
const manifest = context.window.NSP_IMAGE_VARIANTS;
const helpers = context.window.NSP;
for (const [source, variants] of Object.entries(manifest)) {
  assert.equal(variants.length, 2, `Expected two image sizes: ${source}`);
  for (const image of variants) {
    publishedFile(image.src);
    assert(image.width > 0 && image.height > 0, `Invalid image dimensions: ${source}`);
  }
}

const data = JSON.parse(read('data.json'));
for (const [owner, projects] of Object.entries(data.projects)) {
  const ids = new Set();
  for (const project of projects) {
    assert(project.id && project.title, `Missing work id/title for ${owner}`);
    assert(!ids.has(project.id), `Duplicate work within ${owner}: ${project.id}`);
    ids.add(project.id);
    const media = [...(project.media || []), { src: project.cover }, { src: project.poster }];
    for (const item of media) {
      if (!item.src || /^(?:https?:|data:)/.test(item.src)) continue;
      if (manifest[item.src]) continue; // Originals are deliberately excluded from Git.
      publishedFile(item.src);
    }
  }
}

const group = data.profiles.group;
const biography = helpers.profileIntroHTML(group);
for (const line of group.conversation || []) assert(biography.includes(helpers.esc(line.text)));
assert(!helpers.profileIntroHTML(data.profiles.a).includes('studio-conversation'));
assert(!helpers.profileIntroHTML({ intro: '<script>x</script>' }).includes('<script>'));
for (const [source] of Object.entries(manifest)) {
  const html = helpers.imageTag(source, '"Artwork"');
  assert(html.includes('srcset=') && html.includes('&quot;Artwork&quot;'));
  if (source.includes(' ')) assert(html.includes('%20'), 'Image candidate URLs must encode spaces');
}
const reader = read('reader.js');
assert.equal((reader.match(/getDocument\(\{url:book\.src,isEvalSupported:false\}\)/g) || []).length, 2, 'Both PDF loads must disable evaluation');
assert(!reader.includes("params.get('src')"), 'Only configured portfolios should open');

for (const match of reader.matchAll(/src:'(asset\/[^']+\.pdf)'/g)) publishedFile(match[1]);
for (const writing of data.writings || []) {
  if (writing.pdf) {
    publishedFile(writing.pdf);
    assert(writing.id && writing.link === `reader.html?paper=${writing.id}`, 'Paper must route to its configured reader entry');
    assert(helpers.findProject(data, writing.projectId), 'Related paper must reference an existing work');
  }
}
for (const person of ['a', 'b']) {
  const instagram = data.profiles[person].instagram;
  assert(instagram?.startsWith('https://www.instagram.com/'), `Missing Instagram URL for ${person}`);
  const socket = read('index.html').match(new RegExp(`<a class="contact-plug ig" data-person="${person}"[^>]*>`));
  assert(socket?.[0].includes(`href="${instagram}"`), `Instagram socket and profile disagree for ${person}`);
}

console.log('PASS: JavaScript syntax, HTML assets, exact-case paths, CSS structure, media variants, project data and biography rendering.');
console.log('Browser layout, live external links and PDF rendering still need a browser smoke test.');
