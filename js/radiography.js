// Particularidades do laudo de radiografia: região, projeções e qualidade técnica.
import { esc } from './utils.js';

export const RADIOGRAPHY = {
  type: 'rx',
  regionLabel: 'Região examinada',
  techniqueHtml: (exam, locked) => `<div class="card"><h2>Técnica</h2>
    <div class="field"><label for="rx-region">Região anatômica examinada</label><input id="rx-region" data-bind="rx.region" value="${esc(exam.rx.region)}" ${locked ? 'disabled' : ''}></div>
    <div class="field"><label for="rx-proj">Projeções radiográficas realizadas</label><input id="rx-proj" data-bind="rx.projections" value="${esc(exam.rx.projections)}" ${locked ? 'disabled' : ''}></div>
    <div class="field"><label for="rx-q">Qualidade técnica e limitações do exame</label>
      <textarea id="rx-q" data-bind="rx.quality" rows="3" ${locked ? 'disabled' : ''}>${esc(exam.rx.quality)}</textarea>
      ${locked ? '' : `<div class="row"><button type="button" class="btn sm ghost" data-act="phrase" data-target="rx-q" data-structure="Qualidade técnica e limitações">Inserir frase</button>
      <button type="button" class="btn sm ghost" data-act="dictate" data-target="rx-q" data-label="Qualidade técnica e limitações">Ditar</button>
      <button type="button" class="btn sm ghost" data-act="save-phrase" data-target="rx-q" data-where="Qualidade técnica e limitações">Guardar esta frase</button></div>`}</div></div>`,
  findingsHint: 'Os campos abaixo vêm do seu modelo e podem ser alterados. Nada é preenchido automaticamente.',
};
