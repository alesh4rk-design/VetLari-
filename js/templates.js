// Modelos de laudo e configurações padrão. Os modelos iniciais são pontos de partida editáveis,
// não protocolos clínicos: a profissional define as estruturas adequadas à sua rotina.
import { uid } from './utils.js';
import { dbAll, dbPut, dbDel, dbGet, getSetting, setSetting } from './local-storage.js';

export const DEFAULT_SETTINGS = {
  professional: { name: '', crmv: '', uf: '', service: '', contact: '' },
  headerText: '',
  footerText: '',
  logo: '',
  font: 'sans',            // sans | serif
  fontSize: 11,
  theme: 'dark',
  maxImageMB: 15,          // limite por arquivo importado
  compress: true,
  jpegQuality: 0.85,
  maxImagePx: 1600,
};

const sec = (title) => ({ id: uid(), title });

const usg = (id, name, sections, extra = {}) => ({
  id, builtin: true, modality: 'usg', name: `${name} (modelo inicial)`,
  docTitle: 'Laudo de Ultrassonografia Veterinária', intro: '',
  conclusionTitle: 'Impressão diagnóstica', notesTitle: 'Observações e recomendações',
  signature: true, imagesPerRow: 2, sections: sections.map(sec), ...extra,
});

/**
 * Modelos iniciais. São apenas listas de estruturas para começar: NÃO são protocolos clínicos nem
 * foram validados. A veterinária deve duplicar e ajustar cada um à sua rotina (Meus modelos).
 */
export function defaultTemplates() {
  return [
    usg('tpl-usg-abdominal', 'Ultrassonografia abdominal completa', ['Fígado', 'Vesícula biliar e vias biliares', 'Baço', 'Estômago', 'Intestinos',
      'Pâncreas', 'Rins', 'Adrenais', 'Bexiga urinária', 'Trato reprodutivo', 'Linfonodos', 'Cavidade peritoneal', 'Vasos avaliados', 'Outras estruturas relevantes']),
    usg('tpl-usg-direcionada', 'Ultrassonografia abdominal direcionada / exame focal', ['Região ou estrutura de interesse', 'Estruturas adjacentes avaliadas', 'Líquido livre (se pesquisado)', 'Outras observações']),
    usg('tpl-usg-urinario', 'Avaliação do trato urinário', ['Rim direito', 'Rim esquerdo', 'Ureteres', 'Bexiga urinária', 'Uretra (se avaliada)']),
    usg('tpl-usg-hepatobiliar', 'Avaliação hepatobiliar', ['Fígado', 'Vesícula biliar', 'Vias biliares', 'Vasos hepáticos e portais avaliados']),
    usg('tpl-usg-gastro', 'Avaliação gastrointestinal', ['Estômago', 'Duodeno', 'Jejuno', 'Íleo', 'Cólon', 'Linfonodos regionais']),
    usg('tpl-usg-reprodutivo', 'Avaliação reprodutiva e gestacional', ['Útero', 'Ovários', 'Próstata', 'Testículos', 'Conteúdo gestacional (se aplicável)']),
    usg('tpl-usg-superficial', 'Estruturas superficiais e tecidos moles', ['Região examinada', 'Lesão ou estrutura de interesse', 'Linfonodos regionais']),
    usg('tpl-usg-musculo', 'Avaliação musculoesquelética', ['Estrutura avaliada (músculo, tendão ou articulação)', 'Estruturas adjacentes']),
    {
      id: 'tpl-rx-geral', builtin: true, modality: 'rx', name: 'Radiografia (modelo inicial editável)',
      docTitle: 'Laudo de Radiografia Veterinária', intro: '',
      conclusionTitle: 'Impressão diagnóstica', notesTitle: 'Observações complementares',
      signature: true, imagesPerRow: 2,
      sections: ['Estruturas ósseas', 'Articulações', 'Tecidos moles', 'Outras estruturas avaliadas'].map(sec),
    },
  ];
}

export async function loadSettings() {
  const saved = await getSetting('app', {});
  return { ...DEFAULT_SETTINGS, ...saved, professional: { ...DEFAULT_SETTINGS.professional, ...(saved.professional || {}) } };
}
export const saveSettings = (s) => setSetting('app', s);

export async function listTemplates() {
  let all = await dbAll('templates');
  const have = new Set(all.map((t) => t.id));
  for (const t of defaultTemplates()) {
    if (!have.has(t.id)) { await dbPut('templates', t); all.push(t); }
  }
  // Modelos iniciais primeiro, na ordem em que foram definidos; depois os da usuária, por nome.
  const order = defaultTemplates().map((t) => t.id);
  const rank = (t) => (t.builtin && order.includes(t.id) ? order.indexOf(t.id) : order.length);
  return all.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, 'pt-BR'));
}
export const getTemplate = (id) => dbGet('templates', id);
export const saveTemplate = (t) => dbPut('templates', { ...t, updatedAt: Date.now() });
export const deleteTemplate = (id) => dbDel('templates', id);

export function newTemplate(modality) {
  const base = defaultTemplates().find((t) => t.modality === modality);
  return {
    id: uid(), builtin: false, modality, name: 'Novo modelo',
    docTitle: base.docTitle, intro: '', conclusionTitle: base.conclusionTitle, notesTitle: base.notesTitle,
    signature: true, imagesPerRow: 2, sections: [sec('Nova estrutura')],
  };
}

export function cloneTemplate(t) {
  return { ...JSON.parse(JSON.stringify(t)), id: uid(), builtin: false, name: `${t.name} (cópia)`,
    sections: t.sections.map((s) => ({ ...s, id: uid() })) };
}
