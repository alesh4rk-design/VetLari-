import test from 'node:test';
import assert from 'node:assert/strict';
import { composeDescription, toggleOption, pendingFields, expandBlocks, parseOptionLine, optionToLine, joinList, validateBuilder } from '../js/builder-logic.js';
import { fillPhrase } from '../js/phrase-logic.js';
import { USG_BUILDERS, USG_IMPRESSIONS } from '../js/catalog-usg.js';

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
    for (const n of ['Dimensões', 'Contornos', 'Corticomedular', 'Ecogenicidade', 'Ecotextura', 'Pelve']) sel = toggleOption(def, sel, g(n), 0);
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
  const sel = pick(def, { 'Repleção e conteúdo': 0, Parede: 0, 'Lama biliar': 0 });
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
  assert.equal(fillPhrase('{Comprimento}', [M('Rim direito – comprimento', '4,47')], {}, { prefix: 'Rim esquerdo' }).text, '[PREENCHER: Comprimento]');
});
