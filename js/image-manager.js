// Gerenciador de imagens: importação, compressão, rotação, legendas, ordem e disposição.
import { uid, esc, formatBytes, toast } from './utils.js';
import { validateImageFile } from './validation.js';

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
    img.src = src;
  });
}
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error('Falha ao ler o arquivo.'));
    r.readAsDataURL(file);
  });
}

function encode(img, rotation, { maxPx, quality }) {
  const swap = rotation % 180 !== 0;
  const sw = swap ? img.naturalHeight : img.naturalWidth;
  const sh = swap ? img.naturalWidth : img.naturalHeight;
  const k = Math.min(1, maxPx / Math.max(sw, sh));
  const w = Math.max(1, Math.round(sw * k)), h = Math.max(1, Math.round(sh * k));
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
  ctx.translate(w / 2, h / 2);
  ctx.rotate(rotation * Math.PI / 180);
  const dw = swap ? h : w, dh = swap ? w : h;
  ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
  const src = canvas.toDataURL('image/jpeg', quality);
  return { src, w, h, bytes: Math.round((src.length - 23) * 0.75) };
}

const opts = (settings) => ({
  maxPx: settings.compress ? settings.maxImagePx : 3000,
  quality: settings.compress ? settings.jpegQuality : 0.95,
});

/** Lê o arquivo, reduz e converte para JPEG (formato aceito de forma confiável por Word e PDF). */
export async function importFile(file, settings) {
  const check = validateImageFile(file, settings.maxImageMB * 1048576);
  if (!check.ok) throw new Error(check.reason);
  let img;
  try { img = await loadImage(await fileToDataUrl(file)); }
  catch { throw new Error(`"${file.name}": não foi possível ler a imagem (arquivo corrompido?).`); }
  const out = encode(img, 0, opts(settings));
  return { id: uid(), name: file.name, caption: '', region: '', scale: 1, ...out };
}

export async function rotateImage(im, degrees, settings) {
  const img = await loadImage(im.src);
  Object.assign(im, encode(img, ((degrees % 360) + 360) % 360, { maxPx: 4000, quality: opts(settings).quality }));
}

export function moveItem(list, id, delta) {
  const i = list.findIndex((x) => x.id === id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= list.length) return false;
  [list[i], list[j]] = [list[j], list[i]];
  return true;
}
export function reorder(list, fromId, toId) {
  const from = list.findIndex((x) => x.id === fromId), to = list.findIndex((x) => x.id === toId);
  if (from < 0 || to < 0 || from === to) return false;
  list.splice(to, 0, list.splice(from, 1)[0]);
  return true;
}

export function imagesStepHtml(exam, locked, regionLabel) {
  const imgs = exam.images || [];
  const total = imgs.reduce((s, i) => s + (i.bytes || 0), 0);
  const cards = imgs.map((im, idx) => `
    <div class="imgcard" draggable="${locked ? 'false' : 'true'}" data-img="${im.id}">
      <img src="${esc(im.src)}" alt="Imagem ${idx + 1}">
      <div class="small muted">#${idx + 1} · ${im.w}×${im.h} · ${formatBytes(im.bytes || 0)}</div>
      <div><label for="cap-${im.id}">Legenda</label><input id="cap-${im.id}" data-imgf="caption" data-id="${im.id}" value="${esc(im.caption)}" ${locked ? 'disabled' : ''}></div>
      <div><label for="reg-${im.id}">${esc(regionLabel)}</label><input id="reg-${im.id}" data-imgf="region" data-id="${im.id}" value="${esc(im.region)}" ${locked ? 'disabled' : ''}></div>
      <div><label for="sc-${im.id}">Tamanho no documento</label>
        <select id="sc-${im.id}" data-imgf="scale" data-id="${im.id}" ${locked ? 'disabled' : ''}>
          ${[[1, '100%'], [0.75, '75%'], [0.5, '50%']].map(([v, l]) => `<option value="${v}" ${Number(im.scale) === v ? 'selected' : ''}>${l}</option>`).join('')}
        </select></div>
      ${locked ? '' : `<div class="tools">
        <button class="iconbtn" data-act="img-up" data-id="${im.id}" aria-label="Mover para antes" title="Mover para antes">◀</button>
        <button class="iconbtn" data-act="img-down" data-id="${im.id}" aria-label="Mover para depois" title="Mover para depois">▶</button>
        <button class="iconbtn" data-act="img-rotl" data-id="${im.id}" aria-label="Girar à esquerda" title="Girar à esquerda">↺</button>
        <button class="iconbtn" data-act="img-rotr" data-id="${im.id}" aria-label="Girar à direita" title="Girar à direita">↻</button>
        <button class="iconbtn danger" data-act="img-del" data-id="${im.id}" aria-label="Excluir imagem" title="Excluir">✕</button>
      </div>`}
    </div>`).join('');
  const n = Math.min(3, Math.max(1, Number(exam.imagesPerRow) || 2));
  const mini = imgs.length ? `<h3>Disposição no documento</h3><div class="grid" style="grid-template-columns:repeat(${n},1fr)">${
    imgs.map((im, i) => `<div style="text-align:center"><img src="${esc(im.src)}" alt="" style="width:${Math.round(im.scale * 100)}%;max-height:140px;object-fit:contain;background:#000"><div class="small muted">${i + 1}</div></div>`).join('')}</div>` : '';
  return `
    ${locked ? '' : `<div class="dropzone" id="dropzone"><p><strong>Adicione imagens</strong> (JPEG, PNG ou WebP). Selecione várias de uma vez ou arraste para cá.</p>
      <input type="file" id="img-file" accept="image/jpeg,image/png,image/webp" multiple style="display:none">
      <button class="btn primary" data-act="img-pick">Escolher imagens</button></div>`}
    <div class="row between"><div><strong>${imgs.length}</strong> ${imgs.length === 1 ? 'imagem' : 'imagens'} · ${formatBytes(total)}</div>
      <div style="min-width:220px"><label for="perrow">Imagens por linha no documento</label>
        <select id="perrow" data-bind="imagesPerRow" data-num="1" ${locked ? 'disabled' : ''}>${[1, 2, 3].map((v) => `<option value="${v}" ${n === v ? 'selected' : ''}>${v}</option>`).join('')}</select></div></div>
    <div class="imgs" id="imgs" style="margin:12px 0">${cards || '<div class="empty">Nenhuma imagem adicionada.</div>'}</div>
    ${mini}`;
}

/** Liga eventos do passo de imagens. onChange(structural) é chamado após qualquer alteração. */
export function bindImages(root, exam, settings, onChange) {
  const add = async (fileList) => {
    const files = [...fileList];
    let ok = 0;
    for (const f of files) {
      try { exam.images.push(await importFile(f, settings)); ok++; }
      catch (e) { toast(e.message, 'error'); }
    }
    if (ok) { toast(`${ok} imagem(ns) adicionada(s).`, 'success'); onChange(true); }
  };
  const fileInput = root.querySelector('#img-file');
  if (fileInput) fileInput.addEventListener('change', () => { add(fileInput.files); fileInput.value = ''; });
  const dz = root.querySelector('#dropzone');
  if (dz) {
    ['dragenter', 'dragover'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('over'); }));
    ['dragleave', 'drop'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove('over'); }));
    dz.addEventListener('drop', (e) => { if (e.dataTransfer && e.dataTransfer.files.length) add(e.dataTransfer.files); });
  }
  root.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const id = b.dataset.id, act = b.dataset.act;
    if (act === 'img-pick') return root.querySelector('#img-file').click();
    if (act === 'img-up' && moveItem(exam.images, id, -1)) onChange(true);
    if (act === 'img-down' && moveItem(exam.images, id, 1)) onChange(true);
    if (act === 'img-del') { exam.images = exam.images.filter((i) => i.id !== id); onChange(true); }
    if (act === 'img-rotl' || act === 'img-rotr') {
      const im = exam.images.find((i) => i.id === id);
      try { await rotateImage(im, act === 'img-rotr' ? 90 : 270, settings); onChange(true); }
      catch (err) { toast(err.message, 'error'); }
    }
  });
  root.addEventListener('input', (e) => {
    const f = e.target.dataset && e.target.dataset.imgf;
    if (!f) return;
    const im = exam.images.find((i) => i.id === e.target.dataset.id);
    if (im) { im[f] = f === 'scale' ? Number(e.target.value) : e.target.value; onChange(f === 'scale'); }
  });
  // Arrastar e soltar para reordenar
  let dragId = null;
  root.addEventListener('dragstart', (e) => { const c = e.target.closest('.imgcard'); if (c) { dragId = c.dataset.img; c.classList.add('drag'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', dragId); } });
  root.addEventListener('dragend', () => { dragId = null; root.querySelectorAll('.imgcard').forEach((c) => c.classList.remove('drag', 'over')); });
  root.addEventListener('dragover', (e) => { if (dragId && e.target.closest('.imgcard')) { e.preventDefault(); } });
  root.addEventListener('drop', (e) => {
    const c = e.target.closest('.imgcard');
    if (dragId && c && reorder(exam.images, dragId, c.dataset.img)) { e.preventDefault(); onChange(true); }
  });
}
