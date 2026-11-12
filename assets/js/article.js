/* Article: related articles slider (buttons, drag, swipe) */
(() => {
  const { $ } = window.VB;
  const tr = $("[data-ra]"), prev = $("[data-ra-prev]"), next = $("[data-ra-next]");
  if (!tr) return;
  const step = () => tr.firstElementChild.offsetWidth + 16;
  const paint = () => { prev.disabled = tr.scrollLeft < 4; next.disabled = tr.scrollLeft + tr.clientWidth > tr.scrollWidth - 4; };
  prev.addEventListener("click", () => tr.scrollBy({ left: -step(), behavior: "smooth" }));
  next.addEventListener("click", () => tr.scrollBy({ left: step(), behavior: "smooth" }));
  tr.addEventListener("scroll", paint, { passive: true }); paint();
  let down = false, sx = 0, sl = 0, moved = false;
  tr.addEventListener("pointerdown", (e) => { if (e.pointerType !== "mouse") return; down = true; moved = false; sx = e.clientX; sl = tr.scrollLeft; tr.style.scrollSnapType = "none"; tr.style.scrollBehavior = "auto"; });
  addEventListener("pointermove", (e) => { if (!down) return; const dx = e.clientX - sx; if (Math.abs(dx) > 4) moved = true; tr.scrollLeft = sl - dx; });
  addEventListener("pointerup", () => { if (!down) return; down = false; tr.style.scrollSnapType = ""; tr.style.scrollBehavior = ""; });
  tr.addEventListener("click", (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); } }, true);
  tr.addEventListener("dragstart", (e) => e.preventDefault());
})();
