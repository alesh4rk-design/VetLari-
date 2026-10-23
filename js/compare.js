// Comparação de medidas entre exames do mesmo paciente. Só calcula diferença quando os dados são
// realmente comparáveis (mesma estrutura, mesma medida, mesma unidade, valores simples). Nunca
// declara crescimento, redução ou evolução: apresenta números e a razão quando não comparáveis.
import { isNumericValue } from './utils.js';

const norm = (s) => String(s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const num = (v) => Number(String(v).trim().replace(',', '.'));
const simple = (v) => isNumericValue(v) && !/[x×]/i.test(String(v));

export function orderByDate(a, b) {
  return [a, b].sort((x, y) => (x.date || '').localeCompare(y.date || '') || (x.version || 0) - (y.version || 0));
}

function collect(exam) {
  const map = new Map();
  for (const s of exam.sections || []) {
    for (const m of s.measuresList || []) {
      if (!String(m.value || '').trim()) continue;
      const key = `${norm(s.title)}|${norm(m.label)}`;
      map.set(key, { structure: s.title, label: m.label || '', value: String(m.value).trim(), unit: String(m.unit || '').trim() });
    }
  }
  return map;
}

export function compareMeasures(earlier, later) {
  const a = collect(earlier), b = collect(later);
  const rows = [];
  for (const key of new Set([...a.keys(), ...b.keys()])) {
    const x = a.get(key), y = b.get(key);
    const ref = x || y;
    const row = { structure: ref.structure, label: ref.label, earlier: x || null, later: y || null, comparable: false, reason: '', delta: null };
    if (!x || !y) row.reason = 'Medida registrada em apenas um dos exames.';
    else if (!x.unit || !y.unit) row.reason = 'Unidade ausente em um dos exames.';
    else if (norm(x.unit) !== norm(y.unit)) row.reason = `Unidades diferentes (${x.unit} e ${y.unit}); nenhuma conversão foi feita.`;
    else if (!simple(x.value) || !simple(y.value)) row.reason = 'Valores compostos (ex.: dimensões) não são comparados automaticamente.';
    else { row.comparable = true; row.delta = Math.round((num(y.value) - num(x.value)) * 1000) / 1000; }
    rows.push(row);
  }
  const notes = [];
  if (earlier.type !== later.type) notes.push('Os exames são de modalidades diferentes.');
  const sp = (e) => norm(e.patient && e.patient.species);
  if (sp(earlier) && sp(later) && sp(earlier) !== sp(later)) notes.push('Espécies diferentes informadas nos dois exames.');
  const cl = (e, k) => norm(e.clinical && e.clinical[k]);
  for (const [k, label] of [['equipment', 'equipamento'], ['operator', 'operador']]) {
    if (cl(earlier, k) && cl(later, k) && cl(earlier, k) !== cl(later, k)) notes.push(`${label[0].toUpperCase() + label.slice(1)} diferente entre os exames: comparar com cautela.`);
    else if (!cl(earlier, k) || !cl(later, k)) notes.push(`${label[0].toUpperCase() + label.slice(1)} não informado em um dos exames.`);
  }
  return { rows, notes };
}
