/* Product detail: size select, add to cart, accordions, gallery indicator, related card sliders */
(() => {
  const { $, $$, scroll } = window.VB;
  const root = $("[data-product]");
  const add = $("[data-add]"), stock = $("[data-stock]"), sel = $("[data-select]", root);
  const label = $(".btn-label", add);
  const setLabel = (t) => { label.textContent = t; delete label.dataset.rollDone; window.VB.roll(add); add.setAttribute("aria-label", t); };
  if (sel) sel.addEventListener("change", () => { add.classList.remove("is-disabled"); setLabel("Add to cart"); stock.classList.add("show"); });
  add.addEventListener("click", () => {
    if (sel && !sel.dataset.value) { sel.classList.add("has-error"); $(".select-btn", sel).click(); return; }
    window.VB.cart.add(add.dataset.slug, sel ? sel.dataset.value : null);
    add.classList.add("is-added"); setLabel("Added to cart");
    setTimeout(() => { add.classList.remove("is-added"); setLabel("Add to cart"); window.VB.cart.open(); }, 700);
  });
  $$(".pd-sw button").forEach((b, i, all) => b.addEventListener("click", () => all.forEach((x) => x.setAttribute("aria-checked", x === b))));
  $$(".acc-btn").forEach((b) => b.addEventListener("click", () => {
    const it = b.closest(".acc-item"), open = !it.classList.contains("open");
    it.classList.toggle("open", open); b.setAttribute("aria-expanded", open);
  }));
  const imgs = $$("[data-pd-img]"), nums = $$("[data-pd-n]"), barEl = $("[data-pd-bar]");
  const paint = () => {
    let cur = 0;
    imgs.forEach((im, i) => { if (im.getBoundingClientRect().top < innerHeight * 0.5) cur = i; });
    nums.forEach((n, i) => n.classList.toggle("on", i === cur));
    if (barEl) { barEl.style.height = 100 / imgs.length + "%"; barEl.style.transform = `translateY(${cur * 100}%)`; }
  };
  scroll.on(paint); paint();
  const back = $("[data-back]");
  back && back.addEventListener("click", (e) => { if (document.referrer.includes("boutique")) { e.preventDefault(); e.stopPropagation(); history.back(); } }, true);

  $$("[data-mini-slider]").forEach((m) => {
    const track = $(".pcard-track", m), dots = $$(".pc-dots button", m), n = $$(".pcard-slide", m).length;
    let i = 0;
    const go = (k) => { i = (k + n) % n; track.style.transform = `translateX(${-i * 100}%)`; dots.forEach((d, j) => d.classList.toggle("on", j === i)); };
    $(".pc-prev", m).addEventListener("click", (e) => { e.preventDefault(); go(i - 1); });
    $(".pc-next", m).addEventListener("click", (e) => { e.preventDefault(); go(i + 1); });
    dots.forEach((d, j) => d.addEventListener("click", () => go(j)));
  });
})();
