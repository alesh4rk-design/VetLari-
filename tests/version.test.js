import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { APP_VERSION } from '../js/version.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sw = readFileSync(join(root, 'service-worker.js'), 'utf8');

test('versão do sistema e do cache do service worker caminham juntas (força atualização a cada versão)', () => {
  assert.match(sw, new RegExp(`const CACHE = 'vetlaudo-${APP_VERSION.replace(/\./g, '\\.')}'`));
});
test('service worker ignora o cache do navegador ao buscar arquivos (atualização imediata)', () => {
  assert.match(sw, /fetch\(req, \{ cache: 'no-cache' \}\)/);
  assert.match(sw, /cache: 'reload'/);
});
