// Catálogo inicial de ultrassonografia abdominal: frases extraídas dos laudos da própria veterinária,
// organizadas por órgão. É um ponto de partida editável (Meus modelos → duplicar). Nada é escolhido
// pelo sistema: cada opção só entra no laudo quando ela marca.
// Convenções: {?Medida} = medida opcional; {Campo} = obrigatório; {Medida:valor} = só o número.

const o = (text, label) => (label ? { text, label } : { text });
const X = (text) => ({ text, excl: true }); // exclusiva: substitui as outras opções do bloco
const g = (label, kind, options) => ({ label, kind, options });
const OBS = 'Obs: Alimento e gás podem formar artefato de imagem impedindo a visibilização de todo conteúdo gástrico e intestinal, em caso de suspeita de corpo estranho é necessário acompanhamento do paciente com preparo prévio adequado (jejum e uso de antifisético)';
const PAREDE_ID = 'Parede normoecogênica, com preservação da estratificação em camadas, contorno regular e espessura';

export const USG_BUILDERS = {
  'Vesícula urinária': { blocks: [{ last: ',', groups: [
    g('Repleção', 'one', [o('com repleção líquida adequada', 'repleção adequada'), o('com repleção líquida diminuída', 'repleção diminuída')]),
    g('Conteúdo', 'one', [o('conteúdo anecogênico, aparentemente homogêneo', 'anecogênico, homogêneo'),
      o('conteúdo anecogênico, aparentemente heterogêneo, apresentando acentuada quantidade de imagens ecogênicas e hiperecogênicas em suspensão e material hiperecogênico depositado em parede dorsal e produtora de sombra acústica posterior suja', 'heterogêneo, com sedimento')]),
    g('Parede', 'sentence', [o('Parede normoecogênica, homogênea, regular e normoespessa ({?Espessura da parede})', 'normoespessa'), o('Parede normoecogênica, homogênea, regular e espessada ({?Espessura da parede})', 'espessada')]),
  ] }] },

  Rins: { blocks: [
    { groups: [g('Posição', 'sentence', [o('tópicos e simétricos')])] },
    { labels: ['Rim esquerdo', 'Rim direito'], groups: [
      g('Dimensões', 'one', [o('com dimensões preservadas ({?Comprimento})', 'dimensões preservadas')]),
      g('Contornos', 'one', [o('contornos definidos e regulares')]),
      g('Corticomedular', 'one', [o('relação e definição corticomedular preservada', 'relação e definição preservadas'), o('relação corticomedular preservada, definição corticomedular diminuída', 'definição diminuída')]),
      g('Ecogenicidade', 'one', [o('ecogenicidade mantida'), o('ecogenicidade mantida predominantemente, exceto pelo aumento da ecogenicidade da junção corticomedular', 'mantida, exceto junção'), o('ecogenicidade aumentada sobre a cortical', 'aumentada sobre a cortical')]),
      g('Ecotextura', 'one', [o('ecotextura homogênea'), o('ecotextura grosseira')]),
      g('Achados adicionais', 'sentences', [o('Presença de fino halo ecogênico em medular interna (sinal de medular)', 'halo em medular interna'),
        o('Presença de discretos pontos hiperecogênicos em região de recessos pélvicos', 'pontos hiperecogênicos'), o('Presença de área ecogênica em medular interna', 'área ecogênica')]),
      g('Pelve', 'sentence', [o('Pelve normodilatada')]),
    ] },
    { groups: [g('Ureteres', 'sentence', [o('Ureteres sem alterações sonográficas visíveis em topografia')])] },
  ] },

  Fígado: { blocks: [{ groups: [
    g('Topografia', 'one', [o('em topografia habitual')]),
    g('Dimensões', 'one', [o('com dimensões preservadas', 'preservadas'), o('com dimensões discretamente aumentadas', 'discretamente aumentadas')]),
    g('Bordas', 'one', [o('bordas afiladas'), o('bordas arredondadas')]),
    g('Contorno', 'one', [o('contorno regular')]),
    g('Parênquima', 'one', [o('parênquima normoecogênico'), o('parênquima discretamente hipoecogênico')]),
    g('Ecotextura', 'one', [o('ecotextura homogênea')]),
    g('Vasos', 'sentence', [o('Vasos com calibre e trajetos preservados')]),
  ] }] },

  'Vesícula biliar': { blocks: [{ groups: [
    g('Repleção e conteúdo', 'one', [
      o('com repleção adequada por conteúdo anecogênico, aparentemente homogêneo', 'repleção adequada'),
      o('com moderada repleção por conteúdo anecogênico, aparentemente homogêneo', 'moderada repleção'),
      o('com repleção habitual ({Volume}) por conteúdo anecogênico, aparentemente homogêneo', 'repleção habitual com volume'),
      o('com repleção adequada por conteúdo anecogênico, apresentando discreta a moderada quantidade de material ecogênico parcialmente gravidade dependente (depositado) e parcialmente gravidade não dependente (em suspensão), ocupando cerca de {Ocupação do lúmen} do lúmen', 'material ecogênico (discreta a moderada)'),
      o('com moderada repleção por conteúdo anecogênico, apresentando acentuada quantidade de conteúdo ecogênico, heterogêneo, ocupando {Ocupação do lúmen} do lúmen parcialmente gravidade dependente (depositado em fundo), parcialmente em suspensão e discretamente aderida a parede', 'conteúdo ecogênico (acentuada)')]),
    g('Parede', 'sentence', [o('Parede ecogênica, regular, sem alterações')]),
    g('Vias biliares', 'sentence', [o('Vias biliares não dilatadas no momento do exame')]),
    g('Lama biliar', 'sentence', [o('Lama biliar grau {Grau}')]),
  ] }] },

  Baço: { blocks: [{ groups: [
    g('Topografia', 'one', [o('em topografia habitual')]),
    g('Dimensões', 'one', [o('com dimensões preservadas', 'preservadas'), o('com dimensões moderadamente aumentadas', 'moderadamente aumentadas')]),
    g('Bordos', 'one', [o('bordos afilados'), o('bordos arredondados')]),
    g('Contorno', 'one', [o('contorno regular')]),
    g('Parênquima', 'one', [o('parênquima normoecogênico')]),
    g('Ecotextura', 'one', [o('ecotextura homogênea')]),
    g('Vasos', 'sentence', [o('Vasos com calibre e trajeto preservados')]),
  ] }] },

  Estômago: { blocks: [{ groups: [
    g('Conteúdo', 'one', [o('com moderada quantidade de conteúdo alimentar e gasoso', 'alimentar e gasoso'), o('com moderada quantidade de conteúdo gasoso', 'gasoso (moderada)'), o('com discreta a moderada quantidade de conteúdo gasoso', 'gasoso (discreta a moderada)')]),
    g('Parede', 'sentence', [o('Parede normoecogênica, com preservação da estratificação em camadas, contorno regular e espessura habitual ({?Espessura da parede})', 'espessura habitual'),
      o('Parede normoecogênica, com preservação da estratificação em camadas, contorno regular e espessura habitual predominantemente, exceto por região próximo ao cárdia com espessura discretamente aumentada ({Espessura próximo ao cárdia})', 'aumentada próximo ao cárdia')]),
    g('Peristaltismo e piloro', 'sentence', [o('Peristaltismo preservado. Piloro íntegro e sem sinais de obstrução')]),
    g('Observação', 'sentences', [o(OBS, 'Obs: alimento e gás')]),
  ] }] },

  'Alças intestinais': { blocks: [
    { labels: ['Intestino delgado'], groups: [
      g('Conteúdo', 'one', [o('com moderada quantidade de conteúdo mucoso e gasoso')]),
      g('Parede', 'sentence', [
        o(`${PAREDE_ID} preservada ({?Duodeno – espessura da parede} – duodeno; {?Jejuno – espessura da parede} – jejuno)`, 'espessura preservada'),
        o(`${PAREDE_ID} discretamente aumentada ({?Duodeno – espessura da parede} – duodeno; {?Jejuno – espessura da parede} – jejuno)`, 'espessura discretamente aumentada'),
        o('Parede normoecogênica, com preservação da estratificação em camadas predominantemente, exceto por segmentos jejunais com discreto espessamento da submucosa, contorno regular e espessura preservada ({?Duodeno – espessura da parede} – duodeno; {?Jejuno – espessura da parede} – jejuno)', 'espessamento da submucosa (jejuno)')]),
      g('Peristaltismo', 'sentence', [o('Peristaltismo preservado')]),
    ] },
    { labels: ['Cólon'], groups: [
      g('Conteúdo', 'one', [o('com moderada quantidade de conteúdo fecal', 'fecal (moderada)'), o('com moderada quantidade de conteúdo pastoso', 'pastoso (moderada)'), o('com discreta quantidade de conteúdo fecal pastoso e gasoso', 'fecal pastoso e gasoso (discreta)')]),
      g('Parede', 'sentence', [
        o('Parede normoecogênica, com preservação da estratificação em camadas, contorno regular e espessura habitual ({?Cólon descendente – espessura da parede} – cólon descendente; {?Cólon ascendente – espessura da parede} – cólon ascendente; {?Cólon transverso – espessura da parede} – cólon transverso)', 'espessura habitual'),
        o('Parede normoecogênica, com preservação da estratificação em camadas, contorno regular e espessura discretamente aumentada ({?Cólon descendente – espessura da parede} – cólon descendente; {?Cólon ascendente – espessura da parede} – cólon ascendente; {?Cólon transverso – espessura da parede} – cólon transverso)', 'espessura discretamente aumentada')]),
    ] },
    { groups: [g('Observação', 'sentences', [o(OBS, 'Obs: alimento e gás')])] },
  ] },

  Pâncreas: { blocks: [{ groups: [
    g('Dimensões', 'one', [o('com dimensões preservadas', 'preservadas'), o('com dimensões preservadas, medindo {Lobo pancreático direito} (lobo pancreático direito)', 'preservadas, com medida do lobo direito')]),
    g('Contorno', 'one', [o('contorno regular')]),
    g('Ecogenicidade', 'one', [o('ecogenicidade habitual')]),
    g('Ecotextura', 'one', [o('ecotextura homogênea')]),
  ] }] },

  Adrenais: { blocks: [
    { groups: [g('Topografia', 'sentence', [o('localizadas em topografia habitual'), X('não caracterizadas no momento do exame')])] },
    { labels: ['Adrenal esquerda', 'Adrenal direita'], groups: [
      g('Dimensões', 'one', [o('com dimensões preservadas ({?Altura do pólo cranial:valor} x {?Altura do pólo caudal:valor} x {?Comprimento} – altura pólo cranial x altura pólo caudal x comprimento)', 'dimensões preservadas'),
        X('não caracterizada (encoberta por alças intestinais no momento do exame)')]),
      g('Formato', 'one', [o('formato preservado')]),
      g('Contorno', 'one', [o('contorno regular')]),
      g('Parênquima', 'one', [o('parênquima normoecogênico')]),
      g('Ecotextura', 'one', [o('ecotextura homogênea')]),
    ] },
  ] },

  Próstata: { blocks: [{ last: ',', groups: [
    g('Tamanho', 'one', [o('com tamanho normal ({?Comprimento:valor} x {?Altura:valor} x {?Largura} – comprimento x altura x largura)', 'tamanho normal (3 medidas)'),
      o('com tamanho normal ({?Comprimento:valor} x {?Altura} – comprimento x altura)', 'tamanho normal (2 medidas)')]),
    g('Contorno', 'one', [o('contorno regular')]),
    g('Ecotextura e ecogenicidade', 'one', [o('ecotextura e ecogenicidade habituais'), o('ecotextura e ecogenicidade habituais considerando o histórico de castração', 'habituais, considerando castração')]),
  ] }] },

  Testículos: { blocks: [{ groups: [
    g('Aspecto', 'sentence', [o('tópicos e simétricos, apresentando contorno regular, ecotextura e ecogenicidade habituais', 'tópicos, simétricos, habituais'), X('testículos ausentes')]),
  ] }] },

  Ovários: { blocks: [{ last: ',', groups: [
    g('Descrição', 'one', [o('tópicos, simétricos, formato arredondado, medindo aproximadamente {Ovário esquerdo} (OVE) e {Ovário direito} (OVD)', 'tópicos, simétricos, arredondados, com medidas')]),
    g('Contorno e ecogenicidade', 'one', [o('contorno regular, ecogenicidade mantida e ecotextura homogênea')]),
  ] }] },

  Linfonodos: { blocks: [{ groups: [g('Avaliação', 'sentence', [o('Não foi evidenciada à ultrassonografia linfonodomegalia abdominal')])] }] },
  'Líquido livre peritoneal': { blocks: [{ groups: [g('Avaliação', 'sentence', [o('Ausência de líquido livre peritoneal')])] }] },
};

/** Impressões diagnósticas usadas nos laudos da veterinária (biblioteca de frases, para inserir com um toque). */
const REC = 'Sugere-se correlacionar com exames laboratoriais complementares, caso o clínico julgue necessário.';
export const USG_IMPRESSIONS = [
  ['Colite leve.', 'Alças intestinais'], ['Enterocolite leve.', 'Alças intestinais'], ['Enteropatia leve.', 'Alças intestinais'],
  ['Sutil gastropatia/gastrite.', 'Estômago'], ['Lama biliar grau {Grau}.', 'Vesícula biliar'],
  ['Discreta hepatomegalia.', 'Fígado'], ['Hepatopatia reacional/aguda leve.', 'Fígado'],
  ['Moderada esplenomegalia.', 'Baço'],
  ['Moderada esplenomegalia com formação nodular tendo como principais diagnósticos diferenciais processo proliferativo benigno/hematoma/processo neoplásico. Diagnóstico definitivo sujeito a análise cito/histopatológica.', 'Baço'],
  [`Nefropatia leve bilateral. ${REC}`, 'Rins'], [`Nefropatia bilateral. ${REC}`, 'Rins'], [`Discretas alterações renais sugestivas de nefropatia bilateral. ${REC}`, 'Rins'],
  ['Discretas microlitíases renais bilateralmente.', 'Rins'],
  ['Imagens em vesícula urinária sugerem cistite com acentuada quantidade de sedimento/celularidade/cristais.', 'Vesícula urinária'],
  ['Alterações em corpo uterino sugerem hemometra/piometra focal.', 'Útero'], ['Alterações em cornos uterinos podem estar relacionadas a fase do ciclo estral.', 'Útero'],
  ['Ovários com sugestivos folículos/cistos bilateralmente.', 'Ovários'], ['Hérnia umbilical.', 'Outros achados'],
];

export const AFTER_CONCLUSION_NOTE = 'A interpretação do resultado deste exame e a conclusão diagnóstica são atos médicos, estes dependem da análise conjunta dos dados clínicos e demais exames do paciente - Consulte o médico veterinário responsável';
