#!/bin/sh
cd "$(dirname "$0")" || exit 1
exec ./node_modules/.bin/electron desktop/main.mjs
