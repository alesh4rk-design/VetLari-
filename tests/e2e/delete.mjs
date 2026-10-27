// E2E: editar e excluir exames (rascunho com confirmação simples; finalizado exigindo digitar EXCLUIR).
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.argv[2] || 'http://localhost:8080/';
const results = [];
const check = (name, ok, extra = '') => { results.push([name, ok]); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${extra}`); };
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

const newExam = async (name) => {
  await page.goto(base + '#/novo'); await page.click('button:has-text("Começar laudo")');
  await page.waitForSelector('#f-patient\\.name'); await page.fill('#f-patient\\.name', name);
  await page.click('[data-step="1"]'); await page.click('.organ:has-text("Fígado")');
  await page.click('.bgroup:has(.blabel:has-text("Contorno")) .chip');
  await page.click('[data-step="3"]'); await page.fill('#f-impression', 'Conclusão de teste.');
  await page.waitForSelector('#savestate.saved', { timeout: 5000 });
};
const dash = async () => { await page.goto(base + '#/'); await page.waitForSelector('text=Painel de laudos'); await page.waitForSelector('#exlist'); };

// Rascunho: Editar + Excluir na lista
await newExam('Excluir Rascunho');
await dash();
const row = page.locator('#exlist li:has-text("Excluir Rascunho")');
check('lista tem "Editar" e "Excluir" para rascunho', (await row.locator('a:has-text("Editar")').count()) === 1 && (await row.locator('button:has-text("Excluir")').count()) === 1);
await row.locator('a:has-text("Editar")').click();
await page.waitForSelector('#f-patient\\.name');
check('"Editar" abre o laudo para edição', (await page.inputValue('#f-patient\\.name')) === 'Excluir Rascunho');
await dash();
await page.locator('#exlist li:has-text("Excluir Rascunho") button:has-text("Excluir")').click();
await page.click('.modal button:has-text("Cancelar")');
check('cancelar mantém o exame', (await page.locator('#exlist li:has-text("Excluir Rascunho")').count()) === 1);
await page.locator('#exlist li:has-text("Excluir Rascunho") button:has-text("Excluir")').click();
await page.click('.modal button.danger');
await page.waitForFunction(() => !document.body.textContent.includes('Excluir Rascunho'));
check('rascunho excluído some da lista e do painel', (await page.locator('#exlist li:has-text("Excluir Rascunho")').count()) === 0);
check('contador de rascunhos atualiza', (await page.locator('.stat .n').first().textContent()).trim() === '0');

// Excluir de dentro do laudo
await newExam('Excluir Dentro');
await page.click('[data-act="del-exam"]'); await page.click('.modal button.danger');
await page.waitForSelector('text=Painel de laudos');
await page.waitForSelector('#exlist');
check('"Excluir exame" dentro do laudo apaga e volta ao painel', (await page.locator('#exlist li:has-text("Excluir Dentro")').count()) === 0);
await page.waitForTimeout(1200); // garante que o salvamento automático não recria o exame
await dash();
check('exame excluído não volta pelo salvamento automático', (await page.locator('#exlist li:has-text("Excluir Dentro")').count()) === 0);

// Finalizado: exige digitar EXCLUIR
await newExam('Excluir Final');
await page.click('[data-step="4"]'); await page.waitForSelector('.paper');
await page.click('[data-act="final"]');
await page.click('.modal [data-x="ok"]');
await page.waitForSelector('text=Laudo finalizado: o conteúdo está protegido');
await dash();
const frow = page.locator('#exlist li:has-text("Excluir Final")');
check('finalizado: "Abrir" e "Excluir" na lista', (await frow.locator('a:has-text("Abrir")').count()) === 1 && (await frow.locator('button:has-text("Excluir")').count()) === 1);
await frow.locator('button:has-text("Excluir")').click();
check('finalizado: botão bloqueado até digitar EXCLUIR', await page.isDisabled('.modal [data-x="yes"]'));
await page.fill('#delc', 'EXCLU');
check('digitação incompleta mantém bloqueado', await page.isDisabled('.modal [data-x="yes"]'));
await page.fill('#delc', 'EXCLUIR');
check('digitar EXCLUIR libera', !(await page.isDisabled('.modal [data-x="yes"]')));
await page.click('.modal [data-x="yes"]');
await page.waitForFunction(() => !document.body.textContent.includes('Excluir Final'));
check('laudo finalizado excluído', (await page.locator('#exlist li:has-text("Excluir Final")').count()) === 0);

// Registro mínimo da exclusão: sem nome de paciente
const log = await page.evaluate(() => new Promise((res) => { const r = indexedDB.open('vetlaudo'); r.onsuccess = () => { const q = r.result.transaction('settings').objectStore('settings').get('deleted-log'); q.onsuccess = () => res(q.result && q.result.value); }; }));
check('registro das exclusões guarda só dados mínimos (sem nome de paciente)', Array.isArray(log) && log.length === 3 && !JSON.stringify(log).includes('Excluir') && log.some((x) => x.status === 'final'), JSON.stringify(log).slice(0, 160));
check('sem erros de console', errors.length === 0, errors.join(' | '));
await browser.close();
const failed = results.filter(([, ok]) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} passaram`);
process.exit(failed ? 1 : 0);
