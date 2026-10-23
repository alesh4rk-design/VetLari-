// Base de referências: cadastrada, revisada e aprovada pela própria veterinária.
// O sistema não traz valores prontos. Referências só são usadas pelo sistema depois de APROVADAS.
import { uid, esc, todayISO, fmtDateBR, download, toast } from './utils.js';
import { dbAll, dbPut, dbDel } from './local-storage.js';
import { openModal, confirmDialog, alertList } from './ui.js';
import { can } from './profiles.js';
import { validateReference, canApprove, isOutdated, rangeText, REF_KINDS, sanitizeImportedReferences } from './reference-logic.js';

export const listReferences = async () => (await dbAll('references')).sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));
const blank = () => ({ id: uid(), kind: 'scientific', title: '', citation: '', doi: '', url: '', species: '', population: '', structure: '', measureLabel: '',
  unit: '', min: '', max: '', method: '', criteria: '', limitations: '', revisionDate: '', version: '1', status: 'draft', approvedBy: '', approvedAt: '' });

const FIELDS = [
  ['title', 'Nome da referência *', 'text'], ['citation', 'Fonte: autores/instituição, publicação e ano *', 'text'],
  ['doi', 'DOI', 'text'], ['url', 'URL (https://...)', 'text'],
  ['species', 'Espécie estudada *', 'text'], ['population', 'População (porte, idade, raça...)', 'text'],
  ['structure', 'Estrutura relacionada (ex.: Rim direito)', 'text'], ['measureLabel', 'Nome da medida (igual ao usado nos laudos)', 'text'],
  ['unit', 'Unidade', 'text'], ['min', 'Mínimo publicado', 'text'], ['max', 'Máximo publicado', 'text'],
  ['method', 'Método de aquisição e medição', 'text'], ['revisionDate', 'Data da última revisão', 'date'], ['version', 'Versão', 'text'],
];

function form(ref) {
  const m = openModal(`<h2>${ref.title ? 'Editar referência' : 'Nova referência'}</h2>
    <p class="muted small">Cadastre apenas valores que você verificou na fonte. Ao salvar, a referência fica como <strong>rascunho</strong>; só depois de aprovada ela passa a ser usada pelo sistema.</p>
    <form id="rf" novalidate><div class="field"><label for="r-kind">Tipo</label><select id="r-kind" name="kind">${Object.entries(REF_KINDS).map(([k, v]) => `<option value="${k}" ${ref.kind === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
    <div class="grid g2">${FIELDS.map(([n, l, t]) => `<div class="field"><label for="r-${n}">${l}</label><input id="r-${n}" name="${n}" type="${t}" value="${esc(ref[n])}" ${n === 'title' ? 'autofocus' : ''}></div>`).join('')}</div>
    <div class="field"><label for="r-criteria">Critérios publicados (texto)</label><textarea id="r-criteria" name="criteria" rows="2">${esc(ref.criteria)}</textarea></div>
    <div class="field"><label for="r-limitations">Limitações da referência</label><textarea id="r-limitations" name="limitations" rows="2">${esc(ref.limitations)}</textarea></div>
    <div id="rerr"></div><div class="row end"><button type="button" class="btn" data-x="cancel">Cancelar</button><button type="submit" class="btn primary">Salvar como rascunho</button></div></form>`, { wide: true, label: 'Referência' });
  return new Promise((resolve) => {
    m.el.querySelector('[data-x=cancel]').onclick = () => m.close(null);
    m.el.querySelector('#rf').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = Object.fromEntries(new FormData(e.target));
      const next = { ...ref, ...Object.fromEntries(Object.entries(fd).map(([k, v]) => [k, String(v).trim()])), status: 'draft', approvedBy: '', approvedAt: '' };
      const { errors, warnings } = validateReference(next);
      if (errors.length) { m.el.querySelector('#rerr').innerHTML = alertList('Corrija:', errors, 'error'); return; }
      try { await dbPut('references', next); m.close(next); toast(warnings.length ? `Referência salva como rascunho. Atenção: ${warnings[0]}` : 'Referência salva como rascunho.', warnings.length ? 'info' : 'success'); }
      catch { m.el.querySelector('#rerr').innerHTML = alertList('Erro', ['Não foi possível salvar.'], 'error'); }
    });
    m.closed.then(resolve);
  });
}

export const referenceCard = (r) => `<div class="phrase card"><div class="row between"><div><strong>${esc(r.title)}</strong>
  <span class="badge ${r.status === 'approved' ? 'final' : 'draft'}">${r.status === 'approved' ? 'Aprovada' : 'Rascunho'}</span>
  <span class="badge mod">${esc(REF_KINDS[r.kind] || r.kind)}</span>${r.status === 'approved' && isOutdated(r) ? ' <span class="badge draft">Desatualizada</span>' : ''}</div></div>
  <div class="txt">${esc(r.citation)}${r.doi ? `\nDOI: ${esc(r.doi)}` : ''}${r.url ? `\nURL: ${esc(r.url)}` : ''}
Espécie: ${esc(r.species)}${r.population ? ' · ' + esc(r.population) : ''}${r.structure ? ' · Estrutura: ' + esc(r.structure) : ''}${r.measureLabel ? ' · Medida: ' + esc(r.measureLabel) : ''}
${r.min || r.max ? `Intervalo publicado: ${esc(rangeText(r))}\n` : ''}${r.method ? `Método: ${esc(r.method)}\n` : ''}${r.criteria ? `Critérios: ${esc(r.criteria)}\n` : ''}${r.limitations ? `Limitações: ${esc(r.limitations)}\n` : ''}Revisão: ${r.revisionDate ? fmtDateBR(r.revisionDate) : 'não informada'} · versão ${esc(r.version || '1')}${r.approvedBy ? ` · aprovada por ${esc(r.approvedBy)} em ${fmtDateBR(r.approvedAt)}` : ''}</div></div>`;

export async function renderReferences(view, profile) {
  let all = await listReferences();
  const f = { q: '', status: '' };
  view.innerHTML = `<div class="page-head"><div><h1>Bases técnicas</h1><p class="muted">Referências e cálculos cadastrados por você. O sistema não traz valores nem fórmulas prontos.</p></div></div>
    <nav class="steps" aria-label="Bases"><button aria-current="step" disabled>Referências</button><a class="btn sm" href="#/calculos" style="align-self:center">Cálculos</a></nav>
    <div class="row" style="margin-bottom:12px"><button class="btn primary" data-act="new">Nova referência</button><button class="btn" data-act="export">Exportar JSON</button><button class="btn" data-act="import">Importar JSON</button><input type="file" id="imp" accept="application/json,.json" style="display:none"></div>
    <div class="card"><div class="grid g2"><div class="field"><label for="rq">Pesquisar</label><input id="rq" type="search"></div>
    <div class="field"><label for="rs">Situação</label><select id="rs"><option value="">Todas</option><option value="approved">Aprovadas</option><option value="draft">Rascunhos</option></select></div></div></div><div id="rlist"></div>`;
  const draw = () => {
    const q = f.q.toLowerCase();
    const res = all.filter((r) => (!f.status || r.status === f.status) && (!q || [r.title, r.citation, r.species, r.structure, r.measureLabel].join(' ').toLowerCase().includes(q)));
    view.querySelector('#rlist').innerHTML = res.length ? res.map((r) => `<div>${referenceCard(r)}<div class="row" style="margin:-8px 0 16px">
      ${r.status === 'approved' ? '' : can(profile, 'finalize') ? `<button class="btn sm primary" data-act="approve" data-id="${r.id}">Aprovar para uso</button>` : '<span class="muted small">Aprovação exige perfil de médico(a)-veterinário(a).</span>'}
      <button class="btn sm" data-act="edit" data-id="${r.id}">Editar</button><button class="btn sm danger" data-act="del" data-id="${r.id}">Excluir</button></div></div>`).join('')
      : `<div class="card empty">${all.length ? 'Nenhuma referência encontrada.' : 'Nenhuma referência cadastrada. Clique em "Nova referência".'}</div>`;
  };
  draw();
  view.addEventListener('input', (e) => { if (e.target.id === 'rq') f.q = e.target.value; else if (e.target.id === 'rs') f.status = e.target.value; else return; draw(); });
  view.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const r = all.find((x) => x.id === b.dataset.id);
    const reload = async () => { all = await listReferences(); draw(); };
    if (b.dataset.act === 'new') { if (await form(blank())) await reload(); }
    else if (b.dataset.act === 'edit') {
      if (r.status === 'approved' && !await confirmDialog('Editar uma referência aprovada a devolve para rascunho até nova aprovação. Continuar?', { ok: 'Editar' })) return;
      if (await form({ ...r })) await reload();
    } else if (b.dataset.act === 'approve') {
      const ok = canApprove(r);
      if (!ok.ok) return toast(ok.reason, 'error');
      if (await confirmDialog(`Aprovar "${r.title}" para uso no sistema? Você confirma que conferiu os dados na fonte.`, { ok: 'Aprovar' })) {
        await dbPut('references', { ...r, status: 'approved', approvedBy: profile.name, approvedAt: todayISO() }); await reload(); toast('Referência aprovada.', 'success');
      }
    } else if (b.dataset.act === 'del' && await confirmDialog(`Excluir a referência "${r.title}"?`, { ok: 'Excluir', danger: true })) { await dbDel('references', r.id); await reload(); }
    else if (b.dataset.act === 'export') download(new Blob([JSON.stringify(all, null, 2)], { type: 'application/json' }), `VetLaudo_referencias_${todayISO()}.json`);
    else if (b.dataset.act === 'import') view.querySelector('#imp').click();
  });
  view.querySelector('#imp').addEventListener('change', async (e) => {
    const file = e.target.files[0]; e.target.value = ''; if (!file) return;
    try {
      const res = sanitizeImportedReferences(JSON.parse(await file.text()));
      if (!res.ok) throw new Error(res.reason);
      for (const r of res.refs) await dbPut('references', { ...r, id: uid() });
      all = await listReferences(); draw();
      toast(`${res.refs.length} referência(s) importada(s) como RASCUNHO${res.skipped ? `; ${res.skipped} ignorada(s) por estarem incompletas` : ''}. Revise e aprove cada uma.`, 'success');
    } catch (err) { toast(err instanceof SyntaxError ? 'Arquivo JSON inválido.' : err.message, 'error'); }
  });
}
