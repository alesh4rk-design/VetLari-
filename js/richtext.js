// Texto com destaques simples dentro das descrições: **negrito** e __itálico__.
// Usado pela prévia, pelo PDF e pelo Word. O texto digitado continua sendo texto puro com esses marcadores.

/** Quebra o texto em trechos { text, bold, italic }. */
export function parseRich(text) {
  const runs = [];
  let bold = false, italic = false;
  for (const part of String(text ?? '').split(/(\*\*|__)/)) {
    if (part === '**') { bold = !bold; continue; }
    if (part === '__') { italic = !italic; continue; }
    if (part) runs.push({ text: part, bold, italic });
  }
  return runs;
}

export const stripRich = (text) => String(text ?? '').replace(/\*\*|__/g, '');

/** Monta o texto "**Título**: item item" de uma estrutura do laudo. */
export function sectionRich(block) {
  const body = block.items.map((it) => (it.label ? `**${it.label}**: ${it.text}` : it.text)).join(' ');
  return `**${block.title}**:${body ? ' ' + body : ''}`;
}

/** Palavras com seus trechos de estilo; trechos sem espaço entre si ficam na mesma palavra (ex.: "Fígado" + ":"). */
export function toWords(runs) {
  const words = [];
  let cur = null, pendingBreak = true;
  for (const r of runs) {
    for (const chunk of r.text.split(/(\s+)/)) {
      if (!chunk) continue;
      if (/^\s+$/.test(chunk)) { pendingBreak = true; continue; }
      if (pendingBreak || !cur) { cur = { segs: [] }; words.push(cur); pendingBreak = false; }
      cur.segs.push({ text: chunk, bold: !!r.bold, italic: !!r.italic });
    }
  }
  return words;
}
