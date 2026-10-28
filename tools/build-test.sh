#!/bin/bash
# Build tools/test.html from ../src.html with CDN three.js swapped for local node_modules (offline tests).
# Served from the repo root (see tools/serve.js) so relative assets/ paths resolve via <base href="/">.
set -e
cd "$(dirname "$0")"
{
  echo '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><base href="/"></head><body>'
  sed -e 's#https://cdn.jsdelivr.net/npm/three@0.147.0/build/three.min.js#tools/node_modules/three/build/three.min.js#' \
      -e 's#https://cdn.jsdelivr.net/npm/three@0.147.0/examples/js/effects/OutlineEffect.js#tools/node_modules/three/examples/js/effects/OutlineEffect.js#' ../src.html
  echo '</body></html>'
} > test.html
grep -q 'cdn.jsdelivr' test.html && { echo "CDN url left in test.html"; exit 1; } || echo "test.html built"
