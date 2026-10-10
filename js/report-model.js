// Converte um exame no modelo neutro de documento usado pela prévia, pelo Word e pelo PDF.
// Garante que os três formatos tenham exatamente o mesmo conteúdo clínico.
// Função pura: campos vazios são omitidos, nada é preenchido automaticamente.
import { MODALITY, fmtDateBR, ageFromBirth } from './utils.js';

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
  ].filter(([, v]) => filled(v)).map(([k, v]) => [k, String(v).trim()]);

  const blocks = [];
  if (filled(exam.intro)) blocks.push({ kind: 'p', text: exam.intro.trim() });

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
    if (filled(s.measures)) items.push({ label: 'Medidas', text: s.measures.trim() });
    if (filled(s.notes)) items.push({ label: 'Observações', text: s.notes.trim() });
    if (items.length) blocks.push({ kind: 'section', title: (s.title || '').trim() || 'Estrutura', items });
  }

  if (filled(exam.impression)) blocks.push({ kind: 'h', text: tpl.conclusionTitle || 'Impressão diagnóstica' }, { kind: 'p', text: exam.impression.trim() });
  if (filled(exam.notes)) blocks.push({ kind: 'h', text: tpl.notesTitle || 'Observações' }, { kind: 'p', text: exam.notes.trim() });

  const images = (exam.images || []).map((im) => ({
    dataUrl: im.src, w: im.w, h: im.h, scale: im.scale || 1,
    caption: [im.region, im.caption].filter(filled).map((x) => x.trim()).join(' — '),
  }));

  const headerLines = [prof.service, prof.name && `${prof.name}${prof.crmv ? ` — CRMV-${prof.uf || ''} ${prof.crmv}` : ''}`,
    prof.contact, settings.headerText].filter(filled);

  return {
    title: tpl.docTitle || (isRx ? 'Laudo de Radiografia Veterinária' : 'Laudo de Ultrassonografia Veterinária'),
    version: exam.version || 1,
    status: exam.status,
    headerLines, logo: settings.logo || '',
    footerText: settings.footerText || '',
    font: settings.font === 'serif' ? 'serif' : 'sans',
    fontSize: Number(settings.fontSize) || 11,
    patientRows, blocks,
    images: { perRow: Math.min(3, Math.max(1, Number(exam.imagesPerRow) || 2)), items: images },
    signature: tpl.signature === false ? null : {
      name: prof.name || '', crmv: filled(prof.crmv) ? `CRMV-${prof.uf || ''} ${prof.crmv}` : '',
    },
  };
}
