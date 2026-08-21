const express = require("express");
const db = require("./database");
const { searchDocuments } = require("./search");
const { askAI } = require("./ai");

const router = express.Router();

/* ---------- DOCUMENTOS ---------- */

// Listar todos os documentos (mais recentes primeiro)
router.get("/documents", (req, res) => {
  const rows = db
    .prepare("SELECT * FROM documents ORDER BY updated_at DESC")
    .all();
  res.json(rows);
});

// Criar novo documento
router.post("/documents", (req, res) => {
  const { title, content, category } = req.body;
  if (!title || !content) {
    return res.status(400).json({ error: "Título e conteúdo são obrigatórios." });
  }
  const stmt = db.prepare(
    "INSERT INTO documents (title, content, category) VALUES (?, ?, ?)"
  );
  const info = stmt.run(title.trim(), content.trim(), (category || "Geral").trim());
  const doc = db.prepare("SELECT * FROM documents WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json(doc);
});

// Editar documento existente
router.put("/documents/:id", (req, res) => {
  const { title, content, category } = req.body;
  const existing = db.prepare("SELECT * FROM documents WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Documento não encontrado." });

  db.prepare(
    `UPDATE documents SET title = ?, content = ?, category = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(
    title ?? existing.title,
    content ?? existing.content,
    category ?? existing.category,
    req.params.id
  );
  const updated = db.prepare("SELECT * FROM documents WHERE id = ?").get(req.params.id);
  res.json(updated);
});

// Excluir documento
router.delete("/documents/:id", (req, res) => {
  const info = db.prepare("DELETE FROM documents WHERE id = ?").run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: "Documento não encontrado." });
  res.json({ ok: true });
});

/* ---------- PERGUNTAS (RAG) ---------- */

router.post("/ask", async (req, res) => {
  const { question, askedBy } = req.body;
  if (!question || !question.trim()) {
    return res.status(400).json({ error: "Informe uma pergunta." });
  }

  try {
    const relevantDocs = searchDocuments(question, 5);
    const answer = await askAI(question, relevantDocs);

    const sources = relevantDocs.map((d) => ({ id: d.id, title: d.title, category: d.category }));

    const info = db.prepare(
      "INSERT INTO questions_history (question, answer, sources, asked_by) VALUES (?, ?, ?, ?)"
    ).run(question.trim(), answer, JSON.stringify(sources), (askedBy || "").trim());

    res.json({ answer, sources, questionId: info.lastInsertRowid });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Erro ao consultar a IA." });
  }
});

/* ---------- FEEDBACK ---------- */

// Registrar avaliação de uma resposta: { value: 1 } (útil) ou { value: -1 } (não ajudou)
router.post("/history/:id/feedback", (req, res) => {
  const { value } = req.body;
  if (value !== 1 && value !== -1) {
    return res.status(400).json({ error: "value deve ser 1 (útil) ou -1 (não ajudou)." });
  }
  const info = db
    .prepare("UPDATE questions_history SET feedback = ? WHERE id = ?")
    .run(value, req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: "Pergunta não encontrada." });
  res.json({ ok: true });
});

// Estatísticas para análise da base
router.get("/stats", (req, res) => {
  const totals = db
    .prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN feedback = 1 THEN 1 ELSE 0 END) AS positivos,
        SUM(CASE WHEN feedback = -1 THEN 1 ELSE 0 END) AS negativos,
        SUM(CASE WHEN feedback IS NULL THEN 1 ELSE 0 END) AS sem_avaliacao,
        SUM(CASE WHEN sources = '[]' THEN 1 ELSE 0 END) AS sem_fontes
      FROM questions_history
    `)
    .get();

  // Perguntas problemáticas: avaliadas como "não ajudou" ou respondidas sem nenhuma fonte
  // -> candidatas a virar documentação nova/melhor
  const lacunas = db
    .prepare(`
      SELECT id, question, sources, feedback, created_at
      FROM questions_history
      WHERE feedback = -1 OR sources = '[]'
      ORDER BY created_at DESC
      LIMIT 30
    `)
    .all()
    .map((r) => ({ ...r, sources: JSON.parse(r.sources || "[]") }));

  res.json({ totals, lacunas });
});

/* ---------- HISTÓRICO ---------- */

router.get("/history", (req, res) => {
  const rows = db
    .prepare("SELECT * FROM questions_history ORDER BY created_at DESC LIMIT 100")
    .all()
    .map((r) => ({ ...r, sources: JSON.parse(r.sources || "[]") }));
  res.json(rows);
});

module.exports = router;
