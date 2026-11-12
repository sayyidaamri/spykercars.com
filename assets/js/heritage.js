/* Heritage: vertical scroll drives a horizontal timeline; two timelines switchable from the bottom tabs */
(() => {
  const { $, $$, scroll, clamp } = window.VB;
  const hz = $("[data-hz]"), tracks = $$("[data-track]"), bar = $("[data-hz-progress]");
  const tabs = $$("[data-tl]");
  let track = tracks[0], dist = 0;

  // digit stagger for the big years
  $$(".hy").forEach((h) => $$(".hy-d > span", h).forEach((s, i) => s.style.setProperty("--i", i)));

  function measure() {
    dist = Math.max(0, track.scrollWidth - innerWidth);
    hz.style.height = dist + innerHeight + "px";
    update();
  }
  function update() {
    const p = dist ? clamp(scrollY / dist, 0, 1) : 0;
    track.style.transform = `translate3d(${(-p * dist).toFixed(1)}px,0,0)`;
    bar.style.transform = `scaleX(${p})`;
    // small parallax on images inside the viewport
    $$(".hp-media img, .hp-img img, .hp-full img", track).forEach((img) => {
      const r = img.parentElement.getBoundingClientRect();
      if (r.right < 0 || r.left > innerWidth) return;
      const k = (r.left + r.width / 2 - innerWidth / 2) / innerWidth;
      img.style.transform = `translateX(${(k * -40).toFixed(1)}px) scale(1.12)`;
    });
  }
  scroll.on(update);
  addEventListener("resize", measure);

  // horizontal wheel / trackpad and arrow keys
  addEventListener("wheel", (e) => {
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) { e.preventDefault(); scroll.to(scroll.target + e.deltaX * 1.2); }
  }, { passive: false });
  addEventListener("keydown", (e) => {
    if (e.target.closest("input, textarea, [role=dialog]")) return;
    if (e.key === "ArrowRight") { e.preventDefault(); scroll.to(scrollY + innerWidth * 0.6); }
    if (e.key === "ArrowLeft") { e.preventDefault(); scroll.to(scrollY - innerWidth * 0.6); }
  });

  function select(id, animate = true) {
    const next = tracks.find((t) => t.dataset.track === id) || tracks[0];
    tabs.forEach((t) => t.setAttribute("aria-selected", t.dataset.tl === next.dataset.track));
    const url = new URL(location.href);
    if (next.dataset.track === "racing") url.searchParams.set("timeline", "racing-history"); else url.searchParams.delete("timeline");
    history.replaceState(null, "", url);
    if (next === track) return;
    const go = () => {
      track.hidden = true; track.classList.remove("is-leaving");
      track = next; track.hidden = false; track.classList.add("is-entering");
      $$(".hp", track).forEach((p) => p.classList.remove("is-in"));
      $$("[data-split]", track).forEach((p) => p.classList.remove("is-in"));
      scroll.to(0, { immediate: true }); measure();
      requestAnimationFrame(() => {
        track.style.transition = "opacity .6s"; track.classList.remove("is-entering");
        window.VB.observe(track);
        // reveal what is already visible
        $$(".hp", track).forEach((p) => { const r = p.getBoundingClientRect(); if (r.left < innerWidth) { p.classList.add("is-in"); $$("[data-split]", p).forEach((s) => s.classList.add("is-in")); } });
      });
    };
    if (animate) { track.classList.add("is-leaving"); setTimeout(go, 500); } else go();
  }
  tabs.forEach((t) => t.addEventListener("click", () => select(t.dataset.tl)));

  document.addEventListener("vb:ready", () => {
    const want = new URL(location.href).searchParams.get("timeline") === "racing-history" ? "racing" : "heritage";
    if (want !== "heritage") select(want, false);
    measure();
    $$(".hp", track).forEach((p) => { const r = p.getBoundingClientRect(); if (r.left < innerWidth) { p.classList.add("is-in"); $$("[data-split]", p).forEach((s) => s.classList.add("is-in")); } });
  });
  measure();
  // images load late: re-measure once they arrive
  $$("img", hz).forEach((img) => img.complete || img.addEventListener("load", measure, { once: true }));
})();
