# The conjugation companion container: the conjugate-api library behind its HTTP
# wrapper. The library is Python and the app is Node, so it runs beside the app
# rather than inside its image (see src/js/web/README.md).
#
# No build context is needed: the library is installed from GitHub.
FROM python:3.12-slim

# The library's commit, or "main" for whatever the branch head is. There are no
# releases and no pinned version. update.sh passes the current commit so this
# layer is rebuilt when the library has moved and reused when it has not.
ARG LIB_REV=main
RUN pip install --no-cache-dir \
    "conjugate-api[server] @ https://github.com/michaeljmuller/conjugate-lib/archive/${LIB_REV}.tar.gz#subdirectory=src/python/conjugate_api"

# Plain HTTP on this stack's compose network only. No host port, no sign-in.
EXPOSE 8000
CMD ["uvicorn", "conjugate_api.server:app", "--host", "0.0.0.0", "--port", "8000"]
