// Modelos de laudo e configurações padrão. Os modelos iniciais são pontos de partida editáveis,
// não protocolos clínicos: a profissional define as estruturas adequadas à sua rotina.
import { uid } from './utils.js';
import { USG_BUILDERS, AFTER_CONCLUSION_NOTE } from './catalog-usg.js';
import { dbAll, dbPut, dbDel, dbGet, getSetting, setSetting } from './local-storage.js';

export const DEFAULT_SETTINGS = {
  professional: { name: '', crmv: '', uf: '', service: '', contact: '' },
  headerText: '',
  footerText: '',
  logo: '',
  logo2: '',
  font: 'sans',            // sans | serif
  fontSize: 11,
  theme: 'dark',
  maxImageMB: 15,          // limite por arquivo importado
  compress: true,
  jpegQuality: 0.85,
  maxImagePx: 1600,
  afterConclusion: AFTER_CONCLUSION_NOTE, // texto fixo após a conclusão (editável em Configurações)
  impressionAsList: true,                 // conclusão em lista de itens
};

/** Estrutura do modelo: título, sexo a que se aplica ('' = todos) e medidas pré-definidas (nome + unidade). */
const sec = (x) => {
  const s = typeof x === 'string' ? { id: uid(), title: x, sex: '', measures: [] } : { id: uid(), sex: '', measures: [], ...x };
  if (!s.builder && USG_BUILDERS[s.title] && s.useCatalog !== false) s.builder = JSON.parse(JSON.stringify(USG_BUILDERS[s.title]));
  return s;
};
const M = (label, unit = 'cm') => ({ label, unit });

const usg = (id, name, sections, extra = {}) => ({
  id, builtin: true, modality: 'usg', name: `${name} (modelo inicial)`,
  docTitle: 'Relatório Ultrassonográfico', intro: '',
  conclusionTitle: 'Impressão Diagnóstica', notesTitle: 'Observações e recomendações',
  signature: true, imagesPerRow: 4, sections: sections.map(sec), ...extra, version: 7,
});

/**
 * Modelos iniciais. São apenas listas de estruturas para começar: NÃO são protocolos clínicos nem
 * foram validados. A veterinária deve duplicar e ajustar cada um à sua rotina (Meus modelos).
 */
export function defaultTemplates() {
  return [
    usg('tpl-usg-abdominal', 'Ultrassonografia abdominal completa', [
      { title: 'Vesícula urinária', measures: [M('Espessura da parede')] },
      { title: 'Rins', measures: [M('Rim esquerdo – comprimento'), M('Rim direito – comprimento')] },
      'Fígado',
      { title: 'Vesícula biliar', measures: [M('Volume', 'ml')] },
      'Baço',
      { title: 'Estômago', measures: [M('Espessura da parede')] },
      { title: 'Alças intestinais', measures: [M('Duodeno – espessura da parede'), M('Jejuno – espessura da parede'), M('Cólon ascendente – espessura da parede'),
        M('Cólon transverso – espessura da parede'), M('Cólon descendente – espessura da parede')] },
      { title: 'Pâncreas', measures: [M('Lobo pancreático direito')] },
      { title: 'Adrenais', measures: [M('Adrenal esquerda – altura do pólo cranial'), M('Adrenal esquerda – altura do pólo caudal'), M('Adrenal esquerda – comprimento'),
        M('Adrenal direita – altura do pólo cranial'), M('Adrenal direita – altura do pólo caudal'), M('Adrenal direita – comprimento')] },
      { title: 'Próstata', sex: 'male', measures: [M('Comprimento'), M('Altura'), M('Largura')] },
      { title: 'Testículos', sex: 'male' },
      { title: 'Útero', sex: 'female', measures: [M('Corpo uterino'), M('Corno uterino esquerdo'), M('Corno uterino direito')] },
      { title: 'Ovários', sex: 'female', measures: [M('Ovário esquerdo'), M('Ovário direito')] },
      { title: 'Tecido mamário', sex: 'female' }, 'Linfonodos', 'Líquido livre peritoneal', 'Outros achados',
    ], { docTitle: 'Relatório Ultrassonográfico Abdominal' }),
    usg('tpl-usg-direcionada', 'Ultrassonografia abdominal direcionada / exame focal', ['Região ou estrutura de interesse', 'Estruturas adjacentes avaliadas', 'Líquido livre (se pesquisado)', 'Outras observações'], { docTitle: 'Relatório Ultrassonográfico Abdominal Direcionado' }),
    usg('tpl-usg-urinario', 'Avaliação do trato urinário', ['Rim direito', 'Rim esquerdo', 'Ureteres', 'Bexiga urinária', 'Uretra (se avaliada)'], { docTitle: 'Relatório Ultrassonográfico do Trato Urinário' }),
    usg('tpl-usg-hepatobiliar', 'Avaliação hepatobiliar', ['Fígado', 'Vesícula biliar', 'Vias biliares', 'Vasos hepáticos e portais avaliados'], { docTitle: 'Relatório Ultrassonográfico Hepatobiliar' }),
    usg('tpl-usg-gastro', 'Avaliação gastrointestinal', ['Estômago', 'Duodeno', 'Jejuno', 'Íleo', 'Cólon', 'Linfonodos regionais'], { docTitle: 'Relatório Ultrassonográfico Gastrointestinal' }),
    usg('tpl-usg-reprodutivo', 'Avaliação reprodutiva e gestacional', ['Útero', 'Ovários', 'Próstata', 'Testículos', 'Conteúdo gestacional (se aplicável)'], { docTitle: 'Relatório Ultrassonográfico Reprodutivo' }),
    usg('tpl-usg-superficial', 'Estruturas superficiais e tecidos moles', ['Região examinada', 'Lesão ou estrutura de interesse', 'Linfonodos regionais'], { docTitle: 'Relatório Ultrassonográfico de Estruturas Superficiais' }),
    usg('tpl-usg-musculo', 'Avaliação musculoesquelética', ['Estrutura avaliada (músculo, tendão ou articulação)', 'Estruturas adjacentes'], { docTitle: 'Relatório Ultrassonográfico Musculoesquelético' }),
    {
      id: 'tpl-rx-geral', builtin: true, modality: 'rx', name: 'Radiografia (modelo inicial editável)',
      docTitle: 'Relatório Radiográfico', intro: '',
      conclusionTitle: 'Impressão Diagnóstica', notesTitle: 'Observações complementares',
      signature: true, imagesPerRow: 3, version: 7,
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
  const byId = new Map(all.map((t) => [t.id, t]));
  for (const t of defaultTemplates()) {
    const cur = byId.get(t.id);
    // Modelos iniciais são sempre atualizados para a versão atual (não são editáveis: duplique para personalizar).
    if (!cur || (cur.builtin && cur.version !== t.version)) {
      await dbPut('templates', t);
      all = all.filter((x) => x.id !== t.id); all.push(t);
    }
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
    signature: true, imagesPerRow: 2, sections: [sec('Nova estrutura')], version: 1,
  };
}

export function cloneTemplate(t) {
  return { ...JSON.parse(JSON.stringify(t)), id: uid(), builtin: false, name: `${t.name} (cópia)`,
    sections: t.sections.map((s) => ({ ...s, id: uid() })) };
}
