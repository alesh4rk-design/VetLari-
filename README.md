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
| 3 | Ditado por voz, visualizador/anotação de imagens, DICOM básico no navegador, PWA instalável | Pendente |
| 4 | Ecocardiograma (módulo próprio), base de referências científicas aprovada pela veterinária | Pendente (depende da veterinária) |
| 5 | IA opcional de redação (desligada por padrão) | Pendente (decisão de custo/privacidade) |
| 6 | Validação clínica e de segurança com profissionais | Pendente |

### O que já faz
- **Pacientes**, **modelos** de ultrassonografia (abdominal completa, direcionada/focal, urinário, hepatobiliar, gastrointestinal, reprodutivo, superficial, musculoesquelético) e de radiografia. São *modelos iniciais editáveis*, não protocolos validados.
- **Estrutura por estrutura**: status (normal, alterado, indeterminado, não visualizado, não avaliado ou não informado), descrição, medidas com valor e unidade, observações. **Nada é presumido normal**: estrutura sem informação não aparece no laudo.
- **Laudo**: indicação, histórico, pergunta clínica, operador, equipamento, técnica e limitações, achados, impressão, diagnósticos diferenciais, recomendações.
- **Estados**: rascunho, preliminar, finalizado; **retificação** e **adendo** criam nova versão com justificativa, preservando a original. Arquivos de rascunho/preliminar saem marcados.
- **Revisão automática por regras** (sem IA): medida sem unidade ou não numérica, estrutura "não avaliada" com texto, "normal" sem descrição, identificação profissional ausente etc. Alertas críticos exigem correção ou justificativa; o sistema nunca altera o texto clínico sozinho.
- **Checklist de finalização** e **histórico** com quem fez cada ação.
- **Comparação de medidas** entre exames do mesmo paciente: só calcula diferença quando estrutura, medida e unidade são iguais; não converte unidades nem declara "crescimento".
- Imagens (JPEG/PNG/WebP) com legenda, ordem, giro, tamanho; **Word editável e PDF** com o mesmo conteúdo; backup, retenção e exclusão de dados.
- A "finalização" é uma **confirmação eletrônica simples** (nome, data e hora), **sem certificado digital ICP-Brasil**. O documento informa isso.

### Ainda NÃO implementado
Login e nuvem, ditado por voz, IA, análise de imagens, DICOM/PACS, anotações nas imagens, ecocardiograma, base de referências, assinatura com certificado digital, PWA.

## Como executar
Precisa apenas de um servidor de arquivos estáticos (módulos ES não funcionam abrindo o arquivo direto com `file://`):

```bash
npm run serve        # http://localhost:8080
```

## Testes
```bash
npm test             # validação, qualidade, comparação, perfis, geração de Word e PDF (Node)
npm run test:e2e     # fluxo completo no navegador (requer Playwright/Chromium)
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
