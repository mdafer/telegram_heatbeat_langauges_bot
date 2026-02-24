# Getting Started

## 1. Create Your Telegram Bot

1. Open Telegram and search for **@BotFather**
2. Send `/newbot`
3. Choose a name (e.g. "My Language Buddy")
4. Choose a username (must end in `bot`, e.g. `my_language_buddy_bot`)
5. BotFather gives you a token like `7123456789:AAH...` — copy it

## 2. Get a Free AI API Key

You only need **one** of these. OpenRouter is recommended since one key gives you access to multiple free models.

### Option A: OpenRouter (recommended)

1. Go to https://openrouter.ai
2. Sign up (GitHub/Google/email)
3. Go to https://openrouter.ai/keys
4. Click **Create Key**
5. Copy the key (starts with `sk-or-...`)

This gives you free access to DeepSeek R1, Llama 3.3 70B, and many more via the `/ai` command.

### Option B: Google Gemini

1. Go to https://aistudio.google.com/apikey
2. Sign in with your Google account
3. Click **Create API Key**
4. Copy the key

### Option C: Groq

1. Go to https://console.groq.com
2. Sign up
3. Go to **API Keys** in the sidebar
4. Click **Create API Key**
5. Copy the key

## 3. Get Your Admin Chat ID

This lets you use admin commands (`/users`, `/userreport`, `/broadcast`).

1. Open Telegram and search for **@userinfobot**
2. Send `/start`
3. It replies with your account info — copy the **Id** number (e.g. `123456789`)

Alternatively, search for **@RawDataBot**, send `/start`, and look for `"id"` under `"chat"`.

## 4. Install & Configure

```bash
git clone <your-repo-url>
cd telegram-heartbeat
yarn install
```

Create your `.env` file:

```bash
cp .env.example .env
```

Open `.env` and fill in your keys:

```env
TELEGRAM_TOKEN=7123456789:AAHxxx...
ADMIN_CHAT_ID=123456789

# Pick one:
OPENROUTER_API_KEY=sk-or-xxx...
# GOOGLE_API_KEY=AIza...
# GROQ_API_KEY=gsk_...
```

## 5. Start the Bot

```bash
yarn start
```

You should see `Bot started.` in the terminal.

## 6. Talk to Your Bot

1. Open Telegram and search for your bot's username
2. Send `/start`
3. The bot asks what language you want to learn — type it (e.g. "Spanish")
4. Start chatting! The bot teaches you the most common everyday phrases

## Useful Commands

| Command | What it does |
|---------|--------------|
| `/ai` | Pick a different AI model |
| `/tts` | Turn voice messages on/off |
| `/report` | See your learning progress |
| `/help` | Show all commands |
| `/pause` | Stop proactive messages |
| `/status` | Check current settings |

## Running in the Background

To keep the bot running after you close the terminal:

```bash
# Using pm2 (install once: yarn global add pm2)
pm2 start index.js --name heartbeat
pm2 save

# Or using nohup
nohup yarn start > bot.log 2>&1 &
```

## Troubleshooting

**Bot doesn't respond**: Check that `TELEGRAM_TOKEN` is correct. Make sure no other instance is running (only one can poll at a time).

**AI errors**: Verify your API key is set correctly in `.env`. Try switching models with `/ai` in Telegram.

**TTS not working**: TTS uses Edge TTS which needs internet access. No API key needed — it just works.

**Database issues**: Delete `data/bot.db` to start fresh (all user data will be lost).
