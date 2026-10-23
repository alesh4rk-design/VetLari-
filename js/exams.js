// Dados de exames/laudos (criação, versões, finalização) e navegador com filtros/pesquisa.
import { uid, esc, todayISO, fmtDateBR, fmtDateTimeBR, MODALITY } from './utils.js';
import { dbAll, dbGet, dbPut, dbDel } from './local-storage.js';

export const STATUS_LABEL = { draft: 'Rascunho', preliminary: 'Preliminar', final: 'Finalizado' };

/** Completa campos introduzidos depois da Fase 1 em laudos antigos, sem alterar o conteúdo clínico. */
export function normalizeExam(e) {
  if (!e) return e;
  e.clinical ??= { indication: '', history: '', question: '', medications: '', operator: '', equipment: '', location: '', limitations: '' };
  e.differentials ??= '';
  e.addendum ??= '';
  for (const s of e.sections || []) { s.status ??= ''; s.measuresList ??= []; s.sex ??= ''; s.build ??= null; }
  return e;
}

export const getExam = async (id) => normalizeExam(await dbGet('exams', id));
export const listExams = async () => (await dbAll('exams')).map(normalizeExam).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
export const deleteExam = (id) => dbDel('exams', id);

export function saveExam(exam) {
  exam.updatedAt = Date.now();
  return dbPut('exams', exam);
}

export function newExam(type, template, patient) {
  const p = patient || {};
  return {
    id: uid(), type, status: 'draft', version: 1, originId: null, templateId: template.id, createdAt: Date.now(), updatedAt: Date.now(),
    layout: { docTitle: template.docTitle, conclusionTitle: template.conclusionTitle, notesTitle: template.notesTitle, signature: template.signature !== false },
    imagesPerRow: template.imagesPerRow || 2, intro: template.intro || '', date: todayISO(),
    patientId: p.id || null,
    patient: { name: p.name || '', species: p.species || '', breed: p.breed || '', sex: p.sex || '', birthDate: p.birthDate || '', age: p.age || '', weight: p.weight || '', tutor: p.tutor || '', identifier: p.identifier || '' },
    clinic: '', requestingVet: '', rx: { region: '', projections: '', quality: '' },
    clinical: { indication: '', history: '', question: '', medications: '', operator: '', equipment: '', location: '', limitations: '' },
    sections: template.sections.map((s) => blankSection(s.title, s)),
    impression: '', differentials: '', notes: '', addendum: '', images: [],
    history: [{ ts: Date.now(), action: 'Rascunho criado', version: 1 }],
  };
}

/** Cria a estrutura do laudo; as medidas do modelo viram linhas "slot" (nome e unidade prontos, só falta o valor). */
export const blankSection = (title, tpl = {}) => ({
  id: uid(), title, sex: tpl.sex || '', status: '', description: '', measures: '', notes: '',
  // Montador de descrição: definição copiada do modelo; seleções e extras começam vazios (nada marcado).
  build: tpl.builder ? { def: JSON.parse(JSON.stringify(tpl.builder)), sel: {}, extras: {}, auto: '' } : null,
  measuresList: (tpl.measures || []).filter((m) => m.label).map((m) => ({ id: uid(), label: m.label, value: '', unit: m.unit || '', slot: true })),
});

/** Registro de auditoria local: quem fez o quê e quando (não é à prova de adulteração). */
export function logAction(exam, action, profile, detail = '') {
  exam.history.push({ ts: Date.now(), action, detail, version: exam.version, actor: profile ? { name: profile.name, role: profile.role } : null });
}

/** Registra "Editado" no máximo uma vez a cada 15 minutos por pessoa, para o histórico não virar ruído. */
export function logEdit(exam, profile) {
  const last = exam.history[exam.history.length - 1];
  const sameActor = last && last.actor && profile && last.actor.name === profile.name;
  if (!(last && last.action === 'Editado' && sameActor && Date.now() - last.ts < 15 * 60000)) logAction(exam, 'Editado', profile);
}

export function setStatus(exam, status, profile) {
  exam.status = status;
  logAction(exam, `Status alterado para "${STATUS_LABEL[status]}"`, profile);
  return saveExam(exam);
}

export function finalizeExam(exam, profile, { justification = '', pending = [] } = {}) {
  exam.status = 'final';
  exam.finalizedAt = Date.now();
  exam.finalizedBy = profile ? { name: profile.name, crmv: profile.crmv || '' } : null;
  const detail = [pending.length ? `Itens não confirmados/pendências: ${pending.join('; ')}` : '', justification && `Justificativa: ${justification}`].filter(Boolean).join(' | ');
  logAction(exam, 'Laudo finalizado', profile, detail);
  return saveExam(exam);
}

export const REVISION_LABEL = { correction: 'Retificação', addendum: 'Adendo' };

/** Cria nova versão (retificação ou adendo) a partir de um laudo finalizado; o original permanece intacto. */
export async function createRevision(original, kind, justification, profile) {
  if (!REVISION_LABEL[kind]) throw new Error('Tipo de revisão inválido.');
  if (!String(justification || '').trim()) throw new Error('Informe a justificativa.');
  const copy = JSON.parse(JSON.stringify(original));
  copy.id = uid(); copy.status = 'draft'; copy.version = original.version + 1; copy.originId = original.id;
  copy.revisionKind = kind; copy.justification = justification.trim();
  copy.createdAt = Date.now(); delete copy.finalizedAt; delete copy.finalizedBy;
  copy.history = [...original.history];
  logAction(copy, `${REVISION_LABEL[kind]} iniciado(a) a partir da versão ${original.version}`, profile, `Justificativa: ${copy.justification}`);
  await saveExam(copy);
  return copy;
}

/** Nova versão apenas com a estrutura (modelo) de um laudo anterior, sem achados nem paciente. */
export function structureFrom(prev, template) {
  const fresh = newExam(prev.type, template || { id: prev.templateId, ...prev.layout, imagesPerRow: prev.imagesPerRow, sections: prev.sections }, null);
  fresh.sections = prev.sections.map((s) => blankSection(s.title, { sex: s.sex, builder: s.build && s.build.def, measures: (s.measuresList || []).filter((m) => m.label && !m.calculated).map((m) => ({ label: m.label, unit: m.unit })) }));
  return fresh;
}

export function searchableText(e) {
  const p = e.patient || {};
  return [p.name, p.tutor, e.clinic, e.requestingVet, e.impression, e.differentials, e.notes, e.addendum,
    e.rx && Object.values(e.rx).join(' '), e.clinical && Object.values(e.clinical).join(' '),
    ...(e.sections || []).map((s) => `${s.title} ${s.description} ${s.measures} ${s.notes} ${(s.measuresList || []).map((m) => `${m.label} ${m.value} ${m.unit}`).join(' ')}`),
    ...(e.images || []).map((i) => `${i.caption} ${i.region}`)].join(' ').toLowerCase();
}

export function filterExams(all, f = {}) {
  const q = (f.q || '').trim().toLowerCase();
  const patient = (f.patient || '').trim().toLowerCase(), tutor = (f.tutor || '').trim().toLowerCase();
  const clinic = (f.clinic || '').trim().toLowerCase();
  return all.filter((e) => {
    if (f.type && e.type !== f.type) return false;
    if (f.status && e.status !== f.status) return false;
    if (f.from && e.date < f.from) return false;
    if (f.to && e.date > f.to) return false;
    if (patient && !(e.patient.name || '').toLowerCase().includes(patient)) return false;
    if (tutor && !(e.patient.tutor || '').toLowerCase().includes(tutor)) return false;
    if (clinic && !(e.clinic || '').toLowerCase().includes(clinic)) return false;
    return !q || searchableText(e).includes(q);
  });
}

export function examRow(e) {
  const stale = e.status !== 'final' && Date.now() - e.updatedAt > 3 * 86400000;
  const rev = e.revisionKind ? ` · ${REVISION_LABEL[e.revisionKind]}` : '';
  return `<li><div><strong>${esc(e.patient.name || 'Sem nome')}</strong>
    <span class="badge mod">${MODALITY[e.type].code}</span>
    <span class="badge ${e.status}">${STATUS_LABEL[e.status]} v${e.version}${rev}</span>${stale ? ' <span class="badge draft">Revisão pendente</span>' : ''}
    <div class="muted small">${fmtDateBR(e.date)}${e.patient.tutor ? ' · Tutor: ' + esc(e.patient.tutor) : ''}${e.clinic ? ' · ' + esc(e.clinic) : ''} · atualizado ${fmtDateTimeBR(e.updatedAt)}</div></div>
    <div class="row"><a class="btn sm primary" href="#/laudo/${e.id}">${e.status === 'final' ? 'Abrir' : 'Continuar'}</a></div></li>`;
}

/** Lista com filtros. opts.compact = versão do painel inicial. */
export async function renderExamBrowser(container, { compact = false, limit = 0, initial = {} } = {}) {
  const all = await listExams();
  const f = { ...initial };
  const field = (id, label, type = 'text', v = '') => `<div class="field"><label for="${id}">${label}</label><input id="${id}" data-f="${id}" type="${type}" value="${esc(v)}"></div>`;
  container.innerHTML = `<div class="card"><div class="grid ${compact ? 'g4 keep2' : 'g3'}">
    ${field('q', 'Pesquisar (palavra no texto)', 'search', f.q || '')}${field('patient', 'Animal', 'text', f.patient || '')}
    ${compact ? '' : field('tutor', 'Tutor', 'text', f.tutor || '')}${field('clinic', 'Clínica', 'text', f.clinic || '')}
    ${field('from', 'Data inicial', 'date')}${field('to', 'Data final', 'date')}
    <div class="field"><label for="type">Modalidade</label><select id="type" data-f="type"><option value="">Todas</option><option value="usg">Ultrassonografia</option><option value="rx">Radiografia</option></select></div>
    ${compact ? '' : '<div class="field"><label for="status">Status</label><select id="status" data-f="status"><option value="">Todos</option><option value="draft">Rascunho</option><option value="preliminary">Preliminar</option><option value="final">Finalizado</option></select></div>'}
    </div></div><div class="card" id="exlist" aria-live="polite"></div>`;
  const draw = () => {
    let res = filterExams(all, f);
    const total = res.length;
    if (limit) res = res.slice(0, limit);
    container.querySelector('#exlist').innerHTML = res.length
      ? `<ul class="list">${res.map(examRow).join('')}</ul>${limit && total > limit ? '<p class="small muted">Mostrando os mais recentes. <a href="#/laudos">Ver todos</a></p>' : ''}`
      : `<div class="empty">${all.length ? 'Nenhum laudo corresponde aos filtros.' : 'Nenhum laudo ainda. Clique em "Novo laudo" para começar.'}</div>`;
  };
  container.addEventListener('input', (e) => { if (e.target.dataset.f) { f[e.target.dataset.f] = e.target.value; draw(); } });
  draw();
  return all;
}
