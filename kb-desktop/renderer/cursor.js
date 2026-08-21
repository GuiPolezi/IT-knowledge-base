/* =====================================================================
   CURSOR CUSTOMIZADO — ponto que segue o mouse rápido + anel com atraso
   suave (lerp). Autocontido: cria os próprios elementos e não depende de
   nenhum outro script. Estilos em cursor.css.

   O estado de hover é detectado por elementFromPoint() dentro do loop
   rAF, e NÃO por eventos pointerover/pointerout: com elementos animados
   sob o ponteiro, o Chromium pode recomputar o hover com uma posição
   defasada em gestos rápidos e corromper a cadeia de boundary events
   (verificado empiricamente neste app) — elementFromPoint sempre
   responde certo. O polling também cobre de graça elementos recriados
   via innerHTML (listas de docs/histórico) e botões desabilitados.
   ===================================================================== */
(() => {
  // Dispositivo sem mouse: não cria nada e mantém o cursor nativo
  if (window.matchMedia("(hover: none), (pointer: coarse)").matches) return;

  document.documentElement.classList.add("custom-cursor");

  const dot = document.createElement("div");
  dot.className = "cursor-dot cursor--hidden";
  dot.setAttribute("aria-hidden", "true");
  const ring = document.createElement("div");
  ring.className = "cursor-ring cursor--hidden";
  ring.setAttribute("aria-hidden", "true");
  document.body.append(dot, ring);

  // Alvos de hover (botões desabilitados ficam de fora) e campos de texto
  const INTERACTIVE = 'button:not(:disabled), a, [data-cursor], [data-cursor-color]';
  const TEXT = 'input:not([type="hidden"]), textarea';

  // Com movimento reduzido, o lerp vira snap: cursor estático estilizado
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const DOT_EASE = reduced ? 1 : 0.35;  // o ponto responde rápido
  const RING_EASE = reduced ? 1 : 0.14; // o anel arrasta atrás

  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let dotX = mouseX, dotY = mouseY;
  let ringX = mouseX, ringY = mouseY;
  let hoverEl = null;
  let started = false;

  const lerp = (a, b, t) => a + (b - a) * t;

  function snapToMouse() {
    dotX = ringX = mouseX;
    dotY = ringY = mouseY;
  }

  function setHover(el) {
    hoverEl = el;
    dot.classList.add("cursor--hover");
    ring.classList.add("cursor--hover");
    const color = el.dataset.cursorColor;
    if (color) {
      ring.classList.add("cursor-ring--colored");
      ring.style.backgroundColor = color;
    }
  }

  function clearHover() {
    hoverEl = null;
    dot.classList.remove("cursor--hover");
    ring.classList.remove("cursor--hover", "cursor-ring--colored");
    ring.style.backgroundColor = "";
  }

  document.addEventListener("pointermove", (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    if (!started) {
      started = true;
      snapToMouse();
      dot.classList.remove("cursor--hidden");
      ring.classList.remove("cursor--hidden");
    }
  });

  // Consulta o que está sob o ponteiro e atualiza hover + campo de texto.
  // Roda no loop rAF; barata (hit test em layout já limpo).
  let textHover = false;
  function updateHoverState() {
    const el = document.elementFromPoint(mouseX, mouseY);

    const t = el && el.closest(INTERACTIVE);
    if (t !== hoverEl) {
      clearHover();
      if (t) setHover(t);
    } else if (hoverEl && hoverEl.matches(":disabled")) {
      clearHover(); // desabilitado enquanto em hover (ex.: botão Perguntar)
    }

    const isText = !!(el && el.closest(TEXT));
    if (isText !== textHover) {
      textHover = isText;
      dot.classList.toggle("cursor--text", isText);
      ring.classList.toggle("cursor--text", isText);
    }
  }

  document.addEventListener("pointerdown", () => ring.classList.add("cursor-ring--pressed"));
  document.addEventListener("pointerup", () => ring.classList.remove("cursor-ring--pressed"));

  // Mouse saiu/voltou pela borda da janela
  let inWindow = true;
  document.addEventListener("mouseleave", () => {
    inWindow = false;
    dot.classList.add("cursor--hidden");
    ring.classList.add("cursor--hidden");
    clearHover();
    if (textHover) {
      textHover = false;
      dot.classList.remove("cursor--text");
      ring.classList.remove("cursor--text");
    }
  });
  document.addEventListener("mouseenter", (e) => {
    inWindow = true;
    mouseX = e.clientX;
    mouseY = e.clientY;
    snapToMouse(); // reaparece já no ponto de entrada, sem "voar" pela tela
    if (started) {
      dot.classList.remove("cursor--hidden");
      ring.classList.remove("cursor--hidden");
    }
  });

  // Loop: a cada frame, cada elemento percorre uma fração da distância até
  // o mouse. Quando o lerp converge (<0.1px), faz snap e PARA de escrever
  // estilos — elementos animados parados sob o ponteiro é a condição
  // estável para o recompute de hover do Chromium. O backgroundThrottling
  // do Electron suspende o rAF com a janela oculta.
  let lastDotX = null, lastDotY = null, lastRingX = null, lastRingY = null;
  function animate() {
    dotX = lerp(dotX, mouseX, DOT_EASE);
    dotY = lerp(dotY, mouseY, DOT_EASE);
    ringX = lerp(ringX, mouseX, RING_EASE);
    ringY = lerp(ringY, mouseY, RING_EASE);
    if (Math.abs(mouseX - dotX) < 0.1) dotX = mouseX;
    if (Math.abs(mouseY - dotY) < 0.1) dotY = mouseY;
    if (Math.abs(mouseX - ringX) < 0.1) ringX = mouseX;
    if (Math.abs(mouseY - ringY) < 0.1) ringY = mouseY;

    if (dotX !== lastDotX || dotY !== lastDotY) {
      dot.style.transform = `translate3d(${dotX}px, ${dotY}px, 0)`;
      lastDotX = dotX;
      lastDotY = dotY;
    }
    if (ringX !== lastRingX || ringY !== lastRingY) {
      ring.style.left = ringX + "px";
      ring.style.top = ringY + "px";
      lastRingX = ringX;
      lastRingY = ringY;
    }

    if (started && inWindow) updateHoverState();

    requestAnimationFrame(animate);
  }
  animate();
})();
