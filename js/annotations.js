// Anotações em imagens: guardadas como vetores (coordenadas normalizadas 0-1) separados da imagem original.
// O arquivo original (im.src) nunca é alterado; a cópia anotada (im.annotatedSrc) é gerada à parte.
import { uid } from './utils.js';

export const TOOLS = { arrow: 'Seta', ellipse: 'Círculo', text: 'Texto' };
const clamp01 = (n) => Math.min(1, Math.max(0, Number(n) || 0));

export function makeAnnotation(type, p1, p2, text = '') {
  if (!TOOLS[type]) throw new Error('Ferramenta inválida.');
  const a = { id: uid(), type, x1: clamp01(p1.x), y1: clamp01(p1.y), x2: clamp01((p2 || p1).x), y2: clamp01((p2 || p1).y) };
  if (type === 'text') a.text = String(text).slice(0, 120);
  return a;
}

/** Descarta marcações vazias (arrasto sem movimento, texto sem conteúdo). */
export function isMeaningful(a) {
  if (a.type === 'text') return !!String(a.text || '').trim();
  return Math.hypot(a.x2 - a.x1, a.y2 - a.y1) > 0.01;
}

const COLOR = '#ffd400';

/** Desenha as anotações num contexto 2D com o tamanho (w×h) da imagem. */
export function drawAnnotations(ctx, anns, w, h) {
  const lw = Math.max(3, Math.round(w / 220));
  ctx.save();
  ctx.lineWidth = lw; ctx.strokeStyle = COLOR; ctx.fillStyle = COLOR; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const a of anns || []) {
    const x1 = a.x1 * w, y1 = a.y1 * h, x2 = a.x2 * w, y2 = a.y2 * h;
    if (a.type === 'arrow') {
      const ang = Math.atan2(y2 - y1, x2 - x1), head = Math.max(14, w / 45);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - head * Math.cos(ang - Math.PI / 7), y2 - head * Math.sin(ang - Math.PI / 7));
      ctx.lineTo(x2 - head * Math.cos(ang + Math.PI / 7), y2 - head * Math.sin(ang + Math.PI / 7));
      ctx.closePath(); ctx.fill();
    } else if (a.type === 'ellipse') {
      ctx.beginPath(); ctx.ellipse((x1 + x2) / 2, (y1 + y2) / 2, Math.max(1, Math.abs(x2 - x1) / 2), Math.max(1, Math.abs(y2 - y1) / 2), 0, 0, Math.PI * 2); ctx.stroke();
    } else if (a.type === 'text') {
      const size = Math.max(18, Math.round(w / 32));
      ctx.font = `bold ${size}px Arial, sans-serif`; ctx.textBaseline = 'top';
      ctx.lineWidth = Math.max(3, size / 6); ctx.strokeStyle = '#000'; ctx.strokeText(a.text, x1, y1);
      ctx.fillStyle = COLOR; ctx.fillText(a.text, x1, y1);
    }
  }
  ctx.restore();
}

function loadImage(src) {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Falha ao ler a imagem.')); i.src = src; });
}

/** Gera a cópia anotada (JPEG) a partir da imagem original e das anotações. */
export async function renderAnnotated(im, quality = 0.9) {
  const img = await loadImage(im.src);
  const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  drawAnnotations(ctx, im.annotations, c.width, c.height);
  return c.toDataURL('image/jpeg', quality);
}

/** Imagem efetivamente usada no documento: a cópia anotada, se existir; senão a original. */
export const documentSource = (im) => im.annotatedSrc || im.src;
