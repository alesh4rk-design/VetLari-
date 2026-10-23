// Prévia HTML do documento (mesmo modelo e mesmo formato usados nos arquivos Word/PDF).
import { esc } from './utils.js';
import { parseRich, sectionRich, stripRich } from './richtext.js';

const rich = (text) => parseRich(text).map((r) => {
  let h = esc(r.text);
  if (r.bold) h = `<strong>${h}</strong>`;
  if (r.italic) h = `<em>${h}</em>`;
  return h;
}).join('').replace(/\n/g, '<br>');

export function reportToHtml(r) {
  const logos = (r.logo || r.logo2)
    ? `<div class="plogos">${r.logo ? `<img src="${esc(r.logo)}" alt="Logotipo">` : '<span></span>'}${r.logo2 ? `<img src="${esc(r.logo2)}" alt="Segundo logotipo">` : ''}</div>`
    : (r.headerLines.length ? `<div class="phead"><div>${r.headerLines.map((l) => `<div>${esc(l)}</div>`).join('')}</div></div>` : '');
  const ident = r.patientRows.length
    ? `<div class="pbanner">Identificação</div><div class="pid">${r.patientRows.map(([k, v]) => `<div><strong>${esc(k)}:</strong> ${esc(v)}</div>`).join('')}</div>` : '';
  const blocks = r.blocks.map((b) => {
    if (b.kind === 'h') return `<div class="pbanner">${esc(b.text)}</div>`;
    if (b.kind === 'p') return `<p class="sub">${rich(b.text)}</p>`;
    if (b.kind === 'list') return `<ul class="plist">${b.items.map((i) => `<li><strong>${esc(stripRich(i))}</strong></li>`).join('')}</ul>`;
    if (b.kind === 'note') return `<p class="sub pnote">${esc(stripRich(b.text))}</p>`;
    if (b.kind === 'kv') return `<p class="sub">${rich(`**${b.label}**: ${b.text}`)}</p>`;
    return `<p class="sub">${rich(sectionRich(b))}</p>`;
  }).join('');
  const imgs = r.images.items.length ? `<div class="pbanner">Imagens</div><div class="pimgs" style="grid-template-columns:repeat(${r.images.perRow},1fr)">${
    r.images.items.map((im) => `<figure><img src="${esc(im.dataUrl)}" alt="${esc(im.caption || 'Imagem do exame')}" style="width:${Math.round(im.scale * 100)}%">${im.caption ? `<figcaption>${esc(stripRich(im.caption))}</figcaption>` : ''}</figure>`).join('')}</div>` : '';
  let sig = '';
  if (r.signature) {
    const s = r.signature;
    sig = s.stamp
      ? `<div class="psig"><div><strong>Assinado eletronicamente por:</strong> ${esc(s.name || '(nome não informado)')}</div>${s.crmv ? `<div><strong>${esc(s.crmv)}</strong></div>` : ''}<div>Código identificador: ${esc(s.code)}</div><div class="small">${esc(s.stamp)}</div></div>`
      : `<div class="psig"><div><strong>Documento não finalizado: sem assinatura eletrônica.</strong></div>${s.name ? `<div>Responsável: ${esc(s.name)}${s.crmv ? ' — ' + esc(s.crmv) : ''}</div>` : ''}<div>Código identificador: ${esc(s.code)}</div></div>`;
  }
  const foot = r.footerText ? `<div class="pfoot">${esc(r.footerText)}</div>` : '';
  return `<article class="paper ${r.font}" aria-label="Prévia do laudo">${logos}${ident}<div class="pbanner">${esc(r.title)}</div>${r.statusNote ? `<p class="pstatus">${esc(r.statusNote)}</p>` : ''}${blocks}${imgs}${sig}${foot}</article>`;
}
