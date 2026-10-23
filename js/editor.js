// Editor de laudos (ultrassonografia e radiografia): etapas, salvamento automático, imagens, prévia e exportação.
import { esc, debounce, download, reportFileName, toast, fmtDateTimeBR, fmtDateBR, MODALITY, uid } from './utils.js';
import { getPath, setPath, alertList, confirmDialog } from './ui.js';
import { SEXES } from './validation.js';
import { SPECIES, breedsFor, optionsHtml } from './animals.js';
import { ageFromBirth } from './utils.js';
import { navigate, setLeaveGuard } from './router.js';
import { getExam, listExams, deleteExamFlow, canDelete, saveExam, newExam, finalizeExam, createRevision, deleteExam, structureFrom, setStatus, logAction, logEdit, blankSection, STATUS_LABEL, REVISION_LABEL } from './exams.js';
import { reviewExam, STRUCTURE_STATUS, MEASURE_UNITS, FINAL_CHECKLIST, sectionHasContent } from './quality.js';
import { can } from './profiles.js';
import { openModal, pickOption } from './ui.js';
import { listPatients, getPatient, upsertPatient } from './patients.js';
import { listTemplates, getTemplate } from './templates.js';
import { pickPhrase, insertAtCursor, saveToLibraryDialog } from './phrase-library.js';
import { openDictation } from './voice.js';
import { fillPhrase } from './phrase-logic.js';
import { composeDescription, toggleOption, pendingFields, expandBlocks } from './builder-logic.js';
import { listReferences, referenceCard } from './references.js';
import { listCalculations, openCalculator } from './calculations.js';
import { matchReferences, checkMeasure, rangeText } from './reference-logic.js';
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

export async function renderEditor(view, id, settings, profile) {
  const exam = await getExam(id);
  if (!exam) { view.innerHTML = '<div class="card empty">Laudo não encontrado.</div>'; return; }
  const mod = MODS[exam.type];
  const patients = await listPatients();
  const [refs, calcs] = await Promise.all([listReferences(), listCalculations()]);
  const related = (await listExams()).filter((x) => x.id !== exam.id && x.patient.name && x.patient.name.trim().toLowerCase() === (exam.patient.name || '').trim().toLowerCase());
  const locked = exam.status === 'final';
  const prof = settings.professional;
  const actor = { name: prof.name || profile.name, role: profile.role, crmv: prof.crmv || '' };
  const canFinalize = can(profile, 'finalize'), canRevise = can(profile, 'revise');
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
  const touch = () => { if (locked) return; logEdit(exam, actor); dirty = true; setState('dirty'); autosave(); };

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
  /** Campo com sugestões e digitação livre + botão "Lista" com todas as opções. */
  const comboField = (label, bind, listId, kind) => `<div class="field"><label for="f-${bind}">${label}</label>
    <div class="row" style="flex-wrap:nowrap"><input id="f-${bind}" data-bind="${bind}" value="${esc(getPath(exam, bind))}" list="${listId}" autocomplete="off" placeholder="Escolha ou digite" ${locked ? 'disabled' : ''} style="flex:1;min-width:0">
    ${locked ? '' : `<button type="button" class="btn sm" data-act="pick-list" data-kind="${kind}" data-target="f-${bind}">Lista</button>`}</div></div>`;
  const area = (label, bind, rows = 4, structure = '') => `<div class="field"><label for="f-${bind}">${label}</label>
    <textarea id="f-${bind}" data-bind="${bind}" rows="${rows}" ${locked ? 'disabled' : ''}>${esc(getPath(exam, bind))}</textarea>
    ${locked ? '' : `<div class="row"><button type="button" class="btn sm ghost" data-act="phrase" data-target="f-${bind}" data-structure="${esc(structure)}">Inserir frase</button>
    <button type="button" class="btn sm ghost" data-act="dictate" data-target="f-${bind}" data-label="${esc(label)}">Ditar</button></div>`}</div>`;

  // ----- Achados: lista de órgãos (esquerda) + painel do órgão selecionado (direita) -----
  const patientSex = () => (/^Macho/.test(exam.patient.sex || '') ? 'male' : /^Fêmea/.test(exam.patient.sex || '') ? 'female' : '');
  const hasData = (s) => !!s.status || sectionHasContent(s);
  // Estruturas de outro sexo ficam ocultas, mas nunca se já tiverem dados registrados.
  const visibleSections = () => exam.sections.filter((s) => !s.sex || !patientSex() || s.sex === patientSex() || hasData(s));
  let selSec = null;
  const current = () => {
    const vis = visibleSections();
    return vis.find((s) => s.id === selSec) || vis[0] || null;
  };

  const organList = () => {
    const cur = current();
    return `<ul class="organ-list">${visibleSections().map((s) => `<li><button type="button" class="organ ${cur && s.id === cur.id ? 'active' : ''}" data-act="org-pick" data-id="${s.id}" ${cur && s.id === cur.id ? 'aria-current="true"' : ''}>
      <span class="dot ${hasData(s) ? 'done' : ''}" aria-hidden="true"></span><span class="oname">${esc(s.title || 'Sem nome')}</span>
      <span class="ostat">${s.status ? esc(STRUCTURE_STATUS[s.status]) : (sectionHasContent(s) ? 'Preenchido' : '')}</span></button></li>`).join('')}</ul>
      ${locked ? '' : `<div class="row" style="margin-top:10px"><input id="newsec" placeholder="Nova estrutura" aria-label="Nome da nova estrutura" style="flex:1;min-width:0"><button class="btn sm" data-act="sec-add">Adicionar</button></div>`}`;
  };

  const statusButtons = (s) => `<div class="seg" role="group" aria-label="Status da avaliação">${
    Object.entries(STRUCTURE_STATUS).filter(([k]) => k).map(([k, v]) => `<button type="button" class="segbtn" data-act="set-status" data-val="${k}" aria-pressed="${(s.status || '') === k}" ${locked ? 'disabled' : ''}>${v}</button>`).join('')}</div>
    <div class="small muted">${s.status ? '' : 'Nenhum status marcado: a estrutura fica como "Não informado" e não aparece no laudo se estiver vazia.'}</div>`;

  const measureBlock = (s) => {
    const slots = (s.measuresList || []).some((m) => m.slot);
    return `<div class="field"><label>Medidas deste órgão</label>
      <p class="small muted">${slots ? 'Os nomes e as unidades já vêm do modelo: <strong>digite só o valor</strong> do que você mediu (ex.: 5,2). O que ficar em branco não aparece no laudo.' : 'Este modelo não tem medidas pré-definidas para este órgão. Use "Adicionar outra medida": informe o que foi medido, o valor e a unidade.'}</p>
      <div class="mtable">${(s.measuresList || []).length ? '<div class="mhead"><span>O que foi medido</span><span>Valor</span><span>Unidade</span><span></span></div>' : ''}
      ${(s.measuresList || []).map((m) => `<div class="mrow" data-mrow="${m.id}">
        ${m.slot || m.calculated ? `<div class="mlabel">${esc(m.label)}</div>` : `<input data-mf="label" data-mid="${m.id}" placeholder="Ex.: espessura da parede" aria-label="O que foi medido" value="${esc(m.label)}" ${locked ? 'disabled' : ''}>`}
        <input data-mf="value" data-mid="${m.id}" placeholder="Valor" inputmode="decimal" aria-label="Valor de ${esc(m.label || 'medida')}" value="${esc(m.value)}" ${locked || m.calculated ? 'disabled' : ''}>
        <input data-mf="unit" data-mid="${m.id}" list="units" placeholder="Unidade" aria-label="Unidade de ${esc(m.label || 'medida')}" value="${esc(m.unit)}" ${locked || m.calculated ? 'disabled' : ''}>
        ${locked || m.slot ? '<span></span>' : `<button type="button" class="iconbtn danger" data-act="m-del" data-mid="${m.id}" aria-label="Excluir medida">✕</button>`}
        ${m.calculated ? `<div class="small muted mnote">Calculado: ${esc(m.calcName)} (${esc(m.formula)}) a partir de ${esc(Object.entries(m.inputs || {}).map(([k, v]) => `${k}=${v}`).join('; '))}</div>` : ''}</div>`).join('')}</div>
      <div class="row" style="margin-top:8px">${locked ? '' : '<button type="button" class="btn sm" data-act="m-add">Adicionar outra medida</button><button type="button" class="btn sm" data-act="m-calc">Calcular</button>'}
      <button type="button" class="btn sm ghost" data-act="m-refs">Ver referências</button></div></div>`;
  };

  // ----- Montador de descrição: marcar opções gera o texto no estilo da veterinária -----
  const isManual = (s) => !!(s.build && s.description.trim() && s.description !== s.build.auto);
  /** Regenera a descrição a partir das escolhas. Não sobrescreve texto editado à mão (a menos que force). */
  function syncBuild(s, force = false) {
    if (!s.build) return false;
    const text = composeDescription(s.build.def, s.build.sel, s.measuresList, s.build.extras);
    if (force || !s.description.trim() || s.description === s.build.auto) { s.description = text; s.build.auto = text; }
    const ta = view.querySelector('#d-' + s.id);
    if (ta && s.id === (current() || {}).id) ta.value = s.description;
    const note = view.querySelector('#bnotice'); if (note) note.hidden = !isManual(s);
    return true;
  }
  const builderBlock = (s) => {
    if (!s.build) return '';
    const blocks = expandBlocks(s.build.def);
    const need = pendingFields(s.build.def, s.build.sel, s.measuresList, {});
    return `<div class="builder"><h3>Montar descrição</h3>
      <p class="small muted">Marque o que você observou e digite as medidas: o texto é escrito sozinho, com as suas frases. O que não for marcado não entra no laudo.</p>
      ${blocks.map((bl) => `<div class="bblock">${bl.label ? `<div class="bhead">${esc(bl.label)}</div>` : ''}${bl.groups.map((g) => {
        const on = s.build.sel[g.key] || [];
        return `<div class="bgroup"><div class="blabel">${esc(g.label)}${g.kind === 'many' || g.kind === 'sentences' ? ' <span class="muted">(pode marcar várias)</span>' : ''}</div>
          <div class="chips">${g.options.map((op, i) => `<button type="button" class="chip" data-act="b-opt" data-g="${g.key}" data-o="${i}" aria-pressed="${on.includes(i)}" ${locked ? 'disabled' : ''} title="${esc(op.text)}">${esc(op.label || op.text)}</button>`).join('')}</div></div>`;
      }).join('')}</div>`).join('')}
      ${need.length ? `<div class="bextras"><div class="small muted">Complete os campos da frase:</div>${need.map((n) => `<div class="field"><label for="bx-${esc(n.key)}">${esc(n.key)}</label><input id="bx-${esc(n.key)}" data-bx="${esc(n.key)}" value="${esc(s.build.extras[n.key] || '')}" ${locked ? 'disabled' : ''}></div>`).join('')}</div>` : ''}
      <div id="bnotice" class="alert warn" ${isManual(s) ? '' : 'hidden'}>Você editou o texto manualmente: novas escolhas não o alteram. ${locked ? '' : '<button type="button" class="btn sm" data-act="b-regen">Gerar de novo (substitui o texto)</button>'}</div>
      ${locked ? '' : '<div class="row"><button type="button" class="btn sm ghost" data-act="b-clear">Limpar escolhas</button></div>'}</div>`;
  };

  const organPanel = () => {
    const s = current();
    if (!s) return '<div class="card empty">Nenhuma estrutura neste modelo. Adicione uma na lista.</div>';
    const vis = visibleSections();
    const hasNext = vis.length > 1;
    return `<section class="sec" data-sec="${s.id}">
      <div class="sec-head"><input data-sf="title" aria-label="Nome da estrutura" value="${esc(s.title)}" ${locked ? 'disabled' : ''} style="font-size:1.15rem"></div>
      <div class="field"><label>Status da avaliação</label>${statusButtons(s)}</div>
      ${builderBlock(s)}
      <div class="field"><label>Descrição <span class="muted small">(use **negrito** e __itálico__ se quiser destacar)</span></label><textarea data-sf="description" id="d-${s.id}" rows="4" ${locked ? 'disabled' : ''}>${esc(s.description)}</textarea>
      ${locked ? '' : `<div class="row"><button type="button" class="btn sm ghost" data-act="phrase" data-target="d-${s.id}" data-structure="${esc(s.title)}">Inserir frase</button>
      <button type="button" class="btn sm ghost" data-act="dictate" data-target="d-${s.id}" data-label="${esc(s.title)}">Ditar</button>
      <button type="button" class="btn sm ghost" data-act="save-phrase">Guardar esta frase</button></div>`}</div>
      ${measureBlock(s)}
      <div class="field"><label>Outras medidas (texto livre, opcional)</label><input data-sf="measures" value="${esc(s.measures)}" ${locked ? 'disabled' : ''}></div>
      <div class="field"><label>Observações (opcional)</label><input data-sf="notes" value="${esc(s.notes)}" ${locked ? 'disabled' : ''}></div>
      <div class="row between">${hasNext ? '<button type="button" class="btn primary" data-act="org-next">Próximo órgão</button>' : '<span></span>'}
      ${locked ? '' : '<button type="button" class="btn danger sm" data-act="sec-del">Excluir esta estrutura</button>'}</div></section>`;
  };

  /** Idade: calculada sozinha a partir da data de nascimento (na data do exame); manual só sem data de nascimento. */
  const autoAge = () => ageFromBirth(exam.patient.birthDate, exam.date);
  const ageField = () => {
    const auto = autoAge();
    return `<div class="field"><label for="f-age">Idade</label>
      <input id="age-auto" readonly value="${esc(auto)}" aria-describedby="age-hint" ${auto ? '' : 'hidden'}>
      <input id="f-age" data-bind="patient.age" value="${esc(exam.patient.age)}" placeholder="Ex.: 3 anos" ${locked ? 'disabled' : ''} ${auto ? 'hidden' : ''}>
      <div class="hint" id="age-hint">${auto ? 'Calculada automaticamente a partir da data de nascimento, na data do exame.' : 'Informe a data de nascimento para calcular sozinha, ou digite a idade.'}</div></div>`;
  };
  const updateAge = () => {
    const auto = autoAge(), a = view.querySelector('#age-auto'), m = view.querySelector('#f-age'), h = view.querySelector('#age-hint');
    if (!a || !m) return;
    a.value = auto; a.hidden = !auto; m.hidden = !!auto;
    if (h) h.textContent = auto ? 'Calculada automaticamente a partir da data de nascimento, na data do exame.' : 'Informe a data de nascimento para calcular sozinha, ou digite a idade.';
  };

  const steps = {
    0: () => `<div class="card"><h2>Paciente</h2>
      ${locked ? '' : `<div class="field"><label for="pick">Paciente cadastrado</label><select id="pick" data-act="pick"><option value="">Selecione para preencher automaticamente</option>
        ${patients.map((p) => `<option value="${p.id}" ${p.id === exam.patientId ? 'selected' : ''}>${esc(p.name)}${p.tutor ? ' — ' + esc(p.tutor) : ''}</option>`).join('')}</select></div>`}
      <div class="grid g2">${field('Nome do animal *', 'patient.name', { extra: 'required maxlength="200"' })}
      ${comboField('Espécie', 'patient.species', 'species-list', 'species')}${comboField('Raça', 'patient.breed', 'breeds-list', 'breed')}
      <datalist id="species-list">${optionsHtml(SPECIES)}</datalist><datalist id="breeds-list">${optionsHtml(breedsFor(exam.patient.species))}</datalist>
      <div class="field"><label for="f-sex">Sexo</label><select id="f-sex" data-bind="patient.sex" ${locked ? 'disabled' : ''}>${SEXES.map((s) => `<option value="${s}" ${exam.patient.sex === s ? 'selected' : ''}>${s || 'Selecione'}</option>`).join('')}</select></div>
      ${field('Data de nascimento', 'patient.birthDate', { type: 'date' })}${ageField()}${field('Peso (kg)', 'patient.weight', { extra: 'inputmode="decimal"' })}
      ${field('Tutor', 'patient.tutor')}${field('Clínica solicitante', 'clinic')}${field('Médico-veterinário solicitante', 'requestingVet')}
      ${field('Identificador interno (opcional)', 'patient.identifier')}${field('Data do exame *', 'date', { type: 'date' })}${field('Hora do exame', 'time', { type: 'time' })}</div>
      ${locked ? '' : `<label class="check"><input type="checkbox" id="savepat" ${savePatientFlag ? 'checked' : ''}> Salvar/atualizar no cadastro de pacientes ao finalizar</label>`}</div>
      <div class="card"><h2>Exame</h2><p class="muted small">Preencha o que for conhecido. Itens deixados em branco aparecem como pendência informativa, nunca como "normal".</p>
      ${area('Indicação clínica', 'clinical.indication', 2)}${area('Pergunta clínica a responder', 'clinical.question', 2)}
      ${area('Histórico relevante', 'clinical.history', 3)}${area('Medicamentos informados', 'clinical.medications', 2)}
      <div class="grid g2">${field('Operador (quem adquiriu as imagens)', 'clinical.operator')}${field('Equipamento', 'clinical.equipment')}${field('Local', 'clinical.location')}</div>
      ${area('Técnica e limitações do exame', 'clinical.limitations', 3)}</div>`,
    1: () => `${mod.techniqueHtml(exam, locked)}<div class="card"><h2>Achados por estrutura</h2><p class="muted small">${esc(mod.findingsHint)}</p>
      <datalist id="units">${MEASURE_UNITS.map((u) => `<option value="${esc(u)}">`).join('')}</datalist>
      ${area('Texto introdutório (opcional)', 'intro', 2)}
      <div class="findings"><nav class="organs" id="organs" aria-label="Órgãos e estruturas">${organList()}</nav><div id="organ-panel">${organPanel()}</div></div></div>`,
    2: () => `<div class="card"><h2>Imagens</h2><p class="muted small">As imagens ficam salvas somente neste aparelho (perfil de ${esc(profile.name)}).</p><div id="imgroot">${imagesStepHtml(exam, locked, mod.regionLabel)}</div></div>`,
    3: () => `<div class="card"><h2>Conclusão</h2>
      ${area(exam.layout.conclusionTitle || 'Impressão diagnóstica', 'impression', 5)}${area('Diagnósticos diferenciais (se houver)', 'differentials', 3)}
      ${area(exam.layout.notesTitle || 'Observações e recomendações', 'notes', 4)}
      ${exam.revisionKind === 'addendum' ? area('Texto do adendo', 'addendum', 4) : ''}</div>`,
    4: () => {
      const { critical, info } = reviewExam(exam, actor, refs);
      const report = buildReport(exam, settings);
      const hist = [...exam.history].reverse().map((h) => `<li><span><strong>${esc(h.action)}</strong>${h.detail ? `<div class="muted small">${esc(h.detail)}</div>` : ''}</span>
        <span class="muted small">${esc(h.actor ? h.actor.name : '—')} · ${fmtDateTimeBR(h.ts)} · v${h.version}</span></li>`).join('');
      return `<div class="card no-print"><h2>Revisão e exportação</h2>
        ${alertList('Alertas críticos (exigem correção ou justificativa para finalizar):', critical, 'error')}${alertList('Alertas informativos:', info, 'warn')}
        <p class="muted small">Word e PDF contêm exatamente o mesmo conteúdo da prévia abaixo. O sistema não preenche, não conclui nem assina nada em seu nome.${exam.status !== 'final' ? ' Arquivos de laudos não finalizados saem marcados como rascunho/preliminar.' : ''}</p>
        <div class="row"><button class="btn primary" data-act="docx">Baixar Word (.docx)</button><button class="btn primary" data-act="pdf">Baixar PDF</button></div>
        <div class="row" style="margin-top:10px">${locked
          ? (canRevise ? '<button class="btn" data-act="revise" data-kind="correction">Retificar (nova versão)</button><button class="btn" data-act="revise" data-kind="addendum">Adicionar adendo (nova versão)</button>'
            : '<span class="muted small">Retificações e adendos exigem perfil de médico(a)-veterinário(a).</span>')
          : `${exam.status === 'draft' ? '<button class="btn" data-act="prelim">Marcar como preliminar</button>' : '<button class="btn" data-act="undraft">Voltar para rascunho</button>'}
             <button class="btn" data-act="final" ${canFinalize ? '' : 'disabled'}>Finalizar laudo</button>
             <button class="btn danger" data-act="discard">Excluir exame</button>
             ${canFinalize ? '' : '<span class="muted small">Seu perfil (auxiliar) não pode finalizar nem assinar laudos.</span>'}`}</div></div>
        ${reportToHtml(report)}
        <details class="card no-print"><summary>Histórico do laudo (${exam.history.length})</summary><ul class="list">${hist}</ul></details>`;
    },
  };

  function draw({ top = false } = {}) {
    const keepY = window.scrollY;
    const histLast = exam.history[exam.history.length - 1];
    view.innerHTML = `<div class="page-head"><div><h1>${MODALITY[exam.type].label} <span class="badge ${exam.status}">${STATUS_LABEL[exam.status]} · v${exam.version}${exam.revisionKind ? ' · ' + REVISION_LABEL[exam.revisionKind] : ''}</span></h1>
      <div class="muted small">${esc(exam.patient.name || 'Paciente sem nome')} · última ação: ${esc(histLast.action)} (${fmtDateTimeBR(histLast.ts)})</div></div>
      <div class="row"><a class="btn sm" href="#/laudo/${exam.id}/nova-versao-estrutura">Novo laudo com esta estrutura</a>
      ${canDelete(exam, profile) ? '<button class="btn sm danger" data-act="del-exam">Excluir exame</button>' : ''}</div></div>
      ${related.length ? `<details class="card"><summary>Outros exames deste paciente (${related.length})</summary><ul class="list">${related.map((x) => `<li><span>${MODALITY[x.type].code} · ${fmtDateBR(x.date)} · v${x.version} · ${STATUS_LABEL[x.status]}</span><span class="row"><a class="btn sm" href="#/laudo/${x.id}">Abrir</a><a class="btn sm" href="#/comparar/${x.id}/${exam.id}">Comparar</a></span></li>`).join('')}</ul></details>` : ''}
      ${locked ? '<div class="alert info">Laudo finalizado: o conteúdo está protegido contra alterações. Para corrigir, use "Retificar" ou "Adicionar adendo" na etapa de revisão: uma nova versão é criada e a original permanece preservada.</div>' : ''}
      <div class="savebar"><span id="savestate" class="status ${state}" role="status">${STATUS_TEXT[state]}</span>
      <span class="small muted">${locked ? 'Somente leitura' : 'Salvamento automático neste aparelho (sem sincronização)'}</span></div>
      <nav class="steps" aria-label="Etapas do laudo">${STEPS.map((s, i) => `<button data-step="${i}" ${i === step ? 'aria-current="step"' : ''}>${i + 1}. ${s}</button>`).join('')}</nav>
      <div id="step">${steps[step]()}</div>
      <div class="row between no-print"><button class="btn" data-act="prev" ${step === 0 ? 'disabled' : ''}>Voltar</button>
      <button class="btn primary" data-act="next" ${step === STEPS.length - 1 ? 'disabled' : ''}>Avançar</button></div>`;
    if (step === 2) bindImages(view.querySelector('#imgroot'), exam, settings, (structural) => { touch(); if (structural) draw(); });
    // Só volta ao topo ao trocar de etapa; demais alterações mantêm a posição da página.
    window.scrollTo(0, top ? 0 : keepY);
  }
  draw({ top: true });

  /** Atualiza só a lista (marcadores de preenchimento) enquanto se digita; o painel não é redesenhado. */
  function refreshOrgans() { const o = view.querySelector('#organs'); if (o) o.innerHTML = organList(); }

  /** Atualiza só a lista de órgãos e o painel, sem mexer na rolagem. */
  function refreshFindings() {
    const o = view.querySelector('#organs'), p = view.querySelector('#organ-panel');
    if (!o || !p) return draw();
    o.innerHTML = organList(); p.innerHTML = organPanel();
  }

  const doExport = async (kind) => {
    const report = buildReport(exam, settings);
    try {
      const blob = kind === 'docx' ? await buildDocx(report) : pdfBlob(report);
      const name = reportFileName(exam, kind);
      download(blob, name);
      logAction(exam, `Exportado em ${kind === 'docx' ? 'Word' : 'PDF'}`, actor, name);
      await saveExam(exam);
      toast(`Arquivo ${name} gerado.`, 'success');
    } catch (e) { toast(`Falha ao gerar o ${kind === 'docx' ? 'Word' : 'PDF'}: ${e.message}`, 'error'); }
  };

  /** Janela de finalização: checklist de conferência + justificativa quando houver pendências. */
  function finalizeDialog() {
    const { critical } = reviewExam(exam, actor, refs);
    const m = openModal(`<h2>Finalizar laudo</h2>
      <p class="muted small">Confirme cada item. Itens não marcados ou alertas críticos exigem uma justificativa, que ficará registrada no histórico. Esta ação cria a versão emitida: depois dela, só é possível retificar ou fazer adendo em nova versão.</p>
      ${alertList('Alertas críticos em aberto:', critical, 'error')}
      <div>${FINAL_CHECKLIST.map((t, i) => `<label class="check"><input type="checkbox" data-ck="${i}"> ${esc(t)}</label>`).join('')}</div>
      <div class="field" id="jwrap" style="display:none"><label for="just">Justificativa *</label><textarea id="just" rows="3"></textarea></div>
      <div class="row end"><button class="btn" data-x="cancel">Cancelar</button><button class="btn primary" data-x="ok" disabled>Finalizar</button></div>`, { label: 'Finalizar laudo' });
    const refresh = () => {
      const unchecked = FINAL_CHECKLIST.filter((_, i) => !m.el.querySelector(`[data-ck="${i}"]`).checked);
      const needs = critical.length > 0 || unchecked.length > 0;
      m.el.querySelector('#jwrap').style.display = needs ? '' : 'none';
      const just = m.el.querySelector('#just').value.trim();
      m.el.querySelector('[data-x=ok]').disabled = needs && !just;
      return { unchecked, needs, just };
    };
    m.el.addEventListener('input', refresh);
    m.el.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-x]'); if (!b) return;
      if (b.dataset.x === 'cancel') return m.close(null);
      const { unchecked, needs, just } = refresh();
      if (needs && !just) return;
      m.close(true);
      try {
        autosave.cancel();
        if (savePatientFlag) {
          const pid = exam.patientId || uid();
          await upsertPatient({ ...(await getPatient(pid) || {}), ...exam.patient, id: pid });
          exam.patientId = pid;
        }
        await finalizeExam(exam, actor, { justification: just, pending: [...critical, ...unchecked.map((u) => `não confirmado: ${u}`)] });
        dirty = false; toast('Laudo finalizado.', 'success');
        navigate(`/laudo/${exam.id}?r=${Date.now()}`);
      } catch (err) { toast(`Não foi possível finalizar: ${err.message}`, 'error'); }
    });
  }

  function revisionDialog(kind) {
    const m = openModal(`<h2>${REVISION_LABEL[kind]}</h2>
      <p class="muted small">Será criada uma nova versão editável. O laudo finalizado atual permanece preservado no histórico.</p>
      <div class="field"><label for="rj">Justificativa *</label><textarea id="rj" rows="3"></textarea></div>
      <div class="row end"><button class="btn" data-x="cancel">Cancelar</button><button class="btn primary" data-x="ok">Criar nova versão</button></div>`, { label: REVISION_LABEL[kind] });
    m.el.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-x]'); if (!b) return;
      if (b.dataset.x === 'cancel') return m.close(null);
      const just = m.el.querySelector('#rj').value.trim();
      if (!just) return toast('Informe a justificativa.', 'error');
      m.close(true);
      try {
        const copy = await createRevision(exam, kind, just, actor);
        toast(`Versão ${copy.version} criada. O original foi preservado.`, 'success');
        navigate(`/laudo/${copy.id}`);
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  const POS = { abaixo: 'abaixo do mínimo publicado', acima: 'acima do máximo publicado', dentro: 'dentro do intervalo publicado', unidade_diferente: 'unidade diferente da referência: sem comparação', sem_comparacao: 'valor composto: sem comparação', sem_intervalo: '' };
  function showReferences(section) {
    const species = exam.patient.species;
    const rows = (section.measuresList || []).filter((m) => m.label || m.value);
    const blocks = [];
    if (!String(species || '').trim()) blocks.push('<div class="alert warn">Informe a espécie do paciente (etapa Paciente) para consultar referências. O sistema não usa valores de outras espécies.</div>');
    else if (!rows.length) {
      const hit = matchReferences(refs, { species, structure: section.title, label: '' });
      blocks.push(hit.length ? hit.map(referenceCard).join('') : `<p class="muted">Nenhuma referência aprovada para ${esc(species)} / ${esc(section.title)}.</p>`);
    } else for (const mm of rows) {
      const hit = matchReferences(refs, { species, structure: section.title, label: mm.label });
      blocks.push(`<h3>${esc(mm.label || 'Medida')}: ${esc(mm.value)} ${esc(mm.unit)}</h3>` + (hit.length
        ? hit.map((r) => { const st = checkMeasure(mm, r).status; return referenceCard(r) + (POS[st] ? `<p class="small"><strong>Posição frente ao intervalo cadastrado:</strong> ${POS[st]} (${esc(rangeText(r))}). A interpretação clínica é sua.</p>` : ''); }).join('')
        : `<p class="muted">Nenhuma referência aprovada para ${esc(species)} / ${esc(section.title)} / ${esc(mm.label || 'esta medida')}. O sistema não cria nem sugere valores.</p>`));
    }
    const mo = openModal(`<h2>Referências — ${esc(section.title)}</h2>${blocks.join('')}<div class="row end"><button class="btn" data-x="close">Fechar</button></div>`, { wide: true, label: 'Referências' });
    mo.el.addEventListener('click', (ev) => { if (ev.target.closest('[data-x=close]')) mo.close(null); });
  }

  /** Pergunta os campos da frase que não vieram de medidas. Retorna null se cancelar; vazio deixa o marcador. */
  function askMissing(missing) {
    const mo = openModal(`<h2>Completar a frase</h2><p class="muted small">Estes campos não têm medida correspondente. Preencha ou deixe pendente: o campo pendente aparece como [PREENCHER: …] e bloqueia a finalização até ser resolvido.</p>
      ${missing.map((m, i) => `<div class="field"><label for="mx-${i}">${esc(m.name)} <span class="muted small">(${esc(m.reason)})</span></label><input id="mx-${i}" data-name="${esc(m.name)}"></div>`).join('')}
      <div class="row end"><button class="btn" data-x="cancel">Cancelar</button><button class="btn primary" data-x="ok">Inserir</button></div>`, { label: 'Completar a frase' });
    mo.el.addEventListener('click', (ev) => {
      const x = ev.target.closest('[data-x]'); if (!x) return;
      if (x.dataset.x === 'cancel') return mo.close(null);
      mo.close(Object.fromEntries([...mo.el.querySelectorAll('[data-name]')].map((i) => [i.dataset.name, i.value])));
    });
    return mo.closed.then((v) => (v === undefined ? null : v));
  }

  const secOf = (el) => exam.sections.find((x) => x.id === el.closest('[data-sec]').dataset.sec);

  view.onclick = async (e) => {
    const stepBtn = e.target.closest('[data-step]');
    if (stepBtn) { step = Number(stepBtn.dataset.step); return draw({ top: true }); }
    const b = e.target.closest('[data-act]');
    if (!b || b.tagName === 'SELECT') return;
    const act = b.dataset.act;
    const secId = b.closest('[data-sec]') && b.closest('[data-sec]').dataset.sec;
    if (act === 'next') { step = Math.min(STEPS.length - 1, step + 1); draw({ top: true }); }
    else if (act === 'prev') { step = Math.max(0, step - 1); draw({ top: true }); }
    else if (act === 'org-pick') { selSec = b.dataset.id; refreshFindings(); if (window.innerWidth <= 820) view.querySelector('#organ-panel').scrollIntoView({ block: 'nearest' }); }
    else if (act === 'org-next') {
      const vis = visibleSections(); const i = vis.findIndex((s) => s.id === (current() || {}).id);
      selSec = vis[(i + 1) % vis.length].id; refreshFindings(); view.querySelector('#organ-panel').scrollIntoView({ block: 'nearest' });
    } else if (act === 'b-opt') {
      const s = current(); s.build.sel = toggleOption(s.build.def, s.build.sel, b.dataset.g, Number(b.dataset.o)); syncBuild(s); touch(); refreshFindings();
    } else if (act === 'b-clear') { const s = current(); s.build.sel = {}; s.build.extras = {}; syncBuild(s); touch(); refreshFindings(); }
    else if (act === 'b-regen') {
      const s = current();
      if (await confirmDialog('Gerar o texto de novo a partir das escolhas? O texto que você editou à mão será substituído.', { ok: 'Substituir' })) { syncBuild(s, true); touch(); refreshFindings(); }
    } else if (act === 'set-status') {
      const s = current(); s.status = s.status === b.dataset.val ? '' : b.dataset.val; touch(); refreshFindings();
    }
    else if (act === 'sec-del') {
      const s = exam.sections.find((x) => x.id === secId);
      if (!hasData(s) || await confirmDialog(`Excluir "${s.title}" e o que já foi registrado nela?`, { ok: 'Excluir', danger: true })) {
        exam.sections = exam.sections.filter((x) => x.id !== secId); selSec = null; touch(); refreshFindings();
      }
    } else if (act === 'sec-add') {
      const input = view.querySelector('#newsec');
      const title = input.value.trim();
      if (!title) return toast('Digite o nome da estrutura.', 'error');
      const ns = blankSection(title); exam.sections.push(ns); selSec = ns.id; touch(); refreshFindings();
    } else if (act === 'm-add') { secOf(b).measuresList.push({ id: uid(), label: '', value: '', unit: '' }); touch(); refreshFindings(); }
    else if (act === 'm-del') { const s = secOf(b); s.measuresList = s.measuresList.filter((m) => m.id !== b.dataset.mid); touch(); refreshFindings(); }
    else if (act === 'm-calc') {
      const s = secOf(b);
      const res = await openCalculator(s, calcs);
      if (res) { s.measuresList.push(res); touch(); refreshFindings(); }
    } else if (act === 'm-refs') showReferences(secOf(b));
    else if (act === 'phrase') {
      const target = view.querySelector('#' + CSS.escape(b.dataset.target));
      const sec = b.closest('[data-sec]') ? exam.sections.find((x) => x.id === b.closest('[data-sec]').dataset.sec) : null;
      const measures = sec ? sec.measuresList : [];
      const raw = await pickPhrase({ modality: exam.type, structure: b.dataset.structure, measures });
      if (!raw || !target) return;
      let { text, missing } = fillPhrase(raw, measures);
      if (missing.length) {
        const extras = await askMissing(missing);
        if (extras === null) return; // cancelou: nada é inserido
        ({ text } = fillPhrase(raw, measures, extras));
      }
      insertAtCursor(target, text, { newline: ['f-impression', 'f-differentials'].includes(b.dataset.target) });
    } else if (act === 'save-phrase') {
      const s = current();
      if (!s.description.trim()) return toast('Escreva a descrição antes de guardar a frase.', 'error');
      await saveToLibraryDialog({ text: s.description, structure: s.title || 'Estrutura', modality: exam.type, measures: s.measuresList });
    } else if (act === 'pick-list') {
      const input = view.querySelector('#' + CSS.escape(b.dataset.target));
      const options = b.dataset.kind === 'species' ? SPECIES : breedsFor(exam.patient.species);
      if (!options.length) return toast('Não há sugestões de raça para esta espécie: digite a raça no campo.', 'info');
      const chosen = await pickOption({ title: b.dataset.kind === 'species' ? 'Espécie' : 'Raça', options });
      if (chosen && input) { input.value = chosen; input.dispatchEvent(new Event('input', { bubbles: true })); }
    } else if (act === 'dictate') {
      const target = view.querySelector('#' + CSS.escape(b.dataset.target));
      const text = await openDictation({ label: b.dataset.label });
      if (text && target) insertAtCursor(target, text);
    } else if (act === 'docx' || act === 'pdf') await doExport(act);
    else if (act === 'prelim' || act === 'undraft') {
      if (!can(profile, 'prelim')) return;
      await setStatus(exam, act === 'prelim' ? 'preliminary' : 'draft', actor); dirty = false; draw();
    } else if (act === 'final') { if (canFinalize) finalizeDialog(); }
    else if (act === 'revise') { if (canRevise) revisionDialog(b.dataset.kind); }
    else if (act === 'discard' || act === 'del-exam') {
      if (await deleteExamFlow(exam, profile)) { autosave.cancel(); dirty = false; failed = false; navigate('/'); }
    }
  };

  view.oninput = (e) => {
    const t = e.target;
    if (locked) return;
    if (t.dataset.bind) {
      setPath(exam, t.dataset.bind, t.dataset.num ? Number(t.value) : t.value);
      if (t.dataset.bind === 'patient.birthDate' || t.dataset.bind === 'date') updateAge();
      if (t.dataset.bind === 'patient.species') { const bl = view.querySelector('#breeds-list'); if (bl) bl.innerHTML = optionsHtml(breedsFor(t.value)); }
      touch();
    } else if (t.dataset.bx !== undefined) {
      const s = current(); s.build.extras[t.dataset.bx] = t.value; syncBuild(s); touch();
    } else if (t.dataset.mf) {
      const sec = secOf(t);
      const m = sec.measuresList.find((x) => x.id === t.dataset.mid);
      if (m) { m[t.dataset.mf] = t.value; syncBuild(sec); touch(); refreshOrgans(); }
    } else if (t.dataset.sf) {
      const s = secOf(t);
      if (s) { s[t.dataset.sf] = t.value; if (t.dataset.sf === 'description') { const nt = view.querySelector('#bnotice'); if (nt) nt.hidden = !isManual(s); } touch(); refreshOrgans(); }
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
