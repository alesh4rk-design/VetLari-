// Página inicial: atalhos, indicadores, avisos de revisão e exames recentes com filtros.
import { listExams, renderExamBrowser } from './exams.js';
import { navigate } from './router.js';
import { esc } from './utils.js';

export async function renderDashboard(view) {
  const all = await listExams();
  const drafts = all.filter((e) => e.status !== 'final');
  const finals = all.filter((e) => e.status === 'final');
  const stale = drafts.filter((e) => Date.now() - e.updatedAt > 3 * 86400000);
  view.innerHTML = `<div class="page-head"><div><h1>Início</h1><p class="muted">Painel de laudos veterinários</p></div></div>
    <div class="grid g3" style="margin-bottom:16px">
      <a class="btn big primary" href="#/novo"><span>Novo laudo</span></a><a class="btn big" href="#/paciente/novo"><span>Novo paciente</span></a>
      <a class="btn big" href="#/frases"><span>Biblioteca de frases</span></a><a class="btn big" href="#/modelos"><span>Meus modelos</span></a>
      <a class="btn big" href="#/laudos"><span>Meus laudos</span></a>
      <form id="qs" role="search" class="card" style="margin:0;padding:8px"><label class="sr" for="qq" style="position:absolute;left:-999px">Pesquisar laudos</label><input id="qq" type="search" placeholder="Pesquisar laudos…"></form></div>
    <div class="grid g2 keep2" style="margin-bottom:16px"><div class="card stat"><div class="n">${drafts.length}</div>Rascunhos e preliminares</div><div class="card stat"><div class="n">${finals.length}</div>Laudos finalizados</div></div>
    ${stale.length ? `<div class="alert warn" role="alert"><strong>${stale.length} rascunho(s) parado(s) há mais de 3 dias e ainda sem finalização:</strong><ul>${stale.slice(0, 5).map((e) => `<li><a href="#/laudo/${e.id}">${esc(e.patient.name || 'Sem nome')}</a></li>`).join('')}</ul></div>` : ''}
    <h2>Exames recentes</h2><div id="recent"></div>`;
  view.querySelector('#qs').addEventListener('submit', (e) => { e.preventDefault(); navigate(`/laudos?q=${encodeURIComponent(view.querySelector('#qq').value)}`); });
  await renderExamBrowser(view.querySelector('#recent'), { compact: true, limit: 8 });
}
