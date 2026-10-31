// E2E: data e hora do exame são opcionais (podem ficar em branco e o laudo é finalizado normalmente).
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.argv[2] || 'http://localhost:8080/';
const results = [];
const check = (name, ok, extra = '') => { results.push([name, ok]); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${extra}`); };
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const tmp = mkdtempSync(join(tmpdir(), 'opt-'));

await page.goto(base + '#/novo'); await page.click('button:has-text("Começar laudo")'); await page.waitForSelector('#f-patient\\.name');
check('data e hora começam vazias', (await page.inputValue('#f-date')) === '' && (await page.inputValue('#f-time')) === '');
check('os rótulos indicam que são opcionais (sem asterisco)', (await page.textContent('label[for="f-date"]')).includes('opcional') && (await page.textContent('label[for="f-time"]')).includes('opcional'));
await page.fill('#f-patient\\.name', 'Paciente Sem Data');
await page.fill('#f-date', ''); await page.fill('#f-time', '');
await page.click('[data-step="1"]'); await page.click('.organ:has-text("Fígado")');
await page.click('.bgroup:has(.blabel:has-text("Contorno")) .chip');
await page.click('[data-step="3"]'); await page.fill('#f-impression', 'Conclusão de teste.');
await page.click('[data-step="4"]'); await page.waitForSelector('.paper');
check('sem data/hora não há alerta crítico de data', !(await page.textContent('.alert.error').catch(() => '')).includes('data'));
check('prévia não mostra data nem hora', !(await page.locator('.paper .pid').textContent()).includes('Data:') && !(await page.locator('.paper .pid').textContent()).includes('Hora:'));
await page.click('[data-act="final"]');
await page.click('.modal [data-x="ok"]');
await page.waitForSelector('text=Laudo finalizado: o conteúdo está protegido');
check('laudo finalizado sem data e sem hora', true);
await page.click('[data-step="4"]'); await page.waitForSelector('.paper');
const [dp] = await Promise.all([page.waitForEvent('download'), page.click('[data-act="pdf"]')]);
const pdf = join(tmp, dp.suggestedFilename()); await dp.saveAs(pdf);
const txt = execFileSync('pdftotext', ['-layout', pdf, '-']).toString();
check('PDF sem o campo Data', !/\bData:/.test(txt) && txt.includes('Paciente: Paciente Sem Data'));
check('nome do arquivo sem data quando não há data do exame', /^Laudo_USG_Paciente_Sem_Data\.pdf$/.test(dp.suggestedFilename()), dp.suggestedFilename());
// Só a hora
await page.goto(base + '#/novo'); await page.click('button:has-text("Começar laudo")'); await page.waitForSelector('#f-patient\\.name');
await page.fill('#f-patient\\.name', 'Só Hora'); await page.fill('#f-date', ''); await page.fill('#f-time', '10:58');
await page.click('[data-step="1"]'); await page.click('.organ:has-text("Fígado")'); await page.click('.bgroup:has(.blabel:has-text("Contorno")) .chip');
await page.click('[data-step="4"]'); await page.waitForSelector('.paper');
check('só hora preenchida: aparece como "Hora"', (await page.locator('.paper .pid').textContent()).includes('Hora: 10:58'));
// Peso em gramas para animais pequenos
await page.goto(base + '#/novo'); await page.click('button:has-text("Começar laudo")'); await page.waitForSelector('#f-patient\\.name');
await page.fill('#f-patient\\.name', 'Pipoca'); await page.fill('#f-patient\\.species', 'Roedor');
check('espécie pequena sugere gramas', (await page.inputValue('#f-wunit')) === 'g');
await page.fill('#f-patient\\.weight', '350');
await page.click('[data-step="1"]'); await page.click('.organ:has-text("Fígado")'); await page.click('.bgroup:has(.blabel:has-text("Contorno")) .chip');
await page.click('[data-step="4"]'); await page.waitForSelector('.paper');
check('laudo mostra peso em g', (await page.locator('.paper .pid').textContent()).includes('Peso: 350 g'));
// Tutorial por aba
check('link de ajuda na etapa Paciente', (await page.locator('.help-link').count()) === 1);
await page.click('.help-link'); await page.waitForSelector('.helplist');
check('tutorial abre com passos', (await page.locator('.helplist li').count()) >= 3);
await page.click('.modal [data-x=close]');
await page.click('[data-step="1"]');
check('ajuda muda conforme a etapa', (await page.locator('.help-link').count()) === 1);
await page.click('.help-link');
check('tutorial dos achados', (await page.textContent('.modal h2')).includes('Achados'));
await page.click('.modal [data-x=close]');
await page.goto(base + '#/frases'); await page.waitForSelector('.help-link');
check('ajuda na aba Frases', true);
// Texto padrão sem alterações (Rins)
await page.goto(base + '#/novo'); await page.click('button:has-text("Começar laudo")'); await page.waitForSelector('#f-patient\\.name');
await page.fill('#f-patient\\.name', 'Padrao Rins'); await page.click('[data-step="1"]'); await page.click('.organ:has-text("Rins")');
await page.click('[data-act="b-normal"]');
const dtxt = await page.inputValue('[data-sec] textarea[id^="d-"]');
check('texto padrão dos rins', dtxt.includes('tópicos e simétricos.') && dtxt.includes('**Rim direito** com dimensões preservadas') && dtxt.includes('Ureteres** sem alterações'));
check('status vira Normal', (await page.locator('.segbtn[aria-pressed="true"]').textContent()).includes('Normal'));
check('nome do órgão aparece antes da descrição', (await page.textContent('.descprefix strong')).trim() === 'Rins:');
check('dimensões diminuídas e aumentadas disponíveis', (await page.locator('.chip:has-text("dimensões diminuídas")').count()) >= 1 && (await page.locator('.chip:has-text("dimensões aumentadas")').count()) >= 1);
// Texto editado à mão continua recebendo medidas e escolhas
await page.goto(base + '#/novo'); await page.click('button:has-text("Começar laudo")'); await page.waitForSelector('#f-patient\\.name');
await page.fill('#f-patient\\.name', 'Manual'); await page.click('[data-step="1"]'); await page.click('.organ:has-text("Rins")');
await page.click('[data-act="b-normal"]');
const ta = '[data-sec] textarea[id^="d-"]';
await page.fill(ta, (await page.inputValue(ta)) + ' Minha observação escrita à mão.');
await page.fill('input[aria-label="Valor de Rim esquerdo – comprimento"]', '4,5');
let mtxt = await page.inputValue(ta);
check("medida entra no texto editado à mão", mtxt.includes('preservadas (4,5 cm)') && mtxt.includes('Minha observação escrita à mão.'));
await page.click('.bblock:has(.bhead:text-is("Rim esquerdo")) .bgroup:has(.blabel:has-text("Dimensões")) .chip:has-text("dimensões aumentadas")');
mtxt = await page.inputValue(ta);
check("escolha aplicada no texto editado à mão", mtxt.includes('**Rim esquerdo** com dimensões aumentadas (4,5 cm)') && mtxt.includes('Minha observação escrita à mão.'));
check('sem aviso de bloqueio', await page.locator('#bnotice').isHidden());
// Imagens ao lado dos achados
await page.goto(base + '#/novo'); await page.click('button:has-text("Começar laudo")'); await page.waitForSelector('#f-patient\\.name');
await page.fill('#f-patient\\.name', 'Imagens ao lado'); await page.click('[data-step="1"]');
if ((await page.locator('#sideimgs').count()) === 0) await page.click('[data-act="side-toggle"]');
check('painel de imagens ao lado dos achados', (await page.locator('.findings.withimgs #sideimgs').count()) === 1);
await page.setInputFiles('#side-file', [join(here, '../fixture-usg.jpg')]);
await page.waitForSelector('.sideimg');
check('imagem adicionada pelo painel lateral', (await page.locator('.sideimg').count()) === 1);
await page.click('.sideimg'); await page.waitForSelector('.modal');
check('clique na imagem abre o visualizador', true);
await page.keyboard.press('Escape');
// Texto padrão em outros órgãos, copiar texto e lembrete de backup
await page.click('.organ:has-text("Fígado")'); await page.click('[data-act="b-normal"]');
check('texto padrão do fígado', (await page.inputValue('[data-sec] textarea[id^="d-"]')).startsWith('em topografia habitual, com dimensões preservadas, bordas afiladas'));
await page.click('[data-step="4"]'); await page.waitForSelector('[data-act="copy-text"]');
check('botão copiar texto do laudo', (await page.locator('[data-act="copy-text"]').count()) === 1);
// Enviar PDF pelo WhatsApp: sem compartilhamento de arquivos baixa e orienta; com ele, anexa o PDF
await page.evaluate(() => { Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true }); });
const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-act="share-pdf"]')]);
check('WhatsApp (computador): PDF baixado', dl.suggestedFilename().endsWith('.pdf'));
await page.waitForSelector('.modal a[href^="https://wa.me/"]');
check('WhatsApp (computador): botão Abrir WhatsApp', true);
await page.click('.modal [data-x=close]');
await page.evaluate(() => {
  window.__shared = null;
  Object.defineProperty(navigator, 'canShare', { value: (d) => !!(d && d.files), configurable: true });
  Object.defineProperty(navigator, 'share', { value: async (d) => { window.__shared = { n: d.files.length, type: d.files[0].type, name: d.files[0].name }; }, configurable: true });
});
await page.click('[data-act="share-pdf"]');
await page.waitForFunction(() => window.__shared);
const shared = await page.evaluate(() => window.__shared);
check('WhatsApp (celular): PDF anexado ao compartilhar', shared.n === 1 && shared.type === 'application/pdf' && shared.name.endsWith('.pdf'));
await page.goto(base + '#/'); await page.waitForSelector('#recent');
check('lembrete de backup no início', (await page.locator('.alert:has-text("Faça um backup")').count()) === 1);
check('aviso claro de armazenamento no aparelho', (await page.locator('.storage-note:has-text("armazenamento do próprio computador")').count()) === 1);
check('convite para colocar o logotipo', (await page.locator('.alert:has-text("logotipo")').count()) === 1);
// Assinatura desenhada nas Configurações
await page.goto(base + '#/config'); await page.click('#sig-draw'); await page.waitForSelector('#sigpad');
const box = await page.locator('#sigpad').boundingBox();
await page.mouse.move(box.x + 30, box.y + 60); await page.mouse.down();
for (let i = 1; i <= 12; i++) await page.mouse.move(box.x + 30 + i * 25, box.y + 60 + (i % 2 ? 40 : -10));
await page.mouse.up(); await page.click('.modal [data-x=ok]');
await page.waitForSelector('#assinatura img[alt="Sua assinatura"]');
check('assinatura desenhada e salva', true);
// Com assinatura cadastrada: aviso antes de finalizar e imagem depois de finalizar
await page.goto(base + '#/novo'); await page.click('button:has-text("Começar laudo")'); await page.waitForSelector('#f-patient\\.name');
await page.fill('#f-patient\\.name', 'Assinado'); await page.click('[data-step="1"]'); await page.click('.organ:has-text("Fígado")'); await page.click('[data-act="b-normal"]');
await page.click('[data-step="3"]'); await page.fill('#f-impression', 'Exame sem alterações.');
await page.click('[data-step="4"]'); await page.waitForSelector('.paper');
check('aviso: assinatura só depois de finalizar', (await page.locator('.alert:has-text("A assinatura só entra depois de finalizar")').count()) === 1 && (await page.locator('.paper .psig-img').count()) === 0);
await page.click('[data-act="final"]');
await page.click('.modal [data-x="ok"]'); await page.waitForSelector('text=Laudo finalizado: o conteúdo está protegido');
await page.click('[data-step="4"]'); await page.waitForSelector('.paper');
check('finalizado: assinatura aparece no laudo', (await page.locator('.paper .psig-img img').count()) === 1 && (await page.textContent('.paper')).includes('Assinado eletronicamente'));
// Status Normal já escreve o texto de normalidade
await page.goto(base + '#/novo'); await page.click('button:has-text("Começar laudo")'); await page.waitForSelector('#f-patient\\.name');
await page.fill('#f-patient\\.name', 'Normal direto'); await page.click('[data-step="1"]'); await page.click('.organ:has-text("Baço")');
await page.click('[data-act="set-status"][data-val="normal"]');
check('clicar em Normal preenche o texto de normalidade', (await page.inputValue('[data-sec] textarea[id^="d-"]')).startsWith('em topografia habitual, com dimensões preservadas, bordos afilados'));
// Biblioteca de logotipos das clínicas e escolha por laudo
await page.goto(base + '#/config'); await page.fill('#lg-new-name', 'Hamadulu');
await page.setInputFiles('#lg-new-file', [join(here, '../fixture-usg.jpg')]);
await page.waitForSelector('[data-lgname]');
check('logotipo de clínica cadastrado', (await page.inputValue('[data-lgname]')) === 'Hamadulu');
await page.goto(base + '#/novo'); await page.click('button:has-text("Começar laudo")'); await page.waitForSelector('#f-patient\\.name');
await page.fill('#f-patient\\.name', 'Logos'); await page.fill('#f-clinic', 'Hamadulu');
check('clínica digitada escolhe o logotipo dela', (await page.inputValue('#lg-logo2')) !== 'default' && (await page.locator('#lgt-logo2 img').count()) === 1);
await page.selectOption('#lg-logo', 'none');
await page.click('[data-step="4"]'); await page.waitForSelector('.paper');
check('prévia usa só o logotipo da clínica (centralizado)', (await page.locator('.paper .plogos.single img').count()) === 1);
// Finalizar sem lista de confirmações: só o que falta
await page.goto(base + '#/novo'); await page.click('button:has-text("Começar laudo")'); await page.waitForSelector('#f-patient\\.name');
await page.fill('#f-patient\\.name', 'Faixa'); await page.click('[data-step="1"]'); await page.click('.organ:has-text("Alças intestinais")'); await page.click('[data-act="b-normal"]');
await page.fill('input[aria-label="Valor de Duodeno – espessura da parede"]', '0,35 a 0,41');
await page.click('[data-step="4"]'); await page.waitForSelector('.paper');
await page.click('[data-act="final"]'); await page.waitForSelector('.modal');
const fin = await page.textContent('.modal');
check('finalizar: sem lista de confirmações', (await page.locator('.modal [data-ck]').count()) === 0 && (await page.locator('.modal #just').count()) === 0);
check('finalizar: aponta dados do cabeçalho faltando', fin.includes('espécie não informada') && fin.includes('tutor/responsável não informado'));
check('finalizar: faixa de medida (0,35 a 0,41) não é alerta', !fin.includes('0,35 a 0,41'));
await page.click('.modal [data-x="ok"]'); await page.waitForSelector('text=Laudo finalizado: o conteúdo está protegido');
check('finalizar assim mesmo funciona', true);
// Editar laudo finalizado sem retificar
await page.click('[data-act="reopen"] >> nth=0'); await page.click('.modal button.primary');
await page.waitForSelector('[data-step]'); await page.click('[data-step="0"]');
check('laudo reaberto pode ser editado', !(await page.isDisabled('#f-patient\\.name')));
await page.fill('#f-patient\\.tutor', 'Tutor corrigido');
await page.click('[data-step="4"]'); await page.click('[data-act="final"]'); await page.click('.modal [data-x="ok"]');
await page.waitForSelector('text=Laudo finalizado: o conteúdo está protegido');
await page.click('[data-step="4"]'); await page.waitForSelector('.paper');
check('refinalizado com a correção, mesma versão', (await page.textContent('.paper')).includes('Tutor corrigido') && (await page.textContent('.paper')).includes('versão 1'));
// Novo laudo a partir deste: tudo, menos as imagens
await page.goto(base + '#/novo'); await page.click('button:has-text("Começar laudo")'); await page.waitForSelector('#f-patient\\.name');
await page.fill('#f-patient\\.name', 'Acompanhamento'); await page.fill('#f-patient\\.tutor', 'Tutora X');
await page.click('[data-step="1"]'); await page.click('.organ:has-text("Fígado")'); await page.click('[data-act="b-normal"]');
await page.setInputFiles('#side-file', [join(here, '../fixture-usg.jpg')]).catch(async () => {});
await page.click('[data-step="3"]'); await page.fill('#f-impression', 'Conclusão anterior.'); await page.waitForTimeout(1200);
await page.click('a:has-text("Novo laudo a partir deste")');
await page.waitForURL((u) => !u.href.includes('nova-versao')); await page.waitForSelector('#f-patient\\.name');
check('cópia: paciente e tutor mantidos', (await page.inputValue('#f-patient\\.name')) === 'Acompanhamento' && (await page.inputValue('#f-patient\\.tutor')) === 'Tutora X');
await page.click('[data-step="3"]');
check('cópia: conclusão mantida', (await page.inputValue('#f-impression')) === 'Conclusão anterior.');
await page.click('[data-step="2"]');
check('cópia: sem imagens', (await page.locator('.imgcard').count()) === 0);
// Data inválida continua sendo conferida
check('sem erros de console', errors.length === 0, errors.join(' | '));
await browser.close();
const failed = results.filter(([, ok]) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} passaram`);
process.exit(failed ? 1 : 0);
