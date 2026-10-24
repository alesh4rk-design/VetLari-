// E2E do formato dos documentos (prévia, PDF e Word) no padrão dos laudos da veterinária.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdtempSync } from 'node:fs';
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
const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const tmp = mkdtempSync(join(tmpdir(), 'lay-'));

// Dois logotipos nas configurações
await page.goto(base + '#/config'); await page.waitForSelector('#s-logo');
await page.setInputFiles('#s-logo', join(here, '../fixture-rx.png')); await page.waitForSelector('[data-rmlogo="logo"]');
await page.setInputFiles('#s-logo2', join(here, '../fixture-rx.png')); await page.waitForSelector('[data-rmlogo="logo2"]');
check('dois logotipos configuráveis', true);

await page.goto(base + '#/novo'); await page.click('button:has-text("Começar laudo")');
await page.waitForSelector('#f-patient\\.name');
await page.fill('#f-patient\\.name', 'Paciente Formato'); await page.fill('#f-patient\\.species', 'Cão'); await page.selectOption('#f-sex', 'Macho');
await page.fill('#f-patient\\.tutor', 'Responsável Teste'); await page.fill('#f-clinic', 'Clínica Teste'); await page.fill('#f-requestingVet', 'Dra. Solicitante');
await page.fill('#f-patient\\.birthDate', '2025-10-10'); await page.fill('#f-date', '2026-10-10'); await page.fill('#f-time', '10:58');
await page.click('[data-step="1"]'); await page.click('.organ:has-text("Fígado")');
for (const [g, t] of [['Topografia', 'em topografia'], ['Dimensões', 'preservadas'], ['Contorno', 'contorno regular']]) await page.click(`.bgroup:has(.blabel:has-text("${g}")) .chip:has-text("${t}")`);
await page.click('.organ:has-text("Rins")'); await page.click('.bgroup:has(.blabel:has-text("Ureteres")) .chip');
await page.click('.bblock:has(.bhead:text-is("Rim esquerdo")) .bgroup:has(.blabel:has-text("Dimensões")) .chip');
await page.fill('.mrow:has-text("Rim esquerdo – comprimento") [data-mf="value"]', '4,13');
await page.click('[data-step="2"]');
await page.setInputFiles('#img-file', Array.from({ length: 5 }, () => join(here, '../fixture-usg.jpg')));
await page.waitForSelector('.imgcard >> nth=4');
check('o modelo abdominal já usa 4 imagens por linha', (await page.inputValue('#perrow')) === '4');
await page.click('[data-step="3"]'); await page.fill('#f-impression', 'Colite leve.\nDiscreta hepatomegalia.');
await page.click('[data-step="4"]'); await page.waitForSelector('.paper');

const paper = page.locator('.paper');
check('prévia: faixas Identificação, título, Impressão Diagnóstica e Imagens', (await paper.locator('.pbanner').allTextContents()).join('|') === 'Identificação|Relatório Ultrassonográfico Abdominal|Impressão Diagnóstica|Imagens');
check('prévia: identificação com os nomes dos laudos e hora', (await paper.locator('.pid').textContent()).includes('Responsável:') && (await paper.locator('.pid').textContent()).includes('Data: 10/10/2026 10:58') && (await paper.locator('.pid').textContent()).includes('Clínica/Hospital:'));
check('prévia: nome do órgão em negrito na mesma linha do texto', (await paper.locator('p.sub strong:text-is("Fígado")').count()) === 1 && (await paper.locator('p.sub:has(strong:text-is("Fígado"))').textContent()).startsWith('Fígado: em topografia habitual'));
check('prévia: lado do rim e "Ureteres" em negrito', (await paper.locator('strong:text-is("Rim esquerdo")').count()) === 1 && (await paper.locator('strong:text-is("Ureteres")').count()) === 1);
check('prévia: conclusão em lista e aviso fixo em itálico', (await paper.locator('ul.plist li').count()) === 2 && (await paper.locator('.pnote').count()) === 1);
check('prévia: 4 colunas de imagens e 2 logotipos', (await paper.locator('.pimgs').getAttribute('style')).includes('repeat(4') && (await paper.locator('.plogos img').count()) === 2);
check('prévia: sem asteriscos soltos (marcadores aplicados)', !(await paper.textContent()).includes('**') && !(await paper.textContent()).includes('__'));
check('rascunho: caixa avisa que não há assinatura', (await paper.locator('.psig').textContent()).includes('sem assinatura eletrônica'));

// Finaliza e exporta
await page.click('[data-act="final"]');
for (const c of await page.locator('.modal [data-ck]').all()) await c.check();
await page.fill('#just', 'Teste do formato.'); await page.click('.modal [data-x="ok"]');
await page.waitForSelector('text=Laudo finalizado: o conteúdo está protegido');
await page.click('[data-step="4"]'); await page.waitForSelector('.paper');
check('finalizado: assinatura centralizada com "Assinado eletronicamente" e código', (await page.locator('.psig-final').textContent()).includes('Assinado eletronicamente') && (await page.locator('.psig-final').textContent()).includes('Código identificador:'));
const [dp] = await Promise.all([page.waitForEvent('download'), page.click('[data-act="pdf"]')]); const pdf = join(tmp, 'l.pdf'); await dp.saveAs(pdf);
const txt = execFileSync('pdftotext', ['-layout', pdf, '-']).toString();
for (const t of ['Identificação', 'Paciente: Paciente Formato', 'Responsável:', 'Data: 10/10/2026 10:58', 'Relatório Ultrassonográfico Abdominal', 'Fígado: em topografia habitual', 'Rim esquerdo com dimensões preservadas (4,13 cm)', 'Ureteres sem alterações', 'Impressão Diagnóstica', '• Colite leve.', 'A interpretação do resultado deste exame', 'Imagens', 'Assinado eletronicamente', 'Código identificador:']) check(`PDF contém "${t}"`, txt.includes(t));
check('PDF: texto sem marcadores ** ou __', !txt.includes('**') && !txt.includes('__'));
check('PDF: logotipos e imagens embutidos (7 imagens + repetição dos logotipos)', Number(execFileSync('sh', ['-c', `pdfimages -list ${pdf} | tail -n +3 | wc -l`]).toString().trim()) >= 7);
const [dw] = await Promise.all([page.waitForEvent('download'), page.click('[data-act="docx"]')]); const docx = join(tmp, 'l.docx'); await dw.saveAs(docx);
const xml = execFileSync('unzip', ['-p', docx, 'word/document.xml']).toString();
for (const t of ['Identificação', 'Relatório Ultrassonográfico Abdominal', 'Impressão Diagnóstica', 'Imagens', 'Assinado eletronicamente']) check(`Word contém "${t}"`, xml.includes(t));
check('Word: justificado, com negrito e itálico e sem marcadores', xml.includes('w:jc w:val="both"') && xml.includes('<w:b/>') && !xml.includes('**') && !xml.includes('__'));
check('Word: faixas cinza (sombreado) e grade de imagens', xml.includes('w:fill="606060"') && xml.includes('w:fill="F0F0F0"'));
check('sem erros de console', errors.length === 0, errors.join(' | '));
await browser.close();
const failed = results.filter(([, ok]) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} passaram`);
process.exit(failed ? 1 : 0);
