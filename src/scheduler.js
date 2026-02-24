import cron from 'node-cron'
import { getDueUsers, addHistory, updateUser } from './store.js'
import * as ai from './modes/ai.js'
import * as predefined from './modes/predefined.js'

const modes = { ai, predefined }
const LISTEN_BTN = { reply_markup: { inline_keyboard: [[{ text: '🔊 Listen', callback_data: 'listen' }]] } }

export const startScheduler = (bot) => {
  cron.schedule('* * * * *', async () => {
    for (const user of getDueUsers()) {
      try {
        const msg = await modes[user.mode].proactive(user)
        if (msg) {
          if (user.mode === 'predefined') addHistory(user.chatId, 'assistant', msg)
          await bot.sendMessage(user.chatId, msg, LISTEN_BTN)
          await ai.scheduleNext(user.chatId, user.provider, user.timezone)
        }
      } catch (err) {
        console.error(`Proactive failed for ${user.chatId}:`, err.message)
        updateUser(user.chatId, { nextProactiveAt: Date.now() + 60 * 60_000 })
      }
    }
  })
}
