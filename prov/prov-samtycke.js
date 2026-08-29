// Prov for oak-analytics.js samtyckesgrind. Kors med: node prov-samtycke.js
// Ingen testram - en liten DOM-mock racker, och en beroendefri fil kan koras var som helst.
const fs = require("fs");
const path = require("path");

let fel = 0, ok = 0;
function pastå(villkor, text) {
  if (villkor) { ok++; console.log("  ok   " + text); }
  else { fel++; console.log("  FEL  " + text); }
}

function körFilen({ sparat, skriptTaggar = [] }) {
  const lager = { store: sparat ? { oak_consent_v2: JSON.stringify(sparat) } : {} };
  const laddade = [];
  const dataLayer = [];
  let omladdad = false;
  const noder = skriptTaggar.map(t => ({
    attributes: Object.entries(t).map(([name, value]) => ({ name, value })),
    getAttribute(n) { return n in t ? t[n] : null; },
    setAttribute(n, v) { t[n] = v; },
    textContent: "",
    parentNode: { insertBefore(ny) { laddade.push(ny); } },
    nextSibling: null
  }));

  const huvudSkript = [];
  const doc = {
    cookie: "",
    readyState: "complete",
    referrer: "",
    head: { appendChild(n) { huvudSkript.push(n); } },
    body: { appendChild() {} },
    getElementById: () => null,
    querySelectorAll: sel => (sel.includes('data-consent="marketing"') ? noder : []),
    createElement: tag => (tag === "script"
      ? { _attr: {}, setAttribute(n, v) { this._attr[n] = v; }, set src(v) { this._src = v; }, get src() { return this._src; } }
      : { style: {}, setAttribute() {}, addEventListener() {}, appendChild() {}, querySelector: () => null }),
    addEventListener() {}
  };

  const sandlåda = {
    window: { dataLayer: undefined, crypto: undefined, location: { pathname: "/", reload() { omladdad = true; } } },
    document: doc,
    location: { pathname: "/", reload() { omladdad = true; } },
    localStorage: {
      getItem: k => (k in lager.store ? lager.store[k] : null),
      setItem: (k, v) => { lager.store[k] = v; }
    },
    fetch: () => ({ catch() {} }),
    console
  };
  sandlåda.window.localStorage = sandlåda.localStorage;
  sandlåda.window.document = doc;

  const vm = require("vm");
  const kod = fs.readFileSync(path.join(__dirname, "..", "oak-analytics.js"), "utf8");
  vm.createContext(sandlåda);
  vm.runInContext(kod, sandlåda);
  return {
    api: sandlåda.window.oakConsent,
    laddade,
    huvudSkript,
    dataLayer: sandlåda.window.dataLayer || [],
    lagrat: () => (lager.store.oak_consent_v2 ? JSON.parse(lager.store.oak_consent_v2) : null),
    omladdad: () => omladdad
  };
}

const NY = "1.2-2026-08-29";
const ADS = { type: "text/plain", "data-consent": "marketing", "data-src": "https://x/ads.js" };

console.log("\n1. Gammalt samtycke fran policy 1.1 far INTE bara ett ja till annonser");
{
  const r = körFilen({ sparat: { v: 2, statistics: true, marketing: false, policy: "1.1-2026-07-17" }, skriptTaggar: [{ ...ADS }] });
  pastå(r.api.categories() === null, "categories() ar null - gammalt val raknas som inget val");
  pastå(r.api.status() === null, "status() ar null, sa bannern visas igen");
  pastå(r.laddade.length === 0, "inget annonsskript laddat");
}

console.log("\n2. Utan sparat val laddas inget, och Consent Mode star pa denied");
{
  const r = körFilen({ sparat: null, skriptTaggar: [{ ...ADS }] });
  pastå(r.laddade.length === 0, "inget annonsskript laddat");
  const d = r.dataLayer.map(a => Array.from(a));
  const def = d.find(a => a[0] === "consent" && a[1] === "default");
  pastå(!!def, "consent default ar satt");
  pastå(def && def[2].ad_storage === "denied", "ad_storage = denied");
  pastå(def && def[2].ad_user_data === "denied", "ad_user_data = denied");
  pastå(def && def[2].ad_personalization === "denied", "ad_personalization = denied");
}

console.log("\n3. Giltigt ja till marknadsforing laddar taggen och uppdaterar Consent Mode");
{
  const r = körFilen({ sparat: { v: 2, statistics: true, marketing: true, policy: NY }, skriptTaggar: [{ ...ADS }] });
  pastå(r.laddade.length === 1, "annonsskriptet laddat");
  pastå(r.laddade[0] && r.laddade[0]._src === "https://x/ads.js", "data-src blev src");
  const upd = r.dataLayer.map(a => Array.from(a)).filter(a => a[1] === "update").pop();
  pastå(upd && upd[2].ad_storage === "granted", "ad_storage = granted");
}

console.log("\n4. Ja till statistik men NEJ till marknadsforing laddar ingen tagg");
{
  const r = körFilen({ sparat: { v: 2, statistics: true, marketing: false, policy: NY }, skriptTaggar: [{ ...ADS }] });
  pastå(r.laddade.length === 0, "inget annonsskript laddat");
  const upd = r.dataLayer.map(a => Array.from(a)).filter(a => a[1] === "update").pop();
  pastå(upd && upd[2].ad_storage === "denied", "ad_storage = denied");
  pastå(upd && upd[2].analytics_storage === "granted", "analytics_storage = granted");
}

console.log("\n5. grant() sparar bada kategorierna under NYA policyversionen");
{
  const r = körFilen({ sparat: null, skriptTaggar: [{ ...ADS }] });
  r.api.grant();
  const l = r.lagrat();
  pastå(l && l.marketing === true, "marketing sparat som true");
  pastå(l && l.policy === NY, "sparat under policy " + NY);
  pastå(r.laddade.length === 1, "taggen laddades vid ja");
}

console.log("\n6. Aterkallelse laddar om sidan - ett laddat skript gar inte att avladda");
{
  const r = körFilen({ sparat: { v: 2, statistics: true, marketing: true, policy: NY }, skriptTaggar: [{ ...ADS }] });
  pastå(r.omladdad() === false, "ingen omladdning bara av att sidan visas");
  r.api.revoke();
  pastå(r.lagrat().marketing === false, "marketing sparat som false");
  pastå(r.omladdad() === true, "sidan laddades om");
}

console.log("");
console.log("7. TOMT ADS_ID far ALDRIG ladda nagot - inte ens vid fullt samtycke");
{
  const r = körFilen({ sparat: { v: 2, statistics: true, marketing: true, policy: NY } });
  const t = r.huvudSkript.filter(n => n.src && n.src.includes("googletagmanager"));
  pastå(t.length === 0, "ingen gtag-tagg laddad nar ADS_ID ar tomt");
}

console.log("");
console.log("8. Ifyllt ADS_ID laddar taggen vid ja - och ALDRIG vid nej");
{
  const fsx = require("fs"), pathx = require("path");
  const kalla = pathx.join(__dirname, "..", "oak-analytics.js");
  const orig = fsx.readFileSync(kalla, "utf8");
  const medId = orig.replace('var ADS_ID = "";', 'var ADS_ID = "AW-000TEST";');
  if (medId === orig) { pastå(false, "kunde inte satta ADS_ID i provet - kontrollera raden"); }

  const körMedId = (sparat) => {
    fsx.writeFileSync(kalla, medId, "utf8");
    try { return körFilen({ sparat }); } finally { fsx.writeFileSync(kalla, orig, "utf8"); }
  };
  const taggar = r => r.huvudSkript.filter(n => n.src && n.src.includes("googletagmanager"));

  const ja = körMedId({ v: 2, statistics: true, marketing: true, policy: NY });
  pastå(taggar(ja).length === 1, "gtag-taggen laddad vid ja till marknadsforing");
  pastå(taggar(ja)[0] && taggar(ja)[0].src.includes("AW-000TEST"), "ratt ID i src");

  const nej = körMedId({ v: 2, statistics: true, marketing: false, policy: NY });
  pastå(taggar(nej).length === 0, "INGEN gtag-tagg vid nej till marknadsforing");

  const gammal = körMedId({ v: 2, statistics: true, marketing: true, policy: "1.1-2026-07-17" });
  pastå(taggar(gammal).length === 0, "INGEN gtag-tagg pa ett ja fran gamla policyn");

  pastå(fsx.readFileSync(kalla, "utf8") === orig, "kallfilen aterstalld efter provet");
}

console.log("\n" + (fel === 0 ? "ALLA " + ok + " PROV GICK IGENOM" : fel + " PROV FALLERADE av " + (ok + fel)));
process.exit(fel === 0 ? 0 : 1);
