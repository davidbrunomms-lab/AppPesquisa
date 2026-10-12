# PersonalPro

Plataforma SaaS para **personal trainers** e **alunos de academia** — iOS, Android e Web.

O professor cadastra e acompanha alunos, prescreve treinos, registra avaliações físicas,
define metas, gerencia a agenda e conversa com cada aluno. O aluno executa os treinos
registrando cargas e repetições, acompanha a evolução e fala com o professor.
Após o login, o sistema reconhece o perfil (aluno, professor ou administrador) e abre o
painel correspondente.

| Pasta | Conteúdo |
| --- | --- |
| [`apps/api`](apps/api) | API REST NestJS + Prisma + PostgreSQL (Clean Architecture) |
| [`apps/mobile`](apps/mobile) | App iOS/Android em React Native + Expo (Expo Router) |
| [`apps/web`](apps/web) | Versão web (aluno e professor) e painel administrativo em Next.js + Tailwind |
| [`packages/shared`](packages/shared) | Enums, contratos da API e regras de negócio puras (com testes) |
| [`docs`](docs) | Arquitetura, banco de dados, API, segurança/LGPD |

## Documentação

- [Arquitetura e estrutura de pastas](docs/ARCHITECTURE.md)
- [Banco de dados (PostgreSQL / Prisma)](docs/DATABASE.md) — schema em [`apps/api/prisma/schema.prisma`](apps/api/prisma/schema.prisma)
- [Referência da API REST](docs/API.md) — Swagger em `http://localhost:3333/docs`
- [Segurança e LGPD](docs/SECURITY_LGPD.md)

## Como rodar

Pré-requisitos: Node.js 22+, Docker (ou PostgreSQL 16 local).

```bash
npm install                         # instala todos os workspaces
cp apps/api/.env.example apps/api/.env
npm run db:up                       # PostgreSQL via docker compose
npm run build:shared                # compila @personalpro/shared
npm run db:migrate                  # aplica as migrações
npm run db:seed                     # planos, biblioteca de exercícios, admin e contas demo
npm run dev:api                     # API em http://localhost:3333 (Swagger em /docs)
npm run dev:web                     # Web em http://localhost:3000
npm run dev:mobile                  # Expo (abra no Expo Go / emulador)
```

Contas demo criadas pelo seed (somente fora de produção):

| Perfil | E-mail | Senha |
| --- | --- | --- |
| Professor | `professor@demo.personalpro.app` | `Demo12345` |
| Aluno | `joao@demo.personalpro.app` | `Demo12345` |
| Aluno | `ana@demo.personalpro.app` | `Demo12345` |
| Admin | `admin@personalpro.app` | `Admin12345` |

Código de convite do professor demo: `DEMO01`.

> No app mobile, defina `EXPO_PUBLIC_API_URL` com o IP da sua máquina na rede
> (ex.: `http://192.168.0.10:3333`) para acessar a API a partir do celular.

## Publicar na internet (Render)

O arquivo [`render.yaml`](render.yaml) cria tudo em um clique — banco PostgreSQL, API e versão web:

1. Crie uma conta em [render.com](https://render.com) e conecte o GitHub.
2. **New + → Blueprint** → selecione este repositório e a branch.
3. Informe `SEED_ADMIN_PASSWORD` (senha do administrador) e confirme.
4. Ao terminar, acesse `https://personalpro-web.onrender.com` (também pelo navegador do celular).

Observações do plano gratuito: os serviços "dormem" após 15 min sem uso (o primeiro acesso leva ~1 min),
o PostgreSQL gratuito expira após 30 dias e os uploads ficam em disco temporário — para uso real,
use planos pagos e `STORAGE_DRIVER=s3`. Com `SEED_DEMO=true` as contas demo são criadas; troque para
`false` antes de cadastrar clientes reais.

## Testes

```bash
npm test -w @personalpro/shared        # regras de negócio (IMC, metas, volume, frequência, IA…)
npm test -w @personalpro/api           # unitários da API
npm run test:e2e -w @personalpro/api   # fluxos ponta a ponta contra PostgreSQL
```

Os testes e2e usam o banco de `TEST_DATABASE_URL` (padrão `personalpro_test`) e criam um
schema exclusivo por execução, removido ao final.

## Integrações configuráveis (`apps/api/.env`)

| Recurso | Variáveis | Sem configuração |
| --- | --- | --- |
| Login Google / Apple | `GOOGLE_CLIENT_IDS`, `APPLE_CLIENT_IDS` | apenas e-mail e senha |
| E-mail | `SMTP_URL`, `MAIL_FROM` | e-mails registrados no log |
| Arquivos | `STORAGE_DRIVER=s3`, `S3_*` (AWS S3, Supabase Storage, R2) | disco local em `./uploads` |
| Push | `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY` | push registrado no log |
| IA generativa | `AI_PROVIDER=openai-compatible`, `AI_API_URL`, `AI_API_KEY`, `AI_MODEL` | motor de regras local |
| Pagamentos | `PAYMENT_PROVIDER=stripe \| mercado_pago \| asaas` + chaves | cobrança manual |
