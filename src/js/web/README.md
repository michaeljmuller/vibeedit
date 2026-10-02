web

The VibeEdit app: an Express server (server.js) that handles Google sign-in and the
LLM, dictionary and conjugation APIs, and serves the Vite/React client (client/)
built into dist/.

languages/   per-language Apple Dictionary readers, and the conjugation layout
             (conjugation.js)
prompts/     system prompts, one per language, plus the reviewer prompt

Conjugation

The app does not look verbs up itself. That is done by the conjugate-api library, which is
Python, so it runs as a second container ("conjugation" in src/docker/docker-compose.yml).
Its image (src/docker/conjugation/Dockerfile) installs the library from the head of the main
branch of github.com/michaeljmuller/conjugate-lib; there are no releases or pinned versions. languages/conjugation.js asks it for a
verb over HTTP on the compose network and lays the answer out for the client.

Running it as a container, not as a command inside this image, was a deliberate choice for
encapsulation over the simpler option; the reasoning, and the notes on which site each
language is read from, are in that repo's docs (design.txt and sources.txt). The
container belongs to this stack only: no host port, no sign-in, nothing stored. If the
source site is down, the Conjugate panel fails until it is back.

Built and run only in a container: see src/docker/web/Dockerfile and docs/setup.txt.
