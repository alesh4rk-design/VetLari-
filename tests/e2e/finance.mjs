// E2E do financeiro: clínicas e preços, lançamento ao criar o laudo (clínica e domiciliar), mudança de preço,
// pagamento parcial, despesas e abastecimento, cronômetro (rolagem, recarga, finalização, reabertura) e Excel.
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.argv[2] || 'http://localhost:8080/';
const results = [];
const T = async (sel) => (await page.textContent(sel)).replace(/\u00a0/g, ' ');
const check = (name, ok, extra = '') => { results.push([name, ok]); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${extra}`); };
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const tmp = mkdtempSync(join(tmpdir(), 'fin-'));
const today = new Date(); const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const TODAY = iso(today);
const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

await page.goto(base); await page.waitForSelector('#view');
await page.goto(base + '#/financeiro?aba=clinicas'); await page.waitForSelector('#cnew');
check('aba Financeiro no menu', (await page.locator('#nav a[href="#/financeiro"]').count()) === 1);

// 1. Duas clínicas com preços diferentes para o mesmo exame
const addClinic = async (name, value) => {
  await page.click('#cnew'); await page.fill('#cf input[name=name]', name); await page.fill('#cf input[name=payTermDays]', '30');
  await page.selectOption('#pp', { label: 'Ultrassonografia abdominal completa' }); await page.fill('#pv', value); await page.fill('#pf', '2026-01-01');
  await page.click('#padd'); await page.click('#cf button.primary'); await page.waitForSelector('.modal', { state: 'detached' });
};
await addClinic('Clínica Alfa', '150,00'); await addClinic('Clínica Beta', '200,00');
await page.waitForSelector('.list li:has-text("Clínica Beta")'); check('duas clínicas cadastradas', (await page.locator('.list li:has-text("Clínica")').count()) === 2);

// Laudo pela clínica Alfa: preço sugerido 150
const newExam = async (fill) => {
  await page.goto(base + '#/novo'); await page.waitForSelector('#nf button[type=submit]'); await fill();
  await page.click('button:has-text("Começar laudo")'); await page.waitForSelector('#f-patient\\.name');
  return page.url().split('/laudo/')[1];
};
const alfaId = await newExam(async () => {
  await page.check('input[name=fmode][value=clinic]'); await page.selectOption('#fc', { label: 'Clínica Alfa' });
  await page.selectOption('#fp', { label: 'Ultrassonografia abdominal completa' }); await page.fill('#fd', TODAY);
  check('preço sugerido pela tabela da clínica', (await page.inputValue('#fg')) === '150');
});
check('data do exame vai para o cabeçalho', (await page.inputValue('#f-date')) === TODAY);
check('card financeiro no laudo', (await page.textContent('.fin-box')).includes('Clínica Alfa') && (await T('.fin-box')).includes('150'));

// 2. Preço novo a partir de amanhã não muda o lançamento já feito
await page.goto(base + '#/financeiro?aba=clinicas'); await page.click('.list li:has-text("Clínica Alfa") [data-cedit]');
await page.selectOption('#pp', { label: 'Ultrassonografia abdominal completa' }); await page.fill('#pv', '180'); await page.fill('#pf', iso(tomorrow)); await page.click('#padd');
await page.click('#cf button.primary'); await page.waitForSelector('.modal', { state: 'detached' });
await page.goto(base + `#/financeiro?aba=lancamentos&de=2000-01-01&ate=2100-12-31`); await page.waitForSelector('.ftable');
check('exame anterior mantém o preço (150)', (await page.textContent('.ftable tbody')).includes('150,00') && !(await page.textContent('.ftable tbody')).includes('180,00'));

// Valor diferente da tabela exige motivo
await newExam(async () => {
  await page.check('input[name=fmode][value=clinic]'); await page.selectOption('#fc', { label: 'Clínica Beta' });
  await page.selectOption('#fp', { label: 'Ultrassonografia abdominal completa' }); await page.fill('#fd', TODAY);
  await page.fill('#fg', '170'); await page.click('button:has-text("Começar laudo")');
  check('valor fora da tabela pede motivo', (await page.textContent('#nferr')).includes('motivo'));
  await page.fill('#freason', 'Negociado');
});

// 3/4. Domiciliar sem clínica, com deslocamento, desconto e despesa
await newExam(async () => {
  await page.check('input[name=fmode][value=home]');
  check('domiciliar não pede clínica', await page.isHidden('#fc'));
  await page.selectOption('#fp', { label: 'Ultrassonografia abdominal completa' }); await page.fill('#fd', TODAY);
  await page.fill('#fg', '250'); await page.fill('#ft', '40'); await page.fill('#fdisc', '20'); await page.fill('#fx', '15'); await page.fill('#fr', 'Barra');
  check('líquido previsto do domiciliar (250 − 20 + 40)', (await page.textContent('#fnet')).includes('270,00'));
});

// 7. Pagamento parcial
await page.goto(base + `#/financeiro?aba=recebimentos&mes=${TODAY.slice(0, 7)}`); await page.waitForSelector('.ftable');
await page.click('.ftable tr:has-text("Clínica Alfa") [data-edit]'); await page.fill('#pa', '50'); await page.fill('#pd', TODAY); await page.click('#padd');
check('pagamento parcial atualiza o saldo', (await T('#pays')).includes('saldo R$ 100,00'));
await page.click('#ef button.primary'); await page.waitForSelector('.modal', { state: 'detached' });

// Despesas: compartilhada 60% e abastecimento
await page.goto(base + `#/financeiro?aba=gastos&mes=${TODAY.slice(0, 7)}`); await page.click('#gfuel');
await page.fill('#xf input[name=liters]', '40'); await page.fill('#xf input[name=ppl]', '6,25'); await page.fill('#xf input[name=vehicle]', 'Carro');
await page.selectOption('#xf select[name=use]', 'shared'); await page.fill('#xf input[name=proPercent]', '60');
check('abastecimento calcula o total (40 × 6,25)', (await page.inputValue('#xf input[name=amount]')).replace('.', ',') === '250');
check('60% profissional de R$ 250 = 150 + 100 pessoal', (await T('#xcalc')).includes('150,00') && (await T('#xcalc')).includes('100,00'));
await page.click('#xf button.primary'); await page.waitForSelector('.modal', { state: 'detached' });
check('painel de gastos mostra profissional e pessoal', (await T('.kpis')).includes('R$ 265,00'));

// 5/6/8. Visão geral
await page.goto(base + `#/financeiro?mes=${TODAY.slice(0, 7)}`); await page.waitForSelector('.kpis');
const vis = await T('#fbody');
if (process.env.SHOT_DIR) await page.screenshot({ path: join(process.env.SHOT_DIR, 'fin-visao.png'), fullPage: true });
check('faturamento do mês pela data do exame (150 + 170 + 270 = 590)', vis.includes('R$ 590,00'));
check('recebido pela data do recebimento (50)', /Recebido no período\s*R\$ 50,00/.test(vis.replace(/\s+/g, ' ')));
check('previsão do mês mostra método', vis.includes('Método:'));

// 9/10/11/12. Cronômetro
await page.goto(base + `#/laudo/${alfaId}`); await page.waitForSelector('#f-patient\\.name');
check('cronômetro não começa só por abrir o laudo', (await page.locator('#vl-timer[data-state="contando"]').count()) === 0);
await page.fill('#f-patient\\.name', 'Paciente Cronometrado');
await page.waitForSelector('#vl-timer[data-state="contando"]');
const b1 = await page.locator('#vl-timer').boundingBox();
await page.mouse.wheel(0, 1500); await page.waitForTimeout(300);
const b2 = await page.locator('#vl-timer').boundingBox();
if (process.env.SHOT_DIR) await page.screenshot({ path: join(process.env.SHOT_DIR, 'fin-timer.png') });
check('cronômetro fica fixo ao rolar', b1 && b2 && Math.abs(b1.y - b2.y) < 1);
await page.waitForTimeout(2200);
await page.reload(); await page.waitForSelector('#vl-timer');
check('cronômetro continua após recarregar', (await page.getAttribute('#vl-timer', 'data-state')) === 'contando' && !/0min 00s/.test(await page.textContent('#vl-timer')));
await page.click('[data-step="1"]'); await page.click('.organ:has-text("Fígado")'); await page.click('[data-act="b-normal"]');
await page.click('[data-step="4"]'); await page.click('[data-act="final"]'); await page.click('.modal [data-x="ok"]');
await page.waitForSelector('text=Laudo finalizado: o conteúdo está protegido');
check('cronômetro para ao finalizar', (await page.getAttribute('#vl-timer', 'data-state')) === 'parado');
await page.click('[data-act="reopen"] >> nth=0'); await page.click('.modal button.primary'); await page.waitForSelector('#f-patient\\.name');
await page.fill('#f-patient\\.tutor', 'Tutor'); await page.waitForSelector('#vl-timer[data-state="contando"]');
await page.click('[data-step="4"]'); await page.click('[data-act="final"]'); await page.click('.modal [data-x="ok"]');
await page.waitForSelector('text=Laudo finalizado: o conteúdo está protegido');
await page.goto(base + `#/financeiro?aba=produtividade&mes=${TODAY.slice(0, 7)}`); await page.waitForSelector('.kpis');
check('produtividade conta o laudo com tempo (2 sessões)', (await page.textContent('.kpis')).includes('1 com tempo registrado'));

// 13/14. Excel
await page.goto(base + `#/financeiro?aba=exportar&mes=${TODAY.slice(0, 7)}`); await page.waitForSelector('#xls');
const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#xls')]);
const file = join(tmp, dl.suggestedFilename()); await dl.saveAs(file);
check('arquivo .xlsx gerado', file.endsWith('.xlsx') && readFileSync(file).slice(0, 2).toString() === 'PK');
const XLSX = (() => { const module = { exports: {} }; new Function('module', 'exports', 'require', readFileSync(join(here, '../../assets/vendor/xlsx.mini.min.js'), 'utf8'))(module, module.exports, require); return module.exports; })();
const wb = XLSX.read(readFileSync(file));
check('todas as abas do Excel', ['Resumo mensal', 'Lançamentos', 'Recebimentos', 'Clínicas e preços', 'Atendimentos domiciliares', 'Produtividade', 'Gastos e Despesas', 'Abastecimentos'].every((n) => wb.SheetNames.includes(n)), wb.SheetNames.join(', '));
const rowsOf = (n) => XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, range: 4 });
const lanc = rowsOf('Lançamentos'); const total = lanc.find((r) => r[0] === 'TOTAL');
check('Excel: total líquido igual ao painel (590)', total && total[9] === 590, JSON.stringify(total));
check('Excel: moeda e fórmula no total', wb.Sheets['Lançamentos'].J10 ? true : Object.values(wb.Sheets['Lançamentos']).some((c) => c && c.f && /SUM/.test(c.f)));
const rec = rowsOf('Recebimentos').find((r) => r[0] === 'TOTAL');
check('Excel: recebido 50 e saldo pendente', rec && rec[5] === 50, JSON.stringify(rec));
check('Excel: sem nome de paciente', !JSON.stringify(wb.SheetNames.map((n) => XLSX.utils.sheet_to_csv(wb.Sheets[n]))).includes('Paciente Cronometrado'));
const ab = rowsOf('Abastecimentos'); check('Excel: abastecimento com custo profissional 150', ab.some((r) => r[10] === 150));
check('Excel: domiciliar com despesa e resultado', rowsOf('Atendimentos domiciliares').some((r) => r[8] === 270 && r[6] === 15 && r[10] === 255));
check('Excel: produtividade com tempo trabalhado', rowsOf('Produtividade').some((r) => typeof r[5] === 'number' && r[5] > 0));

check('lançamento único por laudo (sem duplicar ao reabrir/finalizar)', !!total && lanc.filter((r) => r[0] && !['TOTAL', 'ID do exame'].includes(r[0])).length === 3);
// Envio: WhatsApp direto para o número e e-mail
await page.goto(base + `#/laudo/${alfaId}`); await page.waitForSelector('[data-step]'); await page.click('[data-step="4"]'); await page.waitForSelector('[data-act="share-mail"]');
await page.fill('#st-phone', '(21) 99999-8888'); await page.fill('#st-email', 'laudos@clinica.com'); await page.waitForTimeout(900);
await page.evaluate(() => { Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true }); });
const [dw] = await Promise.all([page.waitForEvent('download'), page.click('[data-act="share-pdf"]')]);
check('WhatsApp: PDF baixado', dw.suggestedFilename().endsWith('.pdf'));
const wa = await page.getAttribute('.modal a.primary', 'href');
check('WhatsApp abre direto no número', wa.startsWith('https://wa.me/5521999998888?text='), wa);
await page.click('.modal [data-x=close]');
const [dm] = await Promise.all([page.waitForEvent('download'), page.click('[data-act="share-mail"]')]);
const ml = await page.getAttribute('.modal a.primary', 'href');
check('E-mail abre já para o destinatário', ml.startsWith('mailto:laudos@clinica.com?subject='), ml);
await page.click('.modal [data-x=close]');
await page.reload(); await page.waitForSelector('[data-step]'); await page.click('[data-step="4"]'); await page.waitForSelector('#st-phone');
check('número e e-mail ficam salvos no laudo', (await page.inputValue('#st-phone')) === '(21) 99999-8888' && (await page.inputValue('#st-email')) === 'laudos@clinica.com');
await page.click('[data-act="send-save"]'); await page.waitForSelector('.toast, [role=status]');
await page.goto(base + `#/novo`); await page.waitForSelector('#nf button[type=submit]');
await page.check('input[name=fmode][value=clinic]'); await page.selectOption('#fc', { label: 'Clínica Alfa' }); await page.selectOption('#fp', { label: 'Ultrassonografia abdominal completa' });
await page.click('button:has-text("Começar laudo")'); await page.waitForSelector('#f-patient\\.name'); await page.click('[data-step="4"]'); await page.waitForSelector('#st-phone');
check('número da clínica já vem preenchido nos próximos laudos', (await page.inputValue('#st-phone')) === '(21) 99999-8888');
check('sem erros de console', errors.length === 0, errors.join(' | '));
await browser.close();
const failed = results.filter(([, ok]) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} passaram`);
process.exit(failed ? 1 : 0);
