// E2E da tela de Achados: lista de órgãos, status em botões, medidas prontas do modelo e rolagem estável.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.argv[2] || 'http://localhost:8080/';
const results = [];
const check = (name, ok, extra = '') => { results.push([name, ok]); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${extra}`); };
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(base + '#/novo'); await page.click('button:has-text("Começar laudo")');
await page.waitForSelector('#f-patient\\.name'); await page.fill('#f-patient\\.name', 'Paciente UI');
await page.selectOption('#f-sex', 'Fêmea');
await page.click('[data-step="1"]');
let names = await page.locator('.organ .oname').allTextContents();
check('lista de órgãos em vez de setas (sem botões ▲▼ no exame)', names.length >= 10 && (await page.locator('[data-act="sec-up"],[data-act="sec-down"]').count()) === 0);
check('fêmea: mostra útero e ovários e oculta próstata', names.includes('Ovários') && names.includes('Útero') && !names.includes('Próstata'));
await page.click('[data-step="0"]'); await page.selectOption('#f-sex', 'Macho'); await page.click('[data-step="1"]');
names = await page.locator('.organ .oname').allTextContents();
check('macho: mostra próstata e oculta ovários', names.includes('Próstata') && !names.includes('Ovários'));

// Medidas prontas do modelo: só o valor
await page.click('.organ:has-text("Vesícula urinária")');
const slot = page.locator('.mrow').first();
check('medida pronta: nome e unidade já preenchidos', (await slot.locator('.mlabel').textContent()).includes('Espessura da parede') && (await slot.locator('[data-mf="unit"]').inputValue()) === 'cm');
await slot.locator('[data-mf="value"]').fill('0,26');
check('órgão com dados aparece como "Preenchido" na lista', (await page.locator('.organ:has-text("Vesícula urinária") .ostat').textContent()).includes('Preenchido'));

// Status em botões, sem menu suspenso
check('status em botões (sem menu suspenso)', (await page.locator('[data-act="set-status"]').count()) === 5 && (await page.locator('select[data-sf="status"]').count()) === 0);
await page.click('[data-act="set-status"][data-val="alterado"]');
check('botão de status fica marcado', (await page.getAttribute('[data-val="alterado"]', 'aria-pressed')) === 'true');
await page.click('[data-act="set-status"][data-val="alterado"]');
check('clicar de novo desmarca (volta a "não informado")', (await page.getAttribute('[data-val="alterado"]', 'aria-pressed')) === 'false');

// Rolagem estável ao trocar de órgão / marcar status / adicionar medida
await page.evaluate(() => window.scrollTo(0, 350));
const y0 = await page.evaluate(() => window.scrollY);
await page.click('.organ:has-text("Pâncreas")');
const y1 = await page.evaluate(() => window.scrollY);
await page.click('[data-act="set-status"][data-val="normal"]');
const y2 = await page.evaluate(() => window.scrollY);
await page.click('[data-act="m-add"]');
const y3 = await page.evaluate(() => window.scrollY);
check('a página não sobe ao trocar de órgão, marcar status ou adicionar medida', y0 > 200 && Math.abs(y1 - y0) < 6 && Math.abs(y2 - y0) < 6 && Math.abs(y3 - y0) < 6, `${y0}/${y1}/${y2}/${y3}`);
check('trocar de órgão mantém o foco na lista e mostra o painel certo', (await page.inputValue('[data-sf="title"]')) === 'Pâncreas');
await page.click('[data-act="org-next"]');
check('"Próximo órgão" avança na lista', (await page.inputValue('[data-sf="title"]')) === 'Adrenais');

// Prévia: só o que foi medido aparece
await page.click('[data-step="4"]'); await page.waitForSelector('.paper');
const paper = await page.textContent('.paper');
check('laudo mostra só a medida preenchida (com unidade)', paper.includes('Espessura da parede: 0,26 cm') && !paper.includes('Rim esquerdo – comprimento'));
check('medidas prontas vazias não geram alertas', !(await page.textContent('.alert.warn').catch(() => '')).includes('medida sem valor'));

// Celular: lista em duas colunas e sem estouro
await page.setViewportSize({ width: 390, height: 800 });
await page.click('[data-step="1"]');
check('celular: sem rolagem horizontal', !(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)));
check('celular: lista de órgãos visível', (await page.locator('.organ').first().isVisible()));
check('sem erros de console', errors.length === 0, errors.join(' | '));
await browser.close();
const failed = results.filter(([, ok]) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} passaram`);
process.exit(failed ? 1 : 0);
