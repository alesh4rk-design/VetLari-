// E2E do montador de descrição: marcar opções + digitar medidas gera a frase no estilo da veterinária.
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

const desc = () => page.inputValue('[data-sf="description"]');
const grp = (name, blk) => `${blk ? `.bblock:has(.bhead:text-is("${blk}")) ` : ''}.bgroup:has(.blabel:has-text("${name}"))`;
const chip = async (name, text, blk) => page.click(`${grp(name, blk)} .chip:has-text("${text}")`);
const organ = async (n) => page.click(`.organ:has-text("${n}")`);

await page.goto(base + '#/novo'); await page.click('button:has-text("Começar laudo")');
await page.waitForSelector('#f-patient\\.name'); await page.fill('#f-patient\\.name', 'Paciente Montador'); await page.selectOption('#f-sex', 'Macho');
await page.click('[data-step="1"]');

// Fígado: nada marcado → vazio; depois a frase completa
await organ('Fígado');
check('nada marcado: descrição vazia (nada é presumido)', (await desc()) === '');
for (const [g, t] of [['Topografia', 'em topografia'], ['Dimensões', 'preservadas'], ['Bordas', 'afiladas'], ['Contorno', 'contorno regular'], ['Parênquima', 'normoecogênico'], ['Ecotextura', 'homogênea'], ['Vasos', 'Vasos']]) await chip(g, t);
check('fígado: frase completa no estilo da veterinária', (await desc()) === 'em topografia habitual, com dimensões preservadas, bordas afiladas, contorno regular, parênquima normoecogênico e ecotextura homogênea. Vasos com calibre e trajetos preservados.', await desc());
await chip('Dimensões', 'discretamente aumentadas');
check('trocar a opção troca o trecho', (await desc()).includes('com dimensões discretamente aumentadas, bordas afiladas'));
await chip('Dimensões', 'discretamente aumentadas');
check('clicar de novo desmarca (o trecho some)', !(await desc()).includes('dimensões'));

// Vesícula urinária com medida ao vivo
await organ('Vesícula urinária');
await chip('Repleção', 'repleção adequada'); await chip('Conteúdo', 'anecogênico, homogêneo'); await chip('Parede', 'normoespessa');
check('sem medida, o parêntese não aparece', (await desc()) === 'com repleção líquida adequada, conteúdo anecogênico, aparentemente homogêneo. Parede normoecogênica, homogênea, regular e normoespessa.', await desc());
await page.fill('.mrow:has-text("Espessura da parede") [data-mf="value"]', '0,10');
check('digitar a medida atualiza a frase na hora', (await desc()).endsWith('normoespessa (0,10 cm).'), await desc());

// Campo obrigatório pedido ao usuário
await organ('Vesícula biliar');
await chip('Repleção e conteúdo', 'repleção adequada'); await chip('Lama biliar', 'Lama biliar');
check('campo sem medida aparece para digitar', await page.isVisible('[data-bx="Grau"]'));
check('enquanto não digita, vira marcador', (await desc()).includes('[PREENCHER: Grau]'));
await page.fill('[data-bx="Grau"]', 'IV');
check('digitar o grau completa a frase', (await desc()).includes('Lama biliar grau IV.') && !(await desc()).includes('PREENCHER'), await desc());

// Rins: dois lados com medidas separadas
await organ('Rins');
await chip('Posição', 'tópicos');
for (const lado of ['Rim esquerdo', 'Rim direito']) {
  await chip('Dimensões', 'dimensões preservadas', lado); await chip('Contornos', 'contornos', lado); await chip('Ecotextura', 'homogênea', lado); await chip('Pelve', 'Pelve', lado);
}
await page.fill('.mrow:has-text("Rim esquerdo – comprimento") [data-mf="value"]', '4,13');
await page.fill('.mrow:has-text("Rim direito – comprimento") [data-mf="value"]', '4,47');
const rins = await desc();
check('rins: cada lado usa a própria medida', rins.includes('Rim esquerdo com dimensões preservadas (4,13 cm)') && rins.includes('Rim direito com dimensões preservadas (4,47 cm)'), rins);

// Adrenais: três medidas num parêntese + lado não caracterizado
await organ('Adrenais');
await chip('Topografia', 'localizadas');
for (const [g, t] of [['Dimensões', 'dimensões preservadas'], ['Formato', 'formato'], ['Contorno', 'contorno'], ['Parênquima', 'normoecogênico'], ['Ecotextura', 'homogênea']]) await chip(g, t, 'Adrenal esquerda');
await chip('Dimensões', 'não caracterizada', 'Adrenal direita');
for (const [lab, v] of [['Adrenal esquerda – altura do pólo cranial', '0,31'], ['Adrenal esquerda – altura do pólo caudal', '0,37'], ['Adrenal esquerda – comprimento', '1,48']]) await page.fill(`.mrow:has-text("${lab}") [data-mf="value"]`, v);
const adr = await desc();
check('adrenais: medidas compostas e lado não caracterizado', adr.includes('(0,31 x 0,37 x 1,48 cm – altura pólo cranial x altura pólo caudal x comprimento)') && adr.endsWith('Adrenal direita não caracterizada (encoberta por alças intestinais no momento do exame).'), adr);

// Edição manual protege o texto; "Gerar de novo" substitui
await organ('Fígado');
await chip('Dimensões', 'preservadas');
await page.fill('[data-sf="description"]', 'Texto editado à mão pela veterinária.');
check('edição manual mostra o aviso', await page.isVisible('#bnotice'));
await chip('Bordas', 'arredondadas');
check('novas escolhas não apagam o texto editado', (await desc()) === 'Texto editado à mão pela veterinária.');
await page.click('[data-act="b-regen"]'); await page.click('.modal button.primary');
check('"Gerar de novo" substitui pelo texto das escolhas', (await desc()).includes('bordas arredondadas') && !(await desc()).includes('editado'));

// Baço sem marcar continua vazio e não aparece no laudo
await organ('Baço');
check('baço sem marcações: descrição vazia', (await desc()) === '');

// Próstata (macho) com três medidas
await organ('Próstata');
await chip('Tamanho', '3 medidas'); await chip('Contorno', 'contorno'); await chip('Ecotextura e ecogenicidade', 'habituais');
for (const [lab, v] of [['Comprimento', '2,32'], ['Altura', '2,03'], ['Largura', '2,06']]) await page.fill(`.mrow:has(.mlabel:text-is("${lab}")) [data-mf="value"]`, v);
check('próstata: três medidas num parêntese e vírgula final', (await desc()) === 'com tamanho normal (2,32 x 2,03 x 2,06 cm – comprimento x altura x largura), contorno regular, ecotextura e ecogenicidade habituais.', await desc());

// Conclusão: frases iniciais, lista e aviso fixo
await page.click('[data-step="3"]');
await page.click('[data-act="phrase"][data-target="f-impression"]');
check('impressões dos laudos já vêm na biblioteca', (await page.textContent('.modal')).includes('Colite leve.'));
await page.click('.phrase:has-text("Colite leve.") [data-use]');
await page.click('[data-act="phrase"][data-target="f-impression"]');
await page.click('.phrase:has-text("Discreta hepatomegalia.") [data-use]');
check('cada impressão entra em uma nova linha', (await page.inputValue('#f-impression')) === 'Colite leve.\nDiscreta hepatomegalia.');
await page.click('[data-step="4"]'); await page.waitForSelector('.paper');
check('conclusão sai em lista', (await page.locator('.paper ul li').count()) === 2);
check('aviso fixo após a conclusão', (await page.textContent('.paper')).includes('A interpretação do resultado deste exame'));
const paper = await page.textContent('.paper');
check('laudo traz só o que foi marcado (baço não aparece)', paper.includes('Fígado') && !paper.includes('Baço') && paper.includes('Próstata'));
check('sem erros de console', errors.length === 0, errors.join(' | '));
await browser.close();
const failed = results.filter(([, ok]) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} passaram`);
process.exit(failed ? 1 : 0);
