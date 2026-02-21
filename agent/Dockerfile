FROM node:22-slim AS base

WORKDIR /app

# ── Dependencies ──────────────────────────────────────────────
FROM base AS deps

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ── Build ─────────────────────────────────────────────────────
FROM base AS build

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ src/
RUN npm run build

# ── Production image ──────────────────────────────────────────
FROM base AS runtime

ENV NODE_ENV=production
ENV PORT=3001

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./

EXPOSE 3001

CMD ["node", "dist/index.js"]
