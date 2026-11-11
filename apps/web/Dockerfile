# Default: Docker Hub. Mirror: NODE_IMAGE=docker.arvancloud.ir/library/node:20-bookworm-slim
# Pin linux/amd64 — alpine/mirror images often cause "exec format error" on Windows Docker.
ARG NODE_IMAGE=node:20-bookworm-slim
FROM --platform=linux/amd64 ${NODE_IMAGE}

WORKDIR /app

ENV NPM_CONFIG_FETCH_RETRIES=5 \
    NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=20000 \
    NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=120000 \
    NPM_CONFIG_FETCH_TIMEOUT=300000

COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY . .

EXPOSE 3050

ENV HOSTNAME=0.0.0.0
ENV PORT=3050
ENV WATCHPACK_POLLING=true

CMD ["npm", "run", "dev"]
