import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sw = readFileSync(join(root, 'service-worker.js'), 'utf8');
const listed = [...sw.matchAll(/^\s+'([^']+)',?$/gm)].map((m) => m[1]).concat([...sw.matchAll(/^\s+"([^"]+)",$/gm)].map((m) => m[1]));

test('PWA: todos os módulos JS estão no pré-cache do service worker', () => {
  for (const f of readdirSync(join(root, 'js')).filter((x) => x.endsWith('.js'))) assert.ok(listed.includes(`js/${f}`), `js/${f} ausente do pré-cache`);
});
test('PWA: todos os arquivos do pré-cache existem', () => {
  for (const f of listed.filter((x) => x !== './')) assert.ok(existsSync(join(root, f)), `${f} não existe`);
});
test('PWA: manifesto válido e ícones existentes', () => {
  const m = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
  assert.equal(m.lang, 'pt-BR'); assert.equal(m.display, 'standalone'); assert.match(m.start_url, /^\.\//);
  for (const i of m.icons) assert.ok(existsSync(join(root, i.src)), i.src);
  assert.ok(m.icons.some((i) => i.sizes === '512x512') && m.icons.some((i) => i.sizes === '192x192'));
});
