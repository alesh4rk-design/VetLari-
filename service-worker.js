// Service worker do VetLaudo: permite abrir o sistema sem internet depois da primeira visita.
// Estratégia: rede primeiro (com limite de 4 s) e cache como reserva, para que atualizações cheguem
// sem precisar limpar nada. Os dados clínicos NÃO passam por aqui: ficam no IndexedDB do aparelho.
const CACHE = 'vetlaudo-v3';
const PRECACHE = [
  './',
  'index.html',
  'manifest.json',
  'assets/css/styles.css',
  'assets/css/responsive.css',
  'assets/vendor/docx.umd.js',
  'assets/vendor/jspdf.umd.min.js',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/icons/icon-maskable-512.png',
  'assets/icons/apple-touch-icon.png',
  "js/annotations.js",
  "js/app.js",
  "js/calc-logic.js",
  "js/calculations.js",
  "js/compare.js",
  "js/dashboard.js",
  "js/docx-export.js",
  "js/editor.js",
  "js/exams.js",
  "js/formula.js",
  "js/image-manager.js",
  "js/image-viewer.js",
  "js/local-storage.js",
  "js/patients.js",
  "js/pdf-export.js",
  "js/phrase-library.js",
  "js/phrase-logic.js",
  "js/preview.js",
  "js/profile-ui.js",
  "js/profiles.js",
  "js/quality.js",
  "js/radiography.js",
  "js/reference-logic.js",
  "js/references.js",
  "js/report-model.js",
  "js/router.js",
  "js/settings.js",
  "js/template-editor.js",
  "js/templates.js",
  "js/ui.js",
  "js/ultrasound.js",
  "js/utils.js",
  "js/validation.js",
  "js/voice.js",
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const network = fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); return res; });
    const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 4000));
    try { return await Promise.race([network, timeout]); }
    catch {
      const hit = await cache.match(req, { ignoreSearch: true }) || (req.mode === 'navigate' ? await cache.match('index.html') : null);
      if (hit) return hit;
      return network.catch(() => new Response('Sem conexão e sem cópia local deste arquivo.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }));
    }
  })());
});
