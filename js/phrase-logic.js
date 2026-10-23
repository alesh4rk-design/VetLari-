// Frases com campos: "medindo {Comprimento}" é preenchida com o valor e a unidade da medida de mesmo
// nome registrada na estrutura (inclusive medidas calculadas).
//   {Nome}            obrigatório: sem valor vira o marcador "[PREENCHER: Nome]" (alerta crítico na revisão)
//   {?Nome}           opcional: sem valor, o campo some; se estiver dentro de parênteses, o trecho
//                     (ou a cláusula separada por ";") some junto, sem deixar sobra
//   {Nome:valor}      só o número (ex.: "0,31" em "0,31 x 0,37 x 1,48 cm")
//   {Nome:unidade}    só a unidade
// Regras: nada é preenchido por suposição; medida sem unidade conta como ausente; o texto da frase
// nunca é alterado. Em blocos com nome (ex.: "Rim esquerdo"), {Comprimento} também procura a medida
// "Rim esquerdo – Comprimento".
import { norm } from './utils.js';

const TOKEN = /\{(\??)([^{}:]{1,40}?)(?::(valor|unidade))?\}/g;
export const PLACEHOLDER_RE = /\{([^{}]{1,40})\}/g;
export const MARKER_RE = /\[PREENCHER: [^\]]+\]/g;

/** Nomes dos campos obrigatórios e opcionais (sem os símbolos). */
export function placeholderTokens(text) {
  return [...String(text || '').matchAll(TOKEN)].map((m) => ({ optional: m[1] === '?', name: m[2].trim(), mode: m[3] || '' }));
}
export function placeholders(text) {
  return [...new Set(placeholderTokens(text).map((t) => t.name))];
}

/** Chaves/colchetes desbalanceados ou nomes vazios tornam a frase inválida. */
export function placeholderErrors(text) {
  const t = String(text || '');
  const errors = [];
  if ((t.match(/\{/g) || []).length !== (t.match(/\}/g) || []).length) errors.push('As chaves { } da frase estão desbalanceadas.');
  if (/\{\s*\??\s*\}/.test(t)) errors.push('Há um campo { } sem nome.');
  return errors;
}

function lookup(name, measures, prefix) {
  const names = [norm(name)];
  if (prefix) names.unshift(norm(`${prefix} – ${name}`), norm(`${prefix} - ${name}`));
  return (measures || []).find((x) => names.includes(norm(x.label)) && String(x.value || '').trim());
}

function resolveToken(tok, measures, extras, prefix) {
  const typed = Object.entries(extras).find(([k]) => norm(k) === norm(tok.name));
  if (typed && String(typed[1]).trim()) return { value: String(typed[1]).trim() };
  const m = lookup(tok.name, measures, prefix);
  if (!m) return { reason: 'sem medida com esse nome' };
  const value = String(m.value).trim(), unit = String(m.unit || '').trim();
  if (tok.mode === 'valor') return { value };
  if (!unit) return { reason: 'medida sem unidade' };
  return { value: tok.mode === 'unidade' ? unit : `${value} ${unit}` };
}

/** extras: { nome: 'texto digitado' }. opts.prefix: nome do bloco (ex.: "Rim esquerdo"). */
export function fillPhrase(text, measures = [], extras = {}, opts = {}) {
  const missing = [];
  const note = (tok, reason) => { if (!tok.optional && !missing.some((x) => x.name === tok.name)) missing.push({ name: tok.name, reason }); };
  const sub = (chunk) => {
    let optionalMissing = false;
    const out = chunk.replace(TOKEN, (_, q, raw, mode) => {
      const tok = { optional: q === '?', name: raw.trim(), mode: mode || '' };
      const r = resolveToken(tok, measures, extras, opts.prefix);
      if (r.value !== undefined) return r.value;
      if (tok.optional) { optionalMissing = true; return ''; }
      note(tok, r.reason);
      return `[PREENCHER: ${tok.name}]`;
    });
    return { out, optionalMissing };
  };
  // Parênteses com campos opcionais: cada cláusula (separada por ";") sem valor some; sem sobra, o trecho todo some.
  const text1 = String(text).replace(/ ?\(([^()]*)\)/g, (full, inner) => {
    if (!/\{\?/.test(inner)) return full;
    const kept = inner.split(';').map((c) => sub(c.trim())).filter((r) => !r.optionalMissing).map((r) => r.out);
    return kept.length ? ` (${kept.join('; ')})` : '';
  });
  const { out } = sub(text1);
  return { text: out, missing };
}

export const pendingMarkers = (text) => String(text || '').match(MARKER_RE) || [];
