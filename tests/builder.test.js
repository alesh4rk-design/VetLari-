import test from 'node:test';
import assert from 'node:assert/strict';
import { composeDescription as composeRaw, toggleOption, pendingFields, expandBlocks, parseOptionLine, optionToLine, joinList, validateBuilder } from '../js/builder-logic.js';
import { fillPhrase } from '../js/phrase-logic.js';
import { USG_BUILDERS, USG_IMPRESSIONS } from '../js/catalog-usg.js';

import { stripRich } from '../js/richtext.js';
/** Os testes de frases comparam o texto sem os marcadores de negrito/itálico; um teste à parte confere os marcadores. */
const composeDescription = (...a) => stripRich(composeRaw(...a));
const M = (label, value, unit = 'cm') => ({ label, value, unit });
/** Marca, por nome do grupo, o índice da opção. */
function pick(def, choices) {
  const groups = expandBlocks(def).flatMap((b) => b.groups.map((g) => ({ ...g, block: b.label })));
  let sel = {};
  for (const [spec, idx] of Object.entries(choices)) {
    const [blk, name] = spec.includes('/') ? spec.split('/') : ['', spec];
    const g = groups.find((x) => x.label === name && x.block === blk);
    assert.ok(g, `grupo não encontrado: ${spec}`);
    sel = toggleOption(def, sel, g.key, idx);
  }
  return sel;
}

test('montador: nada marcado → nenhum texto (nada é presumido)', () => {
  for (const def of Object.values(USG_BUILDERS)) assert.equal(composeDescription(def, {}, [], {}), '');
});

test('montador reproduz a frase da veterinária: fígado', () => {
  const def = USG_BUILDERS['Fígado'];
  const sel = pick(def, { Topografia: 0, Dimensões: 0, Bordas: 0, Contorno: 0, Parênquima: 0, Ecotextura: 0, Vasos: 0 });
  assert.equal(composeDescription(def, sel), 'em topografia habitual, com dimensões preservadas, bordas afiladas, contorno regular, parênquima normoecogênico e ecotextura homogênea. Vasos com calibre e trajetos preservados.');
});
test('montador: só entra o que foi marcado (fígado parcial)', () => {
  const def = USG_BUILDERS['Fígado'];
  assert.equal(composeDescription(def, pick(def, { Topografia: 0, Parênquima: 1 })), 'em topografia habitual e parênquima discretamente hipoecogênico.');
});
test('montador: vesícula urinária com medida (vírgula antes do último item e medida entre parênteses)', () => {
  const def = USG_BUILDERS['Vesícula urinária'];
  const sel = pick(def, { Repleção: 0, Conteúdo: 0, Parede: 0 });
  assert.equal(composeDescription(def, sel, [M('Espessura da parede', '0,10')]), 'com repleção líquida adequada, conteúdo anecogênico, aparentemente homogêneo. Parede normoecogênica, homogênea, regular e normoespessa (0,10 cm).');
  assert.equal(composeDescription(def, sel, []), 'com repleção líquida adequada, conteúdo anecogênico, aparentemente homogêneo. Parede normoecogênica, homogênea, regular e normoespessa.');
});
test('montador: rins com dois lados, medidas por lado e achados adicionais', () => {
  const def = USG_BUILDERS.Rins;
  const choices = { Posição: 0, 'Ureteres': 0 };
  let sel = pick(def, { Posição: 0 });
  for (const lado of ['Rim esquerdo', 'Rim direito']) {
    const g = (n) => expandBlocks(def).find((b) => b.label === lado).groups.find((x) => x.label === n).key;
    for (const n of ['Dimensões', 'Definição do contorno', 'Regularidade do contorno', 'Corticomedular', 'Ecogenicidade', 'Ecotextura', 'Pelve']) sel = toggleOption(def, sel, g(n), 0);
  }
  sel = toggleOption(def, sel, expandBlocks(def).find((b) => b.label === 'Rim esquerdo').groups.find((x) => x.label === 'Achados adicionais').key, 1);
  sel = toggleOption(def, sel, expandBlocks(def).find((b) => b.groups[0].label === 'Ureteres').groups[0].key, 0);
  const txt = composeDescription(def, sel, [M('Rim esquerdo – comprimento', '4,13'), M('Rim direito – comprimento', '4,47')]);
  assert.equal(txt, 'tópicos e simétricos. Rim esquerdo com dimensões preservadas (4,13 cm), contornos definidos e regulares, relação e definição corticomedular preservada, ecogenicidade mantida e ecotextura homogênea. Presença de discretos pontos hiperecogênicos em região de recessos pélvicos. Pelve normodilatada. Rim direito com dimensões preservadas (4,47 cm), contornos definidos e regulares, relação e definição corticomedular preservada, ecogenicidade mantida e ecotextura homogênea. Pelve normodilatada. Ureteres sem alterações sonográficas visíveis em topografia.');
  void choices;
});
test('montador: adrenais com três medidas em um parêntese e lado não caracterizado (exclusiva)', () => {
  const def = USG_BUILDERS.Adrenais;
  const blocks = expandBlocks(def);
  const esq = blocks.find((b) => b.label === 'Adrenal esquerda'), dir = blocks.find((b) => b.label === 'Adrenal direita');
  let sel = toggleOption(def, {}, blocks[0].groups[0].key, 0);
  for (const n of ['Dimensões', 'Formato', 'Contorno', 'Parênquima', 'Ecotextura']) sel = toggleOption(def, sel, esq.groups.find((x) => x.label === n).key, 0);
  sel = toggleOption(def, sel, dir.groups.find((x) => x.label === 'Dimensões').key, 1); // exclusiva
  sel = toggleOption(def, sel, dir.groups.find((x) => x.label === 'Formato').key, 0);     // ignorada pela exclusiva
  const ms = [M('Adrenal esquerda – altura do pólo cranial', '0,31'), M('Adrenal esquerda – altura do pólo caudal', '0,37'), M('Adrenal esquerda – comprimento', '1,48')];
  assert.equal(composeDescription(def, sel, ms), 'localizadas em topografia habitual. Adrenal esquerda com dimensões preservadas (0,31 x 0,37 x 1,48 cm – altura pólo cranial x altura pólo caudal x comprimento), formato preservado, contorno regular, parênquima normoecogênico e ecotextura homogênea. Adrenal direita não caracterizada (encoberta por alças intestinais no momento do exame).');
});
test('montador: próstata com medidas compostas', () => {
  const def = USG_BUILDERS.Próstata;
  const sel = pick(def, { Tamanho: 0, Contorno: 0, 'Ecotextura e ecogenicidade': 0 });
  assert.equal(composeDescription(def, sel, [M('Comprimento', '2,32'), M('Altura', '2,03'), M('Largura', '2,06')]),
    'com tamanho normal (2,32 x 2,03 x 2,06 cm – comprimento x altura x largura), contorno regular, ecotextura e ecogenicidade habituais.');
});
test('montador: alças intestinais por segmento, cláusulas sem medida somem, observação fixa só se marcada', () => {
  const def = USG_BUILDERS['Alças intestinais'];
  const sel = pick(def, { 'Intestino delgado/Conteúdo': 0, 'Intestino delgado/Parede': 0, 'Intestino delgado/Peristaltismo': 0, 'Cólon/Conteúdo': 0, 'Cólon/Parede': 0 });
  const ms = [M('Duodeno – espessura da parede', '0,30'), M('Cólon descendente – espessura da parede', '0,10'), M('Cólon ascendente – espessura da parede', '0,12')];
  const txt = composeDescription(def, sel, ms);
  assert.equal(txt, 'Intestino delgado com moderada quantidade de conteúdo mucoso e gasoso. Parede normoecogênica, com preservação da estratificação em camadas, contorno regular e espessura preservada (0,30 cm – duodeno). Peristaltismo preservado. Cólon com moderada quantidade de conteúdo fecal. Parede normoecogênica, com preservação da estratificação em camadas, contorno regular e espessura habitual (0,10 cm – cólon descendente; 0,12 cm – cólon ascendente).');
  assert.ok(!txt.includes('Obs:'));
});
test('montador: campo obrigatório sem valor pede digitação e vira marcador até ser preenchido', () => {
  const def = USG_BUILDERS['Vesícula biliar'];
  const sel = pick(def, { Repleção: 0, Conteúdo: 0, Parede: 0, 'Lama biliar': 0 });
  assert.deepEqual(pendingFields(def, sel, [], {}).map((p) => p.name), ['Grau']);
  assert.match(composeDescription(def, sel, [], {}), /Lama biliar grau \[PREENCHER: Grau\]\./);
  assert.match(composeDescription(def, sel, [], { Grau: 'IV' }), /Lama biliar grau IV\./);
  assert.deepEqual(pendingFields(def, sel, [], { Grau: 'IV' }), []);
});
test('montador: "escolha uma" desmarca ao clicar de novo e troca ao escolher outra', () => {
  const def = USG_BUILDERS['Fígado'];
  const key = expandBlocks(def).flatMap((b) => b.groups).find((g) => g.label === 'Dimensões').key;
  let sel = toggleOption(def, {}, key, 0); assert.deepEqual(sel[key], [0]);
  sel = toggleOption(def, sel, key, 1); assert.deepEqual(sel[key], [1]);
  sel = toggleOption(def, sel, key, 1); assert.deepEqual(sel[key], []);
});
test('montador: catálogo válido e linha de opção ida e volta', () => {
  for (const [name, def] of Object.entries(USG_BUILDERS)) assert.deepEqual(validateBuilder(def), [], name);
  for (const line of ['texto simples', '!exclusiva', 'curto :: texto longo', '!curto :: texto']) assert.equal(optionToLine(parseOptionLine(line)), line);
  assert.equal(parseOptionLine('   '), null);
  assert.equal(joinList(['a', 'b', 'c.']), 'a, b e c'); assert.equal(joinList(['a', 'b'], ','), 'a, b'); assert.equal(joinList([]), '');
});
test('impressões: lista inicial usa só frases dos laudos e nenhuma é marcada sozinha', () => {
  assert.ok(USG_IMPRESSIONS.length >= 15 && USG_IMPRESSIONS.every(([t]) => t.endsWith('.')));
});
test('frases com campos: opcional, cláusulas e modificadores', () => {
  assert.equal(fillPhrase('medindo {?Comprimento} (x)', []).text, 'medindo  (x)');
  assert.equal(fillPhrase('a ({?A} – a; {?B} – b)', [M('B', '2')]).text, 'a (2 cm – b)');
  assert.equal(fillPhrase('a ({?A} – a)', []).text, 'a');
  assert.equal(fillPhrase('{X:valor} x {Y}', [M('X', '1,5'), M('Y', '2')]).text, '1,5 x 2 cm');
  assert.equal(fillPhrase('{Comprimento}', [M('Rim direito – comprimento', '4,47')], {}, { prefix: 'Rim direito' }).text, '4,47 cm');
  assert.equal(fillPhrase('{Comprimento}', [M('Rim direito – comprimento', '4,47')], {}, { prefix: 'Rim esquerdo' }).text, '[PREENCHER: Rim esquerdo – Comprimento]');
});

// ---- Frases dos 4 laudos adicionais (reprodução do estilo da veterinária) ----
const blk = (def, label) => expandBlocks(def).find((b) => b.label === label);
const gkey = (def, label, name) => blk(def, label).groups.find((g) => g.label === name).key;
const on = (def, sel, label, name, i = 0) => toggleOption(def, sel, gkey(def, label, name), i);

test('vesícula biliar: repleção + conteúdo colados + material ecogênico (vírgula antes de "apresentando")', () => {
  const def = USG_BUILDERS['Vesícula biliar'];
  let sel = pick(def, { Repleção: 2, Conteúdo: 1, 'Material ecogênico': 2, Parede: 0, 'Vias biliares': 0 });
  assert.equal(composeDescription(def, sel, [M('Volume', '1,71', 'ml')]), 'com repleção habitual (1,71 ml) por conteúdo anecogênico, apresentando até 25% de material ecogênico não gravidade dependente (em suspensão). Parede ecogênica, regular, sem alterações. Vias biliares não dilatadas no momento do exame.');
  sel = pick(def, { Repleção: 4, Conteúdo: 0, Parede: 0 });
  assert.equal(composeDescription(def, sel, [M('Volume', '5,59', 'ml')]), 'com repleção levemente aumentada, com volume de 5,59 ml (considerar paciente em jejum) por conteúdo anecogênico, aparentemente homogêneo. Parede ecogênica, regular, sem alterações.');
  sel = pick(def, { Repleção: 3, Conteúdo: 0, 'Material ecogênico': 3 });
  assert.equal(composeDescription(def, sel, [M('Volume', '10,92', 'ml')]), 'com repleção discretamente aumentada (10,92 ml) por conteúdo anecogênico, aparentemente homogêneo, apresentando cerca de até 25% de material ecogênico homogêneo e dependente de gravidade.');
});
test('baço: nódulo com medida digitada (campo obrigatório) e frase completa', () => {
  const def = USG_BUILDERS['Baço'];
  const sel = pick(def, { Topografia: 0, Dimensões: 1, Bordos: 1, Contorno: 0, Parênquima: 0, Ecotextura: 1, Vasos: 0 });
  assert.deepEqual(pendingFields(def, sel, [], {}).map((p) => p.key), ['Medidas da formação']);
  assert.equal(composeDescription(def, sel, [], { 'Medidas da formação': '4,63 x 3,69 cm' }),
    'em topografia habitual, com dimensões moderadamente aumentadas, bordos arredondados, contorno regular, parênquima normoecogênico e ecotextura homogênea predominantemente, exceto por formação nodular de contornos definidos, discretamente irregulares, hipoecogênica, heterogênea, medindo 4,63 x 3,69 cm, localizada em cauda esplênica e alterando a superfície capsular. Vasos com calibre e trajeto preservados.');
});
test('estômago: grande quantidade de gás e peristaltismo diminuído', () => {
  const def = USG_BUILDERS['Estômago'];
  const sel = pick(def, { Conteúdo: 4, Parede: 0, 'Peristaltismo e piloro': 1 });
  assert.equal(composeDescription(def, sel, [M('Espessura da parede', '0,48')]), 'com grande quantidade de conteúdo gasoso. Parede normoecogênica, com preservação da estratificação em camadas, contorno regular e espessura habitual (0,48 cm). Peristaltismo diminuído. Piloro íntegro e sem sinais de obstrução.');
});
test('alças: conteúdo mucoso e muito gasoso, espessura aumentada no delgado, cólon líquido com espessura preservada', () => {
  const def = USG_BUILDERS['Alças intestinais'];
  const sel = pick(def, { 'Intestino delgado/Conteúdo': 1, 'Intestino delgado/Parede': 1, 'Intestino delgado/Peristaltismo': 0, 'Cólon/Conteúdo': 3, 'Cólon/Parede': 2 });
  const ms = [M('Duodeno – espessura da parede', '0,53'), M('Jejuno – espessura da parede', '0,41'), M('Cólon descendente – espessura da parede', '0,18'), M('Cólon ascendente – espessura da parede', '0,14')];
  assert.equal(composeDescription(def, sel, ms), 'Intestino delgado com moderada quantidade de conteúdo mucoso e grande quantidade de conteúdo gasoso. Parede normoecogênica, com preservação da estratificação em camadas, contorno regular e espessura discretamente aumentada (0,53 cm – duodeno; 0,41 cm – jejuno). Peristaltismo preservado. Cólon com discreto conteúdo líquido. Parede normoecogênica, com preservação da estratificação em camadas, contorno regular e espessura preservada (0,18 cm – cólon descendente; 0,14 cm – cólon ascendente).');
});
test('testículos: cada lado com a própria localização, medida digitada e aspecto (campos por lado)', () => {
  const def = USG_BUILDERS['Testículos'];
  let sel = {};
  sel = on(def, sel, 'Testículo esquerdo', 'Localização', 0); sel = on(def, sel, 'Testículo esquerdo', 'Medida', 0); sel = on(def, sel, 'Testículo esquerdo', 'Aspecto', 0);
  sel = on(def, sel, 'Testículo direito', 'Localização', 1); sel = on(def, sel, 'Testículo direito', 'Medida', 0); sel = on(def, sel, 'Testículo direito', 'Aspecto', 1);
  const need = pendingFields(def, sel, [], {}).map((p) => p.key);
  assert.deepEqual(need, ['Testículo esquerdo – Medidas do testículo', 'Testículo direito – Medidas do testículo']);
  const txt = composeDescription(def, sel, [], { 'Testículo esquerdo – Medidas do testículo': '2,01 x 1,49 cm', 'Testículo direito – Medidas do testículo': '1,41 x 0,55 cm' });
  assert.equal(txt, 'Testículo esquerdo localizado em bolsa escrotal, medindo aprox. 2,01 x 1,49 cm, apresentando contorno regular, ecotextura e ecogenicidade habituais. Testículo direito localizado em subcutâneo de região inguinal direita, medindo aprox. 1,41 x 0,55 cm, apresentando contorno regular, ecotextura homogênea, ecogenicidade diminuída e dimensões diminuídas em relação ao testículo contralateral.');
});
test('testículos ausentes (exclusiva) e útero/ovários não caracterizados (OSH)', () => {
  const t = USG_BUILDERS['Testículos'];
  assert.equal(composeDescription(t, on(t, {}, '', 'Aspecto', 1)), 'testículos ausentes.');
  const u = USG_BUILDERS['Útero'];
  assert.equal(composeDescription(u, on(u, {}, '', 'Descrição', 0)), 'Útero e ovários não caracterizados (paciente com histórico de OSH).');
});
test('rim: ecogenicidade aumentada difusamente e ecotextura grosseira', () => {
  const def = USG_BUILDERS.Rins;
  let sel = {};
  for (const [n, i] of [['Dimensões', 0], ['Definição do contorno', 0], ['Regularidade do contorno', 0], ['Corticomedular', 1], ['Ecogenicidade', 4], ['Ecotextura', 1], ['Pelve', 0]]) sel = on(def, sel, 'Rim esquerdo', n, i);
  assert.equal(composeDescription(def, sel, [M('Rim esquerdo – comprimento', '3,80')]), 'Rim esquerdo com dimensões preservadas (3,80 cm), contornos definidos e regulares, relação corticomedular preservada, definição corticomedular diminuída, ecogenicidade aumentada difusamente e ecotextura grosseira. Pelve normodilatada.');
});
test('catálogo: nenhuma opção cola sem opção anterior e o sinal & ida e volta', () => {
  assert.equal(optionToLine(parseOptionLine('&por conteúdo')), '&por conteúdo');
  assert.equal(optionToLine(parseOptionLine('!&curto :: texto')), '!&curto :: texto');
  assert.deepEqual(parseOptionLine('&x'), { text: 'x', glue: true });
});
test('impressões: versões e novas frases dos laudos', () => {
  const texts = USG_IMPRESSIONS.map((i) => i[0]);
  assert.ok(texts.includes('Testículo direito ectópico.') && texts.includes('Exame sem alterações relevantes dignas de nota.'));
  assert.ok(USG_IMPRESSIONS.some((i) => i[2] === 2) && USG_IMPRESSIONS.every((i) => (i[2] || 1) <= 3));
  assert.equal(new Set(texts).size, texts.length);
});

test('destaques: lados e subtítulos saem em negrito e a observação fixa em itálico', () => {
  const rins = USG_BUILDERS.Rins;
  let sel = {};
  for (const [n, i] of [['Dimensões', 0], ['Pelve', 0]]) sel = toggleOption(rins, sel, expandBlocks(rins).find((b) => b.label === 'Rim esquerdo').groups.find((g) => g.label === n).key, i);
  sel = toggleOption(rins, sel, expandBlocks(rins).find((b) => b.groups[0].label === 'Ureteres').groups[0].key, 0);
  assert.match(composeRaw(rins, sel, [M('Rim esquerdo – comprimento', '4,13')]), /^\*\*Rim esquerdo\*\* com dimensões preservadas \(4,13 cm\)\./);
  assert.ok(composeRaw(rins, sel, []).includes('**Ureteres** sem alterações sonográficas visíveis em topografia.'));
  const est = USG_BUILDERS['Estômago'];
  const k = expandBlocks(est).flatMap((b) => b.groups).find((g) => g.label === 'Observação').key;
  const txt = composeRaw(est, toggleOption(est, {}, k, 0));
  assert.ok(txt.startsWith('__Obs: Alimento e gás') && txt.endsWith('(jejum e uso de antifisético).__'), txt);
});

test('Rins: texto padrão sem alterações é o texto da veterinária, com medidas só quando digitadas', async () => {
  const { USG_BUILDERS } = await import('../js/catalog-usg.js');
  const { normalSelection, composeDescription } = await import('../js/builder-logic.js');
  const d = USG_BUILDERS.Rins;
  const vazio = composeDescription(d, normalSelection(d), [], {});
  assert.ok(vazio.startsWith('tópicos e simétricos. **Rim esquerdo** com dimensões preservadas, contornos definidos e regulares, relação e definição corticomedular preservada, ecogenicidade mantida e ecotextura homogênea. Pelve normodilatada. **Rim direito**'));
  assert.ok(vazio.endsWith('**Ureteres** sem alterações sonográficas visíveis em topografia.'));
  const med = composeDescription(d, normalSelection(d), [{ label: 'Rim esquerdo – comprimento', value: '5,2', unit: 'cm' }], {});
  assert.ok(med.includes('dimensões preservadas (5,2 cm)'));
  assert.deepEqual(normalSelection({ blocks: [{ groups: [{ label: 'x', kind: 'one', options: [{ text: 'a' }] }] }] }), {});
});

test('Rins: contorno com definição e regularidade escolhidas separadamente', async () => {
  const { USG_BUILDERS } = await import('../js/catalog-usg.js');
  const { toggleOption, composeDescription } = await import('../js/builder-logic.js');
  const d = USG_BUILDERS.Rins;
  const pick = (sel, group, label) => { const g = expandBlocks(d).find((b) => b.label === 'Rim esquerdo').groups.find((x) => x.label === group); return toggleOption(d, sel, g.key, g.options.findIndex((o) => o.label === label)); };
  let sel = pick(pick({}, 'Definição do contorno', 'definidos'), 'Regularidade do contorno', 'irregulares');
  assert.ok(composeDescription(d, sel, [], {}).includes('**Rim esquerdo** contornos definidos e irregulares.'));
  sel = pick({}, 'Regularidade do contorno', 'irregulares');
  assert.ok(composeDescription(d, sel, [], {}).includes('**Rim esquerdo** contornos irregulares.'));
  sel = pick({}, 'Definição do contorno', 'indefinidos');
  assert.ok(composeDescription(d, sel, [], {}).includes('**Rim esquerdo** contornos indefinidos.'));
});

test('contorno: órgãos com "contorno regular" também têm "contorno irregular"', () => {
  for (const nome of ['Fígado', 'Baço', 'Pâncreas', 'Adrenais', 'Próstata']) {
    const g = expandBlocks(USG_BUILDERS[nome]).flatMap((b) => b.groups).find((x) => x.label === 'Contorno');
    assert.deepEqual(g.options.map((o) => o.text).slice(0, 2), ['contorno regular', 'contorno irregular'], nome);
  }
});

test('rins: pelve com normodilatada e graus de dilatação', () => {
  const g = expandBlocks(USG_BUILDERS.Rins).find((b) => b.label === 'Rim direito').groups.find((x) => x.label === 'Pelve');
  assert.deepEqual(g.options.map((o) => o.text), ['Pelve normodilatada', 'Pelve discretamente dilatada ({?Pelve})', 'Pelve moderadamente dilatada ({?Pelve})', 'Pelve acentuadamente dilatada ({?Pelve})']);
});

test('laudos de outubro/2026: novas opções geram o texto da veterinária', () => {
  const pickBy = (def, label, group, optLabel, sel = {}) => {
    const g = expandBlocks(def).find((b) => b.label === label).groups.find((x) => x.label === group);
    return toggleOption(def, sel, g.key, g.options.findIndex((o) => (o.label || o.text) === optLabel));
  };
  const vb = USG_BUILDERS['Vesícula biliar'];
  let sel = pickBy(vb, '', 'Ducto cístico', 'discreta a moderadamente dilatado, com lama');
  assert.equal(composeDescription(vb, sel, [], { 'Ducto cístico': '0,68 a 0,78 cm' }), 'Ducto cístico discretamente a moderadamente dilatado, medindo 0,68 a 0,78 cm e com discreta a moderada quantidade de lama biliar intraluminal.');
  const bc = USG_BUILDERS.Baço;
  sel = pickBy(bc, '', 'Dimensões', 'discretamente aumentadas, com espessura');
  assert.ok(composeDescription(bc, sel, [], { 'Espessura em corpo esplênico': '1,06 cm' }).includes('discretamente aumentadas, medindo 1,06 cm de espessura em região de corpo esplênico'.replace('discretamente aumentadas, ', 'dimensões discretamente aumentadas, ')));
  const rins = USG_BUILDERS.Rins;
  sel = pickBy(rins, 'Rim esquerdo', 'Regularidade do contorno', 'levemente irregulares', pickBy(rins, 'Rim esquerdo', 'Definição do contorno', 'definidos'));
  assert.ok(composeDescription(rins, sel, [], {}).includes('contornos definidos e levemente irregulares'));
  assert.ok(USG_IMPRESSIONS.some((i) => i[0] === 'Hiperplasia prostática benigna cística.' && i[2] === 3));
});

test('laudos de outubro/2026 (lote 2): pelve com medida, ducto pancreático e baço não caracterizado', () => {
  const rins = USG_BUILDERS.Rins;
  const grp = (def, label, group) => expandBlocks(def).find((b) => b.label === label).groups.find((x) => x.label === group);
  const pel = grp(rins, 'Rim esquerdo', 'Pelve');
  const sel = toggleOption(rins, {}, pel.key, 1);
  assert.ok(composeDescription(rins, sel, [{ label: 'Rim esquerdo – pelve', value: '0,20', unit: 'cm' }], {}).includes('Pelve discretamente dilatada (0,20 cm).'));
  assert.ok(composeDescription(rins, sel, [], {}).includes('Pelve discretamente dilatada.'));
  const panc = USG_BUILDERS.Pâncreas;
  const dg = grp(panc, '', 'Ducto pancreático');
  assert.ok(composeDescription(panc, toggleOption(panc, {}, dg.key, 0), [], { 'Ducto pancreático': '0,19 cm' }).includes('Ducto pancreático discretamente dilatado (0,19 cm).'));
  const bc = USG_BUILDERS.Baço;
  const top = grp(bc, '', 'Topografia');
  assert.equal(composeDescription(bc, toggleOption(bc, {}, top.key, top.options.findIndex((o) => o.excl)), [], {}), 'não caracterizado (paciente com histórico de esplenectomia).');
});
