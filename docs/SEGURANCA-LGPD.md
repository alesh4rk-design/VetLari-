# Checklist de segurança e privacidade (antes de usar dados reais)

> Este documento é uma lista de verificação técnica, **não** é parecer jurídico. Para a LGPD, confirme os pontos com um profissional da área.

## Situação atual (Fase 1)
Os dados ficam **somente no navegador do dispositivo** (IndexedDB). Nada é enviado a servidores. Por isso, hoje:
- [ ] Use apenas **dados fictícios** até concluir as fases 2 e 4.
- [ ] Não use o sistema em computador compartilhado/sem senha de usuário do sistema operacional.
- [ ] Faça **backup** regularmente (Configurações → Exportar backup). O arquivo contém dados pessoais: guarde em local protegido.
- [ ] Limpar os dados do navegador apaga tudo; o backup é a única cópia de segurança.

## Antes de ativar Firebase (Fase 2)
- [ ] Autenticação habilitada apenas com métodos do plano gratuito; cadastro aberto desativado (somente usuários convidados).
- [ ] Regras do Firestore: acesso somente a `request.auth.uid == userId`; nenhuma regra pública (`allow read, write: if true` é proibido).
- [ ] Regras do Storage (se usado): mesmo critério, com limite de tipo e tamanho.
- [ ] Faturamento **não** habilitado; alertas de cota configurados.
- [ ] Domínio do GitHub Pages incluído apenas nos domínios autorizados do Firebase Auth.
- [ ] Nenhuma chave privada/administrativa no repositório (a configuração pública do Firebase não substitui as regras).

## LGPD — pontos a confirmar
- [ ] Finalidade e base legal para tratar dados do tutor (nome) e do animal.
- [ ] Informar ao tutor/clínica como os dados são armazenados e por quanto tempo.
- [ ] Política de retenção definida (Configurações → Retenção) e procedimento de exclusão a pedido do titular.
- [ ] Não coletar CPF nem dados desnecessários (o sistema não pede CPF).
- [ ] Registro de quem acessa/altera laudos (histórico de versões já existe; trilha de acesso depende da Fase 2).
- [ ] Ditado por voz (Fase 3): a Web Speech API pode enviar áudio ao serviço de reconhecimento do navegador/fabricante. Informar e obter autorização antes de usar com dados reais.

## Boas práticas já aplicadas no código
- Todo texto exibido é escapado (proteção contra injeção de HTML/XSS).
- Validação de campos, tipo e tamanho de arquivos de imagem.
- Laudos finalizados não são sobrescritos: correções geram nova versão e o original é preservado.
- Nenhum achado, medida, diagnóstico ou "normalidade" é preenchido automaticamente; campos vazios não aparecem no documento.
