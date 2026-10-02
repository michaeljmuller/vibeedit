#!/usr/bin/env bash
# Pull the latest commit and restart the stack with it.
#
# Run on the server. Compose is invoked from src/docker/ so it picks up the
# .env sitting next to docker-compose.yml. The stack goes down before the pull
# so the running containers never straddle two commits, and the build stamps
# the freshly pulled commit into the image.
set -euo pipefail

cd "$(dirname "$0")/src/docker"

podman compose down
git pull
# The conjugation library is installed from the head of its main branch. Its
# current commit goes to the build so the layer that installs it is rebuilt
# when the library has moved, and reused when it has not.
LIB_REV=$(git ls-remote https://github.com/michaeljmuller/conjugate-lib.git refs/heads/main | cut -f1)
export LIB_REV
podman compose build
podman compose up -d
