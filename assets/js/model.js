/* Model page: scroll-scrubbed films drawn to canvas, per-chapter ambient sound, HUD (skip, clock dial, sound), overview, lightbox, stat counters */
(() => {
  const { $, $$, scroll, clamp, store, reduce } = window.VB;
  const chapters = $$("[data-chapter]").map((el) => ({
    el, canvas: $(".ch-canvas", el), ctx: $(".ch-canvas", el).getContext("2d"),
    title: $(".ch-title", el), bars: $(".ch-bars", el), side: $("[data-side]", el),
    hour: +el.dataset.hour, video: null, audio: null, ready: false, target: 0, lastDrawn: -1, seeking: false, p: 0,
    src: el.dataset.video, audioSrc: el.dataset.audio,
  }));
  const hud = $("[data-hud]"), skip = $("[data-skip]"), dial = $("[data-dial]"), dialTime = $("[data-dial-time]"), hand = $(".dial-hand");
  const prompt = $("[data-sound-prompt]"), wave = $("[data-wave]");

  /* ---------- layout: chapter height grows to fit its side panel ---------- */
  function layout() {
    const vh = innerHeight;
    chapters.forEach((c, i) => {
      const panelTop = vh * 1.35;
      if (c.side) {
        c.side.style.top = panelTop + "px";
        const need = panelTop + c.side.offsetHeight + vh * 0.9;
        c.el.style.height = Math.max(need, vh * (i === 1 ? 5.4 : 4.6)) + "px";
      }
      c.panelTop = panelTop;
      sizeCanvas(c);
    });
  }
  function sizeCanvas(c) {
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    c.canvas.width = Math.round(innerWidth * dpr); c.canvas.height = Math.round(innerHeight * dpr);
    c.lastDrawn = -1; draw(c);
  }

  /* ---------- video loading + drawing ---------- */
  function load(c) {
    if (c.video) return;
    const v = document.createElement("video");
    v.muted = true; v.playsInline = true; v.preload = "auto"; v.src = c.src;
    v.addEventListener("loadeddata", () => { c.ready = true; seek(c); });
    v.addEventListener("seeked", () => { c.seeking = false; draw(c, true); if (Math.abs(v.currentTime - c.target) > 0.04) seek(c); });
    c.video = v;
  }
  function seek(c) {
    if (!c.ready || c.seeking) return;
    const v = c.video;
    if (Math.abs(v.currentTime - c.target) < 0.02) { draw(c); return; }
    c.seeking = true; v.currentTime = c.target;
  }
  function draw(c, force) {
    const v = c.video; if (!v || !c.ready) return;
    if (!force && c.lastDrawn === v.currentTime) return;
    const cw = c.canvas.width, ch = c.canvas.height, vw = v.videoWidth, vh = v.videoHeight;
    if (!vw) return;
    const s = Math.max(cw / vw, ch / vh) * 1.04; // slight overscan, like a lens crop
    const w = vw * s, h = vh * s;
    c.ctx.drawImage(v, (cw - w) / 2, (ch - h) / 2, w, h);
    c.lastDrawn = v.currentTime;
  }

  /* ---------- scroll driver ---------- */
  let active = -1;
  function update() {
    const vh = innerHeight;
    let current = -1;
    chapters.forEach((c, i) => {
      const r = c.el.getBoundingClientRect();
      const total = c.el.offsetHeight - vh;
      const p = clamp(-r.top / total, 0, 1);
      c.p = p;
      const near = r.top < vh * 2 && r.bottom > -vh;
      if (near) load(c);
      if (r.top <= 1 && r.bottom >= vh * 0.5) current = i;
      if (!near) return;
      // letterbox bars + title card in the first ~ screen of the chapter
      const px = -r.top; // pixels scrolled into chapter
      const barH = vh * 0.195 * (1 - clamp(px / (vh * 0.9), 0, 1));
      c.bars.style.setProperty("--bar", barH.toFixed(1) + "px");
      const tP = clamp(px / (vh * 0.7), 0, 1);
      c.title.style.opacity = (1 - tP).toFixed(3);
      c.title.style.transform = `translate(-50%, calc(-50% - ${(tP * 80).toFixed(1)}px))`;
      if (r.top < vh * 0.6 && !c.titleIn) { c.titleIn = true; $$("[data-split]", c.title).forEach((e) => e.classList.add("is-in")); }
      // film time
      if (c.ready && c.video.duration) {
        const fp = clamp((px - vh * 0.15) / (total - vh * 0.15), 0, 1);
        c.target = fp * (c.video.duration - 0.05);
        seek(c);
      }
    });
    // HUD
    if (current !== active) { active = current; onChapter(current); }
    const c = chapters[current];
    const inFilm = c && c.p > 0.04;
    skip.classList.toggle("on", !!inFilm);
    dial.classList.toggle("on", !!inFilm);
    if (c) {
      const next = chapters[current + 1] ? chapters[current + 1].hour : c.hour + 3;
      const t = c.hour + (next - c.hour) * c.p;
      const hh = Math.floor(t), mm = Math.floor((t - hh) * 60);
      dialTime.textContent = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
      hand.style.transform = `rotate(${(-70 + c.p * 140).toFixed(1)}deg)`;
    }
    prompt.classList.toggle("is-hidden", !(current === 0 && chapters[0].p < 0.06));
    // HUD colour: dark over white areas at the bottom of the viewport
    const y = innerHeight - 30;
    const overDark = $$("[data-section-dark]").some((s) => { const rr = s.getBoundingClientRect(); return rr.top <= y && rr.bottom >= y; });
    const overPanel = c && c.side && (() => { const rr = c.side.getBoundingClientRect(); return rr.top <= y && rr.bottom >= y && innerWidth < 768; })();
    hud.classList.toggle("on-light", !overDark || !!overPanel);
    // fade audio by chapter progress
    mixAudio();
  }

  /* ---------- sound ---------- */
  let soundOn = store.get("vb-sound", true), unlocked = false;
  chapters.forEach((c) => { const a = new Audio(c.audioSrc); a.loop = true; a.preload = "none"; a.volume = 0; c.audio = a; });
  function mixAudio() {
    chapters.forEach((c, i) => {
      const want = soundOn && unlocked && i === active ? 0.6 * clamp(Math.min(c.p * 30, (1 - c.p) * 12), 0, 1) : 0;
      const a = c.audio;
      a.volume = clamp(a.volume + (want - a.volume) * 0.15, 0, 1);
      if (want > 0.01 && a.paused && !a.pending) {
        a.preload = "auto"; a.pending = true;
        a.play().then(() => (a.pending = false)).catch((err) => { a.pending = false; if (err && err.name === "NotAllowedError") unlocked = false; });
      }
      if (want === 0 && a.volume < 0.01 && !a.paused && !a.pending) a.pause();
    });
  }
  function setSound(on, user) {
    soundOn = on; store.set("vb-sound", on);
    $$("[data-sound]").forEach((b) => b.classList.toggle("is-on", (b.dataset.sound === "on") === on));
    wave.classList.toggle("is-playing", on);
    wave.setAttribute("aria-label", on ? "Mute sound" : "Unmute sound");
    if (on && user) unlock();
  }
  // browsers only allow audio after a user gesture; the mixer then fades the active chapter's track in
  function unlock() { unlocked = true; mixAudio(); }
  $$("[data-sound]").forEach((b) => b.addEventListener("click", () => setSound(b.dataset.sound === "on", true)));
  wave.addEventListener("click", () => setSound(!soundOn, true));
  ["pointerdown", "keydown", "touchend"].forEach((ev) => addEventListener(ev, () => { if (soundOn && !unlocked) unlock(); }, { passive: true }));
  setSound(soundOn);
  setInterval(mixAudio, 120);
  window.__vbAudio = () => chapters.map((c) => ({ id: c.el.id, paused: c.audio.paused, vol: +c.audio.volume.toFixed(2) }));

  function onChapter() { /* reserved for chapter change effects */ }

  /* ---------- skip + dial overview ---------- */
  skip.addEventListener("click", () => {
    const c = chapters[active]; if (!c) return;
    const end = c.el.offsetTop + c.el.offsetHeight - innerHeight * 0.4;
    scroll.to(end);
  });
  const ticks = $(".dial-ticks");
  for (let a = -70; a <= 70; a += 10) {
    const rad = (a - 90) * Math.PI / 180, long = a % 30 === 0;
    const r1 = long ? 30 : 33, r2 = 38;
    ticks.insertAdjacentHTML("beforeend", `<line x1="${60 + Math.cos(rad) * r1}" y1="${58 + Math.sin(rad) * r1}" x2="${60 + Math.cos(rad) * r2}" y2="${58 + Math.sin(rad) * r2}"/>`);
  }
  const ovEl = $("[data-overview]");
  const ov = window.VB.modal(ovEl, { extra: 700, onOpen: () => $$("[data-jump]", ovEl).forEach((b, i) => b.classList.toggle("on", i === active)) });
  dial.addEventListener("click", () => ov.open());
  $$("[data-jump]", ovEl).forEach((b) => b.addEventListener("click", () => {
    ov.close();
    const el = document.getElementById(b.dataset.jump);
    setTimeout(() => scroll.to(el.offsetTop + innerHeight * 0.75, { immediate: true }), 50);
  }));

  /* ---------- lightbox ---------- */
  const lb = $("[data-lb]"), items = $$("[data-lightbox]").map((b) => ({ src: $("img", b).src, cap: $("img", b).alt }));
  let li = 0;
  const lbApi = window.VB.modal(lb, { extra: 500 });
  const show = (i) => {
    li = (i + items.length) % items.length;
    $("[data-lb-img]", lb).src = items[li].src; $("[data-lb-img]", lb).alt = items[li].cap;
    $("[data-lb-cap]", lb).textContent = items[li].cap; $("[data-lb-count]", lb).textContent = `${li + 1} / ${items.length}`;
  };
  $$("[data-lightbox]").forEach((b) => b.addEventListener("click", () => { show(+b.dataset.lightbox); lbApi.open(); }));
  $("[data-lb-close]", lb).addEventListener("click", lbApi.close);
  $("[data-lb-prev]", lb).addEventListener("click", () => show(li - 1));
  $("[data-lb-next]", lb).addEventListener("click", () => show(li + 1));
  lb.addEventListener("keydown", (e) => { if (e.key === "ArrowLeft") show(li - 1); if (e.key === "ArrowRight") show(li + 1); });
  lb.addEventListener("click", (e) => { if (e.target === lb) lbApi.close(); });

  /* ---------- stat counters: odometer digit roll ---------- */
  $$("[data-count]").forEach((el) => {
    const val = el.dataset.count;
    el.setAttribute("aria-label", val);
    el.innerHTML = [...val].map((ch) => /\d/.test(ch)
      ? `<span class="dg" aria-hidden="true"><span class="dg-col" data-d="${ch}">${"0123456789".split("").map((d) => `<span>${d}</span>`).join("")}</span></span>`
      : `<span aria-hidden="true">${ch}</span>`).join("");
    const cols = $$(".dg-col", el);
    cols.forEach((c) => (c.style.transform = "translateY(0)"));
    new IntersectionObserver(([e], o) => {
      if (!e.isIntersecting) return;
      o.disconnect();
      cols.forEach((c, i) => { c.style.transitionDelay = i * 90 + "ms"; c.style.transform = `translateY(${-c.dataset.d * 10}%)`; });
    }, { threshold: 0.6 }).observe(el);
  });

  /* ---------- boot ---------- */
  document.addEventListener("vb:ready", () => {
    // side panel items reveal with the normal observer (already registered); split titles of chapters are manual
    layout(); update();
  });
  layout();
  addEventListener("resize", () => { layout(); update(); });
  scroll.on(update);
  // keep drawing while a seek is pending (e.g. after resize)
  (function loop() { chapters.forEach((c) => c.ready && draw(c)); requestAnimationFrame(loop); })();
  if (reduce) chapters.forEach(load);
})();
