// E2E: "Guardar esta frase" também nos campos da etapa Paciente (Pergunta clínica, Histórico, Medicamentos...) e na conclusão.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.argv[2] || 'http://localhost:8080/';
const results = [];
const check = (name, ok, extra = '') => { results.push([name, ok]); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${extra}`); };
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const lib = () => page.evaluate(() => new Promise((res) => {
  const r = indexedDB.open('vetlaudo');
  r.onsuccess = () => { const q = r.result.transaction('phrases').objectStore('phrases').getAll(); q.onsuccess = () => res(q.result.filter((p) => p.source === 'minha').map((p) => ({ t: p.text, s: p.structure, c: p.category }))); };
}));
const novo = async (n) => { await page.goto(base + '#/novo'); await page.waitForSelector('#nf button[type=submit]'); await page.evaluate(() => { const r = document.querySelector('input[name="fmode"][value="none"]'); if (r) r.checked = true; }); await page.click('button:has-text("Começar laudo")'); await page.waitForSelector('#f-patient\\.name'); await page.fill('#f-patient\\.name', n); };
const save = (bind) => page.click(`[data-act="save-phrase"][data-target="f-${bind}"]`);
const insert = (bind) => page.click(`[data-act="phrase"][data-target="f-${bind}"]`);

await novo('Paciente Campos');
const campos = ['clinical.indication', 'clinical.question', 'clinical.history', 'clinical.medications', 'clinical.limitations'];
for (const c of campos) check(`campo ${c}: tem Inserir, Ditar e Guardar`, (await page.locator(`[data-target="f-${c}"]`).count()) === 3);
await save('clinical.question');
check('campo vazio: avisa e não abre janela', (await page.locator('.modal').count()) === 0 && (await page.textContent('#toasts')).includes('Escreva o texto'));
await page.fill('[id="f-clinical.question"]', 'Avaliar a função renal.');
await save('clinical.question');
check('janela diz em qual campo a frase vai aparecer', (await page.textContent('.modal')).includes('Pergunta clínica'));
await page.fill('#sv-title', 'Avaliar rins'); await page.click('#sf button[type=submit]');
await page.waitForFunction(() => document.querySelector('#toasts')?.textContent.includes('Frase guardada'));
await page.fill('[id="f-clinical.history"]', 'Vômitos há dois dias.');
await save('clinical.history'); await page.fill('#sv-title', 'Vômitos'); await page.click('#sf button[type=submit]');
await page.waitForFunction(() => (document.querySelector('#toasts')?.textContent.match(/Frase guardada/g) || []).length >= 2);
const guardadas = await lib();
check('frases ligadas aos seus campos', guardadas.some((g) => g.s === 'Pergunta clínica' && g.t === 'Avaliar a função renal.') && guardadas.some((g) => g.s === 'Histórico relevante' && g.t === 'Vômitos há dois dias.'), JSON.stringify(guardadas));

// Próximo laudo: cada campo mostra as suas frases
await novo('Paciente Dois');
await insert('clinical.question');
let m = await page.textContent('.modal');
check('Pergunta clínica mostra a frase guardada para ela', m.includes('Avaliar a função renal.'));
check('Pergunta clínica não mostra a frase do Histórico', !m.includes('Vômitos há dois dias.'));
check('nem as frases de conclusão dos órgãos', !m.includes('Colite leve'));
await page.click('.phrase:has-text("Avaliar rins") [data-use]');
check('inserida no campo certo', (await page.inputValue('[id="f-clinical.question"]')) === 'Avaliar a função renal.');
await insert('clinical.history');
m = await page.textContent('.modal');
check('Histórico mostra a sua frase e não a da Pergunta', m.includes('Vômitos há dois dias.') && !m.includes('Avaliar a função renal.'));
await page.click('.modal [data-x="close"]');
await insert('clinical.medications');
check('Medicamentos (nenhuma guardada): mostra a biblioteca vazia para o campo', (await page.textContent('.modal')).includes('Sua biblioteca está vazia') || !(await page.textContent('.modal')).includes('Avaliar a função renal.'));
await page.click('.modal [data-x="close"]');

// Conclusão: guardar e reaparecer
await page.click('[data-step="3"]'); await page.fill('[id="f-impression"]', 'Impressão de teste guardada.');
await save('impression'); await page.fill('#sv-title', 'Impressão teste'); await page.click('#sf button[type=submit]');
await page.waitForFunction(() => (document.querySelector('#toasts')?.textContent.match(/Frase guardada/g) || []).length >= 3);
const g2 = await lib();
check('conclusão guardada na categoria Impressão diagnóstica', g2.some((g) => g.t === 'Impressão de teste guardada.' && g.c === 'Impressão diagnóstica' && g.s === 'Impressão Diagnóstica'));
await page.fill('[id="f-impression"]', '');
await insert('impression');
check('na conclusão, a frase guardada aparece junto das demais', (await page.textContent('.modal')).includes('Impressão de teste guardada.') && (await page.textContent('.modal')).includes('Colite leve'));
await page.click('.modal [data-x="close"]');

// Frases de órgão não aparecem nesses campos e vice-versa
await page.click('[data-step="1"]'); await page.click('.organ:has-text("Fígado")'); await page.click('[data-sec] [data-act="phrase"]');
const org = await page.textContent('.modal');
check('no órgão, as frases dos campos clínicos não aparecem', !org.includes('Avaliar a função renal.') && !org.includes('Vômitos há dois dias.'));
check('sem erros de console', errors.length === 0, errors.join(' | '));
await browser.close();
const failed = results.filter(([, ok]) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} passaram`);
process.exit(failed ? 1 : 0);
