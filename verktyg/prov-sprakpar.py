# -*- coding: utf-8 -*-
"""Prov for verktyg/sprakpar.py - den enda som numera bar regel 2.

VARFOR DET HAR FINNS
====================
Fore PR #30 var sprakparlistan en DEKLARATIV lista i workflowen: en granskare
kunde lasa den och se vad som tacktes. Efter PR #30 ar den utfallet av logik, och
granskaren pekade pa foljden: *den nya ensamma bararen har inget eget prov.*

Det ar samma invandning som `prov.yml`s egen rubrik gor mot handkorda prov - ett
prov som aldrig kors ar inget skydd alls. Skillnaden mot forr ar att ett fel i
`sprakpar.py` inte syns som ett fel, utan som ett FARRE PAR. Provet gar gront,
med farre kontroller. Precis den tystnad #18 handlade om.

Darfor provas skriptet pa sitt VERKLIGA beteende: en kopia av tradet muteras, och
provet kraver att skriptet FALLER. Ett prov som bara kor det rena fallet kan inte
skilja "skriptet fungerar" fran "skriptet returnerar tomt".

    python verktyg/prov-sprakpar.py

Alla fall kors, sedan rapporteras summan. Ett enda fel ger avslutkod 1.
"""
import io
import json
import os
import shutil
import subprocess
import sys
import tempfile

ROT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKRIPT = os.path.join(ROT, "verktyg", "sprakpar.py")

SIDOR = ["index.html", "sv.html", "privacy.html", "integritet.html",
         "studio.html", "webbstudio.html", "it-management.html", "it-chef.html",
         "insights.html", "insikter.html",
         "insights-invisible-on-google.html", "insikter-osynlig-pa-google.html"]

SPEC = {"slug": {"sv": "insikter-en-text", "en": "insights-a-text"},
        "datum": "2026-01-01", "titel": {"sv": "T", "en": "T"}}


def bygg_trad(mappen):
    """Ett minimalt trad med samma FORM som repot: fasta sidor, ARV-paret, en spec."""
    os.makedirs(os.path.join(mappen, "verktyg", "artiklar"))
    shutil.copy(SKRIPT, os.path.join(mappen, "verktyg", "sprakpar.py"))
    for f in SIDOR + ["insikter-en-text.html", "insights-a-text.html"]:
        io.open(os.path.join(mappen, f), "w", encoding="utf-8").write("<html></html>\n")
    io.open(os.path.join(mappen, "verktyg", "artiklar", "en-text.json"),
            "w", encoding="utf-8").write(json.dumps(SPEC, ensure_ascii=False))


def kor(mappen):
    p = subprocess.Popen([sys.executable, os.path.join(mappen, "verktyg", "sprakpar.py")],
                         stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    ut, fel = p.communicate()
    return p.returncode, ut.decode("utf-8", "replace"), fel.decode("utf-8", "replace")


# Varje fall: (namn, muterare, vantad avslutkod, text som ska sta i felutdatan)
def m_ingen(d):
    pass


def m_ny_sida_utan_par(d):
    io.open(os.path.join(d, "nyheter.html"), "w", encoding="utf-8").write("<html></html>\n")


def m_fil_saknas(d):
    os.remove(os.path.join(d, "it-chef.html"))


def m_arvfil_saknas(d):
    os.remove(os.path.join(d, "insikter-osynlig-pa-google.html"))


def m_spec_utan_slug_en(d):
    p = os.path.join(d, "verktyg", "artiklar", "en-text.json")
    s = json.load(io.open(p, encoding="utf-8"))
    del s["slug"]["en"]
    io.open(p, "w", encoding="utf-8").write(json.dumps(s, ensure_ascii=False))


def m_slug_fel_typ(d):
    p = os.path.join(d, "verktyg", "artiklar", "en-text.json")
    s = json.load(io.open(p, encoding="utf-8"))
    s["slug"] = []
    io.open(p, "w", encoding="utf-8").write(json.dumps(s, ensure_ascii=False))


def m_tva_specar_samma_sida(d):
    p = os.path.join(d, "verktyg", "artiklar", "en-text.json")
    shutil.copy(p, os.path.join(d, "verktyg", "artiklar", "dubblett.json"))


def m_trasig_json(d):
    io.open(os.path.join(d, "verktyg", "artiklar", "trasig.json"),
            "w", encoding="utf-8").write("{ inte json")


def m_spec_pekar_pa_fil_som_saknas(d):
    p = os.path.join(d, "verktyg", "artiklar", "en-text.json")
    s = json.load(io.open(p, encoding="utf-8"))
    s["slug"]["en"] = "insights-finns-inte"
    io.open(p, "w", encoding="utf-8").write(json.dumps(s, ensure_ascii=False))


def m_paret_pekar_pa_sig_sjalvt(d):
    p = os.path.join(d, "verktyg", "artiklar", "en-text.json")
    s = json.load(io.open(p, encoding="utf-8"))
    s["slug"]["en"] = s["slug"]["sv"]
    io.open(p, "w", encoding="utf-8").write(json.dumps(s, ensure_ascii=False))


def m_allt_borta(d):
    """Degenererat tomt lage: noll par, noll sidor, noll specar. Ska INTE ga gront.

    Forsta versionen av det har fallet tog bara bort sidorna och specarna - men da
    ligger STATISKA kvar och skriptet faller pa "filen finns inte" i stallet. Fallet
    var gront och provade nagonting annat an det pastod, vilket ar precis den feltyp
    provet finns for. Listorna maste tommas i KOPIAN av skriptet for att det
    degenererade laget ska uppsta pa riktigt.
    """
    for f in os.listdir(d):
        if f.endswith(".html"):
            os.remove(os.path.join(d, f))
    for f in os.listdir(os.path.join(d, "verktyg", "artiklar")):
        os.remove(os.path.join(d, "verktyg", "artiklar", f))
    p = os.path.join(d, "verktyg", "sprakpar.py")
    s = io.open(p, encoding="utf-8", newline="").read()
    for namn in ("STATISKA", "ARV"):
        start = s.index(namn + " = [")
        slut = s.index("]", start) + 1
        s = s[:start] + namn + " = []" + s[slut:]
    io.open(p, "w", encoding="utf-8", newline="").write(s)


FALL = [
    ("rent trad ger gront", m_ingen, 0, None),
    ("ny sida utan par", m_ny_sida_utan_par, 1, "ingar inte i nagot sprakpar"),
    ("fast sidpar dar filen saknas", m_fil_saknas, 1, "som inte finns i repot"),
    ("ARV-parets fil saknas", m_arvfil_saknas, 1, "som inte finns i repot"),
    ("spec utan slug.en", m_spec_utan_slug_en, 1, "saknar slug.sv eller slug.en"),
    ("slug har fel typ", m_slug_fel_typ, 1, "slug"),
    ("tva specar gor ansprak pa samma sida", m_tva_specar_samma_sida, 1, "ingar i tva sprakpar"),
    ("trasig JSON", m_trasig_json, 1, "gar inte att lasa som JSON"),
    ("spec pekar pa fil som saknas", m_spec_pekar_pa_fil_som_saknas, 1, "som inte finns i repot"),
    ("paret pekar pa sig sjalvt", m_paret_pekar_pa_sig_sjalvt, 1, "ingar i tva sprakpar"),
    ("noll par och noll sidor", m_allt_borta, 1, "noll sprakpar"),
]


def main():
    fel = 0
    for namn, mutera, vantad, text in FALL:
        d = tempfile.mkdtemp(prefix="sprakparprov-")
        try:
            bygg_trad(d)
            mutera(d)
            kod, ut, felut = kor(d)
            if kod != vantad:
                print("::error::%s: vantade avslutkod %d, fick %d" % (namn, vantad, kod))
                print(felut.strip()[:400])
                fel = 1
            elif text and text not in felut:
                # Ett prov som bara kollar avslutkoden kan inte skilja "ratt fel"
                # fran "fel av nagon helt annan anledning".
                print("::error::%s: rott av fel skal - '%s' saknas i felutdatan" % (namn, text))
                print(felut.strip()[:400])
                fel = 1
            else:
                print("  ok    %-42s exit %d" % (namn, kod))
        finally:
            shutil.rmtree(d, ignore_errors=True)

    # Det rena fallet ska ocksa ge RATT ANTAL par - annars kan skriptet returnera
    # farre kontroller utan att nagot blir rott, vilket ar precis felet #18 handlade om.
    d = tempfile.mkdtemp(prefix="sprakparprov-")
    try:
        bygg_trad(d)
        kod, ut, felut = kor(d)
        rader = [r for r in ut.splitlines() if r.strip()]
        if len(rader) != 7:
            print("::error::rent trad gav %d par, vantade 7 (5 fasta + 1 arv + 1 spec)" % len(rader))
            fel = 1
        else:
            print("  ok    %-42s 7 par" % "rent trad ger ratt ANTAL par")
    finally:
        shutil.rmtree(d, ignore_errors=True)

    print("\n%d fall korda." % (len(FALL) + 1))
    return fel


if __name__ == "__main__":
    sys.exit(main())
