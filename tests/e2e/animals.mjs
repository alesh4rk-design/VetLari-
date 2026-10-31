// E2E: lista de espécies e raças (com digitação livre) e idade calculada pela data de nascimento.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.argv[2] || 'http://localhost:8080/';
const results = [];
const check = (name, ok, extra = '') => { results.push([name, ok]); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${extra}`); };
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const opts = (id) => page.evaluate((i) => [...document.querySelectorAll(`#${i} option`)].map((o) => o.value), id);

// Cadastro de paciente
await page.goto(base + '#/paciente/novo');
await page.fill('#p-name', 'Teste Espécie');
const sp = await opts('species-list');
check('lista de espécies (cão, gato, ave, roedor...)', ['Cão', 'Gato', 'Ave', 'Roedor'].every((x) => sp.includes(x)));
check('sem espécie escolhida, não há sugestões de raça', (await opts('breeds-list')).length === 0);
await page.fill('#p-species', 'Gato');
check('escolher gato mostra raças de gato', (await opts('breeds-list')).includes('Persa') && !(await opts('breeds-list')).includes('Shih Tzu'));
await page.fill('#p-species', 'Cão');
check('escolher cão mostra raças de cão', (await opts('breeds-list')).includes('Shih Tzu') && (await opts('breeds-list')).includes('SRD (sem raça definida)'));
await page.fill('#p-species', 'Ave');
check('ave mostra espécies de ave', (await opts('breeds-list')).includes('Calopsita'));
await page.fill('#p-species', 'Capivara'); await page.fill('#p-breed', 'Raça local qualquer');
check('texto livre é aceito (espécie e raça fora da lista)', (await page.inputValue('#p-species')) === 'Capivara' && (await page.inputValue('#p-breed')) === 'Raça local qualquer');

// Idade automática no cadastro
const d = new Date(); const y = d.getFullYear() - 3; const mm = String(d.getMonth() + 1).padStart(2, '0'); const dd = String(Math.min(d.getDate(), 28)).padStart(2, '0');
check('sem data de nascimento: idade é digitada', await page.isVisible('#p-age') && !(await page.isVisible('#p-age-auto')));
await page.fill('#p-birthDate', `${y}-${mm}-${dd}`);
check('com data de nascimento: idade aparece calculada e travada', (await page.inputValue('#p-age-auto')).startsWith('3 anos') && !(await page.isVisible('#p-age')), await page.inputValue('#p-age-auto'));
await page.fill('#p-birthDate', '');
check('apagar a data volta a permitir digitar a idade', await page.isVisible('#p-age') && !(await page.isVisible('#p-age-auto')));
await page.fill('#p-species', 'Cão'); await page.fill('#p-breed', 'Shih Tzu'); await page.fill('#p-birthDate', '2024-08-10');
await page.click('button:has-text("Salvar paciente")'); await page.waitForSelector('text=Teste Espécie');

// No exame: idade na data do exame
await page.goto(base + '#/novo'); await page.selectOption('#np', { label: 'Teste Espécie' });
await page.waitForSelector('#nf button[type=submit]'); await page.evaluate(() => { const r = document.querySelector('input[name="fmode"][value="none"]'); if (r) r.checked = true; }); await page.click('button:has-text("Começar laudo")'); await page.waitForSelector('#f-patient\\.name');
check('paciente traz espécie e raça digitadas', (await page.inputValue('#f-patient\\.species')) === 'Cão' && (await page.inputValue('#f-patient\\.breed')) === 'Shih Tzu');
await page.fill('#f-date', '2026-10-10');
check('exame: idade calculada na data do exame (2 anos e 2 meses)', (await page.inputValue('#age-auto')) === '2 anos e 2 meses', await page.inputValue('#age-auto'));
await page.fill('#f-date', '2027-02-10');
check('mudar a data do exame recalcula a idade', (await page.inputValue('#age-auto')) === '2 anos e 6 meses', await page.inputValue('#age-auto'));
await page.fill('#f-patient\\.species', 'Gato');
check('no exame: trocar a espécie troca as sugestões de raça', (await opts('breeds-list')).includes('Persa'));
await page.fill('#f-patient\\.birthDate', '');
check('no exame: sem data de nascimento, idade manual', await page.isVisible('#f-age') && !(await page.isVisible('#age-auto')));
await page.fill('#f-patient\\.birthDate', '2025-10-10'); await page.fill('#f-date', '2026-10-10');
await page.click('[data-step="1"]'); await page.click('.organ:has-text("Fígado")');
await page.click('.bgroup:has(.blabel:has-text("Contorno")) .chip');
await page.click('[data-step="4"]'); await page.waitForSelector('.paper');
check('laudo mostra a idade calculada', (await page.textContent('.paper')).includes('Idade: 1 ano'));
// Botão "Lista" com todas as opções (cadastro e exame)
await page.goto(base + '#/paciente/novo');
await page.fill('#p-species', 'Cão');
await page.click('[data-pick="species"]');
check('botão Lista mostra todas as espécies mesmo com o campo preenchido', (await page.locator('.modal .chip').count()) >= 10);
await page.fill('#po-q', 'ave'); check('busca na lista filtra', (await page.locator('.modal .chip').count()) <= 2);
await page.click('.modal .chip:has-text("Ave")');
check('escolher na lista preenche o campo e atualiza raças', (await page.inputValue('#p-species')) === 'Ave' && (await opts('breeds-list')).includes('Calopsita'));
await page.click('[data-pick="breed"]'); await page.click('.modal .chip:has-text("Calopsita")');
check('lista de raças preenche a raça', (await page.inputValue('#p-breed')) === 'Calopsita');
await page.fill('#p-species', 'Capivara'); await page.click('[data-pick="breed"]');
check('espécie sem sugestões: aviso e digitação livre', (await page.locator('.modal').count()) === 0 && (await page.textContent('#toasts')).includes('digite a raça'));
await page.goto(base + '#/novo'); await page.waitForSelector('#nf button[type=submit]'); await page.evaluate(() => { const r = document.querySelector('input[name="fmode"][value="none"]'); if (r) r.checked = true; }); await page.click('button:has-text("Começar laudo")'); await page.waitForSelector('#f-patient\\.name');
await page.click('[data-target="f-patient.species"]'); await page.click('.modal .chip:has-text("Gato")');
await page.click('[data-target="f-patient.breed"]'); await page.click('.modal .chip:has-text("Persa")');
check('no exame: Lista de espécie e raça preenchem os campos', (await page.inputValue('#f-patient\\.species')) === 'Gato' && (await page.inputValue('#f-patient\\.breed')) === 'Persa');
check('sem erros de console', errors.length === 0, errors.join(' | '));
await browser.close();
const failed = results.filter(([, ok]) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} passaram`);
process.exit(failed ? 1 : 0);
