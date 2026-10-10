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
  assert.ok(validateExam(sampleExam({ date: '' })).errors.length);
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
