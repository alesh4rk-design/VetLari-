// Montador de descrição: a veterinária marca opções e digita medidas; o sistema escreve a frase no
// estilo dela. Regras (função pura):
//  - só entra no texto o que foi marcado: nada é escolhido ou presumido pelo sistema;
//  - todo trecho vem das opções cadastradas por ela (o sistema não escreve conteúdo clínico);
//  - medidas e campos vêm dos valores digitados; campo obrigatório sem valor vira [PREENCHER: nome].
import { fillPhrase } from './phrase-logic.js';

export const KINDS = {
  one: 'Escolha uma (entra na frase)',
  many: 'Escolha várias (entram na frase)',
  sentence: 'Frase separada (escolha uma)',
  sentences: 'Frases separadas (escolha várias)',
};
const isFragment = (k) => k === 'one' || k === 'many';
const isSingle = (k) => k === 'one' || k === 'sentence';

/** Expande blocos com vários nomes (ex.: "Rim esquerdo; Rim direito") em blocos independentes. */
export function expandBlocks(def) {
  const out = [];
  (def && def.blocks ? def.blocks : []).forEach((b, bi) => {
    const labels = b.labels && b.labels.length ? b.labels : [''];
    labels.forEach((label, li) => out.push({
      key: `${bi}.${li}`, label, last: b.last === ',' ? ',' : 'e',
      groups: (b.groups || []).map((g, gi) => ({ ...g, key: `${bi}.${li}.${gi}`, options: g.options || [] })),
    }));
  });
  return out;
}

const strip = (t) => String(t).trim().replace(/[.;,\s]+$/, '');
/** Termina com ponto final mantendo o destaque (**…** / __…__) fechado depois dele. */
const closeSentence = (t) => { const m = /^([\s\S]*?)((?:\*\*|__)*)$/.exec(String(t).trim()); return `${strip(m[1])}.${m[2]}`; };
export function joinList(items, last = 'e') {
  const l = items.map(strip).filter(Boolean);
  if (l.length <= 1) return l[0] || '';
  const sep = last === ',' ? ', ' : ' e ';
  return `${l.slice(0, -1).join(', ')}${sep}${l[l.length - 1]}`;
}

function chosen(group, sel) {
  const idx = (sel && sel[group.key]) || [];
  return idx.map((i) => group.options[i]).filter(Boolean);
}

/** Alterna uma opção respeitando "escolha uma" (clicar de novo desmarca). Retorna nova seleção. */
export function toggleOption(def, sel, groupKey, optIndex) {
  const group = expandBlocks(def).flatMap((b) => b.groups).find((g) => g.key === groupKey);
  if (!group) return sel;
  const cur = (sel[groupKey] || []).slice();
  const at = cur.indexOf(optIndex);
  let next;
  if (at >= 0) next = cur.filter((i) => i !== optIndex);
  else next = isSingle(group.kind) ? [optIndex] : [...cur, optIndex].sort((a, b) => a - b);
  return { ...sel, [groupKey]: next };
}

/** Seleção do "texto padrão sem alterações" do órgão: as opções marcadas com `n` no catálogo/modelo. Vazia se o órgão não tiver. */
export function normalSelection(def) {
  const sel = {};
  for (const g of expandBlocks(def).flatMap((b) => b.groups)) {
    const idx = g.options.map((o, i) => (o.n ? i : -1)).filter((i) => i >= 0);
    if (idx.length) sel[g.key] = isSingle(g.kind) ? [idx[0]] : idx;
  }
  return sel;
}

/** Texto final. Retorna '' quando nada foi marcado. */
export function composeDescription(def, sel = {}, measures = [], extras = {}) {
  const paragraphs = [];
  for (const block of expandBlocks(def)) {
    const fill = (t) => fillPhrase(t, measures, extras, { prefix: block.label }).text;
    const picked = block.groups.map((g) => ({ g, opts: chosen(g, sel) }));
    const excl = picked.flatMap((p) => p.opts).filter((o) => o.excl);
    let fragments = [], sentences = [];
    if (excl.length) fragments = excl.map((o) => ({ text: fill(o.text), glue: false }));
    else {
      for (const { g, opts } of picked) {
        if (isFragment(g.kind)) fragments.push(...opts.map((o) => ({ text: fill(o.text), glue: !!o.glue, solo: o.solo ? fill(o.solo) : '' })));
        else sentences.push(...opts.map((o) => fill(o.text)));
      }
    }
    // Opções "coladas" (glue) se ligam à anterior só com espaço (ex.: "repleção adequada por conteúdo...").
    const segments = [];
    for (const f of fragments) { if (f.glue && segments.length) segments[segments.length - 1] += ` ${f.text}`; else segments.push(f.glue && f.solo ? f.solo : f.text); }
    const parts = [];
    if (segments.length) parts.push(`${block.label ? `**${block.label}** ` : ''}${joinList(segments, block.last)}.`);
    for (const s of sentences) parts.push(closeSentence(s));
    if (parts.length) paragraphs.push(parts.join(' '));
  }
  return paragraphs.join(' ');
}

/** Campos obrigatórios das opções marcadas que ainda não têm medida (para o usuário digitar). */
export function pendingFields(def, sel = {}, measures = [], extras = {}) {
  const found = new Map();
  for (const block of expandBlocks(def)) {
    for (const g of block.groups) for (const o of chosen(g, sel)) {
      for (const m of fillPhrase(o.text, measures, extras, { prefix: block.label }).missing) if (!found.has(m.key)) found.set(m.key, m);
    }
  }
  return [...found.values()];
}

/** "texto"; "!texto" (exclusiva: substitui as demais do bloco); "&texto" (cola na anterior, sem vírgula); "curto :: texto". */
export function parseOptionLine(line) {
  let s = String(line).trim();
  if (!s) return null;
  const flags = {};
  while (s[0] === '!' || s[0] === '&') { if (s[0] === '!') flags.excl = true; else flags.glue = true; s = s.slice(1).trim(); }
  const [a, b] = s.split('::').map((x) => x.trim());
  return b ? { label: a, text: b, ...flags } : { text: a, ...flags };
}
export const optionToLine = (o) => `${o.excl ? '!' : ''}${o.glue ? '&' : ''}${o.label ? `${o.label} :: ` : ''}${o.text}`;

export function validateBuilder(def) {
  const errors = [];
  for (const b of (def && def.blocks) || []) for (const g of b.groups || []) {
    if (!KINDS[g.kind]) errors.push(`Tipo inválido no grupo "${g.label || ''}".`);
    if (!String(g.label || '').trim()) errors.push('Todo grupo precisa de um nome.');
    if (!(g.options || []).length) errors.push(`O grupo "${g.label}" não tem opções.`);
  }
  return errors;
}
