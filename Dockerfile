FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS build
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile --config.dangerouslyAllowAllBuilds=true
ARG VITE_CLERK_PUBLISHABLE_KEY="pk_test_a2V5LWNhcmlib3UtNDk4NC5jbGVyay5hY2NvdW50cy5kZXYk"
ENV VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY
ENV PORT=8080
ENV BASE_PATH="/"
RUN pnpm --filter @workspace/api-server run build && pnpm --filter @workspace/sparky run build

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
ENV PUBLIC_DIR=/app/public

COPY --from=build /app/artifacts/api-server/dist ./dist
COPY --from=build /app/artifacts/sparky/dist/public ./public

EXPOSE 8080
CMD ["node", "--enable-source-maps", "./dist/index.mjs"]
