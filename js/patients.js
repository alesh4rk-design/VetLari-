// Cadastro e consulta de pacientes.
import { uid, esc, todayISO, toast, ageFromBirth } from './utils.js';
import { SPECIES, breedsFor, optionsHtml, defaultWeightUnit } from './animals.js';
import { dbAll, dbGet, dbPut, dbDel } from './local-storage.js';
import { validatePatient, SEXES } from './validation.js';
import { navigate } from './router.js';
import { confirmDialog, alertList, pickOption } from './ui.js';

export const listPatients = async () => (await dbAll('patients')).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
export const getPatient = (id) => dbGet('patients', id);
export const emptyPatient = () => ({ id: uid(), name: '', species: '', breed: '', sex: '', birthDate: '', age: '', weight: '', weightUnit: 'kg', tutor: '', identifier: '' });

export async function upsertPatient(p) {
  const errs = validatePatient(p);
  if (errs.length) throw new Error(errs.join(' '));
  await dbPut('patients', { ...p, name: p.name.trim(), updatedAt: Date.now() });
}

export async function renderPatientList(view) {
  let all = await listPatients();
  view.innerHTML = `<div class="page-head"><h1>Pacientes</h1><a class="btn primary" href="#/paciente/novo">Novo paciente</a></div>
    <div class="card"><div class="field"><label for="pq">Pesquisar por animal ou tutor</label><input id="pq" type="search"></div><div id="pl"></div></div>`;
  const draw = () => {
    const q = view.querySelector('#pq').value.trim().toLowerCase();
    const res = all.filter((p) => !q || `${p.name} ${p.tutor}`.toLowerCase().includes(q));
    view.querySelector('#pl').innerHTML = res.length ? `<ul class="list">${res.map((p) => `<li><div><strong>${esc(p.name)}</strong>
      <div class="muted small">${esc([p.species, p.breed, p.tutor && 'Tutor: ' + p.tutor].filter(Boolean).join(' · '))}</div></div>
      <div class="row"><a class="btn sm primary" href="#/novo?paciente=${p.id}">Novo laudo</a><a class="btn sm" href="#/paciente/${p.id}">Editar</a></div></li>`).join('')}</ul>`
      : `<div class="empty">${all.length ? 'Nenhum paciente encontrado.' : 'Nenhum paciente cadastrado ainda.'}</div>`;
  };
  draw();
  view.querySelector('#pq').addEventListener('input', draw);
}

export async function renderPatientForm(view, id) {
  const existing = id === 'novo' ? null : await getPatient(id);
  if (id !== 'novo' && !existing) { view.innerHTML = '<div class="card empty">Paciente não encontrado.</div>'; return; }
  const p = existing || emptyPatient();
  const combo = (name, label, listId) => `<div class="field"><label for="p-${name}">${label}</label><div class="row" style="flex-wrap:nowrap">
    <input id="p-${name}" name="${name}" value="${esc(p[name])}" list="${listId}" autocomplete="off" placeholder="Escolha ou digite" style="flex:1;min-width:0">
    <button type="button" class="btn sm" data-pick="${name}">Lista</button></div></div>`;
  const f = (name, label, type = 'text', extra = '') => `<div class="field"><label for="p-${name}">${label}</label><input id="p-${name}" name="${name}" type="${type}" value="${esc(p[name])}" ${extra}></div>`;
  view.innerHTML = `<div class="page-head"><h1>${existing ? 'Editar paciente' : 'Novo paciente'}</h1></div><form class="card" id="pf" novalidate>
    <div class="grid g2">${f('name', 'Nome do animal *', 'text', 'autofocus required maxlength="200"')}${combo('species', 'Espécie', 'species-list')}${combo('breed', 'Raça', 'breeds-list')}
    <datalist id="species-list">${optionsHtml(SPECIES)}</datalist><datalist id="breeds-list">${optionsHtml(breedsFor(p.species))}</datalist>
    <div class="field"><label for="p-sex">Sexo</label><select id="p-sex" name="sex">${SEXES.map((s) => `<option value="${s}" ${p.sex === s ? 'selected' : ''}>${s || 'Selecione'}</option>`).join('')}</select></div>
    ${f('birthDate', 'Data de nascimento', 'date', `max="${todayISO()}"`)}
    <div class="field"><label for="p-age">Idade</label><input id="p-age-auto" readonly value="${esc(ageFromBirth(p.birthDate))}" ${p.birthDate ? '' : 'hidden'}>
      <input id="p-age" name="age" value="${esc(p.age)}" placeholder="Ex.: 3 anos" ${p.birthDate && ageFromBirth(p.birthDate) ? 'hidden' : ''}>
      <div class="hint" id="p-age-hint">Com a data de nascimento, a idade é calculada sozinha; sem ela, digite a idade.</div></div>
    ${f('weight', 'Peso', 'text', 'inputmode="decimal"')}<div class="field"><label for="p-weightUnit">Unidade do peso</label><select id="p-weightUnit" name="weightUnit">${['kg', 'g'].map((u) => `<option value="${u}" ${(p.weightUnit || 'kg') === u ? 'selected' : ''}>${u === 'kg' ? 'quilos (kg)' : 'gramas (g)'}</option>`).join('')}</select></div>${f('tutor', 'Nome do tutor')}${f('identifier', 'Identificador interno (opcional)')}</div>
    <div id="perr"></div>
    <div class="row between"><div class="row"><button class="btn primary" type="submit">Salvar paciente</button><a class="btn" href="#/pacientes">Cancelar</a></div>
    ${existing ? '<button class="btn danger" type="button" id="del">Excluir paciente</button>' : ''}</div></form>`;
  view.querySelector('#pf').addEventListener('input', (e) => {
    if (e.target.id === 'p-species') {
      view.querySelector('#breeds-list').innerHTML = optionsHtml(breedsFor(e.target.value));
      if (!view.querySelector('#p-weight').value.trim()) view.querySelector('#p-weightUnit').value = defaultWeightUnit(e.target.value);
    }
    if (e.target.id === 'p-birthDate') {
      const auto = ageFromBirth(e.target.value), a = view.querySelector('#p-age-auto'), m = view.querySelector('#p-age');
      a.value = auto; a.hidden = !auto; m.hidden = !!auto;
    }
  });
  view.querySelector('#pf').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-pick]'); if (!b) return;
    const kind = b.dataset.pick, input = view.querySelector('#p-' + kind);
    const options = kind === 'species' ? SPECIES : breedsFor(view.querySelector('#p-species').value);
    if (!options.length) return toast('Não há sugestões de raça para esta espécie: digite a raça no campo.', 'info');
    const chosen = await pickOption({ title: kind === 'species' ? 'Espécie' : 'Raça', options });
    if (chosen) { input.value = chosen; input.dispatchEvent(new Event('input', { bubbles: true })); }
  });
  view.querySelector('#pf').addEventListener('submit', async (e) => {
    e.preventDefault();
    const next = { ...p, ...Object.fromEntries(new FormData(e.target)) };
    const errs = validatePatient(next);
    if (errs.length) { view.querySelector('#perr').innerHTML = alertList('Corrija:', errs, 'error'); return; }
    try { await upsertPatient(next); toast('Paciente salvo.', 'success'); navigate('/pacientes'); }
    catch { toast('Não foi possível salvar o paciente.', 'error'); }
  });
  const del = view.querySelector('#del');
  if (del) del.addEventListener('click', async () => {
    if (await confirmDialog('Excluir este paciente do cadastro? Os laudos já criados não serão apagados.', { ok: 'Excluir', danger: true })) {
      await dbDel('patients', p.id); toast('Paciente excluído.'); navigate('/pacientes');
    }
  });
}
