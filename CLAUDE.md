Assume Docker is installed.  All other build and runtime dependencies should run in containers.
There should be no need to install anything additional to run on the host.  Persistence
can be accomplished through volumes shared to the host.  Do not install anything on the host for the
purpose of building and running the application.

The target execution environment of the application is linux/intel, but it should also run in the
development envrironment (mac/arm).

When writing commit messages or documentation, do not use emojis unless their use is fundamental
to conveying a particular point.  When committing changes, don't add "co-authored" comments.

Don't commit without permission.  