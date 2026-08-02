FROM node:22-slim AS deps
WORKDIR /repo
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/shared-types packages/shared-types
COPY apps/api apps/api
RUN pnpm --filter @discharge-guide/api... build

FROM node:22-slim AS runtime
WORKDIR /repo
ENV NODE_ENV=production

COPY --from=deps /repo/node_modules node_modules
COPY --from=deps /repo/apps/api/node_modules apps/api/node_modules
COPY --from=build /repo/packages/shared-types packages/shared-types
COPY --from=build /repo/apps/api/dist apps/api/dist

WORKDIR /repo/apps/api
EXPOSE 3001
CMD ["node", "dist/server.js"]
