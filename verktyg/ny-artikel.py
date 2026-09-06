# -*- coding: utf-8 -*-
"""Genererar en artikel pa BADA spraken ur en spec, och kopplar in den overallt.

VARFOR DET HAR FINNS
====================
Artikel 2 byggdes genom att kopiera artikel 1 och byta innehallet. Det gick -
utom att den svenska INGRESSEN blev kvar fran artikel 1, ordagrant. Sidan
motsade alltsa sin egen rubrik, och `prov.yml` gick gront anda: radantals-
kontrollen mater DIVERGENS mellan sprakversionerna och kan strukturellt inte se
ett stycke som ar utbytt i bara den ena.

Granskaren hittade det. Provet kunde inte.

Har ar poangen med generatorn: **strukturen kommer fran specen, texten fran
spraket.** Bada filerna renderas ur SAMMA mall med SAMMA block, sa radantalet
stammer av konstruktion i stallet for av tur - och ett stycke kan inte bli kvar
fran en tidigare artikel, for det finns ingen tidigare artikel att kopiera.

DEN ANDRA HALVAN: TRE STALLEN
============================
En ny sida maste in pa tre stallen, och missas ett ligger texten ute utan att
nagon lank pekar pa den:
  1. flodessidorna insikter.html och insights.html
  2. sitemap.xml
  3. sjalva sidorna
Generatorn gor alla tre.

Det fanns ett fjarde: sprakparlistan i .github/workflows/prov.yml. Den togs bort
2026-09-06 (issue #18). Listan harleds nu ur specarna av verktyg/sprakpar.py, sa
den har filen behover inte langre redigera provets egen konfiguration - och den
gor det inte heller. Ett verktyg som skriver i sitt eget prov ar en sak for lite
att lita pa: gick strangersattningen fel var det provet som slutade tacka, och
det marks inte pa nagot annat satt an att en kontroll blir tyst.

Kravet pa dig som skriver en ny artikel ar i stallet att specen ligger kvar i
verktyg/artiklar/ - det ar den som ar kallan till paret.

ANVANDNING
==========
    python verktyg/ny-artikel.py verktyg/artiklar/<spec>.json
    python verktyg/ny-artikel.py --sjalvprov

Sjalvprovet aterskapar artikel 2 ur en spec och jamfor byte for byte mot filen
som ligger i repot. Gar det igenom vet vi att mallen inte tappat nagot pa vagen.
"""
import io
import json
import os
import sys

ROT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MALL = os.path.join(ROT, "verktyg", "artikelmall.html")

# Sprakkrom: samma for VARJE artikel, skiljer bara pa sprak. Ligger har och inte
# i specen, sa att en ny artikel inte kan rada fel meny av misstag.
SPRAK = {
    "sv": {
        "LANG_TAGG": '<html lang="sv">',
        "OG_LOCALE": '<meta property="og:locale" content="sv_SE">',
        "INLANGUAGE": '  "inLanguage": "sv",',
        "BLOGG_NAMN": '    "name": "Insikter — OakStride Studio",',
        "BLOGG_URL": '    "url": "https://oakstride.se/insikter"',
        "LOGO": '    <a class="logo" href="/sv">Oak<span>Stride</span><small>Insikter</small></a>',
        "NAV_OPPNING": '    <nav class="links" aria-label="Huvudmeny">',
        "NAV_ARTIKLAR": '      <a href="/insikter">Artiklar</a>',
        "NAV_KONTAKT": '      <a href="#kontakt">Kontakt</a>',
        "NAV_MER": '      <span class="nav-cross-label">Mer från OakStride</span>',
        "NAV_STUDIO": '      <a href="/webbstudio" class="nav-cross">Studio <span class="arrow">&rarr;</span></a>',
        "NAV_ADVISORY": '      <a href="/sv" class="nav-cross">Advisory <span class="arrow">&rarr;</span></a>',
        "NAV_IT": '      <a href="/it-chef" class="nav-cross">IT Ledning <span class="arrow">&rarr;</span></a>',
        "NAV_MENY": "Meny",
        "EYEBROW": '      <p class="eyebrow">OakStride &middot; Insikter</p>',
        "CTA_RUBRIK": '      <h2>Vill du att vi tittar på din?</h2>',
        "CTA_INTRO": '      <p class="section-intro">Vi kan göra samma kontroll på din sajt och säga vad vi ser. Du behöver inte bli kund för att fråga.</p>',
        "CTA_KNAPP_1": '        <a class="btn btn-solid" href="/webbstudio">Till OakStride Studio <span class="arrow">&rarr;</span></a>',
        "CTA_KNAPP_2": '        <a class="btn btn-line" href="/insikter">Fler insikter <span class="arrow">&rarr;</span></a>',
        "FOTER_LANKAR": '    <span><a href="/sv" style="color:inherit;">oakstride.se</a> &middot; Insikter &middot; <a href="/webbstudio" style="color:inherit;">Studio</a> &middot; <a href="/integritet" style="color:inherit;">Integritet &amp; cookies</a></span>',
        "NAV_SPRAK_MALL": '      <a href="/%s" lang="en">English</a>',
    },
    "en": {
        "LANG_TAGG": '<html lang="en">',
        "OG_LOCALE": '<meta property="og:locale" content="en_US">',
        "INLANGUAGE": '  "inLanguage": "en",',
        "BLOGG_NAMN": '    "name": "Insights — OakStride Studio",',
        "BLOGG_URL": '    "url": "https://oakstride.se/insights"',
        "LOGO": '    <a class="logo" href="/">Oak<span>Stride</span><small>Insights</small></a>',
        "NAV_OPPNING": '    <nav class="links" aria-label="Main navigation">',
        "NAV_ARTIKLAR": '      <a href="/insights">Articles</a>',
        "NAV_KONTAKT": '      <a href="#kontakt">Contact</a>',
        "NAV_MER": '      <span class="nav-cross-label">More from OakStride</span>',
        "NAV_STUDIO": '      <a href="/studio" class="nav-cross">Studio <span class="arrow">&rarr;</span></a>',
        "NAV_ADVISORY": '      <a href="/" class="nav-cross">Advisory <span class="arrow">&rarr;</span></a>',
        "NAV_IT": '      <a href="/it-management" class="nav-cross">IT Governance <span class="arrow">&rarr;</span></a>',
        "NAV_MENY": "Menu",
        "EYEBROW": '      <p class="eyebrow">OakStride &middot; Insights</p>',
        "CTA_RUBRIK": '      <h2>Want us to look at yours?</h2>',
        "CTA_INTRO": '      <p class="section-intro">We can run the same check on your site and tell you what we see. You do not have to become a client to ask.</p>',
        "CTA_KNAPP_1": '        <a class="btn btn-solid" href="/studio">To OakStride Studio <span class="arrow">&rarr;</span></a>',
        "CTA_KNAPP_2": '        <a class="btn btn-line" href="/insights">More insights <span class="arrow">&rarr;</span></a>',
        "FOTER_LANKAR": '    <span><a href="/" style="color:inherit;">oakstride.se</a> &middot; Insights &middot; <a href="/studio" style="color:inherit;">Studio</a> &middot; <a href="/privacy" style="color:inherit;">Privacy &amp; cookies</a></span>',
        "NAV_SPRAK_MALL": '      <a href="/%s" lang="sv">Svenska</a>',
    },
}


def rendera_prosa(block, lang):
    """Samma struktur i bada spraken - darfor kan radantalet inte glida isar."""
    ut = []
    for i, b in enumerate(block):
        if b["typ"] == "h2":
            if i:
                ut.append("")
            ut.append("        <h2>%s</h2>" % b["text"][lang])
        elif b["typ"] == "p":
            ut.append("        <p>%s</p>" % b["text"][lang])
        elif b["typ"] == "ul":
            ut.append("        <ul>")
            for p in b["punkter"]:
                ut.append("          <li>%s</li>" % p[lang])
            ut.append("        </ul>")
        else:
            raise SystemExit("AVBRYTER: okand blocktyp %r" % b["typ"])
    return "\n".join(ut)


def rendera(spec, lang):
    s = io.open(MALL, encoding="utf-8").read()
    k = dict(SPRAK[lang])
    syster = "en" if lang == "sv" else "sv"
    k["NAV_SPRAK"] = k.pop("NAV_SPRAK_MALL") % spec["slug"][syster]

    v = {
        "SLUG_EGEN": spec["slug"][lang],
        "SLUG_SV": spec["slug"]["sv"],
        "SLUG_EN": spec["slug"]["en"],
        "SIDTITEL": spec["sidtitel"][lang],
        "TITEL": spec["titel"][lang],
        "BESKRIVNING": spec["ingress"][lang],
        "DATUM_ISO": spec["datum"],
        "DATUM_TEXT": spec["datum_text"][lang],
        "LASTID": spec["lastid"],
        "INGRESS": '      <p class="lead">%s</p>' % spec["ingress"][lang],
        "PROSA": rendera_prosa(spec["block"], lang),
    }
    v.update(k)
    for token, varde in v.items():
        s = s.replace("{{%s}}" % token, varde)
    kvar = [t.split("}}")[0] for t in s.split("{{")[1:]]
    if kvar:
        raise SystemExit("AVBRYTER: ofyllda platshallare kvar: %s" % sorted(set(kvar)))
    return s


def skriv(vag, innehall):
    tmp = vag + ".tmp"
    open(tmp, "wb").write(innehall.encode("utf-8"))
    os.replace(tmp, vag)


def las(vag):
    return io.open(vag, encoding="utf-8").read()


def koppla_in(spec):
    """De tva stallen utover sjalva sidorna. Idempotent - hoppar over det som finns."""
    gjort = []
    for lang, flode, etikett, lastext in (
            ("sv", "insikter.html", "Insikter", "Läs texten"),
            ("en", "insights.html", "Insights", "Read the piece")):
        p = os.path.join(ROT, flode)
        s = las(p)
        if spec["slug"][lang] in s:
            gjort.append("%s: fanns redan" % flode)
            continue
        kort = (
            '        <div class="card">\n'
            '          <span class="tag">%s</span>\n'
            '          <h3><a href="/%s">%s</a></h3>\n'
            '          <ul>\n'
            '            <li>%s</li>\n'
            '          </ul>\n'
            '          <a class="work-link" href="/%s">%s <span class="arrow">&rarr;</span></a>\n'
            '          <span class="hours"><time datetime="%s">%s</time> &middot; %s</span>\n'
            '        </div>\n' % (
                etikett, spec["slug"][lang], spec["titel"][lang], spec["ingress"][lang],
                spec["slug"][lang], lastext, spec["datum"], spec["datum_text"][lang], spec["lastid"]))
        ankare = '        <div class="card">\n          <span class="tag">%s</span>' % etikett
        if s.count(ankare) < 1:
            raise SystemExit("AVBRYTER: hittade inget kortankare i %s" % flode)
        skriv(p, s.replace(ankare, kort + ankare, 1))
        gjort.append("%s: kort inlagt overst" % flode)

    p = os.path.join(ROT, "sitemap.xml")
    s = las(p)
    if spec["slug"]["sv"] in s:
        gjort.append("sitemap.xml: fanns redan")
    else:
        post = ""
        for lang in ("sv", "en"):
            post += ('  <url>\n    <loc>https://oakstride.se/%s</loc>\n'
                     '    <lastmod>%s</lastmod>\n'
                     '    <xhtml:link rel="alternate" hreflang="en" href="https://oakstride.se/%s"/>\n'
                     '    <xhtml:link rel="alternate" hreflang="sv" href="https://oakstride.se/%s"/>\n'
                     '  </url>\n' % (spec["slug"][lang], spec["datum"],
                                     spec["slug"]["en"], spec["slug"]["sv"]))
        ankare = "  <url>\n    <loc>https://oakstride.se/insikter</loc>"
        if ankare not in s:
            raise SystemExit("AVBRYTER: hittade inget sitemap-ankare")
        skriv(p, s.replace(ankare, post + ankare, 1))
        gjort.append("sitemap.xml: tva adresser tillagda")

    # Har lag tidigare ett fjarde steg som stoppade in sprakparet i prov.yml med
    # strangersattning mot ett ankare. Det ar borttaget: paret harleds nu ur
    # specen av verktyg/sprakpar.py. Vi sager det anda hogt, sa att den som kor
    # generatorn ser att paret ar omhandertaget och inte letar efter en rad att
    # fylla i.
    gjort.append("sprakpar: harleds ur specen av verktyg/sprakpar.py - inget att "
                 "fylla i, men specen maste ligga kvar i verktyg/artiklar/")
    return gjort


def bygg(spec):
    for lang in ("sv", "en"):
        skriv(os.path.join(ROT, spec["slug"][lang] + ".html"), rendera(spec, lang))
    sv = las(os.path.join(ROT, spec["slug"]["sv"] + ".html")).count("\n")
    en = las(os.path.join(ROT, spec["slug"]["en"] + ".html")).count("\n")
    if sv != en:
        raise SystemExit("AVBRYTER: sprakversionerna har %d respektive %d rader" % (sv, en))
    rader = ["%s.html och %s.html skrivna, %d rader var"
             % (spec["slug"]["sv"], spec["slug"]["en"], sv)]
    return rader + koppla_in(spec)


def sjalvprov():
    """Aterskapa artikel 2 ur en spec och jamfor byte for byte mot repots fil.

    Det ar det enda provet som visar att mallen inte tappat nagot. Ett prov som
    bara sager 'filen blev skriven' svarar pa en annan fraga an den vi staller.
    """
    spec = json.load(io.open(os.path.join(ROT, "verktyg", "artiklar",
                                          "artikel-2-integritetstexten.json"), encoding="utf-8"))
    fel = 0
    for lang in ("sv", "en"):
        vantat = las(os.path.join(ROT, spec["slug"][lang] + ".html"))
        fick = rendera(spec, lang)
        if fick == vantat:
            print("  ok    %s ar byte-identisk med repots fil" % spec["slug"][lang])
        else:
            fel = 1
            a, b = vantat.split("\n"), fick.split("\n")
            print("  FEL   %s skiljer sig (%d mot %d rader)" % (spec["slug"][lang], len(a), len(b)))
            for i in range(min(len(a), len(b))):
                if a[i] != b[i]:
                    print("        rad %d\n          repo: %s\n          mall: %s" % (i + 1, a[i][:100], b[i][:100]))
                    break
    return fel


if __name__ == "__main__":
    if len(sys.argv) == 2 and sys.argv[1] == "--sjalvprov":
        print("Sjalvprov: aterskapar artikel 2 ur spec och jamfor mot repot.")
        sys.exit(sjalvprov())
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    spec = json.load(io.open(sys.argv[1], encoding="utf-8"))
    for rad in bygg(spec):
        print(" ", rad)
    print("\nKvar for hand: granska texten, kor provet, oppna PR. Merge ar Fredriks.")
