# -*- coding: utf-8 -*-
"""Sprakparen for regel 2 - harledda dar det gar, uppraknade bara dar det inte gar.

VARFOR DET HAR FINNS
====================
Listan over sprakpar lag inne i `prov.yml` och underhalls for hand. Den gicks
inte igenom 2026-09-03, och tackningen gick TYST fran 8 av 8 sidor till 8 av 12:
provet sa fortfarande "ok" pa varje par det kande till, och de fyra sidor det
inte kande till fanns inte i utdatan alls. Ett prov som bara namner det det
redan tacker kan strukturellt inte larma om det som saknas.

Tackningskontrollen i prov.yml stangde tystnaden - en sida utan par FALLER nu
provet. Kvar var friktionen: varje ny artikel kravde en handpafylld rad i en
YAML-fil, och `ny-artikel.py` losste det genom att stoppa in raden med
strangersattning mot ett ankare. Ett verktyg som redigerar sin egen
provkonfiguration ar en sak for lite att lita pa.

HARLEDNINGEN, OCH DESS GRANS
============================
Ett sprakpar gar inte att harleda ur filnamnen - de ar inte oversattningar av
varandra (`index.html`/`sv.html`, `privacy.html`/`integritet.html`). Men en
ARTIKEL har sin spec i `verktyg/artiklar/*.json`, och dar star bada slugarna
utskrivna. Artiklarna ar ocksa de enda sidor som tillkommer lopande.

Darfor: de fem fasta sidparen star uppraknade har (de tillkommer inte), och
artiklarna harleds ur specarna. Nasta artikel behover ingen rad nagonstans.

Undantaget star utskrivet i ARV nedan i stallet for att slatas over: artikel 1
byggdes innan generatorn fanns och har ingen spec. Att skriva en spec i
efterhand vore att pasta att filen genererats ur den - den ar den inte, och en
spec som inte kan aterskapa sin fil ar en luring i nasta sjalvprov.

ANVANDNING
==========
    python verktyg/sprakpar.py          # skriver paren pa stdout, ett per rad
    python verktyg/sprakpar.py --lista  # samma, men med kalla per par (for oga)

Fel gar till stderr som ::error-rader och ger avslutkod 1, paren till stdout.
Delningen finns for att `par=$(python3 verktyg/sprakpar.py)` ska fa en ren lista -
INTE for att det skulle finnas nagon varningsniva. Varje fel() satter ocksa
`trasigt`, sa det finns ingen vag dar skriptet skriver pa stderr och anda ger 0.
(En tidigare version av den har meningen pastod motsatsen - granskningens N4.)
"""
import glob
import io
import json
import os
import sys

ROT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# De fasta sidparen. GAR INTE att harleda: filnamnen ar inte oversattningar av
# varandra (index.html/sv.html, privacy/integritet) - och DEN halvan ar hela skalet
# att de star uppraknade.
#
# 🔴 RATTAT efter granskning (fynd B1). Har stod ocksa "de tillkommer inte heller
# lopande - listan har varit oforandrad sedan sajten byggdes". Det ar matbart falskt:
# privacy.html tillkom 2026-09-03 (852897e), insights.html och insikter.html
# 2026-08-30 (9650fcd). Tva av fem par blev alltsa nodvandiga inom sju dagar fore
# den har filen skrevs.
#
# Skillnaden spelar roll for nasta person: tror hon att listan ar statisk letar hon
# felet nagon annanstans nar en ny fast sida inte far nagot par. Det FALLS visserligen
# - tackningskontrollen nedan sager rakt ut att en fast sida ska in har - men ett
# falskt pastaende i en kommentar ar en falla aven nar det finns ett skyddsnat.
STATISKA = [
    ("index.html", "sv.html"),
    ("privacy.html", "integritet.html"),
    ("studio.html", "webbstudio.html"),
    ("it-management.html", "it-chef.html"),
    ("insights.html", "insikter.html"),
]

# Artiklar UTAN spec. Bara artikel 1 - den byggdes innan generatorn fanns.
# Listan ska inte vaxa: en ny artikel byggs med `ny-artikel.py` och far darmed
# en spec, och da harleds paret. Vaxer den anda ar det ett tecken pa att nagon
# byggt en artikel genom att kopiera en annan, vilket ar precis det generatorn
# finns for att sluta med.
ARV = [
    ("insights-invisible-on-google.html", "insikter-osynlig-pa-google.html"),
]


def fel(rad):
    sys.stderr.write(rad + "\n")


def ur_specarna():
    """Paren som star i artikelspecarna. Kallan ar specen, inte filsystemet."""
    ut = []
    for p in sorted(glob.glob(os.path.join(ROT, "verktyg", "artiklar", "*.json"))):
        namn = os.path.basename(p)
        try:
            spec = json.load(io.open(p, encoding="utf-8"))
        except ValueError as e:
            fel("::error file=verktyg/artiklar/%s::%s gar inte att lasa som JSON: %s"
                % (namn, namn, e))
            ut.append(None)
            continue
        slug = spec.get("slug") or {}
        # ⚠️ En spec kan vara giltig JSON och anda ha fel FORM ("slug": [] eller
        # "sv": 123). Utan de har tva kontrollerna blev det en traceback i stallet for
        # en ::error-rad. Felet syntes och fallde aven forut - men den som ska ratta
        # det ska slippa lasa en stackdump for att forsta vad som ar fel.
        if not isinstance(slug, dict):
            fel("::error file=verktyg/artiklar/%s::%s har ett slug-falt som inte ar ett "
                "objekt utan %s. Det ska vara tva strangar, sv och en."
                % (namn, namn, type(slug).__name__))
            ut.append(None)
            continue
        if not isinstance(slug.get("sv"), str) or not isinstance(slug.get("en"), str):
            fel("::error file=verktyg/artiklar/%s::%s saknar slug.sv eller slug.en - "
                "artikeln kan da inte fa nagot sprakpar och speglingen star oskyddad."
                % (namn, namn))
            ut.append(None)
            continue
        ut.append((slug["en"] + ".html", slug["sv"] + ".html", namn))
    return ut


def bygg():
    """Returnerar (par, trasigt) dar par ar en lista av (en, sv, kalla)."""
    par = []
    trasigt = False
    for a, b in STATISKA:
        par.append((a, b, "fast sidpar"))
    for a, b in ARV:
        par.append((a, b, "arv, ingen spec"))
    for post in ur_specarna():
        if post is None:
            trasigt = True
        else:
            par.append(post)

    # Samma fil i tva par ar inte en dubblett att tyst hoppa over - det betyder
    # att tva specar gor ansprak pa samma sida, och da ar en av dem fel.
    sett = {}
    for a, b, kalla in par:
        for f in (a, b):
            if f in sett:
                fel("::error::%s ingar i tva sprakpar (%s och %s) - en av dem ar fel."
                    % (f, sett[f], kalla))
                trasigt = True
            sett[f] = kalla

    # Ett par som pekar pa en fil som inte finns ser i utdatan ut precis som ett
    # par som stammer. Sag det rakt ut i stallet.
    for a, b, kalla in par:
        for f in (a, b):
            if not os.path.exists(os.path.join(ROT, f)):
                fel("::error::sprakparet fran %s pekar pa %s som inte finns i repot."
                    % (kalla, f))
                trasigt = True

    # Tackningen at andra hallet: en sida som inte ingar i nagot par ar oskyddad
    # av regel 2. Det var precis den vagen tystnaden gick 2026-09-03.
    #
    # ⚠️ SCOPET AR REPOROTEN MED FLIT, inte rekursivt. Sidorna under examples/
    # ar exempelsajter och ska INTE spraskspeglas - en rekursiv sokning hade kravt ett
    # sprakpar for var och en av dem och gjort kontrollen omojlig att halla gron.
    # Samma scope som den handskrivna loopen hade fore #30 (`for f in *.html`), alltsa
    # ingen forandring - men det star har sa att den som ser en oskyddad sida under
    # examples/ slipper dra slutsatsen att kontrollen ar trasig. (Granskningens N1/N-E.)
    for p in sorted(glob.glob(os.path.join(ROT, "*.html"))):
        f = os.path.basename(p)
        if f not in sett:
            fel("::error file=%s::%s ingar inte i nagot sprakpar - speglingen ar "
                "oskyddad for den sidan. Ar det en artikel ska den ha en spec i "
                "verktyg/artiklar/; ar det en fast sida ska den in i STATISKA i "
                "verktyg/sprakpar.py." % (f, f))
            trasigt = True

    # ⚠️ TILLAGT efter granskning (fynd N2). Noll par ar inte ett friskt
    # tillstand - det ar en lista som tappat sitt innehall, och i utdatan ser den ut
    # precis som en lista dar allt stammer. Sitemap-steget i samma workflow larde sig
    # det redan ("if not loc: sys.exit"); det har ar samma sak.
    if not par:
        fel("::error::sprakpar.py hittade noll sprakpar. Det betyder inte att allt ar "
            "bra - det betyder att listan ar tom och att regel 2 inte kontrolleras av "
            "nagot alls.")
        trasigt = True

    return par, trasigt


if __name__ == "__main__":
    # Radslut: prov.yml laser den har utdatan med `while read -r a b`. Pa Windows
    # skriver print() CRLF, och da far andra faltet ett vagnreturtecken pa slutet -
    # vilket ger "No such file or directory" pa en fil som FINNS. Uppmatt lokalt
    # 2026-09-06. CI kor Linux och hade inte visat det; ett skript ska ge samma
    # utdata bada stallena, annars provar man inte det man kor.
    try:
        sys.stdout.reconfigure(newline="\n")
        # Aven stderr - kommentaren ovan sager "samma utdata bada stallena",
        # och da duger inte halva utdatan (granskningens fynd N3).
        sys.stderr.reconfigure(newline="\n")
    except AttributeError:  # aldre Python - da ar radslutet redan LF
        pass
    par, trasigt = bygg()
    visa_kalla = len(sys.argv) > 1 and sys.argv[1] == "--lista"
    for a, b, kalla in par:
        if visa_kalla:
            print("%-52s %-46s (%s)" % (a, b, kalla))
        else:
            print("%s %s" % (a, b))
    sys.exit(1 if trasigt else 0)
