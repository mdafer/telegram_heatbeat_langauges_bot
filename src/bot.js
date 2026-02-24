import TelegramBot from 'node-telegram-bot-api'
import { getUser, updateUser, clearHistory, addHistory, getAllUsers, getUserStats } from './store.js'
import { startScheduler } from './scheduler.js'
import { PROVIDERS } from './llm.js'
import { synthesize } from './tts.js'
import * as ai from './modes/ai.js'
import * as predefined from './modes/predefined.js'

const modes = { ai, predefined }
const ADMIN = process.env.ADMIN_CHAT_ID
const isAdmin = (chatId) => ADMIN && String(chatId) === String(ADMIN)

const typing = (bot, chatId) => bot.sendChatAction(chatId, 'typing')

const LISTEN_BTN = { reply_markup: { inline_keyboard: [[{ text: '🔊 Listen', callback_data: 'listen' }]] } }

const sendResponse = (bot, chatId, text) =>
  bot.sendMessage(chatId, text, LISTEN_BTN)

const menuText = (u) => `Learning: ${u.language || 'not set'} | My lang: ${u.userLanguage || 'English'} | AI: ${PROVIDERS[u.provider]?.name || u.provider}`

const menuKeyboard = (user, chatId) => {
  const ctx = user.summarizeAfter || 20
  const rows = [
    [{ text: '📊 Report', callback_data: 'act:report' }, { text: '🤖 AI Model', callback_data: 'act:ai' }],
    [{ text: `📖 Learning: ${user.language || '?'}`, callback_data: 'act:language' }, { text: `🏠 My lang: ${user.userLanguage || 'EN'}`, callback_data: 'act:mylang' }],
    [{ text: `🕐 TZ: ${user.timezone || 'UTC'}`, callback_data: 'act:timezone' }, { text: `📏 Context: ${ctx} msgs`, callback_data: 'act:context' }],
    [{ text: '📝 Prompt', callback_data: 'act:prompt' }, { text: `🗣 Mode: ${user.mode}`, callback_data: 'act:mode' }],
    [{ text: user.active ? '⏸ Pause' : '▶️ Resume', callback_data: 'act:pauseresume' }, { text: '🗑 Reset', callback_data: 'act:reset' }],
    [{ text: '📋 Status', callback_data: 'act:status' }, { text: '❓ Help', callback_data: 'act:help' }],
  ]
  if (isAdmin(chatId)) {
    rows.push([
      { text: '👥 Users', callback_data: 'act:users' },
      { text: '📢 Broadcast', callback_data: 'act:broadcast' },
    ])
  }
  rows.push([{ text: '❌ Close', callback_data: 'act:close' }])
  return { reply_markup: { inline_keyboard: rows } }
}

const contextKeyboard = (current) => ({
  reply_markup: {
    inline_keyboard: [
      [10, 20, 30, 50, 100].map(n => ({
        text: `${n === current ? '● ' : ''}${n}`,
        callback_data: `ctx:${n}`,
      })),
      [{ text: '◀ Back', callback_data: 'act:back' }],
    ]
  }
})

const providerKeyboard = (currentProvider) => ({
  reply_markup: {
    inline_keyboard: [
      ...Object.entries(PROVIDERS).map(([id, { name }]) => [
        { text: `${id === currentProvider ? '● ' : ''}${name}`, callback_data: `provider:${id}` }
      ]),
      [{ text: '◀ Back', callback_data: 'act:back' }],
    ]
  }
})

const sendMenu = (bot, chatId) => {
  const u = getUser(chatId)
  bot.sendMessage(chatId, menuText(u), menuKeyboard(u, chatId))
}

const editToMenu = (bot, chatId, messageId) => {
  const u = getUser(chatId)
  bot.editMessageText(menuText(u), { chat_id: chatId, message_id: messageId, ...menuKeyboard(u, chatId) })
}

export const start = () => {
  const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true })

  bot.setMyCommands([
    { command: 'menu', description: 'Open actions menu' },
    { command: 'language', description: 'Change learning language' },
    { command: 'mylanguage', description: 'Change your native language' },
    { command: 'prompt', description: 'View or set custom system prompt' },
    { command: 'resetprompt', description: 'Reset to default prompt' },
    { command: 'contextlimit', description: 'Set context summarization limit' },
  ])

  // --- Commands ---

  bot.onText(/\/start/, (msg) => {
    const u = getUser(msg.chat.id)
    if (u.language) {
      bot.sendMessage(msg.chat.id, `Welcome back! Learning: ${u.language}`)
      sendMenu(bot, msg.chat.id)
    } else {
      bot.sendMessage(msg.chat.id, 'Hey! What language would you like to learn?')
    }
  })

  bot.onText(/\/menu/, (msg) => sendMenu(bot, msg.chat.id))
  bot.onText(/\/help/, (msg) => sendMenu(bot, msg.chat.id))
  bot.onText(/\/report/, (msg) => handleReport(bot, msg.chat.id))

  bot.onText(/\/ai/, (msg) => {
    const u = getUser(msg.chat.id)
    bot.sendMessage(msg.chat.id, `Current AI: ${PROVIDERS[u.provider]?.name || u.provider}\n\nChoose a model:`, providerKeyboard(u.provider))
  })


  bot.onText(/\/language$/, (msg) => {
    bot.sendMessage(msg.chat.id, 'What language would you like to learn? (e.g. "Spanish")')
  })

  bot.onText(/\/language (.+)/, (msg, [, lang]) => {
    updateUser(msg.chat.id, { language: lang.trim() })
    bot.sendMessage(msg.chat.id, `Learning language set to ${lang.trim()}.`)
  })

  bot.onText(/\/mylanguage$/, (msg) => {
    const u = getUser(msg.chat.id)
    bot.sendMessage(msg.chat.id, `Your language: ${u.userLanguage || 'English'}\nTo change: /mylanguage <language>`)
  })

  bot.onText(/\/mylanguage (.+)/, (msg, [, lang]) => {
    updateUser(msg.chat.id, { userLanguage: lang.trim() })
    bot.sendMessage(msg.chat.id, `Your language set to ${lang.trim()}.`)
  })

  bot.onText(/\/mode (.+)/, (msg, [, mode]) => {
    if (!modes[mode.trim()]) return bot.sendMessage(msg.chat.id, 'Unknown mode. Use: ai, predefined')
    updateUser(msg.chat.id, { mode: mode.trim() })
    bot.sendMessage(msg.chat.id, `Switched to ${mode.trim()} mode.`)
  })

  bot.onText(/\/preset (.+)/, (msg, [, name]) => {
    clearHistory(msg.chat.id)
    updateUser(msg.chat.id, { preset: name.trim(), systemPrompt: null, predefinedIndex: 0 })
    bot.sendMessage(msg.chat.id, `Preset → "${name.trim()}". History cleared.`)
  })

  bot.onText(/\/timezone$/, (msg) => {
    const u = getUser(msg.chat.id)
    bot.sendMessage(msg.chat.id, `Your timezone: ${u.timezone || 'UTC'}\nTo change: /timezone <tz>\nExamples: America/New_York, Europe/London, Asia/Tokyo`)
  })

  bot.onText(/\/timezone (.+)/, (msg, [, tz]) => {
    try {
      new Date().toLocaleString('en-US', { timeZone: tz.trim() })
      updateUser(msg.chat.id, { timezone: tz.trim() })
      bot.sendMessage(msg.chat.id, `Timezone set to ${tz.trim()}.`)
    } catch {
      bot.sendMessage(msg.chat.id, 'Invalid timezone. Use IANA format, e.g. America/New_York, Europe/Berlin, Asia/Tokyo.')
    }
  })

  bot.onText(/\/prompt$/, (msg) => {
    const u = getUser(msg.chat.id)
    if (u.customSystemPrompt) {
      bot.sendMessage(msg.chat.id, `Your custom prompt:\n\n${u.customSystemPrompt}\n\nTo change: /prompt <new prompt>\nTo reset: /resetprompt`)
    } else {
      bot.sendMessage(msg.chat.id, 'No custom prompt set (using default). To set one: /prompt <your prompt>')
    }
  })

  bot.onText(/\/prompt (.+)/s, (msg, [, prompt]) => {
    updateUser(msg.chat.id, { customSystemPrompt: prompt.trim() })
    bot.sendMessage(msg.chat.id, 'Custom system prompt saved.')
  })

  bot.onText(/\/contextlimit$/, (msg) => {
    const u = getUser(msg.chat.id)
    bot.sendMessage(msg.chat.id, `Context limit: ${u.summarizeAfter || 20} messages.\nOlder messages get summarized automatically.\nTo change: /contextlimit <number>`)
  })

  bot.onText(/\/contextlimit (\d+)/, (msg, [, n]) => {
    const val = Math.max(6, Math.min(100, parseInt(n)))
    updateUser(msg.chat.id, { summarizeAfter: val })
    bot.sendMessage(msg.chat.id, `Context limit set to ${val} messages. History will be summarized when it exceeds this.`)
  })

  bot.onText(/\/resetprompt/, (msg) => {
    updateUser(msg.chat.id, { customSystemPrompt: null })
    bot.sendMessage(msg.chat.id, 'Custom prompt cleared, back to default.')
  })

  bot.onText(/\/pause/, (msg) => {
    updateUser(msg.chat.id, { active: 0, nextProactiveAt: null })
    bot.sendMessage(msg.chat.id, 'Proactive messages paused.')
  })

  bot.onText(/\/resume/, async (msg) => {
    const u = getUser(msg.chat.id)
    updateUser(msg.chat.id, { active: 1 })
    await ai.scheduleNext(msg.chat.id, u.provider, u.timezone)
    bot.sendMessage(msg.chat.id, 'Proactive messages resumed.')
  })

  bot.onText(/\/reset/, (msg) => {
    clearHistory(msg.chat.id)
    updateUser(msg.chat.id, { systemPrompt: null, predefinedIndex: 0 })
    bot.sendMessage(msg.chat.id, 'History cleared.')
  })

  bot.onText(/\/status/, (msg) => sendStatus(bot, msg.chat.id))

  bot.onText(/\/users/, (msg) => {
    if (!isAdmin(msg.chat.id)) return bot.sendMessage(msg.chat.id, 'Admin only.')
    sendUsersList(bot, msg.chat.id)
  })

  bot.onText(/\/userreport (.+)/, async (msg, [, targetId]) => {
    if (!isAdmin(msg.chat.id)) return bot.sendMessage(msg.chat.id, 'Admin only.')
    const target = getUser(targetId.trim())
    if (!target.language) return bot.sendMessage(msg.chat.id, 'User has no learning language set.')
    bot.sendMessage(msg.chat.id, `Generating report for ${targetId.trim()}...`)
    try {
      bot.sendMessage(msg.chat.id, await ai.generateReport(target))
    } catch (err) {
      console.error('Admin report error:', err.message)
      bot.sendMessage(msg.chat.id, 'Could not generate report.')
    }
  })

  bot.onText(/\/broadcast (.+)/, async (msg, [, text]) => {
    if (!isAdmin(msg.chat.id)) return bot.sendMessage(msg.chat.id, 'Admin only.')
    const users = getAllUsers().filter(u => u.active)
    let sent = 0
    for (const u of users) {
      try { await bot.sendMessage(u.chatId, text.trim()); sent++ } catch {}
    }
    bot.sendMessage(msg.chat.id, `Broadcast sent to ${sent}/${users.length} active users.`)
  })

  // --- Callback queries (button presses) ---

  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id
    const data = query.data

    const msgId = query.message.message_id

    if (data === 'listen') {
      const user = getUser(chatId)
      if (!user.language) return bot.answerCallbackQuery(query.id, { text: 'Set a language first' })
      bot.answerCallbackQuery(query.id, { text: 'Generating audio...' })
      try {
        bot.sendChatAction(chatId, 'record_voice')
        const langText = await ai.extractForListening(query.message.text, user.language, user.userLanguage, user.provider)
        bot.sendChatAction(chatId, 'record_voice')
        const audio = await synthesize(langText, user.language)
        await bot.sendVoice(chatId, audio, {}, { filename: 'voice.ogg', contentType: 'audio/ogg' })
      } catch (err) {
        console.error('Listen error:', err.message)
        bot.sendMessage(chatId, 'Could not generate audio.')
      }
      return
    }

    if (data.startsWith('provider:')) {
      const provider = data.split(':')[1]
      if (!PROVIDERS[provider]) return
      updateUser(chatId, { provider })
      bot.answerCallbackQuery(query.id, { text: `Switched to ${PROVIDERS[provider].name}` })
      return editToMenu(bot, chatId, msgId)
    }

    if (data.startsWith('ctx:')) {
      const val = parseInt(data.split(':')[1])
      updateUser(chatId, { summarizeAfter: val })
      bot.answerCallbackQuery(query.id, { text: `Context limit: ${val} messages` })
      return editToMenu(bot, chatId, msgId)
    }

    if (!data.startsWith('act:')) return
    const action = data.slice(4)

    switch (action) {
      case 'back':
        bot.answerCallbackQuery(query.id)
        return editToMenu(bot, chatId, msgId)

      case 'close':
        bot.answerCallbackQuery(query.id)
        return bot.deleteMessage(chatId, msgId)

      case 'report':
        bot.answerCallbackQuery(query.id)
        return handleReport(bot, chatId)

      case 'ai': {
        const u = getUser(chatId)
        bot.answerCallbackQuery(query.id)
        return bot.editMessageText(`Current AI: ${PROVIDERS[u.provider]?.name || u.provider}\n\nChoose a model:`, {
          chat_id: chatId, message_id: msgId, ...providerKeyboard(u.provider),
        })
      }

      case 'language':
        bot.answerCallbackQuery(query.id)
        return bot.sendMessage(chatId, 'Type the language you want to learn (e.g. "Spanish", "Japanese").')

      case 'mylang':
        bot.answerCallbackQuery(query.id)
        return bot.sendMessage(chatId, 'Type your native language (e.g. "English", "Russian"). Use /mylanguage <lang>')

      case 'timezone': {
        bot.answerCallbackQuery(query.id)
        const u = getUser(chatId)
        return bot.sendMessage(chatId,
          `Your timezone: ${u.timezone || 'UTC'}\nTo change: /timezone <tz>\n\nExamples:\nAmerica/New_York\nEurope/London\nEurope/Berlin\nAsia/Tokyo\nAsia/Shanghai\nAustralia/Sydney`)
      }

      case 'context': {
        const u = getUser(chatId)
        bot.answerCallbackQuery(query.id)
        return bot.editMessageText(
          `Context limit: ${u.summarizeAfter || 20} messages\nOlder messages are auto-summarized.\n\nPick a limit:`,
          { chat_id: chatId, message_id: msgId, ...contextKeyboard(u.summarizeAfter || 20) }
        )
      }

      case 'status':
        bot.answerCallbackQuery(query.id)
        return sendStatus(bot, chatId)

      case 'pauseresume': {
        const u = getUser(chatId)
        if (u.active) {
          updateUser(chatId, { active: 0, nextProactiveAt: null })
          bot.answerCallbackQuery(query.id, { text: 'Paused' })
        } else {
          updateUser(chatId, { active: 1 })
          ai.scheduleNext(chatId, u.provider, u.timezone)
          bot.answerCallbackQuery(query.id, { text: 'Resumed' })
        }
        return editToMenu(bot, chatId, msgId)
      }

      case 'reset':
        clearHistory(chatId)
        updateUser(chatId, { systemPrompt: null, predefinedIndex: 0 })
        bot.answerCallbackQuery(query.id, { text: 'History cleared' })
        return editToMenu(bot, chatId, msgId)

      case 'mode': {
        const u = getUser(chatId)
        updateUser(chatId, { mode: u.mode === 'ai' ? 'predefined' : 'ai' })
        bot.answerCallbackQuery(query.id, { text: `Mode: ${u.mode === 'ai' ? 'predefined' : 'ai'}` })
        return editToMenu(bot, chatId, msgId)
      }

      case 'prompt': {
        bot.answerCallbackQuery(query.id)
        const u = getUser(chatId)
        return bot.sendMessage(chatId,
          u.customSystemPrompt
            ? `Your custom prompt:\n\n${u.customSystemPrompt}\n\nTo change: /prompt <new prompt>\nTo reset: /resetprompt`
            : 'No custom prompt set (using default).\nTo set one: /prompt <your prompt>')
      }

      case 'help':
        bot.answerCallbackQuery(query.id)
        return bot.sendMessage(chatId,
          'Just chat to learn! Use /menu for all settings.\n\n' +
          'Shortcut commands:\n' +
          '/language <lang> — learning language\n' +
          '/mylanguage <lang> — your native language\n' +
          '/prompt <text> — set custom system prompt\n' +
          '/resetprompt — reset to default prompt\n' +
          '/contextlimit <n> — context summarization limit\n' +
          '/preset <name> — switch preset')

      case 'users':
        if (!isAdmin(chatId)) return bot.answerCallbackQuery(query.id, { text: 'Admin only' })
        bot.answerCallbackQuery(query.id)
        return sendUsersList(bot, chatId)

      case 'broadcast':
        if (!isAdmin(chatId)) return bot.answerCallbackQuery(query.id, { text: 'Admin only' })
        bot.answerCallbackQuery(query.id)
        return bot.sendMessage(chatId, 'Use: /broadcast <message>')
    }
  })

  // --- Free text messages ---

  bot.on('message', async (msg) => {
    if (!msg.text || msg.text.startsWith('/')) return
    const user = getUser(msg.chat.id)

    if (!user.language) {
      updateUser(msg.chat.id, { language: msg.text.trim() })
      bot.sendMessage(msg.chat.id, `Great, let's learn ${msg.text.trim()}!`)
      sendMenu(bot, msg.chat.id)
      return
    }

    try {
      typing(bot, msg.chat.id)
      let response
      if (user.mode === 'ai') {
        response = await ai.reply(user, msg.text)
      } else {
        addHistory(msg.chat.id, 'user', msg.text)
        response = predefined.reply(user)
        addHistory(msg.chat.id, 'assistant', response)
        updateUser(msg.chat.id, { predefinedIndex: user.predefinedIndex + 1 })
      }

      if (response) await sendResponse(bot, msg.chat.id, response)
      await ai.scheduleNext(msg.chat.id, user.provider, user.timezone)
    } catch (err) {
      console.error('Reply error:', err.message)
      bot.sendMessage(msg.chat.id, 'Something went wrong, try again.')
    }
  })

  startScheduler(bot)
  console.log('Bot started.')
}

// --- Helpers ---

const handleReport = async (bot, chatId) => {
  const user = getUser(chatId)
  if (!user.language) return bot.sendMessage(chatId, 'Set a language first with /language <lang>')
  typing(bot, chatId)
  try {
    bot.sendMessage(chatId, await ai.generateReport(user))
  } catch (err) {
    console.error('Report error:', err.message)
    bot.sendMessage(chatId, 'Could not generate report. Try again later.')
  }
}

const sendStatus = (bot, chatId) => {
  const u = getUser(chatId)
  const tz = u.timezone || 'UTC'
  const next = u.nextProactiveAt
    ? new Date(u.nextProactiveAt).toLocaleString('en-US', { timeZone: tz }) + ` (${tz})`
    : 'not scheduled'
  bot.sendMessage(chatId,
    `Mode: ${u.mode}\nAI: ${PROVIDERS[u.provider]?.name || u.provider}\nPreset: ${u.preset}\nLearning: ${u.language || 'not set'}\nMy language: ${u.userLanguage || 'English'}\nTimezone: ${tz}\nCustom prompt: ${u.customSystemPrompt ? 'yes' : 'no'}\nContext limit: ${u.summarizeAfter || 20} msgs\nActive: ${u.active ? 'yes' : 'no'}\nNext message: ${next}`)
}

const sendUsersList = (bot, chatId) => {
  const users = getAllUsers()
  if (!users.length) return bot.sendMessage(chatId, 'No users yet.')
  const lines = users.map(u => {
    const stats = getUserStats(u.chatId)
    const lastActive = stats.last ? new Date(stats.last * 1000).toLocaleDateString() : 'never'
    return `${u.chatId} | ${u.language || '—'} | ${stats.count} msgs | ${u.active ? 'active' : 'paused'} | last: ${lastActive}`
  })
  bot.sendMessage(chatId,
    `Users: ${users.length}\n\n` +
    `ID | Language | Messages | Status | Last Active\n` +
    lines.join('\n'))
}
