#!/bin/bash

# Default port if not specified
DEFAULT_PORT=48333
PORT=${CHROME_DEBUG_PORT:-$DEFAULT_PORT}

# Validate port is within range
if [ "$PORT" -lt 48000 ] || [ "$PORT" -gt 49000 ]; then
    echo "Port $PORT is outside the allowed range (48000-49000). Using default port $DEFAULT_PORT."
    PORT=$DEFAULT_PORT
fi

echo "Starting Chrome with remote debugging on port $PORT"

# Start nginx in background
nginx -g "daemon on;"

# Start Chrome in headless mode with remote debugging
exec google-chrome-stable \
    --headless \
    --no-sandbox \
    --disable-gpu \
    --disable-dev-shm-usage \
    --disable-web-security \
    --disable-extensions \
    --disable-plugins \
    --disable-images \
    --virtual-time-budget=5000 \
    --run-all-compositor-stages-before-draw \
    --disable-background-timer-throttling \
    --disable-renderer-backgrounding \
    --disable-backgrounding-occluded-windows \
    --remote-debugging-address=0.0.0.0 \
    --remote-debugging-port=$PORT