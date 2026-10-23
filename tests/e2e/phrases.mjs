// E2E de frases prontas com campos preenchidos a partir das medidas da estrutura.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.argv[2] || 'http://localhost:8080/';
const results = [];
const check = (name, ok, extra = '') => { results.push([name, ok]); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${extra}`); };
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(base + '#/frases');
const addPhrase = async (title, text, structure = 'Fígado') => {
  await page.click('button:has-text("Nova frase")');
  await page.fill('#pf-title', title); await page.fill('#pf-text', text); await page.fill('#pf-str', structure);
  await page.click('#pf button[type=submit]'); await page.waitForSelector(`text=${title}`);
};
await page.click('button:has-text("Nova frase")');
await page.fill('#pf-title', 'inválida'); await page.fill('#pf-text', 'medindo {Comprimento');
await page.click('#pf button[type=submit]');
check('frase com chaves desbalanceadas é recusada', (await page.textContent('#pf-err')).includes('desbalanceadas'));
await page.click('.modal [data-x=cancel]');
await addPhrase('Fígado medido', 'Fígado em topografia habitual, medindo {Comprimento}.');
await addPhrase('Lama biliar', 'Lama biliar grau {Grau}.');

await page.goto(base + '#/novo'); await page.click('button:has-text("Começar laudo")');
await page.waitForSelector('#f-patient\\.name'); await page.fill('#f-patient\\.name', 'Paciente Frases');
await page.click('[data-step="1"]');
await page.click('.organ:has-text("Fígado")');
await page.click('[data-sec] [data-act="m-add"] >> nth=0');
await page.fill('[data-mf="label"]', 'Comprimento'); await page.fill('[data-mf="value"]', '5,2'); await page.fill('[data-mf="unit"]', 'cm');

await page.click('[data-sec] [data-act="phrase"] >> nth=0');
const preview = await page.textContent('.modal');
check('prévia da frase já vem preenchida com a medida', preview.includes('medindo 5,2 cm'));
await page.click('.phrase:has-text("Fígado medido") [data-use]');
check('frase pronta inserida com valor e unidade', (await page.inputValue('[data-sec] textarea >> nth=0')).includes('medindo 5,2 cm.'));

await page.click('[data-sec] [data-act="phrase"] >> nth=0');
await page.click('.phrase:has-text("Lama biliar") [data-use]');
check('campo sem medida pergunta o valor', (await page.textContent('.modal')).includes('Completar a frase'));
await page.fill('#mx-0', 'II'); await page.click('.modal [data-x="ok"]');
check('campo digitado completa a frase', (await page.inputValue('[data-sec] textarea >> nth=0')).includes('Lama biliar grau II.'));

await page.click('[data-sec] [data-act="phrase"] >> nth=0');
await page.click('.phrase:has-text("Lama biliar") [data-use]');
await page.click('.modal [data-x="ok"]'); // deixa pendente
check('campo pendente vira marcador visível', (await page.inputValue('[data-sec] textarea >> nth=0')).includes('[PREENCHER: Grau]'));
await page.click('[data-step="4"]'); await page.waitForSelector('.paper');
check('revisão aponta o campo pendente como crítico', (await page.textContent('.alert.error')).includes('[PREENCHER: Grau]'));

await page.click('[data-step="1"]'); await page.click('[data-sec] [data-act="phrase"] >> nth=0');
await page.click('.phrase:has-text("Lama biliar") [data-use]'); await page.click('.modal [data-x="cancel"]');
const val = await page.inputValue('[data-sec] textarea >> nth=0');
check('cancelar o preenchimento não insere nada', (val.match(/Lama biliar/g) || []).length === 2, val);
check('sem erros de console', errors.length === 0, errors.join(' | '));
await browser.close();
const failed = results.filter(([, ok]) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} passaram`);
process.exit(failed ? 1 : 0);
