# Reson8 Web Client — containerized static build (P7.8 deployment option B).
#
# This image serves the built SPA only — it has no backend of its own and
# does not terminate TLS (same expectation the reson8 server itself has:
# see DEPLOYMENT.md and ../reson8/docker-compose.cloudflared.yml). Put this
# behind a TLS-terminating reverse proxy or tunnel in any real deployment;
# HTTPS is not optional for this app (getUserMedia/service worker/Badging
# API all require a secure context).

# ── Build stage ──────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Runtime stage ────────────────────────────────────────────────────────
FROM nginx:1.27-alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
