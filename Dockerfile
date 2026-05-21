FROM node:22-slim

RUN apt-get update && apt-get install -y \
  chromium \
  build-essential \
  python3 \
  --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

ENV CHROMIUM_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

WORKDIR /app

COPY package*.json .npmrc* ./
RUN npm ci --legacy-peer-deps

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "run", "start"]
