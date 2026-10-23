// Controle de qualidade do laudo: regras determinísticas (sem IA). Nunca altera o conteúdo clínico;
// apenas aponta pendências para a profissional corrigir ou justificar.
import { validateExam } from './validation.js';

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
/** Aceita "5", "5,2", "5.2" e dimensões como "3,2 x 2,1". O valor digitado é preservado como texto. */
export const isNumericValue = (v) => /^\d+([.,]\d+)?(\s*[x×]\s*\d+([.,]\d+)?)*$/.test(String(v).trim());

export function sectionHasContent(s) {
  return filled(s.description) || filled(s.notes) || filled(s.measures) || (s.measuresList || []).some((m) => filled(m.value) || filled(m.label));
}

/** Retorna { critical: [...], info: [...] }. Alertas críticos exigem correção ou justificativa para finalizar. */
export function reviewExam(exam, profile = {}) {
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
  if (secs.length && secs.every((s) => !s.status)) info.push('Nenhuma estrutura teve o status da avaliação informado.');

  const c = exam.clinical || {};
  if (!filled(c.indication)) info.push('Indicação clínica não informada.');
  if (!filled(c.limitations)) info.push('Técnica e limitações do exame não informadas.');
  if (!filled(exam.requestingVet) && !filled(exam.clinic)) info.push('Solicitante/clínica não informados.');

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
