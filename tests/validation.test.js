import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePatient, validateExam, validateImageFile, validatePhrase, validatePhraseImport, validateBackup } from '../js/validation.js';
import { sampleExam } from './helpers.js';

test('paciente: apenas o nome é obrigatório (cadastro rápido)', () => {
  assert.deepEqual(validatePatient({ name: 'Rex' }), []);
  assert.equal(validatePatient({ name: '  ' }).length, 1);
});
test('paciente: peso, nascimento e sexo inconsistentes', () => {
  assert.ok(validatePatient({ name: 'A', weight: '-3' }).length);
  assert.ok(validatePatient({ name: 'A', weight: 'abc' }).length);
  assert.deepEqual(validatePatient({ name: 'A', weight: '12,5' }), []);
  assert.ok(validatePatient({ name: 'A', birthDate: '2999-01-01' }).length);
  assert.ok(validatePatient({ name: 'A', sex: 'Outro' }).length);
});
test('exame: completo é válido', () => {
  const r = validateExam(sampleExam());
  assert.deepEqual(r.errors, []);
});
test('exame: campos vazios bloqueiam finalização', () => {
  const r = validateExam(sampleExam({ sections: [{ id: 'a', title: 'x', description: '', measures: '', notes: '' }], impression: '' }));
  assert.ok(r.errors.some((e) => /achado/.test(e)));
});
test('exame: inconsistências de data', () => {
  assert.ok(validateExam(sampleExam({ date: '2019-01-01' })).errors.some((e) => /nascimento/.test(e)));
  assert.ok(validateExam(sampleExam({ date: '2999-01-01' })).warnings.some((w) => /futuro/.test(w)));
  assert.deepEqual(validateExam(sampleExam({ date: '' })).errors, []); // data é opcional
  assert.ok(validateExam(sampleExam({ date: '2026-13-45' })).errors.some((e) => /inválida/.test(e)));
  assert.ok(validateExam(sampleExam({ time: '25h' })).errors.some((e) => /hora/.test(e)));
});
test('exame: avisos de imagem sem legenda e impressão vazia', () => {
  const r = validateExam(sampleExam({ impression: '' }));
  assert.ok(r.warnings.some((w) => /impressão/i.test(w)));
  assert.ok(r.warnings.some((w) => /sem legenda/.test(w)));
});
test('imagem: tipo e tamanho', () => {
  assert.equal(validateImageFile({ name: 'a.gif', type: 'image/gif', size: 10 }, 100).ok, false);
  assert.equal(validateImageFile({ name: 'a.jpg', type: 'image/jpeg', size: 1000 }, 100).ok, false);
  assert.equal(validateImageFile({ name: 'a.jpg', type: 'image/jpeg', size: 50 }, 100).ok, true);
});
test('frases: validação e importação', () => {
  assert.ok(validatePhrase({ title: '', text: 'x' }).length);
  assert.deepEqual(validatePhrase({ title: 'a', text: 'b' }), []);
  assert.equal(validatePhraseImport({}).ok, false);
  const r = validatePhraseImport([{ title: 'a', text: 'b' }, { title: '', text: '' }]);
  assert.equal(r.phrases.length, 1); assert.equal(r.skipped, 1);
});
test('backup: estrutura', () => {
  assert.ok(validateBackup(null));
  assert.ok(validateBackup({ app: 'outro', stores: {} }));
  assert.ok(validateBackup({ app: 'vetlaudo', stores: { exams: 'x' } }));
  assert.equal(validateBackup({ app: 'vetlaudo', stores: { exams: [] } }), null);
});

test('data e hora do exame são opcionais: sem elas o laudo não mostra o campo e o nome do arquivo fica sem data', async () => {
  const { buildReport } = await import('../js/report-model.js');
  const { reportFileName } = await import('../js/utils.js');
  const { sampleSettings } = await import('./helpers.js');
  const semData = buildReport(sampleExam({ date: '', time: '' }), sampleSettings);
  assert.ok(!semData.patientRows.some(([k]) => k === 'Data' || k === 'Hora'));
  assert.equal(semData.dateText, '');
  const soHora = buildReport(sampleExam({ date: '', time: '10:58' }), sampleSettings);
  assert.deepEqual(soHora.patientRows.find(([k]) => k === 'Hora'), ['Hora', '10:58']);
  const soData = buildReport(sampleExam({ date: '2026-10-10', time: '' }), sampleSettings);
  assert.deepEqual(soData.patientRows.find(([k]) => k === 'Data'), ['Data', '10/10/2026']);
  assert.equal(reportFileName(sampleExam({ date: '' }), 'pdf'), 'Laudo_USG_Thor.pdf');
  assert.equal(validateExam(sampleExam({ date: '', time: '' })).errors.length, 0);
});

test('paciente: peso em gramas aceita valores de animais pequenos', () => {
  assert.deepEqual(validatePatient({ name: 'A', weight: '350', weightUnit: 'g' }), []);
  assert.ok(validatePatient({ name: 'A', weight: '350', weightUnit: 'kg' }).length === 0);
  assert.ok(validatePatient({ name: 'A', weight: '5000', weightUnit: 'kg' }).length);
});

test('novo laudo a partir de um anterior: copia tudo, menos as imagens', async () => {
  const { copyFrom } = await import('../js/exams.js');
  const prev = sampleExam({ status: 'final', finalizedAt: Date.now(), finalizedBy: { name: 'Dra.' }, history: [{ ts: 1, action: 'x', version: 1 }], logos: { logo2: 'h' }, time: '10:00' });
  const c = copyFrom(prev, { name: 'Dra.', role: 'vet' });
  assert.notEqual(c.id, prev.id);
  assert.equal(c.status, 'draft'); assert.equal(c.version, 1);
  assert.deepEqual(c.images, []); assert.ok(prev.images.length > 0, 'o original continua com as imagens');
  assert.equal(c.date, ''); assert.equal(c.time, '');
  assert.equal(c.patient.name, prev.patient.name); assert.equal(c.impression, prev.impression);
  assert.equal(c.sections[0].description, prev.sections[0].description); assert.deepEqual(c.logos, prev.logos);
  assert.equal(c.finalizedAt, null);
  assert.ok(c.history.some((h) => /sem as imagens/.test(h.action)));
});
