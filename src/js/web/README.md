web

The VibeEdit app: an Express server (server.js) that handles Google sign-in and the
LLM, dictionary and conjugation APIs, and serves the Vite/React client (client/)
built into dist/.

languages/   per-language conjugation scrapers and Apple Dictionary readers
prompts/     system prompts, one per language, plus the reviewer prompt

Built and run only in a container: see src/docker/web/Dockerfile and docs/setup.txt.
