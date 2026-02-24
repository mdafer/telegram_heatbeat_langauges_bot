# Telegram Heartbeat Bot

A generic Telegram companion bot with AI-driven proactive messaging, free AI models, and text-to-speech.

## Modes

- **AI** — LangChain-powered responses with a system prompt that evolves over the conversation
- **Predefined** — cycles through a preset list of replies and random proactive messages

## AI Models

Users choose their model in Telegram via `/ai`:

| Provider | Model | Cost | API Key |
|----------|-------|------|---------|
| OpenRouter Auto | Best available free model | Free | `OPENROUTER_API_KEY` |
| DeepSeek R1 | deepseek-r1 via OpenRouter | Free | `OPENROUTER_API_KEY` |
| Llama 3.3 70B | llama-3.3-70b via OpenRouter | Free | `OPENROUTER_API_KEY` |
| Gemini Flash | gemini-2.0-flash-lite | Free | `GOOGLE_API_KEY` |
| Groq | llama-3.3-70b-versatile | Free | `GROQ_API_KEY` |
| OpenAI | gpt-4o-mini | Paid | `OPENAI_API_KEY` |

Default is **OpenRouter Auto** — one free API key unlocks all free models.

## Setup

```bash
cp .env.example .env    # fill in your tokens
yarn install
yarn start
```

Get free API keys:
- **OpenRouter** (recommended): https://openrouter.ai/keys
- **Gemini**: https://ai.google.dev/tutorials/setup
- **Groq**: https://console.groq.com

## Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome + language selection |
| `/help` | Show all commands |
| `/ai` | Choose AI model (inline buttons) |
| `/tts` | Toggle voice messages on/off |
| `/report` | View learning progress report |
| `/language <lang>` | Change target language |
| `/mode ai\|predefined` | Switch response mode |
| `/preset <name>` | Switch preset (clears history) |
| `/pause` / `/resume` | Toggle proactive messages |
| `/reset` | Clear conversation history |
| `/status` | Show current settings |

## How It Works

1. User starts the bot and picks a language to learn
2. AI focuses on the top 500 most common phrases (~80% of daily usage)
3. After each interaction, AI decides when to proactively reach out (30min–24h)
4. Every 20 messages, the system prompt auto-evolves to better fit the user
5. `/report` generates a progress report with phrases learned, level, and next steps
6. `/tts` enables voice messages using Edge TTS (free, no API key needed)

## Text-to-Speech

Toggle with `/tts`. Uses Microsoft Edge's TTS service — completely free, no API key.
Automatically picks a native voice for the target language (25+ languages supported).

## Creating Presets

Add a JSON file to `data/presets/`. Use `{language}` as a template variable:

```json
{
  "name": "My Preset",
  "system": "You help the user learn {language}...",
  "proactivePrompt": "Send a {language} practice exercise...",
  "predefined": {
    "replies": ["reply1", "reply2"],
    "proactive": ["proactive msg 1", "proactive msg 2"]
  }
}
```

Then: `/preset my-preset`

## Architecture

```
src/
  bot.js          Telegram bot + command handlers
  scheduler.js    Cron-based proactive message heartbeat
  store.js        SQLite persistence (users + history)
  llm.js          Multi-provider LLM abstraction (Gemini/Groq/OpenAI)
  tts.js          Edge TTS with language-aware voice selection
  presets.js      Preset config loader with caching
  modes/
    ai.js         LangChain responses, prompt evolution, AI-driven scheduling
    predefined.js Predefined message cycling
```
