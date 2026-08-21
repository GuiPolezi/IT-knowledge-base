function getServerUrl() {
  return (localStorage.getItem("serverUrl") || "").replace(/\/+$/, "");
}
function apiUrl(path) {
  return getServerUrl() + "/api" + path;
}

/* ---------- NAVEGAÇÃO ---------- */

const navItems = document.querySelectorAll(".nav-item");
const views = document.querySelectorAll(".view");

navItems.forEach((btn) => {
  btn.addEventListener("click", () => {
    navItems.forEach((b) => b.classList.remove("active"));
    views.forEach((v) => v.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`view-${btn.dataset.view}`).classList.add("active");

    if (btn.dataset.view === "docs") loadDocuments();
    if (btn.dataset.view === "history") loadHistory();
  });
});

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/* ---------- PERGUNTAR ---------- */

const askForm = document.getElementById("ask-form");
const askInput = document.getElementById("ask-input");
const askSubmit = document.getElementById("ask-submit");
const askResult = document.getElementById("ask-result");
const askEmpty = document.getElementById("ask-empty");
const askLoading = document.getElementById("ask-loading");
const answerText = document.getElementById("answer-text");
const answerSources = document.getElementById("answer-sources");

askForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const question = askInput.value.trim();
  if (!question) return;

  askEmpty.classList.add("hidden");
  askResult.classList.add("hidden");
  askLoading.classList.remove("hidden");
  askSubmit.disabled = true;

  try {
    const res = await fetch(apiUrl("/ask"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || "Erro ao consultar.");

    answerText.textContent = data.answer;
    currentQuestionId = data.questionId || null;
    resetFeedbackUI();

    if (data.sources && data.sources.length) {
      answerSources.innerHTML = data.sources
        .map((s) => `<span class="source-tag">📄 ${escapeHtml(s.title)}</span>`)
        .join("");
    } else {
      answerSources.innerHTML = `<span class="no-sources">Nenhum documento correspondente foi encontrado na base.</span>`;
    }

    askResult.classList.remove("hidden");
  } catch (err) {
    answerText.textContent = `⚠️ ${err.message}`;
    answerSources.innerHTML = "";
    currentQuestionId = null;
    document.getElementById("answer-feedback").classList.add("hidden");
    askResult.classList.remove("hidden");
  } finally {
    askLoading.classList.add("hidden");
    askSubmit.disabled = false;
  }
});

/* ---------- DOCUMENTOS ---------- */

const newDocBtn = document.getElementById("new-doc-btn");
const docFormWrap = document.getElementById("doc-form-wrap");
const docForm = document.getElementById("doc-form");
const docCancel = document.getElementById("doc-cancel");
const docList = document.getElementById("doc-list");
const docIdInput = document.getElementById("doc-id");
const docTitleInput = document.getElementById("doc-title");
const docCategoryInput = document.getElementById("doc-category");
const docContentInput = document.getElementById("doc-content");
const docCount = document.getElementById("doc-count");

newDocBtn.addEventListener("click", () => {
  docForm.reset();
  docIdInput.value = "";
  docFormWrap.classList.remove("hidden");
});

docCancel.addEventListener("click", () => {
  docFormWrap.classList.add("hidden");
});

docForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = docIdInput.value;
  const payload = {
    title: docTitleInput.value.trim(),
    content: docContentInput.value.trim(),
    category: docCategoryInput.value.trim() || "Geral",
  };

  const url = id ? apiUrl(`/documents/${id}`) : apiUrl("/documents");
  const method = id ? "PUT" : "POST";

  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (res.ok) {
    docFormWrap.classList.add("hidden");
    docForm.reset();
    loadDocuments();
  } else {
    const data = await res.json();
    alert(data.error || "Erro ao salvar documento.");
  }
});

async function loadDocuments() {
  let docs = [];
  try {
    const res = await fetch(apiUrl("/documents"));
    docs = await res.json();
  } catch {
    docList.innerHTML = `<p style="color:var(--muted); font-size:14px;">Não foi possível carregar. Verifique a conexão com o servidor em Configurações.</p>`;
    docCount.textContent = "–";
    return;
  }
  docCount.textContent = docs.length;

  if (docs.length === 0) {
    docList.innerHTML = `<p style="color:var(--muted); font-size:14px;">Nenhum documento cadastrado ainda.</p>`;
    return;
  }

  docList.innerHTML = docs
    .map(
      (d) => `
    <div class="doc-card">
      <div class="doc-card-main">
        <div class="doc-card-title">${escapeHtml(d.title)}</div>
        <div class="doc-card-meta">
          <span class="pill pill-category">${escapeHtml(d.category)}</span>
          &nbsp;·&nbsp; atualizado em ${formatDate(d.updated_at)}
        </div>
        <div class="doc-card-excerpt">${escapeHtml(d.content)}</div>
      </div>
      <div class="doc-card-actions">
        <button class="icon-btn" onclick="editDoc(${d.id})">Editar</button>
        <button class="icon-btn danger" onclick="deleteDoc(${d.id})">Excluir</button>
      </div>
    </div>
  `
    )
    .join("");

  window.__docsCache = docs;
}

window.editDoc = function (id) {
  const doc = (window.__docsCache || []).find((d) => d.id === id);
  if (!doc) return;
  docIdInput.value = doc.id;
  docTitleInput.value = doc.title;
  docCategoryInput.value = doc.category;
  docContentInput.value = doc.content;
  docFormWrap.classList.remove("hidden");
  docFormWrap.scrollIntoView({ behavior: "smooth" });
};

window.deleteDoc = async function (id) {
  if (!confirm("Excluir este documento da base de conhecimento?")) return;
  await fetch(apiUrl(`/documents/${id}`), { method: "DELETE" });
  loadDocuments();
};

/* ---------- HISTÓRICO ---------- */

const historyList = document.getElementById("history-list");

async function loadHistory() {
  let items = [];
  try {
    const res = await fetch(apiUrl("/history"));
    items = await res.json();
  } catch {
    historyList.innerHTML = `<p style="color:var(--muted); font-size:14px;">Não foi possível carregar. Verifique a conexão com o servidor em Configurações.</p>`;
    return;
  }

  if (items.length === 0) {
    historyList.innerHTML = `<p style="color:var(--muted); font-size:14px;">Nenhuma pergunta registrada ainda.</p>`;
    return;
  }

  historyList.innerHTML = items
    .map(
      (h) => `
    <div class="history-card">
      <div class="history-question">&gt; ${escapeHtml(h.question)}</div>
      <div class="history-answer">${escapeHtml(h.answer)}</div>
      <div class="history-meta">
        ${formatDate(h.created_at)}
        ${feedbackBadge(h)}
      </div>
    </div>
  `
    )
    .join("");

  loadStats();
}

function feedbackBadge(h) {
  let badges = "";
  if (h.feedback === 1) badges += `<span class="badge badge-good">👍 útil</span>`;
  if (h.feedback === -1) badges += `<span class="badge badge-bad">👎 não ajudou</span>`;
  if (!h.sources || h.sources.length === 0) badges += `<span class="badge badge-warn">sem fontes</span>`;
  return badges;
}

async function loadStats() {
  const statsBar = document.getElementById("stats-bar");
  try {
    const res = await fetch(apiUrl("/stats"));
    const { totals } = await res.json();
    if (!totals || totals.total === 0) { statsBar.innerHTML = ""; return; }
    statsBar.innerHTML = `
      <div class="stat"><strong>${totals.total}</strong> perguntas</div>
      <div class="stat stat-good"><strong>${totals.positivos || 0}</strong> 👍 úteis</div>
      <div class="stat stat-bad"><strong>${totals.negativos || 0}</strong> 👎 não ajudaram</div>
      <div class="stat stat-warn"><strong>${totals.sem_fontes || 0}</strong> sem fontes</div>
    `;
  } catch {
    statsBar.innerHTML = "";
  }
}

function formatDate(sqliteDate) {
  if (!sqliteDate) return "";
  const d = new Date(sqliteDate.replace(" ", "T") + "Z");
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

/* ---------- INIT ---------- */

loadDocuments();

/* ---------- CONFIGURAÇÕES E CONEXÃO (app desktop) ---------- */

const settingsForm = document.getElementById("settings-form");
const serverUrlInput = document.getElementById("server-url");
const testConnBtn = document.getElementById("test-conn");
const settingsFeedback = document.getElementById("settings-feedback");
const connDot = document.getElementById("conn-dot");
const connText = document.getElementById("conn-text");

function setConnStatus(online) {
  connDot.className = "conn-dot " + (online ? "online" : "offline");
  connText.textContent = online ? "Conectado ao servidor" : "Sem conexão";
}

async function checkConnection() {
  const url = getServerUrl();
  if (!url) {
    setConnStatus(false);
    return false;
  }
  try {
    const res = await fetch(url + "/api/status", { signal: AbortSignal.timeout(4000) });
    const data = await res.json();
    const ok = res.ok && data.ok === true;
    setConnStatus(ok);
    return ok;
  } catch {
    setConnStatus(false);
    return false;
  }
}

function showSettingsView() {
  navItems.forEach((b) => b.classList.remove("active"));
  views.forEach((v) => v.classList.remove("active"));
  document.querySelector('[data-view="settings"]').classList.add("active");
  document.getElementById("view-settings").classList.add("active");
}

testConnBtn.addEventListener("click", async () => {
  const url = serverUrlInput.value.trim().replace(/\/+$/, "");
  if (!url) return;
  settingsFeedback.textContent = "Testando…";
  settingsFeedback.className = "settings-feedback";
  try {
    const res = await fetch(url + "/api/status", { signal: AbortSignal.timeout(4000) });
    const data = await res.json();
    if (res.ok && data.ok) {
      settingsFeedback.textContent = `✓ Conectado! Servidor encontrado (IA: ${data.provider}).`;
      settingsFeedback.className = "settings-feedback ok";
    } else {
      throw new Error();
    }
  } catch {
    settingsFeedback.textContent = "✗ Não foi possível conectar. Verifique o endereço e se o servidor está rodando.";
    settingsFeedback.className = "settings-feedback err";
  }
});

settingsForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const url = serverUrlInput.value.trim().replace(/\/+$/, "");
  localStorage.setItem("serverUrl", url);
  const ok = await checkConnection();
  if (ok) {
    settingsFeedback.textContent = "✓ Salvo e conectado!";
    settingsFeedback.className = "settings-feedback ok";
    loadDocuments();
  } else {
    settingsFeedback.textContent = "Salvo, mas não foi possível conectar agora.";
    settingsFeedback.className = "settings-feedback err";
  }
});

/* Inicialização do app desktop */
(async function initApp() {
  serverUrlInput.value = getServerUrl();
  const ok = await checkConnection();
  if (!ok && !getServerUrl()) {
    // Primeira execução: leva direto para configurações
    showSettingsView();
  }
  // Re-verifica a conexão a cada 30s
  setInterval(checkConnection, 30000);
})();

/* ---------- FEEDBACK DA RESPOSTA ---------- */

let currentQuestionId = null;
const fbUp = document.getElementById("fb-up");
const fbDown = document.getElementById("fb-down");
const fbThanks = document.getElementById("fb-thanks");
const answerFeedback = document.getElementById("answer-feedback");

function resetFeedbackUI() {
  answerFeedback.classList.remove("hidden");
  fbThanks.classList.add("hidden");
  fbUp.classList.remove("selected");
  fbDown.classList.remove("selected");
  fbUp.disabled = false;
  fbDown.disabled = false;
}

async function sendFeedback(value) {
  if (!currentQuestionId) return;
  try {
    const res = await fetch(apiUrl(`/history/${currentQuestionId}/feedback`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value }),
    });
    if (!res.ok) throw new Error();
    (value === 1 ? fbUp : fbDown).classList.add("selected");
    (value === 1 ? fbDown : fbUp).classList.remove("selected");
    fbThanks.classList.remove("hidden");
  } catch {
    fbThanks.textContent = "Não foi possível registrar o feedback.";
    fbThanks.classList.remove("hidden");
  }
}

fbUp.addEventListener("click", () => sendFeedback(1));
fbDown.addEventListener("click", () => sendFeedback(-1));
