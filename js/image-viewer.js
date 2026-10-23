// Visualizador de imagens do exame: zoom, deslocamento, navegação entre imagens e anotações (seta,
// círculo, texto). As anotações ficam à parte; a imagem original não é alterada. Não há ferramenta de
// medida automática: o sistema não estima medidas a partir de pixels.
import { esc, toast } from './utils.js';
import { openModal } from './ui.js';
import { TOOLS, makeAnnotation, isMeaningful, drawAnnotations, renderAnnotated } from './annotations.js';

const loadImage = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Falha ao ler a imagem.')); i.src = src; });

/** Abre o visualizador. Resolve quando a janela fecha (as anotações já foram aplicadas ao exame). */
export function openImageViewer(exam, startId, { locked = false } = {}) {
  let idx = Math.max(0, exam.images.findIndex((i) => i.id === startId));
  const m = openModal(`<h2>Imagem <span id="vcount"></span></h2>
    <div class="row" style="margin-bottom:8px" role="toolbar" aria-label="Ferramentas da imagem">
      <button class="btn sm" data-v="prev" aria-label="Imagem anterior">◀</button><button class="btn sm" data-v="next" aria-label="Próxima imagem">▶</button>
      <button class="btn sm" data-v="zout" aria-label="Diminuir zoom">−</button><button class="btn sm" data-v="zin" aria-label="Aumentar zoom">+</button><button class="btn sm" data-v="fit">Ajustar</button>
      <button class="btn sm" data-tool="move" aria-pressed="true">Mover</button>
      ${locked ? '' : Object.entries(TOOLS).map(([k, v]) => `<button class="btn sm" data-tool="${k}" aria-pressed="false">${v}</button>`).join('')}
      ${locked ? '' : '<button class="btn sm" data-v="undo">Desfazer</button><button class="btn sm danger" data-v="clear">Limpar anotações</button>'}</div>
    ${locked ? '' : '<div class="field" style="max-width:360px"><label for="vtxt">Texto da marcação (para a ferramenta Texto)</label><input id="vtxt" maxlength="120"></div>'}
    <div style="background:#000;border-radius:8px;overflow:hidden"><canvas id="vc" style="width:100%;height:min(48vh,480px);touch-action:none;display:block" role="img" aria-label="Imagem do exame"></canvas></div>
    <p class="small muted">Use a roda do mouse ou os botões para zoom. As anotações são desenhadas sobre uma cópia: a imagem original é preservada. Tecle + − 0 para zoom.</p>
    <div class="row end"><button class="btn primary" data-v="close">Concluir</button></div>`, { wide: true, label: 'Visualizador de imagens' });

  const canvas = m.el.querySelector('#vc');
  const ctx = canvas.getContext('2d');
  let img = null, im = null, z = 1, ox = 0, oy = 0, tool = 'move', draft = null, pan = null, anns = [];

  const resize = () => { const r = canvas.getBoundingClientRect(); canvas.width = Math.max(200, Math.round(r.width)); canvas.height = Math.max(200, Math.round(r.height)); };
  const fit = () => { z = Math.min(canvas.width / img.naturalWidth, canvas.height / img.naturalHeight); ox = (canvas.width - img.naturalWidth * z) / 2; oy = (canvas.height - img.naturalHeight * z) / 2; };
  const draw = () => {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!img) return;
    ctx.save(); ctx.translate(ox, oy); ctx.scale(z, z);
    ctx.drawImage(img, 0, 0);
    drawAnnotations(ctx, draft ? [...anns, draft] : anns, img.naturalWidth, img.naturalHeight);
    ctx.restore();
  };
  const toImg = (e) => {
    const r = canvas.getBoundingClientRect();
    const px = (e.clientX - r.left) * (canvas.width / r.width), py = (e.clientY - r.top) * (canvas.height / r.height);
    return { x: (px - ox) / z / img.naturalWidth, y: (py - oy) / z / img.naturalHeight, px, py };
  };

  async function commit() {
    if (!im || locked) return; // laudo finalizado: nada é alterado
    im.annotations = anns;
    try {
      if (anns.length) im.annotatedSrc = await renderAnnotated(im); else delete im.annotatedSrc;
    } catch (err) { toast(err.message, 'error'); }
  }
  async function show(i) {
    await commit();
    idx = (i + exam.images.length) % exam.images.length;
    im = exam.images[idx]; anns = [...(im.annotations || [])]; draft = null;
    m.el.querySelector('#vcount').textContent = `${idx + 1} de ${exam.images.length}${im.caption ? ' — ' + im.caption : ''}`;
    try { img = await loadImage(im.src); } catch (err) { toast(err.message, 'error'); return; }
    resize(); fit(); draw();
  }

  const zoomAt = (factor, cx = canvas.width / 2, cy = canvas.height / 2) => {
    const nz = Math.min(20, Math.max(0.05, z * factor));
    ox = cx - (cx - ox) * (nz / z); oy = cy - (cy - oy) * (nz / z); z = nz; draw();
  };
  const setTool = (t) => {
    tool = t;
    m.el.querySelectorAll('[data-tool]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tool === t)));
    canvas.style.cursor = t === 'move' ? 'grab' : 'crosshair';
  };

  canvas.addEventListener('wheel', (e) => { e.preventDefault(); const r = canvas.getBoundingClientRect(); zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, (e.clientX - r.left) * (canvas.width / r.width), (e.clientY - r.top) * (canvas.height / r.height)); }, { passive: false });
  canvas.addEventListener('pointerdown', (e) => {
    if (!img) return;
    canvas.setPointerCapture(e.pointerId);
    const p = toImg(e);
    if (tool === 'move') { pan = { sx: p.px, sy: p.py, ox, oy }; canvas.style.cursor = 'grabbing'; return; }
    if (locked) return;
    if (tool === 'text') {
      const text = m.el.querySelector('#vtxt').value.trim();
      if (!text) { toast('Digite o texto da marcação no campo acima da imagem.', 'error'); return; }
      anns.push(makeAnnotation('text', p, p, text)); draw(); return;
    }
    draft = makeAnnotation(tool, p, p);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!img) return;
    const p = toImg(e);
    if (pan) { ox = pan.ox + (p.px - pan.sx); oy = pan.oy + (p.py - pan.sy); draw(); }
    else if (draft) { draft = makeAnnotation(draft.type, { x: draft.x1, y: draft.y1 }, p); draw(); }
  });
  const end = () => {
    if (pan) { pan = null; canvas.style.cursor = tool === 'move' ? 'grab' : 'crosshair'; }
    if (draft) { if (isMeaningful(draft)) anns.push(draft); draft = null; draw(); }
  };
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
  m.el.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (e.key === '+' || e.key === '=') zoomAt(1.2); else if (e.key === '-') zoomAt(1 / 1.2); else if (e.key === '0') { fit(); draw(); }
  });
  m.el.addEventListener('click', (e) => {
    const t = e.target.closest('[data-tool]'); if (t) return setTool(t.dataset.tool);
    const b = e.target.closest('[data-v]'); if (!b) return;
    const a = b.dataset.v;
    if (a === 'prev') show(idx - 1); else if (a === 'next') show(idx + 1);
    else if (a === 'zin') zoomAt(1.25); else if (a === 'zout') zoomAt(1 / 1.25);
    else if (a === 'fit') { fit(); draw(); }
    else if (a === 'undo') { anns.pop(); draw(); }
    else if (a === 'clear') { anns = []; draw(); }
    else if (a === 'close') m.close(true);
  });
  setTool('move');
  show(idx);
  // Qualquer forma de fechar (botão, Esc, clique fora) aplica as anotações à cópia anotada.
  return m.closed.then(commit);
}
