/* =============================================================
   oak-consent.js  –  OakStride Studio cookie-/samtyckeshantering
   -------------------------------------------------------------
   Lättviktig, tillgänglig GDPR-samtyckesbanner.

   - Kategorier: nödvändiga (alltid på), statistik, marknadsföring.
   - Sparar valet i localStorage (förstapartslagring, ingen 3:e-parts-cookie).
   - Gate:ar skript: lägg icke-nödvändiga skript som
       <script type="text/plain" data-consent="statistik" data-src="..."></script>
     – de aktiveras först när besökaren samtyckt till kategorin.
   - Exponerar window.OakConsent.allows('statistik') och event
     'oak-consent-change' så t.ex. oak-analytics kan reagera.
   - Öppna inställningar igen: länk/knapp med [data-oak-consent-open].
   ============================================================= */
(function () {
  "use strict";
  var KEY = "oak-consent";
  var CATS = ["statistik", "marknadsforing"]; // nödvändiga är alltid true

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { return null; }
  }
  function write(state) {
    state.ts = new Date().toISOString();
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
    apply(state);
    document.dispatchEvent(new CustomEvent("oak-consent-change", { detail: state }));
  }

  var current = read() || { statistik: false, marknadsforing: false };

  window.OakConsent = {
    allows: function (cat) { return cat === "nodvandig" ? true : !!current[cat]; },
    get: function () { return current; },
    open: function () { openBanner(true); }
  };

  // Aktivera gate:ade skript för samtyckta kategorier
  function apply(state) {
    current = state;
    document.querySelectorAll('script[type="text/plain"][data-consent]').forEach(function (node) {
      var cat = node.getAttribute("data-consent");
      if (!state[cat] || node.dataset.oakActivated) return;
      var s = document.createElement("script");
      if (node.dataset.src) s.src = node.dataset.src; else s.textContent = node.textContent;
      Array.prototype.forEach.call(node.attributes, function (a) {
        if (["type", "data-consent", "data-src"].indexOf(a.name) === -1) s.setAttribute(a.name, a.value);
      });
      node.dataset.oakActivated = "1";
      node.parentNode.insertBefore(s, node.nextSibling);
    });
  }

  // ---- Banner-UI ----
  var el;
  function openBanner(preferences) {
    if (el) el.remove();
    el = document.createElement("div");
    el.className = "oak-consent" + (preferences ? " oak-consent--prefs" : "");
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "false");
    el.setAttribute("aria-label", "Cookie-inställningar");
    el.innerHTML =
      '<div class="oak-consent__card">' +
        '<h2 class="oak-consent__title">Vi värnar om din integritet</h2>' +
        '<p class="oak-consent__text">Vi använder nödvändiga cookies för att sajten ska fungera. Med ditt samtycke använder vi även statistik för att förstå hur sajten används. Du kan ändra dig när som helst.</p>' +
        '<div class="oak-consent__prefs">' +
          row("nodvandig", "Nödvändiga", "Krävs för att sajten ska fungera.", true, true) +
          row("statistik", "Statistik", "Anonym besöksmätning så vi kan förbättra sajten.", current.statistik, false) +
          row("marknadsforing", "Marknadsföring", "Innehåll och annonser anpassade efter dig.", current.marknadsforing, false) +
        '</div>' +
        '<div class="oak-consent__actions">' +
          '<button type="button" class="btn btn--ghost" data-act="necessary">Endast nödvändiga</button>' +
          '<button type="button" class="btn btn--ghost" data-act="save">Spara val</button>' +
          '<button type="button" class="btn btn--primary" data-act="all">Acceptera alla</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(el);

    el.addEventListener("click", function (e) {
      var act = e.target.getAttribute && e.target.getAttribute("data-act");
      if (!act) return;
      if (act === "all") write({ statistik: true, marknadsforing: true });
      else if (act === "necessary") write({ statistik: false, marknadsforing: false });
      else if (act === "save") {
        var s = {};
        CATS.forEach(function (c) { var i = el.querySelector('input[value="' + c + '"]'); s[c] = !!(i && i.checked); });
        write(s);
      }
      close();
    });
    var first = el.querySelector("button, input:not([disabled])");
    if (first) first.focus();
  }
  function row(val, name, desc, checked, disabled) {
    return '<label class="oak-consent__row">' +
      '<input type="checkbox" value="' + val + '"' + (checked ? " checked" : "") + (disabled ? " disabled" : "") + ' />' +
      '<span><strong>' + name + '</strong><span>' + desc + '</span></span></label>';
  }
  function close() { if (el) { el.remove(); el = null; } }

  // Öppna-igen-länkar
  document.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest("[data-oak-consent-open]");
    if (t) { e.preventDefault(); openBanner(true); }
  });

  // Init: applicera sparat val, visa banner om inget val gjorts
  if (read()) apply(current); else openBanner(false);
})();
