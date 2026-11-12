/* VOSSBERG — shared behaviour for every page (vanilla JS, no libraries). */
(() => {
  const VB = (window.VB = window.VB || {});
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const html = document.documentElement;
  const body = document.body;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(pointer: fine)").matches;
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };
  const ss = {
    get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch {} },
  };
  VB.$ = $; VB.$$ = $$; VB.store = store; VB.reduce = reduce;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  VB.clamp = clamp;

  /* ---------------- smooth scroll (lerped wheel, keeps native sticky) ---------------- */
  const scroller = {
    y: scrollY, target: scrollY, running: false, stopped: false, raf: 0, listeners: new Set(),
    max() { return document.documentElement.scrollHeight - innerHeight; },
    to(y, { immediate = false } = {}) {
      y = clamp(typeof y === "number" ? y : y.getBoundingClientRect().top + scrollY, 0, this.max());
      if (immediate || reduce) { this.target = this.y = y; window.scrollTo(0, y); this.emit(); return; }
      this.target = y; this.kick();
    },
    kick() { if (!this.running) { this.running = true; this.raf = requestAnimationFrame(this.tick); } },
    tick: () => {
      const s = scroller;
      const d = s.target - s.y;
      s.y += d * 0.1;
      if (Math.abs(d) < 0.4) { s.y = s.target; s.running = false; }
      window.scrollTo(0, s.y);
      s.emit();
      if (s.running) s.raf = requestAnimationFrame(s.tick);
    },
    emit() { this.listeners.forEach((f) => f(scrollY)); },
    on(f) { this.listeners.add(f); return () => this.listeners.delete(f); },
    stop() { this.stopped = true; html.classList.add("scroll-locked"); },
    start() { this.stopped = false; html.classList.remove("scroll-locked"); this.target = this.y = scrollY; },
  };
  VB.scroll = scroller;
  const preventsScroll = (el) => el && el.closest && el.closest(".menu-scroll, .drawer-panel, .select-list, [data-lenis-prevent], .ra-track, .news-hl-grid");
  if (finePointer && !reduce) {
    html.classList.add("has-smooth");
    addEventListener("wheel", (e) => {
      if (e.ctrlKey || body.dataset.wheel === "native") return;
      if (preventsScroll(e.target)) return;
      e.preventDefault();
      if (scroller.stopped) return;
      const delta = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY;
      if (!scroller.running) scroller.y = scroller.target = scrollY;
      scroller.target = clamp(scroller.target + delta, 0, scroller.max());
      scroller.kick();
    }, { passive: false });
  }
  addEventListener("scroll", () => { if (!scroller.running) { scroller.y = scroller.target = scrollY; scroller.emit(); } }, { passive: true });
  // block touch / keyboard scrolling while locked
  addEventListener("touchmove", (e) => { if (scroller.stopped && !preventsScroll(e.target)) e.preventDefault(); }, { passive: false });
  addEventListener("keydown", (e) => { if (scroller.stopped && ["ArrowDown", "ArrowUp", "PageDown", "PageUp", " ", "Home", "End"].includes(e.key) && !e.target.closest("input,textarea,[role=listbox]")) e.preventDefault(); });
  const lockStyle = document.createElement("style");
  lockStyle.textContent = "html.scroll-locked,html.scroll-locked body{overflow:hidden}";
  document.head.appendChild(lockStyle);

  /* ---------------- split text ---------------- */
  function splitChars(el) {
    const lines = el.querySelectorAll(":scope > .line, :scope > span > .line");
    let i = 0;
    const wrapText = (node) => {
      const frag = document.createDocumentFragment();
      node.textContent.split(/(\s+)/).forEach((word) => {
        if (!word) return;
        if (/^\s+$/.test(word)) { frag.appendChild(document.createTextNode(" ")); return; }
        const mask = document.createElement("span");
        mask.className = "sp-mask";
        [...word].forEach((ch) => {
          const c = document.createElement("span");
          c.className = "sp-char"; c.textContent = ch; c.style.setProperty("--i", i++);
          mask.appendChild(c);
        });
        frag.appendChild(mask);
      });
      node.replaceWith(frag);
    };
    const walk = (n) => [...n.childNodes].forEach((c) => (c.nodeType === 3 ? (c.textContent.trim() ? wrapText(c) : null) : walk(c)));
    if (!el.getAttribute("aria-label")) el.setAttribute("aria-label", el.textContent.replace(/\s+/g, " ").trim());
    walk(el);
    [...el.children].forEach((c) => c.setAttribute("aria-hidden", "true"));
    void lines;
  }
  function splitLines(el) {
    if (!el.dataset.orig) el.dataset.orig = el.innerHTML;
    else el.innerHTML = el.dataset.orig;
    const text = el.textContent.replace(/\s+/g, " ").trim();
    if (!el.getAttribute("aria-label")) el.setAttribute("aria-label", text);
    // wrap every word, measure tops, regroup into masked lines
    const words = text.split(" ");
    el.innerHTML = words.map((w) => `<span class="sp-word">${w.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</span>`).join(" ");
    const groups = []; let top = null;
    $$(".sp-word", el).forEach((w) => {
      const t = w.offsetTop;
      if (top === null || Math.abs(t - top) > 3) { groups.push([]); top = t; }
      groups[groups.length - 1].push(w.textContent);
    });
    el.innerHTML = groups.map((g, i) => `<span class="sp-line-mask" aria-hidden="true"><span class="sp-line" style="--i:${i}">${g.join(" ").replace(/&/g, "&amp;").replace(/</g, "&lt;")}</span></span>`).join("");
  }
  VB.split = (root = document) => {
    $$("[data-split]", root).forEach((el) => {
      if (el.dataset.splitDone && el.dataset.split !== "lines") return;
      if (el.dataset.split === "lines") splitLines(el); else splitChars(el);
      if (el.dataset.delay) el.style.setProperty("--d", el.dataset.delay + "s");
      el.dataset.splitDone = "1";
    });
  };
  let lastW = innerWidth;
  addEventListener("resize", () => {
    if (Math.abs(innerWidth - lastW) < 40) return;
    lastW = innerWidth;
    $$('[data-split="lines"]').forEach((el) => { const inn = el.classList.contains("is-in"); splitLines(el); if (inn) el.classList.add("is-in"); });
  });

  /* ---------------- button char roll ---------------- */
  VB.roll = (root = document) => $$("[data-roll]", root).forEach((el) => {
    if (el.dataset.rollDone) return;
    const t = el.textContent;
    const mk = (cls) => `<span class="${cls}" aria-hidden="true">${[...t].map((c, i) => `<span class="bc" style="--i:${i}">${c === " " ? "&nbsp;" : c.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</span>`).join("")}</span>`;
    el.innerHTML = mk("bl-a") + mk("bl-b");
    el.dataset.rollDone = "1";
  });

  /* ---------------- in-view reveals ---------------- */
  // clipped elements (clip-path inset 100%) never report as intersecting, so their parent is observed instead
  const targets = new Map();
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (!e.isIntersecting) return;
    (targets.get(e.target) || []).forEach((el) => el.classList.add("is-in"));
    targets.delete(e.target); io.unobserve(e.target);
  }), { rootMargin: "0px 0px -8% 0px", threshold: 0.01 });
  VB.observe = (root = document) => {
    $$("[data-split]:not([data-intro]):not(.menu-item):not([data-manual]), .reveal-clip, .cl-frame, .hp", root).forEach((el) => {
      if (el.closest(".menu, .drawer, [data-side-manual]") || el.classList.contains("is-in")) return;
      const host = el.matches(".reveal-clip, .cl-frame") ? el.parentElement : el;
      if (!targets.has(host)) targets.set(host, []);
      targets.get(host).push(el);
      io.observe(host);
    });
  };

  /* ---------------- parallax ---------------- */
  const par = [];
  VB.parallax = (root = document) => {
    $$("[data-parallax-inner]", root).forEach((el) => par.push({ el, kind: "inner", host: el.parentElement }));
    $$("[data-parallax-y]", root).forEach((el) => { if (innerWidth >= 1024) par.push({ el, kind: "y", amt: +el.dataset.parallaxY, host: el }); });
  };
  function updateParallax() {
    const vh = innerHeight;
    for (const p of par) {
      const r = p.host.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) continue;
      const prog = clamp((vh - r.top) / (vh + r.height), 0, 1) - 0.5; // -0.5..0.5
      if (p.kind === "inner") p.el.style.transform = `translate3d(0, ${(-prog * 0.18 * r.height).toFixed(1)}px, 0)`;
      else p.el.style.transform = `translate3d(0, ${(prog * p.amt * 2).toFixed(1)}px, 0)`;
    }
  }
  if (!reduce) scroller.on(updateParallax);

  /* ---------------- header: hide on scroll + two-tone clip over dark sections ---------------- */
  const hdr = $("[data-hdr]");
  const hlogo = $(".hdr-logo");
  let lastY = scrollY;
  function updateHeader(y) {
    if (!hdr) return;
    const menuOpen = html.classList.contains("menu-open");
    if (!menuOpen && !body.dataset.hdrPinned) {
      const down = y > lastY + 2, up = y < lastY - 2;
      if (down && y > 120) { hdr.classList.add("is-hidden"); hlogo.classList.add("is-hidden"); }
      else if (up || y < 120) { hdr.classList.remove("is-hidden"); hlogo.classList.remove("is-hidden"); }
    }
    lastY = y;
    // two-tone: find dark areas overlapping each header element
    const darks = $$("[data-section-dark]").map((s) => s.getBoundingClientRect());
    const clip = (el) => {
      const r = el.getBoundingClientRect();
      let t = r.height, b = r.height; // fully clipped (no white)
      for (const d of darks) {
        const top = Math.max(d.top, r.top), bot = Math.min(d.bottom, r.bottom);
        if (bot > top) { t = Math.min(t, top - r.top); b = Math.min(b, r.bottom - bot); }
      }
      if (t >= r.height) { el.style.setProperty("--clipT", "0px"); el.style.setProperty("--clipB", "100%"); }
      else { el.style.setProperty("--clipT", t + "px"); el.style.setProperty("--clipB", b + "px"); }
    };
    clip($(".hdr-light", hdr)); clip($(".hl-light", hlogo));
  }
  VB.updateHeader = () => updateHeader(scrollY);
  scroller.on(updateHeader);
  addEventListener("resize", () => updateHeader(scrollY));

  /* ---------------- modal helpers ---------------- */
  let openCount = 0;
  function lock() { if (openCount++ === 0) scroller.stop(); }
  function unlock() { if (--openCount <= 0) { openCount = 0; scroller.start(); } }
  VB.lock = lock; VB.unlock = unlock;
  const trapStack = [];
  addEventListener("keydown", (e) => {
    const top = trapStack[trapStack.length - 1];
    if (!top) return;
    if (e.key === "Escape") { e.preventDefault(); top.close(); }
    if (e.key === "Tab") {
      const f = $$('a[href],button:not([disabled]),input:not([disabled]),textarea,[tabindex]:not([tabindex="-1"])', top.el).filter((x) => x.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  VB.modal = (el, { onOpen, onClose, extra } = {}) => {
    let opener = null, timer = 0;
    const api = {
      el, isOpen: false,
      open() {
        if (api.isOpen) return; api.isOpen = true; opener = document.activeElement;
        clearTimeout(timer); el.hidden = false; void el.offsetWidth;
        requestAnimationFrame(() => el.classList.add("is-open"));
        lock(); trapStack.push(api); onOpen && onOpen();
        setTimeout(() => { const f = el.querySelector("[data-autofocus]") || el.querySelector("button, a, input"); f && f.focus({ preventScroll: true }); }, 60);
      },
      close() {
        if (!api.isOpen) return; api.isOpen = false;
        el.classList.remove("is-open"); unlock();
        trapStack.splice(trapStack.indexOf(api), 1); onClose && onClose();
        timer = setTimeout(() => (el.hidden = true), extra || 1000);
        opener && opener.focus && opener.focus({ preventScroll: true });
      },
    };
    $$("[data-close]", el).forEach((b) => b.addEventListener("click", api.close));
    return api;
  };

  /* ---------------- menu ---------------- */
  const menu = $("#menu");
  const burgers = $$(".burger");
  const menuApi = menu && {
    open() {
      menu.hidden = false; void menu.offsetWidth;
      html.classList.add("menu-open"); menu.classList.add("is-open");
      burgers[0].setAttribute("aria-expanded", "true"); burgers[0].setAttribute("aria-label", "Close menu");
      lock(); trapStack.push(menuApi);
      $$(".menu-item", menu).forEach((el, i) => { el.style.setProperty("--d", 0.28 + i * 0.06 + "s"); el.classList.remove("is-in"); void el.offsetWidth; el.classList.add("is-in"); });
      $$(".menu-social .soc, .menu-bottom .info-grid > div", menu).forEach((el, i) => el.style.setProperty("--i", i));
      menuApi.el = menu; menuApi.isOpen = true;
    },
    close() {
      html.classList.remove("menu-open"); menu.classList.remove("is-open");
      burgers[0].setAttribute("aria-expanded", "false"); burgers[0].setAttribute("aria-label", "Open menu");
      unlock(); trapStack.splice(trapStack.indexOf(menuApi), 1); menuApi.isOpen = false;
      $$(".menu-item", menu).forEach((el) => el.classList.remove("is-in"));
      setTimeout(() => { if (!menuApi.isOpen) menu.hidden = true; }, 950);
      burgers[0].focus({ preventScroll: true });
    },
  };
  burgers[0] && burgers[0].addEventListener("click", () => (menuApi.isOpen ? menuApi.close() : menuApi.open()));
  $("[data-menu-backdrop]")?.addEventListener("click", () => menuApi.isOpen && menuApi.close());

  /* ---------------- currency + prices ---------------- */
  VB.currency = store.get("vb-cur", "EUR");
  VB.price = (eur, cur = VB.currency) => cur === "USD" ? `$${(Math.round((eur * 1.17) / 5) * 5).toLocaleString("en-US")}` : `${eur} €`;
  VB.setCurrency = (c) => { VB.currency = c; store.set("vb-cur", c); VB.renderPrices(); renderCart(); };
  VB.renderPrices = () => $$("[data-price]").forEach((el) => (el.textContent = VB.price(+el.dataset.price)));

  /* ---------------- cart ---------------- */
  const cartEl = $("[data-cart]");
  let cart = store.get("vb-cart", []);
  const cartModal = cartEl && VB.modal(cartEl, { onOpen: () => { $$("[data-split]", cartEl).forEach((e) => { e.classList.remove("is-in"); void e.offsetWidth; e.style.setProperty("--d", ".45s"); e.classList.add("is-in"); }); $("[data-cart-msg]", cartEl).hidden = true; } });
  function renderCart() {
    if (!cartEl) return;
    const P = window.VB_PRODUCTS || {};
    cart = cart.filter((it) => P[it.slug]);
    const count = cart.reduce((a, b) => a + b.qty, 0);
    $$("[data-cart-count]").forEach((c) => (c.textContent = count));
    html.classList.toggle("has-items", count > 0);
    cartEl.classList.toggle("has-items", count > 0);
    const list = $("[data-cart-items]", cartEl);
    list.innerHTML = cart.map((it, i) => {
      const p = P[it.slug];
      return `<li class="ci"><a class="ci-img" href="${p.url}"><img src="${p.img}" alt=""></a><div><a class="ci-name" href="${p.url}">${p.name}</a>${it.opt ? `<p class="ci-opt">Size: ${it.opt}</p>` : ""}<div class="ci-qty"><button type="button" data-q="-1" data-i="${i}" aria-label="Decrease quantity">−</button><span>${it.qty}</span><button type="button" data-q="1" data-i="${i}" aria-label="Increase quantity">+</button></div></div><div class="ci-right"><span>${VB.price(p.price * it.qty)}</span><button type="button" class="ci-rm" data-rm="${i}">Remove</button></div></li>`;
    }).join("");
    $("[data-cart-total]", cartEl).textContent = VB.price(cart.reduce((a, it) => a + P[it.slug].price * it.qty, 0));
  }
  VB.cart = {
    add(slug, opt) {
      const f = cart.find((x) => x.slug === slug && x.opt === opt);
      f ? f.qty++ : cart.push({ slug, opt, qty: 1 });
      store.set("vb-cart", cart); renderCart();
      $$(".cart-btn").forEach((b) => b.animate([{ transform: "scale(1)" }, { transform: "scale(1.25)" }, { transform: "scale(1)" }], { duration: 500, easing: "cubic-bezier(.16,1,.3,1)" }));
    },
    open: () => cartModal && cartModal.open(),
  };
  cartEl && cartEl.addEventListener("click", (e) => {
    const q = e.target.closest("[data-q]"), rm = e.target.closest("[data-rm]");
    if (q) { const it = cart[+q.dataset.i]; it.qty += +q.dataset.q; if (it.qty < 1) cart.splice(+q.dataset.i, 1); }
    else if (rm) cart.splice(+rm.dataset.rm, 1);
    else if (e.target.closest("[data-checkout]")) { $("[data-cart-msg]", cartEl).hidden = false; return; }
    else return;
    store.set("vb-cart", cart); renderCart();
  });
  $$(".cart-btn").forEach((b) => b.addEventListener("click", () => cartModal.open()));

  /* ---------------- newsletter drawer + forms ---------------- */
  const nlEl = $("[data-newsletter]");
  const nlModal = nlEl && VB.modal(nlEl, { onOpen: () => $$("[data-split]", nlEl).forEach((e) => { e.classList.remove("is-in"); void e.offsetWidth; e.style.setProperty("--d", ".4s"); e.classList.add("is-in"); }) });
  $$("[data-open-newsletter]").forEach((b) => b.addEventListener("click", () => nlModal.open()));
  const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
  VB.emailOk = emailOk;
  function fakeSubmit(form, okEl, btn) {
    btn && btn.setAttribute("data-loading", "");
    setTimeout(() => { btn && btn.removeAttribute("data-loading"); okEl.hidden = false; form.reset(); }, 700);
  }
  VB.fakeSubmit = fakeSubmit;
  $("[data-nl-form]")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.currentTarget, inp = $("input[type=email]", f), field = inp.closest(".field");
    field.classList.toggle("has-error", !emailOk(inp.value));
    if (!field.querySelector(".err")) field.insertAdjacentHTML("beforeend", '<span class="err">Please enter a valid email address</span>');
    if (emailOk(inp.value)) fakeSubmit(f, $(".form-ok", f), $("button[type=submit]", f));
  });
  $$("[data-inline-nl]").forEach((f) => f.addEventListener("submit", (e) => {
    e.preventDefault();
    const inp = $("input", f);
    f.classList.toggle("has-error", !emailOk(inp.value));
    if (emailOk(inp.value)) fakeSubmit(f, $(".form-ok", f));
  }));

  /* ---------------- cookie banner ---------------- */
  const ck = $("[data-cookie]");
  function showCookie(prefs) {
    if (!ck) return;
    ck.hidden = false; void ck.offsetWidth; ck.classList.add("is-in");
    const saved = store.get("vb-consent", null);
    $$("[data-pref]", ck).forEach((i) => (i.checked = !!(saved && saved[i.dataset.pref])));
    setPrefs(!!prefs);
  }
  function setPrefs(open) {
    ck.classList.toggle("prefs-open", open);
    $("[data-cookie-toggle]", ck).textContent = open ? "Hide preferences" : "Customize";
  }
  function hideCookie(val) {
    store.set("vb-consent", val);
    ck.classList.remove("is-in");
    setTimeout(() => (ck.hidden = true), 600);
  }
  if (ck) {
    $("[data-cookie-toggle]", ck).addEventListener("click", () => setPrefs(!ck.classList.contains("prefs-open")));
    $("[data-cookie-accept]", ck).addEventListener("click", () => hideCookie({ analytics: true, marketing: true }));
    $("[data-cookie-decline]", ck).addEventListener("click", () => hideCookie({ analytics: false, marketing: false }));
    $("[data-cookie-save]", ck).addEventListener("click", () => hideCookie(Object.fromEntries($$("[data-pref]", ck).map((i) => [i.dataset.pref, i.checked]))));
    $$("[data-open-cookie]").forEach((b) => b.addEventListener("click", () => showCookie(true)));
  }

  /* ---------------- custom select ---------------- */
  VB.selects = () => $$("[data-select]").forEach((wrap) => {
    const btn = $(".select-btn", wrap), list = $(".select-list", wrap), label = $("[data-select-label]", wrap);
    const opts = $$("[role=option]", list);
    const close = () => { list.hidden = true; btn.setAttribute("aria-expanded", "false"); };
    const open = () => { list.hidden = false; btn.setAttribute("aria-expanded", "true"); (opts.find((o) => o.getAttribute("aria-selected") === "true") || opts[0]).focus(); };
    const pick = (o) => {
      opts.forEach((x) => x.setAttribute("aria-selected", x === o));
      label.textContent = o.textContent; wrap.dataset.value = o.dataset.value;
      wrap.classList.remove("has-error"); close(); btn.focus();
      wrap.dispatchEvent(new CustomEvent("change", { detail: o.dataset.value }));
    };
    btn.addEventListener("click", () => (list.hidden ? open() : close()));
    opts.forEach((o, i) => {
      o.addEventListener("click", () => pick(o));
      o.addEventListener("keydown", (e) => {
        if (e.key === "ArrowDown") { e.preventDefault(); (opts[i + 1] || o).focus(); }
        if (e.key === "ArrowUp") { e.preventDefault(); (opts[i - 1] || o).focus(); }
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(o); }
        if (e.key === "Escape") { e.stopPropagation(); close(); btn.focus(); }
        if (e.key === "Tab") close();
      });
    });
    document.addEventListener("click", (e) => { if (!wrap.contains(e.target)) close(); });
    wrap.select = (v) => { const o = opts.find((x) => x.dataset.value === v); o && pick(o); };
  });

  /* ---------------- page transitions ---------------- */
  const curtain = $(".pt-curtain");
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a[href]");
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0 || a.target === "_blank" || a.hasAttribute("download")) return;
    const href = a.getAttribute("href");
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") || /^https?:/.test(href)) return;
    e.preventDefault();
    curtain.classList.add("is-on");
    setTimeout(() => (location.href = href), 450);
  });
  addEventListener("pageshow", (e) => { if (e.persisted) curtain.classList.remove("is-on"); });

  /* ---------------- boot ---------------- */
  const loader = $(".loader");
  function intro() {
    body.classList.add("is-ready");
    $$("[data-intro]").forEach((el) => el.classList.add("is-in"));
    VB.observe();
    scroller.emit();
    setTimeout(() => { if (ck && !store.get("vb-consent", null)) showCookie(false); }, 1200);
    document.dispatchEvent(new CustomEvent("vb:ready"));
  }
  function boot() {
    VB.split(); VB.roll(); VB.parallax(); VB.selects(); VB.renderPrices(); renderCart();
    updateHeader(scrollY); updateParallax();
    $$(".info-grid > div").forEach((d, i) => d.style.setProperty("--i", i));
    const first = !ss.get("vb-visited") && !reduce;
    ss.set("vb-visited", "1");
    if (first) {
      body.classList.add("is-loading");
      setTimeout(() => {
        loader.classList.add("is-out");
        setTimeout(intro, 350);
        setTimeout(() => { loader.classList.add("is-done"); body.classList.remove("is-loading"); }, 1300);
      }, 1900);
    } else {
      loader.classList.add("is-done");
      curtain.classList.add("is-on");
      requestAnimationFrame(() => requestAnimationFrame(() => { curtain.classList.remove("is-on"); intro(); }));
    }
  }
  const fontsReady = document.fonts ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]) : Promise.resolve();
  fontsReady.then(boot);
})();
