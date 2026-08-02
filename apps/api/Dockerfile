FROM node:20-slim AS base
WORKDIR /repo

FROM base AS deps
COPY package.json package-lock.json ./
COPY packages/shared-types/package.json packages/shared-types/
COPY apps/api/package.json apps/api/
RUN npm ci

FROM deps AS build
COPY packages/shared-types packages/shared-types
COPY apps/api apps/api
RUN npm run build -w packages/shared-types \
 && npm run build -w apps/api

FROM base AS runtime
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY packages/shared-types/package.json packages/shared-types/
COPY apps/api/package.json apps/api/
RUN npm ci --omit=dev
COPY --from=build /repo/packages/shared-types/dist packages/shared-types/dist
COPY --from=build /repo/apps/api/dist apps/api/dist

WORKDIR /repo/apps/api
EXPOSE 3000
# dist/index.js is the Express entry point (owned by the API/platform side of
# the backend split) — build fails here until that file exists.
CMD ["node", "dist/index.js"]
