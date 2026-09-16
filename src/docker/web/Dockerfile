# Build context = the repository root, so that .git is reachable (see below).

# Stage one only reads git. Nothing but the two lines it writes reaches the final
# image, so the app carries neither a git binary nor the object database.
FROM alpine/git AS version
COPY .git /src/.git
RUN git -C /src rev-parse --short HEAD > /version.txt \
 && git -C /src log -1 --format=%cI >> /version.txt

FROM node:20-alpine AS builder
WORKDIR /app
# Manifest first so the npm layer is reused when only source changes.
COPY src/js/web/package.json ./
RUN npm install
COPY src/js/web/ ./
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json /app/server.js /app/RELEASE-NOTES.txt ./
COPY --from=builder /app/languages ./languages
COPY --from=builder /app/prompts ./prompts
# Last, so that a new commit does not invalidate the layers above it.
COPY --from=version /version.txt ./VERSION

# Plain HTTP; Caddy terminates TLS in front of this on the host.
# API keys and dictionaries are supplied at runtime by compose, not baked in.
EXPOSE 3000
CMD ["node", "server.js"]
