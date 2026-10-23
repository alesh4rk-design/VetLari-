# VetLaudo

Sistema web gratuito para elaboração de **laudos veterinários de ultrassonografia e radiografia**, com exportação em **Word (.docx)** e **PDF**. Funciona no navegador (computador, tablet e celular), sem servidor próprio, sem Python e sem instalar programas.

> Ferramenta de documentação e produtividade. **Não** gera diagnósticos, não inventa achados e não assina em nome da profissional.

## Modelo de uso (decisão do projeto)
- **Cada pessoa tem o próprio perfil**, no próprio aparelho (celular, tablet ou computador). Cada perfil tem pacientes, laudos, modelos, frases, configurações e **imagens separados**.
- **Nada sai do aparelho**: não há servidor, login em nuvem nem armazenamento de imagens na internet. A pessoa escolhe **Word ou PDF** ao exportar.
- Funções: *médico(a)-veterinário(a)* (pode finalizar, retificar e fazer adendo) e *auxiliar* (cadastra e edita rascunhos, **não** finaliza nem assina).
- Limite importante: perfis e permissões organizam o uso, mas **não protegem contra quem tem acesso ao aparelho desbloqueado**, e a auditoria é local (não é à prova de adulteração). Para isso seria preciso servidor e login (Fase 2, ainda não necessária).

## Estado do projeto

| Etapa | Conteúdo | Situação |
|------|----------|----------|
| 1 | Interface responsiva, pacientes, editor de laudos, frases, imagens, Word/PDF, rascunhos locais, histórico, backup | **Pronta e testada** |
| 2 | Perfis por aparelho, modelo clínico (status por estrutura, medidas com unidade), estados do laudo, checklist de finalização, retificação/adendo, auditoria local, comparação de medidas, modelos iniciais de ultrassonografia | **Pronta e testada** |
| 3 | Ditado por voz (com revisão), visualizador de imagens com zoom e anotações, escolha das imagens do laudo, PWA instalável/offline | **Pronta e testada** (voz real e celular ainda não testados) |
| 3b | DICOM básico no navegador | Pendente (estudo de viabilidade) |
| 3c | Bases técnicas: referências e cálculos cadastrados pela veterinária | **Pronta e testada** |
| 4 | Ecocardiograma (módulo próprio), base de referências científicas aprovada pela veterinária | Pendente (depende da veterinária) |
| 5 | IA opcional de redação (desligada por padrão) | Pendente (decisão de custo/privacidade) |
| 6 | Validação clínica e de segurança com profissionais | Pendente |

### O que já faz
- **Espécie e raça**: lista de espécies (cão, gato, ave, roedor, coelho, furão, réptil, equino...) e raças mais conhecidas de cada espécie, sempre com **digitação livre**; botão **Lista** abre todas as opções com busca. "Cão", "Canino" e "cachorro" são tratados como a mesma espécie (referências, comparações). **Idade calculada sozinha** a partir da data de nascimento (na data do exame); sem a data, a idade é digitada.
- **Data e hora do exame são opcionais**: vêm preenchidas por conveniência, mas podem ser apagadas; sem elas o laudo simplesmente não mostra o campo (só o nome do paciente é obrigatório). A idade, sem data do exame, usa o dia de hoje.
- **Pacientes**, **modelos** de ultrassonografia (abdominal completa, direcionada/focal, urinário, hepatobiliar, gastrointestinal, reprodutivo, superficial, musculoesquelético) e de radiografia. São *modelos iniciais editáveis*, não protocolos validados.
- **Estrutura por estrutura**, em **lista de órgãos** (um órgão por vez, sem a página pular): status em botões (normal, alterado, indeterminado, não visualizado, não avaliado; sem marcar = não informado), descrição, **medidas prontas do modelo** (nome e unidade já preenchidos, só digita o valor), outras medidas e observações. Estruturas de machos ou fêmeas aparecem conforme o sexo do paciente. **Nada é presumido normal**: estrutura sem informação não aparece no laudo.
- **Laudo**: indicação, histórico, pergunta clínica, operador, equipamento, técnica e limitações, achados, impressão, diagnósticos diferenciais, recomendações.
- **Estados**: rascunho, preliminar, finalizado; **retificação** e **adendo** criam nova versão com justificativa, preservando a original. Arquivos de rascunho/preliminar saem marcados.
- **Revisão automática por regras** (sem IA): medida sem unidade ou não numérica, estrutura "não avaliada" com texto, "normal" sem descrição, identificação profissional ausente etc. Alertas críticos exigem correção ou justificativa; o sistema nunca altera o texto clínico sozinho.
- **Checklist de finalização** e **histórico** com quem fez cada ação.
- **Comparação de medidas** entre exames do mesmo paciente: só calcula diferença quando estrutura, medida e unidade são iguais; não converte unidades nem declara "crescimento".
- Imagens (JPEG/PNG/WebP) com legenda, ordem, giro, tamanho; **Word editável e PDF** com o mesmo conteúdo; backup, retenção e exclusão de dados.
- A "finalização" é uma **confirmação eletrônica simples** (nome, data e hora), **sem certificado digital ICP-Brasil**. O documento informa isso.

- **Ditado por voz**: botão "Ditar" em cada campo. A transcrição aparece numa caixa editável e só é inserida (na posição do cursor, sem apagar nada) quando a profissional confirma. Depende do navegador; o áudio pode ser enviado ao serviço do fabricante (o sistema avisa). Sem suporte, a caixa serve para digitação manual.
- **Visualizador de imagens**: zoom, deslocamento, navegação e anotações (seta, círculo, texto). A imagem original é preservada; o laudo usa a cópia anotada. Girar uma imagem remove suas anotações (com confirmação). Não há medida automática por pixels.
- **Imagens do laudo**: cada imagem pode ser incluída ou não no documento.
- **Instalável e offline (PWA)**: depois da primeira visita o sistema abre sem internet; no celular pode ser adicionado à tela inicial.

- **Editar e excluir exames**: cada exame da lista tem **Editar** (rascunho/preliminar) ou **Abrir** (finalizado) e **Excluir**; também há "Excluir exame" dentro do laudo. Rascunhos pedem uma confirmação; **laudos finalizados exigem digitar EXCLUIR** e só podem ser excluídos por médico(a)-veterinário(a). Para alterar um laudo finalizado sem perdê-lo, use Retificar/Adendo (nova versão). A exclusão é definitiva, e fica só um registro mínimo (sem nome de paciente ou tutor).
- **Montador de descrição** (o sistema escreve a frase): em cada órgão do modelo abdominal, a veterinária **marca o que observou** (botões como "preservadas", "bordas afiladas") e **digita as medidas**; o texto é escrito sozinho no estilo dos laudos dela, e se atualiza ao vivo quando a medida muda. O catálogo inicial foi extraído dos laudos que ela enviou (frases dela, sem dados de pacientes). Regras: nada marcado = nenhum texto (nada é presumido); medida em parênteses só aparece se foi digitada; campo que precisa ser digitado (ex.: grau da lama biliar) aparece para preencher e, enquanto vazio, vira `[PREENCHER: …]` (alerta crítico); o texto pode ser editado à mão, e nesse caso novas escolhas não o apagam (há "Gerar de novo"). As opções de cada órgão são editáveis em **Meus modelos** (duplicar o modelo inicial). As **impressões diagnósticas** dos laudos dela vêm na biblioteca de frases e entram uma por linha; a conclusão sai em lista, seguida do aviso fixo (Configurações).
- **Guardar esta frase** em todos os campos de texto: além de cada órgão, também em Indicação clínica, Pergunta clínica, Histórico relevante, Medicamentos informados, Técnica e limitações, Conclusão, Observações etc. Cada frase fica ligada ao campo em que foi guardada e só aparece em "Inserir frase" naquele campo (a conclusão mostra também as frases dos órgãos). Os 10 laudos enviados não têm esses campos, então não há frases iniciais para eles: a biblioteca se enche conforme ela guarda as suas.
- **Guardar esta frase** (órgãos): em cada órgão, o botão "Guardar esta frase" salva o texto escrito no laudo na Biblioteca de frases (categoria "Minhas frases"), para aparecer em "Inserir frase" nos próximos laudos. Nada é guardado sozinho. Os valores digitados que coincidem com medidas viram campos (ex.: "4,13 cm" → `{Comprimento}`), assim a frase se preenche com as medidas do próximo exame.
- **Frases prontas com campos**: na Biblioteca de frases, escreva `{Comprimento}` onde entra uma medida (ex.: "medindo {Comprimento}"). Ao inserir a frase numa estrutura, o sistema preenche com o valor e a unidade da medida de mesmo nome (inclusive medidas calculadas) e mostra a prévia já preenchida. Campo sem medida, ou medida sem unidade, é perguntado; se ficar pendente vira `[PREENCHER: nome]`, que a revisão aponta como alerta crítico. O sistema nunca escolhe a frase nem preenche nada por suposição.
- **Bases técnicas** (menu "Bases"): a veterinária cadastra **referências** (fonte, DOI/URL, espécie, população, método, unidade, intervalo, limitações, data de revisão) e **cálculos** (fórmula, variáveis e unidades). Nada vem pronto.
  - Referência nasce como *rascunho*; só passa a ser usada depois de **aprovada** por veterinária (exige DOI/URL se for científica). Importar JSON sempre cria rascunhos.
  - O sistema só aplica referências da **mesma espécie** e nunca converte unidades. Ele informa a posição do valor frente ao intervalo cadastrado (abaixo/dentro/acima) como alerta informativo, **sem dizer "normal" ou "anormal"**. Sem referência aprovada, informa que não há.
  - Cálculos usam um interpretador próprio e seguro (sem `eval`). O resultado entra no laudo como medida **calculada**, identificada e bloqueada para edição.
  - Com isso a veterinária pode montar o próprio módulo de ecocardiograma (modelo + referências + cálculos), sem valores inventados pelo sistema.

### Ainda NÃO implementado
Login e nuvem, IA, análise de imagens, DICOM/PACS, assinatura com certificado digital, pinça/zoom com dois dedos no visualizador (use os botões +/−).

## Como executar
Precisa apenas de um servidor de arquivos estáticos (módulos ES não funcionam abrindo o arquivo direto com `file://`):

```bash
npm run serve        # http://localhost:8080
```

## Testes
```bash
npm test             # validação, qualidade, comparação, perfis, geração de Word e PDF (Node)
npm run test:e2e     # fluxos completos no navegador (requer Playwright/Chromium)
```
O teste e2e usa os arquivos `tests/fixture-*.{jpg,png}` (imagens fictícias).

## Publicar no GitHub Pages
1. No GitHub: **Settings → Pages → Build and deployment → Deploy from a branch**.
2. Selecione a branch `main` e a pasta `/ (root)`.
3. O endereço será `https://<usuario>.github.io/VetLari-/`. Todos os caminhos são relativos, então funciona em subpasta.

## Estrutura
```
index.html            página única
assets/css/           styles.css, responsive.css
assets/vendor/        docx e jsPDF (copiados localmente, com licenças)
js/                   módulos ES (app, router, editor, exams, patients, phrase-library,
                      template-editor, image-manager, report-model, docx-export, pdf-export,
                      local-storage, validation, templates, settings, dashboard, ui, utils)
tests/                testes unitários (Node) e e2e (Playwright)
docs/                 SEGURANCA-LGPD.md
```

## Decisões técnicas
- **PDF com jsPDF** (desenho direto) em vez de converter HTML em imagem: mantém texto selecionável e permite controlar quebras de página e imagens.
- Imagens são convertidas para **JPEG** ao importar (formato confiável em Word e PDF). WebP é aceito como entrada.
- Bibliotecas ficam em `assets/vendor/` para não depender de CDN.

## Custos e limites
Fase 1 não usa nenhum serviço pago nem externo. Nas próximas fases, as cotas gratuitas do Firebase são limitadas e podem mudar; confira os limites vigentes antes de usar e não habilite faturamento.

## Configuração manual do Firebase (Fase 2)
Será necessária uma conta Google do responsável: criar o projeto, ativar Authentication (e-mail/senha), criar o Firestore e publicar as regras de segurança. Os passos detalhados serão adicionados quando a Fase 2 for implementada.
