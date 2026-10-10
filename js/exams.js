// Dados de exames/laudos (criação, versões, finalização) e navegador com filtros/pesquisa.
import { uid, esc, todayISO, fmtDateBR, fmtDateTimeBR, MODALITY } from './utils.js';
import { dbAll, dbGet, dbPut, dbDel } from './local-storage.js';

export const getExam = (id) => dbGet('exams', id);
export const listExams = async () => (await dbAll('exams')).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
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
    sections: template.sections.map((s) => ({ id: uid(), title: s.title, description: '', measures: '', notes: '' })),
    impression: '', notes: '', images: [],
    history: [{ ts: Date.now(), action: 'Rascunho criado', version: 1 }],
  };
}

export function finalizeExam(exam) {
  exam.status = 'final';
  exam.finalizedAt = Date.now();
  exam.history.push({ ts: exam.finalizedAt, action: 'Laudo finalizado', version: exam.version });
  return saveExam(exam);
}

/** Cria nova versão editável a partir de um laudo finalizado; o original permanece intacto. */
export async function createCorrection(original) {
  const copy = JSON.parse(JSON.stringify(original));
  copy.id = uid(); copy.status = 'draft'; copy.version = original.version + 1; copy.originId = original.id;
  copy.createdAt = Date.now(); delete copy.finalizedAt;
  copy.history = [...original.history, { ts: Date.now(), action: `Correção iniciada a partir da versão ${original.version}`, version: copy.version }];
  await saveExam(copy);
  return copy;
}

/** Nova versão apenas com a estrutura (modelo) de um laudo anterior, sem achados nem paciente. */
export function structureFrom(prev, template) {
  const fresh = newExam(prev.type, template || { id: prev.templateId, ...prev.layout, imagesPerRow: prev.imagesPerRow, sections: prev.sections }, null);
  fresh.sections = prev.sections.map((s) => ({ id: uid(), title: s.title, description: '', measures: '', notes: '' }));
  return fresh;
}

export function searchableText(e) {
  const p = e.patient || {};
  return [p.name, p.tutor, e.clinic, e.requestingVet, e.impression, e.notes, e.rx && Object.values(e.rx).join(' '),
    ...(e.sections || []).map((s) => `${s.title} ${s.description} ${s.measures} ${s.notes}`),
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
  const stale = e.status === 'draft' && Date.now() - e.updatedAt > 3 * 86400000;
  return `<li><div><strong>${esc(e.patient.name || 'Sem nome')}</strong>
    <span class="badge mod">${MODALITY[e.type].code}</span>
    <span class="badge ${e.status}">${e.status === 'final' ? `Finalizado v${e.version}` : 'Rascunho local'}</span>${stale ? ' <span class="badge draft">Revisão pendente</span>' : ''}
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
    ${compact ? '' : '<div class="field"><label for="status">Status</label><select id="status" data-f="status"><option value="">Todos</option><option value="draft">Rascunho</option><option value="final">Finalizado</option></select></div>'}
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
