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

// Status da estrutura e medidas com unidade
await page.selectOption('[data-sec] select[data-sf="status"] >> nth=0', 'alterado');
await page.click('[data-sec] [data-act="m-add"] >> nth=0');
await page.fill('[data-mf="label"]', 'Comprimento'); await page.fill('[data-mf="value"]', '5,2');
await page.click('[data-step="4"]');
await page.waitForSelector('.paper');
check('medida sem unidade gera alerta crítico', (await page.textContent('.alert.error')).includes('sem unidade'));
await page.click('[data-step="1"]');
await page.fill('[data-mf="unit"]', 'cm');
await page.click('[data-step="4"]');
await page.waitForSelector('.paper');
const prev = await page.textContent('.paper');
check('prévia mostra status e medida com unidade', prev.includes('Fígado — Alterado') && prev.includes('Comprimento: 5,2 cm'), JSON.stringify(prev.replace(/\s+/g, ' ').slice(0, 600)));
check('prévia de rascunho vem marcada', prev.includes('RASCUNHO'));
check('estruturas não preenchidas não aparecem como normais', !/Baço/.test(prev) && !/normal/i.test(prev));

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
check('Word de rascunho vem marcado', execFileSync('unzip', ['-p', docxPath, 'word/document.xml']).toString().includes('RASCUNHO'));
const [dPdf] = await Promise.all([page.waitForEvent('download'), page.click('[data-act="pdf"]')]);
const pdfPath = join(mkdtempSync(join(tmpdir(), 'e2e-')), dPdf.suggestedFilename());
await dPdf.saveAs(pdfPath);
const pdf = readFileSync(pdfPath);
check('PDF válido com imagens', pdf.slice(0, 5).toString() === '%PDF-' && pdf.length > 20000, String(pdf.length));

// Preliminar e finalização com checklist
await page.click('[data-act="prelim"]');
await page.waitForSelector('text=Preliminar');
check('marcar como preliminar', (await page.textContent('.paper')).includes('PRELIMINAR'));
await page.click('[data-act="final"]');
check('finalizar exige confirmação do checklist', await page.isDisabled('.modal [data-x="ok"]'));
for (const c of await page.locator('.modal [data-ck]').all()) await c.check();
check('pendência crítica (CRMV ausente) exige justificativa', await page.isDisabled('.modal [data-x="ok"]'));
await page.fill('#just', 'Teste: CRMV será preenchido depois.');
await page.click('.modal [data-x="ok"]');
await page.waitForSelector('text=Laudo finalizado: o conteúdo está protegido');
check('finalização bloqueia edição', await page.isDisabled('#f-patient\\.name'));
await page.click('[data-step="4"]');
await page.click('details summary');
const histTxt = await page.textContent('details');
check('histórico do laudo mostra finalização com justificativa', histTxt.includes('Laudo finalizado') && histTxt.includes('CRMV será preenchido'));
await page.click('[data-act="revise"][data-kind="correction"]');
await page.fill('#rj', 'Correção de teste');
await page.click('.modal [data-x="ok"]');
await page.waitForSelector('text=Retificação');
check('retificação cria nova versão', (await page.textContent('h1')).includes('v2'));
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

// Perfis: auxiliar não finaliza
await page.goto(base + '#/perfis');
await page.waitForSelector('text=Quem está usando?');
await page.fill('#np-name', 'Auxiliar Teste'); await page.selectOption('#np-role', 'assistant');
await page.click('#np button[type=submit]');
await page.waitForSelector('text=Painel de laudos');
await page.goto(base + '#/novo'); await page.click('button:has-text("Começar laudo")');
await page.waitForSelector('#f-patient\\.name');
await page.click('[data-step="4"]');
await page.waitForSelector('.paper');
check('perfil auxiliar não pode finalizar', await page.isDisabled('[data-act="final"]'));
check('dados do perfil são separados (laudos do outro perfil não aparecem)', (await page.evaluate(() => new Promise((res) => { const r = indexedDB.open('vetlaudo'); r.onsuccess = () => res(true); }))) === true);
await page.goto(base + '#/laudos');
await page.waitForSelector('#exlist');
check('perfil novo começa sem laudos do outro perfil', (await page.locator('#exlist li').count()) === 1);

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
