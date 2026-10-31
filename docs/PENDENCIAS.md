# Pendências do VetLaudo

Lista viva do que falta. (Peça "o que temos pendente?" para receber o resumo.)

## Ações do responsável técnico (não dependem da veterinária)
- [x] Publicação: cada mudança vai para a `main` por pull request e o GitHub Pages atualiza sozinho.
- [ ] Testar em celular Android e iPhone reais (principalmente ditado por voz, câmera/galeria e instalação na tela inicial) (até agora só em navegador de computador com tela simulada).

## Depende da veterinária (quando ela puder)
- [ ] Revisar o catálogo de frases carregado dos laudos dela (Meus modelos → duplicar → "Frases deste órgão") e acrescentar as variações que faltam (o catálogo só tem o que apareceu nos 6 laudos enviados: ex.: faltam opções como rins com dimensões aumentadas, útero, felinos).
- [ ] Decidir sobre pontos de estilo: achados adicionais dos rins saem como frase com ponto final (nos laudos dela vinham após ponto e vírgula); medidas sempre com vírgula decimal.
- [ ] Mandar mais laudos (outras espécies) e, principalmente, a parte de **Impressão Diagnóstica** dos laudos (nas imagens enviadas ela costuma vir cortada). Já incorporados: cerca de 120 laudos de cães e gatos.
- [ ] Conferir o **Texto padrão (sem alterações)** de cada órgão (montado com a redação mais frequente nos laudos dela).
- [ ] Conferir padronizações feitas ao carregar o catálogo: "volume e de 5,59 ml" virou "volume de {Volume}"; "preservados no cornos uterinos" virou "nos cornos uterinos"; decimais sempre com vírgula; achados adicionais dos rins como frase com ponto final.
- [ ] Revisar os modelos iniciais de ultrassonografia (estruturas) e ajustar à rotina dela.
- [ ] Montar o **ecocardiograma** usando as ferramentas já prontas: um modelo em "Meus modelos", as referências em "Bases → Referências" e as fórmulas em "Bases → Cálculos". O sistema não traz valores nem fórmulas prontos.
- [ ] Cadastrar e aprovar as **referências científicas** (com DOI/URL verificável) e os **cálculos** que ela usa.
- [ ] Testar com casos fictícios e dizer o que atrapalha o fluxo.

## Desenvolvimento
- [x] Ditado por voz (feito; testar com microfone real em Android e iPhone — o suporte varia por navegador).
- [x] Visualizador de imagens com zoom, anotações e seleção das imagens do laudo (feito). Falta: zoom com dois dedos e ferramenta de medida calibrada (só se houver forma confiável de calibrar).
- [ ] DICOM básico no navegador (estudo de viabilidade primeiro; PACS fora do escopo sem servidor).
- [x] PWA instalável e offline (feito; confirmar a instalação no celular após publicar no GitHub Pages, que usa HTTPS).
- [ ] IA opcional de redação: só após decidir provedor, custo e privacidade; desligada por padrão, sempre com revisão obrigatória.
- [ ] Login/nuvem (somente se um dia for necessário sincronizar entre aparelhos ou impor regras no servidor).
- [ ] Assinatura eletrônica com certificado (ICP-Brasil), se a legislação/uso exigir. Requer serviço externo.
- [ ] Avaliar com profissional habilitado os requisitos do CFMV (prontuário, telediagnóstico) antes de uso real.

## Ideias da veterinária
- [x] Data/hora opcionais e vazias; peso em kg ou g; estrutura da frase em lista; tutorial por aba; nome do órgão antes da frase; contorno, dimensões e pelve com mais opções; imagens ao lado dos achados.
- [x] Copiar o texto do laudo para WhatsApp/e-mail; lembrete de backup no Início.
(registrar aqui as ideias recebidas nas conversas)

## Financeiro (módulo novo)
- [x] Clínicas com tabela de preços por validade, tipos de exame, lançamento por laudo (clínica/domiciliar/sem cobrança), recebimentos parciais, despesas e abastecimentos, previsão do mês, produtividade com cronômetro, exportação Excel (8 abas).
- [ ] Agenda de exames futuros (hoje só conta exames lançados com data futura, mostrados à parte e nunca como receita garantida).
- [ ] Feriados na previsão (hoje separa só dias úteis × fins de semana).
- [ ] Sincronizar entre aparelhos: os dados ficam só neste navegador (não há servidor); o cronômetro usa horários gravados no aparelho.
