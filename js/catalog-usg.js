// Catálogo inicial de ultrassonografia abdominal: frases extraídas dos laudos da própria veterinária,
// organizadas por órgão. É um ponto de partida editável (Meus modelos → duplicar). Nada é escolhido
// pelo sistema: cada opção só entra no laudo quando ela marca.
// Convenções: {?Medida} = medida opcional; {Campo} = obrigatório; {Medida:valor} = só o número.

const o = (text, label) => (label ? { text, label } : { text });
const N = (opt) => ({ ...opt, n: true }); // faz parte do "texto padrão sem alterações" do órgão (botão do editor)
const X = (text) => ({ text, excl: true }); // exclusiva: substitui as outras opções do bloco
const CS = (text, solo, label) => ({ text, solo, ...(label ? { label } : {}), glue: true }); // cola na anterior; sem anterior, usa `solo`
const C = (text, label) => ({ text, ...(label ? { label } : {}), glue: true }); // cola na anterior só com espaço (sem vírgula)
const g = (label, kind, options) => ({ label, kind, options });
const OBS = '__Obs: Alimento e gás podem formar artefato de imagem impedindo a visibilização de todo conteúdo gástrico e intestinal, em caso de suspeita de corpo estranho é necessário acompanhamento do paciente com preparo prévio adequado (jejum e uso de antifisético)__';
const PAREDE_ID = 'Parede normoecogênica, com preservação da estratificação em camadas, contorno regular e espessura';

export const USG_BUILDERS = {
  'Vesícula urinária': { blocks: [{ last: ',', groups: [
    g('Repleção', 'one', [o('com repleção líquida adequada', 'repleção adequada'), o('com pouca repleção líquida', 'pouca repleção'), o('com repleção líquida diminuída', 'repleção diminuída')]),
    g('Conteúdo', 'one', [o('conteúdo anecogênico, aparentemente homogêneo', 'anecogênico, homogêneo'),
      o('conteúdo anecogênico, aparentemente heterogêneo, apresentando acentuada quantidade de imagens ecogênicas e hiperecogênicas em suspensão e material hiperecogênico depositado em parede dorsal e produtora de sombra acústica posterior suja', 'heterogêneo, com sedimento')]),
    g('Parede', 'sentence', [o('Parede normoecogênica, homogênea, regular e normoespessa ({?Espessura da parede})', 'normoespessa'), o('Parede normoecogênica, homogênea, regular e espessada ({?Espessura da parede})', 'espessada')]),
  ] }] },

  Rins: { blocks: [
    { groups: [g('Posição', 'sentence', [N(o('tópicos e simétricos'))])] },
    { labels: ['Rim esquerdo', 'Rim direito'], groups: [
      g('Dimensões', 'one', [N(o('com dimensões preservadas ({?Comprimento})', 'dimensões preservadas')), o('com dimensões diminuídas ({?Comprimento})', 'dimensões diminuídas'), o('com dimensões aumentadas ({?Comprimento})', 'dimensões aumentadas')]),
      g('Definição do contorno', 'one', [N(o('contornos definidos', 'definidos')), o('contornos indefinidos', 'indefinidos')]),
      g('Regularidade do contorno', 'one', [N(CS('e regulares', 'contornos regulares', 'regulares')), CS('e irregulares', 'contornos irregulares', 'irregulares')]),
      g('Corticomedular', 'one', [N(o('relação e definição corticomedular preservada', 'relação e definição preservadas')), o('relação corticomedular preservada, definição corticomedular diminuída', 'definição diminuída')]),
      g('Ecogenicidade', 'one', [N(o('ecogenicidade mantida')), o('ecogenicidade mantida predominantemente, exceto pelo aumento da ecogenicidade da junção corticomedular', 'mantida, exceto junção'),
        o('ecogenicidade mantida predominantemente, exceto pelo aumento da ecogenicidade da junção corticomedular e fino halo ecogênico em medular interna (sinal de medular)', 'mantida, exceto junção e halo'),
        o('ecogenicidade aumentada sobre a cortical', 'aumentada sobre a cortical'), o('ecogenicidade aumentada difusamente', 'aumentada difusamente')]),
      g('Ecotextura', 'one', [N(o('ecotextura homogênea')), o('ecotextura grosseira')]),
      g('Achados adicionais', 'sentences', [o('Presença de fino halo ecogênico em medular interna (sinal de medular)', 'halo em medular interna'),
        o('Presença de discretos pontos hiperecogênicos em região de recessos pélvicos', 'pontos hiperecogênicos'), o('Presença de área ecogênica em medular interna', 'área ecogênica')]),
      g('Pelve', 'sentence', [N(o('Pelve normodilatada')), o('Pelve discretamente dilatada ({?Pelve})', 'discretamente dilatada'), o('Pelve moderadamente dilatada ({?Pelve})', 'moderadamente dilatada'), o('Pelve acentuadamente dilatada ({?Pelve})', 'acentuadamente dilatada')]),
    ] },
    { groups: [g('Ureteres', 'sentence', [N(o('**Ureteres** sem alterações sonográficas visíveis em topografia', 'Ureteres sem alterações'))])] },
  ] },

  Fígado: { blocks: [{ groups: [
    g('Topografia', 'one', [o('em topografia habitual')]),
    g('Dimensões', 'one', [o('com dimensões preservadas', 'preservadas'), o('com dimensões discretamente aumentadas', 'discretamente aumentadas'), o('com dimensões moderadamente aumentadas', 'moderadamente aumentadas'), o('com dimensões discretamente a moderadamente aumentadas', 'discreta a moderadamente aumentadas')]),
    g('Bordas', 'one', [o('bordas afiladas'), o('bordas arredondadas')]),
    g('Contorno', 'one', [o('contorno regular'), o('contorno irregular')]),
    g('Parênquima', 'one', [o('parênquima normoecogênico'), o('parênquima discretamente hipoecogênico'), o('parênquima discretamente hiperecogênico')]),
    g('Ecotextura', 'one', [o('ecotextura homogênea'), o('ecotextura grosseira')]),
    g('Vasos', 'sentence', [o('Vasos com calibre e trajetos preservados')]),
  ] }] },

  'Vesícula biliar': { blocks: [{ last: ',', groups: [
    g('Repleção', 'one', [
      o('com repleção adequada', 'repleção adequada'), o('com moderada repleção', 'moderada repleção'),
      o('com repleção habitual ({?Volume})', 'repleção habitual'), o('com repleção discretamente aumentada ({?Volume})', 'discretamente aumentada'),
      o('com repleção levemente aumentada, com volume de {Volume} (considerar paciente em jejum)', 'levemente aumentada (jejum)'),
      o('com repleção habitual a levemente aumentada ({?Volume})', 'habitual a levemente aumentada')]),
    g('Conteúdo', 'one', [C('por conteúdo anecogênico, aparentemente homogêneo', 'anecogênico, homogêneo'), C('por conteúdo anecogênico', 'anecogênico')]),
    g('Material ecogênico', 'one', [
      o('apresentando discreta a moderada quantidade de material ecogênico parcialmente gravidade dependente (depositado) e parcialmente gravidade não dependente (em suspensão), ocupando cerca de {Ocupação do lúmen} do lúmen', 'discreta a moderada quantidade'),
      o('apresentando acentuada quantidade de conteúdo ecogênico, heterogêneo, ocupando {Ocupação do lúmen} do lúmen parcialmente gravidade dependente (depositado em fundo), parcialmente em suspensão e discretamente aderida a parede', 'acentuada quantidade, aderida'),
      o('apresentando até 25% de material ecogênico não gravidade dependente (em suspensão)', 'até 25%, em suspensão'),
      o('apresentando cerca de até 25% de material ecogênico homogêneo e dependente de gravidade', 'até 25%, dependente de gravidade'),
      o('apresentando cerca de 25 a 50% de material ecogênico gravidade dependente e pelo menos duas imagens arredondadas, hiperecogênicas, medindo {Medidas das imagens}, depositadas em colo vesical', '25 a 50% e imagens em colo vesical')]),
    g('Parede', 'sentence', [o('Parede ecogênica, regular, sem alterações')]),
    g('Vias biliares', 'sentence', [o('Vias biliares não dilatadas no momento do exame')]),
    g('Lama biliar', 'sentence', [o('Lama biliar grau {Grau}')]),
  ] }] },

  Baço: { blocks: [{ groups: [
    g('Topografia', 'one', [o('em topografia habitual'), o('deslocado para o lado direito, se sobrepondo ao fígado', 'deslocado para a direita')]),
    g('Dimensões', 'one', [o('com dimensões preservadas', 'preservadas'), o('com dimensões moderadamente aumentadas', 'moderadamente aumentadas'),
      o('com dimensões moderadamente aumentadas, medindo {Espessura em corpo esplênico} de espessura em corpo esplênico', 'moderadamente aumentadas, com espessura')]),
    g('Bordos', 'one', [o('bordos afilados'), o('bordos arredondados')]),
    g('Contorno', 'one', [o('contorno regular'), o('contorno irregular')]),
    g('Parênquima', 'one', [o('parênquima normoecogênico')]),
    g('Ecotextura', 'one', [o('ecotextura homogênea'),
      o('ecotextura homogênea predominantemente, exceto por formação nodular de contornos definidos, discretamente irregulares, hipoecogênica, heterogênea, medindo {Medidas da formação}, localizada em cauda esplênica e alterando a superfície capsular', 'homogênea, exceto formação nodular (cauda)'),
      o('ecotextura homogênea, exceto por imagem nodular de contornos moderadamente definidos, discretamente irregulares, de ecogenicidade mista, heterogênea, discretamente responsiva ao Doppler colorido, medindo {Medidas da imagem nodular}, localizada em corpo esplênico', 'homogênea, exceto imagem nodular (corpo)'),
      o('ecotextura homogênea, exceto pela presença de imagens tendendo a nodulares, hiperecogênicas, medindo entre {Medidas das imagens}, localizadas em região hilar/corpo, face visceral, de contornos definidos, margens regulares e ecotextura homogênea', 'homogênea, exceto imagens hiperecogênicas')]),
    g('Vasos', 'sentence', [o('Vasos com calibre e trajeto preservados')]),
  ] }] },

  Estômago: { blocks: [{ groups: [
    g('Conteúdo', 'one', [o('com moderada quantidade de conteúdo alimentar e gasoso', 'alimentar e gasoso'), o('com discreta quantidade de conteúdo gasoso', 'gasoso (discreta)'), o('com moderada quantidade de conteúdo gasoso', 'gasoso (moderada)'),
      o('com discreta a moderada quantidade de conteúdo gasoso', 'gasoso (discreta a moderada)'), o('com grande quantidade de conteúdo gasoso', 'gasoso (grande)')]),
    g('Parede', 'sentence', [o('Parede normoecogênica, com preservação da estratificação em camadas, contorno regular e espessura habitual ({?Espessura da parede})', 'espessura habitual'),
      o('Parede normoecogênica, com preservação da estratificação em camadas, contorno regular e espessura habitual predominantemente, exceto por região próximo ao cárdia com espessura discretamente aumentada ({Espessura próximo ao cárdia})', 'aumentada próximo ao cárdia')]),
    g('Peristaltismo e piloro', 'sentence', [o('Peristaltismo preservado. Piloro íntegro e sem sinais de obstrução', 'peristaltismo preservado'), o('Peristaltismo diminuído. Piloro íntegro e sem sinais de obstrução', 'peristaltismo diminuído')]),
    g('Observação', 'sentences', [o(OBS, 'Obs: alimento e gás')]),
  ] }] },

  'Alças intestinais': { blocks: [
    { labels: ['Intestino delgado'], groups: [
      g('Conteúdo', 'one', [o('com moderada quantidade de conteúdo mucoso e gasoso', 'mucoso e gasoso'), o('com moderada quantidade de conteúdo mucoso e grande quantidade de conteúdo gasoso', 'mucoso e muito gasoso')]),
      g('Parede', 'sentence', [
        o(`${PAREDE_ID} preservada ({?Duodeno – espessura da parede} – duodeno; {?Jejuno – espessura da parede} – jejuno)`, 'espessura preservada'),
        o(`${PAREDE_ID} discretamente aumentada ({?Duodeno – espessura da parede} – duodeno; {?Jejuno – espessura da parede} – jejuno)`, 'espessura discretamente aumentada'),
        o(`${PAREDE_ID} discretamente a moderadamente aumentada ({?Duodeno – espessura da parede} – duodeno; {?Jejuno – espessura da parede} – jejuno)`, 'espessura discreta a moderadamente aumentada'),
        o('Parede normoecogênica, com preservação da estratificação em camadas predominantemente, exceto por segmentos jejunais com discreto espessamento da submucosa, contorno regular e espessura preservada ({?Duodeno – espessura da parede} – duodeno; {?Jejuno – espessura da parede} – jejuno)', 'espessamento da submucosa (jejuno)')]),
      g('Peristaltismo', 'sentence', [o('Peristaltismo preservado')]),
    ] },
    { labels: ['Cólon'], groups: [
      g('Conteúdo', 'one', [o('com moderada quantidade de conteúdo fecal', 'fecal (moderada)'), o('com moderada quantidade de conteúdo pastoso', 'pastoso (moderada)'), o('com discreta quantidade de conteúdo fecal pastoso e gasoso', 'fecal pastoso e gasoso (discreta)'), o('com discreto conteúdo líquido', 'líquido (discreto)')]),
      g('Parede', 'sentence', [
        o('Parede normoecogênica, com preservação da estratificação em camadas, contorno regular e espessura habitual ({?Cólon descendente – espessura da parede} – cólon descendente; {?Cólon ascendente – espessura da parede} – cólon ascendente; {?Cólon transverso – espessura da parede} – cólon transverso)', 'espessura habitual'),
        o('Parede normoecogênica, com preservação da estratificação em camadas, contorno regular e espessura discretamente aumentada ({?Cólon descendente – espessura da parede} – cólon descendente; {?Cólon ascendente – espessura da parede} – cólon ascendente; {?Cólon transverso – espessura da parede} – cólon transverso)', 'espessura discretamente aumentada'),
        o('Parede normoecogênica, com preservação da estratificação em camadas, contorno regular e espessura preservada ({?Cólon descendente – espessura da parede} – cólon descendente; {?Cólon ascendente – espessura da parede} – cólon ascendente; {?Cólon transverso – espessura da parede} – cólon transverso)', 'espessura preservada')]),
    ] },
    { groups: [g('Observação', 'sentences', [o(OBS, 'Obs: alimento e gás')])] },
  ] },

  Pâncreas: { blocks: [{ groups: [
    g('Dimensões', 'one', [o('com dimensões preservadas', 'preservadas'), o('com dimensões preservadas, medindo {Lobo pancreático direito} (lobo pancreático direito)', 'preservadas, com medida do lobo direito')]),
    g('Contorno', 'one', [o('contorno regular'), o('contorno irregular')]),
    g('Ecogenicidade', 'one', [o('ecogenicidade habitual')]),
    g('Ecotextura', 'one', [o('ecotextura homogênea')]),
  ] }] },

  Adrenais: { blocks: [
    { groups: [g('Topografia', 'sentence', [o('localizadas em topografia habitual'), X('não caracterizadas no momento do exame')])] },
    { labels: ['Adrenal esquerda', 'Adrenal direita'], groups: [
      g('Dimensões', 'one', [o('com dimensões preservadas ({?Altura do pólo cranial:valor} x {?Altura do pólo caudal:valor} x {?Comprimento} – altura pólo cranial x altura pólo caudal x comprimento)', 'dimensões preservadas'),
        X('não caracterizada (encoberta por alças intestinais no momento do exame)')]),
      g('Formato', 'one', [o('formato preservado')]),
      g('Contorno', 'one', [o('contorno regular'), o('contorno irregular')]),
      g('Parênquima', 'one', [o('parênquima normoecogênico')]),
      g('Ecotextura', 'one', [o('ecotextura homogênea')]),
    ] },
  ] },

  Próstata: { blocks: [{ last: ',', groups: [
    g('Tamanho', 'one', [o('com tamanho normal ({?Comprimento:valor} x {?Altura:valor} x {?Largura} – comprimento x altura x largura)', 'tamanho normal (3 medidas)'),
      o('com tamanho normal ({?Comprimento:valor} x {?Altura} – comprimento x altura)', 'tamanho normal (2 medidas)')]),
    g('Contorno', 'one', [o('contorno regular'), o('contorno irregular')]),
    g('Ecotextura e ecogenicidade', 'one', [o('ecotextura e ecogenicidade habituais'), o('ecotextura e ecogenicidade habituais considerando o histórico de castração', 'habituais, considerando castração')]),
  ] }] },

  Testículos: { blocks: [
    { groups: [g('Aspecto', 'sentence', [o('tópicos e simétricos, apresentando contorno regular, ecotextura e ecogenicidade habituais', 'tópicos, simétricos, habituais'), X('testículos ausentes')])] },
    { labels: ['Testículo esquerdo', 'Testículo direito'], last: ',', groups: [
      g('Localização', 'one', [o('localizado em bolsa escrotal', 'em bolsa escrotal'), o('localizado em subcutâneo de região inguinal direita', 'subcutâneo inguinal direito')]),
      g('Medida', 'one', [o('medindo aprox. {Medidas do testículo}', 'com medidas')]),
      g('Aspecto', 'one', [o('apresentando contorno regular, ecotextura e ecogenicidade habituais', 'habituais'),
        o('apresentando contorno regular, ecotextura homogênea, ecogenicidade diminuída e dimensões diminuídas em relação ao testículo contralateral', 'ecogenicidade e dimensões diminuídas')]),
    ] },
  ] },

  Útero: { blocks: [{ groups: [g('Descrição', 'sentences', [
    o('Útero e ovários não caracterizados (paciente com histórico de OSH)', 'não caracterizados (OSH)'),
    o('Coto uterino com diâmetro dentro da normalidade, medindo {Diâmetro do coto uterino}, contorno regular, ecotextura e ecogenicidade diminuída, exceto por extremidade em região cranial com área hiperecogênica e heterogênea, medindo {Medidas da área hiperecogênica} e ponto hiperecogênico formador de sombra acústica posterior em permeio (sugestivo fio de sutura)', 'coto uterino'),
    o('Pedículos ovarianos com área focal hiperecogênica e heterogênea, medindo aproximadamente {Medidas da área focal} e ponto hiperecogênico formador de sombra acústica posterior em permeio (sugestivo fio de sutura)', 'pedículos ovarianos'),
    o('Com diâmetro aumentado em corpo uterino e preservados nos cornos uterinos ({?Corpo uterino} – corpo; {?Corno uterino esquerdo} – corno esquerdo; {?Corno uterino direito} – corno direito), contorno regular, ecotextura homogênea e ecogenicidade diminuída difusamente; corpo uterino com paredes espessadas e presença de moderada quantidade de conteúdo líquido ecogênico rico em celularidade intraluminal; presença de discreta esteatite adjacente aos cornos e corpo uterino difusamente', 'diâmetro aumentado em corpo uterino'),
  ])] }] },

  Ovários: { blocks: [{ last: ',', groups: [
    g('Descrição', 'one', [o('tópicos, simétricos, formato arredondado, medindo aproximadamente {Ovário esquerdo} (OVE) e {Ovário direito} (OVD)', 'tópicos, simétricos, arredondados, com medidas')]),
    g('Contorno e ecogenicidade', 'one', [o('contorno regular, ecogenicidade mantida e ecotextura homogênea')]),
    g('Cistos', 'one', [o('exceto por imagens císticas, de conteúdo anecogênico, medindo entre {Medidas dos cistos}, bilateralmente', 'imagens císticas bilaterais')]),
  ] }] },

  'Tecido mamário': { blocks: [{ groups: [g('Avaliação', 'sentence', [o('Tecido mamário com discreto aumento de volume e ecogenicidade, além de ductos mamários apresentando discreta ectasia', 'discreto aumento e ectasia dos ductos')])] }] },
  Linfonodos: { blocks: [{ groups: [g('Avaliação', 'sentence', [o('Não foi evidenciada à ultrassonografia linfonodomegalia abdominal')])] }] },
  'Líquido livre peritoneal': { blocks: [{ groups: [g('Avaliação', 'sentence', [o('Ausência de líquido livre peritoneal')])] }] },
  'Outros achados': { blocks: [{ groups: [g('Achado', 'sentences', [o('Presença de descontinuidade da parede abdominal em região umbilical, medindo {Medida da descontinuidade}, tendo como conteúdo em subcutâneo omento/gordura. Houve redução do conteúdo no momento do exame', 'descontinuidade umbilical (hérnia)')])] }] },
};

/**
 * Opções acrescentadas depois do primeiro catálogo (laudos de outubro/2026). Sempre entram no FIM do grupo,
 * para não mudar a posição das opções antigas (exames salvos guardam a escolha pela posição).
 */
const addOptions = (organ, group, options, blockIndex) => {
  const blocks = USG_BUILDERS[organ].blocks.filter((_, i) => blockIndex === undefined || i === blockIndex);
  const g = blocks.flatMap((b) => b.groups).find((x) => x.label === group);
  if (!g) throw new Error(`Catálogo: grupo "${group}" não existe em ${organ}`);
  g.options.push(...options);
};
const addGroup = (organ, blockIndex, group) => USG_BUILDERS[organ].blocks[blockIndex].groups.push(group);
const DUODENO_JEJUNO = '({?Duodeno – espessura da parede} – duodeno; {?Jejuno – espessura da parede} – jejuno)';
const ESTRAT = 'Parede normoecogênica, com preservação da estratificação em camadas';

addOptions('Vesícula urinária', 'Parede', [o('Parede normoecogênica, homogênea, regular e normoespessada ({?Espessura da parede})', 'normoespessada')]);
addOptions('Rins', 'Regularidade do contorno', [CS('e levemente irregulares', 'contornos levemente irregulares', 'levemente irregulares')]);
addOptions('Rins', 'Corticomedular', [o('relação corticomedular preservada, definição corticomedular discretamente diminuída', 'definição discretamente diminuída')]);
addOptions('Rins', 'Ecogenicidade', [
  o('ecogenicidade mantida, exceto por halo hiperecogênico em medular interna (sinal de medular)', 'mantida, exceto halo hiperecogênico'),
  o('ecogenicidade mantida predominantemente, exceto pelo aumento da ecogenicidade da junção corticomedular, halo hiperecogênico em medular interna (sinal de medular)', 'mantida, exceto junção e halo hiperecogênico')]);
addOptions('Fígado', 'Parênquima', [o('parênquima discretamente a moderadamente hiperecogênico', 'discreta a moderadamente hiperecogênico')]);
addOptions('Fígado', 'Ecotextura', [o('ecotextura levemente grosseira')]);
addOptions('Fígado', 'Vasos', [o('Vasos com calibre discretamente a moderadamente aumentado e trajetos preservados', 'calibre discreta a moderadamente aumentado')]);
addOptions('Vesícula biliar', 'Material ecogênico', [
  o('apresentando moderada quantidade de material ecogênico, gravidade dependente, ocupando cerca de {Ocupação do lúmen} do lúmen', 'moderada quantidade, gravidade dependente'),
  o('apresentando moderada quantidade de material ecogênico, dependente de gravidade, ocupando cerca de {Ocupação do lúmen} do lúmen vesical', 'moderada quantidade, dependente de gravidade'),
  o('apresentando cerca de {Ocupação do lúmen} de material ecogênico e hiperecogênico gravidade dependente (depositado em fundo)', 'ecogênico e hiperecogênico, depositado em fundo'),
  o('apresentando mais de 75% de material ecogênico parcialmente gravidade dependente (depositado em fundo) e parcialmente não gravidade dependente (em suspensão)', 'mais de 75%, depositado e em suspensão'),
  o('apresentando até 25% de material ecogênico, gravidade dependente (depositada em fundo)', 'até 25%, depositada em fundo')]);
addOptions('Vesícula biliar', 'Parede', [o('Parede ecogênica, regular e normoespessada', 'regular e normoespessada'),
  o('Parede ecogênica, regular, sem alterações predominantemente, exceto por parede parcialmente discretamente irregular devido à presença de discretos pequenos cistos que se projetam para o lúmen', 'parcialmente irregular, pequenos cistos')]);
addGroup('Vesícula biliar', 0, g('Ducto cístico', 'sentence', [o('Ducto cístico discretamente a moderadamente dilatado, medindo {Ducto cístico} e com discreta a moderada quantidade de lama biliar intraluminal', 'discreta a moderadamente dilatado, com lama')]));
addOptions('Baço', 'Dimensões', [o('com dimensões discretamente aumentadas', 'discretamente aumentadas'),
  o('com dimensões discretamente aumentadas, medindo {Espessura em corpo esplênico} de espessura em região de corpo esplênico', 'discretamente aumentadas, com espessura')]);
addOptions('Estômago', 'Conteúdo', [o('vazio'), o('com discreta a moderada quantidade de conteúdo líquido e gasoso', 'líquido e gasoso (discreta a moderada)')]);
addOptions('Estômago', 'Parede', [o(`${ESTRAT}, contorno regular e espessura habitual limítrofe ({?Espessura da parede})`, 'espessura habitual limítrofe')]);
addOptions('Alças intestinais', 'Conteúdo', [o('com moderada quantidade de conteúdo mucoso e gasoso; segmentos jejunais com discreto conteúdo líquido', 'mucoso e gasoso, jejuno com conteúdo líquido')], 0);
addOptions('Alças intestinais', 'Parede', [
  o(`${ESTRAT} predominantemente, exceto por segmentos jejunais com evidência da submucosa, contorno regular e espessura preservada ${DUODENO_JEJUNO}`, 'evidência da submucosa (jejuno)'),
  o(`${ESTRAT}, contorno regular predominantemente, exceto por segmentos jejunais com contorno discretamente irregular e espessura preservada ${DUODENO_JEJUNO}`, 'contorno discretamente irregular (jejuno)'),
  o(`${ESTRAT} predominantemente, exceto por segmentos jejunais com discreto espessamento da muscular, contorno irregular e espessura preservada predominantemente, exceto por segmentos jejunais com espessura discretamente aumentada ${DUODENO_JEJUNO}`, 'espessamento da muscular, contorno irregular')], 0);
addOptions('Alças intestinais', 'Conteúdo', [o('vazio'), o('com discreta quantidade de conteúdo líquido', 'líquido (discreta)')], 1);
addOptions('Pâncreas', 'Dimensões', [o('com dimensões discretamente aumentadas, medindo {Lobo pancreático direito} (lobo pancreático direito)', 'discretamente aumentadas, com medida do lobo direito')]);
addOptions('Pâncreas', 'Ecogenicidade', [o('ecogenicidade aumentada')]);
addOptions('Pâncreas', 'Ecotextura', [o('ecotextura grosseira')]);
addOptions('Adrenais', 'Dimensões', [o('com dimensões preservadas em polo cranial e discretamente aumentadas em polo caudal ({?Altura do pólo cranial:valor} x {?Altura do pólo caudal:valor} x {?Comprimento} – altura pólo cranial x altura pólo caudal x comprimento)', 'preservadas em polo cranial, aumentadas em polo caudal')]);
addOptions('Adrenais', 'Formato', [o('formato abaulado em polo caudal')]);
addOptions('Próstata', 'Tamanho', [o('com dimensões aumentadas ({?Comprimento:valor} x {?Altura:valor} x {?Largura} – comprimento x altura x largura)', 'dimensões aumentadas')]);
addOptions('Próstata', 'Ecotextura e ecogenicidade', [o('ecotextura discretamente grosseira e ecogenicidade aumentada', 'ecotextura grosseira e ecogenicidade aumentada')]);
addGroup('Próstata', 0, g('Achados adicionais', 'sentence', [o('Presença de cisto simples medindo {Medida do cisto}', 'cisto simples')]));
addOptions('Testículos', 'Aspecto', [o('localizados em cavidade abdominal bilateralmente, apresentando contorno regular, ecotextura homogênea e ecogenicidade diminuída', 'abdominais bilateralmente, ecogenicidade diminuída')], 0);
addOptions('Testículos', 'Localização', [o('localizado em cavidade abdominal', 'em cavidade abdominal'),
  o('localizado em cavidade abdominal, cranial e lateral esquerda a vesícula urinária', 'abdominal, lateral esquerda à vesícula urinária'),
  o('localizado em região média lateral esquerda, entre rim esquerdo e bexiga', 'média lateral esquerda, entre rim e bexiga'),
  o('localizado em região média lateral direita, entre rim direito e bexiga', 'média lateral direita, entre rim e bexiga')]);
addOptions('Testículos', 'Medida', [o('medindo {Medidas do testículo}', 'medindo')]);
addOptions('Testículos', 'Aspecto', [o('apresentando contorno regular, ecotextura homogênea e ecogenicidade diminuída', 'ecogenicidade diminuída')], 1);
addOptions('Útero', 'Descrição', [o('Com diâmetro dentro da normalidade ({?Corpo uterino} – corpo; {?Corno uterino direito} – corno direito), contorno regular, ecotextura e ecogenicidade habituais', 'diâmetro dentro da normalidade')]);
addOptions('Ovários', 'Descrição', [o('tópicos, simétricos, formato arredondado, medindo aproximadamente {Medida dos ovários}', 'tópicos, simétricos, arredondados, uma medida')]);
addOptions('Ovários', 'Contorno e ecogenicidade', [o('contorno regular, ecogenicidade e ecotextura habituais', 'ecogenicidade e ecotextura habituais')]);
addOptions('Outros achados', 'Achado', [o('Presença de descontinuidade da parede abdominal em região inguinal direita, medindo {Medida da descontinuidade}, tendo como conteúdo em subcutâneo alças intestinais de jejuno, omento/gordura e discreto conteúdo líquido associado; houve discreta redução do conteúdo no momento do exame', 'descontinuidade inguinal direita (hérnia)')]);

// Lote 2 (outros 10 laudos de outubro/2026).
addOptions('Rins', 'Posição', [o('tópicos e assimétricos')]);
addOptions('Rins', 'Dimensões', [o('com dimensões levemente diminuídas ({?Comprimento})', 'dimensões levemente diminuídas'), o('com dimensões diminuídas ({?Comprimento})', 'dimensões diminuídas'),
  o('com dimensões preservadas, porém próximo ao limite superior ({?Comprimento})', 'preservadas, próximo ao limite superior')]);
addOptions('Rins', 'Definição do contorno', [o('contornos irregulares', 'irregulares (sem definição)')]);
addOptions('Rins', 'Regularidade do contorno', [CS('e discretamente irregulares', 'contornos discretamente irregulares', 'discretamente irregulares')]);
addOptions('Rins', 'Corticomedular', [o('perda da relação e definição corticomedular', 'perda da relação e definição'),
  o('alteração da relação corticomedular, definição corticomedular moderadamente diminuída', 'alteração da relação, definição moderadamente diminuída')]);
addOptions('Rins', 'Ecogenicidade', [o('ecogenicidade de cortical aumentada', 'cortical aumentada'), o('ecogenicidade discretamente aumentada difusamente', 'discretamente aumentada difusamente')]);
addOptions('Rins', 'Ecotextura', [o('ecotextura heterogênea')]);
addOptions('Rins', 'Achados adicionais', [o('Presença de cisto simples cortical, medindo {Medida do cisto}', 'cisto simples cortical'), o('Presença de cisto simples medular, medindo {Medida do cisto}', 'cisto simples medular'),
  o('Presença de pequenas estruturas arredondadas, hiperecogênicas, inseridas em recessos pélvicos e pelve renal, medindo até {Medida das estruturas}, produtoras de fraca sombra acústica posterior', 'estruturas hiperecogênicas em recessos pélvicos (sombra)'),
  o('Presença de discretas imagens arredondadas hiperecogênicas, medindo entre {Medidas das imagens}, localizadas em região de recessos pélvicos', 'imagens hiperecogênicas em recessos pélvicos')]);
addOptions('Fígado', 'Parênquima', [o('parênquima hiperecogênico')]);
addOptions('Fígado', 'Ecotextura', [o('ecotextura heterogênea'),
  o('ecotextura heterogênea, apresentando imagens nodulares de contornos moderadamente definidos, irregulares, hipoecogênicas e hiperecogênicas, discretamente heterogêneas, medindo entre {Medidas das imagens nodulares}, localizadas difusamente pelo parênquima, mais evidente em lobo lateral esquerdo', 'heterogênea, com imagens nodulares difusas')]);
addOptions('Fígado', 'Vasos', [o('Vasos com calibre discretamente aumentado e trajeto preservado', 'calibre discretamente aumentado')]);
addOptions('Vesícula urinária', 'Conteúdo', [o('conteúdo anecogênico, aparentemente heterogêneo, apresentando acentuada quantidade de imagens arredondadas, hiperecogênicas, produtoras de sombra acústica posterior, medindo entre {Medidas das imagens}, depositadas em parede dorsal e moderada quantidade de imagens ecogênicas e hiperecogênicas em suspensão', 'heterogêneo, imagens depositadas e em suspensão')]);
addOptions('Vesícula urinária', 'Parede', [o('Parede normoecogênica, homogênea, irregular e moderadamente espessada ({?Espessura da parede})', 'irregular e moderadamente espessada')]);
addOptions('Vesícula biliar', 'Repleção', [o('com repleção aumentada ({?Volume})', 'repleção aumentada'),
  X('parede fina e mucosa regular, repleta por conteúdo anecogênico (bile) e discreta quantidade de pontos hiperecogênicos em suspensão e depositados na região do colo. Não existem evidências de alterações em vias biliares intra ou extra hepáticas')]);
addOptions('Vesícula biliar', 'Conteúdo', [C('por conteúdo anecogênico, aparentemente heterogêneo', 'anecogênico, heterogêneo'),
  C('por conteúdo acentuadamente ecogênico e hiperecogênico, ocupando mais de {Ocupação do lúmen} do lúmen, gravidade dependente, heterogêneo, com pequenas imagens anecogênicas em permeio (fragmentos de muco)', 'acentuadamente ecogênico (fragmentos de muco)')]);
addOptions('Vesícula biliar', 'Material ecogênico', [
  o('apresentando menos de 25% de material ecogênico gravidade dependente (depositado em fundo) e discretas imagens puntiformes hiperecogênicas depositadas e aderida a parede, medindo entre {Medidas das imagens}', 'menos de 25% e imagens puntiformes aderidas'),
  o('apresentando discreta quantidade de material ecogênico gravidade dependente ocupando até 25% do lúmen e também localizado em ducto cístico', 'discreta quantidade, também em ducto cístico'),
  o('apresentando cerca de mais de 75% de material ecogênico, parcialmente gravidade dependente e parcialmente em suspensão, além de imagens puntiformes hiperecogênicas em permeio', 'mais de 75%, com imagens puntiformes')]);
addOptions('Vesícula biliar', 'Parede', [o('Parede ecogênica, discretamente irregular, discretamente espessada, medindo {Espessura da parede}', 'discretamente irregular e espessada')]);
addOptions('Vesícula biliar', 'Ducto cístico', [o('Ducto cístico discretamente dilatado ({Ducto cístico})', 'discretamente dilatado')]);
addOptions('Baço', 'Topografia', [X('não caracterizado (paciente com histórico de esplenectomia)')]);
addOptions('Baço', 'Dimensões', [o('com dimensões discretamente a moderadamente aumentadas, medindo {Espessura em corpo esplênico} de espessura em corpo esplênico', 'discreta a moderadamente aumentadas, com espessura')]);
addOptions('Baço', 'Ecotextura', [o('ecotextura homogênea; presença de imagens arredondadas, hiperecogênicas, homogêneas, medindo {Medidas das imagens}, localizadas adjacente aos vasos do hilo esplênico', 'homogênea, imagens adjacentes aos vasos do hilo')]);
addOptions('Estômago', 'Conteúdo', [o('com discreta a moderada quantidade de conteúdo líquido e gasoso; presença de duas estruturas de superfícies hiperecogênicas, produtoras de sombra acústica posterior, medindo entre {Medidas das estruturas} (comeu petisco/alimento antes do exame)', 'líquido e gasoso, estruturas hiperecogênicas (petisco)')]);
addOptions('Estômago', 'Parede', [
  o('Parede normoecogênica, com alteração da estratificação em camadas, pelo discreto espessamento da muscular e submucosa, contorno regular e espessura habitual ({?Espessura da parede})', 'discreto espessamento da muscular e submucosa'),
  o(`${ESTRAT}, contorno discretamente irregular e espessura discretamente aumentada ({?Espessura da parede})`, 'contorno discretamente irregular, espessura discretamente aumentada')]);
const DDI = '({?Duodeno – espessura da parede} – duodeno; {?Jejuno – espessura da parede} – jejuno; {?Íleo – espessura da parede} – íleo)';
addOptions('Alças intestinais', 'Parede', [
  o(`Parede normoecogênica, com alteração da estratificação em camadas, pelo espessamento da muscular, contorno irregular e espessura moderadamente aumentada ${DDI}`, 'espessamento da muscular, moderadamente aumentada'),
  o(`${ESTRAT}, contorno regular e espessura aumentada ${DUODENO_JEJUNO}`, 'espessura aumentada'),
  o(`${ESTRAT} predominantemente, exceto por segmentos jejunais com discreta evidência da submucosa, contorno regular e espessura preservada predominantemente, exceto por segmentos jejunais apresentando evidência das placas de Peyer ${DDI}`, 'evidência da submucosa e placas de Peyer')], 0);
addOptions('Alças intestinais', 'Parede', [o(`${ESTRAT}, contorno discretamente irregular e espessura aumentada ({?Cólon descendente – espessura da parede} – cólon descendente; {?Cólon transverso – espessura da parede} – cólon transverso; {?Cólon ascendente – espessura da parede} – cólon ascendente)`, 'contorno discretamente irregular, espessura aumentada')], 1);
addOptions('Pâncreas', 'Dimensões', [o('lobo pancreático esquerdo com dimensões preservadas, medindo {Lobo pancreático esquerdo}', 'lobo esquerdo, dimensões preservadas'),
  o('com dimensões preservadas a discretamente aumentadas, medindo {Lobo pancreático direito} (lobo pancreático direito)', 'preservadas a discretamente aumentadas')]);
addOptions('Pâncreas', 'Contorno', [o('contorno levemente irregular')]);
addOptions('Pâncreas', 'Ecogenicidade', [o('ecogenicidade mantida'), o('ecogenicidade levemente diminuída')]);
addGroup('Pâncreas', 0, g('Ducto pancreático', 'sentence', [o('Ducto pancreático discretamente dilatado ({?Ducto pancreático})', 'discretamente dilatado')]));
addOptions('Adrenais', 'Dimensões', [o('com dimensões aumentadas ({?Altura do pólo cranial:valor} x {?Altura do pólo caudal:valor} x {?Comprimento} – altura pólo cranial x altura pólo caudal x comprimento)', 'dimensões aumentadas')]);
addOptions('Adrenais', 'Formato', [o('formato arredondado')]);
addOptions('Adrenais', 'Contorno', [o('contorno levemente irregular')]);
addOptions('Adrenais', 'Ecotextura', [o('ecotextura heterogênea'), o('ecotextura discretamente heterogênea'), o('ecotextura grosseira')]);
addGroup('Adrenais', 1, g('Achado adicional', 'one', [o('presença de ponto hiperecogênico, medindo {Medida do ponto}', 'ponto hiperecogênico')]));
addOptions('Próstata', 'Tamanho', [X('não caracterizada (localização intrapélvica)')]);
addOptions('Próstata', 'Ecotextura e ecogenicidade', [o('ecotextura grosseira e ecogenicidade habitual considerando o histórico de castração', 'ecotextura grosseira, ecogenicidade habitual (castração)')]);
addOptions('Testículos', 'Aspecto', [o('simétricos, contornos regulares, linhas mediastinais bem definidas, ecogenicidade e ecotextura preservadas', 'simétricos, linhas mediastinais definidas')], 0);
addOptions('Linfonodos', 'Avaliação', [o('Linfonodos: discreto aumento de linfonodos cólicos/ileocecais medindo entre {Medidas dos linfonodos}, ecotextura homogênea e ecogenicidade discretamente diminuída. Mesentério adjacente com ecogenicidade levemente aumentada', 'discreto aumento de linfonodos cólicos/ileocecais')]);
addOptions('Outros achados', 'Achado', [o('Presença de discreto aumento da ecogenicidade dos tecidos mesentéricos difusamente', 'aumento da ecogenicidade mesentérica'),
  o('Presença de estrutura ovalada, hiperecogênica na periferia, medindo {Medidas da estrutura}, localizada em peritônio/mesentério, em abdômen cranial', 'estrutura ovalada em peritônio/mesentério')]);

// Lote 3 (mais 11 laudos de outubro/2026).
addOptions('Vesícula urinária', 'Conteúdo', [
  o('conteúdo anecogênico, aparentemente heterogêneo, apresentando moderada quantidade de material hiperecogênico depositado em parede dorsal e pontos ecogênicos/hiperecogênicos em suspensão', 'heterogêneo, material depositado e pontos em suspensão'),
  o('conteúdo anecogênico, aparentemente heterogêneo, apresentando moderada a acentuada quantidade de imagens ecogênicas e hiperecogênicas puntiformes em suspensão', 'heterogêneo, imagens puntiformes em suspensão')]);
addOptions('Rins', 'Corticomedular', [
  o('relação corticomedular preservada, definição corticomedular moderadamente diminuída', 'definição moderadamente diminuída'),
  o('relação corticomedular alterada, perda da definição corticomedular', 'relação alterada, perda da definição')]);
addOptions('Rins', 'Ecogenicidade', [o('ecogenicidade mantida, exceto por pontos hiperecogênicos em medular interna (mineralizações)', 'mantida, exceto pontos hiperecogênicos (mineralizações)')]);
addOptions('Rins', 'Achados adicionais', [
  o('Presença de microcistos corticais, medindo {Medida dos microcistos}', 'microcistos corticais'),
  o('Presença de espesso halo hiperecogênico em medular interna (sinal de medular), além de pontos hiperecogênicos adjacentes e em cortical (mineralizações)', 'espesso halo hiperecogênico e mineralizações'),
  o('Presença de discretas microlitíases em região de recessos pélvicos, medindo a maior {Medida da maior microlitíase}', 'microlitíases em recessos pélvicos')]);
addOptions('Rins', 'Pelve', [o('Pelve discretamente a moderadamente dilatada ({?Pelve})', 'discreta a moderadamente dilatada')]);
addOptions('Fígado', 'Dimensões', [o('com dimensões acentuadamente aumentadas', 'acentuadamente aumentadas')]);
addOptions('Fígado', 'Parênquima', [o('parênquima predominantemente hipoecogênico')]);
addOptions('Fígado', 'Vasos', [o('Vasos com calibre discretamente a moderadamente dilatado e trajetos preservados', 'calibre discreta a moderadamente dilatado')]);
addOptions('Vesícula biliar', 'Material ecogênico', [
  o('apresentando acentuada quantidade de material ecogênico, heterogêneo, ocupando cerca de mais de 75% do lúmen e gravidade dependente', 'acentuada quantidade, heterogêneo, gravidade dependente'),
  o('apresentando cerca de mais de 75% de material ecogênico, parcialmente gravidade dependente (depositado em fundo) e parcialmente não dependente da gravidade (em suspensão)', 'mais de 75%, depositado e em suspensão (não dependente)'),
  o('apresentando cerca de 26 a 50% de material ecogênico, parcialmente gravidade dependente e parcialmente em suspensão', '26 a 50%, depositado e em suspensão')]);
addOptions('Vesícula biliar', 'Ducto cístico', [o('Ducto cístico moderadamente dilatado, medindo {Ducto cístico}', 'moderadamente dilatado')]);
addOptions('Estômago', 'Conteúdo', [
  o('com moderada quantidade de conteúdo alimentar e gasoso (paciente sem jejum prévio)', 'alimentar e gasoso (sem jejum prévio)'),
  o('com moderada quantidade de conteúdo líquido, alimentar e gasoso (mesmo com histórico de jejum de mais de {Horas de jejum} horas)', 'líquido, alimentar e gasoso (com jejum)')]);
addOptions('Estômago', 'Peristaltismo e piloro', [o('Peristaltismo acentuadamente diminuído. Piloro íntegro e sem sinais de obstrução', 'peristaltismo acentuadamente diminuído')]);
addOptions('Alças intestinais', 'Parede', [o(`Parede normoecogênica, com preservação da estratificação em camadas em duodeno e alterada em segmentos jejunais pelo discreto espessamento da submucosa e muscular, contorno discretamente irregular e espessura discretamente a moderadamente aumentada ${DUODENO_JEJUNO}`, 'jejuno com espessamento da submucosa e muscular')], 0);
addOptions('Pâncreas', 'Dimensões', [o('com dimensões discretamente aumentadas, medindo {Lobo pancreático esquerdo} (lobo pancreático esquerdo)', 'discretamente aumentadas, lobo esquerdo')]);
addOptions('Adrenais', 'Dimensões', [
  o('com dimensões discretamente aumentadas em polo cranial e preservadas em polo caudal ({?Altura do pólo cranial:valor} x {?Altura do pólo caudal:valor} x {?Comprimento} – altura pólo cranial x altura pólo caudal x comprimento)', 'discretamente aumentadas em polo cranial'),
  o('com dimensões sutilmente aumentadas ({?Altura do pólo cranial:valor} x {?Altura do pólo caudal:valor} x {?Comprimento} – altura pólo cranial x altura pólo caudal x comprimento)', 'sutilmente aumentadas'),
  X('de difícil visualização ({Altura do pólo caudal} – altura pólo caudal), devido a sobreposição de grande formação em topografia, não sendo possível diferenciar demais limites')]);
addOptions('Adrenais', 'Formato', [o('formato preservado, exceto por polo cranial discretamente abaulado', 'preservado, polo cranial abaulado')]);
addOptions('Adrenais', 'Achado adicional', [
  o('presença de imagem nodular de contornos moderadamente definidos, hiperecogênica e homogênea, medindo {Medida da imagem nodular}, localizada em polo cranial', 'imagem nodular em polo cranial (moderadamente definida)'),
  o('presença de imagem nodular de contornos definidos, regulares, hiperecogênica e homogênea, medindo {Medida da imagem nodular}, localizada em polo cranial', 'imagem nodular em polo cranial (definida)')]);
addOptions('Próstata', 'Tamanho', [o('com tamanho normal predominantemente, exceto por largura com dimensões discretamente aumentadas ({?Comprimento:valor} x {?Altura:valor} x {?Largura} – comprimento x altura x largura)', 'normal, exceto largura aumentada')]);
addOptions('Próstata', 'Ecotextura e ecogenicidade', [
  o('ecotextura levemente grosseira pela presença de discretos microcistos medindo {Medida dos microcistos} e ecogenicidade habitual', 'ecotextura levemente grosseira, microcistos'),
  o('ecotextura grosseira, com presença de discretos microcistos, medindo {Medida dos microcistos} e ecogenicidade habitual', 'ecotextura grosseira, microcistos'),
  o('ecotextura discretamente heterogênea e ecogenicidade mista', 'ecotextura heterogênea e ecogenicidade mista')]);
addOptions('Testículos', 'Aspecto', [X('não caracterizados (paciente com histórico de orquiectomia recente)')], 0);
addOptions('Testículos', 'Aspecto', [o('apresentando contorno regular, ecotextura e ecogenicidade habituais, exceto por imagem nodular de contornos moderadamente definidos, regulares, ecogênica e grosseira, medindo {Medidas da imagem nodular}', 'habituais, exceto imagem nodular')], 1);
addOptions('Linfonodos', 'Avaliação', [o('Linfonodos: discreto aumento de linfonodos jejunais medindo até {Medidas dos linfonodos}, ecotextura homogênea e ecogenicidade preservada. Mesentério adjacente com ecogenicidade levemente aumentada', 'discreto aumento de linfonodos jejunais')]);
addOptions('Outros achados', 'Achado', [
  o('Presença de descontinuidade da parede abdominal em região umbilical/região de ferida cirúrgica, medindo {Medida da descontinuidade}, tendo como conteúdo em subcutâneo omento/gordura. Houve redução do conteúdo no momento do exame', 'descontinuidade umbilical/ferida cirúrgica'),
  o('Presença de descontinuidade da parede abdominal, medindo {Medida da descontinuidade}, tendo como conteúdo em subcutâneo omento/gordura. Houve redução do conteúdo no momento do exame', 'descontinuidade da parede abdominal'),
  o('Presença de formação localizada em topografia de lobo caudado e em topografia de adrenal direita, de contornos moderadamente definidos, irregulares, ecogenicidade mista, ecotextura heterogênea, altamente vascularizada ao doppler colorido, medindo aproximadamente {Medidas da formação}', 'formação em lobo caudado/adrenal direita'),
  o('Presença de estrutura arredondada, ecogênica, predominantemente homogênea, medindo {Medidas da estrutura}, localizada intraluminalmente em veia cava caudal, em topografia próxima a grande formação hepática/adrenal', 'estrutura intraluminal em veia cava caudal')]);

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
  // Versão 2 (novos laudos enviados): ['texto', 'estrutura', 2]
  ['Testículo direito ectópico.', 'Testículos', 2], ['Lama biliar grau {Grau} associada a litíases.', 'Vesícula biliar', 2],
  ['Processo inflamatório em coto uterino e pedículos ovarianos. Considerar histórico de OSH recente.', 'Útero', 2],
  ['Enteropatia e grande quantidade de conteúdo gasoso gastrointestinal.', 'Alças intestinais', 2], ['Enteropatia.', 'Alças intestinais', 2],
  ['Discreta esteatose hepática e moderada hepatomegalia.', 'Fígado', 2], ['Alteração hepática pode estar relacionada a hepatopatia crônica leve.', 'Fígado', 2],
  ['Discretas alterações mamárias podem sugerir processo inflamatório/infeccioso leve (mastite).', 'Tecido mamário', 2],
  [`Imagens renais sugestivas de nefropatia leve bilateral. ${REC}`, 'Rins', 2], ['Nefropatia bilateral.', 'Rins', 2],
  ['Imagens esplênicas sugestivas de mielolipomas.', 'Baço', 2],
  ['Moderada esplenomegalia com formação nodular a esclarecer, diagnóstico diferencial processo neoplásico. Diagnóstico definitivo sujeito a análise cito/histopatológica.', 'Baço', 2],
  ['Exame sem alterações relevantes dignas de nota.', '', 2],
  // Versão 3 (laudos de outubro/2026)
  ['Discreta infiltração gordurosa hepática.', 'Fígado', 3], ['Discreta a moderada hepatomegalia.', 'Fígado', 3],
  ['Hepatopatia reacional/aguda leve e discreta a moderada hepatomegalia.', 'Fígado', 3],
  ['Hepatopatia. Discreta a moderada esteatose hepática/hepatopatia crônica são diagnósticos diferenciais.', 'Fígado', 3],
  ['Discreto a moderado processo congestivo hepático (podendo estar relacionado com alteração cardíaca ou torácica).', 'Fígado', 3],
  ['Hepatopatia crônica leve/esteatose hepática.', 'Fígado', 3], ['Discreta esplenomegalia.', 'Baço', 3],
  ['Lama biliar grau II associada a processo mucinoso incipiente. A lama biliar está relacionada a alterações na composição da bile, processo inflamatório, endocrinopatias e ou desmotilidade da vesícula biliar.', 'Vesícula biliar', 3],
  ['Lama biliar densa grau {Grau}.', 'Vesícula biliar', 3],
  ['Colangiectasia com discreta a moderada quantidade de lama biliar intraluminal, podendo estar relacionada a colangite.', 'Vesícula biliar', 3],
  ['Moderada quantidade de conteúdo fecal, de aspecto ultrassonográfico habitual. Sugere-se radiografia abdominal, como exame complementar, a critério clínico.', 'Alças intestinais', 3],
  ['Sutil processo inflamatório em segmentos jejunais.', 'Alças intestinais', 3], ['Gastroenterocolite leve a moderada.', 'Alças intestinais', 3],
  ['Enteropatia crônica.', 'Alças intestinais', 3],
  ['Pancreatopatia crônica/infiltrado fibroadiposo pancreático.', 'Pâncreas', 3], ['Adrenomegalia esquerda.', 'Adrenais', 3],
  [`Alterações renais sugestivas de nefropatia bilateral. ${REC}`, 'Rins', 3],
  ['Testículo esquerdo ectópico.', 'Testículos', 3], ['Testículos ectópicos bilateralmente.', 'Testículos', 3],
  ['Hiperplasia prostática benigna cística.', 'Próstata', 3],
  ['Hérnia inguinal direita com discreto processo inflamatório associado.', 'Outros achados', 3],
  [`Imagens em rins sugestivas de nefropatia crônica bilateral associada a microlitíases. ${REC}`, 'Rins', 3],
  [`Nefropatia com sinais de cronicidade bilateralmente associada a microlitíases. ${REC}`, 'Rins', 3],
  ['Achados ultrassonográficos compatíveis com processo inflamatório intestinal, sendo a doença inflamatória intestinal (DII) um diagnóstico diferencial.', 'Alças intestinais', 3],
  ['Achado em estômago pode estar relacionado a um processo inflamatório (gastrite/gastropatia).', 'Estômago', 3], ['Gastrite leve.', 'Estômago', 3],
  ['Discretos cristais em vesícula biliar.', 'Vesícula biliar', 3], ['Hepatopatia leve/discreta infiltração gordurosa hepática.', 'Fígado', 3],
  ['Lama biliar grau {Grau} associada a discretos cristais/microlitíases.', 'Vesícula biliar', 3], ['Lama biliar grau IV com cristais/microlitíases associadas.', 'Vesícula biliar', 3],
  ['Acentuada lama biliar e lama biliar densa (grau IV) associada a colecistite e podendo estar relacionada a mucocele biliar em estágios iniciais.', 'Vesícula biliar', 3],
  ['Colangite leve.', 'Vesícula biliar', 3], ['Enterite leve.', 'Alças intestinais', 3], ['Enterocolite.', 'Alças intestinais', 3],
  ['Discreta linfonodomegalia inflamatória/infecciosa.', 'Linfonodos', 3], ['Discreta a moderada esplenomegalia.', 'Baço', 3],
  ['Discreta reatividade mesentérica difusa.', 'Outros achados', 3], ['Pancreatopatia leve.', 'Pâncreas', 3], ['Adrenopatia bilateral.', 'Adrenais', 3], ['Adrenopatia esquerda.', 'Adrenais', 3],
  ['Sugestivo ponto de mineralização em adrenal direita.', 'Adrenais', 3],
  ['Hepatopatia crônica com formações nodulares difusas, podendo estar relacionadas com hiperplasia nodular benigna/processo regenerativo, não podendo descartar processo neoplásico. Sugere-se acompanhamento ultrassonográfico, caso o clínico julgue necessário.', 'Fígado', 3],
  ['Alteração hepática pode estar relacionada a infiltração gordurosa, hepatopatia esteroidal, endocrinopatia, hepatopatia crônica.', 'Fígado', 3], ['Discreto processo congestivo venoso hepático.', 'Fígado', 3],
  ['Cistite crônica com litíases/microlitíases e celularidade/debris/cristais.', 'Vesícula urinária', 3], ['Sugestivos mielolipomas esplênicos.', 'Baço', 3],
  ['Hérnia umbilical/incisional.', 'Outros achados', 3], ['Discreta hiperplasia prostática benigna.', 'Próstata', 3],
  [`Nefropatia crônica bilateral. ${REC}`, 'Rins', 3], [`Nefropatia com sinais de cronicidade bilateralmente. ${REC}`, 'Rins', 3],
  ['Adrenomegalia direita com nódulo sugestivo de hiperplasia nodular benigna. Sugere-se acompanhamento ultrassonográfico, caso o clínico julgue necessário.', 'Adrenais', 3],
  ['Nódulo em adrenal direita sugestivo de hiperplasia nodular benigna.', 'Adrenais', 3],
  ['Gastrite/gastropatia.', 'Estômago', 3], ['Enterite/enteropatia.', 'Alças intestinais', 3], ['Pancreatopatia.', 'Pâncreas', 3], ['Lama biliar grau IV.', 'Vesícula biliar', 3],
  ['Lama biliar grau II com repleção aumentada e ducto cístico dilatado, podendo estar relacionada a colestase e colangite.', 'Vesícula biliar', 3],
  ['Moderado sedimento/celularidade/cristais em vesícula urinária. Sugere-se correlacionar com urinálise, caso o clínico julgue necessário.', 'Vesícula urinária', 3],
  ['Moderada a acentuada quantidade de celularidade/debris/cristais em vesícula urinária.', 'Vesícula urinária', 3],
  ['Sugestiva formação em lobo hepático caudado/adrenal direita, sugestiva de processo neoplásico. Sugere-se tomografia computadorizada para melhor elucidação diagnóstica, caso o clínico julgue necessário. Diagnóstico definitivo sujeito a análise histopatológica.', 'Fígado', 3],
  ['Hepatopatia crônica com processo inflamatório/reacional associado.', 'Fígado', 3], ['Sugestivo trombo em veia cava caudal.', 'Outros achados', 3],
  ['Grande quantidade de conteúdo gasoso intestinal.', 'Alças intestinais', 3],
  ['Sugestiva necrose gordurosa nodular do peritônio/mesentério. Considerar achado incidental benigno. Sugere-se acompanhamento ultrassonográfico, caso o clínico julgue necessário.', 'Outros achados', 3],
];

export const AFTER_CONCLUSION_NOTE = 'A interpretação do resultado deste exame e a conclusão diagnóstica são atos médicos, estes dependem da análise conjunta dos dados clínicos e demais exames do paciente - Consulte o médico veterinário responsável';
