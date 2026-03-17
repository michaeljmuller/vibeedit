FROM node:20-alpine AS builder

WORKDIR /app
COPY package.json .
RUN npm install
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json .
COPY --from=builder /app/server.js .
COPY --from=builder /app/languages ./languages
COPY --from=builder /app/data/portuguese-english-dictionary.data ./data/portuguese-english-dictionary.data

ARG ANTHROPIC_API_KEY
ARG OPENAI_API_KEY
RUN test -n "$ANTHROPIC_API_KEY" || (echo "ERROR: ANTHROPIC_API_KEY build arg is required" && exit 1) && \
    test -n "$OPENAI_API_KEY"    || (echo "ERROR: OPENAI_API_KEY build arg is required"    && exit 1) && \
    printf "ANTHROPIC_API_KEY=%s\nOPENAI_API_KEY=%s\n" "$ANTHROPIC_API_KEY" "$OPENAI_API_KEY" > .apikey

EXPOSE 3000
CMD ["node", "server.js"]
