import { loadPreset } from '../presets.js'

export const reply = (user) => {
  const { replies = [] } = loadPreset(user.preset).predefined || {}
  if (!replies.length) return 'No predefined replies configured for this preset.'
  return replies[user.predefinedIndex % replies.length]
}

export const proactive = (user) => {
  const { proactive: msgs = [] } = loadPreset(user.preset).predefined || {}
  if (!msgs.length) return null
  return msgs[Math.floor(Math.random() * msgs.length)]
}
