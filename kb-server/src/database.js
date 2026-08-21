const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

const DATA_DIR = path.join(__dirname, "..", "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, "kb.sqlite");
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT DEFAULT 'Geral',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
  title, content, category,
  content='documents',
  content_rowid='id'
);

CREATE TRIGGER IF NOT EXISTS documents_ai AFTER INSERT ON documents BEGIN
  INSERT INTO documents_fts(rowid, title, content, category)
  VALUES (new.id, new.title, new.content, new.category);
END;

CREATE TRIGGER IF NOT EXISTS documents_ad AFTER DELETE ON documents BEGIN
  INSERT INTO documents_fts(documents_fts, rowid, title, content, category)
  VALUES ('delete', old.id, old.title, old.content, old.category);
END;

CREATE TRIGGER IF NOT EXISTS documents_au AFTER UPDATE ON documents BEGIN
  INSERT INTO documents_fts(documents_fts, rowid, title, content, category)
  VALUES ('delete', old.id, old.title, old.content, old.category);
  INSERT INTO documents_fts(rowid, title, content, category)
  VALUES (new.id, new.title, new.content, new.category);
END;

CREATE TABLE IF NOT EXISTS questions_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  sources TEXT DEFAULT '[]',
  asked_by TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);
`);

// Migração: adiciona a coluna de feedback em bancos criados antes dessa versão
try {
  db.exec("ALTER TABLE questions_history ADD COLUMN feedback INTEGER DEFAULT NULL");
} catch (e) {
  // Coluna já existe - ok
}

module.exports = db;
