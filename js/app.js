// Ponto de entrada: navegação, rotas, tema e tratamento global de erros.
import { route, start, setLeaveGuard } from './router.js';
import { loadSettings } from './templates.js';
import { applyTheme, renderSettings } from './settings.js';
import { renderDashboard } from './dashboard.js';
import { renderPatientList, renderPatientForm } from './patients.js';
import { renderPhraseLibrary } from './phrase-library.js';
import { renderTemplateList, renderTemplateForm } from './template-editor.js';
import { renderNewExam, renderEditor, startFromPrevious } from './editor.js';
import { renderExamBrowser, getExam } from './exams.js';
import { buildReport } from './report-model.js';
import { reportToHtml } from './preview.js';
import { esc, toast } from './utils.js';

const NAV = [
  ['/', '🏠', 'Início'], ['/novo', '➕', 'Novo laudo'], ['/laudos', '📄', 'Laudos'], ['/pacientes', '🐾', 'Pacientes'],
  ['/frases', '💬', 'Frases'], ['/modelos', '🧩', 'Modelos'], ['/config', '⚙️', 'Config.'],
];

let settings;
const view = () => document.getElementById('view');

function drawNav(path) {
  document.getElementById('nav').innerHTML = `<div class="brand">Vet<span>Laudo</span></div>` +
    NAV.map(([href, ico, label]) => {
      const active = href === '/' ? path === '/' : path.startsWith(href) || (href === '/laudos' && path.startsWith('/laudo/'));
      return `<a href="#${href}" ${active ? 'aria-current="page"' : ''}><span class="ico" aria-hidden="true">${ico}</span><span>${label}</span></a>`;
    }).join('') + '<div class="spacer"></div>';
}

/** Executa uma tela capturando erros para nunca deixar a página em branco. */
const safe = (fn) => async (ctx) => {
  setLeaveGuard(null);
  const v = view();
  v.onclick = v.oninput = v.onchange = null;
  const fresh = v.cloneNode(false); // descarta listeners da tela anterior
  v.replaceWith(fresh);
  try { await fn(fresh, ctx); fresh.focus({ preventScroll: true }); }
  catch (err) {
    console.error(err);
    fresh.innerHTML = `<div class="card"><h2>Algo deu errado</h2><p>${esc(err.message || 'Erro inesperado.')}</p><p class="muted small">Se o problema persistir, verifique se o navegador permite armazenamento local (não use a janela anônima).</p><a class="btn" href="#/">Voltar ao início</a></div>`;
  }
};

async function compare(v, a, b) {
  const [x, y] = await Promise.all([getExam(a), getExam(b)]);
  if (!x || !y) { v.innerHTML = '<div class="card empty">Laudos não encontrados.</div>'; return; }
  v.innerHTML = `<div class="page-head"><h1>Comparar laudos</h1><p class="muted">Cada coluna é um laudo independente; nada é misturado.</p></div>
    <div class="cmp">${[x, y].map((e) => `<div><div class="muted small">v${e.version} · ${e.status === 'final' ? 'Finalizado' : 'Rascunho'}</div>${reportToHtml(buildReport(e, settings))}</div>`).join('')}</div>`;
}

async function viewExams(v, { query }) {
  v.innerHTML = '<div class="page-head"><h1>Meus laudos</h1></div><div id="b"></div>';
  const all = await renderExamBrowser(v.querySelector('#b'), { initial: { q: query.q || '' } });
  void all;
}

async function boot() {
  settings = await loadSettings();
  applyTheme(settings.theme);
  document.addEventListener('route', (e) => drawNav(e.detail.path));
  route('/', safe((v) => renderDashboard(v)));
  route('/novo', safe((v, { query }) => renderNewExam(v, query)));
  route('/laudo/:id', safe((v, { params }) => renderEditor(v, params.id, settings)));
  route('/laudo/:id/nova-versao-estrutura', safe((v, { params }) => startFromPrevious(v, params.id)));
  route('/laudos', safe(viewExams));
  route('/comparar/:a/:b', safe((v, { params }) => compare(v, params.a, params.b)));
  route('/pacientes', safe((v) => renderPatientList(v)));
  route('/paciente/:id', safe((v, { params }) => renderPatientForm(v, params.id)));
  route('/frases', safe((v) => renderPhraseLibrary(v)));
  route('/modelos', safe((v) => renderTemplateList(v)));
  route('/modelo/:id', safe((v, { params }) => renderTemplateForm(v, params.id)));
  route('/config', safe((v) => renderSettings(v, settings, (s) => { settings = s; })));
  await start();
}

boot().catch((err) => {
  console.error(err);
  document.getElementById('view').innerHTML = `<div class="card"><h2>Não foi possível iniciar</h2><p>${esc(err.message)}</p></div>`;
});
window.addEventListener('unhandledrejection', (e) => toast('Ocorreu um erro inesperado. Seus dados salvos não foram afetados.', 'error'));
