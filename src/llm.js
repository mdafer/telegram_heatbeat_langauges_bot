import { ChatGoogleGenerativeAI } from '@langchain/google-genai'
import { ChatGroq } from '@langchain/groq'
import { ChatOpenAI } from '@langchain/openai'

const or = (model) => () => new ChatOpenAI({
  model,
  apiKey: process.env.OPENROUTER_API_KEY,
  configuration: { baseURL: 'https://openrouter.ai/api/v1' },
})

export const PROVIDERS = {
  'auto-free':   { name: 'Auto Free (OpenRouter)',     init: or('openrouter/free') },
  'deepseek-r1': { name: 'DeepSeek R1 (free)',         init: or('deepseek/deepseek-r1-0528:free') },
  'llama-70b':   { name: 'Llama 3.3 70B (free)',       init: or('meta-llama/llama-3.3-70b-instruct:free') },
  gemini:        { name: 'Gemini Flash (free)',         init: () => new ChatGoogleGenerativeAI({ model: 'gemini-2.0-flash-lite' }) },
  groq:          { name: 'Llama 70B via Groq (free)',   init: () => new ChatGroq({ model: 'llama-3.3-70b-versatile' }) },
  openai:        { name: 'GPT-4o Mini (paid)',          init: () => new ChatOpenAI({ model: process.env.AI_MODEL || 'gpt-4o-mini' }) },
}

const DEFAULT = 'auto-free'
const cache = {}

export const getLlm = (provider) => {
  const p = PROVIDERS[provider] ? provider : DEFAULT
  cache[p] ??= PROVIDERS[p].init()
  return cache[p]
}
