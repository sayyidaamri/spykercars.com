/* Contact form: inline validation; nothing is sent anywhere */
(() => {
  const { $, $$, emailOk, fakeSubmit } = window.VB;
  const f = $("[data-contact]"); if (!f) return;
  const sel = $("[data-select]", f);
  const want = new URL(location.href).searchParams.get("subject");
  document.addEventListener("vb:ready", () => want && sel.select && sel.select(want));
  const check = (field) => {
    let ok;
    if (field === sel) ok = !!sel.dataset.value;
    else { const inp = $("input, textarea", field); ok = inp.type === "email" ? emailOk(inp.value) : inp.value.trim().length > 0; }
    field.classList.toggle("has-error", !ok); return ok;
  };
  $$(".field input, .field textarea", f).forEach((i) => i.addEventListener("blur", () => i.value && check(i.closest(".field"))));
  f.addEventListener("submit", (e) => {
    e.preventDefault();
    const ok = $$(".field", f).map(check).every(Boolean);
    if (!ok) { $(".has-error input, .has-error textarea, .has-error .select-btn", f)?.focus(); return; }
    fakeSubmit(f, $(".form-ok", f), $("button[type=submit]", f));
    $("[data-select-label]", sel).textContent = ""; delete sel.dataset.value;
  });
})();
