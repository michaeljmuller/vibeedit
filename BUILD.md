# Build Instructions

## Prerequisites

- Docker (no other software dependencies)
- The following dictionary files from a Mac:
  - portuguese / english
- API keys for:
  - Open AI (ChatGPT)
  - Anthropic (Claude)

## 1. Download the dictionary files

Launch the Dictionary app on a Mac.  Go to Dictionary --> Settings in the menu bar and check the following:

- Oxford Portuguese Dictionary
- Oxford Paravia Il Dizionario

## 2. Locate the dictionary file

Locate each dictionary's Body.data file:

```
find /System/Library/AssetsV2/com_apple_MobileAsset_DictionaryServices_dictionaryOSX \
  -name Body.data | grep -i portuguese
```

## 3. Copy the dictionary files to the project

cp <portuguese-path>/Body.data <project-dir>/data/portuguese-english-dictionary.data
cp <italian-path>/Body.data <project-dir>/data/italian-english-dictionary.data


## 4. Build and run

```
docker compose build \
  --build-arg ANTHROPIC_API_KEY=<your-anthropic-key> \
  --build-arg OPENAI_API_KEY=<your-openai-key>

docker compose up
```

Once things are working, you can use -d to run in the background.