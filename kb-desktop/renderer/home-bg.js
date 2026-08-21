/* =====================================================================
   FUNDO ANIMADO DA HOME — "chuva" de símbolos matemáticos dourados que
   caem e se dissolvem numa superfície líquida, gerando ondulações.
   Vanilla JS + Canvas 2D, sem dependências.

   Exposto como window.HomeBg = { start, stop } para o app.js pausar a
   animação quando a home estiver oculta (custo zero nas telas internas).
   ===================================================================== */
(() => {
  const canvas = document.getElementById("home-canvas");
  const ctx = canvas.getContext("2d");

  // ---------- Configuração ------------------------------------------
  const GLYPHS = "ψΣ∂γβΠ∫ωθΔ√≈≥≤÷≠×∞αφ0123456789";
  const FONT_SIZE   = 15;      // tamanho dos símbolos (px)
  const COL_WIDTH   = 18;      // espaçamento horizontal entre colunas
  const SURFACE_POS = 0.76;    // posição da superfície líquida — manter em sincronia com --home-surface: 76vh em home.css
  const DENSITY     = 0.85;    // fração de colunas ativas ao mesmo tempo
  const MIN_SPEED   = 40;      // px/s
  const MAX_SPEED   = 130;     // px/s
  const FADE_ZONE   = 70;      // altura (px) da faixa de desvanecimento na superfície

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let W = 0, H = 0, DPR = 1, surfaceY = 0;
  let columns = [];
  let ripples = [];
  let running = false;
  let rafId = 0;

  // Simulação física da superfície líquida (mola + propagação)
  const SURF_SPACING = 6;      // distância entre pontos da superfície (px)
  const SURF_TENSION = 22;     // rigidez da "água" (retorno ao repouso)
  const SURF_SPREAD  = 90;     // força de propagação entre vizinhos
  const SURF_DAMP    = 2.4;    // amortecimento (maior = acalma mais rápido)
  const SPLASH_FORCE = 260;    // impulso vertical de cada impacto (px/s)
  let surfH = [];              // deslocamento vertical de cada ponto
  let surfV = [];              // velocidade vertical de cada ponto

  // ---------- Utilidades --------------------------------------------
  const rand  = (a, b) => a + Math.random() * (b - a);
  const glyph = () => GLYPHS[(Math.random() * GLYPHS.length) | 0];

  function makeColumn(i, scatter) {
    return {
      x: i * COL_WIDTH + COL_WIDTH / 2,
      // Todas nascem ACIMA do topo; 'scatter' só espalha o momento de entrada
      y: scatter ? rand(-H * 1.6, -FONT_SIZE) : rand(-H * 0.6, -FONT_SIZE),
      speed: rand(MIN_SPEED, MAX_SPEED),
      len: (rand(16, 38)) | 0,              // comprimento do rastro
      chars: [],
      gaps: [],                              // buracos no rastro (fio "quebrado")
      bright: Math.random() < 0.28,          // algumas colunas brilham mais
      splashed: false,                       // já gerou ondulação na superfície?
      delay: 0,                              // espera antes de reaparecer
      mutateAt: 0
    };
  }

  function initColumn(c) {
    c.chars = Array.from({ length: c.len }, glyph);
    c.gaps  = c.chars.map(() => Math.random() < 0.22); // ~22% de lacunas
  }

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    // window.innerWidth/innerHeight (e não clientWidth): o canvas fica em
    // seção display:none quando a home está oculta e mediria 0
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width  = W * DPR;
    canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    surfaceY = H * SURFACE_POS;

    const surfCount = Math.ceil(W / SURF_SPACING) + 2;
    surfH = new Float32Array(surfCount);
    surfV = new Float32Array(surfCount);

    const count = Math.ceil(W / COL_WIDTH) + 1;
    columns = Array.from({ length: count }, (_, i) => {
      const c = makeColumn(i, true);
      initColumn(c);
      if (Math.random() > DENSITY) c.delay = rand(0, 3); // parte começa ociosa
      return c;
    });
    ripples = [];
  }
  window.addEventListener("resize", () => {
    if (!running) return; // start() sempre re-mede ao voltar para a home
    resize();
  });

  // ---------- Ondulações na superfície ------------------------------
  function splash(x, strong) {
    // Impulso físico: empurra a superfície para baixo no ponto do impacto,
    // com um perfil suave nos vizinhos para o "mergulho" parecer natural
    const idx = Math.round(x / SURF_SPACING);
    const force = SPLASH_FORCE * (strong ? rand(1.0, 1.5) : rand(0.45, 0.8));
    for (let o = -3; o <= 3; o++) {
      const i = idx + o;
      if (i < 0 || i >= surfV.length) continue;
      const falloff = Math.cos((o / 4) * Math.PI * 0.5); // 1 no centro → 0 nas bordas
      surfV[i] += force * falloff;
    }
  }

  function spawnRipple(x, strong) {
    splash(x, strong);
    ripples.push({
      x,
      r: 2,
      maxR: strong ? rand(50, 110) : rand(22, 55),
      alpha: strong ? 0.5 : 0.32,
      speed: rand(22, 40)
    });
    if (ripples.length > 60) ripples.shift();
  }

  // Integra a física da superfície: mola de retorno + propagação lateral
  function updateSurface(dt) {
    const n = surfH.length;
    const damp = Math.exp(-SURF_DAMP * dt);
    for (let i = 0; i < n; i++) {
      const left  = surfH[i > 0 ? i - 1 : i];
      const right = surfH[i < n - 1 ? i + 1 : i];
      // Aceleração: puxa de volta ao repouso + segue a média dos vizinhos
      const acc = -SURF_TENSION * surfH[i]
                + SURF_SPREAD * ((left + right) * 0.5 - surfH[i]);
      surfV[i] = (surfV[i] + acc * dt) * damp;
    }
    for (let i = 0; i < n; i++) surfH[i] += surfV[i] * dt;
  }

  // ---------- Linha da superfície (deformada pela física) ------------
  function surfaceYAt(x, t) {
    // Deslocamento físico interpolado + marolas ambientes bem sutis
    const f = x / SURF_SPACING;
    const i = Math.max(0, Math.min(surfH.length - 2, f | 0));
    const frac = f - i;
    const phys = surfH[i] * (1 - frac) + surfH[i + 1] * frac;
    const ambient = Math.sin(x * 0.012 + t * 0.7) * 1.2
                  + Math.sin(x * 0.031 - t * 0.4) * 0.7;
    return surfaceY + phys + ambient;
  }

  function drawSurface(t) {
    ctx.beginPath();
    const step = SURF_SPACING;
    for (let x = 0; x <= W + step; x += step) {
      const y = surfaceYAt(x, t);
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    // Um leve brilho na linha faz os movimentos ficarem mais visíveis
    ctx.shadowColor = "rgba(201,168,106,0.5)";
    ctx.shadowBlur = 6;
    ctx.strokeStyle = "rgba(201,168,106,0.34)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Zona abaixo da superfície: mais escura, acompanhando a deformação
    ctx.beginPath();
    for (let x = 0; x <= W + step; x += step) {
      const y = surfaceYAt(x, t) + 1.5;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, surfaceY, 0, H);
    g.addColorStop(0, "rgba(7,5,3,0.55)");
    g.addColorStop(1, "rgba(7,5,3,0.95)");
    ctx.fillStyle = g;
    ctx.fill();
  }

  function drawRipples(dt, t) {
    for (let i = ripples.length - 1; i >= 0; i--) {
      const rp = ripples[i];
      rp.r += rp.speed * dt;
      rp.alpha -= dt * 0.35;
      if (rp.alpha <= 0 || rp.r > rp.maxR * 1.4) { ripples.splice(i, 1); continue; }

      // Duas elipses concêntricas achatadas, ancoradas na linha deformada
      const cy = surfaceYAt(rp.x, t);
      for (let k = 0; k < 2; k++) {
        const r = rp.r - k * 7;
        if (r <= 1) continue;
        ctx.beginPath();
        ctx.ellipse(rp.x, cy, r, r * 0.16, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(201,168,106,${(rp.alpha * (1 - k * 0.45)).toFixed(3)})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }

  // ---------- Chuva de símbolos --------------------------------------
  function drawRain(dt, t) {
    ctx.font = `${FONT_SIZE}px "JetBrains Mono", monospace`;
    ctx.textAlign = "center";

    for (const c of columns) {
      if (c.delay > 0) { c.delay -= dt; continue; }

      c.y += c.speed * dt;

      // Muta um caractere de vez em quando (efeito de "código vivo")
      c.mutateAt -= dt;
      if (c.mutateAt <= 0) {
        c.chars[(Math.random() * c.len) | 0] = glyph();
        c.mutateAt = rand(0.08, 0.5);
      }

      // Cabeça tocou a superfície → ondulação (uma única vez)
      if (!c.splashed && c.y >= surfaceY) {
        c.splashed = true;
        spawnRipple(c.x, c.bright);
      }

      // Só recomeça quando o rastro INTEIRO já mergulhou na superfície
      if (c.y - c.len * FONT_SIZE > surfaceY) {
        Object.assign(c, makeColumn(columns.indexOf(c), false));
        initColumn(c);
        if (Math.random() > DENSITY) c.delay = rand(0.3, 2.5);
        continue;
      }

      // Desenha o rastro, do topo para a cabeça
      for (let k = 0; k < c.len; k++) {
        if (c.gaps[k]) continue;
        const gy = c.y - (c.len - 1 - k) * FONT_SIZE;
        if (gy < -FONT_SIZE || gy > surfaceY) continue;

        // Suavização: desvanece gradualmente ao se aproximar da superfície
        let surfFade = (surfaceY - gy) / FADE_ZONE;
        surfFade = surfFade >= 1 ? 1 : surfFade * surfFade * (3 - 2 * surfFade);

        const isHead = k === c.len - 1;
        const fade = (k + 1) / c.len;                  // 0 topo → 1 cabeça
        const base = c.bright ? 0.85 : 0.5;

        if (isHead && c.bright) {
          ctx.shadowColor = "rgba(245,230,194,0.9)";
          ctx.shadowBlur = 8 * surfFade;
          ctx.fillStyle = `rgba(245,230,194,${(0.95 * surfFade).toFixed(3)})`;
        } else if (isHead) {
          ctx.shadowBlur = 0;
          ctx.fillStyle = `rgba(226,199,148,${(0.85 * surfFade).toFixed(3)})`;
        } else {
          ctx.shadowBlur = 0;
          const a = (fade * fade * base * surfFade).toFixed(3);
          ctx.fillStyle = c.bright
            ? `rgba(201,168,106,${a})`
            : `rgba(140,116,76,${a})`;
        }
        ctx.fillText(c.chars[k], c.x, gy);
      }
      ctx.shadowBlur = 0;
    }
  }

  // ---------- Loop ----------------------------------------------------
  function frame(dt, t) {
    ctx.clearRect(0, 0, W, H);
    updateSurface(dt);
    drawRain(dt, t);
    drawSurface(t);
    drawRipples(dt, t);
  }

  function drawStaticFrame() {
    // Avança a simulação "no escuro" e exibe um único quadro estático
    for (let i = 0; i < 400; i++) {
      for (const c of columns) {
        if (c.delay > 0) { c.delay -= 1 / 60; continue; }
        c.y += c.speed / 60;
        if (c.y - c.len * FONT_SIZE > surfaceY) {
          Object.assign(c, makeColumn(columns.indexOf(c), true));
          initColumn(c);
        }
      }
    }
    frame(0, 1.3);
  }

  let last = 0;
  function loop(now) {
    if (!running) return;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    // Janela minimizada: pula o desenho, mantém o agendamento
    if (!document.hidden) frame(dt, now / 1000);
    rafId = requestAnimationFrame(loop);
  }

  function start() {
    if (running) return;
    // Sempre re-mede: a janela pode ter sido redimensionada com a home oculta
    resize();
    if (reduceMotion) {
      drawStaticFrame();
      return;
    }
    running = true;
    last = performance.now();
    rafId = requestAnimationFrame(loop);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(rafId);
  }

  window.HomeBg = { start, stop };

  // Auto-start: a home é a view inicial (body.home-active já no HTML)
  if (document.body.classList.contains("home-active")) start();
})();
