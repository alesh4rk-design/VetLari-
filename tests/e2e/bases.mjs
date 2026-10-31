// E2E das bases técnicas: referências aprovadas pela veterinária e cálculos definidos por ela.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.argv[2] || 'http://localhost:8080/';
const results = [];
const check = (name, ok, extra = '') => { results.push([name, ok]); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${extra}`); };

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

// Referência: cadastro → rascunho → aprovação
await page.goto(base + '#/referencias');
await page.click('button:has-text("Nova referência")');
await page.fill('#r-title', 'Referência fictícia de teste'); await page.fill('#r-citation', 'Autor Fictício (2024)'); await page.fill('#r-doi', '10.0000/fake');
await page.fill('#r-species', 'Canino'); await page.fill('#r-structure', 'Fígado'); await page.fill('#r-measureLabel', 'Comprimento');
await page.fill('#r-unit', 'cm'); await page.fill('#r-min', '4'); await page.fill('#r-max', '6'); await page.fill('#r-revisionDate', '2025-06-01');
await page.click('#rf button[type=submit]');
await page.waitForSelector('text=Referência fictícia de teste');
check('referência nasce como rascunho', (await page.textContent('#rlist')).includes('Rascunho'));
await page.click('[data-act="approve"]'); await page.click('.modal button.primary');
await page.waitForSelector('#rlist .badge.final');
check('referência aprovada pela veterinária', (await page.textContent('#rlist')).includes('Aprovada'));

// Cálculo
await page.goto(base + '#/calculos');
await page.click('button:has-text("Novo cálculo")');
await page.fill('#c-name', 'Volume de teste'); await page.fill('#c-res', 'Volume'); await page.fill('#c-ru', 'cm³'); await page.fill('#c-f', '(L*W*H)*0.5');
await page.click('[data-x="detect"]');
const labels = ['Comprimento', 'Largura', 'Altura'];
for (let i = 0; i < 3; i++) { await page.fill(`[data-v="${i}"][data-k="label"]`, labels[i]); await page.fill(`[data-v="${i}"][data-k="unit"]`, 'cm'); }
await page.click('[data-x="save"]');
await page.waitForSelector('text=Volume de teste');
check('cálculo cadastrado', true);
await page.goto(base + '#/calculos'); await page.click('button:has-text("Novo cálculo")');
await page.fill('#c-name', 'Inválido'); await page.fill('#c-res', 'R'); await page.fill('#c-ru', 'cm'); await page.fill('#c-f', 'A+');
await page.click('[data-x="save"]');
check('fórmula inválida é recusada', (await page.textContent('#cerr')).length > 0);
await page.click('.modal [data-x="cancel"]');

// Laudo usando referência e cálculo
await page.goto(base + '#/novo'); await page.waitForSelector('#nf button[type=submit]'); await page.evaluate(() => { const r = document.querySelector('input[name="fmode"][value="none"]'); if (r) r.checked = true; }); await page.click('button:has-text("Começar laudo")');
await page.waitForSelector('#f-patient\\.name');
await page.fill('#f-patient\\.name', 'Paciente Bases'); await page.fill('#f-patient\\.species', 'Canino');
await page.click('[data-step="1"]');
await page.click('.organ:has-text("Fígado")');
await page.click('[data-sec] [data-act="m-add"] >> nth=0');
await page.fill('[data-mf="label"]', 'Comprimento'); await page.fill('[data-mf="value"]', '7'); await page.fill('[data-mf="unit"]', 'cm');
await page.click('[data-sec] [data-act="m-refs"] >> nth=0');
const refsTxt = await page.textContent('.modal');
check('"Ver referências" mostra a fonte e a posição sem juízo clínico', refsTxt.includes('Referência fictícia de teste') && refsTxt.includes('acima do máximo publicado') && refsTxt.includes('interpretação clínica é sua'));
await page.click('.modal [data-x="close"]');
await page.click('[data-step="4"]'); await page.waitForSelector('.paper');
check('alerta informativo de posição frente à referência', (await page.textContent('.alert.warn')).includes('acima do máximo'));
check('o alerta não chama o valor de normal/anormal', !/anormal|\bnormal\b/i.test(await page.textContent('.alert.warn')));

await page.click('[data-step="0"]'); await page.fill('#f-patient\\.species', 'Felino');
await page.click('[data-step="1"]'); await page.click('[data-sec] [data-act="m-refs"] >> nth=0');
check('outra espécie: nenhuma referência é aplicada', (await page.textContent('.modal')).includes('Nenhuma referência aprovada'));
await page.click('.modal [data-x="close"]');

// Calculadora no laudo
await page.click('[data-sec] [data-act="m-add"] >> nth=0');
await page.fill('[data-mf="label"] >> nth=1', 'Largura'); await page.fill('[data-mf="value"] >> nth=1', '2'); await page.fill('[data-mf="unit"] >> nth=1', 'cm');
await page.click('[data-sec] [data-act="m-add"] >> nth=0');
await page.fill('[data-mf="label"] >> nth=2', 'Altura'); await page.fill('[data-mf="value"] >> nth=2', '2'); await page.fill('[data-mf="unit"] >> nth=2', 'cm');
await page.click('[data-sec] [data-act="m-calc"] >> nth=0');
await page.fill('[data-var="L"]', '7');
await page.click('.modal [data-x="calc"]');
await page.waitForSelector('.modal .alert.info');
check('resultado calculado (7×2×2×0,5 = 14,00)', (await page.textContent('.modal .alert.info')).includes('14,00'));
await page.click('.modal [data-x="add"]');
await page.waitForSelector('text=Calculado: Volume de teste');
check('medida calculada entra bloqueada para edição', await page.isDisabled('[data-mf="value"] >> nth=3'));
await page.click('[data-step="4"]'); await page.waitForSelector('.paper');
check('laudo identifica a medida calculada', (await page.textContent('.paper')).includes('Volume: 14,00 cm³ (calculado: Volume de teste)'));
// Unidade errada
await page.click('[data-step="1"]');
await page.click('[data-sec] [data-act="m-calc"] >> nth=0');
await page.fill('[data-var="L"]', '7'); await page.fill('[data-var="W"]', '2'); await page.fill('[data-var="H"]', '2');
await page.click('.modal [data-x="cancel"]');

check('sem erros de console', errors.length === 0, errors.join(' | '));
await browser.close();
const failed = results.filter(([, ok]) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} passaram`);
process.exit(failed ? 1 : 0);
