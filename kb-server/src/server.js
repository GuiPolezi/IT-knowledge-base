require("dotenv").config();
const express = require("express");
const cors = require("cors");
const apiRoutes = require("./routes");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "2mb" }));

// Endpoint de status - o app desktop usa para testar a conexão com o servidor
app.get("/api/status", (req, res) => {
  res.json({
    ok: true,
    name: "kb-suporte-ti",
    provider: (process.env.AI_PROVIDER || "groq").toLowerCase(),
  });
});

app.use("/api", apiRoutes);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`\n✅ Servidor da Base de Conhecimento rodando na porta ${PORT}`);
  console.log(`   Acesso local:    http://localhost:${PORT}/api/status`);
  console.log(`   Acesso na rede:  http://IP_DESTA_MAQUINA:${PORT}/api/status\n`);

  const provider = (process.env.AI_PROVIDER || "groq").toLowerCase();
  const keyVar = provider === "gemini" ? "GEMINI_API_KEY" : "GROQ_API_KEY";
  if (!process.env[keyVar]) {
    console.warn(`⚠️  ${keyVar} não definida. Configure o arquivo .env antes de fazer perguntas.\n`);
  }
});
