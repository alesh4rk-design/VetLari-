import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewExam, isNumericValue, STRUCTURE_STATUS } from '../js/quality.js';
import { compareMeasures } from '../js/compare.js';
import { buildReport } from '../js/report-model.js';
import { can, createProfile, loadRegistry } from '../js/profiles.js';
import { buildDocx } from '../js/docx-export.js';
import { docxLib, sampleExam, sampleSettings } from './helpers.js';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const prof = { name: 'Dra. Teste', crmv: '12345' };
const sec = (over = {}) => ({ id: 's', title: 'Fígado', status: '', description: '', measures: '', notes: '', measuresList: [], ...over });
const exam = (secs, over = {}) => sampleExam({ sections: secs, impression: 'Conclusão fictícia.', ...over });

test('estrutura vazia ou não mencionada nunca vira achado normal', () => {
  const r = buildReport(exam([sec(), sec({ id: 'b', title: 'Baço' })]), sampleSettings);
  assert.equal(r.blocks.filter((b) => b.kind === 'section').length, 0);
  assert.ok(!/normal/i.test(JSON.stringify(r.blocks)));
});
test('"Normal" só aparece quando a veterinária marca explicitamente', () => {
  const r = buildReport(exam([sec({ status: 'normal' })]), sampleSettings);
  assert.equal(r.blocks[0].title, 'Fígado — Normal');
  assert.deepEqual(r.blocks[0].items, []); // nenhum texto inventado
});
test('"Não avaliado" é exibido como tal, sem texto adicional', () => {
  const r = buildReport(exam([sec({ status: 'nao_avaliado' })]), sampleSettings);
  assert.equal(r.blocks[0].title, `Fígado — ${STRUCTURE_STATUS.nao_avaliado}`);
});
test('medidas preservam valor e unidade exatamente como digitados', () => {
  const m = [{ id: '1', label: 'Comprimento', value: '5,2', unit: 'cm' }, { id: '2', label: 'Nódulo', value: '3,2 x 2,1', unit: 'mm' }];
  const r = buildReport(exam([sec({ status: 'alterado', description: 'x', measuresList: m })]), sampleSettings);
  const txt = r.blocks[0].items.find((i) => i.label === 'Medidas').text;
  assert.equal(txt, 'Comprimento: 5,2 cm; Nódulo: 3,2 x 2,1 mm');
});
test('qualidade: medida sem unidade ou não numérica é alerta crítico', () => {
  const noUnit = reviewExam(exam([sec({ description: 'x', measuresList: [{ id: '1', label: 'a', value: '5', unit: '' }] })]), prof);
  assert.ok(noUnit.critical.some((c) => /sem unidade/.test(c)));
  const bad = reviewExam(exam([sec({ description: 'x', measuresList: [{ id: '1', label: 'a', value: 'cinco', unit: 'cm' }] })]), prof);
  assert.ok(bad.critical.some((c) => /não é numérico/.test(c)));
  assert.ok(isNumericValue('3,2 x 2,1') && isNumericValue('12.5') && !isNumericValue('abc'));
});
test('qualidade: estrutura "não avaliada" com texto/medidas é contradição crítica', () => {
  const r = reviewExam(exam([sec({ status: 'nao_avaliado', description: 'descrição' })]), prof);
  assert.ok(r.critical.some((c) => /Não avaliado/.test(c)));
});
test('qualidade: "normal" sem descrição e texto sem status geram alertas informativos', () => {
  assert.ok(reviewExam(exam([sec({ status: 'normal' })]), prof).info.some((i) => /sem descrição/.test(i)));
  assert.ok(reviewExam(exam([sec({ description: 'texto' })]), prof).info.some((i) => /Não informado/.test(i)));
});
test('qualidade: identificação profissional ausente bloqueia (crítico)', () => {
  const r = reviewExam(exam([sec({ description: 'x' })]), { name: '', crmv: '' });
  assert.ok(r.critical.some((c) => /Identificação profissional/.test(c)) && r.critical.some((c) => /CRMV/.test(c)));
});
test('qualidade: nada é alterado no exame pela revisão', () => {
  const e = exam([sec({ description: 'x', measuresList: [{ id: '1', label: 'a', value: '5', unit: '' }] })]);
  const before = JSON.stringify(e);
  reviewExam(e, prof);
  assert.equal(JSON.stringify(e), before);
});

const mk = (date, vals, over = {}) => sampleExam({ date, patient: { name: 'Thor', species: 'Canino' }, clinical: { equipment: 'Eq A', operator: 'Op' },
  sections: [sec({ measuresList: vals.map(([l, v, u], i) => ({ id: String(i), label: l, value: v, unit: u })) })], ...over });
test('comparação: mesma estrutura, medida e unidade → diferença numérica sem conclusão', () => {
  const { rows } = compareMeasures(mk('2026-01-01', [['esp', '1,0', 'cm']]), mk('2026-06-01', [['esp', '1,5', 'cm']]));
  assert.equal(rows[0].comparable, true); assert.equal(rows[0].delta, 0.5);
});
test('comparação: unidades diferentes não são convertidas nem comparadas', () => {
  const { rows } = compareMeasures(mk('2026-01-01', [['esp', '10', 'mm']]), mk('2026-06-01', [['esp', '1', 'cm']]));
  assert.equal(rows[0].comparable, false); assert.match(rows[0].reason, /Unidades diferentes/);
});
test('comparação: medida só em um exame e valores compostos não são comparáveis', () => {
  const r1 = compareMeasures(mk('2026-01-01', [['a', '1', 'cm']]), mk('2026-06-01', [['b', '1', 'cm']]));
  assert.ok(r1.rows.every((r) => !r.comparable));
  const r2 = compareMeasures(mk('2026-01-01', [['n', '1 x 2', 'cm']]), mk('2026-06-01', [['n', '2 x 3', 'cm']]));
  assert.equal(r2.rows[0].comparable, false);
});
test('comparação: avisa quando equipamento difere ou não foi informado', () => {
  const a = mk('2026-01-01', [['a', '1', 'cm']]), b = mk('2026-06-01', [['a', '1', 'cm']], { clinical: { equipment: 'Eq B', operator: 'Op' } });
  assert.ok(compareMeasures(a, b).notes.some((n) => /Equipamento diferente/.test(n)));
  const c = mk('2026-06-01', [['a', '1', 'cm']], { clinical: {} });
  assert.ok(compareMeasures(a, c).notes.some((n) => /não informado/.test(n)));
});

test('perfis: auxiliar não pode finalizar nem retificar; veterinária pode', () => {
  assert.equal(can({ role: 'assistant' }, 'finalize'), false);
  assert.equal(can({ role: 'assistant' }, 'revise'), false);
  assert.equal(can({ role: 'assistant' }, 'edit'), true);
  assert.equal(can({ role: 'vet' }, 'finalize'), true);
  assert.equal(can(null, 'edit'), false);
});
test('perfis: validação de criação', () => {
  loadRegistry();
  assert.throws(() => createProfile({ name: '  ', role: 'vet' }));
  assert.throws(() => createProfile({ name: 'X', role: 'admin' }));
  createProfile({ name: 'Ana', role: 'assistant' });
  assert.throws(() => createProfile({ name: 'ana', role: 'vet' }), /Já existe/);
});

test('exportação: rascunho sai marcado; finalizado traz carimbo e identificador', async () => {
  const draft = buildReport(sampleExam({ status: 'draft' }), sampleSettings);
  assert.match(draft.statusNote, /RASCUNHO/);
  const prelim = buildReport(sampleExam({ status: 'preliminary' }), sampleSettings);
  assert.match(prelim.statusNote, /PRELIMINAR/);
  const fin = buildReport(sampleExam({ status: 'final', finalizedAt: Date.now(), finalizedBy: { name: 'Dra. Teste' } }), sampleSettings);
  assert.equal(fin.statusNote, '');
  assert.match(fin.signature.stamp, /ICP-Brasil/);
  assert.match(fin.footerText, /Documento e1 · versão 1/);
  const blob = await buildDocx(draft, docxLib);
  const f = join(mkdtempSync(join(tmpdir(), 'vq-')), 'a.docx');
  writeFileSync(f, Buffer.from(await blob.arrayBuffer()));
  assert.match(execFileSync('unzip', ['-p', f, 'word/document.xml']).toString(), /RASCUNHO/);
});
test('adendo e retificação aparecem no laudo com a justificativa', () => {
  const r = buildReport(sampleExam({ version: 2, revisionKind: 'addendum', justification: 'Nova informação', addendum: 'Texto do adendo fictício' }), sampleSettings);
  const txt = JSON.stringify(r.blocks);
  assert.match(txt, /Adendo à versão 1/); assert.match(txt, /Nova informação/); assert.match(txt, /Texto do adendo fictício/);
});

import { defaultTemplates } from '../js/templates.js';
import { blankSection } from '../js/exams.js';
import { sectionHasContent } from '../js/quality.js';

test('modelo: medidas pré-definidas viram linhas prontas e vazias, que não contam como conteúdo nem geram alertas', () => {
  const tpl = defaultTemplates().find((t) => t.id === 'tpl-usg-abdominal');
  const adr = tpl.sections.find((s) => s.title === 'Adrenais');
  assert.ok(adr.measures.length === 6 && adr.measures.every((m) => m.unit === 'cm'));
  const s = blankSection(adr.title, adr);
  assert.ok(s.measuresList.every((m) => m.slot && m.value === '' && m.unit === 'cm'));
  assert.equal(sectionHasContent(s), false);
  const e = sampleExam({ sections: [{ ...s, status: '' }] });
  const r = reviewExam(e, { name: 'D', crmv: '1' });
  assert.ok(!r.info.some((i) => /medida sem valor/.test(i)) && !r.critical.some((c) => /medida/.test(c)));
  assert.equal(buildReport(e, sampleSettings).blocks.filter((b) => b.kind === 'section').length, 0);
});
test('modelo: estruturas específicas de sexo e ordem dos órgãos', () => {
  const tpl = defaultTemplates().find((t) => t.id === 'tpl-usg-abdominal');
  const sex = Object.fromEntries(tpl.sections.map((s) => [s.title, s.sex]));
  assert.equal(sex['Próstata'], 'male'); assert.equal(sex['Ovários'], 'female'); assert.equal(sex['Fígado'], '');
  assert.deepEqual(tpl.sections.slice(0, 3).map((s) => s.title), ['Vesícula urinária', 'Rins', 'Fígado']);
});
test('medida preenchida a partir do modelo aparece no laudo com nome e unidade', () => {
  const s = blankSection('Estômago', { measures: [{ label: 'Espessura da parede', unit: 'cm' }] });
  s.measuresList[0].value = '0,31';
  const r = buildReport(sampleExam({ sections: [{ ...s, status: 'normal' }] }), sampleSettings);
  assert.match(JSON.stringify(r.blocks), /Espessura da parede: 0,31 cm/);
});

import { canDelete } from '../js/exams.js';
test('exclusão: auxiliar exclui rascunho mas não laudo finalizado; veterinária exclui ambos', () => {
  const vet = { role: 'vet' }, aux = { role: 'assistant' };
  assert.equal(canDelete({ status: 'draft' }, aux), true); assert.equal(canDelete({ status: 'preliminary' }, aux), true);
  assert.equal(canDelete({ status: 'final' }, aux), false);
  assert.equal(canDelete({ status: 'final' }, vet), true); assert.equal(canDelete({ status: 'draft' }, null), false);
});
