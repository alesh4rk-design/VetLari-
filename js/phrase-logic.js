// Frases prontas com campos: "medindo {Comprimento}" é preenchida com o valor e a unidade da medida
// de mesmo nome registrada na estrutura (inclusive medidas calculadas). Regras:
//  - nada é preenchido por suposição: campo sem valor (ou medida sem unidade) vira o marcador
//    "[PREENCHER: nome]", que a revisão do laudo aponta como pendência crítica;
//  - vírgula decimal é preservada como digitada; o texto da frase em si nunca é alterado.
import { norm } from './utils.js';

export const PLACEHOLDER_RE = /\{([^{}]{1,40})\}/g;
export const MARKER_RE = /\[PREENCHER: [^\]]+\]/g;

export function placeholders(text) {
  return [...new Set([...String(text || '').matchAll(PLACEHOLDER_RE)].map((m) => m[1].trim()))];
}

/** Chaves/colchetes desbalanceados ou nomes vazios tornam a frase inválida. */
export function placeholderErrors(text) {
  const t = String(text || '');
  const errors = [];
  if ((t.match(/\{/g) || []).length !== (t.match(/\}/g) || []).length) errors.push('As chaves { } da frase estão desbalanceadas.');
  if (/\{\s*\}/.test(t)) errors.push('Há um campo { } sem nome.');
  return errors;
}

/** Valor "5,2 cm" da medida de mesmo nome (ou null com o motivo). */
function measureValue(name, measures) {
  const m = (measures || []).find((x) => norm(x.label) === norm(name) && String(x.value || '').trim());
  if (!m) return { reason: 'sem medida com esse nome' };
  if (!String(m.unit || '').trim()) return { reason: 'medida sem unidade' };
  return { value: `${String(m.value).trim()} ${String(m.unit).trim()}` };
}

/** extras: { nome: 'texto digitado' } para campos que não vêm de medidas (ex.: grau). */
export function fillPhrase(text, measures = [], extras = {}) {
  const missing = [];
  const out = String(text).replace(PLACEHOLDER_RE, (_, raw) => {
    const name = raw.trim();
    const typed = Object.entries(extras).find(([k]) => norm(k) === norm(name));
    if (typed && String(typed[1]).trim()) return String(typed[1]).trim();
    const r = measureValue(name, measures);
    if (r.value) return r.value;
    if (!missing.some((x) => x.name === name)) missing.push({ name, reason: r.reason });
    return `[PREENCHER: ${name}]`;
  });
  return { text: out, missing };
}

export const pendingMarkers = (text) => String(text || '').match(MARKER_RE) || [];
