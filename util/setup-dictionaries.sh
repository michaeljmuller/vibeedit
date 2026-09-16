#!/bin/sh
# Copies the Apple Dictionary data files the app reads into data/.
# Run on a Mac after enabling the dictionaries in Dictionary > Settings:
#   Oxford Portuguese Dictionary, Oxford Paravia Il Dizionario
# Usage: util/setup-dictionaries.sh [dest-dir]   (default: data/ in the repo)

set -eu

ASSET_BASE=/System/Library/AssetsV2/com_apple_MobileAsset_DictionaryServices_dictionaryOSX
DEST=${1:-"$(cd "$(dirname "$0")/.." && pwd)/data"}
mkdir -p "$DEST"

status=0

# copy <bundle name> <output file name>
copy() {
  out="$DEST/$2"
  if [ -f "$out" ]; then
    echo "ok       $1 (already present)"
    return
  fi
  src=$(find "$ASSET_BASE" -path "*/$1/Contents/Resources/Body.data" 2>/dev/null | head -n 1)
  if [ -z "$src" ]; then
    echo "missing  $1: enable it in Dictionary > Settings, wait for the download, re-run"
    status=1
    return
  fi
  cp "$src" "$out"
  echo "copied   $1 -> $out"
}

copy "Portuguese - English.dictionary" portuguese-english-dictionary.data
copy "Italian - English.dictionary" italian-english-dictionary.data

exit $status
