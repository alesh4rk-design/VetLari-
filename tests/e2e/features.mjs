// E2E de ditado por voz (com reconhecimento simulado), anotações em imagens, seleção de imagens e modo offline (PWA).
// O reconhecimento de voz real depende do navegador/microfone e NÃO é coberto por este teste.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const here = dirname(fileURLToPath(import.meta.url));
const base = process.argv[2] || 'http://localhost:8080/';
const results = [];
const check = (name, ok, extra = '') => { results.push([name, ok]); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${extra}`); };

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 900 } });
await ctx.addInitScript(() => {
  if (location.search.includes('semvoz')) { window.SpeechRecognition = undefined; window.webkitSpeechRecognition = undefined; return; }
  window.SpeechRecognition = class {
    start() { setTimeout(() => this.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: 'fígado com ecotextura homogênea' }], { isFinal: true })] }), 50); }
    stop() { this.onend && this.onend(); } abort() {}
  };
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(base);
await page.waitForSelector('text=Painel de laudos');
await page.goto(base + '#/novo'); await page.click('button:has-text("Começar laudo")');
await page.waitForSelector('#f-patient\\.name'); await page.fill('#f-patient\\.name', 'Paciente Voz');
await page.click('[data-step="1"]');

// Ditado
const desc = '[data-sec] textarea >> nth=0';
await page.fill(desc, 'Texto prévio.');
await page.click('[data-sec] [data-act="dictate"] >> nth=0');
await page.click('.modal [data-x="start"]');
await page.waitForFunction(() => document.querySelector('#vtext').value.includes('ecotextura'));
check('transcrição aparece para revisão', true);
check('nada é inserido no laudo antes da confirmação', (await page.inputValue(desc)) === 'Texto prévio.');
await page.fill('#vtext', 'fígado com ecotextura homogênea (corrigido pela veterinária)');
await page.click('.modal [data-x="ok"]');
const val = await page.inputValue(desc);
check('texto revisado é inserido sem apagar o existente', val === 'Texto prévio. fígado com ecotextura homogênea (corrigido pela veterinária)', JSON.stringify(val));
await page.click('[data-sec] [data-act="dictate"] >> nth=0');
await page.fill('#vtext', 'não deve entrar');
await page.click('.modal [data-x="cancel"]');
check('cancelar não insere nada', (await page.inputValue(desc)) === val);

// Imagens, anotação e seleção
await page.click('[data-step="2"]');
await page.setInputFiles('#img-file', [join(here, '../fixture-usg.jpg'), join(here, '../fixture-rx.png')]);
await page.waitForSelector('.imgcard >> nth=1');
await page.click('[data-act="img-view"] >> nth=0');
await page.waitForSelector('#vc');
await page.click('.modal [data-tool="arrow"]');
const box = await page.locator('#vc').boundingBox();
await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.4);
await page.mouse.down(); await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.55, { steps: 5 }); await page.mouse.up();
await page.click('.modal [data-tool="text"]');
await page.fill('#vtxt', 'lesão');
await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.7);
await page.click('.modal [data-v="zin"]');
await page.click('.modal [data-v="close"]');
await page.waitForSelector('text=com anotações');
await page.waitForSelector('#savestate.saved', { timeout: 5000 });
const stored = await page.evaluate(() => new Promise((res) => {
  const r = indexedDB.open('vetlaudo'); r.onsuccess = () => { const q = r.result.transaction('exams').objectStore('exams').getAll(); q.onsuccess = () => res(q.result.map((e) => e.images.map((i) => ({ n: (i.annotations || []).length, hasCopy: !!i.annotatedSrc, differs: i.annotatedSrc && i.annotatedSrc !== i.src })))); };
}));
const imgs = stored.flat();
check('anotações guardadas (seta + texto) com cópia anotada separada do original', imgs[0].n === 2 && imgs[0].hasCopy && imgs[0].differs, JSON.stringify(imgs));
check('segunda imagem não foi alterada', imgs[1].n === 0 && !imgs[1].hasCopy);

await page.uncheck('[data-imgf="include"] >> nth=1');
await page.click('[data-step="4"]'); await page.waitForSelector('.paper');
check('imagem desmarcada não entra na prévia do laudo', (await page.locator('.paper figure').count()) === 1);

// Sem reconhecimento de voz: digitação manual continua funcionando
const page2 = await ctx.newPage();
await page2.goto(base + '?semvoz=1#/novo'); await page2.click('button:has-text("Começar laudo")');
await page2.waitForSelector('#f-patient\\.name'); await page2.click('[data-step="1"]');
await page2.click('[data-sec] [data-act="dictate"] >> nth=0');
check('sem suporte de voz: iniciar desabilitado e aviso exibido', await page2.isDisabled('.modal [data-x="start"]') && (await page2.textContent('.modal')).includes('não oferece reconhecimento de voz'));
await page2.fill('#vtext', 'texto digitado manualmente'); await page2.click('.modal [data-x="ok"]');
check('sem suporte de voz: texto manual é inserido', (await page2.inputValue('[data-sec] textarea >> nth=0')) === 'texto digitado manualmente');
await page2.close();

// PWA / offline
await page.goto(base + '#/');
await page.waitForSelector('text=Painel de laudos');
await page.evaluate(() => navigator.serviceWorker.ready);
check('manifesto vinculado', (await page.getAttribute('link[rel=manifest]', 'href')) === 'manifest.json');
await page.reload(); await page.waitForSelector('text=Painel de laudos');
await ctx.setOffline(true);
await page.reload();
await page.waitForSelector('text=Painel de laudos', { timeout: 15000 });
check('abre sem internet após a primeira visita', true);
await page.goto(base + '#/laudos'); await page.waitForSelector('#exlist');
check('dados locais acessíveis offline', (await page.locator('#exlist li').count()) >= 1);
await ctx.setOffline(false);

check('sem erros de console', errors.filter((e) => !/net::ERR_INTERNET_DISCONNECTED|Failed to load resource/.test(e)).length === 0, errors.join(' | '));
await browser.close();
const failed = results.filter(([, ok]) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} passaram`);
process.exit(failed ? 1 : 0);
