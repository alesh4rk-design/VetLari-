# VetLaudo

Sistema web gratuito para elaboração de **laudos veterinários de ultrassonografia e radiografia**, com exportação em **Word (.docx)** e **PDF**. Funciona no navegador (computador, tablet e celular), sem servidor próprio, sem Python e sem instalar programas.

> Ferramenta de documentação e produtividade. **Não** gera diagnósticos, não inventa achados e não assina em nome da profissional.

## Estado do projeto

| Fase | Conteúdo | Situação |
|------|----------|----------|
| 1 | Protótipo funcional: interface responsiva (tema escuro/claro), pacientes, editor USG e RX, biblioteca de frases, imagens, Word/PDF, rascunhos locais, histórico, backup | **Implementada e testada** |
| 2 | Firebase Authentication, Firestore, regras de segurança, sincronização | Pendente |
| 3 | Ditado por voz, edição/anotação de imagens, PWA | Pendente |
| 4 | Validação real com a veterinária, testes de segurança, checklist de uso com dados reais | Pendente |

### O que a Fase 1 já faz
- Cadastro rápido de pacientes (só o nome do animal é obrigatório; sem CPF).
- Editor de **ultrassonografia** por estruturas (adicionar, renomear, reordenar, excluir) e de **radiografia** (região, projeções, qualidade técnica + estruturas).
- **Modelos personalizáveis** (Meus modelos) e **biblioteca de frases** própria (busca, categorias, favoritas, importar/exportar JSON, inserção sem apagar o texto existente).
- **Imagens**: seleção múltipla, arrastar para reordenar, legenda, giro, tamanho no documento, compressão opcional, limite por arquivo. Entram de fato no Word e no PDF.
- **Word (.docx)** editável e **PDF** com texto selecionável, mesmo conteúdo nos dois, cabeçalho/rodapé, paginação e prévia antes de exportar. Nome: `Laudo_USG_NomeDoAnimal_2026-10-10.docx`.
- **Rascunhos** com salvamento automático (IndexedDB), indicador de estado e recuperação após recarregar.
- **Laudos finalizados** são preservados; correções criam nova versão. Histórico com filtros, busca por palavra, comparação entre laudos.
- **Backup/restauração**, política de retenção e exclusão de dados (em Configurações).

### Ainda NÃO implementado
Login e sincronização em nuvem, armazenamento de imagens em nuvem, ditado por voz, anotações (setas) nas imagens, PWA instalável, DICOM, importação de modelos a partir de documentos Word.

## Como executar
Precisa apenas de um servidor de arquivos estáticos (módulos ES não funcionam abrindo o arquivo direto com `file://`):

```bash
npm run serve        # http://localhost:8080
```

## Testes
```bash
npm test             # validação, modelo do documento, geração de Word e PDF (Node)
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
