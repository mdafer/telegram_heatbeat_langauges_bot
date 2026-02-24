import { readFileSync, existsSync } from 'fs'

const cache = {}
const DEFAULT = { system: 'You are a helpful assistant.', predefined: { replies: [], proactive: [] } }

export const loadPreset = (name) => {
  if (!cache[name]) {
    const path = `./data/presets/${name}.json`
    cache[name] = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : DEFAULT
  }
  return cache[name]
}
