/* News: category filter with sliding indicator */
(() => {
  const { $, $$ } = window.VB;
  const tabs = $$("[data-filter]"), ind = $("[data-ind]"), cards = $$("[data-news-grid] .ncard"), empty = $("[data-news-empty]");
  const move = (b) => { ind.style.left = b.offsetLeft - b.parentElement.scrollLeft + "px"; ind.style.width = b.offsetWidth + "px"; };
  function filter(cat, b) {
    tabs.forEach((t) => t.classList.toggle("on", t === b)); move(b);
    let i = 0;
    cards.forEach((c, idx) => {
      const on = cat === "all" || c.dataset.cat === cat;
      c.classList.toggle("is-out", !on); c.classList.remove("is-pop");
      if (on) {
        c.className = c.className.replace(/\bnl-\d\b/, "nl-" + (cat === "all" ? idx % 6 : [0, 2, 3, 4, 5][i % 5]));
        void c.offsetWidth; c.style.setProperty("--i", i++); c.classList.add("is-pop");
      }
    });
    empty.hidden = i > 0;
    const url = new URL(location.href);
    cat === "all" ? url.searchParams.delete("category") : url.searchParams.set("category", cat);
    history.replaceState(null, "", url);
  }
  tabs.forEach((b) => b.addEventListener("click", () => filter(b.dataset.filter, b)));
  const want = new URL(location.href).searchParams.get("category");
  const start = tabs.find((t) => t.dataset.filter === want) || tabs[0];
  document.addEventListener("vb:ready", () => (want ? filter(want, start) : move(start)));
  addEventListener("resize", () => move(tabs.find((t) => t.classList.contains("on"))));
})();
