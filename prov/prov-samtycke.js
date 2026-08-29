// Prov for oak-analytics.js samtyckesgrind. Kors med: node prov/prov-samtycke.js
//
// Ingen testram - en DOM-mock racker, och en beroendefri fil kan koras var som helst.
//
// ── OMSKRIVET 2026-08-29 EFTER GRANSKNINGSFYND B3 OCH F1 ──────────────────────────
//
// Forsta versionen hade 26 grona prov och var anda vardelos pa den punkt som betydde
// mest. Granskaren muterade koden pa tre satt och provet forblev 26/26 gront:
//
//   1. knappen "Endast nodvandiga" andrad till att ge JA till annonssamtycke
//   2. "Spara installningar" andrad till att ignorera kryssrutan och alltid ge ja
//   3. Consent Mode-default flyttad till EFTER att annonstaggen kan laddas
//
// Orsaken: DOM-mockens createElement gav en stubb vars addEventListener var en no-op,
// och getElementById returnerade alltid null. Klick-handlern som showBanner registrerar
// fangades darfor aldrig. **Hela vagen en riktig besokare tar - de tre knapparna och de
// tva kryssrutorna - var otestad.** Provet tackte bara laddningsvagen och API:t.
//
// Lardomen ar densamma som nionde sattet i kunskap-verifiering.md: en kontroll kan svara
// sant pa en ANNAN fraga an den man staller. "26 grona prov" var mitt eget skal att lita
// pa koden, och det skalet bar inte.
//
// Mocken nedan bar riktiga event-lyssnare och parsar de element ur innerHTML som proven
// behover roras vid, sa att proven kan KLICKA i stallet for att anropa API:t.
//
// F1: provet skriver inte langre till kallfilen pa disk. Varianten med ifyllt ADS_ID
// matas in i vm som en STRANG. Forra versionen skrev till filen och aterstallde den i
// ett finally - som inte tacker Ctrl-C. Ett avbrott kunde lamna ADS_ID = "AW-000TEST"
// pa disk, pa exakt den rad kommentaren ber Fredrik fylla i ett riktigt varde.

const fs = require("fs");
const path = require("path");
const vm = require("vm");

let fel = 0, ok = 0;
function pastå(villkor, text) {
  if (villkor) { ok++; console.log("  ok   " + text); }
  else { fel++; console.log("  FEL  " + text); }
}

const KÄLLA = path.join(__dirname, "..", "oak-analytics.js");
const KOD = fs.readFileSync(KÄLLA, "utf8");

// ── DOM-mock ──────────────────────────────────────────────────────────────────────
function nod(tag) {
  const n = {
    tagName: (tag || "div").toUpperCase(),
    _attr: {}, _lyss: {}, _html: "",
    children: [], parentNode: null, nextSibling: null,
    textContent: "", hidden: false, checked: false, id: "",
    setAttribute(k, v) { this._attr[k] = String(v); if (k === "id") this.id = String(v); },
    getAttribute(k) { return k in this._attr ? this._attr[k] : null; },
    get attributes() { return Object.keys(this._attr).map(k => ({ name: k, value: this._attr[k] })); },
    addEventListener(typ, fn) { (this._lyss[typ] = this._lyss[typ] || []).push(fn); },
    appendChild(b) { b.parentNode = this; this.children.push(b); return b; },
    insertBefore(ny) { ny.parentNode = this; this.children.push(ny); return ny; },
    remove() {
      if (!this.parentNode) return;
      const i = this.parentNode.children.indexOf(this);
      if (i >= 0) this.parentNode.children.splice(i, 1);
    },
    querySelector() { return nod("div"); },
    querySelectorAll() { return []; },
    // Klick pa ett element med data-act="<act>" inuti den har noden.
    klicka(act) {
      const mål = { getAttribute: k => (k === "data-act" ? act : null) };
      (this._lyss.click || []).forEach(fn => fn({ target: mål }));
    }
  };
  Object.defineProperty(n, "innerHTML", {
    get() { return this._html; },
    // Minimal parser: plockar ut varje element som bar ett id= och gor det till en
    // riktig barnnod. Det racker for kryssrutorna, som ar det proven behover ta i.
    set(html) {
      this._html = html;
      this.children = [];
      const re = /<(\w+)([^>]*\bid="([^"]+)"[^>]*)>/g;
      let m;
      while ((m = re.exec(html)) !== null) {
        const barn = nod(m[1]);
        barn.setAttribute("id", m[3]);
        if (/\bchecked\b/.test(m[2])) barn.checked = true;
        if (/\bdisabled\b/.test(m[2])) barn.setAttribute("disabled", "");
        this.appendChild(barn);
      }
    }
  });
  Object.defineProperty(n, "src", { get() { return this._src; }, set(v) { this._src = v; } });
  return n;
}

function körFilen({ sparat, adsId = "", skriptTaggar = [], språk = "sv", befintligVid = "", svarOk = true }) {
  const lagring = sparat ? { oak_consent_v2: JSON.stringify(sparat) } : {};
  let lagringKastar = false;
  const cookies = [], laddade = [], huvudSkript = [], poster = [], larmade = [];
  let omladdad = false, idRäknare = 0;
  // En redan satt oak_vid, t.ex. fran ett statistik-ja under policy 1.1. Cookien
  // overlever policybytet - bara localStorage ogiltigforklaras.
  if (befintligVid) cookies.push("oak_vid=" + befintligVid + "; max-age=31536000; path=/");

  const platshållare = skriptTaggar.map(attr => {
    const n = nod("script");
    Object.entries(attr).forEach(([k, v]) => n.setAttribute(k, v));
    n.parentNode = { insertBefore: ny => { laddade.push(ny); return ny; } };
    return n;
  });

  const body = nod("body");
  const head = nod("head");
  head.appendChild = n => { huvudSkript.push(n); return n; };

  const doc = {
    readyState: "complete",
    referrer: "",
    _lang: språk,
    documentElement: { getAttribute: k => (k === "lang" ? doc._lang : null) },
    head, body,
    get cookie() {
      return cookies.filter(c => !/max-age=0/.test(c)).map(c => c.split(";")[0]).join("; ");
    },
    set cookie(v) { cookies.push(v); },
    createElement: tag => nod(tag),
    getElementById(id) {
      const sök = n => {
        if (n.id === id) return n;
        for (const b of (n.children || [])) { const t = sök(b); if (t) return t; }
        return null;
      };
      return sök(body) || sök(head);
    },
    querySelectorAll: sel => (String(sel).includes('data-consent="marketing"') ? platshållare : []),
    addEventListener() {}
  };

  const sandlåda = {
    document: doc,
    location: { pathname: "/", reload() { omladdad = true; } },
    localStorage: {
      getItem: k => (k in lagring ? lagring[k] : null),
      setItem: (k, v) => { if (lagringKastar) throw new Error("blockerad lagring"); lagring[k] = v; }
    },
    fetch: (url, opt) => {
      var kropp = {};
      try { kropp = JSON.parse((opt && opt.body) || "{}"); } catch (e) {}
      poster.push({ url: String(url), body: kropp });
      return Promise.resolve(svarOk ? { ok: true, status: 200 } : { ok: false, status: 401 });
    },
    console: { warn(t) { larmade.push(["warn", String(t)]); }, error(t) { larmade.push(["error", String(t)]); } }
  };
  sandlåda.window = sandlåda;
  // Realistisk form: en riktig randomUUID ar 36 tecken. En mock som ger "UUID-1"
  // kan dolja fel som beror pa langd, och gav ett falskt underkant prov 14.
  sandlåda.crypto = {
    randomUUID: () => {
      const n = String(++idRäknare).padStart(12, "0");
      return "00000000-0000-4000-8000-" + n;
    }
  };

  const kod = adsId ? KOD.replace('var ADS_ID = "";', 'var ADS_ID = "' + adsId + '";') : KOD;
  if (adsId && kod === KOD) throw new Error("kunde inte satta ADS_ID - kontrollera raden i kallfilen");

  vm.createContext(sandlåda);
  vm.runInContext(kod, sandlåda);

  return {
    api: sandlåda.oakConsent,
    banner: () => doc.getElementById("oak-cc"),
    ruta: id => doc.getElementById(id),
    laddade, huvudSkript, cookies,
    gtag: () => huvudSkript.filter(n => n.src && String(n.src).includes("googletagmanager")),
    dataLayer: () => (sandlåda.dataLayer || []).map(a => Array.from(a)),
    lagrat: () => (lagring.oak_consent_v2 ? JSON.parse(lagring.oak_consent_v2) : null),
    omladdad: () => omladdad,
    sättLagringKastar: v => { lagringKastar = v; },
    samtyckesposter: () => poster.filter(x => x.url.includes("/consents")),
    larm: () => larmade
  };
}

const NY = "1.2-2026-08-29";
const ADS = { type: "text/plain", "data-consent": "marketing", "data-src": "https://x/ads.js" };
// En SATT statistikcookie, alltsa inte en raderande skrivning.
const vidSatta = r => r.cookies.filter(c => /^oak_vid=.+/.test(c) && !/max-age=0/.test(c));

console.log("\n1. Gammalt samtycke fran policy 1.1 raknas som inget val");
{
  const r = körFilen({ sparat: { v: 2, statistics: true, marketing: true, policy: "1.1-2026-07-17" }, skriptTaggar: [{ ...ADS }] });
  pastå(r.api.categories() === null, "categories() ar null");
  pastå(r.api.status() === null, "status() ar null");
  pastå(r.laddade.length === 0, "inget annonsskript aktiverat");
  pastå(!!r.banner(), "bannern visas igen");
}

console.log("\n2. Utan sparat val: inget laddat, Consent Mode denied pa alla fyra");
{
  const r = körFilen({ sparat: null, skriptTaggar: [{ ...ADS }] });
  pastå(r.laddade.length === 0, "inget annonsskript aktiverat");
  const d = r.dataLayer().find(a => a[0] === "consent" && a[1] === "default");
  pastå(!!d, "consent default satt");
  pastå(d && d[2].ad_storage === "denied", "ad_storage denied");
  pastå(d && d[2].ad_user_data === "denied", "ad_user_data denied");
  pastå(d && d[2].ad_personalization === "denied", "ad_personalization denied");
  pastå(d && d[2].analytics_storage === "denied", "analytics_storage denied");
}

console.log("\n3. KLICK 'Endast nodvandiga' far ALDRIG ge annonssamtycke  [mutation 1]");
{
  const r = körFilen({ sparat: null, adsId: "AW-000TEST", skriptTaggar: [{ ...ADS }] });
  r.banner().klicka("necessary");
  const l = r.lagrat();
  pastå(l && l.statistics === false, "statistics = false");
  pastå(l && l.marketing === false, "marketing = false");
  pastå(r.laddade.length === 0, "inget annonsskript aktiverat");
  pastå(r.gtag().length === 0, "ingen gtag-tagg");
  pastå(vidSatta(r).length === 0, "ingen oak_vid-cookie satt");
}

console.log("\n4. KLICK 'Godkann alla' ger bada och laddar taggen");
{
  const r = körFilen({ sparat: null, adsId: "AW-000TEST", skriptTaggar: [{ ...ADS }] });
  r.banner().klicka("all");
  const l = r.lagrat();
  pastå(l && l.statistics === true && l.marketing === true, "bada true");
  pastå(l && l.policy === NY, "sparat under policy " + NY);
  pastå(r.laddade.length === 1, "annonsskriptet aktiverat");
  pastå(r.gtag().length === 1, "gtag-taggen laddad");
  pastå(r.gtag()[0].src.includes("AW-000TEST"), "ratt ID i src");
}

console.log("\n5. KLICK 'Spara' MASTE folja kryssrutorna  [mutation 2]");
{
  const r = körFilen({ sparat: null, adsId: "AW-000TEST", skriptTaggar: [{ ...ADS }] });
  r.banner().klicka("customize");
  const stat = r.ruta("oak-cc-stat"), mark = r.ruta("oak-cc-mark");
  pastå(!!stat && !!mark, "bada kryssrutorna finns i bannern");
  stat.checked = true; mark.checked = false;
  r.banner().klicka("save");
  const l = r.lagrat();
  pastå(l && l.statistics === true, "statistics foljde kryssrutan (true)");
  pastå(l && l.marketing === false, "marketing foljde kryssrutan (false)");
  pastå(r.gtag().length === 0, "INGEN gtag-tagg");
  pastå(vidSatta(r).length === 1, "oak_vid satt - statistik ar godkand");
}

console.log("\n6. KLICK 'Spara' med bara marknadsforing  [fynd B1]");
{
  const r = körFilen({ sparat: null, adsId: "AW-000TEST", skriptTaggar: [{ ...ADS }] });
  r.banner().klicka("customize");
  const stat = r.ruta("oak-cc-stat"), mark = r.ruta("oak-cc-mark");
  stat.checked = false; mark.checked = true;
  r.banner().klicka("save");
  const l = r.lagrat();
  pastå(l && l.statistics === false && l.marketing === true, "nej till statistik, ja till marknadsforing");
  pastå(r.gtag().length === 1, "gtag-taggen laddad");
  pastå(vidSatta(r).length === 0, "INGEN oak_vid-cookie efter nej till statistik");
}

console.log("\n7. TOMT ADS_ID laddar aldrig nagot, aven vid fullt samtycke");
{
  const r = körFilen({ sparat: { v: 2, statistics: true, marketing: true, policy: NY } });
  pastå(r.gtag().length === 0, "ingen gtag-tagg nar ADS_ID ar tomt");
}

console.log("\n8. Ifyllt ADS_ID: ja laddar, nej laddar inte, gammal policy laddar inte");
{
  const ja = körFilen({ sparat: { v: 2, statistics: true, marketing: true, policy: NY }, adsId: "AW-000TEST" });
  pastå(ja.gtag().length === 1, "laddad vid ja");
  const nej = körFilen({ sparat: { v: 2, statistics: true, marketing: false, policy: NY }, adsId: "AW-000TEST" });
  pastå(nej.gtag().length === 0, "INTE laddad vid nej");
  const g = körFilen({ sparat: { v: 2, statistics: true, marketing: true, policy: "1.1-2026-07-17" }, adsId: "AW-000TEST" });
  pastå(g.gtag().length === 0, "INTE laddad pa ja fran gamla policyn");
}

console.log("\n9. Consent Mode default MASTE komma forst  [mutation 3]");
{
  const r = körFilen({ sparat: { v: 2, statistics: true, marketing: true, policy: NY }, adsId: "AW-000TEST" });
  const d = r.dataLayer();
  const iDef = d.findIndex(a => a[0] === "consent" && a[1] === "default");
  const iJs = d.findIndex(a => a[0] === "js");
  const iConf = d.findIndex(a => a[0] === "config");
  pastå(iDef === 0, "consent default ar FORSTA anropet i dataLayer");
  pastå(iJs > iDef && iConf > iDef, "gtag js och config kommer efter default");
}

console.log("\n10. Aterkallelse laddar om sidan");
{
  const r = körFilen({ sparat: { v: 2, statistics: true, marketing: true, policy: NY }, adsId: "AW-000TEST" });
  pastå(r.omladdad() === false, "ingen omladdning bara av att sidan visas");
  r.api.revoke();
  pastå(r.lagrat().marketing === false, "marketing sparat som false");
  pastå(r.omladdad() === true, "sidan laddades om");
}

console.log("\n11. Omladdning aven nar localStorage inte gar att skriva  [fynd F4]");
{
  const r = körFilen({ sparat: null, adsId: "AW-000TEST", skriptTaggar: [{ ...ADS }] });
  r.banner().klicka("all");
  pastå(r.gtag().length === 1, "taggen laddad efter ja");
  r.sättLagringKastar(true);
  r.api.revoke();
  pastå(r.omladdad() === true, "omladdning sker anda - bygger pa adsLaddad, inte pa lagrat varde");
}

console.log("\n12. Bannern foljer <html lang>  [fynd B2]");
{
  const sv = körFilen({ sparat: null });
  pastå(sv.banner().innerHTML.indexOf("/integritet") > -1, "svensk sida lankar till /integritet");
  pastå(sv.banner().innerHTML.indexOf("Godkänn alla") > -1, "svensk knapptext");
  const en = körFilen({ sparat: null, språk: "en" });
  pastå(en.banner().innerHTML.indexOf("/privacy") > -1, "engelsk sida lankar till /privacy");
  pastå(en.banner().innerHTML.indexOf("Accept all") > -1, "engelsk knapptext");
  pastå(en.banner().innerHTML.indexOf("Godkänn alla") === -1, "ingen svensk text pa engelsk sida");
}

console.log("");
console.log("13. Aterkallelse laddar om AVEN med tom ADS_ID  [fynd N1]");
{
  // Scenariot granskaren matte: nagon lagger till ett marknadsforingsskript pa det satt
  // filen dokumenterar, medan ADS_ID annu ar tom. Da satts aldrig adsLaddad - men ett
  // tredjepartsskript KOR. Ett nej maste anda betyda att det slutar kora.
  const r = körFilen({ sparat: null, skriptTaggar: [{ ...ADS }] });   // ADS_ID tom
  r.banner().klicka("all");
  pastå(r.laddade.length === 1, "platshallarskriptet aktiverat");
  pastå(r.gtag().length === 0, "ingen gtag-tagg - ADS_ID ar tom");
  r.api.revoke();
  pastå(r.omladdad() === true, "sidan laddades om anda - mattet ar 'aktiverades nagot alls'");
}

console.log("");
console.log("14. Samtyckesloggens nyttolast granskas  [fynd N2]");
{
  const r = körFilen({ sparat: null, adsId: "AW-000TEST", skriptTaggar: [{ ...ADS }] });
  r.banner().klicka("customize");
  r.ruta("oak-cc-stat").checked = false;
  r.ruta("oak-cc-mark").checked = true;
  r.banner().klicka("save");
  const poster = r.samtyckesposter();
  pastå(poster.length === 1, "exakt en post till /consents");
  pastå(poster[0] && poster[0].body.policy_version === NY, "policy_version med i nyttolasten");
  // consents.vid ar NOT NULL - matt i drift 2026-08-29. NAGRA CHECK-VILLKOR FINNS INTE,
  // varken i drift eller i migration-29 (kontrollerat bada). En granskningsnotering
  // angav "char_length(vid) between 8 and 64" och "policy_version max 20 tecken"; det
  // kom ur en minnesfil och stammer inte. Provet kraver darfor bara ett icke-tomt id.
  pastå(poster[0] && typeof poster[0].body.vid === "string" && poster[0].body.vid.length > 0,
        "vid med i nyttolasten och icke-tomt (consents.vid ar NOT NULL)");
  pastå(vidSatta(r).length === 0, "ingen oak_vid-cookie satt");
}

console.log("");
console.log("15. Ett gammalt oak_vid far INTE aterbrukas i loggen  [fynd N2]");
{
  // oak_vid overlever policybytet. En besokare som sa ja till statistik 20 juli bar kvar
  // sin cookie. Sager hon nej till statistik nu far hennes HISTORISKA identifierare inte
  // hamna i samtyckesloggen - det vore B1 en niva djupare.
  const r = körFilen({ sparat: null, adsId: "AW-000TEST", befintligVid: "GAMMAL-VID-FRAN-JULI" });
  r.banner().klicka("customize");
  r.ruta("oak-cc-stat").checked = false;
  r.ruta("oak-cc-mark").checked = true;
  r.banner().klicka("save");
  const poster = r.samtyckesposter();
  pastå(poster.length === 1, "en post till /consents");
  pastå(poster[0] && poster[0].body.vid !== "GAMMAL-VID-FRAN-JULI",
        "den historiska identifieraren aterbrukades INTE");
}

console.log("");
console.log("16. Ett JA till statistik ska daremot anvanda cookien  [motprov till 15]");
{
  const r = körFilen({ sparat: null, adsId: "AW-000TEST", befintligVid: "GAMMAL-VID-FRAN-JULI" });
  r.banner().klicka("all");
  const poster = r.samtyckesposter();
  pastå(poster.length === 1, "en post till /consents");
  pastå(poster[0] && poster[0].body.vid === "GAMMAL-VID-FRAN-JULI",
        "statistik-ja aterbrukar den godkanda cookien - inget nytt id i onodan");
}

console.log("\n17. Kallfilen pa disk ar oforandrad efter provet  [fynd F1]");
{
  pastå(fs.readFileSync(KÄLLA, "utf8") === KOD, "oak-analytics.js orord - provet skriver aldrig till disk");
}

// Prov 18-19 maste vanta pa mikrotasken: larmet sker i post():s .then(), alltsa efter
// att klicket returnerat. Utan vantan matte provet ett lage som annu inte intraffat, och
// granskarens mutation "sluta kontrollera response.ok" passerade 56/56 - alltsa var hela
// tystnadsfixen obevisad av det prov som ar merge-grinden. Granskningsfynd N2.
(async function () {
  console.log("");
  console.log("18. Ett misslyckat samtyckes-POST LARMAR  [fynd N2]");
  {
    const r = körFilen({ sparat: null, svarOk: false });
    r.banner().klicka("all");
    await new Promise(res => setImmediate(res));
    const kritiska = r.larm().filter(l => l[0] === "error" && l[1].indexOf("samtyckesloggen") > -1);
    pastå(kritiska.length === 1, "HTTP 401 pa samtyckesloggen gav ett console.error");
    pastå(kritiska.length === 1 && kritiska[0][1].indexOf("401") > -1, "statuskoden star i larmet");
  }

  console.log("");
  console.log("19. Ett lyckat POST larmar INTE  [motprov till 18]");
  {
    const r = körFilen({ sparat: null, svarOk: true });
    r.banner().klicka("all");
    await new Promise(res => setImmediate(res));
    pastå(r.larm().filter(l => l[0] === "error").length === 0, "inga fellarm vid HTTP 200");
  }

  console.log("");
  console.log(fel === 0 ? "ALLA " + ok + " PROV GICK IGENOM" : fel + " PROV FALLERADE av " + (ok + fel));
  process.exit(fel === 0 ? 0 : 1);
})();
