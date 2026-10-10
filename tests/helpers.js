import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

globalThis.self ??= globalThis;
globalThis.window ??= globalThis;
// Os arquivos UMD são carregados como CommonJS (o package.json do projeto usa "type": "module").
function loadUmd(file) {
  const module = { exports: {} };
  new Function('module', 'exports', 'require', readFileSync(join(here, '../assets/vendor', file), 'utf8'))(module, module.exports, require);
  return module.exports;
}
export const docxLib = loadUmd('docx.umd.js');
export const { jsPDF } = loadUmd('jspdf.umd.min.js');

export const fixtureJpeg = 'data:image/jpeg;base64,' + readFileSync(join(here, 'fixture-usg.jpg')).toString('base64');

export function sampleExam(over = {}) {
  return {
    id: 'e1', type: 'usg', status: 'draft', version: 1, date: '2026-10-10',
    patient: { name: 'Thor', species: 'Canino', breed: 'SRD', sex: 'Macho', weight: '12.5', tutor: 'Maria Teste', birthDate: '2020-05-10' },
    clinic: 'Clínica Teste', requestingVet: 'Dr. Fictício',
    layout: { docTitle: 'Laudo de Ultrassonografia Veterinária', conclusionTitle: 'Impressão diagnóstica', notesTitle: 'Observações e recomendações', signature: true },
    imagesPerRow: 2,
    sections: [
      { id: 's1', title: 'Fígado', description: 'Texto descritivo fictício do fígado.\nSegunda linha.', measures: '5,0 cm', notes: '' },
      { id: 's2', title: 'Baço', description: '', measures: '', notes: '' },
    ],
    impression: 'Impressão fictícia de teste.', notes: '',
    images: [
      { id: 'i1', src: fixtureJpeg, w: 800, h: 600, caption: 'Imagem 1', region: 'Fígado', scale: 1 },
      { id: 'i2', src: fixtureJpeg, w: 800, h: 600, caption: 'Imagem 2', region: '', scale: 0.8 },
      { id: 'i3', src: fixtureJpeg, w: 800, h: 600, caption: '', region: '', scale: 1 },
    ],
    ...over,
  };
}

export const sampleSettings = {
  professional: { name: 'Dra. Teste', crmv: '12345', uf: 'SP', service: 'Serviço de Imagem', contact: '' },
  headerText: '', footerText: 'Rodapé de teste', logo: '', font: 'sans', fontSize: 11,
};
