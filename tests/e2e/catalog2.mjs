// E2E: novas frases (testículos por lado com campos digitados) e atualização do catálogo de impressões por versão.
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
const phrases = () => page.evaluate(() => new Promise((res) => { const r = indexedDB.open('vetlaudo'); r.onsuccess = () => { const q = r.result.transaction('phrases').objectStore('phrases').getAll(); q.onsuccess = () => res(q.result.map((p) => p.text)); }; }));

await page.goto(base + '#/frases'); await page.waitForSelector('text=Biblioteca de frases');
await page.waitForFunction(() => document.body.textContent.includes('Colite leve'));
let all = await phrases();
check('perfil novo recebe as impressões dos laudos (inclui as novas)', all.includes('Colite leve.') && all.includes('Testículo direito ectópico.') && all.includes('Exame sem alterações relevantes dignas de nota.'), String(all.length));

// Simula perfil antigo (só versão 1): apaga uma frase nova e uma antiga; a atualização traz só a nova
await page.evaluate(() => new Promise((res) => { const r = indexedDB.open('vetlaudo'); r.onsuccess = () => { const db = r.result; const tx = db.transaction(['phrases', 'settings'], 'readwrite');
  const st = tx.objectStore('phrases'); const q = st.getAll(); q.onsuccess = () => { for (const p of q.result) if (p.text === 'Testículo direito ectópico.' || p.text === 'Colite leve.') st.delete(p.id); };
  tx.objectStore('settings').put({ key: 'impressions-seed-version', value: 1 }); tx.oncomplete = () => res(); }; }));
await page.reload(); await page.waitForSelector('text=Biblioteca de frases'); await page.waitForTimeout(500);
await page.goto(base + '#/'); await page.waitForSelector('text=Painel de laudos'); await page.waitForTimeout(500);
all = await phrases();
check('atualização por versão não recria o que ela já excluiu (versão 1)', !all.includes('Colite leve.'));
check('atualização por versão não repõe frases que o perfil já tinha nem duplica', all.filter((t) => t === 'Enteropatia.').length === 1);

// Testículos por lado com campos digitados e ectópico
await page.goto(base + '#/novo'); await page.waitForSelector('#nf button[type=submit]'); await page.evaluate(() => { const r = document.querySelector('input[name="fmode"][value="none"]'); if (r) r.checked = true; }); await page.click('button:has-text("Começar laudo")');
await page.waitForSelector('#f-patient\\.name'); await page.fill('#f-patient\\.name', 'Paciente Catálogo'); await page.selectOption('#f-sex', 'Macho');
await page.click('[data-step="1"]'); await page.click('.organ:has-text("Testículos")');
const chipIn = (blk, g, t) => page.click(`.bblock:has(.bhead:text-is("${blk}")) .bgroup:has(.blabel:has-text("${g}")) .chip:has-text("${t}")`);
await chipIn('Testículo esquerdo', 'Localização', 'em bolsa'); await chipIn('Testículo esquerdo', 'Medida', 'com medidas'); await chipIn('Testículo esquerdo', 'Aspecto', 'habituais');
await chipIn('Testículo direito', 'Localização', 'subcutâneo'); await chipIn('Testículo direito', 'Medida', 'com medidas'); await chipIn('Testículo direito', 'Aspecto', 'diminuídas');
check('um campo para digitar a medida de cada lado', (await page.locator('[data-bx*="Medidas do testículo"]').count()) === 2);
await page.fill('[data-bx="Testículo esquerdo – Medidas do testículo"]', '2,01 x 1,49 cm');
await page.fill('[data-bx="Testículo direito – Medidas do testículo"]', '1,41 x 0,55 cm');
const d = await page.inputValue('[data-sf="description"]');
check('testículos: texto por lado com as medidas de cada um', d === '**Testículo esquerdo** localizado em bolsa escrotal, medindo aprox. 2,01 x 1,49 cm, apresentando contorno regular, ecotextura e ecogenicidade habituais. **Testículo direito** localizado em subcutâneo de região inguinal direita, medindo aprox. 1,41 x 0,55 cm, apresentando contorno regular, ecotextura homogênea, ecogenicidade diminuída e dimensões diminuídas em relação ao testículo contralateral.', d);

// Estruturas novas no modelo: tecido mamário só para fêmeas
const nomes = await page.locator('.organ .oname').allTextContents();
check('macho: não mostra tecido mamário', !nomes.includes('Tecido mamário'));
await page.click('[data-step="0"]'); await page.selectOption('#f-sex', 'Fêmea'); await page.click('[data-step="1"]');
const nomesF = await page.locator('.organ .oname').allTextContents();
check('fêmea: mostra tecido mamário, útero e ovários', ['Tecido mamário', 'Útero', 'Ovários'].every((x) => nomesF.includes(x)));
await page.click('.organ:has-text("Útero")'); await page.click('.bgroup:has(.blabel:has-text("Descrição")) .chip:has-text("não caracterizados")');
check('útero/ovários não caracterizados (OSH)', (await page.inputValue('[data-sf="description"]')) === 'Útero e ovários não caracterizados (paciente com histórico de OSH).');
check('sem erros de console', errors.length === 0, errors.join(' | '));
await browser.close();
const failed = results.filter(([, ok]) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} passaram`);
process.exit(failed ? 1 : 0);
