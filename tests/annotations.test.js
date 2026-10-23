import test from 'node:test';
import assert from 'node:assert/strict';
import { makeAnnotation, isMeaningful, documentSource } from '../js/annotations.js';
import { buildReport } from '../js/report-model.js';
import { sampleExam, sampleSettings } from './helpers.js';

test('anotações: coordenadas são limitadas a 0-1 e ferramentas inválidas são rejeitadas', () => {
  const a = makeAnnotation('arrow', { x: -1, y: 2 }, { x: 0.5, y: 0.5 });
  assert.deepEqual([a.x1, a.y1, a.x2, a.y2], [0, 1, 0.5, 0.5]);
  assert.throws(() => makeAnnotation('medida', { x: 0, y: 0 }));
});
test('anotações: marcações vazias são descartadas', () => {
  assert.equal(isMeaningful(makeAnnotation('arrow', { x: 0.2, y: 0.2 }, { x: 0.2, y: 0.2 })), false);
  assert.equal(isMeaningful(makeAnnotation('text', { x: 0.2, y: 0.2 }, null, '  ')), false);
  assert.equal(isMeaningful(makeAnnotation('ellipse', { x: 0.1, y: 0.1 }, { x: 0.4, y: 0.5 })), true);
});
test('laudo usa a cópia anotada e preserva o original; imagem desmarcada não entra', () => {
  const e = sampleExam();
  e.images[0].annotatedSrc = 'data:image/jpeg;base64,ANOTADA';
  e.images[0].annotations = [{ id: 'a' }];
  e.images[1].include = false;
  const r = buildReport(e, sampleSettings);
  assert.equal(r.images.items.length, 2);
  assert.equal(r.images.items[0].dataUrl, 'data:image/jpeg;base64,ANOTADA');
  assert.equal(documentSource(e.images[2]), e.images[2].src);
  assert.ok(e.images[0].src.length > 1000 && e.images[0].src !== e.images[0].annotatedSrc); // original intacto
});
