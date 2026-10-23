// Validação de dados. Funções puras (testáveis em Node).
import { todayISO } from './utils.js';
import { placeholderErrors } from './phrase-logic.js';

export const SEXES = ['', 'Macho', 'Fêmea', 'Macho castrado', 'Fêmea castrada', 'Não informado'];
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const MAX_TEXT = 200;
const MAX_LONG = 20000;

export function validatePatient(p) {
  const errors = [];
  if (!p || !String(p.name || '').trim()) errors.push('Informe o nome do animal.');
  for (const k of ['name', 'species', 'breed', 'tutor', 'clinic', 'requestingVet', 'identifier', 'age']) {
    if (p && String(p[k] || '').length > MAX_TEXT) errors.push(`O campo "${k}" excede ${MAX_TEXT} caracteres.`);
  }
  if (p && p.sex && !SEXES.includes(p.sex)) errors.push('Sexo inválido.');
  if (p && p.weight !== '' && p.weight != null) {
    const w = Number(String(p.weight).replace(',', '.'));
    if (!isFinite(w) || w <= 0 || w > 1500) errors.push('Peso inválido (use kg, ex.: 12,5).');
  }
  if (p && p.birthDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.birthDate) || isNaN(new Date(p.birthDate))) errors.push('Data de nascimento inválida.');
    else if (p.birthDate > todayISO()) errors.push('A data de nascimento está no futuro.');
  }
  return errors;
}

function hasText(v) { return String(v || '').trim().length > 0; }

/** Retorna { errors, warnings }. Erros bloqueiam a finalização; avisos apenas alertam. */
export function validateExam(exam) {
  const errors = [];
  const warnings = [];
  if (!exam) return { errors: ['Exame inexistente.'], warnings };
  if (!hasText(exam.patient && exam.patient.name)) errors.push('Informe o nome do animal.');
  if (!exam.date || !/^\d{4}-\d{2}-\d{2}$/.test(exam.date) || isNaN(new Date(exam.date))) errors.push('Informe uma data de exame válida.');
  else {
    if (exam.date > todayISO()) warnings.push('A data do exame está no futuro.');
    const bd = exam.patient && exam.patient.birthDate;
    if (bd && bd > exam.date) errors.push('A data de nascimento é posterior à data do exame.');
  }
  const secs = exam.sections || [];
  const anySection = secs.some((s) => hasText(s.description) || hasText(s.measures) || hasText(s.notes));
  if (!anySection && !hasText(exam.impression)) errors.push('Preencha ao menos um achado ou a impressão diagnóstica.');
  if (!hasText(exam.impression)) warnings.push('A impressão diagnóstica está vazia.');
  if (exam.type === 'rx') {
    if (!hasText(exam.rx && exam.rx.region)) warnings.push('A região anatômica examinada não foi informada.');
    if (!hasText(exam.rx && exam.rx.projections)) warnings.push('As projeções realizadas não foram informadas.');
  }
  for (const [k, v] of Object.entries({ impression: exam.impression, notes: exam.notes })) {
    if (String(v || '').length > MAX_LONG) errors.push(`O campo "${k}" é muito longo.`);
  }
  const emptyTitle = secs.filter((s) => !hasText(s.title)).length;
  if (emptyTitle) warnings.push(`${emptyTitle} estrutura(s) sem nome.`);
  const noCaption = (exam.images || []).filter((i) => !hasText(i.caption)).length;
  if (noCaption) warnings.push(`${noCaption} imagem(ns) sem legenda.`);
  return { errors, warnings };
}

export function validateImageFile(file, maxBytes) {
  if (!file) return { ok: false, reason: 'Arquivo inválido.' };
  if (!IMAGE_TYPES.includes(file.type)) return { ok: false, reason: `"${file.name}": formato não suportado (use JPEG, PNG ou WebP).` };
  if (file.size > maxBytes) return { ok: false, reason: `"${file.name}": arquivo maior que o limite configurado.` };
  if (file.size === 0) return { ok: false, reason: `"${file.name}": arquivo vazio.` };
  return { ok: true };
}

export function validatePhrase(p) {
  const errors = [];
  if (!p || !hasText(p.title)) errors.push('Informe um nome curto para a frase.');
  if (!p || !hasText(p.text)) errors.push('Informe o texto da frase.');
  if (p && String(p.title || '').length > 120) errors.push('O nome da frase excede 120 caracteres.');
  if (p && String(p.text || '').length > 5000) errors.push('O texto da frase excede 5000 caracteres.');
  if (p) errors.push(...placeholderErrors(p.text));
  return errors;
}

export function validatePhraseImport(data) {
  if (!Array.isArray(data)) return { ok: false, reason: 'O arquivo deve conter uma lista de frases.' };
  const phrases = data.filter((p) => p && validatePhrase(p).length === 0);
  return { ok: true, phrases, skipped: data.length - phrases.length };
}

export const BACKUP_STORES = ['patients', 'exams', 'phrases', 'templates', 'settings', 'references', 'calculations'];

export function validateBackup(b) {
  if (!b || typeof b !== 'object') return 'Arquivo de backup inválido.';
  if (b.app !== 'vetlaudo') return 'Este arquivo não é um backup do VetLaudo.';
  if (!b.stores || typeof b.stores !== 'object') return 'Backup sem dados.';
  for (const s of BACKUP_STORES) if (b.stores[s] != null && !Array.isArray(b.stores[s])) return `Backup corrompido (${s}).`;
  return null;
}
