const db = require("./database");

// Palavras muito comuns em português que atrapalham a busca (stopwords básicas)
const STOPWORDS = new Set([
  "a","o","as","os","de","do","da","dos","das","em","no","na","nos","nas",
  "um","uma","uns","umas","para","por","com","sem","que","qual","quais",
  "como","quando","onde","porque","por que","e","ou","é","são","foi",
  "ser","estar","tem","tenho","temos","meu","minha","seu","sua","esse",
  "essa","este","esta","isso","isto","aquele","aquela","ao","aos","à","às"
]);

function buildFtsQuery(question) {
  const tokens = question
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));

  if (tokens.length === 0) return null;

  // Cada termo como prefixo (busca mais tolerante), unidos por OR
  return tokens.map((t) => `${t}*`).join(" OR ");
}

function searchDocuments(question, limit = 5) {
  const ftsQuery = buildFtsQuery(question);
  if (!ftsQuery) return [];

  try {
    const stmt = db.prepare(`
      SELECT d.id, d.title, d.content, d.category, d.updated_at,
             bm25(documents_fts) AS rank
      FROM documents_fts
      JOIN documents d ON d.id = documents_fts.rowid
      WHERE documents_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `);
    return stmt.all(ftsQuery, limit);
  } catch (err) {
    // Query malformada para o FTS5 (raro, mas possível) -> sem resultados
    console.error("Erro na busca FTS:", err.message);
    return [];
  }
}

module.exports = { searchDocuments };
