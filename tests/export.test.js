import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildReport } from '../js/report-model.js';
import { buildPdf } from '../js/pdf-export.js';
import { buildDocx } from '../js/docx-export.js';
import { reportFileName } from '../js/utils.js';
import { docxLib, jsPDF, sampleExam, sampleSettings } from './helpers.js';

test('modelo: omite campos vazios e não presume normalidade', () => {
  const r = buildReport(sampleExam(), sampleSettings);
  const titles = r.blocks.filter((b) => b.kind === 'section').map((b) => b.title);
  assert.deepEqual(titles, ['Fígado']); // Baço está vazio e não aparece
  assert.ok(!JSON.stringify(r).includes('normal'));
  assert.ok(r.patientRows.some(([k, v]) => k === 'Peso' && v === '12,5 kg'));
  assert.ok(r.patientRows.some(([k, v]) => k === 'Idade' && /anos/.test(v)));
});
test('modelo: legenda combina região e texto', () => {
  const r = buildReport(sampleExam(), sampleSettings);
  assert.equal(r.images.items[0].caption, 'Fígado — Imagem 1');
});
test('nome de arquivo padronizado', () => {
  assert.equal(reportFileName(sampleExam({ patient: { name: 'Théo Ção' } }), 'docx'), 'Laudo_USG_Theo_Cao_2026-10-10.docx');
  assert.equal(reportFileName(sampleExam({ type: 'rx' }), 'pdf'), 'Laudo_RX_Thor_2026-10-10.pdf');
});
test('PDF: gera com imagens e texto selecionável', () => {
  const doc = buildPdf(buildReport(sampleExam(), sampleSettings), jsPDF);
  const buf = Buffer.from(doc.output('arraybuffer'));
  assert.equal(buf.slice(0, 5).toString(), '%PDF-');
  assert.ok(doc.getNumberOfPages() >= 1);
  assert.ok(buf.length > 20000, 'imagens devem estar embutidas');
});
test('PDF: documento longo pagina corretamente', () => {
  const secs = Array.from({ length: 40 }, (_, i) => ({ id: 's' + i, title: 'Estrutura ' + i, description: 'Descrição fictícia. '.repeat(40), measures: '1 cm', notes: '' }));
  const images = Array.from({ length: 9 }, (_, i) => ({ ...sampleExam().images[0], id: 'x' + i }));
  const doc = buildPdf(buildReport(sampleExam({ sections: secs, images }), sampleSettings), jsPDF);
  assert.ok(doc.getNumberOfPages() > 3, `páginas: ${doc.getNumberOfPages()}`);
});
test('Word: gera .docx válido contendo as imagens', async () => {
  const blob = await buildDocx(buildReport(sampleExam(), sampleSettings), docxLib);
  const dir = mkdtempSync(join(tmpdir(), 'vl-'));
  const file = join(dir, 'laudo.docx');
  writeFileSync(file, Buffer.from(await blob.arrayBuffer()));
  const list = execFileSync('unzip', ['-l', file]).toString();
  assert.match(list, /word\/document\.xml/);
  assert.equal((list.match(/word\/media\/\S+\.\w+/g) || []).length, 3, 'três imagens embutidas');
  const xml = execFileSync('unzip', ['-p', file, 'word/document.xml']).toString();
  assert.match(xml, /Texto descritivo fictício do fígado/);
  assert.ok(!/Baço/.test(xml));
});
