// Utilidades gerais (sem dependência de DOM, exceto toast/download).

export const uid = () =>
  (globalThis.crypto && crypto.randomUUID)
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function todayISO() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function fmtDateBR(iso) {
  if (!iso) return '';
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : String(iso);
}

export function fmtDateTimeBR(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  if (isNaN(d)) return '';
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

/** Idade calculada a partir da data de nascimento (somente se informada). */
export function ageFromBirth(birthISO, refISO) {
  if (!birthISO) return '';
  const b = new Date(birthISO + 'T00:00:00');
  const r = new Date((refISO || todayISO()) + 'T00:00:00');
  if (isNaN(b) || isNaN(r) || b > r) return '';
  let months = (r.getFullYear() - b.getFullYear()) * 12 + (r.getMonth() - b.getMonth());
  if (r.getDate() < b.getDate()) months--;
  if (months < 0) return '';
  const y = Math.floor(months / 12);
  const m = months % 12;
  const parts = [];
  if (y) parts.push(`${y} ${y === 1 ? 'ano' : 'anos'}`);
  if (m) parts.push(`${m} ${m === 1 ? 'mês' : 'meses'}`);
  return parts.join(' e ') || 'menos de 1 mês';
}

export function slugName(s) {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'SemNome';
}

export const MODALITY = {
  usg: { code: 'USG', label: 'Ultrassonografia' },
  rx: { code: 'RX', label: 'Radiografia' },
};

/** Ex.: Laudo_USG_NomeDoAnimal_2026-10-10.docx */
export function reportFileName(exam, ext) {
  const code = (MODALITY[exam.type] || MODALITY.usg).code;
  const name = slugName(exam.patient && exam.patient.name);
  return `Laudo_${code}_${name}_${exam.date || todayISO()}.${ext}`;
}

export function debounce(fn, ms) {
  let t;
  const wrapped = (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  wrapped.flush = (...args) => { clearTimeout(t); return fn(...args); };
  wrapped.cancel = () => clearTimeout(t);
  return wrapped;
}

export function dataUrlToBytes(url) {
  const b64 = String(url).split(',')[1] || '';
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function dataUrlFormat(url) {
  const m = /^data:image\/([a-z0-9+.-]+)/i.exec(String(url));
  const t = m ? m[1].toLowerCase() : '';
  if (t === 'jpg' || t === 'jpeg') return 'jpeg';
  return t;
}

export function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function toast(message, kind = 'info') {
  if (typeof document === 'undefined') return;
  let box = document.getElementById('toasts');
  if (!box) {
    box = document.createElement('div');
    box.id = 'toasts'; box.setAttribute('role', 'status'); box.setAttribute('aria-live', 'polite');
    document.body.appendChild(box);
  }
  const el = document.createElement('div');
  el.className = `toast ${kind}`; el.textContent = message;
  box.appendChild(el);
  setTimeout(() => el.remove(), kind === 'error' ? 7000 : 3500);
}

export function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}
