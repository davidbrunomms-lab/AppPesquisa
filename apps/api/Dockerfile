# Build a partir da raiz do monorepo: docker build -f apps/api/Dockerfile .
FROM node:22-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN npm ci --workspace @personalpro/api --workspace @personalpro/shared --include-workspace-root
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build -w @personalpro/shared \
 && npx --workspace @personalpro/api prisma generate \
 && npm run build -w @personalpro/api \
 && npm prune --omit=dev --workspace @personalpro/api --workspace @personalpro/shared

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=build /repo/node_modules node_modules
COPY --from=build /repo/packages/shared/package.json packages/shared/
COPY --from=build /repo/packages/shared/dist packages/shared/dist
COPY --from=build /repo/apps/api/package.json apps/api/
COPY --from=build /repo/apps/api/dist apps/api/dist
COPY --from=build /repo/apps/api/prisma apps/api/prisma
WORKDIR /repo/apps/api
USER node
EXPOSE 3333
# Aplica migrações pendentes (não destrutivo) e inicia a API
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
