FROM ghcr.io/m1k1o/neko/chromium@sha256:270face8b8111e639744fb7bcdbbf0deed227900bb89d58b2f8adfc12af8c41e
# Keep the upstream desktop setup and add CDP to its existing Chromium command.
# A non-default user data directory also supports Chromium's debugging policy.
RUN sed -i 's|--user-data-dir=/home/neko/.config/chromium|--user-data-dir=/home/neko/.config/chromium/mcp --remote-debugging-port=9222 --remote-debugging-address=127.0.0.1|' /etc/neko/supervisord/chromium.conf \
    && grep -q -- '--remote-debugging-port=9222' /etc/neko/supervisord/chromium.conf
# Upstream disables DevTools by policy: CDP discovery works but page attachment
# fails. Enable DevTools for this automation browser; CDP stays on loopback.
RUN sed -i 's/"DeveloperToolsAvailability": 2/"DeveloperToolsAvailability": 1/' /etc/chromium/policies/managed/policies.json \
    && grep -q '"DeveloperToolsAvailability": 1' /etc/chromium/policies/managed/policies.json
