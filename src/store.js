import Database from 'better-sqlite3'
import { mkdirSync } from 'fs'

mkdirSync('./data', { recursive: true })
const db = new Database('./data/bot.db')
db.pragma('journal_mode = WAL')

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    chatId TEXT PRIMARY KEY,
    mode TEXT DEFAULT 'ai',
    preset TEXT DEFAULT 'language-tutor',
    language TEXT,
    provider TEXT DEFAULT 'auto-free',
    ttsEnabled INTEGER DEFAULT 0,
    systemPrompt TEXT,
    predefinedIndex INTEGER DEFAULT 0,
    active INTEGER DEFAULT 1,
    nextProactiveAt INTEGER
  );
  CREATE TABLE IF NOT EXISTS history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chatId TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    createdAt INTEGER DEFAULT (unixepoch())
  );
`)

const addCol = (col, def) => { try { db.exec(`ALTER TABLE users ADD COLUMN ${col} ${def}`) } catch {} }
addCol('provider', "TEXT DEFAULT 'auto-free'")
addCol('ttsEnabled', 'INTEGER DEFAULT 0')
addCol('customSystemPrompt', 'TEXT')
addCol('summarizeAfter', 'INTEGER DEFAULT 20')
addCol('userLanguage', "TEXT DEFAULT 'English'")

export const getUser = (chatId) => {
  const id = String(chatId)
  return db.prepare('SELECT * FROM users WHERE chatId = ?').get(id)
    ?? (db.prepare('INSERT INTO users (chatId) VALUES (?) RETURNING *').get(id))
}

export const updateUser = (chatId, updates) => {
  const cols = Object.keys(updates)
  const sets = cols.map(c => `${c} = @${c}`).join(', ')
  db.prepare(`UPDATE users SET ${sets} WHERE chatId = @chatId`).run({ ...updates, chatId: String(chatId) })
}

export const getHistory = (chatId, limit = 30) =>
  db.prepare('SELECT role, content FROM history WHERE chatId = ? ORDER BY id DESC LIMIT ?')
    .all(String(chatId), limit).reverse()

export const addHistory = (chatId, role, content) =>
  db.prepare('INSERT INTO history (chatId, role, content) VALUES (?, ?, ?)').run(String(chatId), role, content)

export const clearHistory = (chatId) =>
  db.prepare('DELETE FROM history WHERE chatId = ?').run(String(chatId))

export const getHistoryCount = (chatId) =>
  db.prepare('SELECT COUNT(*) as count FROM history WHERE chatId = ?').get(String(chatId)).count

export const compactHistory = (chatId, summary, keepLast = 4) => {
  const id = String(chatId)
  const kept = db.prepare('SELECT role, content FROM history WHERE chatId = ? ORDER BY id DESC LIMIT ?')
    .all(id, keepLast).reverse()
  db.prepare('DELETE FROM history WHERE chatId = ?').run(id)
  const ins = db.prepare('INSERT INTO history (chatId, role, content) VALUES (?, ?, ?)')
  ins.run(id, 'assistant', `[Previous conversation summary]\n${summary}`)
  for (const m of kept) ins.run(id, m.role, m.content)
}

export const getDueUsers = () =>
  db.prepare('SELECT * FROM users WHERE active = 1 AND nextProactiveAt IS NOT NULL AND nextProactiveAt <= ?').all(Date.now())

export const getAllUsers = () =>
  db.prepare('SELECT * FROM users').all()

export const getUserStats = (chatId) =>
  db.prepare('SELECT COUNT(*) as count, MIN(createdAt) as first, MAX(createdAt) as last FROM history WHERE chatId = ?')
    .get(String(chatId))
