/* Home page behaviour */
(() => {
  const { $, $$, scroll, clamp, reduce } = window.VB;

  /* hero: content drifts up and fades, video slides slower */
  const hero = $("[data-hero]"), heroMedia = $("[data-hero-media]"), heroContent = $("[data-hero-content]");
  scroll.on((y) => {
    if (reduce || !hero) return;
    const h = hero.offsetHeight;
    if (y > h * 1.2) return;
    heroMedia.style.transform = `translate3d(0, ${(y * 0.35).toFixed(1)}px, 0)`;
    heroContent.style.transform = `translate3d(0, ${(y * 0.55).toFixed(1)}px, 0)`;
    heroContent.style.opacity = clamp(1 - y / (h * 0.75), 0, 1);
  });

  /* motto section opens from an inset frame to full width as it scrolls in */
  const motto = $("[data-motto]");
  if (motto && !reduce) scroll.on(() => {
    const r = motto.getBoundingClientRect();
    if (r.top > innerHeight || r.bottom < 0) return;
    const p = clamp(1 - r.top / innerHeight, 0, 1);
    motto.style.setProperty("--mx", ((1 - p) * 10).toFixed(2) + "%");
  });

  /* autoplay muted ambient videos only while visible */
  const vio = new IntersectionObserver((es) => es.forEach((e) => {
    const v = e.target;
    if (e.isIntersecting) v.play().catch(() => {}); else v.pause();
  }), { threshold: 0.05 });
  $$("video[autoplay]").forEach((v) => vio.observe(v));

  /* film player with sound */
  const P = $("[data-player]");
  if (P) {
    const v = $("video", P), seek = $("[data-p-seek]", P), fill = $("[data-p-fill]", P), buf = $("[data-p-buf]", P), knob = $("[data-p-knob]", P);
    const fmt = (s) => { s = Math.max(0, Math.floor(s || 0)); return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; };
    const sync = () => {
      const p = v.duration ? v.currentTime / v.duration : 0;
      fill.style.width = p * 100 + "%"; knob.style.left = p * 100 + "%";
      $("[data-p-cur]", P).textContent = fmt(v.currentTime); $("[data-p-dur]", P).textContent = fmt(v.duration);
      seek.setAttribute("aria-valuenow", Math.round(p * 100));
      if (v.buffered.length && v.duration) buf.style.width = (v.buffered.end(v.buffered.length - 1) / v.duration) * 100 + "%";
    };
    const toggle = () => {
      if (v.paused) { v.muted = P.classList.contains("is-muted"); v.play(); P.classList.add("was-started"); }
      else v.pause();
    };
    $$("[data-p-toggle]", P).forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); toggle(); }));
    v.addEventListener("click", () => P.classList.contains("was-started") && toggle());
    v.addEventListener("play", () => { P.classList.add("is-playing"); $(".p-playpause", P).setAttribute("aria-label", "Pause video"); });
    v.addEventListener("pause", () => { P.classList.remove("is-playing"); $(".p-playpause", P).setAttribute("aria-label", "Play video"); });
    v.addEventListener("ended", () => { P.classList.remove("was-started"); v.currentTime = 0; sync(); });
    ["timeupdate", "loadedmetadata", "progress", "seeked"].forEach((ev) => v.addEventListener(ev, sync));
    $("[data-p-mute]", P).addEventListener("click", () => {
      v.muted = !v.muted; P.classList.toggle("is-muted", v.muted);
      $("[data-p-mute]", P).setAttribute("aria-label", v.muted ? "Unmute video" : "Mute video");
    });
    $("[data-p-fs]", P).addEventListener("click", () => {
      if (document.fullscreenElement) document.exitFullscreen();
      else (P.requestFullscreen || v.webkitEnterFullscreen || (() => {})).call(P.requestFullscreen ? P : v);
    });
    const seekTo = (x) => { const r = seek.getBoundingClientRect(); if (v.duration) v.currentTime = clamp((x - r.left) / r.width, 0, 1) * v.duration; sync(); };
    seek.addEventListener("pointerdown", (e) => {
      seek.setPointerCapture(e.pointerId); seekTo(e.clientX);
      const mv = (ev) => seekTo(ev.clientX);
      seek.addEventListener("pointermove", mv);
      seek.addEventListener("pointerup", () => seek.removeEventListener("pointermove", mv), { once: true });
    });
    seek.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") v.currentTime = Math.min(v.duration, v.currentTime + 5);
      if (e.key === "ArrowLeft") v.currentTime = Math.max(0, v.currentTime - 5);
    });
    let t = 0;
    P.addEventListener("mousemove", () => { P.classList.add("show-ui"); clearTimeout(t); t = setTimeout(() => P.classList.remove("show-ui"), 2000); });
    // pause when scrolled away
    new IntersectionObserver(([e]) => { if (!e.isIntersecting && !v.paused) v.pause(); }, { threshold: 0 }).observe(P);
  }

  /* heritage collage: scroll reveal + scale, mouse parallax */
  const C = $("[data-collage]");
  if (C) {
    const mice = $$("[data-mouse]", C).map((el) => ({ el, f: +el.dataset.mouse, x: 0, y: 0 }));
    let mx = 0, my = 0;
    C.addEventListener("pointermove", (e) => { const r = C.getBoundingClientRect(); mx = (e.clientX - r.left) / r.width - 0.5; my = (e.clientY - r.top) / r.height - 0.5; });
    C.addEventListener("pointerleave", () => { mx = my = 0; });
    const content = $("[data-collage-content]", C);
    let on = false;
    new IntersectionObserver(([e]) => { on = e.isIntersecting; if (on) loop(); }, { threshold: 0 }).observe(C);
    function loop() {
      if (!on || reduce) return;
      const r = C.getBoundingClientRect();
      const prog = clamp((innerHeight - r.top) / (innerHeight + r.height), 0, 1) - 0.5;
      mice.forEach((m) => {
        m.x += (mx * 40 * m.f - m.x) * 0.06; m.y += (my * 30 * m.f - m.y) * 0.06;
        m.el.style.transform = `translate3d(${m.x.toFixed(2)}px, ${(m.y - prog * 160 * m.f).toFixed(2)}px, 0)`;
      });
      if (innerWidth >= 1024) content.style.transform = `translate3d(0, ${(prog * -60).toFixed(1)}px, 0)`;
      requestAnimationFrame(loop);
    }
  }

  /* boutique highlight slider: auto-advance every 5 s with progress line, wipe-in from the right */
  const S = $("[data-bq-slider]");
  if (S) {
    const slides = $$(".bq-slide", S), bar = $("[data-bq-progress]", S);
    const real = slides.length - 1; // last slide duplicates the first for a seamless loop
    let i = 0, start = 0, running = false, visible = false;
    slides[0].classList.add("is-active");
    const DUR = 5000;
    function go() {
      const cur = slides[i % slides.length];
      i = (i + 1) % real;
      const next = slides[i];
      slides.forEach((s) => s.setAttribute("inert", ""));
      next.removeAttribute("inert");
      next.classList.add("is-entering");
      setTimeout(() => { cur.classList.remove("is-active"); next.classList.remove("is-entering"); next.classList.add("is-active"); }, 1250);
    }
    function frame(t) {
      if (!running) return;
      if (!start) start = t;
      const p = (t - start) / DUR;
      bar.style.transform = `scaleX(${Math.min(p, 1)})`;
      if (p >= 1) { start = t; go(); }
      requestAnimationFrame(frame);
    }
    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !running && !reduce) { running = true; start = 0; requestAnimationFrame(frame); }
      if (!visible) running = false;
    }, { threshold: 0.3 }).observe(S);
    // subtle parallax on slide backgrounds
    scroll.on(() => {
      const r = S.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) return;
      const p = clamp((innerHeight - r.top) / (innerHeight + r.height), 0, 1) - 0.5;
      $$("[data-bq-parallax]", S).forEach((b) => (b.style.transform = `translate3d(0, ${(p * -60).toFixed(1)}px, 0)`));
    });
  }
})();
