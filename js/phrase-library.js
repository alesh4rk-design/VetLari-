// Biblioteca de frases do usuário: CRUD, busca, favoritos, importação/exportação JSON e seletor de inserção.
// Nenhuma frase é fornecida de fábrica: o conteúdo clínico é criado ou aprovado pela veterinária.
import { uid, esc, fmtDateBR, download, toast, todayISO } from './utils.js';
import { dbAll, dbPut, dbDel, getSetting, setSetting } from './local-storage.js';
import { USG_BUILDERS, USG_IMPRESSIONS } from './catalog-usg.js';
import { validatePhrase, validatePhraseImport } from './validation.js';
import { openModal, confirmDialog, alertList, pickOption } from './ui.js';
import { defaultTemplates } from './templates.js';
import { fillPhrase, placeholders, genericizeText } from './phrase-logic.js';

/** Estruturas sugeridas: as dos modelos padrão e do catálogo, mais as já usadas nas frases salvas (o campo aceita texto livre). */
const structureOptions = (extra = []) => {
  const fromTemplates = defaultTemplates().flatMap((t) => (t.sections || []).map((x) => (typeof x === 'string' ? x : x.title)));
  const all = [...Object.keys(USG_BUILDERS), ...fromTemplates, ...extra].map((x) => String(x || '').trim()).filter(Boolean);
  return [...new Map(all.map((x) => [x.toLowerCase(), x])).values()].sort((a, b) => a.localeCompare(b, 'pt-BR'));
};

const MOD_LABEL = { all: 'Todas', usg: 'Ultrassonografia', rx: 'Radiografia' };

export const listPhrases = async () => (await dbAll('phrases')).sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));

export function filterPhrases(all, { q = '', category = '', modality = '', favOnly = false, structure = '' } = {}) {
  const needle = q.trim().toLowerCase();
  return all.filter((p) => {
    if (favOnly && !p.favorite) return false;
    if (category && p.category !== category) return false;
    if (modality && p.modality !== 'all' && p.modality !== modality) return false;
    // Com estrutura informada, mostra as frases dessa estrutura e as gerais (sem estrutura definida).
    if (structure && p.structure && p.structure.toLowerCase() !== structure.toLowerCase()) return false;
    if (!needle) return true;
    return [p.title, p.category, p.structure, p.text, p.keywords].some((f) => String(f || '').toLowerCase().includes(needle));
  });
}

/** Insere texto na posição do cursor sem apagar o conteúdo existente. */
export function insertAtCursor(el, text, { newline = false } = {}) {
  const start = el.selectionStart ?? el.value.length, end = el.selectionEnd ?? start;
  const before = el.value.slice(0, start), after = el.value.slice(end);
  // Em listas (ex.: conclusão), cada frase entra em uma nova linha.
  const sep = newline ? (before && !before.endsWith('\n') ? '\n' : '') : (before && !/[\s]$/.test(before) ? ' ' : '');
  el.value = before + sep + text + after;
  const pos = (before + sep + text).length;
  el.setSelectionRange(pos, pos);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.focus();
}

function phraseForm(p, structures = []) {
  const m = openModal(`<h2>${p.id ? 'Editar frase' : 'Nova frase'}</h2><form id="pf" novalidate>
    <div class="field"><label for="pf-title">Nome curto *</label><input id="pf-title" name="title" value="${esc(p.title)}" maxlength="120" autofocus></div>
    <div class="grid g2"><div class="field"><label for="pf-cat">Categoria</label><input id="pf-cat" name="category" value="${esc(p.category)}" maxlength="80"></div>
    <div class="field"><label for="pf-mod">Modalidade</label><select id="pf-mod" name="modality">${Object.entries(MOD_LABEL).map(([k, v]) => `<option value="${k}" ${p.modality === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div></div>
    <div class="field"><label for="pf-str">Estrutura anatômica relacionada</label><div class="row" style="flex-wrap:nowrap"><input id="pf-str" name="structure" value="${esc(p.structure)}" maxlength="80" list="pf-str-list" autocomplete="off" placeholder="Escolha na lista ou digite" style="flex:1;min-width:0">
      <button type="button" class="btn sm" id="pf-str-pick">Lista</button></div><datalist id="pf-str-list">${structureOptions(structures).map((o) => `<option value="${esc(o)}">`).join('')}</datalist></div>
    <div class="field"><label for="pf-text">Texto completo *</label><textarea id="pf-text" name="text" rows="6" maxlength="5000">${esc(p.text)}</textarea>
      <div class="hint">Campos automáticos: escreva o nome de uma medida entre chaves. Ex.: <code>medindo {Comprimento}</code> vira "medindo 5,2 cm" com o valor e a unidade da medida de mesmo nome na estrutura. Campos sem valor ficam como [PREENCHER: nome].</div></div>
    <div class="field"><label for="pf-kw">Palavras-chave (separadas por vírgula)</label><input id="pf-kw" name="keywords" value="${esc(p.keywords)}"></div>
    <label class="check"><input type="checkbox" name="favorite" ${p.favorite ? 'checked' : ''}> Favorita</label>
    <div id="pf-err"></div>
    <div class="row end"><button type="button" class="btn" data-x="cancel">Cancelar</button><button type="submit" class="btn primary">Salvar</button></div></form>`, { label: 'Frase' });
  return new Promise((resolve) => {
    const form = m.el.querySelector('#pf');
    m.el.querySelector('[data-x=cancel]').onclick = () => m.close(null);
    m.el.querySelector('#pf-str-pick').onclick = async () => {
      const chosen = await pickOption({ title: 'Estrutura anatômica', options: structureOptions(structures) });
      if (chosen) m.el.querySelector('#pf-str').value = chosen;
    };
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const next = { ...p, title: fd.get('title').trim(), category: fd.get('category').trim(), modality: fd.get('modality'),
        structure: fd.get('structure').trim(), text: fd.get('text').trim(), keywords: fd.get('keywords').trim(),
        favorite: fd.get('favorite') === 'on', updatedAt: todayISO() };
      const errs = validatePhrase(next);
      if (errs.length) { m.el.querySelector('#pf-err').innerHTML = alertList('Corrija:', errs, 'error'); return; }
      try { await dbPut('phrases', next); m.close(next); toast('Frase salva.', 'success'); }
      catch { m.el.querySelector('#pf-err').innerHTML = alertList('Erro', ['Não foi possível salvar a frase.'], 'error'); }
    });
    m.closed.then(resolve);
  });
}
const blankPhrase = (over = {}) => ({ id: uid(), title: '', category: '', modality: 'all', structure: '', text: '', keywords: '', favorite: false, ...over });

/** Seletor usado no editor: devolve o texto escolhido (ou null). */
export async function pickPhrase({ modality, structure = '', measures = [] }) {
  const all = await listPhrases();
  const m = openModal(`<h2>Inserir frase</h2>
    <div class="field"><label for="pk-q">Pesquisar</label><input id="pk-q" type="search" autofocus></div>
    ${structure ? `<label class="check"><input type="checkbox" id="pk-str" checked> Ocultar frases de outras estruturas (manter "${esc(structure)}" e gerais)</label>` : ''}
    <div id="pk-list"></div>
    <div class="row end"><button class="btn" data-x="close">Fechar</button></div>`, { label: 'Inserir frase' });
  const render = () => {
    const strict = structure && m.el.querySelector('#pk-str').checked;
    const res = filterPhrases(all, { q: m.el.querySelector('#pk-q').value, modality, structure: strict ? structure : '' })
      .sort((a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0));
    m.el.querySelector('#pk-list').innerHTML = res.length ? res.map((p) => `<div class="phrase"><strong>${p.favorite ? '★ ' : ''}${esc(p.title)}</strong>
      <span class="muted small"> ${esc(p.category)}</span><div class="txt">${esc(placeholders(p.text).length ? fillPhrase(p.text, measures).text : p.text)}</div>
      ${placeholders(p.text).length ? '<div class="small muted">Prévia preenchida com as medidas desta estrutura.</div>' : ''}
      <button class="btn sm primary" data-use="${p.id}">Inserir</button></div>`).join('')
      : `<div class="empty">${all.length ? 'Nenhuma frase encontrada.' : 'Sua biblioteca está vazia. Crie frases em "Biblioteca de frases".'}</div>`;
  };
  render();
  m.el.addEventListener('input', render);
  m.el.addEventListener('click', (e) => {
    if (e.target.closest('[data-x=close]')) return m.close(null);
    const b = e.target.closest('[data-use]');
    if (b) m.close(all.find((p) => p.id === b.dataset.use).text);
  });
  return m.closed;
}

export async function renderPhraseLibrary(view) {
  let all = await listPhrases();
  const f = { q: '', category: '', modality: '', favOnly: false };
  view.innerHTML = `<div class="page-head"><div><h1>Biblioteca de frases</h1><p class="muted">Frases criadas por você, para inserir nos laudos com um toque.</p></div>
    <div class="row"><button class="btn primary" data-act="new">Nova frase</button><button class="btn" data-act="export">Exportar JSON</button>
    <button class="btn" data-act="import">Importar JSON</button><input type="file" id="imp" accept="application/json,.json" style="display:none"></div></div>
    <div class="card"><div class="grid g3"><div class="field"><label for="lq">Pesquisar</label><input id="lq" type="search"></div>
    <div class="field"><label for="lc">Categoria</label><select id="lc"></select></div>
    <div class="field"><label for="lm">Modalidade</label><select id="lm"><option value="">Todas</option><option value="usg">Ultrassonografia</option><option value="rx">Radiografia</option></select></div></div>
    <label class="check"><input type="checkbox" id="lf"> Somente favoritas</label></div><div id="plist"></div>`;
  const draw = () => {
    const cats = [...new Set(all.map((p) => p.category).filter(Boolean))].sort();
    const sel = view.querySelector('#lc');
    sel.innerHTML = `<option value="">Todas</option>${cats.map((c) => `<option ${c === f.category ? 'selected' : ''}>${esc(c)}</option>`).join('')}`;
    const res = filterPhrases(all, f);
    view.querySelector('#plist').innerHTML = res.length ? res.map((p) => `<div class="phrase card"><div class="row between"><div><strong>${p.favorite ? '★ ' : ''}${esc(p.title)}</strong>
      <span class="badge mod">${MOD_LABEL[p.modality] || 'Todas'}</span> <span class="muted small">${esc(p.category)}${p.structure ? ' · ' + esc(p.structure) : ''} · editada em ${fmtDateBR(p.updatedAt)}</span></div>
      <div class="row"><button class="btn sm" data-act="fav" data-id="${p.id}" aria-pressed="${!!p.favorite}">${p.favorite ? 'Desfavoritar' : 'Favoritar'}</button>
      <button class="btn sm" data-act="edit" data-id="${p.id}">Editar</button><button class="btn sm danger" data-act="del" data-id="${p.id}">Excluir</button></div></div>
      <div class="txt">${esc(p.text)}</div></div>`).join('')
      : `<div class="card empty">${all.length ? 'Nenhuma frase encontrada.' : 'Ainda não há frases. Clique em "Nova frase" ou importe um arquivo JSON.'}</div>`;
  };
  draw();
  view.addEventListener('input', (e) => {
    if (e.target.id === 'lq') f.q = e.target.value;
    else if (e.target.id === 'lc') f.category = e.target.value;
    else if (e.target.id === 'lm') f.modality = e.target.value;
    else if (e.target.id === 'lf') f.favOnly = e.target.checked;
    else return;
    const keep = e.target.id === 'lc' ? null : e.target;
    draw();
    if (keep) keep.focus();
  });
  view.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const p = all.find((x) => x.id === b.dataset.id);
    if (b.dataset.act === 'new') { if (await phraseForm(blankPhrase(), all.map((x) => x.structure))) { all = await listPhrases(); draw(); } }
    if (b.dataset.act === 'edit') { if (await phraseForm({ ...p }, all.map((x) => x.structure))) { all = await listPhrases(); draw(); } }
    if (b.dataset.act === 'fav') { await dbPut('phrases', { ...p, favorite: !p.favorite, updatedAt: todayISO() }); all = await listPhrases(); draw(); }
    if (b.dataset.act === 'del' && await confirmDialog(`Excluir a frase "${p.title}"?`, { ok: 'Excluir', danger: true })) {
      await dbDel('phrases', p.id); all = await listPhrases(); draw(); toast('Frase excluída.');
    }
    if (b.dataset.act === 'export') {
      download(new Blob([JSON.stringify(all, null, 2)], { type: 'application/json' }), `VetLaudo_frases_${todayISO()}.json`);
    }
    if (b.dataset.act === 'import') view.querySelector('#imp').click();
  });
  view.querySelector('#imp').addEventListener('change', async (e) => {
    const file = e.target.files[0]; e.target.value = '';
    if (!file) return;
    try {
      const res = validatePhraseImport(JSON.parse(await file.text()));
      if (!res.ok) throw new Error(res.reason);
      for (const p of res.phrases) await dbPut('phrases', blankPhrase({ ...p, id: p.id || uid(), updatedAt: p.updatedAt || todayISO() }));
      all = await listPhrases(); draw();
      toast(`${res.phrases.length} frase(s) importada(s)${res.skipped ? `, ${res.skipped} ignorada(s) por estarem incompletas` : ''}.`, 'success');
    } catch (err) { toast(err instanceof SyntaxError ? 'Arquivo JSON inválido.' : err.message, 'error'); }
  });
}

/**
 * Carrega as impressões diagnósticas dos laudos da veterinária, por versão: cada versão nova do catálogo
 * acrescenta só as frases novas, sem recriar as que ela já excluiu nem duplicar as existentes.
 */
export async function seedImpressions() {
  const legacy = (await getSetting('seeded-usg-impressions-v1', false)) ? 1 : 0;
  const applied = await getSetting('impressions-seed-version', legacy);
  const latest = Math.max(...USG_IMPRESSIONS.map((i) => i[2] || 1));
  if (applied >= latest) return;
  const have = new Set((await dbAll('phrases')).map((x) => x.text));
  for (const [text, structure, ver = 1] of USG_IMPRESSIONS) {
    if (ver <= applied || have.has(text)) continue;
    const title = text.split(/\.\s/)[0].replace(/\.$/, '').slice(0, 70);
    await dbPut('phrases', { id: uid(), title, text, category: 'Impressão diagnóstica', modality: 'usg', structure, keywords: '', favorite: false, updatedAt: todayISO(), source: 'laudos da veterinária' });
  }
  await setSetting('impressions-seed-version', latest);
}

/**
 * "Guardar esta frase": a veterinária decide guardar o texto de um laudo na biblioteca (aparece em "Inserir frase"
 * para a mesma estrutura nos próximos laudos). Nada é guardado sozinho. Valores de medidas viram campos {Medida}.
 */
export async function saveToLibraryDialog({ text, structure, modality, measures, where = '', category = 'Minhas frases' }) {
  const g = genericizeText(text, measures);
  const defTitle = (g.text.replace(/\*\*|__/g, '').split(/[.:]\s/)[0] || structure).slice(0, 60);
  const m = openModal(`<h2>Guardar esta frase</h2>
    <p class="muted small">Ela ficará na Biblioteca de frases e aparecerá em "Inserir frase" nos próximos laudos de <strong>${esc(where || structure)}</strong>. Evite nomes de pacientes ou tutores.</p>
    <form id="sf" novalidate>
    <div class="field"><label for="sv-title">Nome curto *</label><input id="sv-title" value="${esc(defTitle)}" maxlength="120" autofocus></div>
    <div class="field"><label for="sv-text">Texto *</label><textarea id="sv-text" rows="6">${esc(g.text)}</textarea>
      <div class="hint">${g.replaced.length ? `Troquei os valores digitados por campos: ${g.replaced.map((x) => `{${esc(x)}}`).join(', ')}. Assim, no próximo laudo a frase se preenche com as novas medidas.` : 'Use {Nome da medida} onde entra uma medida, para a frase se preencher sozinha.'}</div></div>
    <div id="sv-err"></div><div class="row end"><button type="button" class="btn" data-x="cancel">Cancelar</button><button type="submit" class="btn primary">Guardar na biblioteca</button></div></form>`, { label: 'Guardar frase' });
  return new Promise((resolve) => {
    m.el.querySelector('[data-x=cancel]').onclick = () => m.close(null);
    m.el.querySelector('#sf').addEventListener('submit', async (e) => {
      e.preventDefault();
      const phrase = { id: uid(), title: m.el.querySelector('#sv-title').value.trim(), category, modality, structure, text: m.el.querySelector('#sv-text').value.trim(),
        keywords: '', favorite: false, updatedAt: todayISO(), source: 'minha' };
      const errs = validatePhrase(phrase);
      if (errs.length) { m.el.querySelector('#sv-err').innerHTML = alertList('Corrija:', errs, 'error'); return; }
      if ((await listPhrases()).some((x) => x.text === phrase.text && x.structure === structure)) { m.el.querySelector('#sv-err').innerHTML = alertList('Atenção', ['Essa frase já está na biblioteca para esta estrutura.'], 'warn'); return; }
      try { await dbPut('phrases', phrase); m.close(phrase); toast('Frase guardada na biblioteca.', 'success'); }
      catch { m.el.querySelector('#sv-err').innerHTML = alertList('Erro', ['Não foi possível guardar a frase.'], 'error'); }
    });
    m.closed.then(resolve);
  });
}
