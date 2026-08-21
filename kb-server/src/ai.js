/**
 * Integração com IA gratuita.
 * Suporta dois provedores, configuráveis via .env:
 *   AI_PROVIDER=groq   (padrão)  -> precisa de GROQ_API_KEY   (console.groq.com)
 *   AI_PROVIDER=gemini            -> precisa de GEMINI_API_KEY (aistudio.google.com)
 */

const PROVIDER = (process.env.AI_PROVIDER || "groq").toLowerCase();

function buildSystemPrompt(contextDocs) {
  const contextBlock = contextDocs.length
    ? contextDocs
        .map(
          (d, i) =>
            `[Documento ${i + 1} - "${d.title}" (categoria: ${d.category})]\n${d.content}`
        )
        .join("\n\n---\n\n")
    : "Nenhum documento relevante foi encontrado na base de conhecimento.";

  return `Você é o assistente interno de suporte técnico de TI de uma empresa que vende sistemas para clientes.
Sua função é responder às dúvidas dos técnicos usando SOMENTE as informações contidas nos documentos de contexto abaixo (relatórios, notas e documentações internas).

Regras importantes:
- Responda de forma direta, prática e técnica, como um colega experiente explicando para outro técnico.
- Use APENAS as informações fornecidas no contexto. Não invente passos, comandos ou soluções que não estejam documentados.
- Se o contexto não tiver informação suficiente para responder, diga isso claramente e sugira que o técnico registre essa lacuna ou procure um responsável, em vez de inventar uma resposta.
- Quando fizer sentido, estruture a resposta em passos numerados.
- Cite de qual documento veio a informação usada (pelo título), quando relevante.
- Responda em português do Brasil.

CONTEXTO DISPONÍVEL:
${contextBlock}`;
}

/* ---------- GROQ (API compatível com OpenAI) ---------- */

async function askGroq(question, contextDocs) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GROQ_API_KEY não configurada. Crie uma chave gratuita em console.groq.com e adicione no arquivo .env."
    );
  }
  const model = process.env.AI_MODEL || "openai/gpt-oss-120b";

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 1200,
      messages: [
        { role: "system", content: buildSystemPrompt(contextDocs) },
        { role: "user", content: question },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Erro na API do Groq (${response.status}): ${errText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

/* ---------- GEMINI (Google AI Studio) ---------- */

async function askGemini(question, contextDocs) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY não configurada. Crie uma chave gratuita em aistudio.google.com e adicione no arquivo .env."
    );
  }
  const model = process.env.AI_MODEL || "gemini-2.5-flash";

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: buildSystemPrompt(contextDocs) }],
      },
      contents: [{ role: "user", parts: [{ text: question }] }],
      generationConfig: { maxOutputTokens: 1200 },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Erro na API do Gemini (${response.status}): ${errText}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
}

/* ---------- INTERFACE ÚNICA ---------- */

async function askAI(question, contextDocs) {
  if (PROVIDER === "gemini") return askGemini(question, contextDocs);
  return askGroq(question, contextDocs);
}

module.exports = { askAI };
