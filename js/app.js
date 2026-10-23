// Ponto de entrada: navegação, rotas, tema e tratamento global de erros.
import { route, start, setLeaveGuard, currentPath } from './router.js';
import { attachHelp, helpKeyForPath } from './help.js';
import { loadSettings } from './templates.js';
import { applyTheme, renderSettings } from './settings.js';
import { renderDashboard } from './dashboard.js';
import { renderPatientList, renderPatientForm } from './patients.js';
import { renderPhraseLibrary, seedImpressions } from './phrase-library.js';
import { renderTemplateList, renderTemplateForm } from './template-editor.js';
import { renderReferences } from './references.js';
import { renderCalculations } from './calculations.js';
import { renderNewExam, renderEditor, startFromPrevious } from './editor.js';
import { renderExamBrowser, getExam } from './exams.js';
import { buildReport } from './report-model.js';
import { reportToHtml } from './preview.js';
import { esc, toast } from './utils.js';
import { APP_VERSION } from './version.js';
import { loadRegistry, getActive, chosenThisSession } from './profiles.js';
import { renderProfilePicker } from './profile-ui.js';
import { useDatabase } from './local-storage.js';
import { saveSettings } from './templates.js';
import { compareMeasures, orderByDate } from './compare.js';
import { fmtDateBR } from './utils.js';

const NAV = [
  ['/', '🏠', 'Início'], ['/novo', '➕', 'Novo laudo'], ['/laudos', '📄', 'Laudos'], ['/pacientes', '🐾', 'Pacientes'],
  ['/frases', '💬', 'Frases'], ['/modelos', '🧩', 'Modelos'], ['/referencias', '📚', 'Bases'], ['/config', '⚙️', 'Config.'],
];

let settings;
let profile;
const view = () => document.getElementById('view');

function drawNav(path) {
  document.getElementById('nav').innerHTML = `<div class="brand">Vet<span>Laudo</span></div>` +
    NAV.map(([href, ico, label]) => {
      const active = href === '/' ? path === '/' : path.startsWith(href) || (href === '/laudos' && path.startsWith('/laudo/')) || (href === '/referencias' && path.startsWith('/calculos'));
      return `<a href="#${href}" ${active ? 'aria-current="page"' : ''}><span class="ico" aria-hidden="true">${ico}</span><span>${label}</span></a>`;
    }).join('') + `<div class="spacer"></div><a href="#/perfis" class="profile-link" title="Trocar perfil"><span class="ico" aria-hidden="true">👤</span><span>${esc(profile ? profile.name : 'Perfil')}</span></a><div class="app-version" title="Versão do sistema">v${esc(APP_VERSION)}</div>`;
}

/** Executa uma tela capturando erros para nunca deixar a página em branco. */
const safe = (fn) => async (ctx) => {
  setLeaveGuard(null);
  const v = view();
  v.onclick = v.oninput = v.onchange = null;
  const fresh = v.cloneNode(false); // descarta listeners da tela anterior
  v.replaceWith(fresh);
  try { await fn(fresh, ctx); attachHelp(fresh, helpKeyForPath(currentPath())); fresh.focus({ preventScroll: true }); }
  catch (err) {
    console.error(err);
    fresh.innerHTML = `<div class="card"><h2>Algo deu errado</h2><p>${esc(err.message || 'Erro inesperado.')}</p><p class="muted small">Se o problema persistir, verifique se o navegador permite armazenamento local (não use a janela anônima).</p><a class="btn" href="#/">Voltar ao início</a></div>`;
  }
};

async function compare(v, a, b) {
  const [x, y] = await Promise.all([getExam(a), getExam(b)]);
  if (!x || !y) { v.innerHTML = '<div class="card empty">Laudos não encontrados.</div>'; return; }
  const [early, late] = orderByDate(x, y);
  const { rows, notes } = compareMeasures(early, late);
  const cell = (m) => (m ? `${esc(m.value)} ${esc(m.unit)}` : '—');
  v.innerHTML = `<div class="page-head"><div><h1>Comparar laudos</h1><p class="muted">Comparação de medidas e textos. O sistema não conclui crescimento, redução ou evolução: a interpretação é da veterinária.</p></div></div>
    <div class="card"><h2>Medidas</h2>${notes.length ? `<div class="alert warn"><ul>${notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul></div>` : ''}
    ${rows.length ? `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse"><thead><tr><th align="left">Estrutura / medida</th><th align="left">${fmtDateBR(early.date)} (v${early.version})</th><th align="left">${fmtDateBR(late.date)} (v${late.version})</th><th align="left">Diferença numérica</th></tr></thead><tbody>${rows.map((r) => `<tr style="border-top:1px solid var(--line)"><td>${esc(r.structure)}${r.label ? ' — ' + esc(r.label) : ''}</td><td>${cell(r.earlier)}</td><td>${cell(r.later)}</td>
      <td>${r.comparable ? `${r.delta > 0 ? '+' : ''}${String(r.delta).replace('.', ',')} ${esc(r.earlier.unit)}` : `<span class="muted small">Não comparável: ${esc(r.reason)}</span>`}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Nenhuma medida estruturada registrada nos exames.</p>'}</div>
    <div class="cmp">${[early, late].map((e) => `<div><div class="muted small">v${e.version} · ${esc(e.status)}</div>${reportToHtml(buildReport(e, settings))}</div>`).join('')}</div>`;
}

async function viewExams(v, { query }) {
  v.innerHTML = '<div class="page-head"><h1>Meus laudos</h1></div><div id="b"></div>';
  await renderExamBrowser(v.querySelector('#b'), { initial: { q: query.q || '' }, profile });
}

/** Registra o modo offline e avisa quando uma versão nova é instalada (sem recarregar sozinho, para não interromper o trabalho). */
function registerServiceWorker() {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('service-worker.js').then((reg) => {
    reg.update().catch(() => {});
    document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
  }).catch(() => { /* sem offline: segue normalmente */ });
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || document.getElementById('update-banner')) return;
    const bar = document.createElement('div');
    bar.id = 'update-banner'; bar.setAttribute('role', 'status');
    bar.innerHTML = '<span>Nova versão do VetLaudo instalada.</span> <button class="btn sm primary" id="update-now">Atualizar agora</button>';
    document.body.appendChild(bar);
    document.getElementById('update-now').onclick = () => location.reload();
  });
}

async function boot() {
  const reg = loadRegistry();
  const needPicker = location.hash === '#/perfis' || (reg.profiles.length > 1 && !chosenThisSession());
  if (needPicker) {
    document.getElementById('nav').innerHTML = '<div class="brand">Vet<span>Laudo</span></div>';
    renderProfilePicker(document.getElementById('view'), { onChosen: () => { location.hash = '#/'; location.reload(); } });
    return;
  }
  profile = getActive();
  useDatabase(profile.db);
  settings = await loadSettings();
  if (!settings.professional.name) { settings.professional.name = profile.name; await saveSettings(settings); }
  applyTheme(settings.theme);
  await seedImpressions().catch(() => { /* sem armazenamento: segue sem frases iniciais */ });
  if ('serviceWorker' in navigator) registerServiceWorker();
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  document.addEventListener('route', (e) => drawNav(e.detail.path));
  route('/', safe((v) => renderDashboard(v, profile)));
  route('/novo', safe((v, { query }) => renderNewExam(v, query)));
  route('/laudo/:id', safe((v, { params }) => renderEditor(v, params.id, settings, profile)));
  route('/laudo/:id/nova-versao-estrutura', safe((v, { params }) => startFromPrevious(v, params.id)));
  route('/laudos', safe(viewExams));
  route('/comparar/:a/:b', safe((v, { params }) => compare(v, params.a, params.b)));
  route('/pacientes', safe((v) => renderPatientList(v)));
  route('/paciente/:id', safe((v, { params }) => renderPatientForm(v, params.id)));
  route('/frases', safe((v) => renderPhraseLibrary(v)));
  route('/modelos', safe((v) => renderTemplateList(v)));
  route('/referencias', safe((v) => renderReferences(v, profile)));
  route('/calculos', safe((v) => renderCalculations(v)));
  route('/modelo/:id', safe((v, { params }) => renderTemplateForm(v, params.id)));
  route('/config', safe((v) => renderSettings(v, settings, (s) => { settings = s; })));
  route('/perfis', () => { location.reload(); });
  await start();
}

boot().catch((err) => {
  console.error(err);
  document.getElementById('view').innerHTML = `<div class="card"><h2>Não foi possível iniciar</h2><p>${esc(err.message)}</p></div>`;
});
window.addEventListener('unhandledrejection', (e) => toast('Ocorreu um erro inesperado. Seus dados salvos não foram afetados.', 'error'));
