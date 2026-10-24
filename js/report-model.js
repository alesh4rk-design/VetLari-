// Converte um exame no modelo neutro de documento usado pela prévia, pelo Word e pelo PDF.
// Garante que os três formatos tenham exatamente o mesmo conteúdo clínico.
// Função pura: campos vazios são omitidos, nada é preenchido automaticamente.
import { fmtDateBR, ageFromBirth } from './utils.js';
import { STRUCTURE_STATUS } from './quality.js';
import { documentSource } from './annotations.js';

const STATUS_NOTE = { draft: 'RASCUNHO — documento não finalizado', preliminary: 'LAUDO PRELIMINAR — sujeito a revisão' };
const REVISION = { correction: 'Retificação', addendum: 'Adendo' };

const filled = (v) => String(v ?? '').trim().length > 0;

/** O valor aparece no texto como número inteiro ("4" não casa com "4,5" nem com "14"). */
const valueInText = (text, value) => {
  const v = String(value).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^\\d,.])${v}(?![\\d]|[,.]\\d)`).test(text);
};

export function buildReport(exam, settings = {}) {
  const prof = settings.professional || {};
  const p = exam.patient || {};
  const isRx = exam.type === 'rx';
  const tpl = exam.layout || {};

  // Com data de nascimento, a idade é sempre calculada na data do exame (nunca fica desatualizada).
  const age = ageFromBirth(p.birthDate, exam.date) || (filled(p.age) ? p.age : '');
  const weight = filled(p.weight) ? `${String(p.weight).replace('.', ',')} ${p.weightUnit === 'g' ? 'g' : 'kg'}` : '';
  // Identificação na ordem e com os nomes dos laudos da veterinária (3 colunas no documento).
  // Data e hora são opcionais: só aparecem quando preenchidas (hora sem data aparece como "Hora").
  const when = filled(exam.date) ? `${fmtDateBR(exam.date)}${filled(exam.time) ? ' ' + exam.time : ''}` : '';
  const patientRows = [
    ['Paciente', p.name], ['Espécie', p.species], ['Raça', p.breed], ['Sexo', p.sex], ['Idade', age], ['Responsável', p.tutor],
    ['Data', when], ['Hora', filled(exam.date) ? '' : exam.time], ['Solicitante', exam.requestingVet], ['Clínica/Hospital', exam.clinic],
    ['Peso', weight], ['Identificador', p.identifier],
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
    // Medidas já escritas na frase do montador não se repetem; as demais (não usadas no texto) aparecem em "Medidas" para nada se perder.
    const rows = (s.measuresList || []).filter((m) => filled(m.value) && !(s.build && filled(s.description) && valueInText(s.description, m.value))).map((m) => `${filled(m.label) ? m.label.trim() + ': ' : ''}${m.value.trim()}${filled(m.unit) ? ' ' + m.unit.trim() : ''}${m.calculated ? ` (calculado: ${m.calcName})` : ''}`);
    if (filled(s.measures)) rows.push(s.measures.trim());
    if (rows.length) items.push({ label: 'Medidas', text: rows.join('; ') });
    if (filled(s.notes)) items.push({ label: 'Observações', text: s.notes.trim() });
    // Status explícito sem descrição aparece como foi marcado; ausência de informação nunca vira "normal".
    if (!items.length && s.status) items.push({ label: '', text: STRUCTURE_STATUS[s.status] || s.status });
    if (items.length) blocks.push({ kind: 'section', title: (s.title || '').trim() || 'Estrutura', items });
  }

  if (filled(exam.impression)) {
    blocks.push({ kind: 'h', text: tpl.conclusionTitle || 'Impressão diagnóstica' });
    const lines = exam.impression.split(/\r?\n/).map((l) => l.replace(/^\s*[-•*]\s*/, '').trim()).filter(Boolean);
    // Conclusão em lista de itens (um por linha), como nos laudos da veterinária; desligável em Configurações.
    if (settings.impressionAsList !== false && lines.length) blocks.push({ kind: 'list', items: lines });
    else blocks.push({ kind: 'p', text: exam.impression.trim() });
    if (filled(settings.afterConclusion)) blocks.push({ kind: 'note', text: settings.afterConclusion.trim() });
  }
  if (filled(exam.differentials)) blocks.push({ kind: 'h', text: 'Diagnósticos diferenciais' }, { kind: 'p', text: exam.differentials.trim() });
  if (filled(exam.notes)) blocks.push({ kind: 'h', text: tpl.notesTitle || 'Observações' }, { kind: 'p', text: exam.notes.trim() });

  // Somente imagens marcadas para o laudo; usa a cópia anotada quando existir (o original é preservado).
  const images = (exam.images || []).filter((im) => im.include !== false).map((im) => ({
    dataUrl: documentSource(im), w: im.w, h: im.h, scale: im.scale || 1,
    caption: [im.region, im.caption].filter(filled).map((x) => x.trim()).join(' — '),
  }));

  // Sem logotipos, o topo mostra o serviço e o contato; nome e CRMV já constam na assinatura.
  const headerLines = [prof.service, prof.contact, settings.headerText].filter(filled);

  return {
    title: tpl.docTitle || (isRx ? 'Laudo de Radiografia Veterinária' : 'Laudo de Ultrassonografia Veterinária'),
    version: exam.version || 1,
    status: exam.status,
    headerLines, logo: settings.logo || '', logo2: settings.logo2 || '',
    footerText: [settings.footerText, `Documento ${String(exam.id || '').slice(0, 8)} · versão ${exam.version || 1}`].filter(filled).join(' · '),
    statusNote: STATUS_NOTE[exam.status] || '',
    font: settings.font === 'serif' ? 'serif' : 'sans',
    fontSize: Number(settings.fontSize) || 11,
    patientRows, blocks, idShort: String(p.name || '').trim(), dateText: filled(exam.date) ? fmtDateBR(exam.date) : '',
    images: { perRow: Math.min(4, Math.max(1, Number(exam.imagesPerRow) || 2)), items: images },
    signature: tpl.signature === false ? null : {
      name: prof.name || '', crmv: filled(prof.crmv) ? `CRMV-${prof.uf || ''} ${prof.crmv}` : '',
      code: String(exam.id || '').replace(/-/g, '').toUpperCase(),
      // Imagem da assinatura: só no laudo finalizado (rascunho e preliminar nunca saem assinados).
      image: exam.status === 'final' ? settings.signatureImage || '' : '',
      stamp: exam.status === 'final' && exam.finalizedAt
        ? `Finalizado eletronicamente em ${new Date(exam.finalizedAt).toLocaleDateString('pt-BR')}${exam.finalizedBy ? ' por ' + exam.finalizedBy.name : ''} (sem certificado digital ICP-Brasil)` : '',
    },
  };
}

/**
 * Texto corrido do laudo para colar no WhatsApp, e-mail ou outro sistema. Negrito e itálico viram
 * *negrito* e _itálico_ (formato do WhatsApp). Mesmo conteúdo da prévia, sem imagens.
 */
export function reportToText(report) {
  const fmt = (t) => String(t || '').replace(/\*\*([\s\S]+?)\*\*/g, '*$1*').replace(/__([\s\S]+?)__/g, '_$1_');
  const out = [`*${report.title}*`];
  if (report.statusNote) out.push(report.statusNote);
  if (report.patientRows.length) out.push('', report.patientRows.map(([k, v]) => `${k}: ${v}`).join('\n'));
  for (const b of report.blocks) {
    if (b.kind === 'h') out.push('', `*${b.text}*`);
    else if (b.kind === 'kv') out.push('', `*${b.label}:* ${fmt(b.text)}`);
    else if (b.kind === 'p') out.push('', fmt(b.text));
    else if (b.kind === 'note') out.push('', `_${fmt(b.text).replace(/^_|_$/g, '')}_`);
    else if (b.kind === 'list') out.push(b.items.map((i) => `• ${fmt(i)}`).join('\n'));
    else if (b.kind === 'section') out.push('', `*${b.title}:* ${b.items.map((i) => (i.label ? `${i.label}: ` : '') + fmt(i.text)).join(' ')}`);
  }
  if (report.signature && report.signature.name) out.push('', [report.signature.name, report.signature.crmv].filter(Boolean).join(' · '));
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
