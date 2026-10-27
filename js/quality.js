// Controle de qualidade do laudo: regras determinísticas (sem IA). Nunca altera o conteúdo clínico;
// apenas aponta pendências para a profissional corrigir ou justificar.
import { validateExam } from './validation.js';
import { isNumericValue } from './utils.js';
import { pendingMarkers } from './phrase-logic.js';
import { matchReferences, checkMeasure, rangeText, isOutdated } from './reference-logic.js';

export const STRUCTURE_STATUS = {
  '': 'Não informado',
  normal: 'Normal',
  alterado: 'Alterado',
  indeterminado: 'Indeterminado',
  nao_visualizado: 'Não visualizado',
  nao_avaliado: 'Não avaliado',
};
export const MEASURE_UNITS = ['mm', 'cm', 'm', 'mL', 'cm³', 'cm/s', 'm/s', 'mmHg', 'g', 'kg'];

const filled = (v) => String(v ?? '').trim().length > 0;
export { isNumericValue };

export function sectionHasContent(s) {
  return filled(s.description) || filled(s.notes) || filled(s.measures) || (s.measuresList || []).some((m) => filled(m.value));
}

/** Retorna { critical: [...], info: [...] }. Alertas críticos exigem correção ou justificativa para finalizar. */
export function reviewExam(exam, profile = {}, refs = []) {
  const base = validateExam(exam);
  const critical = [...base.errors];
  const info = [...base.warnings];
  const secs = exam.sections || [];

  for (const s of secs) {
    const name = s.title || 'Estrutura';
    const status = s.status || '';
    for (const m of s.measuresList || []) {
      const label = m.label ? `${name} — ${m.label}` : name;
      if (filled(m.value) && !filled(m.unit)) critical.push(`${label}: medida "${m.value}" sem unidade.`);
      else if (filled(m.value) && !isNumericValue(m.value)) critical.push(`${label}: o valor "${m.value}" não parece uma medida (use, por exemplo, 5,2 · 3,2 x 2,1 · 0,35 a 0,41).`);
      else if (!m.slot && !filled(m.value) && (filled(m.unit) || filled(m.label))) info.push(`${label}: medida sem valor.`);
    }
    if ((status === 'nao_avaliado' || status === 'nao_visualizado') && sectionHasContent(s)) {
      critical.push(`${name}: marcada como "${STRUCTURE_STATUS[status]}", mas contém descrição ou medidas. Revise o status ou o texto.`);
    }
    if (status === 'normal' && !sectionHasContent(s)) {
      info.push(`${name}: marcada como "Normal" sem descrição registrada. Confirme que foi avaliada.`);
    }
    if (status === 'alterado' && !filled(s.description)) info.push(`${name}: marcada como "Alterado" sem descrição do achado.`);
    if (!status && sectionHasContent(s)) info.push(`${name}: há texto, mas o status da avaliação está como "Não informado".`);
  }
  // Referências cadastradas e aprovadas pela veterinária (informativo; nunca conclui "normal"/"anormal").
  const species = exam.patient && exam.patient.species;
  const POS = { abaixo: 'abaixo do mínimo', acima: 'acima do máximo' };
  for (const s of secs) {
    for (const m of s.measuresList || []) {
      if (!filled(m.value)) continue;
      for (const r of matchReferences(refs, { species, structure: s.title, label: m.label })) {
        const where = `${s.title || 'Estrutura'} — ${m.label || 'medida'}`;
        const res = checkMeasure(m, r);
        if (res.status === 'unidade_diferente') info.push(`${where}: a unidade difere da referência "${r.title}" (${r.unit}); nenhuma conversão ou comparação foi feita.`);
        else if (POS[res.status]) info.push(`${where}: ${m.value} ${m.unit} está ${POS[res.status]} do intervalo publicado em "${r.title}" (${rangeText(r)}, ${r.species}). Confira o contexto clínico; a interpretação é sua.`);
        if (isOutdated(r)) info.push(`A referência "${r.title}" está sem revisão há mais de 5 anos ou sem data de revisão.`);
      }
    }
  }
  if (secs.length && secs.every((s) => !s.status)) info.push('Nenhuma estrutura teve o status da avaliação informado.');

  const c = exam.clinical || {};
  if (!filled(c.indication)) info.push('Indicação clínica não informada.');
  if (!filled(c.limitations)) info.push('Técnica e limitações do exame não informadas.');
  if (!filled(exam.requestingVet) && !filled(exam.clinic)) info.push('Solicitante/clínica não informados.');
  const pt = exam.patient || {};
  if (!filled(pt.species)) info.push('Cabeçalho: espécie não informada.');
  if (!filled(pt.sex)) info.push('Cabeçalho: sexo não informado.');
  if (!filled(pt.tutor)) info.push('Cabeçalho: tutor/responsável não informado.');
  if (!filled(pt.age) && !filled(pt.birthDate)) info.push('Cabeçalho: idade não informada.');

  // Campos de frases prontas que ficaram sem preenchimento.
  const spots = [['Introdução', exam.intro], ['Impressão diagnóstica', exam.impression], ['Diagnósticos diferenciais', exam.differentials], ['Observações', exam.notes], ['Adendo', exam.addendum],
    ...Object.entries(exam.clinical || {}).map(([k, v]) => [`Exame (${k})`, v]), ...Object.entries(exam.rx || {}).map(([k, v]) => [`Técnica (${k})`, v]),
    ...secs.flatMap((s) => [[`${s.title || 'Estrutura'} — descrição`, s.description], [`${s.title || 'Estrutura'} — observações`, s.notes]])];
  for (const [where, text] of spots) for (const mk of pendingMarkers(text)) critical.push(`${where}: campo pendente ${mk}. Preencha ou remova antes de finalizar.`);

  if (!filled(profile.name)) critical.push('Identificação profissional ausente: preencha seu nome em Configurações.');
  if (!filled(profile.crmv)) critical.push('CRMV da profissional ausente: preencha em Configurações.');
  if (exam.revisionKind && !filled(exam.justification)) critical.push('Revisão sem justificativa.');
  if (exam.revisionKind === 'addendum' && !filled(exam.addendum)) critical.push('Adendo sem texto: escreva o adendo na etapa Conclusão.');

  return { critical: [...new Set(critical)], info: [...new Set(info)] };
}
