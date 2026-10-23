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
  return filled(s.description) || filled(s.notes) || filled(s.measures) || (s.measuresList || []).some((m) => filled(m.value) || filled(m.label));
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
      else if (filled(m.value) && !isNumericValue(m.value)) critical.push(`${label}: o valor "${m.value}" não é numérico (use, por exemplo, 5,2 ou 3,2 x 2,1).`);
      else if (!filled(m.value) && (filled(m.unit) || filled(m.label))) info.push(`${label}: medida sem valor.`);
    }
    if ((status === 'nao_avaliado' || status === 'nao_visualizado') && sectionHasContent(s)) {
      critical.push(`${name}: marcada como "${STRUCTURE_STATUS[status]}", mas contém descrição ou medidas. Revise o status ou o texto.`);
    }
    if (status === 'normal' && (s.measuresList || []).length === 0 && !filled(s.description) && !filled(s.measures)) {
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

export const FINAL_CHECKLIST = [
  'O paciente e o tutor estão corretos',
  'O exame e a data foram conferidos',
  'As estruturas não examinadas ou não avaliáveis estão identificadas',
  'As medidas têm unidade e foram conferidas',
  'Os achados foram revisados',
  'A conclusão foi revisada',
  'As limitações do exame foram registradas quando relevantes',
  'Solicitante e profissional foram conferidos',
];
