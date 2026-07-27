/* =============================================================
   oak-analytics.js  –  OakStride Studio besöksmätning
   -------------------------------------------------------------
   STÅENDE REGEL: denna fil ska ligga på ALLA OakStride-sajter så
   att trafiken syns i kundportalen.

   - Cookiefri och anonym: postar sidvisning (site, path, referrer)
     till portalens page_views-tabell (Supabase REST + publik anon-nyckel).
     Inget lagras i webbläsaren, ingen PII, inget vid → inget samtycke krävs.
   - Respekterar Do Not Track.
   - Fungerar för statiska sajter OCH SPA:er (history).

   Inbäddning:
     <script src="/oak-analytics.js" data-site="KUND-DOMÄN" defer></script>
   (data-site bör vara kundens domän, t.ex. "nordvikbygg.se", så att det
    matchar profiles.website och statistiken syns för rätt kund.)
   ============================================================= */
(function () {
  "use strict";

  // Publika värden (anon-nyckeln är avsedd att vara publik; skyddet ligger i RLS).
  var SUPABASE_URL = "https://wtekqlkkcomtgizjtqeo.supabase.co";
  var ANON = "sb_publishable_khYg7LIrHxnUNoADAkCWSA_lzmI8UYJ";
  var ENDPOINT = SUPABASE_URL + "/rest/v1/page_views";

  if (navigator.doNotTrack === "1" || window.doNotTrack === "1") return;

  var script = document.currentScript;
  var site = (script && script.getAttribute("data-site")) || location.hostname;
  var started = false;

  function send() {
    var body = JSON.stringify({
      site: site,
      path: location.pathname || "/",
      referrer: document.referrer ? document.referrer : null
    });
    try {
      fetch(ENDPOINT, {
        method: "POST",
        keepalive: true,
        headers: {
          "Content-Type": "application/json",
          "apikey": ANON,
          "Authorization": "Bearer " + ANON,
          "Prefer": "return=minimal"
        },
        body: body
      });
    } catch (e) { /* mätning får aldrig störa sajten */ }
  }

  function start() {
    if (started) return; started = true;
    send();
    var push = history.pushState;
    history.pushState = function () { push.apply(this, arguments); send(); };
    window.addEventListener("popstate", send);
  }

  start();
})();
