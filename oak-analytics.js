/* OakStride besöksmätning + cookie-samtycke.
   Kategoribaserat samtycke (Cookietractor-stil), men bara OakStrides egna cookies:
   - Nödvändiga: krävs för sajten (kan ej väljas bort).
   - Statistik:  en (1) förstaparts-cookie oak_vid (12 mån) för unika besökare.
   - Marknadsföring: används EJ — inga annons- eller tredjepartscookies förekommer.
   Utan statistik-samtycke sker anonym sidmätning (ingen cookie, ingen identifierare).
   Ingen data delas med tredje part. Detaljer: /integritet */
(function () {
  "use strict";
  var KEY = "oak_consent_v2";
  var POLICY_VERSION = "1.1-2026-07-17";
  var BASE = "https://wtekqlkkcomtgizjtqeo.supabase.co/rest/v1/";
  var API = BASE + "page_views";
  var APIKEY = "sb_publishable_khYg7LIrHxnUNoADAkCWSA_lzmI8UYJ";

  function post(url, body) {
    try {
      fetch(url, {
        method: "POST", keepalive: true,
        headers: { apikey: APIKEY, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify(body)
      }).catch(function () {});
    } catch (e) {}
  }
  function logConsent(vid) { post(BASE + "consents", { vid: vid, policy_version: POLICY_VERSION }); }
  function send(vid) {
    post(API, { site: "oakstride.se", path: location.pathname, referrer: document.referrer || null, vid: vid || null });
  }
  function getCookie(name) { var m = document.cookie.match("(?:^|; )" + name + "=([^;]*)"); return m ? m[1] : null; }
  function ensureVid() {
    var v = getCookie("oak_vid");
    if (!v) {
      v = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Math.random()).slice(2) + "-" + Date.now();
      document.cookie = "oak_vid=" + v + "; max-age=31536000; path=/; SameSite=Lax; Secure";
    }
    return v;
  }
  function clearVid() { document.cookie = "oak_vid=; max-age=0; path=/; SameSite=Lax; Secure"; }

  function readConsent() { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } }
  function applyAnalytics(c) { if (c && c.statistics) { send(ensureVid()); } else { clearVid(); send(null); } }
  function saveConsent(stats) {
    var c = { v: 2, statistics: !!stats, marketing: false, policy: POLICY_VERSION, at: new Date().toISOString() };
    try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) {}
    if (stats) logConsent(ensureVid());
    applyAnalytics(c);
    var el = document.getElementById("oak-cc"); if (el) el.remove();
  }

  // Global så integritetssidan kan öppna inställningar / återkalla samtycke.
  window.oakConsent = {
    status: function () { var c = readConsent(); return c ? (c.statistics ? "yes" : "no") : null; },
    grant: function () { saveConsent(true); },
    revoke: function () { saveConsent(false); },
    openSettings: function () { showBanner(true); }
  };

  var consent = readConsent();
  applyAnalytics(consent);           // anonym mätning direkt; cookie bara vid statistik-samtycke
  if (!consent) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { showBanner(false); });
    else showBanner(false);
  }

  function showBanner(openPrefs) {
    var existing = document.getElementById("oak-cc");
    if (existing) existing.remove();
    if (!document.getElementById("oak-cc-style")) {
      var css = document.createElement("style");
      css.id = "oak-cc-style";
      css.textContent =
        "#oak-cc{position:fixed;left:16px;right:16px;bottom:16px;z-index:99999;font-family:'IBM Plex Sans',system-ui,sans-serif}" +
        "#oak-cc .oak-cc-card{max-width:560px;margin:0 auto;background:#f5f7f6;color:#21261f;border:1px solid #d8dcd2;" +
        "border-radius:12px;box-shadow:0 16px 48px rgba(30,58,47,.28);padding:20px 22px}" +
        "#oak-cc h2{font-family:'Bricolage Grotesque',sans-serif;font-size:1.15rem;color:#1e3a2f;margin:0 0 8px}" +
        "#oak-cc p{margin:0 0 14px;font-size:.92rem;line-height:1.55}" +
        "#oak-cc a{color:#2f6486}" +
        "#oak-cc .oak-cc-row{display:flex;gap:10px;flex-wrap:wrap}" +
        "#oak-cc button{font-family:inherit;font-weight:600;font-size:.9rem;padding:10px 18px;border-radius:8px;cursor:pointer;border:1px solid #d8dcd2}" +
        "#oak-cc .oak-cc-primary{background:#1e3a2f;color:#f5f7f6;border-color:#1e3a2f}" +
        "#oak-cc .oak-cc-secondary{background:#fff;color:#1e3a2f}" +
        "#oak-cc .oak-cc-prefs{margin:0 0 14px;border-top:1px solid #d8dcd2}" +
        "#oak-cc .oak-cc-cat{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;" +
        "padding:12px 0;border-bottom:1px solid #e4e7e2}" +
        "#oak-cc .oak-cc-cat small{color:#5b635a}" +
        "#oak-cc .oak-cc-cat input{width:18px;height:18px;margin-top:2px;flex:none;accent-color:#1e3a2f}";
      document.head.appendChild(css);
    }
    var c = readConsent();
    var statChecked = c ? (c.statistics ? " checked" : "") : "";
    var el = document.createElement("div");
    el.id = "oak-cc";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-label", "Cookie-inställningar");
    el.innerHTML =
      '<div class="oak-cc-card">' +
      "<h2>Vi använder cookies</h2>" +
      "<p>Vi använder cookies för att webbplatsen ska fungera och för att förstå hur den används. " +
      "Du väljer själv vad du godkänner. Läs mer i vår <a href=\"/integritet\">integritets- och cookiepolicy</a>.</p>" +
      '<div class="oak-cc-prefs"' + (openPrefs ? "" : " hidden") + ">" +
      '<div class="oak-cc-cat"><span><strong>Nödvändiga</strong><br><small>Krävs för att webbplatsen ska fungera. Kan inte stängas av.</small></span><input type="checkbox" checked disabled></div>' +
      '<div class="oak-cc-cat"><span><strong>Statistik</strong><br><small>En förstaparts-cookie (oak_vid) för att räkna unika besökare. Ingen tredjepart, inga annonser.</small></span><input type="checkbox" id="oak-cc-stat"' + statChecked + "></div>" +
      '<div class="oak-cc-cat"><span><strong>Marknadsföring</strong><br><small>Vi använder inga marknadsförings- eller annonscookies.</small></span><input type="checkbox" disabled></div>' +
      "</div>" +
      '<div class="oak-cc-row" data-role="main"' + (openPrefs ? " hidden" : "") + ">" +
      '<button class="oak-cc-secondary" data-act="necessary">Endast nödvändiga</button>' +
      '<button class="oak-cc-secondary" data-act="customize">Anpassa</button>' +
      '<button class="oak-cc-primary" data-act="all">Godkänn alla</button>' +
      "</div>" +
      '<div class="oak-cc-row" data-role="save"' + (openPrefs ? "" : " hidden") + ">" +
      '<button class="oak-cc-secondary" data-act="necessary">Endast nödvändiga</button>' +
      '<button class="oak-cc-primary" data-act="save">Spara inställningar</button>' +
      "</div>" +
      "</div>";

    el.addEventListener("click", function (e) {
      var act = e.target && e.target.getAttribute && e.target.getAttribute("data-act");
      if (!act) return;
      if (act === "all") saveConsent(true);
      else if (act === "necessary") saveConsent(false);
      else if (act === "save") saveConsent(!!document.getElementById("oak-cc-stat").checked);
      else if (act === "customize") {
        el.querySelector(".oak-cc-prefs").hidden = false;
        el.querySelector('[data-role="main"]').hidden = true;
        el.querySelector('[data-role="save"]').hidden = false;
      }
    });
    document.body.appendChild(el);
  }
})();
