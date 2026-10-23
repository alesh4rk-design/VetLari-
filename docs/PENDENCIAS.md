# Pendências do VetLaudo

Lista viva do que falta. (Peça "o que temos pendente?" para receber o resumo.)

## Ações do responsável técnico (não dependem da veterinária)
- [ ] Mesclar a branch de desenvolvimento na `main` (pull request) e ativar o GitHub Pages: Settings → Pages → branch `main`, pasta `/ (root)`.
- [ ] Testar em celular Android e iPhone reais (principalmente ditado por voz, câmera/galeria e instalação na tela inicial) (até agora só em navegador de computador com tela simulada).

## Depende da veterinária (quando ela puder)
- [ ] Revisar o catálogo de frases carregado dos laudos dela (Meus modelos → duplicar → "Frases deste órgão") e acrescentar as variações que faltam (o catálogo só tem o que apareceu nos 6 laudos enviados: ex.: faltam opções como rins com dimensões aumentadas, útero, felinos).
- [ ] Decidir sobre pontos de estilo: achados adicionais dos rins saem como frase com ponto final (nos laudos dela vinham após ponto e vírgula); medidas sempre com vírgula decimal.
- [ ] Mandar mais laudos (felinos, outras espécies e casos alterados) para ampliar o catálogo. Já incorporados: 10 laudos de cães (machos e fêmeas).
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
(registrar aqui as ideias recebidas nas conversas)
