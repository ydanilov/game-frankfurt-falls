#!/bin/bash
# Regenerate ../index.html (full page for Vercel / GitHub Pages) from ../src.html (artifact body). Never edit index.html by hand.
set -e
cd "$(dirname "$0")/.."
{
  echo '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#7fd8ff"><meta name="author" content="Diego Danylov"><meta name="description" content="Frankfurt Falls: a floppy hotdog rage-climber. Climb the Chef'"'"'s food tower and free your buddies."><link rel="preload" as="image" href="assets/ff_title.webp" type="image/webp"></head><body>'
  cat src.html
  echo '</body></html>'
} > index.html
echo "index.html rebuilt ($(wc -c < index.html) bytes)"
