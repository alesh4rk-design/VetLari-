// Roteador por hash (#/rota) compatível com GitHub Pages (sem servidor).
const routes = [];
let guard = null;
let current = '';
let reverting = false;

export function route(pattern, handler) {
  const keys = [];
  const rx = new RegExp('^' + pattern.replace(/:([a-z]+)/gi, (_, k) => { keys.push(k); return '([^/]+)'; }) + '/?$');
  routes.push({ rx, keys, handler });
}

export const setLeaveGuard = (fn) => { guard = fn; };
export const navigate = (path) => { location.hash = '#' + path; };
export const currentPath = () => current;

export function parse(hash) {
  const raw = (hash || '').replace(/^#/, '') || '/';
  const [path, query = ''] = raw.split('?');
  return { path, query: Object.fromEntries(new URLSearchParams(query)) };
}

async function dispatch() {
  if (reverting) { reverting = false; return; }
  const { path, query } = parse(location.hash);
  if (guard && path !== current && !guard()) { reverting = true; location.hash = '#' + current; return; }
  guard = null;
  current = path;
  for (const r of routes) {
    const m = r.rx.exec(path);
    if (m) {
      const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
      document.dispatchEvent(new CustomEvent('route', { detail: { path } }));
      await r.handler({ params, query });
      return;
    }
  }
  location.hash = '#/';
}

export function start() {
  window.addEventListener('hashchange', dispatch);
  return dispatch();
}
