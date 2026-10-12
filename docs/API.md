# PersonalPro — Referência da API REST

- **Base URL (dev):** `http://localhost:3333`
- **Swagger interativo:** `GET /docs` · **OpenAPI JSON:** `GET /docs/openapi.json` (cópia versionada em [`openapi.json`](./openapi.json), gerada por `npm run openapi -w @personalpro/api`)
- **Formato:** JSON, datas ISO-8601 (UTC). Campos `Decimal` de relações Prisma (ex.: `workout.exercises[].suggestedLoadKg`) chegam como *string* — converta com `Number()`.
- 🌐 = rota pública. Todas as demais exigem `Authorization: Bearer <accessToken>`.

## Autenticação

1. `POST /auth/register` (primeiro acesso) ou `POST /auth/login` → `{ accessToken, refreshToken, user }`.
2. `user.role` define o painel: `STUDENT` → aluno, `TRAINER` → professor, `ADMIN` → administração.
3. O access token (JWT HS256, 15 min) contém `sub`, `role`, `tid` (trainerId) e `sid` (studentId).
4. Ao receber `401`, chame `POST /auth/refresh` com o refresh token. **Rotação:** cada refresh invalida o anterior; reutilizar um token já trocado revoga todas as sessões do usuário.
5. Login social: o app obtém o *ID token* via SDK do Google/Apple e envia para `POST /auth/social`. No primeiro acesso a API responde `422 { code: "ROLE_REQUIRED" }` — pergunte se é aluno ou professor e repita com `role` e `acceptTerms: true`.
6. Recuperação de senha: `POST /auth/forgot-password` envia link `${APP_URL}/redefinir-senha?token=...`; a página chama `POST /auth/reset-password`.

## Erros

```json
{ "statusCode": 422, "code": "WEAK_PASSWORD", "message": "A senha deve ter ao menos 8 caracteres, com letras e números" }
```

| Status | Quando |
| --- | --- |
| 400 | Validação de DTO (`message` é uma lista) |
| 401 | Sem token / token inválido / credenciais inválidas |
| 402 | `PLAN_LIMIT` — limite de alunos do plano ou assinatura inativa |
| 403 | Perfil sem permissão (RBAC) |
| 404 | Recurso inexistente **ou de outro professor** (o isolamento não revela existência) |
| 409 | Conflito (e-mail já cadastrado, horário ocupado, treino encerrado…) |
| 422 | Regra de negócio (`code` identifica o caso) |
| 429 | Rate limit (login/cadastro: 10/min; geral: 300/min) |

## Regras de acesso

- **Aluno:** somente os próprios dados. Rotas que aceitam `studentId` ignoram/validam o parâmetro.
- **Professor:** somente alunos com vínculo ativo/pendente (`trainer_students`); `studentId` é obrigatório nas rotas compartilhadas (`/progress/*`, `/goals`, `/assessments`, `/sessions`).
- **Anotações** (`/students/:id/notes`) são exclusivas do professor autor.
- **Admin:** métricas agregadas, usuários, planos e assinaturas.

## Tempo real (chat)

Socket.IO no namespace `/chat`:

```ts
const socket = io(`${API_URL}/chat`, { auth: { token: accessToken } });
socket.on('message', (m: Message) => {});      // nova mensagem em qualquer conversa do usuário
socket.on('read', ({ conversationId }) => {});  // mensagens lidas pelo outro participante
socket.emit('typing', { conversationId });       // → 'typing' para o outro participante
```

## Fluxo de execução de treino

1. `GET /workouts/today` → treino do dia.
2. `POST /sessions { workoutId }` → tela de execução: por exercício, prescrição, mídia, `previous` (carga utilizada anteriormente), `personalBest` e `today`.
3. A cada série: `POST /sessions/:id/sets { exerciseId, workoutExerciseId, setNumber, loadKg, reps, rpe?, notes? }` → `{ isPersonalRecord, restSeconds }` → o app inicia o cronômetro de descanso (botão **PULAR DESCANSO**).
4. `POST /sessions/:id/finish { perceivedEffort?, notes? }` → resumo (início, fim, duração, volume total, calorias, recordes).

## Rotas

### Notificações

| Método | Rota | Corpo | Query | Descrição |
| --- | --- | --- | --- | --- |
| `GET` | `/notifications` |  | page?, pageSize?, unread? |  |
| `POST` | `/notifications/read-all` |  |  |  |
| `POST` | `/notifications/{id}/read` |  |  |  |

### Assinaturas

| Método | Rota | Corpo | Query | Descrição |
| --- | --- | --- | --- | --- |
| `GET` | `/plans` 🌐 |  |  |  |
| `GET` | `/subscriptions/me` |  |  |  |
| `POST` | `/subscriptions/checkout` | CheckoutDto |  |  |
| `POST` | `/subscriptions/cancel` |  |  |  |
| `POST` | `/webhooks/payments/{provider}` 🌐 |  |  |  |

### Convites

| Método | Rota | Corpo | Query | Descrição |
| --- | --- | --- | --- | --- |
| `POST` | `/invites` | CreateInviteDto |  |  |
| `GET` | `/invites` |  |  |  |
| `DELETE` | `/invites/{id}` |  |  |  |
| `POST` | `/invites/accept` | AcceptInviteDto |  |  |
| `GET` | `/invites/{code}/preview` 🌐 |  |  |  |
| `GET` | `/invites/{code}/qrcode.png` 🌐 |  |  |  |

### Autenticação

| Método | Rota | Corpo | Query | Descrição |
| --- | --- | --- | --- | --- |
| `POST` | `/auth/register` 🌐 | RegisterDto |  |  |
| `POST` | `/auth/login` 🌐 | LoginDto |  |  |
| `POST` | `/auth/social` 🌐 | SocialLoginDto |  |  |
| `POST` | `/auth/refresh` 🌐 | RefreshDto |  |  |
| `POST` | `/auth/logout` 🌐 | RefreshDto |  |  |
| `POST` | `/auth/forgot-password` 🌐 | ForgotPasswordDto |  |  |
| `POST` | `/auth/reset-password` 🌐 | ResetPasswordDto |  |  |
| `POST` | `/auth/change-password` | ChangePasswordDto |  |  |
| `GET` | `/auth/me` |  |  |  |

### Conta e privacidade (LGPD)

| Método | Rota | Corpo | Query | Descrição |
| --- | --- | --- | --- | --- |
| `PATCH` | `/account` | UpdateAccountDto |  |  |
| `DELETE` | `/account` | DeleteAccountDto |  |  |
| `GET` | `/account/export` |  |  |  |
| `POST` | `/account/devices` | DeviceDto |  |  |
| `DELETE` | `/account/devices/{token}` |  |  |  |

### Avaliação física

| Método | Rota | Corpo | Query | Descrição |
| --- | --- | --- | --- | --- |
| `GET` | `/assessments` |  | studentId?, status? |  |
| `POST` | `/assessments` | CreateAssessmentDto |  |  |
| `POST` | `/assessments/schedule` | ScheduleAssessmentDto |  |  |
| `GET` | `/assessments/compare` |  | before, after |  |
| `GET` | `/assessments/{id}` |  |  |  |
| `PATCH` | `/assessments/{id}` | UpdateAssessmentDto |  |  |
| `DELETE` | `/assessments/{id}` |  |  |  |
| `POST` | `/assessments/{id}/photos` | multipart (file) | angle |  |

### Metas

| Método | Rota | Corpo | Query | Descrição |
| --- | --- | --- | --- | --- |
| `GET` | `/goals` |  | studentId?, status? |  |
| `POST` | `/goals` | CreateGoalDto |  |  |
| `PATCH` | `/goals/{id}` | UpdateGoalDto |  |  |
| `DELETE` | `/goals/{id}` |  |  |  |

### Biblioteca de exercícios

| Método | Rota | Corpo | Query | Descrição |
| --- | --- | --- | --- | --- |
| `GET` | `/exercises` |  | muscleGroup?, search?, scope? |  |
| `POST` | `/exercises` | CreateExerciseDto |  |  |
| `GET` | `/exercises/{id}` |  |  |  |
| `PATCH` | `/exercises/{id}` | UpdateExerciseDto |  |  |
| `DELETE` | `/exercises/{id}` |  |  |  |

### Arquivos

| Método | Rota | Corpo | Query | Descrição |
| --- | --- | --- | --- | --- |
| `POST` | `/files` | multipart (file) | folder? |  |

### Evolução

| Método | Rota | Corpo | Query | Descrição |
| --- | --- | --- | --- | --- |
| `GET` | `/progress/stats` |  | studentId?, weeks? |  |
| `GET` | `/progress/exercises` |  | studentId? |  |
| `GET` | `/progress/exercises/{exerciseId}` |  | studentId? |  |
| `GET` | `/progress/body` |  | studentId? |  |

### Execução de treino

| Método | Rota | Corpo | Query | Descrição |
| --- | --- | --- | --- | --- |
| `POST` | `/sessions` | StartSessionDto |  |  |
| `GET` | `/sessions` |  | page?, pageSize?, studentId?, from?, to? |  |
| `GET` | `/sessions/{id}` |  |  |  |
| `POST` | `/sessions/{id}/sets` | LogSetDto |  |  |
| `DELETE` | `/sessions/{id}/sets/{setId}` |  |  |  |
| `POST` | `/sessions/{id}/finish` | FinishSessionDto |  |  |
| `POST` | `/sessions/{id}/abandon` |  |  |  |

### Alunos

| Método | Rota | Corpo | Query | Descrição |
| --- | --- | --- | --- | --- |
| `GET` | `/students` |  | search?, status?, goal?, level?, inactiveDays?, sort? |  |
| `POST` | `/students` | CreateStudentDto |  |  |
| `GET` | `/students/me` |  |  |  |
| `PATCH` | `/students/me` | StudentProfileDto |  |  |
| `GET` | `/students/{id}` |  |  |  |
| `PATCH` | `/students/{id}` | StudentProfileDto |  |  |
| `PATCH` | `/students/{id}/link` | UpdateLinkDto |  |  |

### Professores

| Método | Rota | Corpo | Query | Descrição |
| --- | --- | --- | --- | --- |
| `GET` | `/trainers/me` |  |  |  |
| `PATCH` | `/trainers/me` | UpdateTrainerDto |  |  |
| `GET` | `/trainers/{id}` |  |  |  |
| `POST` | `/trainers/{id}/reviews` | ReviewDto |  |  |

### Treinos

| Método | Rota | Corpo | Query | Descrição |
| --- | --- | --- | --- | --- |
| `GET` | `/workouts` |  | studentId?, templates? |  |
| `POST` | `/workouts` | SaveWorkoutDto |  |  |
| `GET` | `/workouts/mine` |  |  |  |
| `GET` | `/workouts/today` |  |  |  |
| `GET` | `/students/{studentId}/workouts` |  |  |  |
| `GET` | `/workouts/{id}` |  |  |  |
| `PUT` | `/workouts/{id}` | SaveWorkoutDto |  |  |
| `DELETE` | `/workouts/{id}` |  |  |  |
| `POST` | `/workouts/{id}/duplicate` |  |  |  |
| `POST` | `/workouts/{id}/assign` | AssignWorkoutDto |  |  |
| `DELETE` | `/workouts/{id}/assign/{studentId}` |  |  |  |

### Administração

| Método | Rota | Corpo | Query | Descrição |
| --- | --- | --- | --- | --- |
| `GET` | `/admin/metrics` |  |  |  |
| `GET` | `/admin/users` |  | page?, pageSize?, role?, search? |  |
| `GET` | `/admin/subscriptions` |  | status? |  |
| `POST` | `/admin/subscriptions/{id}/payments` | ManualPaymentDto |  |  |
| `GET` | `/admin/plans` |  |  |  |
| `POST` | `/admin/plans` | PlanDto |  |  |
| `PATCH` | `/admin/plans/{id}` | UpdatePlanDto |  |  |

### IA (sugestões ao professor)

| Método | Rota | Corpo | Query | Descrição |
| --- | --- | --- | --- | --- |
| `GET` | `/ai/suggestions` |  | studentId?, status? |  |
| `POST` | `/ai/analyze` |  | studentId? |  |
| `POST` | `/ai/suggestions/{id}/approve` |  |  |  |
| `POST` | `/ai/suggestions/{id}/reject` |  |  |  |

### Chat

| Método | Rota | Corpo | Query | Descrição |
| --- | --- | --- | --- | --- |
| `GET` | `/conversations` |  |  |  |
| `POST` | `/conversations/question` | QuestionDto |  |  |
| `GET` | `/conversations/{id}/messages` |  | before?, limit? |  |
| `POST` | `/conversations/{id}/messages` | SendMessageDto |  |  |
| `POST` | `/conversations/{id}/attachments` | multipart (file) |  |  |
| `POST` | `/conversations/{id}/read` |  |  |  |

### Dashboards

| Método | Rota | Corpo | Query | Descrição |
| --- | --- | --- | --- | --- |
| `GET` | `/dashboard/trainer` |  |  |  |
| `GET` | `/dashboard/student` |  |  |  |

### Anotações do professor

| Método | Rota | Corpo | Query | Descrição |
| --- | --- | --- | --- | --- |
| `GET` | `/students/{studentId}/notes` |  |  |  |
| `POST` | `/students/{studentId}/notes` | CreateNoteDto |  |  |
| `PATCH` | `/notes/{id}` | UpdateNoteDto |  |  |
| `DELETE` | `/notes/{id}` |  |  |  |

### Relatórios

| Método | Rota | Corpo | Query | Descrição |
| --- | --- | --- | --- | --- |
| `GET` | `/reports/weekly` |  | studentId? |  |
| `POST` | `/reports/weekly` | GenerateReportDto |  |  |

### Agenda

| Método | Rota | Corpo | Query | Descrição |
| --- | --- | --- | --- | --- |
| `GET` | `/appointments` |  | from, to |  |
| `POST` | `/appointments` | CreateAppointmentDto |  |  |
| `POST` | `/appointments/slots` | CreateSlotsDto |  |  |
| `POST` | `/appointments/request` | RequestAppointmentDto |  |  |
| `POST` | `/appointments/{id}/book` | CancelDto |  |  |
| `POST` | `/appointments/{id}/confirm` |  |  |  |
| `POST` | `/appointments/{id}/reschedule` | RescheduleDto |  |  |
| `POST` | `/appointments/{id}/cancel` | CancelDto |  |  |
| `POST` | `/appointments/{id}/complete` |  |  |  |
| `DELETE` | `/appointments/{id}` |  |  |  |

## Webhooks de pagamento

`POST /webhooks/payments/:provider` 🌐 recebe eventos do gateway configurado em `PAYMENT_PROVIDER`:

| Gateway | Autenticação | Eventos tratados |
| --- | --- | --- |
| Stripe | Header `Stripe-Signature` (HMAC, `STRIPE_WEBHOOK_SECRET`) | `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted` |
| Mercado Pago | Consulta o recurso na API com o access token | `subscription_preapproval`, `subscription_authorized_payment` |
| Asaas | Header `asaas-access-token` (`ASAAS_WEBHOOK_TOKEN`) | `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`, `PAYMENT_OVERDUE` |

## Jobs agendados (fuso `APP_TIMEZONE`, padrão America/Sao_Paulo)

| Job | Quando | Efeito |
| --- | --- | --- |
| Lembrete de treino | a cada 5 min | "Seu treino começa em 1 hora." para agendamentos confirmados |
| Inatividade | diariamente 10:00 | "Você está há N dias sem treinar." (3, 7, 14 e 30 dias) |
| Análise da IA | diariamente 06:00 | Sugestões pendentes para o professor (nunca aplicadas sem aprovação) |
| Relatório semanal | segundas 07:00 | Resumo da semana anterior de cada aluno |
