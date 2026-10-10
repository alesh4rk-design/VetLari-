// Editor de laudos (ultrassonografia e radiografia): etapas, salvamento automático, imagens, prévia e exportação.
import { esc, debounce, download, reportFileName, toast, fmtDateTimeBR, MODALITY, uid } from './utils.js';
import { getPath, setPath, alertList, confirmDialog } from './ui.js';
import { SEXES, validateExam } from './validation.js';
import { navigate, setLeaveGuard } from './router.js';
import { getExam, listExams, saveExam, newExam, finalizeExam, createCorrection, deleteExam, structureFrom } from './exams.js';
import { listPatients, getPatient, upsertPatient } from './patients.js';
import { listTemplates, getTemplate } from './templates.js';
import { pickPhrase, insertAtCursor } from './phrase-library.js';
import { imagesStepHtml, bindImages, moveItem } from './image-manager.js';
import { buildReport } from './report-model.js';
import { reportToHtml } from './preview.js';
import { buildDocx } from './docx-export.js';
import { pdfBlob } from './pdf-export.js';
import { ULTRASOUND } from './ultrasound.js';
import { RADIOGRAPHY } from './radiography.js';

const MODS = { usg: ULTRASOUND, rx: RADIOGRAPHY };
const STEPS = ['Paciente', 'Achados', 'Imagens', 'Conclusão', 'Prévia e exportar'];
const STATUS_TEXT = { dirty: 'Alterações não salvas', saving: 'Salvando…', saved: 'Salvo neste dispositivo', error: 'Erro ao salvar' };

export async function renderNewExam(view, query) {
  const [templates, patients] = await Promise.all([listTemplates(), listPatients()]);
  const type = query.tipo === 'rx' ? 'rx' : 'usg';
  view.innerHTML = `<div class="page-head"><h1>Novo laudo</h1></div><form class="card" id="nf">
    <fieldset class="field" style="border:0;padding:0;margin:0 0 12px"><legend class="muted small">Modalidade</legend><div class="row">
      ${Object.entries(MODALITY).map(([k, v]) => `<label class="check"><input type="radio" name="type" value="${k}" ${k === type ? 'checked' : ''}> ${v.label}</label>`).join('')}</div></fieldset>
    <div class="field"><label for="nt">Modelo</label><select id="nt" name="template"></select></div>
    <div class="field"><label for="np">Paciente (opcional — pode preencher depois)</label><select id="np" name="patient"><option value="">Novo paciente / preencher no laudo</option>
      ${patients.map((p) => `<option value="${p.id}" ${p.id === query.paciente ? 'selected' : ''}>${esc(p.name)}${p.tutor ? ' — ' + esc(p.tutor) : ''}</option>`).join('')}</select></div>
    <button class="btn primary" type="submit">Começar laudo</button></form>`;
  const form = view.querySelector('#nf');
  const fill = () => {
    const t = form.elements.type.value;
    form.elements.template.innerHTML = templates.filter((x) => x.modality === t).map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join('');
  };
  fill();
  form.addEventListener('change', (e) => { if (e.target.name === 'type') fill(); });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const t = templates.find((x) => x.id === form.elements.template.value);
    if (!t) return toast('Escolha um modelo.', 'error');
    const exam = newExam(t.modality, t, patients.find((p) => p.id === form.elements.patient.value));
    try { await saveExam(exam); navigate(`/laudo/${exam.id}`); }
    catch { toast('Não foi possível criar o laudo neste navegador.', 'error'); }
  });
}

export async function renderEditor(view, id, settings) {
  const exam = await getExam(id);
  if (!exam) { view.innerHTML = '<div class="card empty">Laudo não encontrado.</div>'; return; }
  const mod = MODS[exam.type];
  const patients = await listPatients();
  const related = (await listExams()).filter((x) => x.id !== exam.id && x.patient.name && x.patient.name.trim().toLowerCase() === (exam.patient.name || '').trim().toLowerCase());
  const locked = exam.status === 'final';
  let step = 0, state = 'saved', dirty = false, failed = false, savePatientFlag = true;

  const setState = (s) => {
    state = s;
    const el = view.querySelector('#savestate');
    if (el) { el.className = `status ${s}`; el.textContent = STATUS_TEXT[s]; }
  };
  const save = async () => {
    if (locked) return;
    setState('saving');
    try { await saveExam(exam); dirty = false; failed = false; setState('saved'); }
    catch { failed = true; setState('error'); toast('Não foi possível salvar. Seu texto continua na tela: copie ou exporte antes de fechar.', 'error'); }
  };
  const autosave = debounce(save, 700);
  const touch = () => { if (locked) return; dirty = true; setState('dirty'); autosave(); };

  const onBeforeUnload = (e) => { if (dirty || failed) { e.preventDefault(); e.returnValue = ''; } };
  window.addEventListener('beforeunload', onBeforeUnload);
  setLeaveGuard(() => {
    if (dirty) autosave.flush();
    window.removeEventListener('beforeunload', onBeforeUnload);
    if (failed && !confirm('Há alterações que não foram salvas. Sair mesmo assim?')) { window.addEventListener('beforeunload', onBeforeUnload); return false; }
    return true;
  });

  const field = (label, bind, { type = 'text', extra = '' } = {}) => `<div class="field"><label for="f-${bind}">${label}</label>
    <input id="f-${bind}" type="${type}" data-bind="${bind}" value="${esc(getPath(exam, bind))}" ${locked ? 'disabled' : ''} ${extra}></div>`;
  const area = (label, bind, rows = 4, structure = '') => `<div class="field"><label for="f-${bind}">${label}</label>
    <textarea id="f-${bind}" data-bind="${bind}" rows="${rows}" ${locked ? 'disabled' : ''}>${esc(getPath(exam, bind))}</textarea>
    ${locked ? '' : `<button type="button" class="btn sm ghost" data-act="phrase" data-target="f-${bind}" data-structure="${esc(structure)}">Inserir frase</button>`}</div>`;

  const steps = {
    0: () => `<div class="card"><h2>Paciente</h2>
      ${locked ? '' : `<div class="field"><label for="pick">Paciente cadastrado</label><select id="pick" data-act="pick"><option value="">Selecione para preencher automaticamente</option>
        ${patients.map((p) => `<option value="${p.id}" ${p.id === exam.patientId ? 'selected' : ''}>${esc(p.name)}${p.tutor ? ' — ' + esc(p.tutor) : ''}</option>`).join('')}</select></div>`}
      <div class="grid g2">${field('Nome do animal *', 'patient.name', { extra: 'required maxlength="200"' })}${field('Espécie', 'patient.species')}${field('Raça', 'patient.breed')}
      <div class="field"><label for="f-sex">Sexo</label><select id="f-sex" data-bind="patient.sex" ${locked ? 'disabled' : ''}>${SEXES.map((s) => `<option value="${s}" ${exam.patient.sex === s ? 'selected' : ''}>${s || 'Selecione'}</option>`).join('')}</select></div>
      ${field('Data de nascimento', 'patient.birthDate', { type: 'date' })}${field('Idade (se não souber a data)', 'patient.age')}${field('Peso (kg)', 'patient.weight', { extra: 'inputmode="decimal"' })}
      ${field('Tutor', 'patient.tutor')}${field('Clínica solicitante', 'clinic')}${field('Médico-veterinário solicitante', 'requestingVet')}
      ${field('Identificador interno (opcional)', 'patient.identifier')}${field('Data do exame *', 'date', { type: 'date' })}</div>
      ${locked ? '' : `<label class="check"><input type="checkbox" id="savepat" ${savePatientFlag ? 'checked' : ''}> Salvar/atualizar no cadastro de pacientes ao finalizar</label>`}</div>`,
    1: () => `${mod.techniqueHtml(exam, locked)}<div class="card"><h2>Achados por estrutura</h2><p class="muted small">${esc(mod.findingsHint)}</p>
      ${area('Texto introdutório (opcional)', 'intro', 2)}
      ${exam.sections.map((s, i) => `<section class="sec" data-sec="${s.id}"><div class="sec-head">
        <input data-sf="title" aria-label="Nome da estrutura" value="${esc(s.title)}" ${locked ? 'disabled' : ''}>
        ${locked ? '' : `<div class="sec-tools"><button class="iconbtn" data-act="sec-up" aria-label="Mover estrutura para cima" ${i === 0 ? 'disabled' : ''}>▲</button>
        <button class="iconbtn" data-act="sec-down" aria-label="Mover estrutura para baixo" ${i === exam.sections.length - 1 ? 'disabled' : ''}>▼</button>
        <button class="iconbtn danger" data-act="sec-del" aria-label="Excluir estrutura">✕</button></div>`}</div>
        <div class="field"><label>Descrição</label><textarea data-sf="description" id="d-${s.id}" rows="3" ${locked ? 'disabled' : ''}>${esc(s.description)}</textarea>
        ${locked ? '' : `<button type="button" class="btn sm ghost" data-act="phrase" data-target="d-${s.id}" data-structure="${esc(s.title)}">Inserir frase</button>`}</div>
        <div class="grid g2"><div class="field"><label>Medidas (opcional)</label><input data-sf="measures" value="${esc(s.measures)}" ${locked ? 'disabled' : ''}></div>
        <div class="field"><label>Observações (opcional)</label><input data-sf="notes" value="${esc(s.notes)}" ${locked ? 'disabled' : ''}></div></div></section>`).join('')}
      ${locked ? '' : `<div class="row"><input id="newsec" placeholder="Nome da nova estrutura" aria-label="Nome da nova estrutura" style="flex:1;min-width:200px"><button class="btn" data-act="sec-add">Adicionar estrutura</button></div>`}</div>`,
    2: () => `<div class="card"><h2>Imagens</h2><div id="imgroot">${imagesStepHtml(exam, locked, mod.regionLabel)}</div></div>`,
    3: () => `<div class="card"><h2>Conclusão</h2>
      ${area(exam.layout.conclusionTitle || 'Impressão diagnóstica', 'impression', 5)}${area(exam.layout.notesTitle || 'Observações e recomendações', 'notes', 4)}</div>`,
    4: () => {
      const { errors, warnings } = validateExam(exam);
      const report = buildReport(exam, settings);
      return `<div class="card no-print"><h2>Revisão e exportação</h2>
        ${alertList('Pendências que impedem finalizar:', errors, 'error')}${alertList('Atenção:', warnings, 'warn')}
        <p class="muted small">Revise o texto abaixo. Word e PDF contêm exatamente o mesmo conteúdo. O sistema não preenche nem assina nada em seu nome.</p>
        <div class="row"><button class="btn primary" data-act="docx">Baixar Word (.docx)</button><button class="btn primary" data-act="pdf">Baixar PDF</button>
        ${locked ? '<button class="btn" data-act="correct">Criar correção (nova versão)</button>'
          : '<button class="btn" data-act="final">Finalizar laudo</button><button class="btn danger" data-act="discard">Descartar rascunho</button>'}</div></div>
        ${reportToHtml(report)}`;
    },
  };

  function draw() {
    const histLast = exam.history[exam.history.length - 1];
    view.innerHTML = `<div class="page-head"><div><h1>${MODALITY[exam.type].label} <span class="badge ${exam.status}">${locked ? `Finalizado · v${exam.version}` : 'Rascunho local'}</span></h1>
      <div class="muted small">${esc(exam.patient.name || 'Paciente sem nome')} · última ação: ${esc(histLast.action)} (${fmtDateTimeBR(histLast.ts)})</div></div>
      <a class="btn sm" href="#/laudo/${exam.id}/nova-versao-estrutura">Novo laudo com esta estrutura</a></div>
      ${related.length ? `<details class="card"><summary>Outros exames deste paciente (${related.length})</summary><ul class="list">${related.map((x) => `<li><span>${MODALITY[x.type].code} · ${x.date} · v${x.version} · ${x.status === 'final' ? 'Finalizado' : 'Rascunho'}</span><span class="row"><a class="btn sm" href="#/laudo/${x.id}">Abrir</a><a class="btn sm" href="#/comparar/${x.id}/${exam.id}">Comparar</a></span></li>`).join('')}</ul></details>` : ''}
      ${locked ? '<div class="alert info">Laudo finalizado: o conteúdo está protegido contra alterações. Use "Criar correção" para gerar uma nova versão sem perder o original.</div>' : ''}
      <div class="savebar"><span id="savestate" class="status ${state}" role="status">${STATUS_TEXT[state]}</span>
      <span class="small muted">${locked ? 'Somente leitura' : 'Salvamento automático neste navegador (sem sincronização)'}</span></div>
      <nav class="steps" aria-label="Etapas do laudo">${STEPS.map((s, i) => `<button data-step="${i}" ${i === step ? 'aria-current="step"' : ''}>${i + 1}. ${s}</button>`).join('')}</nav>
      <div id="step">${steps[step]()}</div>
      <div class="row between no-print"><button class="btn" data-act="prev" ${step === 0 ? 'disabled' : ''}>Voltar</button>
      <button class="btn primary" data-act="next" ${step === STEPS.length - 1 ? 'disabled' : ''}>Avançar</button></div>`;
    if (step === 2) bindImages(view.querySelector('#imgroot'), exam, settings, (structural) => { touch(); if (structural) draw(); });
    window.scrollTo({ top: 0 });
  }
  draw();

  const doExport = async (kind) => {
    const report = buildReport(exam, settings);
    try {
      const blob = kind === 'docx' ? await buildDocx(report) : pdfBlob(report);
      const name = reportFileName(exam, kind);
      download(blob, name);
      toast(`Arquivo ${name} gerado.`, 'success');
    } catch (e) { toast(`Falha ao gerar o ${kind === 'docx' ? 'Word' : 'PDF'}: ${e.message}`, 'error'); }
  };

  view.onclick = async (e) => {
    const stepBtn = e.target.closest('[data-step]');
    if (stepBtn) { step = Number(stepBtn.dataset.step); return draw(); }
    const b = e.target.closest('[data-act]');
    if (!b || b.tagName === 'SELECT') return;
    const act = b.dataset.act;
    const secId = b.closest('[data-sec]') && b.closest('[data-sec]').dataset.sec;
    if (act === 'next') { step = Math.min(STEPS.length - 1, step + 1); draw(); }
    else if (act === 'prev') { step = Math.max(0, step - 1); draw(); }
    else if (act === 'sec-up' && moveItem(exam.sections, secId, -1)) { touch(); draw(); }
    else if (act === 'sec-down' && moveItem(exam.sections, secId, 1)) { touch(); draw(); }
    else if (act === 'sec-del') {
      const s = exam.sections.find((x) => x.id === secId);
      const hasText = s && (s.description || s.measures || s.notes);
      if (!hasText || await confirmDialog(`Excluir "${s.title}" e o texto já escrito nela?`, { ok: 'Excluir', danger: true })) {
        exam.sections = exam.sections.filter((x) => x.id !== secId); touch(); draw();
      }
    } else if (act === 'sec-add') {
      const input = view.querySelector('#newsec');
      const title = input.value.trim();
      if (!title) return toast('Digite o nome da estrutura.', 'error');
      exam.sections.push({ id: uid(), title, description: '', measures: '', notes: '' }); touch(); draw();
    } else if (act === 'phrase') {
      const target = view.querySelector('#' + CSS.escape(b.dataset.target));
      const text = await pickPhrase({ modality: exam.type, structure: b.dataset.structure });
      if (text && target) insertAtCursor(target, text);
    } else if (act === 'docx' || act === 'pdf') await doExport(act);
    else if (act === 'final') {
      const { errors, warnings } = validateExam(exam);
      if (errors.length) { toast('Há pendências que impedem finalizar. Veja a lista acima.', 'error'); return; }
      const msg = warnings.length ? `Atenção:\n- ${warnings.join('\n- ')}\n\nFinalizar mesmo assim? Depois disso o conteúdo só poderá ser alterado criando uma nova versão.`
        : 'Finalizar o laudo? Depois disso o conteúdo só poderá ser alterado criando uma nova versão.';
      if (!await confirmDialog(msg, { ok: 'Finalizar' })) return;
      try {
        autosave.cancel();
        if (savePatientFlag) {
          const pid = exam.patientId || uid();
          await upsertPatient({ ...(await getPatient(pid) || {}), ...exam.patient, id: pid });
          exam.patientId = pid;
        }
        await finalizeExam(exam);
        dirty = false; toast('Laudo finalizado.', 'success');
        navigate(`/laudo/${exam.id}?r=${Date.now()}`);
      } catch (err) { toast(`Não foi possível finalizar: ${err.message}`, 'error'); }
    } else if (act === 'correct') {
      const copy = await createCorrection(exam);
      toast(`Versão ${copy.version} criada. O original foi preservado.`, 'success');
      navigate(`/laudo/${copy.id}`);
    } else if (act === 'discard' && await confirmDialog('Descartar este rascunho? O conteúdo será apagado e não poderá ser recuperado.', { ok: 'Descartar', danger: true })) {
      autosave.cancel(); dirty = false; await deleteExam(exam.id); navigate('/');
    }
  };

  view.oninput = (e) => {
    const t = e.target;
    if (locked) return;
    if (t.dataset.bind) {
      setPath(exam, t.dataset.bind, t.dataset.num ? Number(t.value) : t.value);
      touch();
    } else if (t.dataset.sf) {
      const s = exam.sections.find((x) => x.id === t.closest('[data-sec]').dataset.sec);
      if (s) { s[t.dataset.sf] = t.value; touch(); }
    } else if (t.id === 'savepat') savePatientFlag = t.checked;
  };
  view.onchange = async (e) => {
    const t = e.target;
    if (t.dataset.act === 'pick' && t.value) {
      const p = await getPatient(t.value);
      if (p) { exam.patientId = p.id; exam.patient = { name: p.name, species: p.species, breed: p.breed, sex: p.sex, birthDate: p.birthDate, age: p.age, weight: p.weight, tutor: p.tutor, identifier: p.identifier }; touch(); draw(); }
    }
    if (t.dataset.bind === 'imagesPerRow' && step === 2) draw();
  };
}

/** Cria um novo rascunho reaproveitando a estrutura de um laudo anterior (sem copiar achados). */
export async function startFromPrevious(view, prevId) {
  const prev = await getExam(prevId);
  if (!prev) { view.innerHTML = '<div class="card empty">Laudo de origem não encontrado.</div>'; return; }
  const tpl = (await getTemplate(prev.templateId)) || undefined;
  const fresh = structureFrom(prev, tpl);
  await saveExam(fresh);
  navigate(`/laudo/${fresh.id}`);
}
