// Componentes de interface compartilhados: modais e confirmações acessíveis.
import { esc } from './utils.js';

export function openModal(html, { wide = false, label = 'Janela' } = {}) {
  const root = document.getElementById('modal-root');
  const previous = document.activeElement;
  const back = document.createElement('div');
  back.className = 'modal-back';
  back.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(label)}" tabindex="-1">${html}</div>`;
  root.appendChild(back);
  const el = back.firstElementChild;
  const close = (value) => {
    back.remove();
    document.removeEventListener('keydown', onKey, true);
    if (previous && previous.focus) previous.focus();
    api.resolve(value);
  };
  const onKey = (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); close(null); }
    if (e.key === 'Tab') { // mantém o foco dentro da janela
      const f = [...el.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter((n) => !n.disabled && n.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };
  document.addEventListener('keydown', onKey, true);
  back.addEventListener('mousedown', (e) => { if (e.target === back) close(null); });
  const api = { el, close, closed: null, resolve: null };
  api.closed = new Promise((r) => { api.resolve = r; });
  const auto = el.querySelector('[autofocus]') || el.querySelector('input,textarea,select,button') || el;
  auto.focus();
  return api;
}

export function confirmDialog(message, { ok = 'Confirmar', danger = false } = {}) {
  const m = openModal(`<h2>Confirmação</h2><p>${esc(message)}</p>
    <div class="row end"><button class="btn" data-x="no">Cancelar</button>
    <button class="btn ${danger ? 'danger' : 'primary'}" data-x="yes">${esc(ok)}</button></div>`, { label: 'Confirmação' });
  m.el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-x]');
    if (b) m.close(b.dataset.x === 'yes');
  });
  return m.closed.then((v) => v === true);
}

export function alertList(title, items, kind = 'warn') {
  if (!items || !items.length) return '';
  return `<div class="alert ${kind}" role="alert"><strong>${esc(title)}</strong><ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></div>`;
}

export function getPath(obj, path) { return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj); }
export function setPath(obj, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  const target = keys.reduce((o, k) => (o[k] ??= {}), obj);
  target[last] = value;
}

/** Janela com todas as opções e busca. Resolve com o texto escolhido ou null. */
export function pickOption({ title, options }) {
  const m = openModal(`<h2>${esc(title)}</h2>
    <div class="field"><label for="po-q">Pesquisar</label><input id="po-q" type="search" autocomplete="off" autofocus></div>
    <div id="po-list" class="chips" style="max-height:50vh;overflow:auto"></div>
    <div class="row end" style="margin-top:10px"><button class="btn" data-x="cancel">Cancelar</button></div>`, { label: title });
  const draw = () => {
    const q = m.el.querySelector('#po-q').value.trim().toLowerCase();
    const res = options.filter((o) => !q || o.toLowerCase().includes(q));
    m.el.querySelector('#po-list').innerHTML = res.length ? res.map((o) => `<button type="button" class="chip" data-opt="${esc(o)}">${esc(o)}</button>`).join('')
      : '<span class="muted">Nada encontrado. Feche e digite no campo.</span>';
  };
  draw();
  m.el.addEventListener('input', draw);
  m.el.addEventListener('click', (e) => {
    const o = e.target.closest('[data-opt]');
    if (o) return m.close(o.dataset.opt);
    if (e.target.closest('[data-x=cancel]')) m.close(null);
  });
  return m.closed;
}
