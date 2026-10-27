// Regras puras da base de referências, que é cadastrada e aprovada pela própria veterinária.
// O sistema NÃO traz valores de referência prontos, NÃO aplica referência de uma espécie a outra e
// NÃO classifica nada como "normal" ou "anormal": só informa a posição do valor frente ao intervalo
// publicado na fonte cadastrada, deixando a interpretação para a profissional.
import { norm, isSingleNumber } from './utils.js';
import { speciesKey } from './animals.js';

export const OUTDATED_YEARS = 5;
const has = (v) => String(v ?? '').trim().length > 0;
const isNum = (v) => has(v) && /^-?\d+([.,]\d+)?$/.test(String(v).trim());
const toNum = (v) => Number(String(v).trim().replace(',', '.'));
const isUrl = (u) => /^https?:\/\/\S+$/i.test(String(u || '').trim());

export const REF_KINDS = { scientific: 'Referência científica', institutional: 'Regra institucional da clínica' };

export function validateReference(r) {
  const errors = [], warnings = [];
  if (!has(r.title)) errors.push('Informe o nome da referência.');
  if (!has(r.citation)) errors.push('Informe a fonte (autores/instituição, publicação e ano).');
  if (has(r.min) || has(r.max)) {
    if (!has(r.species)) errors.push('Intervalo informado sem a espécie estudada: o sistema não aplica valores entre espécies.');
    if (!has(r.unit)) errors.push('Intervalo informado sem unidade.');
    if (has(r.min) && !isNum(r.min)) errors.push('Mínimo inválido (use número).');
    if (has(r.max) && !isNum(r.max)) errors.push('Máximo inválido (use número).');
    if (isNum(r.min) && isNum(r.max) && toNum(r.min) > toNum(r.max)) errors.push('O mínimo é maior que o máximo.');
    if (!has(r.measureLabel)) warnings.push('Nome da medida não informado: a referência não será associada automaticamente a uma medida.');
  }
  if (r.kind === 'scientific' && !has(r.doi) && !isUrl(r.url)) warnings.push('Sem DOI/URL verificável: a referência não poderá ser aprovada.');
  if (has(r.url) && !isUrl(r.url)) errors.push('URL inválida (deve começar com http:// ou https://).');
  if (!has(r.method)) warnings.push('Método de aquisição/medição não informado.');
  if (!has(r.limitations)) warnings.push('Limitações da referência não informadas.');
  return { errors, warnings };
}

export function canApprove(r) {
  const { errors } = validateReference(r);
  if (errors.length) return { ok: false, reason: errors[0] };
  if (r.kind === 'scientific' && !has(r.doi) && !isUrl(r.url)) return { ok: false, reason: 'Referência científica precisa de DOI ou URL verificável.' };
  if (!has(r.species)) return { ok: false, reason: 'Informe a espécie e a população estudadas.' };
  return { ok: true };
}

export function isOutdated(r, now = new Date()) {
  if (!has(r.revisionDate)) return true;
  const d = new Date(r.revisionDate);
  return isNaN(d) || (now - d) / 31557600000 > OUTDATED_YEARS;
}

/** Só referências APROVADAS, da mesma espécie; estrutura e medida filtram quando informadas na referência. */
export function matchReferences(refs, { species, structure, label }) {
  if (!has(species)) return [];
  return refs.filter((r) => r.status === 'approved'
    && speciesKey(r.species) === speciesKey(species)
    && (!has(r.structure) || norm(r.structure) === norm(structure))
    && (!has(label) || !has(r.measureLabel) || norm(r.measureLabel) === norm(label)));
}

/** Posição do valor frente ao intervalo cadastrado. Sem juízo clínico. */
export function checkMeasure(m, r) {
  if (!has(r.min) && !has(r.max)) return { status: 'sem_intervalo' };
  if (!has(m.unit) || norm(m.unit) !== norm(r.unit)) return { status: 'unidade_diferente' };
  if (!isSingleNumber(m.value)) return { status: 'sem_comparacao' };
  const v = toNum(m.value);
  if (isNum(r.min) && v < toNum(r.min)) return { status: 'abaixo' };
  if (isNum(r.max) && v > toNum(r.max)) return { status: 'acima' };
  return { status: 'dentro' };
}

export const rangeText = (r) => [has(r.min) ? `mín. ${r.min}` : '', has(r.max) ? `máx. ${r.max}` : ''].filter(Boolean).join(' · ') + (has(r.unit) ? ` ${r.unit}` : '');

/** Importação: sempre entra como rascunho; nada é aprovado automaticamente. */
export function sanitizeImportedReferences(data) {
  if (!Array.isArray(data)) return { ok: false, reason: 'O arquivo deve conter uma lista de referências.' };
  const refs = data.filter((r) => r && typeof r === 'object' && validateReference(r).errors.length === 0)
    .map((r) => ({ ...r, status: 'draft', approvedBy: '', approvedAt: '' }));
  return { ok: true, refs, skipped: data.length - refs.length };
}
