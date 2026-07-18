FROM node:22-alpine
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --omit=dev

COPY . .

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

USER node
CMD ["node", "index.js"]
