import { SystemMessage, HumanMessage, AIMessage } from '@langchain/core/messages'
import { getLlm } from '../llm.js'
import { loadPreset } from '../presets.js'
import { getHistory, addHistory, updateUser } from '../store.js'

const toLc = (history) =>
  history.map(m => m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content))

const NO_MD = ' Do NOT use markdown, asterisks, or any markup. Plain text only.'
const fill = (text, lang) => text.replaceAll('{language}', lang || 'the target language')

export const reply = async (user, text) => {
  const llm = getLlm(user.provider)
  const preset = loadPreset(user.preset)
  const system = fill(user.systemPrompt || preset.system, user.language)

  addHistory(user.chatId, 'user', text)
  const history = getHistory(user.chatId)

  const res = await llm.invoke([new SystemMessage(system + NO_MD), ...toLc(history)])
  addHistory(user.chatId, 'assistant', res.content)

  if (history.length > 0 && history.length % 20 === 0) await evolvePrompt(user, preset)

  return res.content
}

export const proactive = async (user) => {
  const llm = getLlm(user.provider)
  const preset = loadPreset(user.preset)
  const system = fill(user.systemPrompt || preset.system, user.language)
  const instruction = fill(preset.proactivePrompt || 'Send a brief, engaging message.', user.language)

  const res = await llm.invoke([
    new SystemMessage(`${system}\n\n${instruction}${NO_MD}`),
    ...toLc(getHistory(user.chatId, 10)),
  ])
  addHistory(user.chatId, 'assistant', res.content)
  return res.content
}

export const generateReport = async (user) => {
  const history = getHistory(user.chatId, 100)
  if (history.length < 4) return "Not enough conversation yet to generate a report. Keep chatting!"

  const res = await getLlm(user.provider).invoke([
    new SystemMessage(
      `You are a language learning analyst. Review this ${user.language} learning conversation and produce a concise progress report. Include:\n` +
      '1. Phrases & vocabulary covered (list the key ones)\n' +
      '2. Estimated level (beginner/elementary/intermediate/advanced)\n' +
      '3. Strengths — what the user is doing well\n' +
      '4. Weak areas — grammar, pronunciation cues, vocabulary gaps\n' +
      '5. Top 5 phrases to review next from the 500 most common daily phrases\n' +
      '6. Overall progress score (0–100%)\n' +
      'Keep it friendly and motivating. Use dashes for bullet points.' + NO_MD
    ),
    new HumanMessage(history.map(m => `${m.role}: ${m.content}`).join('\n')),
  ])
  return res.content
}

export const extractLanguage = async (text, language, provider) => {
  const res = await getLlm(provider).invoke([
    new SystemMessage(
      `Extract ONLY the ${language} words, phrases, and sentences from the message below. ` +
      `Remove all English explanations, translations, and commentary. ` +
      `Return just the ${language} text, nothing else.`
    ),
    new HumanMessage(text),
  ])
  return res.content
}

export const scheduleNext = async (chatId, provider) => {
  try {
    const history = getHistory(chatId, 10)
    const res = await getLlm(provider).invoke([
      new SystemMessage(
        `Current date/time: ${new Date().toISOString()}\n\n` +
        'Based on this conversation, decide when to next proactively message the user. ' +
        'Pay close attention to scheduling cues from the user (e.g. "enough for today", ' +
        '"let\'s continue next week", "see you over the weekend", "talk tomorrow"). ' +
        'If the user indicated a specific time, respect it. Otherwise pick a reasonable ' +
        'time based on engagement and learning pace.\n' +
        'Return ONLY an ISO 8601 datetime string (e.g. 2026-02-24T09:00:00Z).'
      ),
      new HumanMessage(history.map(m => `${m.role}: ${m.content}`).join('\n') || 'No conversation yet.'),
    ])
    const parsed = Date.parse(res.content.trim())
    const min = Date.now() + 30 * 60_000
    updateUser(chatId, { nextProactiveAt: Math.max(parsed || min, min) })
  } catch {
    updateUser(chatId, { nextProactiveAt: Date.now() + 180 * 60_000 })
  }
}

const evolvePrompt = async (user, preset) => {
  const history = getHistory(user.chatId, 20)
  const res = await getLlm(user.provider).invoke([
    new SystemMessage('Analyze this conversation and refine the system prompt to better serve this user. Return ONLY the updated prompt.'),
    new HumanMessage(`Current prompt:\n${user.systemPrompt || preset.system}\n\nRecent conversation:\n${history.map(m => `${m.role}: ${m.content}`).join('\n')}`),
  ])
  updateUser(user.chatId, { systemPrompt: res.content })
}
