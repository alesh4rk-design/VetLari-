import test from 'node:test';
import assert from 'node:assert/strict';
import { fillPhrase, placeholders, placeholderErrors, pendingMarkers } from '../js/phrase-logic.js';
import { validatePhrase } from '../js/validation.js';
import { reviewExam } from '../js/quality.js';
import { sampleExam } from './helpers.js';

const ms = [{ label: 'Comprimento', value: '5,2', unit: 'cm' }, { label: 'Volume', value: '10,00', unit: 'cm³', calculated: true }, { label: 'Largura', value: '2', unit: '' }];

test('frase pronta: preenche com valor e unidade da medida de mesmo nome', () => {
  const r = fillPhrase('Fígado com dimensões preservadas, medindo {Comprimento}, volume {volume}.', ms);
  assert.equal(r.text, 'Fígado com dimensões preservadas, medindo 5,2 cm, volume 10,00 cm³.'); assert.deepEqual(r.missing, []);
});
test('frase pronta: nome sem acento/maiúsculas ainda casa; valor é preservado como digitado', () => {
  assert.equal(fillPhrase('{comprimento}', [{ label: 'COMPRIMENTO', value: '3,20', unit: 'mm' }]).text, '3,20 mm');
});
test('frase pronta: campo sem medida ou medida sem unidade vira marcador, nunca é inventado', () => {
  const r = fillPhrase('{Altura} e {Largura} e {Grau}', ms);
  assert.equal(r.text, '[PREENCHER: Altura] e [PREENCHER: Largura] e [PREENCHER: Grau]');
  assert.deepEqual(r.missing.map((m) => m.name), ['Altura', 'Largura', 'Grau']);
  assert.match(r.missing[1].reason, /sem unidade/);
});
test('frase pronta: texto digitado pelo usuário completa o campo; vazio continua pendente', () => {
  assert.equal(fillPhrase('Lama biliar grau {Grau}.', [], { grau: 'II' }).text, 'Lama biliar grau II.');
  assert.equal(fillPhrase('Lama biliar grau {Grau}.', [], { Grau: '  ' }).text, 'Lama biliar grau [PREENCHER: Grau].');
});
test('frase pronta: texto sem campos não muda e o conteúdo da frase nunca é alterado', () => {
  const t = 'Não foi evidenciada à ultrassonografia linfonodomegalia abdominal.';
  assert.equal(fillPhrase(t, ms).text, t); assert.deepEqual(placeholders(t), []);
});
test('frase: chaves desbalanceadas ou vazias são recusadas ao cadastrar', () => {
  assert.ok(placeholderErrors('medindo {Comprimento').length); assert.ok(placeholderErrors('x { } y').length);
  assert.ok(validatePhrase({ title: 'a', text: 'medindo {x' }).length);
  assert.deepEqual(validatePhrase({ title: 'a', text: 'medindo {x}' }), []);
});
test('revisão: campo pendente de frase é alerta crítico', () => {
  const e = sampleExam({ impression: 'Lama biliar grau [PREENCHER: Grau].' });
  assert.ok(reviewExam(e, { name: 'D', crmv: '1' }).critical.some((c) => /campo pendente \[PREENCHER: Grau\]/.test(c)));
  assert.equal(pendingMarkers('a [PREENCHER: x] b [PREENCHER: y]').length, 2);
  const ok = sampleExam({ impression: 'Texto limpo.' });
  assert.ok(!reviewExam(ok, { name: 'D', crmv: '1' }).critical.some((c) => /pendente/.test(c)));
});
