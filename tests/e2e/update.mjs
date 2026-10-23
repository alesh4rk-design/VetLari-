// E2E da página de conserto "atualizar.html": remove o modo offline antigo e o cache, sem apagar os dados.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.argv[2] || 'http://localhost:8080/';
const results = [];
const check = (name, ok, extra = '') => { results.push([name, ok]); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${extra}`); };
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await (await browser.newContext({ viewport: { width: 390, height: 800 } })).newPage();
const errors = []; page.on('pageerror', (e) => errors.push(e.message));

await page.goto(base + '#/paciente/novo');
await page.fill('#p-name', 'Paciente Que Não Pode Sumir'); await page.click('button:has-text("Salvar paciente")'); await page.waitForSelector('text=Paciente Que Não Pode Sumir');
await page.evaluate(() => navigator.serviceWorker.ready);
await page.reload(); await page.waitForSelector('text=Pacientes');
const before = await page.evaluate(async () => ({ regs: (await navigator.serviceWorker.getRegistrations()).length, caches: (await caches.keys()).length }));
check('antes: modo offline e cache existem', before.regs >= 1 && before.caches >= 1, JSON.stringify(before));

await page.goto(base + 'atualizar.html');
await page.waitForSelector('body[data-state="done"]');
const during = await page.evaluate(async () => ({ regs: (await navigator.serviceWorker.getRegistrations()).length, caches: (await caches.keys()).length }));
check('a página de conserto remove o modo offline antigo e o cache', during.regs === 0 && during.caches === 0, JSON.stringify(during));
check('aviso de que os laudos não são apagados', (await page.textContent('main')).includes('NÃO são apagados'));
await page.waitForURL(/atualizado=/, { timeout: 8000 });
await page.waitForSelector('text=Painel de laudos');
check('depois abre o sistema normalmente', true);
await page.goto(base + '#/pacientes');
await page.waitForSelector('text=Paciente Que Não Pode Sumir');
check('os dados continuam no aparelho (paciente ainda existe)', true);
check('sem erros de página', errors.length === 0, errors.join(' | '));
await browser.close();
const failed = results.filter(([, ok]) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} passaram`);
process.exit(failed ? 1 : 0);
