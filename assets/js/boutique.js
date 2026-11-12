/* Boutique: collections, currency, grid density, per-card image sliders */
(() => {
  const { $, $$, store } = window.VB;
  const grid = $("[data-pgrid]");
  if (!grid) return;
  const cards = $$(".pcard", grid);
  function show(coll) {
    $$("[data-coll]").forEach((b) => { const on = b.dataset.coll === coll; b.classList.toggle("on", on); b.setAttribute("aria-selected", on); });
    let i = 0;
    cards.forEach((c) => {
      const on = c.dataset.collection === coll;
      c.classList.toggle("is-hidden-cat", !on);
      c.classList.remove("is-pop");
      if (on) { void c.offsetWidth; c.style.setProperty("--i", i++); c.classList.add("is-pop"); }
    });
    store.set("vb-coll", coll);
  }
  $$("[data-coll]").forEach((b) => b.addEventListener("click", () => show(b.dataset.coll)));
  show(store.get("vb-coll", "bespoke"));

  const curBtns = $$("[data-cur]");
  const paintCur = () => curBtns.forEach((b) => b.classList.toggle("on", b.dataset.cur === window.VB.currency));
  curBtns.forEach((b) => b.addEventListener("click", () => { window.VB.setCurrency(b.dataset.cur); paintCur(); }));
  paintCur();

  const colBtns = $$("[data-cols]");
  const setCols = (n) => { grid.classList.toggle("cols-6", n === "6"); colBtns.forEach((b) => b.classList.toggle("on", b.dataset.cols === n)); store.set("vb-cols", n); };
  colBtns.forEach((b) => b.addEventListener("click", () => setCols(b.dataset.cols)));
  setCols(store.get("vb-cols", "3"));
})();

/* mini sliders inside product cards (also used for "You may also like" on product pages) */
(() => {
  const { $, $$ } = window.VB;
  $$("[data-mini-slider]").forEach((m) => {
    const track = $(".pcard-track", m), dots = $$(".pc-dots button", m), n = $$(".pcard-slide", m).length;
    let i = 0;
    const go = (k) => { i = (k + n) % n; track.style.transform = `translateX(${-i * 100}%)`; dots.forEach((d, j) => d.classList.toggle("on", j === i)); };
    $(".pc-prev", m).addEventListener("click", (e) => { e.preventDefault(); go(i - 1); });
    $(".pc-next", m).addEventListener("click", (e) => { e.preventDefault(); go(i + 1); });
    dots.forEach((d, j) => d.addEventListener("click", () => go(j)));
    let sx = null;
    m.addEventListener("touchstart", (e) => (sx = e.touches[0].clientX), { passive: true });
    m.addEventListener("touchend", (e) => { if (sx == null) return; const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 40) go(i + (dx < 0 ? 1 : -1)); sx = null; });
  });
})();
