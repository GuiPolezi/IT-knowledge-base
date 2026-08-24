/* =====================================================================
   FUNDO ANIMADO DA HOME — oceano profundo com "neve marinha" e um polvo
   procedural bioluminescente nadando em trajetória Lissajous, com ciclos
   de propulsão. Vanilla JS + Canvas 2D, sem dependências.

   Tudo é pintado no #home-canvas e confinado à área ACIMA da linha da
   superfície (surfaceY); a linha branca sutil marca o limite. Como o
   fundo inteiro vive no canvas, a transição home ↔ páginas (translateY
   em home.css) leva oceano, polvo e linha juntos.

   Exposto como window.HomeBg = { start, stop } para o app.js pausar a
   animação quando a home estiver oculta (custo zero nas telas internas).
   ===================================================================== */
(() => {
  const canvas = document.getElementById("home-canvas");
  const ctx = canvas.getContext("2d");

  // ---------- Configuração ------------------------------------------
  const SURFACE_POS = 0.76;  // limite inferior do fundo — manter em sincronia com --home-surface: 76vh em home.css
  const LINE_ALPHA  = 0.14;  // opacidade da linha branca do limite
  const CYCLE       = 2.8;   // segundos por "jato" de propulsão do polvo

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let W = 0, H = 0, DPR = 1, surfaceY = 0, R = 0;
  let time = 0;
  let running = false;
  let rafId = 0;
  let oceanGrad = null;     // luz difusa vinda de cima (criado no resize)
  let vignetteGrad = null;  // vinheta nas bordas da área útil

  // ---------- Utilidades --------------------------------------------
  const rand = (a, b) => a + Math.random() * (b - a);
  const smooth = (a, b, x) => {
    x = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return x * x * (3 - 2 * x);
  };

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    // window.innerWidth/innerHeight (e não clientWidth): o canvas pode
    // estar oculto/transformado e mediria errado
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width  = W * DPR;
    canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    surfaceY = H * SURFACE_POS;
    R = Math.min(W, surfaceY) * 0.105; // escala do polvo

    // Equivalente ao radial-gradient(120% 80% at 50% -10%) do design
    oceanGrad = ctx.createRadialGradient(W * 0.5, -H * 0.1, 0, W * 0.5, -H * 0.1, H * 1.1);
    oceanGrad.addColorStop(0, "#0B1626");
    oceanGrad.addColorStop(0.6, "#05090F");
    oceanGrad.addColorStop(1, "#05090F");

    const cx = W / 2, cy = surfaceY / 2;
    const vr = Math.hypot(cx, cy);
    vignetteGrad = ctx.createRadialGradient(cx, cy, vr * 0.55, cx, cy, vr);
    vignetteGrad.addColorStop(0, "rgba(0,0,0,0)");
    vignetteGrad.addColorStop(1, "rgba(0,0,0,0.5)");

    seedMotes();
  }
  window.addEventListener("resize", () => {
    if (!running) return; // start() sempre re-mede ao voltar para a home
    resize();
  });

  // ---------- "Neve marinha" (partículas subindo) --------------------
  const motes = [];
  function seedMotes() {
    motes.length = 0;
    const n = Math.round((W * surfaceY) / 22000);
    for (let i = 0; i < n; i++) motes.push({
      x: rand(0, W), y: rand(0, surfaceY),
      r: rand(0.5, 1.9),
      vy: -rand(3, 11), vx: rand(-2, 2),
      a: rand(0.06, 0.32), ph: rand(0, Math.PI * 2)
    });
  }

  function updateMotes(dt) {
    for (const m of motes) {
      m.y += m.vy * dt;
      m.x += (m.vx + Math.sin(time * 0.6 + m.ph) * 4) * dt;
      if (m.y < -4) { m.y = surfaceY + 4; m.x = rand(0, W); }
      if (m.x < -4) m.x = W + 4; else if (m.x > W + 4) m.x = -4;
    }
  }

  function drawMotes() {
    for (const m of motes) {
      const a = m.a * (0.7 + 0.3 * Math.sin(time * 0.8 + m.ph));
      ctx.fillStyle = `rgba(190,225,220,${a.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ---------- Polvo ---------------------------------------------------
  // Fase do ciclo de propulsão: sobe rápido (contração) e relaxa devagar
  const contraction = (t) => {
    const u = (t % CYCLE) / CYCLE;
    return u < 0.22 ? smooth(0, 0.22, u) : 1 - smooth(0.22, 1, u);
  };

  // Trajetória suave (Lissajous) confinada à área acima da linha; a
  // amplitude vertical menor faz o polvo só ocasionalmente "mergulhar"
  // no limite (onde o clip o corta, como se afundasse)
  const pathAt = (s) => ({
    x: W * 0.5 + W * 0.34 * Math.sin(s * 0.53),
    y: surfaceY * 0.5 + surfaceY * 0.24 * Math.sin(s * 0.89 + 1.7)
  });

  const octo = { x: 0, y: 0, heading: 0, s: 0 };

  const arms = Array.from({ length: 8 }, (_, i) => {
    const spread = (i - 3.5) / 3.5; // -1 … 1
    return {
      spread,
      phase: rand(0, Math.PI * 2),
      freq: rand(1.3, 2.0),
      len: rand(0.88, 1.12),
      curl: rand(0.35, 0.9) * Math.sign(spread)
    };
  }).sort((a, b) => Math.abs(b.spread) - Math.abs(a.spread)); // externos primeiro

  function updateOcto(dt) {
    const c = contraction(time);
    octo.s += dt * (0.12 + 0.34 * c); // acelera no jato
    const p = pathAt(octo.s), q = pathAt(octo.s + 0.01);
    octo.x = p.x; octo.y = p.y;
    const target = Math.atan2(q.y - p.y, q.x - p.x);
    let d = target - octo.heading;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    octo.heading += d * Math.min(1, dt * 2.5);
  }

  function drawArm(arm, c) {
    const fan = 1.05 - 0.55 * c;                 // braços fecham no jato
    const ang = Math.PI + arm.spread * fan;
    const L = R * 3.1 * arm.len * (1 + 0.12 * c);
    const ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux;
    const w0 = R * 0.30, amp = R * 0.6 * (1 - 0.55 * c);
    const SEG = 24, pts = [], ws = [];

    for (let k = 0; k <= SEG; k++) {
      const t = k / SEG;
      const wave = Math.sin(time * arm.freq + arm.phase - t * 4.2) * amp * t * t;
      const curl = arm.curl * R * 0.5 * t * t * (1 - 0.6 * c);
      const off = wave + curl;
      pts.push([ux * L * t + nx * off, uy * L * t + ny * off]);
      ws.push(w0 * Math.pow(1 - t, 1.3) + R * 0.02);
    }

    // normais por ponto
    const left = [], right = [], norms = [];
    for (let k = 0; k <= SEG; k++) {
      const a = pts[Math.max(0, k - 1)], b = pts[Math.min(SEG, k + 1)];
      let tx = b[0] - a[0], ty = b[1] - a[1];
      const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
      const px = -ty, py = tx;
      norms.push([px, py]);
      left.push([pts[k][0] + px * ws[k], pts[k][1] + py * ws[k]]);
      right.push([pts[k][0] - px * ws[k], pts[k][1] - py * ws[k]]);
    }

    const g = ctx.createLinearGradient(0, 0, pts[SEG][0], pts[SEG][1]);
    g.addColorStop(0, "#D9DFE4");
    g.addColorStop(1, "#93A5B2");
    ctx.fillStyle = g; ctx.strokeStyle = g;
    ctx.lineWidth = 1; ctx.lineJoin = "round"; ctx.lineCap = "round";

    ctx.beginPath();
    ctx.moveTo(left[0][0], left[0][1]);
    for (let k = 1; k <= SEG; k++) ctx.lineTo(left[k][0], left[k][1]);
    for (let k = SEG; k >= 0; k--) ctx.lineTo(right[k][0], right[k][1]);
    ctx.closePath(); ctx.fill(); ctx.stroke();

    // ventosas discretas no lado interno
    const side = -Math.sign(arm.spread);
    ctx.fillStyle = "rgba(5,9,15,0.28)";
    for (let k = 4; k < SEG - 2; k += 3) {
      const [px, py] = norms[k];
      ctx.beginPath();
      ctx.arc(
        pts[k][0] + px * ws[k] * 0.45 * side,
        pts[k][1] + py * ws[k] * 0.45 * side,
        ws[k] * 0.28, 0, Math.PI * 2
      );
      ctx.fill();
    }
  }

  function drawOcto() {
    const c = contraction(time);
    ctx.save();
    ctx.translate(octo.x, octo.y);
    ctx.rotate(octo.heading);

    // brilho bioluminescente
    const glow = ctx.createRadialGradient(R * 0.4, 0, 0, R * 0.4, 0, R * 3.4);
    glow.addColorStop(0, `rgba(95,227,200,${(0.10 + 0.08 * c).toFixed(3)})`);
    glow.addColorStop(1, "rgba(95,227,200,0)");
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(R * 0.4, 0, R * 3.4, 0, Math.PI * 2); ctx.fill();

    // braços
    for (const a of arms) drawArm(a, c);

    // base (membrana entre os braços)
    const mw = R * 0.95 * (1 - 0.10 * c);
    const ml = R * 1.7 * (1 + 0.12 * c);
    ctx.fillStyle = "#C6D1DA";
    ctx.beginPath(); ctx.arc(-R * 0.12, 0, mw * 0.8, 0, Math.PI * 2); ctx.fill();

    // manto
    const bg = ctx.createLinearGradient(-R * 0.3, 0, ml, 0);
    bg.addColorStop(0, "#C3CFD8");
    bg.addColorStop(1, "#EEEAE0");
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.moveTo(-R * 0.25, -mw * 0.75);
    ctx.bezierCurveTo(ml * 0.30, -mw * 1.15, ml * 1.05, -mw * 0.70, ml, 0);
    ctx.bezierCurveTo(ml * 1.05, mw * 0.70, ml * 0.30, mw * 1.15, -R * 0.25, mw * 0.75);
    ctx.quadraticCurveTo(-R * 0.45, 0, -R * 0.25, -mw * 0.75);
    ctx.closePath(); ctx.fill();

    // olhos
    ctx.fillStyle = "#05090F";
    for (const sgn of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(R * 0.06, sgn * mw * 0.64, R * 0.075, R * 0.095, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  // ---------- Loop ----------------------------------------------------
  function frame(dt) {
    updateMotes(dt);
    updateOcto(dt);

    ctx.clearRect(0, 0, W, H);

    // Tudo confinado à área acima da linha (nem o glow escapa do clip)
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, surfaceY);
    ctx.clip();

    ctx.fillStyle = oceanGrad;
    ctx.fillRect(0, 0, W, surfaceY);
    drawMotes();
    drawOcto();
    ctx.fillStyle = vignetteGrad;
    ctx.fillRect(0, 0, W, surfaceY);

    ctx.restore();

    // Linha do limite: branca, quase invisível
    ctx.strokeStyle = `rgba(255,255,255,${LINE_ALPHA})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, surfaceY + 0.5);
    ctx.lineTo(W, surfaceY + 0.5);
    ctx.stroke();
  }

  function drawStaticFrame() {
    // Pose fixa: posiciona o polvo na trajetória e exibe um único quadro
    time = 4;
    octo.s = 2;
    updateOcto(0.016);
    frame(0);
  }

  let last = 0;
  function loop(now) {
    if (!running) return;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    time += dt;
    // Janela minimizada: pula o desenho, mantém o agendamento
    if (!document.hidden) frame(dt);
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
    updateOcto(0.016); // orienta o polvo antes do primeiro quadro
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
