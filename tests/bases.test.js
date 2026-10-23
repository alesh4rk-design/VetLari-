import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFormula, evaluate, formulaVariables, formatResult } from '../js/formula.js';
import { validateCalculation, runCalculation } from '../js/calc-logic.js';
import { validateReference, canApprove, matchReferences, checkMeasure, isOutdated, sanitizeImportedReferences } from '../js/reference-logic.js';
import { reviewExam } from '../js/quality.js';
import { buildReport } from '../js/report-model.js';
import { sampleExam, sampleSettings } from './helpers.js';

const calc = (over = {}) => ({ id: 'c1', name: 'Volume (teste)', formula: '(L*W*H)*0.5', resultLabel: 'Volume', resultUnit: 'cm³', decimals: 2,
  variables: [{ name: 'L', label: 'Comprimento', unit: 'cm' }, { name: 'W', label: 'Largura', unit: 'cm' }, { name: 'H', label: 'Altura', unit: 'cm' }], ...over });
const ev = (f, v = {}) => evaluate(parseFormula(f), v);

test('fórmula: precedência, parênteses, potência, funções e vírgula decimal', () => {
  assert.equal(ev('2+3*4'), 14); assert.equal(ev('(2+3)*4'), 20); assert.equal(ev('2^3^2'), 512);
  assert.equal(ev('-2+5'), 3); assert.equal(ev('sqrt(16)+abs(-1)'), 5); assert.equal(ev('1,5*2'), 3);
  assert.ok(Math.abs(ev('pi*2') - 6.283185) < 1e-5);
  assert.deepEqual(formulaVariables(parseFormula('a*b+a')).sort(), ['a', 'b']);
});
test('fórmula: entradas perigosas ou inválidas são rejeitadas (sem eval)', () => {
  for (const bad of ['', '2+', 'alert(1)', 'a;b', 'process.exit()', '2 $ 3', '((1)', 'constructor']) {
    assert.throws(() => ev(bad, { a: 1, b: 2 }), undefined, bad);
  }
  assert.throws(() => ev('1/0'), /zero/); assert.throws(() => ev('sqrt(-1)')); assert.throws(() => ev('x+1'), /Falta/);
});
test('cálculo: valida variáveis, unidade do resultado e fórmula', () => {
  assert.deepEqual(validateCalculation(calc()), []);
  assert.ok(validateCalculation(calc({ resultUnit: '' })).length);
  assert.ok(validateCalculation(calc({ formula: 'L*Z' })).some((e) => /Z/.test(e)));
  assert.ok(validateCalculation(calc({ variables: calc().variables.slice(0, 2) })).some((e) => /"H"/.test(e)));
  assert.ok(validateCalculation(calc({ formula: 'L+' })).length);
  assert.ok(validateCalculation(calc({ decimals: 9 })).length);
});
test('cálculo: executa com unidades corretas e formata com vírgula', () => {
  const r = runCalculation(calc(), { L: { value: '4', unit: 'cm' }, W: { value: '2,5', unit: 'cm' }, H: { value: '2', unit: 'cm' } });
  assert.equal(r.value, '10,00'); assert.equal(r.unit, 'cm³'); assert.equal(formatResult(3.14159, 3), '3,142');
  assert.equal(r.inputs.W, '2,5 cm');
});
test('cálculo: não converte unidades nem aceita valores inválidos ou ausentes', () => {
  const ok = { L: { value: '4', unit: 'cm' }, W: { value: '2', unit: 'cm' }, H: { value: '2', unit: 'cm' } };
  assert.throws(() => runCalculation(calc(), { ...ok, L: { value: '40', unit: 'mm' } }), /Nenhuma conversão/);
  assert.throws(() => runCalculation(calc(), { ...ok, W: { value: 'abc', unit: 'cm' } }), /número/);
  assert.throws(() => runCalculation(calc(), { ...ok, H: { value: '', unit: 'cm' } }), /Informe/);
  assert.throws(() => runCalculation(calc(), { ...ok, H: { value: '1 x 2', unit: 'cm' } }), /número simples/);
});

const ref = (over = {}) => ({ id: 'r1', kind: 'scientific', title: 'Ref fictícia', citation: 'Autor (2024)', doi: '10.0000/fake', url: '', species: 'Canino', population: '',
  structure: 'Fígado', measureLabel: 'Comprimento', unit: 'cm', min: '4', max: '6', method: 'm', criteria: '', limitations: 'l', revisionDate: '2025-01-01', status: 'approved', ...over });
test('referência: campos obrigatórios e coerência do intervalo', () => {
  assert.deepEqual(validateReference(ref()).errors, []);
  assert.ok(validateReference(ref({ title: '' })).errors.length);
  assert.ok(validateReference(ref({ species: '' })).errors.some((e) => /espécie/.test(e)));
  assert.ok(validateReference(ref({ unit: '' })).errors.some((e) => /unidade/.test(e)));
  assert.ok(validateReference(ref({ min: '9', max: '2' })).errors.some((e) => /maior/.test(e)));
  assert.ok(validateReference(ref({ url: 'ftp://x' })).errors.length);
});
test('referência: sem DOI/URL não pode ser aprovada', () => {
  assert.equal(canApprove(ref({ doi: '', url: '' })).ok, false);
  assert.equal(canApprove(ref()).ok, true);
  assert.equal(canApprove(ref({ kind: 'institutional', doi: '', url: '' })).ok, true);
});
test('referência: só aprovadas e da MESMA espécie são usadas (nunca entre espécies)', () => {
  const refs = [ref(), ref({ id: 'r2', species: 'Felino' }), ref({ id: 'r3', status: 'draft' })];
  const hit = matchReferences(refs, { species: 'canino', structure: 'Fígado', label: 'comprimento' });
  assert.deepEqual(hit.map((r) => r.id), ['r1']);
  assert.deepEqual(matchReferences(refs, { species: '', structure: 'Fígado', label: 'Comprimento' }), []);
  assert.deepEqual(matchReferences(refs, { species: 'Equino', structure: 'Fígado', label: 'Comprimento' }), []);
  assert.deepEqual(matchReferences(refs, { species: 'Canino', structure: 'Baço', label: 'Comprimento' }), []);
});
test('referência: posição do valor sem juízo clínico; unidade diferente não compara', () => {
  const m = (value, unit = 'cm') => ({ value, unit });
  assert.equal(checkMeasure(m('3'), ref()).status, 'abaixo'); assert.equal(checkMeasure(m('7'), ref()).status, 'acima');
  assert.equal(checkMeasure(m('5'), ref()).status, 'dentro'); assert.equal(checkMeasure(m('50', 'mm'), ref()).status, 'unidade_diferente');
  assert.equal(checkMeasure(m('1 x 2'), ref()).status, 'sem_comparacao'); assert.equal(checkMeasure(m('3'), ref({ min: '', max: '' })).status, 'sem_intervalo');
});
test('referência: desatualizada após 5 anos ou sem data', () => {
  assert.equal(isOutdated(ref({ revisionDate: '2015-01-01' }), new Date('2026-10-01')), true);
  assert.equal(isOutdated(ref({ revisionDate: '' })), true); assert.equal(isOutdated(ref({ revisionDate: '2025-01-01' }), new Date('2026-10-01')), false);
});
test('referência: importação entra sempre como rascunho, mesmo se vier "aprovada"', () => {
  const r = sanitizeImportedReferences([ref({ status: 'approved', approvedBy: 'Fulana' }), { title: '' }]);
  assert.equal(r.refs.length, 1); assert.equal(r.skipped, 1); assert.equal(r.refs[0].status, 'draft'); assert.equal(r.refs[0].approvedBy, '');
  assert.equal(sanitizeImportedReferences({}).ok, false);
});

const prof = { name: 'Dra', crmv: '1' };
const exam = (value, unit, species = 'Canino') => sampleExam({ patient: { name: 'T', species }, impression: 'x',
  sections: [{ id: 's', title: 'Fígado', status: 'alterado', description: 'd', measures: '', notes: '', measuresList: [{ id: 'm', label: 'Comprimento', value, unit }] }] });
test('qualidade: alerta informativo com posição frente à referência aprovada, sem dizer "normal"', () => {
  const r = reviewExam(exam('7', 'cm'), prof, [ref()]);
  assert.ok(r.info.some((i) => /acima do máximo/.test(i) && /interpretação é sua/.test(i)));
  assert.ok(!r.critical.some((c) => /referência/i.test(c)) && !r.info.some((i) => /anormal|normal\b/i.test(i)));
});
test('qualidade: sem referência para a espécie ou em rascunho, nenhum alerta é inventado', () => {
  assert.ok(!reviewExam(exam('7', 'cm', 'Felino'), prof, [ref()]).info.some((i) => /intervalo publicado/.test(i)));
  assert.ok(!reviewExam(exam('7', 'cm'), prof, [ref({ status: 'draft' })]).info.some((i) => /intervalo publicado/.test(i)));
  assert.ok(!reviewExam(exam('5', 'cm'), prof, [ref()]).info.some((i) => /intervalo publicado/.test(i)));
});
test('qualidade: unidade diferente avisa sem converter', () => {
  assert.ok(reviewExam(exam('70', 'mm'), prof, [ref()]).info.some((i) => /unidade difere/.test(i)));
});
test('laudo: medida calculada é identificada como tal', () => {
  const e = exam('10,00', 'cm³'); e.sections[0].measuresList[0] = { id: 'm', label: 'Volume', value: '10,00', unit: 'cm³', calculated: true, calcName: 'Volume (teste)' };
  const r = buildReport(e, sampleSettings);
  assert.match(JSON.stringify(r.blocks), /Volume: 10,00 cm³ \(calculado: Volume \(teste\)\)/);
});
