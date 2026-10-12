# PersonalPro — Arquitetura

Plataforma SaaS para personal trainers e alunos de academia, disponível em **iOS, Android e Web**.

## Visão geral

```
                ┌──────────────────────┐     ┌──────────────────────┐
                │  apps/mobile (Expo)  │     │   apps/web (Next.js) │
                │  iOS · Android       │     │  Web · Painel admin  │
                └──────────┬───────────┘     └──────────┬───────────┘
                           │  HTTPS (REST + JWT)  ·  WebSocket (chat) │
                           └───────────────┬────────────────────────┘
                                           ▼
                         ┌────────────────────────────────────┐
                         │        apps/api (NestJS)           │
                         │ presentation → application → domain│
                         │            ↑ infrastructure        │
                         └──┬───────┬────────┬────────┬───────┘
                            │       │        │        │
                     PostgreSQL  Storage   FCM     Pagamentos / IA
                     (Prisma)   (S3/local) (push)  (Stripe, Mercado Pago, Asaas / LLM)

             packages/shared → enums, tipos de contrato e regras de negócio puras
                               (IMC, metas, volume, calorias, frequência, relatório
                               semanal, motor de regras da IA) usados por todos os apps.
```

| Camada            | Tecnologia                                                                 |
| ----------------- | -------------------------------------------------------------------------- |
| Mobile            | React Native + Expo (Expo Router, SecureStore, ImagePicker, Notifications) |
| Web / Admin       | Next.js (App Router) + Tailwind CSS                                        |
| API               | Node.js + NestJS 11 + TypeScript                                           |
| Banco             | PostgreSQL 16 + Prisma ORM                                                 |
| Autenticação      | JWT próprio (access 15 min + refresh rotativo), Google e Apple via ID token |
| Tempo real        | Socket.IO (chat)                                                           |
| Arquivos          | Driver local (dev) ou S3-compatível (AWS S3, Supabase Storage, R2)         |
| Push              | Firebase Cloud Messaging (HTTP v1)                                         |
| Jobs              | @nestjs/schedule (lembretes, inatividade, relatório semanal, IA)           |

> A autenticação foi implementada na própria API (JWT) para manter o isolamento
> multi-tenant e o controle de acesso em um único lugar. Supabase Auth / Firebase
> Auth / Clerk podem ser plugados implementando um novo `SocialTokenVerifier`.

## Estrutura de pastas

```
.
├── apps/
│   ├── api/                         # Backend NestJS (Clean Architecture)
│   │   ├── prisma/
│   │   │   ├── schema.prisma        # Modelo de dados
│   │   │   ├── migrations/          # Migrações SQL versionadas
│   │   │   └── seed.ts              # Planos, biblioteca de exercícios e usuários demo
│   │   ├── src/
│   │   │   ├── main.ts              # Bootstrap (helmet, CORS, validação, Swagger)
│   │   │   ├── app.module.ts
│   │   │   ├── config/              # Validação das variáveis de ambiente
│   │   │   ├── common/              # Cross-cutting
│   │   │   │   ├── auth/            # Guards JWT/roles, decorators @CurrentUser/@Roles/@Public
│   │   │   │   ├── access/          # AccessPolicy: isolamento professor ⇄ aluno
│   │   │   │   ├── crypto/          # Criptografia AES-256-GCM e hashing de tokens
│   │   │   │   ├── errors/          # Erros de domínio → HTTP
│   │   │   │   └── utils/
│   │   │   ├── infrastructure/      # Adaptadores externos (portas → implementações)
│   │   │   │   ├── prisma/
│   │   │   │   ├── storage/         # StoragePort: local | s3
│   │   │   │   ├── mail/            # MailPort: console | smtp
│   │   │   │   ├── push/            # PushPort: console | fcm
│   │   │   │   ├── ai/              # AiPort: rules | openai-compatible
│   │   │   │   └── payments/        # PaymentGatewayPort: manual | stripe | mercado_pago | asaas
│   │   │   └── modules/
│   │   │       └── <módulo>/
│   │   │           ├── domain/          # Regras e políticas puras do módulo (quando houver)
│   │   │           ├── application/     # Casos de uso (services), jobs e gateways de tempo real
│   │   │           └── presentation/    # Controllers REST + DTOs validados
│   │   └── test/                    # Testes e2e (Postgres real)
│   ├── mobile/                      # App Expo (iOS/Android)
│   │   └── src/
│   │       ├── app/                 # Rotas (Expo Router)
│   │       │   ├── (auth)/          # Login, cadastro, recuperação de senha
│   │       │   ├── aluno/(tabs)/    # Abas do aluno: Início, Treinos, Evolução, Agenda, Perfil
│   │       │   └── professor/(tabs)/ # Abas do professor: Dashboard, Alunos, Treinos, Agenda, Perfil
│   │       ├── components/          # UI (cards, gráficos, inputs, cronômetro…)
│   │       ├── features/            # Hooks e lógica por domínio
│   │       ├── lib/                 # Cliente HTTP, sessão, storage seguro
│   │       └── theme/               # Design tokens
│   └── web/                         # Next.js (versão web + painel administrativo)
│       └── src/app/
│           ├── (auth)/ · (student)/ · (trainer)/ · admin/
├── packages/
│   └── shared/                      # @personalpro/shared
│       └── src/
│           ├── enums.ts             # Enums + rótulos PT-BR
│           ├── types/api.ts         # Contratos da API
│           └── domain/              # Regras puras + testes
├── docs/
│   ├── ARCHITECTURE.md              # Este documento
│   ├── DATABASE.md                  # Modelo de dados e isolamento
│   ├── API.md                       # Referência REST (Swagger em /docs)
│   ├── SECURITY_LGPD.md             # Segurança, LGPD, política de privacidade
│   └── privacy-policy.md
└── docker-compose.yml               # PostgreSQL + API
```

## Clean Architecture na API

Fluxo de dependências: `presentation → application → domain`, com
`infrastructure` implementando as portas declaradas nas camadas internas.

- **domain** — regras de negócio puras e sem framework (a maior parte vive em
  `@personalpro/shared/domain` para ser reaproveitada no app e na web), além de
  erros de domínio (`DomainError`, `NotFoundError`, `ForbiddenError`…).
- **application** — casos de uso. Orquestram repositórios, políticas de acesso,
  notificações e regras de domínio. Não conhecem HTTP.
- **infrastructure** — S3, FCM, SMTP, gateways de pagamento e provedores de IA.
  Cada adaptador implementa uma *porta* (classe abstrata usada como token de
  injeção, em `src/infrastructure/*/*.port.ts`), permitindo trocar o provedor por
  configuração sem tocar nos casos de uso. Para persistência, o Prisma Client
  (via `PrismaService`) já atua como *data mapper* tipado; os casos de uso o
  utilizam diretamente em vez de uma camada extra de repositórios, e o
  isolamento multi-tenant fica centralizado no `AccessPolicyService`.
- **presentation** — controllers REST, DTOs com `class-validator` e
  documentação Swagger.

## Perfis e roteamento

Após o login a API retorna `user.role` (`STUDENT`, `TRAINER` ou `ADMIN`). Os
clientes redirecionam automaticamente:

| Perfil  | Mobile                                                   | Web                    |
| ------- | -------------------------------------------------------- | ---------------------- |
| Aluno   | Abas Início · Treinos · Evolução · Agenda · Perfil       | `/aluno`               |
| Professor | Abas Dashboard · Alunos · Treinos · Agenda · Perfil    | `/professor`           |
| Admin   | —                                                        | `/admin`               |

## Multi-tenancy (SaaS)

O *tenant* é o professor. Toda leitura/escrita de dados de aluno passa pelo
`AccessPolicyService`, que exige um vínculo `trainer_students` com status
`ACTIVE`/`PENDING` entre o professor autenticado e o aluno. O aluno acessa
apenas os próprios dados. Exercícios personalizados (`exercises.trainer_id`) e
fichas (`workouts.trainer_id`) são filtrados pelo professor dono. Anotações
privadas (`trainer_notes`) nunca são expostas a alunos.

## IA

`AiModule` executa diariamente o motor de regras (`@personalpro/shared/domain/ai-rules`)
e grava **sugestões** em `ai_suggestions` com status `PENDING`. O professor aprova
ou rejeita; somente após a aprovação explícita a sugestão de progressão de carga é
aplicada na ficha. O `AiPort` permite plugar um LLM (API compatível com OpenAI)
para redigir resumos e recomendações — sem permissão de escrita em treinos.

## Assinaturas

Planos (`plans`) definem `max_students`. A criação/vínculo de alunos verifica o
limite do plano ativo. O `PaymentGatewayPort` abstrai Stripe, Mercado Pago e
Asaas; webhooks atualizam `subscriptions` e `payments` (faturamento no painel
administrativo).
