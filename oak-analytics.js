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
  //
  // 🔴 ANROPA ALDRIG DEN HAR MED ensureVid() RAKT AV. `ensureVid` SATTER cookien som
  //    sidoeffekt (se dess kropp). Ett tag stod har `if (stats || mark) logConsent(ensureVid())`,
  //    vilket betydde att en besokare som sa NEJ till statistik men JA till marknadsforing
  //    anda fick `oak_vid` skriven med 12 manaders livslangd, och fick sin identifierare
  //    sparad hos oss - efter ett uttryckligt nej till just den kategorin. Cookien raderades
  //    en rad senare av applyAnalytics, men id:t var da redan skickat och lagrat.
  //    Granskningsfynd B1, 2026-08-29. Uppmatt, inte teoretiskt.
  //
  // Darfor: `loggId` skapar ett ENGANGS-id nar ingen statistikcookie far finnas. Det
  // lagras ingenstans - varken som cookie eller i localStorage - och finns bara i den
  // rad som bevisar att samtycke inhamtades. Vi kan alltsa visa ATT ett samtycke gavs,
  // vid vilken tid och under vilken policy, utan att skapa en identifierare for nagon
  // som bett oss lata bli. `consents.vid` ar NOT NULL, sa faltet maste ha ett varde.
  function loggId(harStatistikJa) {
    if (harStatistikJa) return ensureVid();          // cookien ar redan godkand
    return nyttId();                                  // engangs, satts aldrig som cookie
  }
  function logConsent(vid) {
    post(BASE + "consents", { vid: vid, policy_version: POLICY_VERSION }, "samtyckesloggen", true);
  }
  function send(vid) {
    post(API, { site: "oakstride.se", path: location.pathname, referrer: document.referrer || null, vid: vid || null }, "sidvisning", false);
  }
  function getCookie(name) { var m = document.cookie.match("(?:^|; )" + name + "=([^;]*)"); return m ? m[1] : null; }
  function nyttId() {
    return (window.crypto && window.crypto.randomUUID)
      ? window.crypto.randomUUID()
      : String(Math.random()).slice(2) + "-" + Date.now();
  }
  // ⚠️ SATTER COOKIEN. Anropa bara nar statistik-samtycke faktiskt finns.
  function ensureVid() {
    var v = getCookie("oak_vid");
    if (!v) {
      v = nyttId();
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
    // Granskningsfynd F4: den har byggde forst pa `currentConsent()`, alltsa pa vad som
    // ligger i localStorage. Kastar `setItem` (privat lage, blockerad lagring, vissa
    // webviews) sparas ingenting, och ett ja foljt av ett nej gav da INGEN omladdning -
    // trots att skriptet faktiskt laddats och fortsatte kora. `adsLaddad` speglar det
    // verkliga laget i den har sidvisningen och ar darfor det ratta mattet.
    var badeAv = adsLaddad && !mark;
    var c = { v: 2, statistics: !!stats, marketing: !!mark, policy: POLICY_VERSION, at: new Date().toISOString() };
    try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) {}
    // Samtyckesloggen ar vart BEVIS pa vad som godkandes och under vilken policy.
    // Den skrivs sa fort NAGON kategori sagts ja till - tidigare bara vid statistik,
    // vilket hade lamnat ett marknadsforings-ja obokfort. Det ar just det ja som ar
    // kansligast att kunna visa i efterhand.
    if (stats || mark) logConsent(loggId(!!stats));
    applyAnalytics(c);
    applyMarketing(c);
    var el = document.getElementById("oak-cc"); if (el) el.remove();
    // Se envags-noteringen ovan: ett laddat annonsskript gar inte att ta bort.
    if (badeAv) location.reload();
  }

  // Global sa integritetssidan kan oppna installningar / aterkalla samtycke.
  //
  // ⚠️ `grant()` betyder sedan 2026-08-29 "ja till ALLT inklusive annonser"; tidigare
  //    bara "ja till statistik". Ingen anropare finns i repot i dag, men det ar ett
  //    publikt API pa en live-sajt vars innebord andrats - star har sa att nasta lasare
  //    inte antar den gamla.
  // ⚠️ `status()` svarar bara pa STATISTIK, av bakatkompatibilitet. Har ingen anropare
  //    i repot (rattat pastaende: en tidigare kommentar sa att integritet.html anropar
  //    den - den anropar bara revoke() och openSettings()). Anvand `categories()`.
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

  // ── Sprak i samtyckesrutan ──────────────────────────────────────────────────────
  // Granskningsfynd B2, 2026-08-29: rutan var hardkodat svensk och lankade alltid till
  // /integritet - aven pa index.html, studio.html, it-management.html och privacy.html,
  // som alla ar lang="en". En engelsksprakig besokare fran en Ads-annons fick alltsa en
  // svensk dialog som bad henne godkanna annonscookies, med "las mer" till en svensk
  // policy - trots att en engelsk fanns publicerad. Ett samtycke ska vara informerat,
  // och det ar HAR samtycket inhamtas. Staende regel 2 galler sidorna; i sak ar detta
  // samma fel en niva ner.
  //
  // Sproket lases ur <html lang>. Svenska ar reserv: sajtens svenska sidor ar
  // huvudmalgruppen, och en felaktigt svensk ruta ar mindre fel an en tom.
  var TEXT = {
    sv: {
      rubrik: "Vi anv\u00e4nder cookies",
      brod: "Vi anv\u00e4nder cookies f\u00f6r att webbplatsen ska fungera och f\u00f6r att f\u00f6rst\u00e5 hur den anv\u00e4nds. Du v\u00e4ljer sj\u00e4lv vad du godk\u00e4nner. L\u00e4s mer i v\u00e5r ",
      policy: "integritets- och cookiepolicy",
      policyUrl: "/integritet",
      nodvandigT: "N\u00f6dv\u00e4ndiga",
      nodvandigB: "Kr\u00e4vs f\u00f6r att webbplatsen ska fungera. Kan inte st\u00e4ngas av.",
      statistikT: "Statistik",
      statistikB: "En f\u00f6rstaparts-cookie (oak_vid) f\u00f6r att r\u00e4kna unika bes\u00f6kare. Stannar hos oss \u2014 ingen tredjepart.",
      marknadT: "Marknadsf\u00f6ring",
      marknadB: "Cookies fr\u00e5n Google Ads, s\u00e5 vi kan m\u00e4ta vilka annonser som leder till en f\u00f6rfr\u00e5gan. Laddas bara om du s\u00e4ger ja.",
      endast: "Endast n\u00f6dv\u00e4ndiga",
      anpassa: "Anpassa",
      alla: "Godk\u00e4nn alla",
      spara: "Spara inst\u00e4llningar",
      aria: "Cookie-inst\u00e4llningar"
    },
    en: {
      rubrik: "We use cookies",
      brod: "We use cookies to make the site work and to understand how it is used. You choose what you accept. Read more in our ",
      policy: "privacy and cookie policy",
      policyUrl: "/privacy",
      nodvandigT: "Necessary",
      nodvandigB: "Required for the site to work. Cannot be switched off.",
      statistikT: "Statistics",
      statistikB: "One first-party cookie (oak_vid) to count unique visitors. Stays with us \u2014 no third party.",
      marknadT: "Marketing",
      marknadB: "Cookies from Google Ads, so we can measure which ads lead to an enquiry. Loaded only if you accept.",
      endast: "Necessary only",
      anpassa: "Customise",
      alla: "Accept all",
      spara: "Save settings",
      aria: "Cookie settings"
    }
  };
  function txt() {
    var l = (document.documentElement.getAttribute("lang") || "sv").toLowerCase();
    return l.indexOf("en") === 0 ? TEXT.en : TEXT.sv;
  }

  var consent = currentConsent();
  applyAnalytics(consent);           // anonym matning direkt; cookie bara vid statistik-samtycke
  applyMarketing(consent);           // satter Consent Mode; laddar tagg bara vid ja
  if (!consent) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { showBanner(false); });
    else showBanner(false);
  }

  function showBanner(openPrefs) {
    var t = txt();
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
    el.setAttribute("aria-label", t.aria);
    el.innerHTML =
      '<div class="oak-cc-card">' +
      "<h2>" + t.rubrik + "</h2>" +
      "<p>" + t.brod +
      '<a href="' + t.policyUrl + '">' + t.policy + "</a>.</p>" +
      '<div class="oak-cc-prefs"' + (openPrefs ? "" : " hidden") + ">" +
      '<div class="oak-cc-cat"><span><strong>' + t.nodvandigT + '</strong><br><small>' + t.nodvandigB + '</small></span><input type="checkbox" checked disabled></div>' +
      '<div class="oak-cc-cat"><span><strong>' + t.statistikT + '</strong><br><small>' + t.statistikB + '</small></span><input type="checkbox" id="oak-cc-stat"' + statChecked + "></div>" +
      '<div class="oak-cc-cat"><span><strong>' + t.marknadT + '</strong><br><small>' + t.marknadB + '</small></span><input type="checkbox" id="oak-cc-mark"' + markChecked + "></div>" +
      "</div>" +
      '<div class="oak-cc-row" data-role="main"' + (openPrefs ? " hidden" : "") + ">" +
      '<button class="oak-cc-secondary" data-act="necessary">' + t.endast + '</button>' +
      '<button class="oak-cc-secondary" data-act="customize">' + t.anpassa + '</button>' +
      '<button class="oak-cc-primary" data-act="all">' + t.alla + '</button>' +
      "</div>" +
      '<div class="oak-cc-row" data-role="save"' + (openPrefs ? "" : " hidden") + ">" +
      '<button class="oak-cc-secondary" data-act="necessary">' + t.endast + '</button>' +
      '<button class="oak-cc-primary" data-act="save">' + t.spara + '</button>' +
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
