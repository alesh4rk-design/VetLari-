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

export function defaultTemplates() {
  return [
    {
      id: 'tpl-usg-abdominal', builtin: true, modality: 'usg', name: 'Ultrassonografia abdominal (modelo inicial)',
      docTitle: 'Laudo de Ultrassonografia Veterinária', intro: '',
      conclusionTitle: 'Impressão diagnóstica', notesTitle: 'Observações e recomendações',
      signature: true, imagesPerRow: 2,
      sections: ['Fígado', 'Vesícula biliar', 'Baço', 'Rins', 'Bexiga urinária', 'Estômago', 'Intestinos',
        'Pâncreas', 'Adrenais', 'Cavidade abdominal', 'Outras estruturas relevantes'].map(sec),
    },
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
  return all.sort((a, b) => (b.builtin ? 1 : 0) - (a.builtin ? 1 : 0) || a.name.localeCompare(b.name, 'pt-BR'));
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
