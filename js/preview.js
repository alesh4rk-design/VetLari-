// Prévia HTML do documento (mesmo modelo usado nos arquivos Word/PDF).
import { esc } from './utils.js';

export function reportToHtml(r) {
  const head = (r.logo || r.headerLines.length)
    ? `<div class="phead">${r.logo ? `<img src="${esc(r.logo)}" alt="Logotipo">` : ''}<div>${r.headerLines.map((l) => `<div>${esc(l)}</div>`).join('')}</div></div>` : '';
  const pt = r.patientRows.length ? `<table class="pt"><tbody>${(() => {
    const rows = [];
    for (let i = 0; i < r.patientRows.length; i += 2) {
      const cell = (p) => p ? `<td><strong>${esc(p[0])}:</strong> ${esc(p[1])}</td>` : '<td></td>';
      rows.push(`<tr>${cell(r.patientRows[i])}${cell(r.patientRows[i + 1])}</tr>`);
    }
    return rows.join('');
  })()}</tbody></table>` : '';
  const blocks = r.blocks.map((b) => {
    if (b.kind === 'h') return `<h3>${esc(b.text)}</h3>`;
    if (b.kind === 'p') return `<p class="sub">${esc(b.text)}</p>`;
    if (b.kind === 'kv') return `<p class="sub"><strong>${esc(b.label)}:</strong> ${esc(b.text)}</p>`;
    return `<h3>${esc(b.title)}</h3>${b.items.map((it) => `<p class="sub">${it.label ? `<strong>${esc(it.label)}:</strong> ` : ''}${esc(it.text)}</p>`).join('')}`;
  }).join('');
  const imgs = r.images.items.length ? `<h3>Imagens</h3><div class="pimgs" style="grid-template-columns:repeat(${r.images.perRow},1fr)">${
    r.images.items.map((im) => `<figure><img src="${esc(im.dataUrl)}" alt="${esc(im.caption || 'Imagem do exame')}" style="width:${Math.round(im.scale * 100)}%">${im.caption ? `<figcaption>${esc(im.caption)}</figcaption>` : ''}</figure>`).join('')}</div>` : '';
  const sig = r.signature ? `<div class="sig"><div class="line">${esc(r.signature.name || 'Assinatura do médico-veterinário')}${r.signature.crmv ? `<br>${esc(r.signature.crmv)}` : ''}</div></div>` : '';
  const foot = r.footerText ? `<div class="pfoot">${esc(r.footerText)}</div>` : '';
  return `<article class="paper ${r.font}" aria-label="Prévia do laudo">${head}<h1>${esc(r.title)}</h1>${pt}${blocks}${imgs}${sig}${foot}</article>`;
}
