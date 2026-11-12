// HomeWise — motor de motion compartilhado por todas as páginas.
// • Animações sempre ativas; reduzidas automaticamente quando o sistema pede movimento reduzido.
// • Um único listener de scroll (passivo + requestAnimationFrame) que só atualiza trilhas
//   próximas da área visível (IntersectionObserver) e escreve transform/opacity/variáveis CSS.
// • Revelações executadas uma vez por carregamento, com variações por tipo de conteúdo.
// • Composições próprias: abertura da inicial, etapas conectadas, planos, formulários e a
//   narrativa da casa conectada do hotsite.
(() => {
  if (window.HWMotion) return;
  const root = document.documentElement;
  const body = document.body;
  const systemQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

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
  /* ------------------------------------------------------------------ */
  /* Proteção dos pontos de entrada                                      */
  /* ------------------------------------------------------------------ */
  // Todo callback assíncrono (rolagem, rAF, timers, observers, eventos) passa por guard().
  // Na primeira exceção: diagnóstico no console, desligamento de todos os callbacks e
  // recuperação para a apresentação estática (nenhum conteúdo fica oculto).
  let failed = false, failure = null;
  const cleanups = [];
  function guard(fn, where) {
    return function guarded(...args) {
      if (failed) return undefined;
      try { return fn.apply(this, args); } catch (error) { fail(error, where); return undefined; }
    };
  }
  function listen(target, type, fn, where, opts) {
    const g = guard(fn, where);
    target.addEventListener(type, g, opts);
    cleanups.push(() => target.removeEventListener(type, g, opts));
  }
  function observer(Ctor, fn, where, opts) {
    const o = new Ctor(guard(fn, where), opts);
    cleanups.push(() => o.disconnect());
    return o;
  }
  const later = (fn, ms, where) => setTimeout(guard(fn, where), ms);
  function fail(error, where) {
    if (failed) return;
    failed = true;
    failure = where;
    console.error(`[HomeWise] Falha no motor de animações (${where}). A página foi mantida na versão estática.`, error);
    cancelAnimationFrame(frame);
    clearTimeout(measureTimer);
    cleanups.splice(0).forEach(c => { try { c(); } catch (e) { console.error('[HomeWise] falha ao desligar um callback', e); } });
    goStatic();
  }

  let cache = new WeakMap();
  // Tudo o que o motor escreve fica registrado para poder ser desfeito (troca de modo ou falha).
  // Entradas de elementos removidos do DOM são descartadas em pruneWritten().
  const written = new Map();
  function pruneWritten() { written.forEach((_, el) => { if (!el.isConnected) written.delete(el); }); }
  function remember(el, key) {
    let s = written.get(el);
    if (!s) written.set(el, s = new Set());
    s.add(key);
  }
  function put(el, key, value, apply) {
    let c = cache.get(el);
    if (!c) cache.set(el, c = {});
    if (c[key] === value) return;
    c[key] = value;
    remember(el, key);
    apply(value);
  }
  const setVar = (el, name, v) => put(el, name, typeof v === 'number' ? v.toFixed(4) : v, val => el.style.setProperty(name, val));
  const setStyle = (el, prop, v) => put(el, prop, v, val => { el.style[prop] = val; });
  function clearWritten() {
    written.forEach((keys, el) => keys.forEach(k => { if (k.startsWith('--')) el.style.removeProperty(k); else el.style[k] = ''; }));
    written.clear();
    cache = new WeakMap();
  }

  /* ------------------------------------------------------------------ */
  /* Motor de rolagem                                                    */
  /* ------------------------------------------------------------------ */
  const tracks = [];
  const gateMap = new Map();
  const gate = observer(IntersectionObserver, entries => {
    entries.forEach(entry => {
      const t = gateMap.get(entry.target);
      if (!t) return;
      t.active = entry.isIntersecting;
      if (t.active) schedule();
    });
  }, 'observador de visibilidade', { rootMargin: '35% 0px 35% 0px' });
  function track(t) {
    if (failed) return t;
    tracks.push(t);
    if (t.el) { t.active = false; gateMap.set(t.el, t); gate.observe(t.el); } else t.active = true;
    t.measure?.();
    return t;
  }
  let frame = 0;
  // Trilhas "soft" continuam ativas no movimento reduzido (só mexem em opacidade).
  const runs = t => isFull() || t.soft;
  const tick = guard(() => {
    frame = 0;
    const y = window.scrollY;
    for (const t of tracks) if (t.active && runs(t)) t.update(y);
  }, 'atualização da rolagem');
  function schedule() { if (!frame && !failed) frame = requestAnimationFrame(tick); }
  const measurers = [];
  const measureAll = guard(() => {
    pruneWritten();
    measurers.forEach(fn => fn());
    tracks.forEach(t => { if (runs(t)) t.measure?.(); });
    tick();
  }, 'medição do layout');
  let measureTimer = 0;
  const queueMeasure = () => { if (failed) return; clearTimeout(measureTimer); measureTimer = later(measureAll, 90, 'medição do layout'); };
  listen(window, 'scroll', schedule, 'evento de rolagem', { passive: true });
  listen(window, 'resize', queueMeasure, 'evento de redimensionamento', { passive: true });
  if ('ResizeObserver' in window) observer(ResizeObserver, queueMeasure, 'observador de tamanho').observe(body);
  listen(window, 'load', queueMeasure, 'evento load', { once: true });
  document.fonts?.ready.then(guard(queueMeasure, 'carregamento de fontes'));

  /* ------------------------------------------------------------------ */
  /* Revelações (uma vez por carregamento)                               */
  /* ------------------------------------------------------------------ */
  const revealConfig = new WeakMap();
  const docOrder = (a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);
  const revealIO = observer(IntersectionObserver, entries => {
    entries.filter(e => e.isIntersecting).map(e => e.target).sort(docOrder).forEach((el, i) => {
      revealIO.unobserve(el);
      play(el, i);
    });
  }, 'revelação de conteúdo', { rootMargin: '0px 0px -8% 0px' });
  function play(el, i, instant = false) {
    const cfg = revealConfig.get(el) || {};
    const delay = instant ? 0 : cfg.delay ? cfg.delay(el, i) : i * (cfg.stagger ?? 90);
    if (instant) el.classList.add('hw-instant');
    el.style.setProperty('--hw-d', delay + 'ms');
    el.classList.add('is-in');
    cfg.onIn?.(el);
    later(() => {
      el.classList.remove('hw-pre', 'is-in', 'hw-instant');
      el.removeAttribute('data-hw');
      el.style.removeProperty('--hw-d');
      if (cfg.settle) queueMeasure(); // medidas que dependem da posição final (linhas de conexão)
    }, (cfg.duration ?? 1400) + delay, 'fim de revelação');
  }
  // Teclado: um elemento que recebe foco antes de ser revelado aparece na hora (nunca fica invisível com foco).
  listen(document, 'focusin', event => {
    let el = event.target.closest?.('.hw-pre');
    while (el) { // o próprio elemento e qualquer ancestral ainda em entrada aparecem imediatamente
      if (!el.classList.contains('is-in')) { revealIO.unobserve(el); play(el, 0, true); } else el.classList.add('hw-instant');
      el = el.parentElement?.closest('.hw-pre');
    }
  }, 'foco por teclado');
  function reveal(targets, variant, cfg = {}) {
    if (failed) return; // após uma falha nada mais é ocultado
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
  /* Modo de animação: automático, sem controle na interface             */
  /* ------------------------------------------------------------------ */
  function applyMode() {
    const mode = systemQuery.matches ? 'reduced' : 'full';
    if (root.dataset.motion === mode) return;
    root.dataset.motion = mode;
    onModeChange();
  }
  if (systemQuery.addEventListener) listen(systemQuery, 'change', applyMode, 'mudança de preferência de movimento');

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
    const nodeWater = $('.hw-op-node-water', op), nodeEnergy = $('.hw-op-node-energy', op), nodeHub = $('.hw-op-node-hub', op);
    const navbar = $('.navbar'), logo = navbar && $('.logo', navbar);
    $$('.hw-draw', op).forEach((el, i) => el.style.setProperty('--n', i));
    $$('.hw-op-node', op).forEach((el, i) => el.style.setProperty('--n', i));
    $$('.hw-op-waves path', op).forEach((el, i) => el.style.setProperty('--n', i));
    // Ligações sensor → central agrupadas: separam-se (somem) quando os sensores partem rumo ao app.
    const linkEls = $$('.hw-link, .hw-packet', house);
    const links = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    links.setAttribute('class', 'hw-op-links');
    if (linkEls.length) { linkEls[0].before(links); links.append(...linkEls); }
    // Partículas de dados em três profundidades (parallax).
    const dust = document.createElement('div');
    dust.className = 'hw-op-dust';
    dust.setAttribute('aria-hidden', 'true');
    const SEEDS = [[8, 22, 1], [17, 68, 3], [26, 38, 2], [34, 84, 1], [44, 14, 3], [57, 76, 2], [63, 30, 1], [71, 58, 3], [79, 18, 2], [88, 46, 1], [93, 80, 3], [52, 52, 2], [12, 48, 2], [83, 70, 1]];
    dust.innerHTML = SEEDS.map(([x, y, z], i) => `<i class="d${z}${i % 3 === 0 ? ' is-energy' : i % 3 === 1 ? ' is-water' : ''}" style="left:${x}%;top:${y}%;--k:${i}"></i>`).join('');
    bg.after(dust);
    const motes = $$('i', dust).map((el, i) => ({ el, z: SEEDS[i][2], drift: (i % 2 ? 1 : -1) * (6 + (i * 7) % 18) }));

    let D = 600, lastWidth = 0, fly = { dx: 0, dy: 0, s: 1 }, waveDrop = 0, narrow = false;
    let SW = 1, SH = 1, H = { cx: 0, cy: 0, W: 1000 }, last = { hs: 1, hy: 0, wy: 0 };
    const isActive = () => root.classList.contains('hw-show-opening');
    observer(IntersectionObserver, ([e]) => op.classList.toggle('is-near', e.isIntersecting), 'visibilidade da abertura').observe(op);
    // Trajetória dos celulares: [x0 vw, y0 vh, giro0, x1, y1, giro1, escala1, rotY0, rotY1]
    const phonePath = () => (narrow ? [31, 40, 12, 29, 21, 2.5, .95, 24, 5] : [37, 36, 14, 24, 4, 3, 1, 30, 7]);
    function phoneAt(i, pp) {
      const side = i === 0 ? -1 : 1, [x0, y0, r0, x1, y1, r1, s1, ry0, ry1] = phonePath();
      return {
        x: side * lerp(x0, x1, pp) * SW / 100, y: lerp(y0, y1, pp) * SH / 100,
        r: side * lerp(r0, r1, pp), ry: -side * lerp(ry0, ry1, pp), s: lerp(.8, s1, pp)
      };
    }

    function measure() {
      if (!isActive() || !logo) return;
      const w = window.innerWidth;
      narrow = w < 700;
      if (w !== lastWidth) { // altura muda com a barra do navegador no celular: só a largura redefine o trecho
        lastWidth = w;
        D = Math.round(window.innerHeight * (narrow ? .9 : 1.05));
        op.style.setProperty('--op-d', D + 'px');
      }
      SW = sticky.clientWidth || w; SH = sticky.clientHeight || window.innerHeight;
      // Geometria da casa sem as transformações da rolagem (desfaz escala/deslocamento aplicados).
      const sr = sticky.getBoundingClientRect(), hr = house.getBoundingClientRect();
      H = { W: hr.width / last.hs, cx: hr.left + hr.width / 2 - sr.left - SW / 2, cy: hr.top + hr.height / 2 - sr.top - SH / 2 - last.hy };
      const wr = waves.getBoundingClientRect();
      waveDrop = (sr.bottom - 1) - (wr.top + wr.height / 2 - last.wy);
      root.style.setProperty('--hw-nav-h', navbar.offsetHeight + 'px');
      const img = $('.logo-image', logo), cs = getComputedStyle(logo);
      // Telas baixas (celular na horizontal, zoom alto): marca menor para caber com a frase e o botão.
      const K = window.innerHeight < 500 ? 1.15 : narrow ? 1.45 : w < 1100 ? 1.8 : 2.1;
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
    }
    // Leva um sensor da casa até o centro da tela de um celular (coordenadas do SVG, desfazendo a escala da casa).
    function nodeToPhone(node, nx, ny, phone, t, hs, hy) {
      const k = 1000 / H.W;
      const relX = (nx - 500) / k, relY = (ny - 300) / k;
      const dx = ((phone.x - H.cx) / hs - relX) * k;
      const dy = ((phone.y - H.cy - hy) / hs - relY) * k;
      setStyle(node, 'translate', `${(dx * t).toFixed(1)}px ${(dy * t).toFixed(1)}px`);
      setStyle(node, 'scale', (1 - .55 * t).toFixed(4));
      setStyle(node, 'opacity', (1 - range(t, .82, 1)).toFixed(3));
    }
    // Movimento reduzido: mesma narrativa, apenas com opacidade (nada se desloca, gira ou escala).
    function updateSoft(p) {
      const pf = range(p, 0, .26);
      fades.forEach(el => { setStyle(el, 'opacity', (1 - pf).toFixed(3)); el.classList.toggle('is-gone', pf > .97); });
      setStyle(brand, 'opacity', (1 - range(p, .3, .6)).toFixed(3));
      setStyle(house, 'opacity', (1 - .6 * range(p, .2, .9)).toFixed(3));
      setStyle(links, 'opacity', (1 - range(p, .12, .34)).toFixed(3));
      [nodeWater, nodeEnergy].forEach(n => setStyle(n, 'opacity', (1 - range(p, .3, .6)).toFixed(3)));
      phones.forEach((phone, i) => {
        const s = phoneAt(i, 1);
        setStyle(phone, 'translate', `${s.x.toFixed(1)}px ${s.y.toFixed(1)}px`);
        setStyle(phone, 'opacity', range(p, .3, .62).toFixed(3));
      });
      setStyle(waves, 'opacity', (1 - range(p, .3, .9)).toFixed(3));
      setStyle(bg, 'opacity', (1 - range(p, .55, 1)).toFixed(3));
    }
    function update(y) {
      if (!isActive()) return;
      const p = clamp(y / D);
      if (!isFull()) return updateSoft(p);
      // Só os celulares usam --op-p (reflexo): gravar na raiz recalcularia o estilo de toda a abertura.
      phones.forEach(phone => setVar(phone, '--op-p', p));
      // 1. Texto de apresentação sai primeiro.
      const pf = range(p, 0, .26);
      fades.forEach(el => {
        setStyle(el, 'opacity', (1 - pf).toFixed(3));
        setStyle(el, 'translate', `0 ${(-46 * pf).toFixed(1)}px`);
        el.classList.toggle('is-gone', pf > .97);
      });
      // 2. A marca viaja até o cabeçalho.
      const pb = easeInOut(range(p, .2, .86));
      setStyle(brand, 'translate', `${(fly.dx * pb).toFixed(1)}px ${(fly.dy * pb).toFixed(1)}px`);
      setStyle(brand, 'scale', (1 + (fly.s - 1) * pb).toFixed(4));
      setStyle(brand, 'opacity', (1 - range(p, .84, .94)).toFixed(3));
      // 3. A casa recua em profundidade.
      const ph = easeOut(range(p, 0, .9));
      const hs = 1 - .4 * ph, hy = -.07 * SH * ph;
      last.hs = hs; last.hy = hy;
      setStyle(house, 'scale', hs.toFixed(4));
      setStyle(house, 'translate', `0 ${hy.toFixed(1)}px`);
      setStyle(house, 'opacity', (1 - .45 * ph).toFixed(3));
      // 4. Celulares sobem e passam de inclinados para quase frontais.
      const pp = easeOut(range(p, .04, .85));
      const at = phones.map((phone, i) => {
        const s = phoneAt(i, pp);
        setStyle(phone, 'translate', `${s.x.toFixed(1)}px ${s.y.toFixed(1)}px`);
        setStyle(phone, 'rotate', `${s.r.toFixed(2)}deg`);
        setStyle(phone, 'scale', s.s.toFixed(4));
        setStyle(phone, 'transform', `perspective(1100px) rotateY(${s.ry.toFixed(2)}deg)`);
        return s;
      });
      // 5. As ligações se desfazem e os sensores de água e energia viajam até as telas do app.
      setStyle(links, 'opacity', (1 - range(p, .12, .34)).toFixed(3));
      const pn = easeInOut(range(p, .2, .8));
      if (at.length === 2) {
        nodeToPhone(nodeWater, 175, 380, at[0], pn, hs, hy);
        nodeToPhone(nodeEnergy, 825, 380, at[1], pn, hs, hy);
      }
      const glow = Math.sin(Math.PI * range(p, .66, 1));
      phones.forEach(phone => setVar(phone, '--op-glow', glow));
      setStyle(nodeHub, 'scale', (1 + .35 * Math.sin(Math.PI * range(p, .2, .8))).toFixed(4));
      // 6. Camadas de fundo: partículas em parallax, grade que vira piso, ondas que se recolhem.
      motes.forEach(m => setStyle(m.el, 'translate', `${(m.drift * p).toFixed(1)}px ${(-p * SH * .22 * m.z).toFixed(1)}px`));
      setStyle(dust, 'opacity', (1 - range(p, .75, 1)).toFixed(3));
      setStyle(grid, 'transform', `perspective(900px) rotateX(${(52 * easeInOut(range(p, .05, .9))).toFixed(2)}deg) translateY(${(-60 * p).toFixed(1)}px)`);
      const pw = easeInOut(range(p, .18, .92));
      last.wy = waveDrop * pw;
      setStyle(waves, 'scale', `1 ${(1 - .97 * pw).toFixed(4)}`);
      setStyle(waves, 'translate', `0 ${last.wy.toFixed(1)}px`);
      setStyle(bg, 'opacity', (1 - range(p, .55, 1)).toFixed(3));
    }
    function play() {
      op.classList.remove('is-playing');
      void op.offsetWidth;
      op.classList.add('is-playing');
    }
    // Troca de modo: os estilos já foram limpos por clearWritten(); zera a geometria de referência.
    function reset() {
      last = { hs: 1, hy: 0, wy: 0 };
      fades.forEach(el => el.classList.remove('is-gone'));
    }
    const t = track({ el: op, measure, update, soft: true });
    t.isActive = isActive;
    if (isActive()) play();
    if (location.hash === '#abertura') history.replaceState(null, '', location.pathname + location.search);
    return { isActive, distance: () => D, play, reset };
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
    setupFooterLine();
  }
  function setupFooterLine() {
    const footer = $('footer');
    if (footer) observer(IntersectionObserver, ([e], obs) => { if (e.isIntersecting) { footer.classList.add('hw-footer-in'); obs.disconnect(); } }, 'rodapé').observe(footer);
  }

  /* ------------------------------------------------------------------ */
  /* COMO FUNCIONA — etapas que se revelam e uma linha que as conecta     */
  /* ------------------------------------------------------------------ */
  function setupHow() {
    const steps = $('.how-steps');
    if (!steps) return;
    const cards = $$('.how-step-card', steps);
    reveal(cards, (el, i) => (i % 2 ? 'slide-r' : 'slide-l'), { stagger: 140, duration: 1700, settle: true });
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('class', 'hw-steps-line');
    svg.setAttribute('aria-hidden', 'true');
    // No fim do contêiner: inserir no início deslocaria os seletores :nth-child das etapas.
    steps.append(svg);
    // Os elementos do SVG são criados UMA vez e reaproveitados a cada medição (só "d", "cx" e "cy"
    // mudam). Assim nenhum caminho descartado fica retido pelo registro de estilos (written).
    const el = (tag, attrs) => { const n = document.createElementNS(ns, tag); Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v)); return n; };
    const links = cards.slice(1).map(() => {
      const trackPath = el('path', { class: 'hw-track' });
      const run = el('path', { class: 'hw-run', pathLength: '1' });
      run.style.strokeDasharray = '1';
      run.style.strokeDashoffset = '1';
      const a = el('circle', { r: 6 }), b = el('circle', { r: 6 });
      svg.append(trackPath, run, a, b);
      return { trackPath, run, a, b };
    });
    const segments = links.map(l => l.run), dots = links.flatMap(l => [l.a, l.b]);
    let top = 0, h = 1;
    // Posição de layout (sem transformações): as etapas podem estar no meio da animação de entrada.
    function layoutBox(el) {
      let x = 0, y = 0, n = el;
      while (n && n !== steps) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
      if (n !== steps) { x -= steps.offsetLeft; y -= steps.offsetTop; } // offsetParent comum acima de .how-steps
      return { x, y, w: el.offsetWidth, h: el.offsetHeight };
    }
    function measure() {
      const W = steps.clientWidth, Hh = steps.clientHeight, base = steps.getBoundingClientRect();
      // Etapa já assentada: posição real (inclui o desnível intencional das etapas pares).
      // Etapa ainda em animação de entrada: posição de layout; é remedida ao terminar (ver play()).
      const box = c => {
        if (c.classList.contains('hw-pre')) return layoutBox(c);
        const r = c.getBoundingClientRect();
        return { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height };
      };
      const rects = cards.map(c => { const b = box(c); return { l: b.x, t: b.y, r: b.x + b.w, b: b.y + b.h, cx: b.x + b.w / 2, cy: b.y + b.h / 2 }; });
      svg.setAttribute('viewBox', `0 0 ${W} ${Hh}`);
      const sameRow = (a, b) => Math.abs(a.t - b.t) < 10;
      const r1 = n => Math.round(n * 10) / 10;
      links.forEach((link, i) => {
        const a = rects[i], b = rects[i + 1];
        let d, p0, p1;
        if (sameRow(a, b)) { p0 = [r1(a.r), r1(a.cy)]; p1 = [r1(b.l), r1(b.cy)]; const mx = r1((p0[0] + p1[0]) / 2); d = `M${p0} C${mx} ${p0[1]} ${mx} ${p1[1]} ${p1}`; }
        else { p0 = [r1(a.cx), r1(a.b)]; p1 = [r1(b.cx), r1(b.t)]; const my = r1((p0[1] + p1[1]) / 2); d = `M${p0} C${p0[0]} ${my} ${p1[0]} ${my} ${p1}`; }
        link.trackPath.setAttribute('d', d);
        link.run.setAttribute('d', d);
        link.a.setAttribute('cx', p0[0]); link.a.setAttribute('cy', p0[1]);
        link.b.setAttribute('cx', p1[0]); link.b.setAttribute('cy', p1[1]);
      });
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
    let lastCycle = $('button[aria-pressed="true"]', toggle || body)?.dataset.cycle;
    if (toggle) observer(MutationObserver, () => {
      if (!isFull()) return;
      const cycle = $('button[aria-pressed="true"]', toggle)?.dataset.cycle;
      if (!cycle || cycle === lastCycle) return;
      const dir = cycle === 'anual' ? 1 : -1;
      lastCycle = cycle;
      prices.forEach((p, i) => {
        // Giro 3D curto: o cartão vira para o lado do período escolhido e volta de frente (só transform).
        p.animate?.([
          { transform: 'perspective(1200px) rotateY(0deg)' },
          { transform: `perspective(1200px) rotateY(${dir * 9}deg) scale(.985)`, offset: .4 },
          { transform: 'perspective(1200px) rotateY(0deg)' }
        ], { duration: 760, delay: i * 70, easing: 'cubic-bezier(.65,0,.35,1)' });
        p.classList.remove('hw-sweep');
        void p.offsetWidth;
        p.style.setProperty('animation-delay', i * 80 + 'ms');
        p.classList.add('hw-sweep');
        later(() => p.classList.remove('hw-sweep'), 1200 + i * 80, 'troca Mensal/Anual');
      });
    }, 'troca Mensal/Anual').observe(toggle, { subtree: true, attributes: true, attributeFilter: ['aria-pressed'] });
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
  // Chamado por js/script.js: o valor (preço) é sempre aplicado; só a animação é opcional.
  const animateSwapSafe = guard(animateSwap, 'troca de valor');
  function swapValue(el, text, kind) {
    const old = el.textContent;
    if (old === text) return;
    el.textContent = text;
    animateSwapSafe(el, old, kind);
  }
  function watchSwap(el, kind) {
    if (!el) return;
    observer(MutationObserver, records => {
      const removed = records.flatMap(r => [...r.removedNodes]).map(n => n.textContent).join('');
      animateSwap(el, removed, kind);
    }, 'troca de valor').observe(el, { childList: true });
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
    observer(MutationObserver, place, 'controle segmentado').observe(group, { subtree: true, attributes: true, attributeFilter: ['aria-pressed'] });
    measurers.push(place);
    place();
    requestAnimationFrame(guard(() => requestAnimationFrame(guard(() => group.classList.add('hw-seg-ready'), 'controle segmentado')), 'controle segmentado'));
  }

  /* ------------------------------------------------------------------ */
  /* Formulários: status, validação, áreas que aparecem                  */
  /* ------------------------------------------------------------------ */
  const OK_RE = /sucesso|copiado|preenchido|concluída/i;
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
    observer(MutationObserver, run, 'mensagem de status').observe(el, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['data-error'] });
  }
  function watchAppear(el, stagger) {
    if (!el) return;
    observer(MutationObserver, () => {
      if (el.hidden || !isFull() || !el.animate) return;
      const parts = stagger ? $$(stagger, el) : [el];
      parts.forEach((part, i) => part.animate([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 420, delay: i * 70, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' }));
    }, 'área que aparece').observe(el, { attributes: true, attributeFilter: ['hidden'] });
  }
  function setupForms() {
    ['#auth-status', '#cart-status', '#account-status'].forEach(id => watchStatus($(id)));
    ['#payment-pix', '#payment-card', '#name-field', '#confirm-field', '#account-bar', '#active-sub-banner', '#reset-password'].forEach(id => watchAppear($(id)));
    watchAppear($('#protected-cart'), ':scope > form > fieldset, :scope > form > .btn, :scope > aside');
    watchSwap($('#plan-price'));
    watchSwap($('#auth-title'));
    listen(document, 'invalid', event => {
      const field = event.target;
      if (!field.classList) return;
      field.classList.remove('hw-invalid');
      void field.offsetWidth;
      field.classList.add('hw-invalid');
      later(() => field.classList.remove('hw-invalid'), 800, 'validação de formulário');
    }, 'validação de formulário', true);
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
  function setupStory() {
    const st = $('.hs-story');
    if (!st) return null;
    const pipes = $$('.hs-pipe', st), cables = $$('.hs-cable', st), data = $$('.hs-data-draw', st), uplink = $$('.hs-uplink', st);
    const node = k => $(`.hs-node-${k}`, st), tag = k => $(`.hs-tag[data-tone="${k}"]`, st);
    const steps = $$('.hs-step', st);
    const sticky = $('.hs-sticky', st), texts = $('.hs-texts', st), final = $('.hs-final', st);
    $$('.hs-structure > *', st).forEach((el, i) => { el.setAttribute('pathLength', '1'); el.style.setProperty('--n', i); });
    $$('.hs-signal', st).forEach((el, i) => el.style.setProperty('--n', i));
    observer(IntersectionObserver, ([e]) => st.classList.toggle('is-near', e.isIntersecting), 'visibilidade da casa conectada').observe(st);
    let D = 1800, top = 0, lastWidth = 0, chapter = -1, staged = false;
    const dash = (list, v) => list.forEach(el => setStyle(el, 'strokeDashoffset', (1 - v).toFixed(4)));
    const on = (k, v) => { node(k)?.classList.toggle('on', v); tag(k)?.classList.toggle('on', v); };
    // O palco fixo só é usado se tudo couber na tela (altura pequena ou zoom alto → layout estático completo).
    function fits() {
      if (!isFull() || window.innerHeight < 520 || window.innerWidth < 320) return false;
      const was = st.classList.contains('hs-staged');
      st.classList.add('hs-staged');
      const box = sticky.getBoundingClientRect(), limit = box.bottom - 4;
      // Conteúdo real (cabeçalho, textos e cena) precisa caber; o padding inferior pode ser comprimido.
      const parts = [...sticky.children].filter(el => /\bhs-(head|copy|scene)\b/.test(el.className)).map(el => el.getBoundingClientRect());
      const tallest = Math.max(...[...steps, final].map(el => el.offsetHeight));
      const textTop = texts.getBoundingClientRect().top;
      const ok = parts.every(r => r.top >= box.top - 1 && r.bottom <= limit) && textTop + tallest <= limit;
      st.classList.toggle('hs-staged', was);
      return ok;
    }
    function setStaged(v) {
      staged = v;
      st.classList.toggle('hs-staged', v);
      if (!v) {
        // Layout estático: todas as etapas, a mensagem final e a cena completa visíveis.
        st.classList.remove('is-live', 'is-final', 'is-playing');
        delete st.dataset.chapter;
        chapter = -1;
        steps.forEach(s => s.classList.remove('is-active', 'is-past'));
        ['water', 'energy', 'hub'].forEach(k => on(k, false));
      }
    }
    function measure() {
      const w = window.innerWidth;
      if (w !== lastWidth) {
        lastWidth = w;
        D = Math.round(window.innerHeight * (w < 850 ? 2.6 : 3));
        st.style.setProperty('--hs-d', D + 'px');
      }
      const ok = fits();
      if (ok !== staged) setStaged(ok);
      top = docTop(st);
    }
    function update(y) {
      if (!staged) return;
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
      // Celulares do app: chegam inclinados em 3D e terminam quase de frente, com um reflexo que percorre a tela.
      const f = easeOut(range(p, .7, .95));
      hsPhones.forEach((ph, i) => {
        const side = i === 0 ? 1 : -1;
        setStyle(ph, 'transform', `perspective(900px) rotateY(${(side * lerp(34, 6, f)).toFixed(2)}deg)`);
      });
      setVar(st, '--hs-sheen', range(p, .72, 1));
    }
    const hsPhones = $$('.hs-phone', st);
    // Teclado: foco na mensagem final mantém a rolagem no trecho final (o conteúdo focado não some).
    listen(st, 'focusin', event => {
      // Só foco por teclado: no toque/clique o link já está visível, e reposicionar a rolagem aqui
      // cancelaria a navegação até a âncora (ex.: "Conheça a equipe" voltava para a casa).
      if (!staged || !final.contains(event.target) || !event.target.matches(':focus-visible')) return;
      requestAnimationFrame(guard(() => {
        const target = Math.round(top + D * .95);
        if (Math.abs(window.scrollY - target) > 4) window.scrollTo({ top: target, behavior: 'instant' });
      }, 'foco na casa conectada'));
    }, 'foco na casa conectada');
    function play() { if (!staged) return; st.classList.remove('is-playing'); void st.offsetWidth; st.classList.add('is-playing'); }
    track({ el: st, measure, update });
    play();
    // Troca para movimento reduzido: volta ao layout estático (os estilos inline já foram limpos).
    return { play, sync() { const ok = fits(); if (ok !== staged) setStaged(ok); if (ok) measureAll(); } };
  }
  let story = null;
  function setupHotsite() {
    story = setupStory();
    setupHotsiteScenes();
  }

  /* ------------------------------------------------------------------ */
  /* HOTSITE — cenas reversíveis ligadas à rolagem (após a casa conectada) */
  /* ------------------------------------------------------------------ */
  // Cada item tem uma ENTRADA e (0→1) medida pela posição do próprio elemento na janela; cada seção
  // tem uma SAÍDA x (0→1) quando deixa a tela por cima. Tudo é função de scrollY: descer faz a
  // composição evoluir, subir a desfaz, e uma nova descida a repete. Nada prende a rolagem.
  // Posições medidas pelo layout (offsetTop), que ignora as transformações aplicadas pela cena.
  function layoutTop(el) { let y = 0, n = el; while (n) { y += n.offsetTop; n = n.offsetParent; } return y; }
  function scene(section, items, hooks = {}) {
    section.classList.add('hw-scene');
    items.forEach(it => it.mark !== false && it.el.classList.add('hw-sc'));
    let tops = [], sTop = 0, sH = 1, K = 1, maxY = 1;
    track({
      el: section,
      measure() {
        sTop = layoutTop(section); sH = section.offsetHeight;
        tops = items.map(it => layoutTop(it.el));
        K = window.innerWidth < 700 ? .55 : 1; // amplitudes menores em telas pequenas
        maxY = Math.max(1, root.scrollHeight - window.innerHeight);
        hooks.measure?.(K);
      },
      update(y) {
        const vh = window.innerHeight, atEnd = y >= maxY - 2; // no fim da página tudo está completo
        const x = range(y, sTop + sH - vh * .45, sTop + sH + vh * .15);
        items.forEach((it, i) => {
          const raw = atEnd ? 1 : range(y + vh - tops[i] - (it.delay || 0) * vh, 0, vh * (it.span || .42));
          it.fn(easeOut(raw), x, K, raw);
        });
        hooks.update?.(y, x, K, vh);
      }
    });
  }
  const px = v => v.toFixed(1) + 'px', dg = v => v.toFixed(2) + 'deg';
  // Palavras do título sobem de dentro da máscara, em sequência, conforme a entrada.
  function wordsItem(el, extra = {}) {
    if (!el) return null;
    splitWords(el);
    const words = $$('.hw-wi', el), n = Math.max(1, words.length);
    return { el, mark: false, ...extra, fn: e => words.forEach((w, i) => {
      const t = clamp(e * 1.5 - (i / n) * .5);
      setStyle(w, 'transform', `translateY(${((1 - t) * 108).toFixed(1)}%) rotate(${((1 - t) * 5).toFixed(2)}deg)`);
    }) };
  }
  // Texto: sobe e acende na entrada; na saída sobe um pouco mais devagar (parallax), sem apagar.
  const riseItem = (el, delay = 0, dist = 36) => el && ({ el, delay, fn: (e, x, K) => {
    setStyle(el, 'opacity', e.toFixed(3));
    setStyle(el, 'transform', `translateY(${px(((1 - e) * dist - x * 22) * K)})`);
  } });
  const decor = (parent, html, cls) => { const d = document.createElement(parent === 'svg' ? 'div' : 'span'); d.className = cls; d.setAttribute('aria-hidden', 'true'); d.innerHTML = html; return d; };

  function setupHotsiteScenes() {
    // --- Apresentação (#inicio): título, textos, destaques e o aplicativo em 3D ---
    const intro = $('.hotsite-page .inicio');
    if (intro) {
      const items = [wordsItem($('.textoInicio h1', intro)), riseItem($('.textoInicio > h3', intro), .03), riseItem($('.textoInicio > p', intro), .06)];
      const btn = $('.textoInicio > .btn', intro);
      if (btn) items.push({ el: btn, delay: .08, fn: (e, x, K) => { setStyle(btn, 'opacity', e.toFixed(3)); setStyle(btn, 'transform', `translateY(${px((1 - e) * 28 * K)}) scale(${(.9 + .1 * e).toFixed(4)})`); } });
      $$('.informacoes > div', intro).forEach((card, i) => {
        const side = i % 2 ? 1 : -1;
        items.push({ el: card, delay: .04 * i, fn: (e, x, K) => {
          setStyle(card, 'opacity', e.toFixed(3));
          setStyle(card, 'transform', `perspective(800px) translateX(${px(side * (1 - e) * 70 * K)}) rotateY(${dg(-side * (1 - e) * 28 * K)}) translateY(${px(-x * 18 * K)})`);
        } });
      });
      // Celulares: chegam inclinados em 3D, giram até ficar quase de frente e seguem em parallax.
      const visual = $('.hot-visual', intro), pair = visual && $('.home-phone-pair', visual);
      if (pair) {
        const back = $('.home-phone-back', pair), front = $('.home-phone-front', pair);
        const grid = $('.hot-visual-grid', visual), sceneDeco = $('.phone-scene', visual), brand = $('.hot-brand', visual);
        // Véu da tela (as telas "acendem" com uma linha de varredura) e reflexo que atravessa o vidro.
        const fx = [back, front].map(ph => {
          const veil = decor('span', '<i></i>', 'hw-veil'), sheen = decor('span', '', 'hw-sheen');
          ph.append(veil, sheen);
          return { veil, band: veil.firstElementChild, sheen };
        });
        items.push({ el: visual, mark: false, span: .75, fn: (e, x, K, lin) => {
          // Assentado (e=1): totalmente de frente; na saída gira levemente para o outro lado.
          setStyle(pair, 'transform', `perspective(1200px) rotateY(${dg((-26 * (1 - e) + 14 * x) * K)}) rotateX(${dg((1 - e) * 10 * K)}) translateY(${px(((1 - e) * 70 - 34 * e - x * 50) * K)}) scale(${(.9 + .08 * e).toFixed(4)})`);
          setStyle(back, 'transform', `rotate(-11deg) translateY(${px(((1 - e) * 30 - x * 28) * K)})`);
          setStyle(front, 'transform', `rotate(10deg) translateY(${px(((1 - e) * 90 - x * 80) * K)})`);
          fx.forEach((f, i) => {
            // Progresso linear (sem suavização) para a varredura ser visível; a tela de trás acende primeiro.
            const s = range(lin, .2 + i * .18, .7 + i * .18);
            setStyle(f.veil, 'opacity', (1 - s).toFixed(3));
            setStyle(f.band, 'transform', `translateY(${(-100 + s * 433).toFixed(0)}%)`);
            setStyle(f.sheen, 'transform', `translateX(${(-130 + (lin * .7 + x * .3) * 300).toFixed(0)}%) skewX(-12deg)`);
          });
          if (grid) setStyle(grid, 'transform', `translateY(${px(((1 - e) * 40 - x * 40) * K)})`);
          if (sceneDeco) { setStyle(sceneDeco, 'opacity', (.25 + .75 * e).toFixed(3)); setStyle(sceneDeco, 'transform', `translateY(${px(((1 - e) * 50 - x * 20) * K)}) scale(${(.92 + .08 * e).toFixed(4)})`); }
          if (brand) { setStyle(brand, 'opacity', range(e, .4, 1).toFixed(3)); setStyle(brand, 'transform', `translateY(${px((1 - e) * 30 * K - x * 36 * K)}) scale(${(.85 + .15 * e).toFixed(4)})`); }
        } });
      }
      scene(intro, items.filter(Boolean));
    }

    // --- História do projeto: a linha percorre as etapas; cada uma acende quando é alcançada ---
    const history = $('.project-story');
    const journey = history && $('.story-journey', history);
    if (history && journey) {
      const chapters = $$('.story-chapter', journey);
      const dot = decor('span', '', 'hw-journey-dot');
      journey.append(dot);
      const items = [wordsItem($('.project-story-heading h2', history)), riseItem($('.project-story-heading > p', history), .04)];
      const ce = chapters.map(() => 0);
      chapters.forEach((ch, i) => items.push({ el: ch, mark: true, fn: e => { ce[i] = e; } }));
      let row = false, jTop = 0, jH = 1, jW = 1;
      scene(history, items.filter(Boolean), {
        measure() { row = chapters.length > 1 && chapters.every(c => c.offsetTop === chapters[0].offsetTop); jTop = layoutTop(journey); jH = journey.offsetHeight; jW = journey.clientWidth; },
        update(y, x, K, vh) {
          const line = range(y + vh * .75, jTop, jTop + jH * .9);
          setVar(journey, '--hw-line', line);
          setStyle(dot, 'transform', `translateX(${px(line * jW * .84)})`);
          setStyle(dot, 'opacity', clamp(line * 8).toFixed(3));
          chapters.forEach((ch, i) => {
            // Em linha (desktop): a linha alcança cada etapa. Empilhadas (celular): entrada de cada uma.
            const c = row ? clamp((line * chapters.length - i) * 1.4 + .1) : ce[i];
            ch.classList.toggle('on', c > .55);
            setStyle(ch, 'opacity', (.4 + .6 * c).toFixed(3));
            setStyle(ch, 'transform', `translateY(${px(((1 - c) * 34 - x * 16 * (i + 1) / chapters.length) * K)})`);
          });
        }
      });
    }

    // --- Por que escolher a gente: cartões em profundidade ligados por um fluxo de água e energia ---
    const values = $('.hotsite-page .escolher');
    const grid = values && $('.hotsite-values', values);
    if (values && grid) {
      const cards = $$(':scope > .card', grid);
      const flow = decor('span', '<i class="is-water"></i><i class="is-energy"></i>', 'hw-values-flow');
      grid.prepend(flow);
      const items = [wordsItem($('.section-title', values))];
      cards.forEach((card, i) => {
        const icon = $('.icon', card), mid = (cards.length - 1) / 2;
        items.push({ el: card, delay: .05 * i, fn: (e, x, K) => {
          setStyle(card, 'opacity', e.toFixed(3));
          setStyle(card, 'transform', `perspective(1000px) rotateX(${dg((1 - e) * 26 * K)}) translateY(${px(((1 - e) * 70 - x * (i === mid ? 40 : 22)) * K)}) scale(${(.94 + .06 * e).toFixed(4)})`);
          if (icon) setStyle(icon, 'transform', `rotate(${dg((1 - e) * -120)}) scale(${(.4 + .6 * e).toFixed(4)})`);
        } });
      });
      items.push({ el: grid, mark: false, span: .6, fn: e => {
        $$('i', flow).forEach((line, i) => setStyle(line, 'transform', `scaleX(${range(e, i * .12, .8 + i * .12).toFixed(4)})`));
      } });
      scene(values, items.filter(Boolean));
    }

    // --- Equipe: cartões entram em profundidade a partir do centro; as fotos se abrem em círculo ---
    const team = $('.hotsite-page .equipe');
    if (team) {
      const members = $$('.team > .member', team), mid = (members.length - 1) / 2;
      const items = [wordsItem($('.section-title', team)), riseItem($('.section-sub', team), .03)];
      members.forEach((m, i) => {
        const photo = $('.member-photo', m), inner = photo && (photo.firstElementChild || null);
        let side = Math.sign(i - mid) || 0;
        items.push({ el: m, delay: Math.abs(i - mid) * .045, fn: (e, x, K) => {
          const s = side || (i % 2 ? 1 : -1) * .3;
          setStyle(m, 'opacity', e.toFixed(3));
          setStyle(m, 'transform', `perspective(900px) rotateY(${dg(s * (1 - e) * 32 * K)}) translateY(${px(((1 - e) * 60 - x * 20) * K)}) scale(${(.92 + .08 * e).toFixed(4)})`);
          if (photo) setStyle(photo, 'clipPath', `circle(${(20 + e * 55).toFixed(1)}% at 50% 50%)`);
          if (inner) setStyle(inner, 'transform', `scale(${(1.3 - .3 * e).toFixed(4)})`);
        } });
      });
      scene(team, items.filter(Boolean));
    }

    // --- Encerramento (download do TCC): composição que se monta e fecha a narrativa ---
    const finale = $('.hotsite-page .hotsite-download');
    if (finale) {
      const ns = 'http://www.w3.org/2000/svg';
      const waves = document.createElementNS(ns, 'svg');
      waves.setAttribute('class', 'hw-finale-waves');
      waves.setAttribute('viewBox', '0 0 1200 120');
      waves.setAttribute('preserveAspectRatio', 'none');
      waves.setAttribute('aria-hidden', 'true');
      waves.innerHTML = `<path class="is-water" pathLength="1" d="${wavePath(1200, 64, 22, 300)}"/><path class="is-energy" pathLength="1" d="${wavePath(1200, 70, 12, 200)}"/>`;
      finale.prepend(waves);
      const paths = $$('path', waves);
      const items = [wordsItem($('h2', finale)), riseItem($('.tcc-unavailable', finale), .05, 30)];
      items.push({ el: finale, mark: false, span: .5, fn: (e, x, K) => {
        setStyle(finale, 'transform', `perspective(1000px) rotateX(${dg((1 - e) * 12 * K)}) scale(${(.94 + .06 * e).toFixed(4)})`);
        setVar(finale, '--hw-glow', e);
        paths.forEach((p, i) => setStyle(p, 'strokeDashoffset', (1 - range(e, i * .15, .85 + i * .15)).toFixed(4)));
      } });
      scene(finale, items.filter(Boolean));
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
    if (page === 'home') setupHome();
    if (page === 'hotsite') setupHotsite();
    // No hotsite, as seções são cenas ligadas à rolagem (setupHotsite); as revelações genéricas
    // de entrada única ficam só no site institucional.
    if (page !== 'hotsite') setupCommon(); else setupFooterLine();
    if (page === 'how') setupHow();
    if (page === 'testimonials') setupTestimonials();
    if (page === 'about') setupTeam();
    if (page === 'pricing') setupPricing();
    if (page === 'faq') setupFaq();
    if (page === 'login' || page === 'cart') setupFormPages();
    measureAll();
  }
  // Chamado pelo listener (protegido) da preferência de movimento do sistema.
  function onModeChange() {
    clearWritten();
    opening?.reset();
    if (isFull()) initFull(); else setupCalm();
    story?.sync();
    if (opening && window.scrollY < 60) opening.play();
    measureAll();
  }

  // Movimento reduzido: as seções aparecem só com opacidade (sem deslocamento).
  let calmReady = false;
  function setupCalm() {
    if (calmReady) return;
    calmReady = true;
    reveal('main .page-head, main .section-title, main .section-sub, main .card, main .price, main .testimonial, main .member, main .faq-item, main .how-step-card, main .cta, main .support, .story-chapter, .hot-visual', 'calm', { stagger: 60, duration: 900 });
  }

  // Efeitos contínuos (ondas, órbitas, partículas) pausam fora da área visível.
  function pauseOffscreen() {
    const io = observer(IntersectionObserver, entries => entries.forEach(e => e.target.classList.toggle('hw-paused', !e.isIntersecting)), 'pausa fora da tela', { rootMargin: '10% 0px' });
    $$('.hero, .phone-showcase, .hot-visual, .hw-op-cue').forEach(el => io.observe(el));
  }

  // Recuperação: a página volta à apresentação estática com todo o conteúdo visível.
  // Chamada por fail(), que já registrou o diagnóstico no console.
  function goStatic() {
    // Ponto de referência para manter o leitor no mesmo trecho quando a abertura é recolhida.
    const ref = $('main > :not(.hw-opening)');
    const before = ref ? ref.getBoundingClientRect().top : 0;
    const hadOpening = root.classList.contains('hw-show-opening') && window.scrollY > 0;
    clearWritten();
    root.dataset.motion = 'static';
    root.classList.remove('hw-show-opening');
    $$('.hw-pre').forEach(el => { el.classList.remove('hw-pre', 'is-in', 'hw-instant'); el.removeAttribute('data-hw'); });
    // Casa conectada e abertura: nenhum estado de cena pode sobreviver. Sem os observers (desligados
    // na falha), uma entrada pausada (".is-playing" fora da tela) ficaria congelada no 1º quadro.
    $$('.hs-story, .hw-opening').forEach(el => {
      el.classList.remove('hs-staged', 'is-playing', 'is-near', 'is-live', 'is-final');
      el.removeAttribute('data-chapter');
    });
    $$('.hs-step').forEach(el => el.classList.remove('is-active', 'is-past'));
    $$('.hw-paused').forEach(el => el.classList.remove('hw-paused'));
    if (hadOpening && ref) window.scrollBy(0, ref.getBoundingClientRect().top - before);
  }

  try {
    // Recarga (F5 / Ctrl+R / botão do navegador): começa no topo para a abertura se recompor inteira.
    // Voltar/Avançar no histórico mantém a posição que o navegador restaurar; âncoras são respeitadas.
    const navType = performance.getEntriesByType?.('navigation')[0]?.type;
    if ((page === 'home' || page === 'hotsite') && navType === 'reload' && (!location.hash || location.hash === '#abertura') && window.scrollY) window.scrollTo(0, 0);

    // Sempre ativos (independem do modo): controles segmentados, formulários e menu.
    $$('.links').forEach(nav => $$('a', nav).forEach((a, i) => a.style.setProperty('--i', i)));
    $$('.checks, .cta-benefits').forEach(list => $$('li', list).forEach((li, i) => li.style.setProperty('--li', i)));
    ['.billing-toggle', '.auth-tabs', '.payment-tabs'].forEach(sel => segmented($(sel)));
    setupForms();
    pauseOffscreen();
    // A abertura da inicial existe nos dois modos (no reduzido, em versão só de opacidade).
    if (page === 'home') opening = setupOpening();
    if (isFull()) initFull(); else { setupCalm(); measureAll(); }
    // Sinal para js/motion-boot.js: o motor iniciou corretamente (sem falha durante a inicialização).
    if (!failed) root.classList.add('hw-motion-on');
  } catch (error) {
    fail(error, 'inicialização');
  }

  // status(): diagnóstico (falha e local; tamanho do registro de estilos escritos).
  window.HWMotion = { swapValue, applyMode, status: () => ({ failed, where: failure, written: written.size }) };
})();
