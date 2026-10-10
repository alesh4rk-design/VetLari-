// Teste de ponta a ponta no navegador (Playwright). Uso: node tests/e2e/smoke.mjs [url]
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const here = dirname(fileURLToPath(import.meta.url));
const base = process.argv[2] || 'http://localhost:8080/';
const results = [];
const check = (name, ok, extra = '') => { results.push([name, ok]); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${extra}`); };

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(base);
await page.waitForSelector('text=Painel de laudos');
check('dashboard carrega', true);

// Paciente
await page.goto(base + '#/paciente/novo');
await page.fill('#p-name', 'Thor Fictício');
await page.fill('#p-species', 'Canino'); await page.fill('#p-tutor', 'Tutor de Teste'); await page.fill('#p-weight', '12,5');
await page.click('button:has-text("Salvar paciente")');
await page.waitForSelector('text=Thor Fictício');
check('cadastro de paciente', true);

// Frase
await page.goto(base + '#/frases');
await page.click('button:has-text("Nova frase")');
await page.fill('#pf-title', 'Frase de teste'); await page.fill('#pf-text', 'Texto fictício de teste inserido.');
await page.click('#pf button[type=submit]');
await page.waitForSelector('text=Frase de teste');
check('criação de frase', true);

// Laudo USG
await page.goto(base + '#/novo');
await page.selectOption('#np', { label: 'Thor Fictício — Tutor de Teste' });
await page.click('button:has-text("Começar laudo")');
await page.waitForSelector('#f-patient\\.name');
check('paciente preenchido a partir do cadastro', (await page.inputValue('#f-patient\\.name')) === 'Thor Fictício');
await page.click('[data-step="1"]');
await page.fill('#d-' + await page.getAttribute('[data-sec] textarea', 'id').then((i) => i.slice(2)), 'Descrição inicial.');
await page.click('[data-sec] [data-act="phrase"] >> nth=0');
await page.click('.modal [data-use]');
const val = await page.inputValue('[data-sec] textarea >> nth=0');
check('frase inserida sem apagar texto existente', val.startsWith('Descrição inicial.') && val.includes('Texto fictício de teste inserido.'), JSON.stringify(val));

// Imagens
await page.click('[data-step="2"]');
await page.setInputFiles('#img-file', [join(here, '../fixture-usg.jpg'), join(here, '../fixture-rx.png')]);
await page.waitForSelector('.imgcard >> nth=1');
check('duas imagens adicionadas (JPEG e PNG)', (await page.locator('.imgcard').count()) === 2);
await page.fill('[data-imgf="caption"] >> nth=0', 'Primeira');
await page.click('[data-act="img-rotr"] >> nth=1');
await page.waitForTimeout(300);
await page.click('[data-act="img-down"] >> nth=0');
const firstCap = await page.inputValue('[data-imgf="caption"] >> nth=1');
check('reordenação de imagens', firstCap === 'Primeira');

// Conclusão e rascunho
await page.click('[data-step="3"]');
await page.fill('#f-impression', 'Impressão fictícia.');
await page.waitForSelector('#savestate.saved', { timeout: 5000 });
check('indicador "Salvo"', (await page.textContent('#savestate')).includes('Salvo'));
await page.reload();
await page.waitForSelector('#f-patient\\.name');
await page.click('[data-step="3"]');
check('rascunho recuperado após recarregar', (await page.inputValue('#f-impression')) === 'Impressão fictícia.');

// Exportação
await page.click('[data-step="4"]');
await page.waitForSelector('.paper');
const [dDocx] = await Promise.all([page.waitForEvent('download'), page.click('[data-act="docx"]')]);
const docxPath = join(mkdtempSync(join(tmpdir(), 'e2e-')), dDocx.suggestedFilename());
await dDocx.saveAs(docxPath);
check('nome do Word padronizado', /^Laudo_USG_Thor_Ficticio_\d{4}-\d{2}-\d{2}\.docx$/.test(dDocx.suggestedFilename()), dDocx.suggestedFilename());
const media = execFileSync('unzip', ['-l', docxPath]).toString().match(/word\/media\/\S+\.\w+/g) || [];
check('Word contém as 2 imagens', media.length === 2, String(media.length));
const [dPdf] = await Promise.all([page.waitForEvent('download'), page.click('[data-act="pdf"]')]);
const pdfPath = join(mkdtempSync(join(tmpdir(), 'e2e-')), dPdf.suggestedFilename());
await dPdf.saveAs(pdfPath);
const pdf = readFileSync(pdfPath);
check('PDF válido com imagens', pdf.slice(0, 5).toString() === '%PDF-' && pdf.length > 20000, String(pdf.length));

// Finalizar
await page.click('[data-act="final"]');
await page.click('.modal button.primary');
await page.waitForSelector('text=Laudo finalizado: o conteúdo está protegido');
check('finalização bloqueia edição', await page.isDisabled('#f-patient\\.name'));
await page.click('[data-step="4"]');
await page.click('[data-act="correct"]');
await page.waitForSelector('text=Rascunho local');
check('correção cria nova versão', (await page.textContent('h1')).includes('Rascunho'));
await page.goto(base + '#/laudos');
await page.waitForSelector('#exlist li');
const rows = await page.locator('#exlist li').count();
check('histórico mantém original e correção', rows === 2, String(rows));
await page.fill('#q', 'fictícia');
check('pesquisa por texto', (await page.locator('#exlist li').count()) === 2);
await page.fill('#q', 'inexistente-xyz');
check('pesquisa sem resultado', (await page.locator('#exlist li').count()) === 0);

// Backup
await page.goto(base + '#/config');
const [dBk] = await Promise.all([page.waitForEvent('download'), page.click('#bk')]);
const bkPath = join(mkdtempSync(join(tmpdir(), 'e2e-')), 'bk.json');
await dBk.saveAs(bkPath);
const bk = JSON.parse(readFileSync(bkPath, 'utf8'));
check('backup exportado', bk.app === 'vetlaudo' && bk.stores.exams.length === 2 && bk.stores.patients.length === 1);

// Celular
await page.setViewportSize({ width: 390, height: 800 });
await page.goto(base + '#/');
await page.waitForSelector('text=Painel de laudos');
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
check('sem rolagem horizontal no celular', !overflow);
await page.screenshot({ path: process.env.SHOT_DIR ? join(process.env.SHOT_DIR, 'mobile.png') : '/tmp/mobile.png' });

check('sem erros de console', errors.length === 0, errors.join(' | '));
await browser.close();
const failed = results.filter(([, ok]) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} passaram`);
process.exit(failed ? 1 : 0);
