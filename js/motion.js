// HomeWise — motor de motion compartilhado por todas as páginas.
// • Controle "Animações" (Seguir sistema | Ativadas | Reduzidas), salvo no navegador.
// • Um único listener de scroll (passivo + requestAnimationFrame) que só atualiza trilhas
//   próximas da área visível (IntersectionObserver) e escreve transform/opacity/variáveis CSS.
// • Revelações executadas uma vez por carregamento, com variações por tipo de conteúdo.
// • Composições próprias: abertura da inicial, etapas conectadas, planos, formulários e a
//   narrativa da casa conectada do hotsite.
(() => {
  if (window.HWMotion) return;
  const root = document.documentElement;
  const body = document.body;
  const currentScript = document.currentScript;
  const siteRoot = new URL('../', currentScript ? currentScript.src : location.href);
  const systemQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const PREF_KEY = 'homewise-motion';

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const range = (v, a, b) => clamp((v - a) / (b - a));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const easeInOut = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const isFull = () => root.dataset.motion === 'full';
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
  const docTop = el => el.getBoundingClientRect().top + window.scrollY;

  const page = body.classList.contains('hotsite-page') ? 'hotsite'
    : body.classList.contains('home-page') ? 'home'
    : body.classList.contains('how-page') ? 'how'
    : body.classList.contains('pricing-page') ? 'pricing'
    : body.classList.contains('cart-page') ? 'cart'
    : $('#auth-form') ? 'login'
    : $('.faq') ? 'faq'
    : $('.testimonials') ? 'testimonials'
    : $('.team') ? 'about' : 'other';

  /* ------------------------------------------------------------------ */
  /* Escrita de estilos com cache (evita escrever o mesmo valor a cada frame) */
  /* ------------------------------------------------------------------ */
  let cache = new WeakMap();
  function put(el, key, value, apply) {
    let c = cache.get(el);
    if (!c) cache.set(el, c = {});
    if (c[key] === value) return;
    c[key] = value;
    apply(value);
  }
  const setVar = (el, name, v) => put(el, name, typeof v === 'number' ? v.toFixed(4) : v, val => el.style.setProperty(name, val));
  const setStyle = (el, prop, v) => put(el, prop, v, val => { el.style[prop] = val; });

  /* ------------------------------------------------------------------ */
  /* Motor de rolagem                                                    */
  /* ------------------------------------------------------------------ */
  const tracks = [];
  const gateMap = new Map();
  const gate = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const t = gateMap.get(entry.target);
      if (!t) return;
      t.active = entry.isIntersecting;
      if (t.active) schedule();
    });
  }, { rootMargin: '35% 0px 35% 0px' });
  function track(t) {
    tracks.push(t);
    if (t.el) { t.active = false; gateMap.set(t.el, t); gate.observe(t.el); } else t.active = true;
    t.measure?.();
    return t;
  }
  let frame = 0;
  function tick() {
    frame = 0;
    if (!isFull()) return;
    const y = window.scrollY;
    for (const t of tracks) if (t.active) t.update(y);
  }
  function schedule() { if (!frame) frame = requestAnimationFrame(tick); }
  const measurers = [];
  function measureAll() {
    measurers.forEach(fn => fn());
    if (isFull()) tracks.forEach(t => t.measure?.());
    tick();
  }
  let measureTimer = 0;
  const queueMeasure = () => { clearTimeout(measureTimer); measureTimer = setTimeout(measureAll, 90); };
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', queueMeasure, { passive: true });
  if ('ResizeObserver' in window) new ResizeObserver(queueMeasure).observe(body);
  window.addEventListener('load', queueMeasure, { once: true });
  document.fonts?.ready.then(queueMeasure);

  /* ------------------------------------------------------------------ */
  /* Revelações (uma vez por carregamento)                               */
  /* ------------------------------------------------------------------ */
  const revealConfig = new WeakMap();
  const docOrder = (a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);
  const revealIO = new IntersectionObserver(entries => {
    entries.filter(e => e.isIntersecting).map(e => e.target).sort(docOrder).forEach((el, i) => {
      revealIO.unobserve(el);
      play(el, i);
    });
  }, { rootMargin: '0px 0px -8% 0px' });
  function play(el, i) {
    const cfg = revealConfig.get(el) || {};
    const delay = cfg.delay ? cfg.delay(el, i) : i * (cfg.stagger ?? 90);
    el.style.setProperty('--hw-d', delay + 'ms');
    el.classList.add('is-in');
    cfg.onIn?.(el);
    setTimeout(() => {
      el.classList.remove('hw-pre', 'is-in');
      el.removeAttribute('data-hw');
      el.style.removeProperty('--hw-d');
    }, (cfg.duration ?? 1400) + delay);
  }
  function reveal(targets, variant, cfg = {}) {
    const list = typeof targets === 'string' ? $$(targets) : [...(targets.length !== undefined ? targets : [targets])];
    list.forEach((el, index) => {
      if (!el || el.dataset.hw || el.dataset.hwDone) return;
      el.dataset.hwDone = '1';
      el.dataset.hw = typeof variant === 'function' ? variant(el, index) : variant;
      el.classList.add('hw-pre');
      revealConfig.set(el, cfg);
      revealIO.observe(el);
    });
  }
  // Títulos: cada palavra em uma máscara própria (o texto continua no DOM, legível e selecionável).
  function splitWords(el) {
    if (!el || el.dataset.hwSplit) return el;
    el.dataset.hwSplit = '1';
    const wrap = node => {
      const outer = document.createElement('span');
      outer.className = 'hw-w';
      const inner = document.createElement('span');
      inner.className = 'hw-wi';
      outer.append(inner);
      if (typeof node === 'string') inner.textContent = node; else { node.replaceWith(outer); inner.append(node); }
      return outer;
    };
    const walk = parent => {
      [...parent.childNodes].forEach(node => {
        if (node.nodeType === 3) {
          const frag = document.createDocumentFragment();
          node.data.split(/(\s+)/).forEach(part => {
            if (!part) return;
            frag.append(/^\s+$/.test(part) ? document.createTextNode(part) : wrap(part));
          });
          node.replaceWith(frag);
        } else if (node.nodeType === 1 && node.tagName !== 'BR') {
          if (node.classList.contains('gradient') || node.tagName === 'I') wrap(node); else walk(node);
        }
      });
    };
    walk(el);
    $$('.hw-wi', el).forEach((w, i) => w.style.setProperty('--i', i));
    return el;
  }
  const revealWords = (sel, cfg) => $$(sel).forEach(el => reveal(splitWords(el), 'words', { duration: 1800, ...cfg }));

  /* ------------------------------------------------------------------ */
  /* Preferência "Animações"                                            */
  /* ------------------------------------------------------------------ */
  function readPref() {
    try { const v = localStorage.getItem(PREF_KEY); return v === 'full' || v === 'reduced' ? v : 'system'; } catch { return 'system'; }
  }
  function applyMode() {
    const pref = readPref();
    const mode = pref === 'system' ? (systemQuery.matches ? 'reduced' : 'full') : pref;
    const changed = root.dataset.motion !== mode;
    root.dataset.motionPref = pref;
    root.dataset.motion = mode;
    syncControl();
    if (changed) onModeChange();
  }
  systemQuery.addEventListener?.('change', applyMode);

  let controlRefs = null;
  function buildDock() {
    const dock = document.createElement('div');
    dock.className = 'hw-dock';
    const theme = $('.theme-toggle');
    if (theme) dock.append(theme);
    dock.insertAdjacentHTML('beforeend', `
      <button type="button" class="hw-motion-btn" aria-expanded="false" aria-controls="hw-motion-panel">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M2 12c2.5-5 5-5 7.5 0s5 5 7.5 0 3.3-3.3 5-1.5"/><path d="M2 18c2.5-3 5-3 7.5 0" opacity=".5"/></svg>
        Animações <span class="hw-motion-state"></span>
      </button>
      <div class="hw-motion-panel" id="hw-motion-panel" hidden>
        <fieldset>
          <legend>Animações</legend>
          <label class="hw-motion-opt"><input type="radio" name="hw-motion" value="system"><span>Seguir sistema<small class="hw-system-note"></small></span></label>
          <label class="hw-motion-opt"><input type="radio" name="hw-motion" value="full"><span>Ativadas<small>Abertura, parallax e transições</small></span></label>
          <label class="hw-motion-opt"><input type="radio" name="hw-motion" value="reduced"><span>Reduzidas<small>Conteúdo imediato, sem deslocamentos</small></span></label>
        </fieldset>
        <button type="button" class="hw-replay"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false" style="fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>Rever abertura</button>
        <p class="hw-replay-hint" hidden>Ative as animações para rever a abertura.</p>
      </div>`);
    body.append(dock);
    const button = $('.hw-motion-btn', dock);
    const panel = $('.hw-motion-panel', dock);
    const replay = $('.hw-replay', dock);
    controlRefs = { dock, button, panel, replay, hint: $('.hw-replay-hint', dock), state: $('.hw-motion-state', dock), note: $('.hw-system-note', dock), radios: $$('input', dock) };
    const close = (focus = false) => {
      if (panel.hidden) return;
      panel.hidden = true;
      button.setAttribute('aria-expanded', 'false');
      if (focus) button.focus();
    };
    button.addEventListener('click', () => {
      const open = panel.hidden;
      panel.hidden = !open;
      button.setAttribute('aria-expanded', String(open));
      if (open) (controlRefs.radios.find(r => r.checked) || controlRefs.radios[0]).focus();
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden) close(true); });
    document.addEventListener('pointerdown', e => { if (!dock.contains(e.target)) close(); });
    controlRefs.radios.forEach(radio => radio.addEventListener('change', () => {
      try { if (radio.value === 'system') localStorage.removeItem(PREF_KEY); else localStorage.setItem(PREF_KEY, radio.value); } catch {}
      applyMode();
    }));
    replay.addEventListener('click', () => {
      close();
      if (page === 'home' && opening) opening.replay();
      else if (page === 'hotsite' && story) story.replay();
      else location.href = new URL('index.html#abertura', siteRoot).href;
    });
    syncControl();
  }
  function syncControl() {
    if (!controlRefs) return;
    const pref = root.dataset.motionPref || 'system';
    controlRefs.radios.forEach(r => { r.checked = r.value === pref; });
    controlRefs.note.textContent = `Agora: ${systemQuery.matches ? 'reduzidas' : 'ativadas'} no sistema`;
    controlRefs.state.textContent = isFull() ? 'ativadas' : 'reduzidas';
    controlRefs.replay.disabled = !isFull();
    controlRefs.hint.hidden = isFull();
  }

  /* ------------------------------------------------------------------ */
  /* Cabeçalho: compacta com a rolagem e mostra o progresso da página    */
  /* ------------------------------------------------------------------ */
  function setupNavbar() {
    const navbar = $('.navbar');
    const nav = navbar && $('.nav', navbar);
    const logo = nav && $('.logo', nav);
    if (!logo) return;
    navbar.classList.add('hw-nav');
    let line = $('.hw-flowline', navbar);
    if (!line) {
      line = document.createElement('span');
      line.className = 'hw-flowline';
      line.setAttribute('aria-hidden', 'true');
      line.innerHTML = '<span class="hw-flowline-fill"></span>';
      navbar.append(line);
    }
    const fill = line.firstElementChild;
    let headRange = 140, max = 1;
    track({
      measure() {
        const H = navbar.offsetHeight || 1, lh = logo.offsetHeight || 1;
        const compact = Math.max(40, lh * .62), shrink = Math.max(0, lh - compact);
        setVar(navbar, '--hw-shrink', shrink);
        setVar(navbar, '--hw-ratio', shrink / H);
        setVar(navbar, '--hw-logo-k', 1 - compact / lh);
        const mid = logo.offsetTop + lh / 2;
        for (const child of nav.children) child.classList.toggle('hw-row2', child.offsetParent !== null && child.offsetTop > mid);
        headRange = Math.max(110, shrink * 4.5);
        max = Math.max(1, root.scrollHeight - window.innerHeight);
      },
      update(y) {
        const start = opening && opening.isActive() ? opening.distance() : 0;
        setVar(navbar, '--hw-head', clamp((y - start) / headRange));
        setStyle(fill, 'transform', `scaleX(${clamp(y / max).toFixed(4)})`);
        if (start) {
          const p = clamp(y / start);
          setVar(navbar, '--hw-navbg', range(p, .7, 1));
          setVar(navbar, '--hw-logo-o', range(p, .83, .93));
        } else {
          setVar(navbar, '--hw-navbg', 1);
          setVar(navbar, '--hw-logo-o', 1);
        }
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* INÍCIO — abertura controlada pela rolagem                          */
  /* ------------------------------------------------------------------ */
  let opening = null;
  function setupOpening() {
    const op = $('.hw-opening');
    if (!op) return null;
    const sticky = $('.hw-op-sticky', op), center = $('.hw-op-center', op), brand = $('.hw-op-brand', op);
    const house = $('.hw-op-house', op), waves = $('.hw-op-waves', op), bg = $('.hw-op-bg', op), grid = $('.hw-op-grid', op);
    const phones = $$('.hw-op-phone', op), fades = $$('.hw-op-fade', op);
    const nodeWater = $('.hw-op-node-water', op), nodeEnergy = $('.hw-op-node-energy', op);
    const navbar = $('.navbar'), logo = navbar && $('.logo', navbar);
    $$('.hw-draw', op).forEach((el, i) => el.style.setProperty('--n', i));
    $$('.hw-op-node', op).forEach((el, i) => el.style.setProperty('--n', i));
    $$('.hw-op-waves path', op).forEach((el, i) => el.style.setProperty('--n', i));
    let D = 600, lastWidth = 0, fly = { dx: 0, dy: 0, s: 1 }, waveDrop = 0, narrow = false;
    const isActive = () => root.classList.contains('hw-show-opening') && isFull();
    new IntersectionObserver(([e]) => op.classList.toggle('is-near', e.isIntersecting)).observe(op);

    function measure() {
      if (!isActive() || !logo) return;
      const w = window.innerWidth;
      narrow = w < 700;
      if (w !== lastWidth) { // altura muda com a barra do navegador no celular: só a largura redefine o trecho
        lastWidth = w;
        D = Math.round(window.innerHeight * (narrow ? .75 : .9));
        op.style.setProperty('--op-d', D + 'px');
      }
      root.style.setProperty('--hw-nav-h', navbar.offsetHeight + 'px');
      const img = $('.logo-image', logo), cs = getComputedStyle(logo);
      const K = narrow ? 1.45 : w < 1100 ? 1.8 : 2.1;
      op.style.setProperty('--op-img', img.offsetWidth * K + 'px');
      op.style.setProperty('--op-font', parseFloat(cs.fontSize) * K + 'px');
      op.style.setProperty('--op-gap', (parseFloat(cs.columnGap) || 12) * K + 'px');
      // Geometria sem transformações: marca dentro do palco fixo × logo no cabeçalho.
      const bx = center.offsetLeft + brand.offsetLeft, by = center.offsetTop + brand.offsetTop;
      const navRect = $('.nav', navbar).getBoundingClientRect();
      const tx = navRect.left + logo.offsetLeft, ty = navRect.top + logo.offsetTop;
      fly = {
        dx: (tx + logo.offsetWidth / 2) - (bx + brand.offsetWidth / 2),
        dy: (ty + logo.offsetHeight / 2) - (by + brand.offsetHeight / 2),
        s: logo.offsetWidth / (brand.offsetWidth || 1)
      };
      waveDrop = sticky.offsetHeight - 1 - (waves.offsetTop + waves.offsetHeight / 2);
    }
    function update(y) {
      if (!isActive()) return;
      const p = clamp(y / D);
      const pf = range(p, 0, .28);
      fades.forEach(el => {
        setStyle(el, 'opacity', (1 - pf).toFixed(3));
        setStyle(el, 'translate', `0 ${(-46 * pf).toFixed(1)}px`);
        el.classList.toggle('is-gone', pf > .97);
      });
      const pb = easeInOut(range(p, .2, .86));
      setStyle(brand, 'translate', `${(fly.dx * pb).toFixed(1)}px ${(fly.dy * pb).toFixed(1)}px`);
      setStyle(brand, 'scale', (1 + (fly.s - 1) * pb).toFixed(4));
      setStyle(brand, 'opacity', (1 - range(p, .84, .94)).toFixed(3));
      const ph = easeOut(range(p, 0, .9));
      setStyle(house, 'scale', (1 - .4 * ph).toFixed(4));
      setStyle(house, 'translate', `0 ${(-7 * ph).toFixed(2)}vh`);
      setStyle(house, 'opacity', (1 - .45 * ph).toFixed(3));
      setStyle(nodeWater, 'translate', `${(90 * ph).toFixed(1)}px ${(-30 * ph).toFixed(1)}px`);
      setStyle(nodeEnergy, 'translate', `${(-90 * ph).toFixed(1)}px ${(-30 * ph).toFixed(1)}px`);
      const pp = easeOut(range(p, .04, .85));
      phones.forEach((phone, i) => {
        const side = i === 0 ? -1 : 1;
        const [x0, y0, r0, x1, y1, r1, s1] = narrow ? [31, 40, 14, 29, 21, 6, .95] : [37, 36, 16, 24, 4, 7, 1];
        setStyle(phone, 'translate', `${(side * lerp(x0, x1, pp)).toFixed(2)}vw ${lerp(y0, y1, pp).toFixed(2)}vh`);
        setStyle(phone, 'rotate', `${(side * lerp(r0, r1, pp)).toFixed(2)}deg`);
        setStyle(phone, 'scale', lerp(.8, s1, pp).toFixed(4));
      });
      const pw = easeInOut(range(p, .18, .92));
      setStyle(waves, 'scale', `1 ${(1 - .97 * pw).toFixed(4)}`);
      setStyle(waves, 'translate', `0 ${(waveDrop * pw).toFixed(1)}px`);
      setStyle(bg, 'opacity', (1 - range(p, .55, 1)).toFixed(3));
      setStyle(grid, 'translate', `0 ${(-90 * p).toFixed(1)}px`);
    }
    function play() {
      op.classList.remove('is-playing');
      void op.offsetWidth;
      op.classList.add('is-playing');
    }
    function replay() {
      root.classList.add('hw-show-opening');
      cache = new WeakMap();
      measureAll();
      window.scrollTo({ top: 0, behavior: 'instant' });
      play();
      schedule();
      $('.hw-op-actions .btn', op)?.focus({ preventScroll: true });
    }
    const t = track({ el: op, measure, update });
    t.isActive = isActive;
    if (isActive()) play();
    if (location.hash === '#abertura') history.replaceState(null, '', location.pathname + location.search);
    return { isActive, distance: () => D, replay, play };
  }

  /* ------------------------------------------------------------------ */
  /* INÍCIO — hero, seções e CTA                                         */
  /* ------------------------------------------------------------------ */
  function wavePath(width, mid, amp, wavelength) {
    const half = wavelength / 2, lift = amp * 4 / 3;
    let d = `M0 ${mid}`;
    for (let x = 0, dir = -1; x < width; x += half, dir *= -1) {
      const yy = mid + dir * lift;
      d += ` C${(x + half * .36).toFixed(1)} ${yy.toFixed(1)} ${(x + half * .64).toFixed(1)} ${yy.toFixed(1)} ${(x + half).toFixed(1)} ${mid}`;
    }
    return d;
  }
  function setupHome() {
    const hero = $('.hero');
    if (!hero) return;
    if (!$('.hw-hero-flow', hero)) {
      const flow = document.createElement('div');
      flow.className = 'hw-hero-flow';
      flow.setAttribute('aria-hidden', 'true');
      flow.innerHTML = `<svg class="hw-flow-water" viewBox="0 0 2400 160" preserveAspectRatio="none" focusable="false"><path d="${wavePath(2400, 80, 30, 600)}"/></svg>` +
        `<svg class="hw-flow-energy" viewBox="0 0 2400 160" preserveAspectRatio="none" focusable="false"><path d="${wavePath(2400, 88, 16, 400)}"/></svg>`;
      hero.prepend(flow);
    }
    const pair = $('.home-phone-pair', hero);
    pair?.classList.add('hw-sl');
    let top = 0, height = 1, navH = 100;
    track({
      el: hero,
      measure() { top = docTop(hero); height = hero.offsetHeight; navH = $('.navbar')?.offsetHeight || 0; },
      update(y) {
        const vh = window.innerHeight;
        setVar(hero, '--hw-in', easeOut(clamp((y - (top - vh)) / Math.max(1, vh - navH - 40))));
        const rel = y - (top - navH);
        setVar(hero, '--hw-s', clamp(rel / (vh * .7)));
        setVar(hero, '--hw-y', clamp(rel, 0, height));
      }
    });
    revealWords('.hero h1');
    reveal('.hero .badge', 'clip');
    reveal('.hero .lead', 'fade', { stagger: 0, delay: () => 250 });
    reveal($$('.hero .actions .btn'), 'pop', { delay: (el, i) => 380 + i * 90 });
    const features = $('.home-page main > .section');
    if (features) band(features);
    const cta = $('.home-page .cta');
    if (cta) liveCta(cta);
  }
  // Fundo que se acende enquanto a seção ocupa a tela e se apaga ao sair.
  function band(section) {
    section.classList.add('hw-band');
    let top = 0, h = 1;
    track({
      el: section,
      measure() { top = docTop(section); h = section.offsetHeight; },
      update(y) {
        const vh = window.innerHeight, topView = top - y, bottomView = top + h - y;
        const enter = range(vh - topView, vh * .15, vh * .6);
        const exit = range(vh * .6 - bottomView, 0, vh * .45);
        setVar(section, '--hw-band', Math.min(enter, 1 - exit));
      }
    });
  }
  function liveCta(cta) {
    cta.classList.add('hw-cta-live', 'hw-sl');
    let top = 0;
    track({
      el: cta,
      measure() { top = docTop(cta); },
      update(y) { setVar(cta, '--hw-q', range(window.innerHeight - (top - y), 0, window.innerHeight * .55)); }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Revelações compartilhadas                                           */
  /* ------------------------------------------------------------------ */
  function setupCommon() {
    revealWords('main .page-head h1, .faq-heading h1, .pricing-page main h1, .how-heading h1');
    reveal('main .page-head .badge, .how-heading .badge', 'clip');
    reveal('main .page-head .lead, .faq-heading .lead, .pricing-page main .lead', 'fade', { delay: () => 260 });
    revealWords('main .section-title');
    reveal('main .section-sub', 'fade', { delay: () => 200 });
    reveal('main .cards > .card', 'tilt', { stagger: 110 });
    reveal('main .cta, main .support', 'unfold', { stagger: 0 });
    const footer = $('footer');
    if (footer) new IntersectionObserver(([e], obs) => { if (e.isIntersecting) { footer.classList.add('hw-footer-in'); obs.disconnect(); } }).observe(footer);
  }

  /* ------------------------------------------------------------------ */
  /* COMO FUNCIONA — etapas que se revelam e uma linha que as conecta     */
  /* ------------------------------------------------------------------ */
  function setupHow() {
    const steps = $('.how-steps');
    if (!steps) return;
    const cards = $$('.how-step-card', steps);
    reveal(cards, (el, i) => (i % 2 ? 'slide-r' : 'slide-l'), { stagger: 140, duration: 1700 });
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('class', 'hw-steps-line');
    svg.setAttribute('aria-hidden', 'true');
    steps.prepend(svg);
    let segments = [], dots = [], top = 0, h = 1;
    function measure() {
      const base = steps.getBoundingClientRect();
      const rects = cards.map(c => { const r = c.getBoundingClientRect(); return { l: r.left - base.left, t: r.top - base.top, r: r.right - base.left, b: r.bottom - base.top, cx: r.left - base.left + r.width / 2, cy: r.top - base.top + r.height / 2 }; });
      svg.setAttribute('viewBox', `0 0 ${base.width} ${base.height}`);
      svg.innerHTML = '';
      segments = []; dots = [];
      const sameRow = (a, b) => Math.abs(a.t - b.t) < 10;
      for (let i = 0; i < rects.length - 1; i++) {
        const a = rects[i], b = rects[i + 1];
        let d, p0, p1;
        if (sameRow(a, b)) { p0 = [a.r, a.cy]; p1 = [b.l, b.cy]; const mx = (p0[0] + p1[0]) / 2; d = `M${p0} C${mx} ${p0[1]} ${mx} ${p1[1]} ${p1}`; }
        else { p0 = [a.cx, a.b]; p1 = [b.cx, b.t]; const my = (p0[1] + p1[1]) / 2; d = `M${p0} C${p0[0]} ${my} ${p1[0]} ${my} ${p1}`; }
        const trackPath = document.createElementNS(ns, 'path');
        trackPath.setAttribute('class', 'hw-track'); trackPath.setAttribute('d', d);
        const run = document.createElementNS(ns, 'path');
        run.setAttribute('class', 'hw-run'); run.setAttribute('d', d); run.setAttribute('pathLength', '1');
        run.style.strokeDasharray = '1'; run.style.strokeDashoffset = '1';
        svg.append(trackPath, run);
        segments.push(run);
        [p0, p1].forEach(([cx, cy]) => {
          const dot = document.createElementNS(ns, 'circle');
          dot.setAttribute('cx', cx); dot.setAttribute('cy', cy); dot.setAttribute('r', 6);
          svg.append(dot); dots.push(dot);
        });
      }
      top = docTop(steps); h = steps.offsetHeight;
    }
    track({
      el: steps, measure,
      update(y) {
        const vh = window.innerHeight;
        const p = range(y + vh * .62, top, top + h);
        const n = segments.length;
        segments.forEach((seg, i) => {
          const s = clamp(p * n - i);
          setStyle(seg, 'strokeDashoffset', (1 - s).toFixed(4));
          dots[i * 2].classList.toggle('on', s > 0);
          dots[i * 2 + 1].classList.toggle('on', s >= 1);
        });
      }
    });
    const main = $('.how-main');
    if (main) {
      let mTop = 0;
      track({ el: main, measure() { mTop = docTop(main); }, update(y) { setVar(main, '--hw-par', clamp(y - mTop, 0, 4000) * .3); } });
    }
  }

  /* ------------------------------------------------------------------ */
  /* DEPOIMENTOS — onda diagonal de entrada e colunas em camadas          */
  /* ------------------------------------------------------------------ */
  function columnIndex(el) {
    const lefts = [...new Set($$(':scope > *', el.parentElement).map(c => c.offsetLeft))].sort((a, b) => a - b);
    return Math.max(0, lefts.indexOf(el.offsetLeft));
  }
  function setupTestimonials() {
    const grid = $('.testimonials');
    if (!grid) return;
    const cards = $$('.testimonial', grid);
    reveal(cards, 'pop', { delay: el => columnIndex(el) * 85, duration: 1700 });
    let cols = [], top = 0, h = 1, count = 1;
    track({
      el: grid,
      measure() {
        top = docTop(grid); h = grid.offsetHeight;
        cols = cards.map(columnIndex);
        count = Math.max(...cols) + 1;
        cards.forEach(c => c.classList.add('hw-sl'));
      },
      update(y) {
        const vh = window.innerHeight;
        const prog = range(y + vh, top, top + h + vh) * 2 - 1;
        cards.forEach((card, i) => {
          const k = cols[i];
          const amp = count < 3 ? 0 : (k % 2 ? -26 : 20) * (k === (count - 1) / 2 ? .4 : 1);
          setStyle(card, 'translate', `0 ${(prog * amp).toFixed(1)}px`);
        });
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* SOBRE / EQUIPE                                                      */
  /* ------------------------------------------------------------------ */
  function setupTeam() {
    reveal('.team > .member', 'pop', { stagger: 95, duration: 1700 });
  }

  /* ------------------------------------------------------------------ */
  /* PLANOS — leque a partir do plano em destaque e troca Mensal/Anual    */
  /* ------------------------------------------------------------------ */
  function setupPricing() {
    const prices = $$('.prices > .price');
    if (!prices.length) return;
    const featuredIndex = Math.max(0, prices.findIndex(p => p.classList.contains('featured')));
    reveal(prices, (el, i) => (i === featuredIndex ? 'fan-c' : i < featuredIndex ? 'fan-l' : 'fan-r'), { delay: el => (el.classList.contains('featured') ? 0 : 200), duration: 1800 });
    reveal('.billing-toggle', 'clip');
    const toggle = $('.billing-toggle');
    if (toggle) new MutationObserver(() => {
      if (!isFull()) return;
      prices.forEach((p, i) => {
        p.classList.remove('hw-sweep');
        void p.offsetWidth;
        p.style.setProperty('animation-delay', i * 80 + 'ms');
        p.classList.add('hw-sweep');
        setTimeout(() => p.classList.remove('hw-sweep'), 1200 + i * 80);
      });
    }).observe(toggle, { subtree: true, attributes: true, attributeFilter: ['aria-pressed'] });
  }

  // Troca de valor sem números intermediários: o valor antigo sai por cima, o novo entra por baixo.
  function animateSwap(el, oldText, kind) {
    if (!isFull() || !el.animate || !oldText || oldText === el.textContent || !el.offsetParent) return;
    const host = el.parentElement;
    host.classList.add('hw-roll-host');
    const ghost = document.createElement('span');
    ghost.className = 'hw-roll-ghost ' + (el.className || '');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.textContent = oldText;
    ghost.style.left = el.offsetLeft + 'px';
    ghost.style.top = el.offsetTop + 'px';
    host.append(ghost);
    const dist = kind === 'note' ? 70 : 100;
    ghost.animate([
      { transform: 'translateY(0)', clipPath: 'inset(-12% -6% -12% -6%)', opacity: 1 },
      { transform: `translateY(-${dist}%)`, clipPath: `inset(${dist}% -6% -12% -6%)`, opacity: 0 }
    ], { duration: 420, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'forwards' }).onfinish = () => ghost.remove();
    el.animate([
      { transform: `translateY(${dist}%)`, clipPath: `inset(-12% -6% ${dist}% -6%)`, opacity: 0 },
      { transform: 'none', clipPath: 'inset(-12% -6% -12% -6%)', opacity: 1 }
    ], { duration: 650, delay: 70, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' });
  }
  function swapValue(el, text, kind) {
    const old = el.textContent;
    if (old === text) return;
    el.textContent = text;
    animateSwap(el, old, kind);
  }
  function watchSwap(el, kind) {
    if (!el) return;
    new MutationObserver(records => {
      const removed = records.flatMap(r => [...r.removedNodes]).map(n => n.textContent).join('');
      animateSwap(el, removed, kind);
    }).observe(el, { childList: true });
  }

  /* ------------------------------------------------------------------ */
  /* Controles segmentados (Mensal/Anual, Criar conta/Entrar, PIX/Cartão) */
  /* ------------------------------------------------------------------ */
  function segmented(group) {
    if (!group || $('.hw-seg-thumb', group)) return;
    group.classList.add('hw-seg');
    const thumb = document.createElement('span');
    thumb.className = 'hw-seg-thumb';
    thumb.setAttribute('aria-hidden', 'true');
    group.prepend(thumb);
    const place = () => {
      const active = $('button[aria-pressed="true"]', group);
      if (!active || !active.offsetWidth) return;
      thumb.style.width = active.offsetWidth + 'px';
      thumb.style.height = active.offsetHeight + 'px';
      thumb.style.transform = `translate(${active.offsetLeft}px, ${active.offsetTop}px)`;
    };
    new MutationObserver(place).observe(group, { subtree: true, attributes: true, attributeFilter: ['aria-pressed'] });
    measurers.push(place);
    place();
    requestAnimationFrame(() => requestAnimationFrame(() => group.classList.add('hw-seg-ready')));
  }

  /* ------------------------------------------------------------------ */
  /* Formulários: status, validação, áreas que aparecem                  */
  /* ------------------------------------------------------------------ */
  const OK_RE = /aprovad|sucesso|copiado|preenchido|ativa e sincronizada/i;
  const ERR_RE = /não foi possível|inválid|erro|verifique|não encontrado|incorret|precisam ser iguais/i;
  function watchStatus(el) {
    if (!el) return;
    const run = () => {
      const text = el.textContent.trim();
      el.classList.remove('hw-status-in', 'hw-status-ok', 'hw-status-err');
      if (!text) return;
      const error = el.dataset.error === 'true' || ERR_RE.test(text);
      el.classList.toggle('hw-status-err', error);
      el.classList.toggle('hw-status-ok', !error && OK_RE.test(text));
      void el.offsetWidth;
      el.classList.add('hw-status-in');
    };
    new MutationObserver(run).observe(el, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['data-error'] });
  }
  function watchAppear(el, stagger) {
    if (!el) return;
    new MutationObserver(() => {
      if (el.hidden || !isFull() || !el.animate) return;
      const parts = stagger ? $$(stagger, el) : [el];
      parts.forEach((part, i) => part.animate([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 420, delay: i * 70, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' }));
    }).observe(el, { attributes: true, attributeFilter: ['hidden'] });
  }
  function setupForms() {
    ['#auth-status', '#cart-status', '#account-status', '#cep-feedback'].forEach(id => watchStatus($(id)));
    ['#payment-pix', '#payment-card', '#name-field', '#confirm-field', '#account-bar', '#active-sub-banner', '#reset-password'].forEach(id => watchAppear($(id)));
    watchAppear($('#protected-cart'), ':scope > form > fieldset, :scope > form > .btn, :scope > aside');
    watchSwap($('#plan-price'));
    watchSwap($('#auth-title'));
    document.addEventListener('invalid', event => {
      const field = event.target;
      if (!field.classList) return;
      field.classList.remove('hw-invalid');
      void field.offsetWidth;
      field.classList.add('hw-invalid');
      setTimeout(() => field.classList.remove('hw-invalid'), 800);
    }, true);
  }
  function setupFormPages() {
    reveal('.auth-intro .cart-summary', 'short', { delay: () => 300 });
    reveal('.auth-card', 'short', { delay: () => 120 });
    reveal('#account-status', 'short');
  }

  /* ------------------------------------------------------------------ */
  /* FAQ                                                                 */
  /* ------------------------------------------------------------------ */
  function setupFaq() {
    reveal('.faq > .faq-item', 'clip', { stagger: 70 });
  }

  /* ------------------------------------------------------------------ */
  /* HOTSITE — a casa conectada ganha vida com a rolagem                 */
  /* ------------------------------------------------------------------ */
  let story = null;
  function setupStory() {
    const st = $('.hs-story');
    if (!st) return null;
    const pipes = $$('.hs-pipe', st), cables = $$('.hs-cable', st), data = $$('.hs-data-draw', st), uplink = $$('.hs-uplink', st);
    const node = k => $(`.hs-node-${k}`, st), tag = k => $(`.hs-tag[data-tone="${k}"]`, st);
    const steps = $$('.hs-step', st);
    $$('.hs-structure > *', st).forEach((el, i) => { el.setAttribute('pathLength', '1'); el.style.setProperty('--n', i); });
    new IntersectionObserver(([e]) => st.classList.toggle('is-near', e.isIntersecting)).observe(st);
    let D = 1800, top = 0, lastWidth = 0, chapter = -1;
    const dash = (list, v) => list.forEach(el => setStyle(el, 'strokeDashoffset', (1 - v).toFixed(4)));
    const on = (k, v) => { node(k)?.classList.toggle('on', v); tag(k)?.classList.toggle('on', v); };
    function measure() {
      const w = window.innerWidth;
      if (w !== lastWidth) {
        lastWidth = w;
        D = Math.round(window.innerHeight * (w < 850 ? 2.6 : 3));
        st.style.setProperty('--hs-d', D + 'px');
      }
      top = docTop(st);
    }
    function update(y) {
      const p = clamp((y - top) / D);
      setVar(st, '--hs-p', p);
      dash(pipes, range(p, .1, .32));
      on('water', p >= .27);
      dash(cables, range(p, .32, .54));
      on('energy', p >= .49);
      on('hub', p >= .58);
      dash(data, range(p, .56, .68));
      st.classList.toggle('is-live', p >= .66);
      setVar(st, '--hs-f', easeInOut(range(p, .7, .88)));
      dash(uplink, range(p, .74, .9));
      const next = p < .1 ? 0 : p < .32 ? 1 : p < .54 ? 2 : p < .72 ? 3 : 4;
      if (next !== chapter) {
        chapter = next;
        st.dataset.chapter = String(chapter);
        steps.forEach((s, i) => { s.classList.toggle('is-active', i === chapter); s.classList.toggle('is-past', i < chapter); });
      }
      st.classList.toggle('is-final', p >= .9);
    }
    function play() { st.classList.remove('is-playing'); void st.offsetWidth; st.classList.add('is-playing'); }
    function replay() {
      cache = new WeakMap();
      measureAll();
      window.scrollTo({ top: 0, behavior: 'instant' });
      play();
      schedule();
    }
    track({ el: st, measure, update });
    play();
    return { replay };
  }
  function setupHotsite() {
    story = setupStory();
    revealWords('.hotsite-page .textoInicio h1, .project-story-heading h2');
    reveal('.hotsite-page .textoInicio > h3, .hotsite-page .textoInicio > p, .project-story-heading > p', 'fade', { stagger: 120 });
    reveal('.hotsite-page .textoInicio > .btn', 'pop', { delay: () => 300 });
    reveal('.hotsite-page .informacoes > div', 'clip', { stagger: 120 });
    reveal('.hot-phones', 'orbit', { duration: 1600 });
    reveal('.hot-brand', 'pop', { delay: () => 500 });
    reveal('.story-chapter', 'rise', { stagger: 140, onIn: el => setTimeout(() => el.classList.add('on'), 300) });
    const journey = $('.story-journey');
    if (journey) {
      let top = 0, h = 1;
      track({ el: journey, measure() { top = docTop(journey); h = journey.offsetHeight; }, update(y) { setVar(journey, '--hw-line', range(y + window.innerHeight * .75, top, top + h * .9)); } });
    }
    const visual = $('.hot-visual .home-phone-pair') || $('.hot-phones');
    if (visual) {
      visual.classList.add('hw-sl');
      let top = 0;
      track({ el: visual, measure() { top = docTop(visual.parentElement); }, update(y) { const s = range(y, top - window.innerHeight * .5, top + window.innerHeight * .6); setStyle(visual, 'translate', `0 ${(-40 * s).toFixed(1)}px`); setStyle(visual, 'rotate', `${(-3 * s).toFixed(2)}deg`); } });
    }
  }

  /* ------------------------------------------------------------------ */
  /* Inicialização                                                      */
  /* ------------------------------------------------------------------ */
  let fullReady = false;
  function initFull() {
    if (fullReady) return;
    fullReady = true;
    setupNavbar();
    if (page === 'home') { opening = setupOpening(); setupHome(); }
    if (page === 'hotsite') setupHotsite();
    setupCommon();
    if (page === 'how') setupHow();
    if (page === 'testimonials') setupTestimonials();
    if (page === 'about' || page === 'hotsite') setupTeam();
    if (page === 'pricing') setupPricing();
    if (page === 'faq') setupFaq();
    if (page === 'login' || page === 'cart') setupFormPages();
    measureAll();
  }
  function onModeChange() {
    cache = new WeakMap();
    if (isFull()) {
      initFull();
      if (page === 'home' && opening && !root.classList.contains('hw-show-opening') && window.scrollY < 60) opening.replay();
      measureAll();
    }
  }

  // Sempre ativos (independem do modo): dock, controles segmentados, formulários e menu.
  $$('.links').forEach(nav => $$('a', nav).forEach((a, i) => a.style.setProperty('--i', i)));
  $$('.checks, .cta-benefits').forEach(list => $$('li', list).forEach((li, i) => li.style.setProperty('--li', i)));
  ['.billing-toggle', '.auth-tabs', '.payment-tabs'].forEach(sel => segmented($(sel)));
  setupForms();
  buildDock();
  if (page === 'hotsite' && !isFull()) story = { replay() {} };
  if (isFull()) initFull();
  else if (page === 'hotsite') { /* hotsite estático: a cena já aparece completa no modo reduzido */ }

  window.HWMotion = { swapValue, replay: () => controlRefs?.replay.click(), applyMode };
})();
