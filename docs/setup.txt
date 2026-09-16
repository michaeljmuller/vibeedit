# Build Instructions

## Prerequisites

- Docker (no other software dependencies)
- The following dictionary files from a Mac:
  - portuguese / english
- API keys for:
  - Open AI (ChatGPT)
  - Anthropic (Claude)
- A Google Cloud project with OAuth 2.0 credentials (see below)

## 1. Download the dictionary files

Launch the Dictionary app on a Mac.  Go to Dictionary --> Settings in the menu bar and check the following:

- Oxford Portuguese Dictionary
- Oxford Paravia Il Dizionario

## 2. Locate the dictionary files

Locate each dictionary's Body.data file:

```
find /System/Library/AssetsV2/com_apple_MobileAsset_DictionaryServices_dictionaryOSX \
  -name Body.data | grep -iE "portuguese|italian"
```

## 3. Copy the dictionary files to the project

cp <portuguese-path>/Body.data <project-dir>/data/portuguese-english-dictionary.data
cp <italian-path>/Body.data <project-dir>/data/italian-english-dictionary.data


## 4. Set up Google OAuth

See [Google Cloud Console setup](#google-cloud-console-setup) below for step-by-step instructions.


## 5. Add allowed users

Edit `config/allowed-emails.txt` and add one Google email address per line:

```
you@gmail.com
colleague@gmail.com
```


## 6. Create a .env file

```
ANTHROPIC_API_KEY=<your-anthropic-key>
OPENAI_API_KEY=<your-openai-key>
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>
SESSION_SECRET=<random-string>
# For production, set this to your public URL:
# GOOGLE_CALLBACK_URL=https://yourdomain.com/auth/google/callback
```

Generate a session secret with: `openssl rand -hex 32`


## 7. Build and run

```
docker compose build
docker compose up
```

Once things are working, you can use -d to run in the background.


---

## Google Cloud Console Setup

1. Go to [console.cloud.google.com](https://console.cloud.google.com)

2. **Create a project** (or select an existing one) using the project dropdown at the top.

3. **Enable the API:** Navigate to **APIs & Services → Library**, search for **"Google People API"**, and click **Enable**.

4. **Configure the consent screen:** Go to **APIs & Services → OAuth consent screen**.
   - Choose **External** (unless you have a Google Workspace org, in which case choose Internal — this is simpler as it skips the verification requirement and restricts to your org automatically).
   - Fill in App name (e.g. "VibeEdit"), User support email, and Developer contact email. Everything else can be left blank.
   - On the **Scopes** step, click **Save and Continue** (no extra scopes needed beyond the defaults).
   - On the **Test users** step: if you chose External, add your own email and any other allowed users here. While the app is in "Testing" status, only listed test users can log in. You can publish later if needed, but for a private tool, staying in Testing mode is fine.

5. **Create credentials:** Go to **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**.
   - Application type: **Web application**
   - Name: anything (e.g. "VibeEdit")
   - **Authorized redirect URIs:** add `http://localhost:3000/auth/google/callback` (and your production URL if applicable, e.g. `https://yourdomain.com/auth/google/callback`)
   - Click **Create**

6. Copy the **Client ID** and **Client Secret** into your `.env` file.
