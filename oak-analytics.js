/* OakStride besöksmätning.
   Utan samtycke: anonym sidvisning (inga cookies, ingen identifierare).
   Med samtycke: förstaparts-cookie oak_vid (12 mån) för unika besökare.
   Ingen data delas med tredje part. Detaljer: /integritet */
(function () {
  "use strict";
  var KEY = "oak_consent";
  var POLICY_VERSION = "1.1-2026-07-17";
  var BASE = "https://wtekqlkkcomtgizjtqeo.supabase.co/rest/v1/";
  var API = BASE + "page_views";
  var APIKEY = "sb_publishable_khYg7LIrHxnUNoADAkCWSA_lzmI8UYJ";

  function logConsent(vid) {
    try {
      fetch(BASE + "consents", {
        method: "POST",
        keepalive: true,
        headers: { apikey: APIKEY, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ vid: vid, policy_version: POLICY_VERSION })
      }).catch(function () {});
    } catch (e) {}
  }

  function send(vid) {
    try {
      fetch(API, {
        method: "POST",
        keepalive: true,
        headers: { apikey: APIKEY, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({
          site: "oakstride.se",
          path: location.pathname,
          referrer: document.referrer || null,
          vid: vid || null
        })
      }).catch(function () {});
    } catch (e) {}
  }

  function getCookie(name) {
    var m = document.cookie.match("(?:^|; )" + name + "=([^;]*)");
    return m ? m[1] : null;
  }

  function ensureVid() {
    var v = getCookie("oak_vid");
    if (!v) {
      v = (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
        : String(Math.random()).slice(2) + "-" + Date.now();
      document.cookie = "oak_vid=" + v + "; max-age=31536000; path=/; SameSite=Lax; Secure";
    }
    return v;
  }

  function clearVid() {
    document.cookie = "oak_vid=; max-age=0; path=/; SameSite=Lax; Secure";
  }

  // Global så integritetssidan kan återkalla samtycke
  window.oakConsent = {
    revoke: function () { localStorage.setItem(KEY, "no"); localStorage.removeItem(KEY + "_meta"); clearVid(); },
    grant: function () {
      localStorage.setItem(KEY, "yes");
      localStorage.setItem(KEY + "_meta", JSON.stringify({ policy: POLICY_VERSION, at: new Date().toISOString() }));
      logConsent(ensureVid());
    },
    status: function () { return localStorage.getItem(KEY); }
  };

  var consent = null;
  try { consent = localStorage.getItem(KEY); } catch (e) {}

  if (consent === "yes") { send(ensureVid()); return; }
  send(null); // anonym mätning kräver inget samtycke

  if (consent === "no" || location.pathname.indexOf("integritet") !== -1) return;

  function showBanner() {
    var css = document.createElement("style");
    css.textContent =
      "#oak-cb{position:fixed;left:16px;right:16px;bottom:16px;z-index:9999;max-width:560px;margin:0 auto;" +
      "background:#f5f7f6;color:#21261f;border:1px solid #d8dcd2;border-radius:10px;" +
      "box-shadow:0 12px 40px rgba(30,58,47,.25);padding:18px 20px;font-family:'IBM Plex Sans',sans-serif;font-size:.92rem;line-height:1.5}" +
      "#oak-cb p{margin:0 0 12px}" +
      "#oak-cb a{color:#2f6486}" +
      "#oak-cb .row{display:flex;gap:10px;flex-wrap:wrap}" +
      "#oak-cb button{font-family:inherit;font-weight:600;font-size:.9rem;padding:9px 18px;border-radius:6px;cursor:pointer}" +
      "#oak-cb .yes{background:#1e3a2f;color:#f5f7f6;border:1px solid #1e3a2f}" +
      "#oak-cb .no{background:transparent;color:#1e3a2f;border:1px solid #d8dcd2}";
    document.head.appendChild(css);

    var el = document.createElement("div");
    el.id = "oak-cb";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-label", "Cookies");
    el.innerHTML =
      "<p><strong>En kaka?</strong> Vi vill gärna använda en (1) egen cookie för att förstå hur många som besöker oss. " +
      "Inga annonser, ingen delning med tredje part. Genom att trycka <em>Det går bra</em> godkänner du cookien och vår " +
      "<a href=\"/integritet\">integritetspolicy</a>.</p>" +
      "<div class=\"row\"><button class=\"yes\">Det går bra</button><button class=\"no\">Nej tack</button></div>";

    el.querySelector(".yes").addEventListener("click", function () {
      window.oakConsent.grant();
      el.remove();
    });
    el.querySelector(".no").addEventListener("click", function () {
      localStorage.setItem(KEY, "no");
      el.remove();
    });
    document.body.appendChild(el);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", showBanner);
  } else {
    showBanner();
  }
})();
