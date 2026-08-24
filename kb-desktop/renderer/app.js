function getServerUrl() {
  return (localStorage.getItem("serverUrl") || "").replace(/\/+$/, "");
}
function apiUrl(path) {
  return getServerUrl() + "/api" + path;
}

/* ---------- NAVEGAÇÃO ---------- */

const navItems = document.querySelectorAll(".nav-item");
const views = document.querySelectorAll(".view");

const homeCanvas = document.getElementById("home-canvas");
const reduceMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* Modos: home (chuva) / páginas do shell (chat, docs — fundo preto,
   chrome compartilhado) / views do .app (sidebar antiga).
   body.page-active estaciona o canvas via CSS; a classe específica
   (chat-active/docs-active) mostra a página. O JS só sequencia
   HomeBg.start/stop em volta da transição. */
const SHELL_PAGE_CLASSES = ["chat-active", "docs-active"];
const SHELL_PAGES = {
  ask: {
    className: "chat-active",
    container: document.getElementById("home-chat"),
    onEnter: () => chatInput.focus(),
  },
  docs: {
    className: "docs-active",
    container: document.getElementById("home-docs"),
    onEnter: () => {
      docsShowList();
      loadDocuments();
    },
  },
};

function navigateTo(view) {
  closeHomeMenu();
  if (view === "home") return enterHomeMode();
  if (SHELL_PAGES[view]) return enterShellPage(SHELL_PAGES[view]);
  enterAppView(view);
}

function enterHomeMode() {
  document.body.classList.add("home-active");
  if (window.HomeBg) window.HomeBg.start(); // liga ANTES de desestacionar o canvas
  // desliza de volta (ou instantâneo vindo do .app)
  document.body.classList.remove("page-active", ...SHELL_PAGE_CLASSES);
  checkConnection();
  loadDocuments();
}

function enterShellPage(page) {
  const fromRain =
    document.body.classList.contains("home-active") &&
    !document.body.classList.contains("page-active");
  // Entrada do conteúdo atrasada (fade) só quando a chuva está saindo;
  // trocando entre páginas do shell ou vindo do .app é instantâneo
  page.container.classList.toggle("page-anim", fromRain && !reduceMotion());
  document.body.classList.remove(...SHELL_PAGE_CLASSES);
  document.body.classList.add("home-active", "page-active", page.className);
  if (!fromRain || reduceMotion()) {
    if (window.HomeBg) window.HomeBg.stop();
  } else {
    // animado: a chuva continua pintando enquanto desliza para cima;
    // o stop acontece no transitionend, com fallback caso o evento se perca
    setTimeout(() => {
      if (document.body.classList.contains("page-active") && window.HomeBg) {
        window.HomeBg.stop();
      }
    }, 850);
  }
  page.onEnter();
}

function enterAppView(view) {
  document.body.classList.remove("home-active", "page-active", ...SHELL_PAGE_CLASSES);
  if (window.HomeBg) window.HomeBg.stop(); // idempotente se já estava parado
  navItems.forEach((b) => b.classList.toggle("active", b.dataset.view === view));
  views.forEach((v) => v.classList.toggle("active", v.id === `view-${view}`));
  if (view === "history") loadHistory();
}

homeCanvas.addEventListener("transitionend", (e) => {
  if (e.propertyName !== "transform") return;
  if (document.body.classList.contains("page-active") && window.HomeBg) {
    window.HomeBg.stop();
  }
});

navItems.forEach((btn) => {
  btn.addEventListener("click", () => navigateTo(btn.dataset.view));
});

/* ---------- HOME: popup do MENU ---------- */

const homeMenuBtn = document.getElementById("home-menu-btn");
const homeMenuPopup = document.getElementById("home-menu-popup");

function closeHomeMenu() {
  homeMenuPopup.classList.add("hidden");
  homeMenuBtn.setAttribute("aria-expanded", "false");
}

homeMenuBtn.addEventListener("click", () => {
  const willOpen = homeMenuPopup.classList.contains("hidden");
  homeMenuPopup.classList.toggle("hidden");
  homeMenuBtn.setAttribute("aria-expanded", String(willOpen));
});

homeMenuPopup.querySelectorAll(".home-popup-item").forEach((item) =>
  item.addEventListener("click", () => navigateTo(item.dataset.view))
);

document.addEventListener("click", (e) => {
  if (!homeMenuPopup.classList.contains("hidden") && !e.target.closest("#home-menu-zone")) {
    closeHomeMenu();
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeHomeMenu();
});

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/* ---------- CHAT (shell da home) ---------- */

const homeChat = document.getElementById("home-chat");
const chatThread = document.getElementById("chat-thread");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");

const chatMessages = []; // { question, answer, sources, questionId }
let chatPending = false;

const CHAT_DOC_ICON = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>`;

// Só **negrito** (não cruza linhas de propósito); escapa o HTML antes
function renderMarkdownLite(text) {
  return escapeHtml(text).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

function chatScrollToEnd() {
  chatThread.scrollTop = chatThread.scrollHeight;
}

function renderAnswerBlock(data) {
  const sources = (data.sources || [])
    .map(
      (s) =>
        `<div class="chat-source-row">${CHAT_DOC_ICON}<span>${escapeHtml(s.title)}</span></div>`
    )
    .join("");
  const feedback = data.questionId
    ? `
    <div class="chat-feedback-row" data-qid="${data.questionId}">
      <span class="chat-fb-label">Essa resposta ajudou?</span>
      <button class="chat-fb-btn" data-val="1" title="Sim, ajudou">👍</button>
      <button class="chat-fb-btn" data-val="-1" title="Não ajudou">👎</button>
      <span class="chat-fb-thanks hidden">Obrigado! Feedback registrado.</span>
    </div>`
    : "";
  return `
  <div class="chat-answer">
    <div class="chat-answer-label">Resposta</div>
    <div class="chat-answer-text">${renderMarkdownLite(data.answer)}</div>
    <div class="chat-answer-sep"></div>
    ${sources}
    ${feedback}
  </div>`;
}

chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const question = chatInput.value.trim();
  if (!question || chatPending) return;

  if (homeChat.classList.contains("is-empty")) {
    homeChat.classList.remove("is-empty");
    homeChat.classList.add("has-thread");
    chatInput.placeholder = "Escreva uma Mensagem...";
  }

  const exchange = document.createElement("div");
  exchange.className = "chat-exchange";
  exchange.innerHTML = `
    <div class="chat-msg-user">${escapeHtml(question)}</div>
    <div class="chat-msg-pending"><span></span><span></span><span></span></div>`;
  chatThread.appendChild(exchange);

  chatPending = true;
  chatInput.disabled = true;
  chatInput.value = "";
  chatScrollToEnd();

  const pending = exchange.querySelector(".chat-msg-pending");
  try {
    const res = await fetch(apiUrl("/ask"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erro ao consultar.");

    chatMessages.push({
      question,
      answer: data.answer,
      sources: data.sources || [],
      questionId: data.questionId || null,
    });
    pending.outerHTML = renderAnswerBlock(data);
  } catch (err) {
    const msg =
      err instanceof TypeError
        ? "Não foi possível conectar ao servidor. Verifique as Configurações."
        : err.message;
    pending.outerHTML = `
    <div class="chat-answer error">
      <div class="chat-answer-label">Resposta</div>
      <div class="chat-answer-text">⚠️ ${escapeHtml(msg)}</div>
    </div>`;
  } finally {
    chatPending = false;
    chatInput.disabled = false;
    chatInput.focus();
    chatScrollToEnd();
  }
});

// Feedback por resposta — delegação (a thread é gerada via innerHTML)
chatThread.addEventListener("click", async (e) => {
  const btn = e.target.closest(".chat-fb-btn");
  if (!btn) return;
  const row = btn.closest(".chat-feedback-row");
  const qid = row.dataset.qid;
  const value = Number(btn.dataset.val);
  try {
    const res = await fetch(apiUrl(`/history/${qid}/feedback`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value }),
    });
    if (!res.ok) throw new Error();
    row
      .querySelectorAll(".chat-fb-btn")
      .forEach((b) => b.classList.toggle("selected", b === btn));
    row.querySelector(".chat-fb-thanks").classList.remove("hidden");
  } catch {
    const thanks = row.querySelector(".chat-fb-thanks");
    thanks.textContent = "Não foi possível registrar o feedback.";
    thanks.classList.remove("hidden");
  }
});

/* ---------- DOCUMENTOS (shell da home) ---------- */

const homeDocs = document.getElementById("home-docs");
const docsNewBtn = document.getElementById("docs-new-btn");
const docsList = document.getElementById("docs-list");
const docForm = document.getElementById("doc-form");
const docCancel = document.getElementById("doc-cancel");
const docIdInput = document.getElementById("doc-id");
const docTitleInput = document.getElementById("doc-title");
const docCategoryInput = document.getElementById("doc-category");
const docContentInput = document.getElementById("doc-content");
const docCount = document.getElementById("doc-count");
const homeDocCount = document.getElementById("home-doc-count");

let docsCache = [];

// Funil único: atualiza o contador da sidebar e o do card da home
function setDocCount(value) {
  docCount.textContent = value;
  if (homeDocCount) homeDocCount.textContent = value;
}

function docsShowList() {
  homeDocs.classList.add("is-list");
  homeDocs.classList.remove("is-form");
}

// Sem id → criar; com id → editar (pré-preenche do cache)
function openDocForm(id) {
  docForm.reset();
  docIdInput.value = "";
  if (id != null) {
    const doc = docsCache.find((d) => d.id === id);
    if (!doc) return;
    docIdInput.value = doc.id;
    docTitleInput.value = doc.title;
    docCategoryInput.value = doc.category;
    docContentInput.value = doc.content;
  }
  homeDocs.classList.remove("is-list");
  homeDocs.classList.add("is-form");
  docTitleInput.focus();
}

docsNewBtn.addEventListener("click", () => openDocForm());
docCancel.addEventListener("click", docsShowList);

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
    docForm.reset();
    docsShowList();
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
    docsList.innerHTML = `<p class="docs-empty">Não foi possível carregar. Verifique a conexão com o servidor em Configurações.</p>`;
    setDocCount("–");
    return;
  }
  setDocCount(docs.length);

  if (docs.length === 0) {
    docsList.innerHTML = `<p class="docs-empty">Nenhum documento cadastrado ainda.</p>`;
    docsCache = docs;
    return;
  }

  docsList.innerHTML = docs
    .map(
      (d) => `
    <article class="docs-card">
      <div class="docs-card-main">
        <div class="docs-card-title">${escapeHtml(d.title)}</div>
        <div class="docs-card-meta">
          <span class="docs-pill">${escapeHtml(d.category)}</span>
          <span class="docs-updated">Atualizado em ${formatDate(d.updated_at)}</span>
        </div>
      </div>
      <div class="docs-card-actions">
        <button class="docs-btn-solid docs-edit" data-id="${d.id}">Editar</button>
        <button class="docs-btn-ghost docs-delete" data-id="${d.id}">Excluir</button>
      </div>
    </article>
  `
    )
    .join("");

  docsCache = docs;
}

// Ações dos cards por delegação (a lista é gerada via innerHTML)
docsList.addEventListener("click", async (e) => {
  const edit = e.target.closest(".docs-edit");
  if (edit) return openDocForm(Number(edit.dataset.id));
  const del = e.target.closest(".docs-delete");
  if (del) {
    if (!confirm("Excluir este documento da base de conhecimento?")) return;
    await fetch(apiUrl(`/documents/${del.dataset.id}`), { method: "DELETE" });
    loadDocuments();
  }
});

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

const homeConnIcon = document.getElementById("home-conn-icon");
const homeConnText = document.getElementById("home-conn-text");
const homeServerUrl = document.getElementById("home-server-url");

function setConnStatus(online) {
  connDot.className = "conn-dot " + (online ? "online" : "offline");
  connText.textContent = online ? "Conectado ao servidor" : "Sem conexão";

  // Card de status da página inicial
  const url = getServerUrl();
  homeConnIcon.classList.toggle("offline", !online);
  if (online) {
    homeConnText.textContent = "Conectado ao Servidor";
    homeServerUrl.textContent = url;
  } else if (url) {
    homeConnText.textContent = "Sem conexão";
    homeServerUrl.textContent = url;
  } else {
    homeConnText.textContent = "Servidor não configurado";
    homeServerUrl.textContent = "Configure em MENU → Configurações";
  }
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
  // O app sempre abre na home; sem servidor configurado, o card mostra o estado
  await checkConnection();
  // Re-verifica a conexão a cada 30s
  setInterval(checkConnection, 30000);
})();

