// "Meus modelos": criação e edição de modelos de laudo (estruturas, títulos, assinatura, layout de imagens).
import { esc, toast, uid } from './utils.js';
import { listTemplates, getTemplate, saveTemplate, deleteTemplate, newTemplate, cloneTemplate } from './templates.js';
import { navigate } from './router.js';
import { confirmDialog, alertList } from './ui.js';
import { moveItem } from './image-manager.js';

export async function renderTemplateList(view) {
  const all = await listTemplates();
  const group = (mod, title) => `<div class="card"><h2>${title}</h2><ul class="list">${all.filter((t) => t.modality === mod).map((t) => `<li><div><strong>${esc(t.name)}</strong>
    ${t.builtin ? '<span class="badge mod">Modelo inicial</span>' : ''}<div class="muted small">${t.sections.length} estruturas</div></div>
    <div class="row">${t.builtin ? `<button class="btn sm" data-act="dup" data-id="${t.id}">Duplicar e editar</button>`
      : `<a class="btn sm" href="#/modelo/${t.id}">Editar</a><button class="btn sm" data-act="dup" data-id="${t.id}">Duplicar</button><button class="btn sm danger" data-act="del" data-id="${t.id}">Excluir</button>`}</div></li>`).join('')}</ul>
    <button class="btn" data-act="new" data-mod="${mod}">Novo modelo de ${title.toLowerCase()}</button></div>`;
  view.innerHTML = `<div class="page-head"><div><h1>Meus modelos</h1><p class="muted">Os modelos iniciais são apenas um ponto de partida: monte as estruturas da sua rotina.</p></div></div>
    ${group('usg', 'Ultrassonografia')}${group('rx', 'Radiografia')}`;
  view.onclick = async (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    if (b.dataset.act === 'new') { const t = newTemplate(b.dataset.mod); await saveTemplate(t); navigate(`/modelo/${t.id}`); }
    if (b.dataset.act === 'dup') { const t = cloneTemplate(await getTemplate(b.dataset.id)); await saveTemplate(t); navigate(`/modelo/${t.id}`); }
    if (b.dataset.act === 'del' && await confirmDialog('Excluir este modelo? Laudos já criados não são afetados.', { ok: 'Excluir', danger: true })) {
      await deleteTemplate(b.dataset.id); renderTemplateList(view);
    }
  };
}

export async function renderTemplateForm(view, id) {
  const t = await getTemplate(id);
  if (!t || t.builtin) { view.innerHTML = '<div class="card empty">Modelo não encontrado ou não editável. Duplique o modelo inicial para editar.</div>'; return; }
  const draw = () => {
    view.innerHTML = `<div class="page-head"><h1>Editar modelo</h1></div><form class="card" id="tf" novalidate>
      <div class="grid g2"><div class="field"><label for="t-name">Nome do modelo *</label><input id="t-name" data-t="name" value="${esc(t.name)}" maxlength="120"></div>
      <div class="field"><label for="t-doc">Título do documento</label><input id="t-doc" data-t="docTitle" value="${esc(t.docTitle)}"></div>
      <div class="field"><label for="t-con">Título do campo de conclusão</label><input id="t-con" data-t="conclusionTitle" value="${esc(t.conclusionTitle)}"></div>
      <div class="field"><label for="t-not">Título das observações</label><input id="t-not" data-t="notesTitle" value="${esc(t.notesTitle)}"></div>
      <div class="field"><label for="t-row">Imagens por linha</label><select id="t-row" data-t="imagesPerRow" data-num="1">${[1, 2, 3].map((n) => `<option ${t.imagesPerRow === n ? 'selected' : ''}>${n}</option>`).join('')}</select></div></div>
      <div class="field"><label for="t-intro">Texto introdutório padrão (opcional)</label><textarea id="t-intro" data-t="intro" rows="2">${esc(t.intro)}</textarea></div>
      <label class="check"><input type="checkbox" data-t="signature" ${t.signature ? 'checked' : ''}> Incluir identificação e linha de assinatura</label>
      <h2 style="margin-top:12px">Estruturas</h2>
      ${t.sections.map((s, i) => `<div class="sec-head" data-s="${s.id}"><input data-st aria-label="Nome da estrutura ${i + 1}" value="${esc(s.title)}">
        <button type="button" class="iconbtn" data-act="up" aria-label="Subir" ${i === 0 ? 'disabled' : ''}>▲</button>
        <button type="button" class="iconbtn" data-act="down" aria-label="Descer" ${i === t.sections.length - 1 ? 'disabled' : ''}>▼</button>
        <button type="button" class="iconbtn danger" data-act="rm" aria-label="Excluir">✕</button></div>`).join('')}
      <div class="row" style="margin:8px 0 16px"><input id="ns" placeholder="Nova estrutura" aria-label="Nova estrutura" style="flex:1;min-width:200px"><button type="button" class="btn" data-act="add">Adicionar</button></div>
      <div id="terr"></div><div class="row"><button class="btn primary" type="submit">Salvar modelo</button><a class="btn" href="#/modelos">Voltar</a></div></form>`;
  };
  draw();
  view.oninput = (e) => {
    const el = e.target;
    if (el.dataset.t) t[el.dataset.t] = el.type === 'checkbox' ? el.checked : el.dataset.num ? Number(el.value) : el.value;
    if (el.dataset.st !== undefined) t.sections.find((s) => s.id === el.closest('[data-s]').dataset.s).title = el.value;
  };
  view.onclick = (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const sid = b.closest('[data-s]') && b.closest('[data-s]').dataset.s;
    if (b.dataset.act === 'up') moveItem(t.sections, sid, -1);
    if (b.dataset.act === 'down') moveItem(t.sections, sid, 1);
    if (b.dataset.act === 'rm') t.sections = t.sections.filter((s) => s.id !== sid);
    if (b.dataset.act === 'add') { const v = view.querySelector('#ns').value.trim(); if (!v) return; t.sections.push({ id: uid(), title: v }); }
    draw();
  };
  view.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errs = [];
    if (!t.name.trim()) errs.push('Informe o nome do modelo.');
    if (!t.sections.length) errs.push('Inclua ao menos uma estrutura.');
    if (t.sections.some((s) => !s.title.trim())) errs.push('Há estruturas sem nome.');
    if (errs.length) { view.querySelector('#terr').innerHTML = alertList('Corrija:', errs, 'error'); return; }
    await saveTemplate(t); toast('Modelo salvo.', 'success'); navigate('/modelos');
  });
}
