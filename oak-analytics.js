/* OakStride besöksmätning + cookie-samtycke.
   Kategoribaserat samtycke, tre kategorier:
   - Nödvändiga:     krävs för sajten (kan ej väljas bort).
   - Statistik:      en (1) förstaparts-cookie oak_vid (12 mån) för unika besökare.
   - Marknadsföring: annonsskript (Google Ads) — laddas ENDAST vid aktivt samtycke.
   Utan statistik-samtycke sker anonym sidmätning (ingen cookie, ingen identifierare).
   Detaljer: /integritet

   ── ÄNDRAT 2026-08-29 (policy 1.2) ────────────────────────────────────────────────
   Marknadsföringskategorin var tidigare hårdkodad av (`disabled`, alltid false) och
   filen saknade helt mekanism för att grinda externa skript. Fredriks beslut
   2026-08-29 (kort k-20260828-45): "Ändra integritetstexten och bygg
   samtyckesgrinden — jag vill köra Ads".

   🔴 GRINDEN BYGGS FÖRE TAGGEN, ALDRIG TVÄRTOM. Ett annonsskript som ligger på sidan
   innan grinden finns är exakt det policyn lovar att inte göra.

   🔴 POLICYBYTET OGILTIGFÖRKLARAR GAMLA SAMTYCKEN — MED FLIT, SE bumpat POLICY_VERSION.
   Den som klickade "Godkänn alla" den 20 juli sa ja till en policy vars text
   uttryckligen lovade att inga annons- eller tredjepartscookies förekom. Det
   samtycket kan inte bära en annonstagg. Ett sparat val från en ÄLDRE policyversion
   behandlas därför som inget val alls: bannern visas igen och marknadsföring är av
   tills personen aktivt säger ja. Att låta ett gammalt ja tysta den nya frågan vore
   att hämta samtycke för något annat än det som faktiskt sker. */
(function () {
  "use strict";
  var KEY = "oak_consent_v2";
  // Bumpas VARJE gång policyns innebörd ändras - det är den som avgör omfrågningen nedan.
  var POLICY_VERSION = "1.2-2026-08-29";

  // ── Google Ads konverterings-ID ────────────────────────────────────────────────
  // TOMT = ingenting laddas, oavsett vad besökaren samtyckt till. Grinden är alltså
  // byggd och provad medan taggen ligger still, vilket är hela poängen med ordningen:
  // grind före tagg.
  //
  // 👤 FREDRIK FYLLER I DEN HÄR RADEN. Värdet ser ut som "AW-1234567890" och hämtas i
  //    Google Ads under Verktyg → Datahantering → Google-tagg. Det är ingen hemlighet -
  //    ett konverterings-ID är publikt i sidans källkod hos alla som annonserar - så det
  //    hör hemma i koden och inte i en secret.
  //
  // ⚠️ ETT STÄLLE, INTE SJU. Taggen läggs INTE i sidornas HTML. Hade den legat där hade
  //    den behövt upprepas på sju sidor, och en glömd sida hade betytt antingen utebliven
  //    mätning eller - värre - ett annonsskript utanför grinden.
  var ADS_ID = "";
  var BASE = "https://wtekqlkkcomtgizjtqeo.supabase.co/rest/v1/";
  var API = BASE + "page_views";
  var APIKEY = "sb_publishable_khYg7LIrHxnUNoADAkCWSA_lzmI8UYJ";

  // `vad` namnger anropet i felmeddelandet. `kritisk` styr hur hogt vi skriker.
  //
  // 🔴 fetch AVVISAR BARA VID NATVERKSFEL - inte vid HTTP 4xx/5xx. Utan kontrollen av
  //    response.ok nedan ser en RLS-avvisning, en roterad nyckel, en borttagen tabell
  //    och ett brutet CHECK-villkor EXAKT likadana ut som en lyckad insert. Det spelade
  //    mindre roll for sidvisningar; det ar oacceptabelt for samtyckesloggen, som ar
  //    vart enda BEVIS pa vad en besokare godkant. "Noll rader den veckan" hade da
  //    kunnat betyda antingen noll samtycken eller ett brutet ror - och ingenting i
  //    utdatan hade skilt dem at. Tystnadsgranskningens fynd, 2026-08-29.
  function post(url, body, vad, kritisk) {
    try {
      fetch(url, {
        method: "POST", keepalive: true,
        headers: { apikey: APIKEY, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify(body)
      }).then(function (r) {
        if (!r || r.ok) return;
        larm(vad + ": HTTP " + r.status, kritisk);
      }).catch(function (e) {
        larm(vad + ": " + (e && e.message ? e.message : "natverksfel"), kritisk);
      });
    } catch (e) {
      larm(vad + ": " + (e && e.message ? e.message : "kunde inte skicka"), kritisk);
    }
  }

  // Vi har ingen felkanal pa en statisk sajt - inget Sentry, ingen server att larma till.
  // Konsolen ar darfor vad som finns, och det ar en riktig forbattring mot ingenting:
  // ett fel gar nu att SE. For samtyckesloggen skrivs dessutom ett spar i localStorage,
  // sa att det gar att fraga en drabbad besokare vad som hande - och sa att en framtida
  // kontroll kan lasa det utan att vara pa plats i ratt sekund.
  function larm(text, kritisk) {
    try {
      if (kritisk) {
        console.error("[oak] " + text);
        try { localStorage.setItem("oak_consent_fel", new Date().toISOString() + " " + text); } catch (e) {}
      } else {
        console.warn("[oak] " + text);
      }
    } catch (e) {}
  }

  // Samtyckesloggen ar kritisk: den ar beviset. Sidvisningar ar det inte.
  function logConsent(vid) {
    post(BASE + "consents", { vid: vid, policy_version: POLICY_VERSION }, "samtyckesloggen", true);
  }
  function send(vid) {
    post(API, { site: "oakstride.se", path: location.pathname, referrer: document.referrer || null, vid: vid || null }, "sidvisning", false);
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

  // Ett sparat val galler BARA den policy det lamnades under. Aldre version = inget val.
  // Det ar har omfragningen sker; se det roda blocket i filhuvudet for skalet.
  function currentConsent() {
    var c = readConsent();
    if (!c) return null;
    if (c.policy !== POLICY_VERSION) return null;
    return c;
  }

  // ── Google Consent Mode v2 ──────────────────────────────────────────────────────
  // Maste finnas INNAN nagon Google-tagg laddas, annars antar taggen sina egna
  // standardvarden. Vi satter allt till 'denied' som utgangslage och uppdaterar forst
  // nar besokaren aktivt sagt ja. Kon (window.dataLayer) fungerar aven om ingen
  // Google-tagg nagonsin laddas - da ligger anropen bara kvar i en array.
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  gtag("consent", "default", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "denied",
    wait_for_update: 500
  });
  function updateConsentMode(c) {
    var mk = c && c.marketing ? "granted" : "denied";
    gtag("consent", "update", {
      ad_storage: mk,
      ad_user_data: mk,
      ad_personalization: mk,
      analytics_storage: c && c.statistics ? "granted" : "denied"
    });
  }

  // ── Skript-grindning ────────────────────────────────────────────────────────────
  // Ett annonsskript laggs pa sidan som en INERT platshallare:
  //   <script type="text/plain" data-consent="marketing" data-src="..."></script>
  // Webblasaren kor aldrig type="text/plain". Vid samtycke klonas noden till ett
  // riktigt <script> som da laddas. Formen ar hamtad ur oak-consent.js, som redan
  // anvands pa kundsajterna - samma monster pa bada hallen.
  //
  // ⚠️ ENVAGS, OCH DET AR EN EGENSKAP INTE EN BRIST: ett laddat skript kan inte
  // avladdas. Darfor laddar aterkallelse om sidan (se saveConsent), sa att ett nej
  // faktiskt betyder att inget annonsskript kor - inte bara att vi slutat be om mer.
  function activateScripts(cat) {
    var noder = document.querySelectorAll('script[type="text/plain"][data-consent="' + cat + '"]');
    for (var i = 0; i < noder.length; i++) {
      var gammal = noder[i];
      if (gammal.getAttribute("data-oak-aktiverad")) continue;
      var ny = document.createElement("script");
      for (var j = 0; j < gammal.attributes.length; j++) {
        var a = gammal.attributes[j];
        if (a.name === "type" || a.name === "data-src" || a.name === "data-consent") continue;
        ny.setAttribute(a.name, a.value);
      }
      var src = gammal.getAttribute("data-src");
      if (src) ny.src = src; else ny.text = gammal.textContent;
      gammal.setAttribute("data-oak-aktiverad", "1");
      ny.setAttribute("data-oak-aktiverad", "1");
      gammal.parentNode.insertBefore(ny, gammal.nextSibling);
    }
  }

  function applyAnalytics(c) { if (c && c.statistics) { send(ensureVid()); } else { clearVid(); send(null); } }

  var adsLaddad = false;
  function loadAds() {
    if (adsLaddad || !ADS_ID) return;   // tomt ID = inert, se blocket vid ADS_ID
    adsLaddad = true;
    var sc = document.createElement("script");
    sc.async = true;
    sc.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(ADS_ID);
    document.head.appendChild(sc);
    // gtag skriver till samma window.dataLayer som Consent Mode-anropen ovan la sina
    // varden i. Kon lastes alltsa fore taggen och las i ratt ordning nar den kommer -
    // 'default: denied' ligger forst, sa taggen ser aldrig ett odefinierat lage.
    gtag("js", new Date());
    gtag("config", ADS_ID);
  }

  function applyMarketing(c) {
    updateConsentMode(c);
    if (c && c.marketing) { activateScripts("marketing"); loadAds(); }
  }

  function saveConsent(stats, mark) {
    var fore = currentConsent();
    var badeAv = fore && fore.marketing && !mark;   // aktivt aterkallad marknadsforing
    var c = { v: 2, statistics: !!stats, marketing: !!mark, policy: POLICY_VERSION, at: new Date().toISOString() };
    try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) {}
    // Samtyckesloggen ar vart BEVIS pa vad som godkandes och under vilken policy.
    // Den skrivs sa fort NAGON kategori sagts ja till - tidigare bara vid statistik,
    // vilket hade lamnat ett marknadsforings-ja obokfort. Det ar just det ja som ar
    // kansligast att kunna visa i efterhand.
    if (stats || mark) logConsent(ensureVid());
    applyAnalytics(c);
    applyMarketing(c);
    var el = document.getElementById("oak-cc"); if (el) el.remove();
    // Se envags-noteringen ovan: ett laddat annonsskript gar inte att ta bort.
    if (badeAv) location.reload();
  }

  // Global sa integritetssidan kan oppna installningar / aterkalla samtycke.
  // status() svarar pa STATISTIK av bakatkompatibilitet - integritet.html anropar den.
  // Anvand categories() for hela bilden.
  window.oakConsent = {
    status: function () { var c = currentConsent(); return c ? (c.statistics ? "yes" : "no") : null; },
    categories: function () {
      var c = currentConsent();
      return c ? { statistics: !!c.statistics, marketing: !!c.marketing, policy: c.policy } : null;
    },
    grant: function () { saveConsent(true, true); },
    revoke: function () { saveConsent(false, false); },
    openSettings: function () { showBanner(true); }
  };

  var consent = currentConsent();
  applyAnalytics(consent);           // anonym matning direkt; cookie bara vid statistik-samtycke
  applyMarketing(consent);           // satter Consent Mode; laddar tagg bara vid ja
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
        "#oak-cc [hidden]{display:none!important}" +
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
    // currentConsent, inte readConsent: efter ett policybyte ska rutorna sta OKRYSSADE
    // aven om ett gammalt val ligger kvar i localStorage. Annars visas ett ja som inte
    // langre galler, och personen kan trycka "Spara" pa nagot han aldrig sagt om den
    // nya policyn.
    var c = currentConsent();
    var statChecked = c && c.statistics ? " checked" : "";
    var markChecked = c && c.marketing ? " checked" : "";
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
      '<div class="oak-cc-cat"><span><strong>Statistik</strong><br><small>En förstaparts-cookie (oak_vid) för att räkna unika besökare. Stannar hos oss — ingen tredjepart.</small></span><input type="checkbox" id="oak-cc-stat"' + statChecked + "></div>" +
      '<div class="oak-cc-cat"><span><strong>Marknadsföring</strong><br><small>Cookies från Google Ads, så vi kan mäta vilka annonser som leder till en förfrågan. Laddas bara om du säger ja.</small></span><input type="checkbox" id="oak-cc-mark"' + markChecked + "></div>" +
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
      if (act === "all") saveConsent(true, true);
      else if (act === "necessary") saveConsent(false, false);
      else if (act === "save") saveConsent(
        !!document.getElementById("oak-cc-stat").checked,
        !!document.getElementById("oak-cc-mark").checked
      );
      else if (act === "customize") {
        el.querySelector(".oak-cc-prefs").hidden = false;
        el.querySelector('[data-role="main"]').hidden = true;
        el.querySelector('[data-role="save"]').hidden = false;
      }
    });
    document.body.appendChild(el);
  }
})();
