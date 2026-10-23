// Converte um exame no modelo neutro de documento usado pela prévia, pelo Word e pelo PDF.
// Garante que os três formatos tenham exatamente o mesmo conteúdo clínico.
// Função pura: campos vazios são omitidos, nada é preenchido automaticamente.
import { MODALITY, fmtDateBR, fmtDateTimeBR, ageFromBirth } from './utils.js';
import { STRUCTURE_STATUS } from './quality.js';
import { documentSource } from './annotations.js';

const STATUS_NOTE = { draft: 'RASCUNHO — documento não finalizado', preliminary: 'LAUDO PRELIMINAR — sujeito a revisão' };
const REVISION = { correction: 'Retificação', addendum: 'Adendo' };

const filled = (v) => String(v ?? '').trim().length > 0;

export function buildReport(exam, settings = {}) {
  const prof = settings.professional || {};
  const p = exam.patient || {};
  const isRx = exam.type === 'rx';
  const tpl = exam.layout || {};

  const age = filled(p.age) ? p.age : ageFromBirth(p.birthDate, exam.date);
  const weight = filled(p.weight) ? `${String(p.weight).replace('.', ',')} kg` : '';
  const patientRows = [
    ['Animal', p.name], ['Espécie', p.species], ['Raça', p.breed], ['Sexo', p.sex],
    ['Idade', age], ['Peso', weight], ['Tutor', p.tutor], ['Clínica solicitante', exam.clinic],
    ['Médico-veterinário solicitante', exam.requestingVet], ['Identificador', p.identifier],
    ['Modalidade', (MODALITY[exam.type] || MODALITY.usg).label], ['Data do exame', fmtDateBR(exam.date)],
    ['Operador', (exam.clinical || {}).operator], ['Equipamento', (exam.clinical || {}).equipment], ['Local', (exam.clinical || {}).location],
  ].filter(([, v]) => filled(v)).map(([k, v]) => [k, String(v).trim()]);

  const blocks = [];
  if (exam.revisionKind) {
    blocks.push({ kind: 'kv', label: `${REVISION[exam.revisionKind]} à versão ${exam.version - 1}`, text: exam.justification || 'sem justificativa registrada' });
    if (exam.revisionKind === 'addendum' && filled(exam.addendum)) blocks.push({ kind: 'kv', label: 'Texto do adendo', text: exam.addendum.trim() });
  }
  if (filled(exam.intro)) blocks.push({ kind: 'p', text: exam.intro.trim() });

  const c = exam.clinical || {};
  for (const [label, v] of [['Indicação clínica', c.indication], ['Histórico relevante', c.history], ['Pergunta clínica', c.question], ['Medicamentos informados', c.medications]]) {
    if (filled(v)) blocks.push({ kind: 'kv', label, text: v.trim() });
  }
  if (filled(c.limitations)) blocks.push({ kind: 'kv', label: 'Técnica e limitações', text: c.limitations.trim() });

  if (isRx) {
    const rx = exam.rx || {};
    for (const [label, v] of [['Região anatômica examinada', rx.region], ['Projeções realizadas', rx.projections],
      ['Qualidade técnica e limitações', rx.quality]]) {
      if (filled(v)) blocks.push({ kind: 'kv', label, text: v.trim() });
    }
  }

  for (const s of exam.sections || []) {
    const items = [];
    if (filled(s.description)) items.push({ label: '', text: s.description.trim() });
    const rows = (s.measuresList || []).filter((m) => filled(m.value)).map((m) => `${filled(m.label) ? m.label.trim() + ': ' : ''}${m.value.trim()}${filled(m.unit) ? ' ' + m.unit.trim() : ''}`);
    if (filled(s.measures)) rows.push(s.measures.trim());
    if (rows.length) items.push({ label: 'Medidas', text: rows.join('; ') });
    if (filled(s.notes)) items.push({ label: 'Observações', text: s.notes.trim() });
    // Estrutura sem status e sem conteúdo não aparece: ausência de informação nunca vira "normal".
    if (items.length || s.status) {
      const title = (s.title || '').trim() || 'Estrutura';
      blocks.push({ kind: 'section', title: s.status ? `${title} — ${STRUCTURE_STATUS[s.status] || s.status}` : title, items });
    }
  }

  if (filled(exam.impression)) blocks.push({ kind: 'h', text: tpl.conclusionTitle || 'Impressão diagnóstica' }, { kind: 'p', text: exam.impression.trim() });
  if (filled(exam.differentials)) blocks.push({ kind: 'h', text: 'Diagnósticos diferenciais' }, { kind: 'p', text: exam.differentials.trim() });
  if (filled(exam.notes)) blocks.push({ kind: 'h', text: tpl.notesTitle || 'Observações' }, { kind: 'p', text: exam.notes.trim() });

  // Somente imagens marcadas para o laudo; usa a cópia anotada quando existir (o original é preservado).
  const images = (exam.images || []).filter((im) => im.include !== false).map((im) => ({
    dataUrl: documentSource(im), w: im.w, h: im.h, scale: im.scale || 1,
    caption: [im.region, im.caption].filter(filled).map((x) => x.trim()).join(' — '),
  }));

  const headerLines = [prof.service, prof.name && `${prof.name}${prof.crmv ? ` — CRMV-${prof.uf || ''} ${prof.crmv}` : ''}`,
    prof.contact, settings.headerText].filter(filled);

  return {
    title: tpl.docTitle || (isRx ? 'Laudo de Radiografia Veterinária' : 'Laudo de Ultrassonografia Veterinária'),
    version: exam.version || 1,
    status: exam.status,
    headerLines, logo: settings.logo || '',
    footerText: [settings.footerText, `Documento ${String(exam.id || '').slice(0, 8)} · versão ${exam.version || 1}`].filter(filled).join(' · '),
    statusNote: STATUS_NOTE[exam.status] || '',
    font: settings.font === 'serif' ? 'serif' : 'sans',
    fontSize: Number(settings.fontSize) || 11,
    patientRows, blocks,
    images: { perRow: Math.min(3, Math.max(1, Number(exam.imagesPerRow) || 2)), items: images },
    signature: tpl.signature === false ? null : {
      name: prof.name || '', crmv: filled(prof.crmv) ? `CRMV-${prof.uf || ''} ${prof.crmv}` : '',
      stamp: exam.status === 'final' && exam.finalizedAt
        ? `Finalizado eletronicamente em ${fmtDateTimeBR(exam.finalizedAt)}${exam.finalizedBy ? ' por ' + exam.finalizedBy.name : ''} (sem certificado digital ICP-Brasil)` : '',
    },
  };
}
