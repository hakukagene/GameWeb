FROM node:24-bookworm-slim
WORKDIR /app
COPY --chown=node:node package.json ./
COPY --chown=node:node server ./server
COPY --chown=node:node scripts ./scripts
COPY --chown=node:node dist ./dist
USER node
ENV NODE_ENV=production
CMD ["node", "server/index.mjs"]
