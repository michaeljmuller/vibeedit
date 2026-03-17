# Build Instructions

## Prerequisites

- Docker (no other dependencies required)
- macOS with the Portuguese - English dictionary installed

## 1. Copy the dictionary file

Locate the dictionary's Body.data file and copy it into the project:

```
find /System/Library/AssetsV2/com_apple_MobileAsset_DictionaryServices_dictionaryOSX \
  -path "*/Portuguese - English.dictionary/Contents/Resources/Body.data" \
  | xargs -I{} cp {} data/portuguese-english-dictionary.data
```

## 2. Build and run

```
docker compose build \
  --build-arg ANTHROPIC_API_KEY=<your-anthropic-key> \
  --build-arg OPENAI_API_KEY=<your-openai-key>

docker compose up
```
