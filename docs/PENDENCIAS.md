# Pendências do VetLaudo

Lista viva do que falta. (Peça "o que temos pendente?" para receber o resumo.)

## Ações do responsável técnico (não dependem da veterinária)
- [ ] Mesclar a branch de desenvolvimento na `main` (pull request) e ativar o GitHub Pages: Settings → Pages → branch `main`, pasta `/ (root)`.
- [ ] Testar em celular Android e iPhone reais (principalmente ditado por voz, câmera/galeria e instalação na tela inicial) (até agora só em navegador de computador com tela simulada).

## Depende da veterinária (quando ela puder)
- [ ] Revisar os modelos iniciais de ultrassonografia (estruturas) e ajustar à rotina dela.
- [ ] Definir o módulo de **ecocardiograma** (estruturas, medidas e cálculos, referências). Não será inventado.
- [ ] Cadastrar as **referências científicas** que ela aprova (com fonte verificável). O sistema não traz valores de referência prontos.
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
