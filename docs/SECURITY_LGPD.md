# Segurança e LGPD

## Autenticação

| Item | Implementação |
| --- | --- |
| Senhas | bcrypt (custo 12); política mínima de 8 caracteres com letras e números |
| Access token | JWT HS256, 15 min, `issuer=personalpro`, contém apenas ids e papel |
| Refresh token | 48 bytes aleatórios; armazenado **somente como hash SHA-256**; 30 dias; rotação a cada uso; reuso de token já trocado revoga todas as sessões do usuário |
| Login social | ID tokens Google/Apple validados por assinatura (JWKS), `issuer` e `audience` (`GOOGLE_CLIENT_IDS`, `APPLE_CLIENT_IDS`); vínculo automático apenas com e-mail verificado |
| Recuperação de senha | Token de uso único (hash SHA-256), validade de 1 h; resposta idêntica para e-mails existentes e inexistentes; redefinição revoga todas as sessões |
| Força bruta | Rate limit global (300 req/min) e específico (login/cadastro 10/min, recuperação 5/min) |
| Enumeração de contas | Mesma mensagem para e-mail inexistente e senha incorreta |

## Autorização e isolamento multi-tenant

- **RBAC**: guard global `RolesGuard` + `@Roles('TRAINER' | 'STUDENT' | 'ADMIN')` em cada rota.
- **Isolamento**: `AccessPolicyService` exige vínculo `trainer_students` para qualquer acesso do professor a dados de aluno; aluno acessa somente o próprio `student_id`. Recursos de outro tenant retornam **404** (não revelam existência).
- **Anotações privadas** do professor nunca são retornadas a alunos nem ao admin.
- **Admin** acessa apenas métricas agregadas, dados cadastrais e assinaturas.
- Cobertura: testes e2e verificam o isolamento (professor B não lê alunos, notas, conversas, sugestões ou fichas do professor A).

## Criptografia

- **Em trânsito**: HTTPS obrigatório em produção (terminação TLS no balanceador); `helmet` aplica cabeçalhos de segurança.
- **Em repouso**: anotações privadas do professor criptografadas com **AES-256-GCM** (IV aleatório + tag de autenticação; chave `DATA_ENCRYPTION_KEY`, obrigatória em produção). Recomenda-se também criptografia de disco/backup do PostgreSQL e do bucket de arquivos.
- Tokens opacos (refresh, redefinição) são guardados apenas como hash.

## Validação e uploads

- DTOs com `class-validator` (`whitelist` + `forbidNonWhitelisted`): campos desconhecidos são rejeitados.
- **Arquivos sensíveis** (fotos de evolução, anexos do chat, documentos) não têm URL pública: são guardados como referência privada e entregues com **URL assinada válida por 1 hora** (HMAC no driver local; *presigned URL* no S3). Somente avatares e mídias de exercícios são públicos.
- Uploads: lista de MIME types permitidos e limites por tipo (imagem 15 MB, áudio 25 MB, documento 25 MB, vídeo 150 MB); chaves aleatórias (UUID) por usuário; proteção contra *path traversal* no driver local.
- Webhooks de pagamento autenticados (assinatura HMAC Stripe com tolerância de 5 min; token Asaas com comparação em tempo constante; Mercado Pago revalidado consultando a API).

## LGPD (Lei 13.709/2018)

| Requisito | Como é atendido |
| --- | --- |
| Base legal e consentimento | Aceite obrigatório dos termos e da política de privacidade no cadastro (`terms_accepted_at`, `privacy_version`). Dados de saúde (avaliações, medidas, fotos) são **dados sensíveis**, tratados com consentimento específico do titular para a finalidade de acompanhamento físico |
| Opt-in de marketing | `marketing_opt_in` separado, desmarcado por padrão |
| Minimização | Admin vê apenas agregados; professor só vê alunos vinculados |
| Acesso e portabilidade (art. 18, II e V) | `GET /account/export` — todos os dados pessoais em JSON (sem hash de senha) |
| Correção (art. 18, III) | Edição de perfil pelo próprio titular |
| Eliminação (art. 18, VI) | `DELETE /account` (confirmação por senha): remove perfis e dados de treino/avaliação/fotos em cascata, apaga arquivos do storage, revoga sessões, cancela assinatura e anonimiza o registro do usuário |
| Revogação do vínculo | Professor/aluno pode inativar o acompanhamento; o professor perde o acesso aos dados novos |
| Registro das operações | `audit_logs`: login, falhas de login, reuso de token, exportação, exclusão, redefinição de senha, pagamentos manuais |
| Segurança (art. 46) | Controles acima |
| Encarregado (DPO) | Contato publicado na política de privacidade (`privacidade@personalpro.app`) |

## Checklist de produção

- [ ] `NODE_ENV=production`, `JWT_ACCESS_SECRET` (≥ 32 caracteres) e `DATA_ENCRYPTION_KEY` (32 bytes base64) gerados aleatoriamente e guardados em cofre de segredos.
- [ ] `CORS_ORIGINS` restrito aos domínios do app/web.
- [ ] HTTPS em todos os domínios; HSTS no balanceador.
- [ ] Bucket S3/Supabase **privado**, com leitura pública liberada apenas para os prefixos `avatars/` e `exercises/` (os demais usam URL assinada).
- [ ] Backups do PostgreSQL criptografados e testados.
- [ ] Rotação periódica de segredos e monitoramento de `audit_logs`.
