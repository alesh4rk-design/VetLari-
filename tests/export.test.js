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

test('medidas: só somem do laudo quando o valor exato já está no texto montado', () => {
  const exam = sampleExam({ sections: [{ id: 's1', title: 'Rins', description: '**Rim esquerdo** com dimensões preservadas (4,5 cm).', measures: '', notes: '', build: { def: { blocks: [] }, sel: {}, extras: {}, auto: '' },
    measuresList: [{ id: 'm1', label: 'Rim esquerdo – comprimento', value: '4,5', unit: 'cm' }, { id: 'm2', label: 'Rim direito – comprimento', value: '4', unit: 'cm' }] }] });
  const sec = buildReport(exam, sampleSettings).blocks.find((b) => b.kind === 'section');
  const med = sec.items.find((i) => i.label === 'Medidas');
  assert.ok(med, 'a medida que não está no texto precisa aparecer');
  assert.ok(med.text.includes('Rim direito – comprimento: 4 cm'));
  assert.ok(!med.text.includes('4,5'));
});

test('texto para WhatsApp: mesmo conteúdo, com *negrito* e _itálico_', async () => {
  const { reportToText } = await import('../js/report-model.js');
  const exam = sampleExam({ sections: [{ id: 's1', title: 'Rins', description: 'tópicos e simétricos. **Rim esquerdo** com dimensões preservadas.', measures: '', notes: '' }] });
  const t = reportToText(buildReport(exam, sampleSettings));
  assert.ok(t.includes('*Rins:* tópicos e simétricos. *Rim esquerdo* com dimensões preservadas.'));
  assert.ok(t.includes('Paciente: Thor'));
  assert.ok(t.includes('• Impressão fictícia de teste.') || t.includes('Impressão fictícia de teste.'));
  assert.ok(!t.includes('**'));
});

test('assinatura: imagem só no laudo finalizado, no PDF e no Word', async () => {
  const { fixtureJpeg } = await import('./helpers.js');
  const settings = { ...sampleSettings, signatureImage: fixtureJpeg };
  assert.equal(buildReport(sampleExam(), settings).signature.image, '', 'rascunho não sai assinado');
  const fin = sampleExam({ status: 'final', finalizedAt: Date.now(), finalizedBy: { name: 'Dra. Teste' } });
  const r = buildReport(fin, settings);
  assert.equal(r.signature.image, fixtureJpeg);
  const withSig = buildPdf(r, jsPDF).output('arraybuffer').byteLength;
  const noSig = buildPdf(buildReport(fin, sampleSettings), jsPDF).output('arraybuffer').byteLength;
  assert.ok(withSig > noSig, 'PDF contém a imagem da assinatura');
  const docx = await buildDocx(r, docxLib);
  assert.ok(docx.size > (await buildDocx(buildReport(fin, sampleSettings), docxLib)).size);
});

test('assinatura: não mostra quando o laudo foi feito (nem data nem horário)', () => {
  const at = new Date(2026, 9, 23, 22, 20).getTime();
  const r = buildReport(sampleExam({ status: 'final', finalizedAt: at, finalizedBy: { name: 'Dra. Teste' } }), sampleSettings);
  assert.ok(!/23\/10\/2026|\d{1,2}:\d{2}/.test(r.signature.stamp), r.signature.stamp);
  assert.ok(r.signature.stamp.includes('Finalizado eletronicamente por Dra. Teste'));
});

test('arquivos guardam por dentro a data do exame, não o dia em que o laudo foi feito', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'meta-'));
  for (const [date, expected] of [['2026-10-10', new Date(2026, 9, 10)], ['', new Date(2000, 0, 1)]]) {
    const r = buildReport(sampleExam({ date }), sampleSettings);
    const docx = await buildDocx(r, docxLib);
    writeFileSync(join(dir, 'a.docx'), Buffer.from(await docx.arrayBuffer()));
    const core = execFileSync('unzip', ['-p', join(dir, 'a.docx'), 'docProps/core.xml']).toString();
    assert.equal(new Date(core.match(/<dcterms:created[^>]*>([^<]+)</)[1]).getTime(), expected.getTime(), core);
    const pdf = Buffer.from(buildPdf(r, jsPDF).output('arraybuffer')).toString('latin1');
    const cd = pdf.match(/\/CreationDate \(D:(\d{14})/)[1];
    const p2 = (n) => String(n).padStart(2, '0');
    assert.equal(cd, `${expected.getFullYear()}${p2(expected.getMonth() + 1)}${p2(expected.getDate())}000000`);
  }
});

test('logotipos por laudo: padrão, nenhum ou da biblioteca de clínicas (inclusive dois)', async () => {
  const { resolveLogos } = await import('../js/report-model.js');
  const settings = { ...sampleSettings, logo: 'PAIVA', logo2: '', logoLibrary: [{ id: 'h', name: 'Hamadulu', src: 'HAMA' }, { id: 'c', name: 'Camev', src: 'CAMEV' }] };
  assert.deepEqual(resolveLogos(sampleExam(), settings), { logo: 'PAIVA', logo2: '' });
  assert.deepEqual(resolveLogos(sampleExam({ logos: { logo2: 'h' } }), settings), { logo: 'PAIVA', logo2: 'HAMA' });
  assert.deepEqual(resolveLogos(sampleExam({ logos: { logo: 'c', logo2: 'h' } }), settings), { logo: 'CAMEV', logo2: 'HAMA' });
  assert.deepEqual(resolveLogos(sampleExam({ logos: { logo: 'none', logo2: 'h' } }), settings), { logo: '', logo2: 'HAMA' });
  assert.deepEqual(resolveLogos(sampleExam({ logos: { logo2: 'apagado' } }), settings), { logo: 'PAIVA', logo2: '' });
  assert.equal(buildReport(sampleExam({ logos: { logo2: 'h' } }), settings).logo2, 'HAMA');
});
