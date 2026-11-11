FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Baked into the build: the Next.js server proxies /api/* to the API service.
ARG API_INTERNAL_URL=http://api:8000
ARG NEXT_PUBLIC_TILES_STREETS=
ENV API_INTERNAL_URL=$API_INTERNAL_URL \
    NEXT_PUBLIC_TILES_STREETS=$NEXT_PUBLIC_TILES_STREETS \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000 NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]
