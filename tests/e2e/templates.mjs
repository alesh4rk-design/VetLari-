// E2E: a veterinária edita as frases de um órgão em "Meus modelos" e o novo texto aparece no laudo.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.argv[2] || 'http://localhost:8080/';
const results = [];
const check = (name, ok, extra = '') => { results.push([name, ok]); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${extra}`); };
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(base + '#/modelos');
check('modelo inicial não é editável diretamente (só duplicar)', (await page.locator('.list li:has-text("abdominal completa") a:has-text("Editar")').count()) === 0);
await page.click('.list li:has-text("abdominal completa") [data-act="dup"]');
await page.waitForSelector('#tf');
const fig = page.locator('.sec[data-s]:has(input[value="Fígado"])');
await fig.locator('summary').click();
const ta = fig.locator('.field[data-gi]:has(input[value="Dimensões"]) textarea');
const before = await ta.inputValue();
await ta.fill(before + '\nacentuadamente aumentadas :: com dimensões acentuadamente aumentadas');
// novo grupo e nova opção
await fig.locator('[data-act="gadd"]').click();
await fig.locator('summary').isVisible();
const lastGroup = fig.locator('.field[data-gi]').last();
await lastGroup.locator('[data-gl]').fill('Observação do fígado');
await lastGroup.locator('[data-gk]').selectOption('sentences');
await lastGroup.locator('[data-go]').fill('Presença de nódulo hiperecogênico medindo {Nódulo}');
await page.fill('#t-name', 'Meu abdominal (teste)');
await page.click('#tf button[type=submit]');
await page.waitForSelector('text=Meu abdominal (teste)');
check('modelo duplicado e salvo', true);

await page.goto(base + '#/novo');
await page.selectOption('#nt', { label: 'Meu abdominal (teste)' });
await page.click('button:has-text("Começar laudo")');
await page.waitForSelector('#f-patient\\.name'); await page.fill('#f-patient\\.name', 'Paciente Modelo');
await page.click('[data-step="1"]'); await page.click('.organ:has-text("Fígado")');
check('opção nova aparece como botão curto', await page.isVisible('.bgroup:has(.blabel:has-text("Dimensões")) .chip:has-text("acentuadamente aumentadas")'));
await page.click('.bgroup:has(.blabel:has-text("Dimensões")) .chip:has-text("acentuadamente aumentadas")');
check('texto usa a frase completa da opção nova', (await page.inputValue('[data-sf="description"]')) === 'com dimensões acentuadamente aumentadas.');
await page.click('.bgroup:has(.blabel:has-text("Observação do fígado")) .chip');
check('campo novo pede digitação', await page.isVisible('[data-bx="Nódulo"]'));
await page.fill('[data-bx="Nódulo"]', '1,2 cm');
check('grupo novo vira frase separada com o valor digitado', (await page.inputValue('[data-sf="description"]')) === 'com dimensões acentuadamente aumentadas. Presença de nódulo hiperecogênico medindo 1,2 cm.', await page.inputValue('[data-sf="description"]'));
check('sem erros de console', errors.length === 0, errors.join(' | '));
await browser.close();
const failed = results.filter(([, ok]) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} passaram`);
process.exit(failed ? 1 : 0);
